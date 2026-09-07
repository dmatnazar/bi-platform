import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'node:crypto';
import { getStaffInvite, markStaffInviteSeatsUsed } from '@/lib/db';
import {
  checkGatewayHealth,
  fetchCatalog,
  upsertStaffOnGateway,
  syncStaffToGateway,
  hashPasswordBcrypt,
} from '@/lib/gateway';

const memberSchema = z.object({
  fullName: z.string().min(2),
  username: z.string().min(3),
  password: z.string().min(6),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
});

const bodySchema = z.object({
  token: z.string().min(10),
  members: z.array(memberSchema).min(1).max(50),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Maglumatlar nädogry (ady, login ≥3, parol ≥6)' },
      { status: 400 }
    );
  }

  const { token, members } = parsed.data;
  const invite = await getStaffInvite(token);
  if (!invite) {
    return NextResponse.json({ error: 'Invite tapylmady' }, { status: 404 });
  }
  if (invite.usedAt) {
    return NextResponse.json({ error: 'Bu invite eýýäm ulanyldy' }, { status: 410 });
  }
  if (Date.parse(invite.expiresAt) < Date.now()) {
    return NextResponse.json({ error: 'Invite möhleti gutardy' }, { status: 410 });
  }

  const remaining = Math.max(0, invite.seats - (invite.usedSeats || 0));
  if (members.length > remaining) {
    return NextResponse.json(
      { error: `Diňe ${remaining} işgär galyndy (invite ${invite.seats})` },
      { status: 400 }
    );
  }

  if (!(await checkGatewayHealth())) {
    return NextResponse.json(
      { error: 'VPS Gateway offline — soňrak synanyň' },
      { status: 503 }
    );
  }

  const catalog = await fetchCatalog(true);
  const allStaff = catalog.staff || [];
  const usernames = new Set(
    allStaff.map((s: any) => String(s.username || '').toLowerCase())
  );

  // Unique within request
  const seen = new Set<string>();
  for (const m of members) {
    const u = m.username.toLowerCase().trim();
    if (seen.has(u)) {
      return NextResponse.json({ error: `Login gaýtalanýar: ${m.username}` }, { status: 400 });
    }
    seen.add(u);
    if (usernames.has(u)) {
      return NextResponse.json(
        { error: `Login eýýäm bar: ${m.username}` },
        { status: 409 }
      );
    }
  }

  const tenantSlugs = invite.tenantSlugs;
  const role = invite.role;
  const created: { id: string; username: string }[] = [];
  const errors: string[] = [];

  for (const m of members) {
    const id = crypto.randomUUID();
    const passwordHash = hashPasswordBcrypt(m.password);
    const entry = {
      id,
      fullName: m.fullName.trim(),
      username: m.username.trim(),
      passwordHash,
      passwordPlain: m.password,
      role,
      tenantSlugs,
      tenantSlug: tenantSlugs[0],
      phone: m.phone || undefined,
      email: m.email || undefined,
      active: true,
    };

    const upsertRes = await upsertStaffOnGateway({
      id: entry.id,
      tenantSlug: entry.tenantSlug,
      tenantSlugs: entry.tenantSlugs,
      fullName: entry.fullName,
      username: entry.username,
      passwordHash: entry.passwordHash,
      passwordPlain: entry.passwordPlain,
      role: entry.role,
      phone: entry.phone,
      email: entry.email,
      active: entry.active,
    });

    if (!upsertRes.ok) {
      errors.push(
        `${entry.username}: ${upsertRes.data?.error || upsertRes.data?.message || 'VPS ýazyp bolmady'}`
      );
      continue;
    }

    // Per-tenant roster sync (best-effort)
    for (const slug of tenantSlugs) {
      try {
        const others = allStaff
          .filter((s: any) => {
            const slugs = Array.isArray(s.tenantSlugs) && s.tenantSlugs.length
              ? s.tenantSlugs
              : s.tenantSlug
                ? [s.tenantSlug]
                : [];
            return slugs.includes(slug) && s.username?.toLowerCase() !== entry.username.toLowerCase();
          })
          .map((s: any) => ({
            id: s.id,
            fullName: s.fullName,
            username: s.username,
            role: s.role,
            tenantSlugs: Array.isArray(s.tenantSlugs) && s.tenantSlugs.length ? s.tenantSlugs : [slug],
            phone: s.phone,
            email: s.email,
            active: s.active,
            passwordEnc: s.passwordEnc,
            passwordHash: 'synced-from-bi:keep',
          }));
        others.push({
          id: entry.id,
          fullName: entry.fullName,
          username: entry.username,
          role: entry.role,
          tenantSlugs: entry.tenantSlugs,
          phone: entry.phone,
          email: entry.email,
          active: true,
          passwordEnc: undefined,
          passwordHash: entry.passwordHash,
        } as any);
        await syncStaffToGateway(slug, others as any);
      } catch {
        /* ignore sync warn */
      }
    }

    created.push({ id: entry.id, username: entry.username });
    usernames.add(entry.username.toLowerCase());
    allStaff.push(entry as any);
  }

  if (created.length) {
    await markStaffInviteSeatsUsed(token, created.length);
  }

  if (!created.length) {
    return NextResponse.json(
      { error: errors[0] || 'Işgär goşup bolmady', details: errors },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    created,
    count: created.length,
    warnings: errors.length ? errors : undefined,
  });
}
