import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'node:crypto';
import {
  getSession,
  canInviteStaff,
  isSuperAdmin,
  assignableRoles,
  actorTenantSlugs,
} from '@/lib/auth';
import {
  createStaffInvite,
  getStaffInvite,
  listStaffInvites,
  deleteStaffInvite,
  extendStaffInvite,
} from '@/lib/db';
import type { StaffRole } from '@/lib/types';

const createSchema = z.object({
  tenantSlugs: z.array(z.string().min(1)).min(1),
  role: z.enum(['super_admin', 'admin', 'editor', 'viewer']),
  seats: z.number().int().min(1).max(50),
  ttlMinutes: z.number().int().min(1).max(180).optional(),
});

const extendSchema = z.object({
  token: z.string().min(10),
  addMinutes: z.number().int().min(1).max(180),
});

function baseUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
  if (env) return env.replace(/\/$/, '');
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

function inviteUrl(req: NextRequest, token: string) {
  return `${baseUrl(req)}/invite?token=${encodeURIComponent(token)}`;
}

function serializeInvite(req: NextRequest, row: NonNullable<Awaited<ReturnType<typeof getStaffInvite>>>) {
  const expiresMs = Date.parse(row.expiresAt);
  const now = Date.now();
  const remainingSeats = Math.max(0, row.seats - (row.usedSeats || 0));
  const expired = Number.isNaN(expiresMs) || expiresMs < now;
  return {
    token: row.token,
    url: inviteUrl(req, row.token),
    role: row.role,
    tenantSlugs: row.tenantSlugs,
    seats: row.seats,
    usedSeats: row.usedSeats || 0,
    remainingSeats,
    expiresAt: row.expiresAt,
    expiresInSec: expired ? 0 : Math.max(0, Math.floor((expiresMs - now) / 1000)),
    expired,
    active: !expired && remainingSeats > 0 && !row.usedAt,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    createdByUsername: row.createdByUsername,
  };
}

/**
 * GET
 *  - ?token=xxx  → public validate
 *  - no token    → auth list (active + expired, not fully used)
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';

  if (token) {
    const row = await getStaffInvite(token);
    if (!row) {
      return NextResponse.json({ ok: false, error: 'Invite tapylmady' }, { status: 404 });
    }
    if (row.usedAt || (row.usedSeats || 0) >= row.seats) {
      return NextResponse.json({ ok: false, error: 'Bu invite eýýäm doly ulanyldy' }, { status: 410 });
    }
    const expiresMs = Date.parse(row.expiresAt);
    if (Number.isNaN(expiresMs) || expiresMs < Date.now()) {
      return NextResponse.json({ ok: false, error: 'Invite möhleti gutardy' }, { status: 410 });
    }
    const remainingSeats = Math.max(0, row.seats - (row.usedSeats || 0));
    return NextResponse.json({
      ok: true,
      role: row.role,
      tenantSlugs: row.tenantSlugs,
      seats: row.seats,
      remainingSeats,
      expiresAt: row.expiresAt,
      expiresInSec: Math.max(0, Math.floor((expiresMs - Date.now()) / 1000)),
    });
  }

  const user = await getSession();
  if (!user || !canInviteStaff(user)) {
    return NextResponse.json({ error: 'Invite rugsat ýok' }, { status: 403 });
  }
  const rows = await listStaffInvites({
    createdBy: isSuperAdmin(user) ? undefined : user.id,
    includeExpired: true,
  });
  return NextResponse.json({
    ok: true,
    invites: rows.map((r) => serializeInvite(req, r)),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || !canInviteStaff(user)) {
    return NextResponse.json({ error: 'Invite rugsat ýok' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Firma, rol we san (1–50) gerek' },
      { status: 400 }
    );
  }

  const { role, seats } = parsed.data;
  const ttlMinutes = parsed.data.ttlMinutes ?? Math.max(1, seats * 3);
  const allowedRoles = assignableRoles(user);
  if (!allowedRoles.includes(role as StaffRole)) {
    return NextResponse.json(
      { error: `Bu rol üçin invite rugsat ýok. Rugsat: ${allowedRoles.join(', ') || 'ýok'}` },
      { status: 403 }
    );
  }

  const requested = Array.from(
    new Set(parsed.data.tenantSlugs.map((s) => String(s || '').trim()).filter(Boolean))
  );
  const mine = new Set(actorTenantSlugs(user));
  const tenantSlugs = isSuperAdmin(user)
    ? requested
    : requested.filter((s) => mine.has(s));
  if (!tenantSlugs.length) {
    return NextResponse.json(
      { error: 'Diňe özüňe degişli firmalary saýlap bilersiň' },
      { status: 403 }
    );
  }

  const ttlMs = ttlMinutes * 60 * 1000;
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  await createStaffInvite({
    token,
    tenantSlugs,
    role: role as StaffRole,
    seats,
    expiresAt,
    createdBy: user.id,
    createdByUsername: user.username,
  });

  return NextResponse.json({
    ok: true,
    token,
    url: inviteUrl(req, token),
    expiresAt,
    expiresInSec: Math.floor(ttlMs / 1000),
    seats,
    role,
    tenantSlugs,
    ttlMinutes,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getSession();
  if (!user || !canInviteStaff(user)) {
    return NextResponse.json({ error: 'Invite rugsat ýok' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = extendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'token we addMinutes (1–180) gerek' }, { status: 400 });
  }

  const row = await getStaffInvite(parsed.data.token);
  if (!row) {
    return NextResponse.json({ error: 'Invite tapylmady' }, { status: 404 });
  }
  if (!isSuperAdmin(user) && row.createdBy !== user.id) {
    return NextResponse.json({ error: 'Diňe öz invite-leriňi üýtgedip bilersiň' }, { status: 403 });
  }

  const res = await extendStaffInvite(parsed.data.token, parsed.data.addMinutes);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }
  const updated = await getStaffInvite(parsed.data.token);
  return NextResponse.json({
    ...res,
    invite: updated ? serializeInvite(req, updated) : null,
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user || !canInviteStaff(user)) {
    return NextResponse.json({ error: 'Invite rugsat ýok' }, { status: 403 });
  }
  let token = req.nextUrl.searchParams.get('token') || '';
  if (!token) {
    const body = await req.json().catch(() => ({}));
    token = String(body.token || '');
  }
  if (!token) {
    return NextResponse.json({ error: 'token gerek' }, { status: 400 });
  }
  const row = await getStaffInvite(token);
  if (!row) {
    return NextResponse.json({ error: 'Invite tapylmady' }, { status: 404 });
  }
  if (!isSuperAdmin(user) && row.createdBy !== user.id) {
    return NextResponse.json({ error: 'Diňe öz invite-leriňi pozup bilersiň' }, { status: 403 });
  }
  await deleteStaffInvite(token);
  return NextResponse.json({ ok: true });
}
