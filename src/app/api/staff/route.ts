import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageStaff, isSuperAdmin } from '@/lib/auth';
import {
  fetchCatalog,
  checkGatewayHealth,
  syncStaffToGateway,
  deleteStaffOnGateway,
  hashPasswordBcrypt,
  staffLookup,
  decryptPasswordPlain,
} from '@/lib/gateway';
import { listStaff, ensureDemoUsers, getCompanyById } from '@/lib/db';
import { z } from 'zod';
import crypto from 'node:crypto';

export async function GET() {
  const user = await getSession();
  if (!user || !canManageStaff(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  await ensureDemoUsers();

  const localStaff = await listStaff(isSuperAdmin(user) ? undefined : user.companyId);
  const localMapped = await Promise.all(
    localStaff.map(async (s) => {
      const co = await getCompanyById(s.companyId);
      return {
        id: s.id,
        fullName: s.fullName,
        username: s.username,
        role: s.role,
        phone: s.phone,
        email: s.email,
        active: s.active,
        tenantSlug: co?.slug || 'demo',
        tenantSlugs: (s as any).tenantSlugs || (co?.slug ? [co.slug] : []),
        companyId: s.companyId,
        source: 'local' as const,
        passwordReveal: '',
        updatedAt: s.updatedAt,
      };
    })
  );

  let remoteMapped: any[] = [];
  try {
    const catalog = await fetchCatalog(true);
    let remote = catalog.staff || [];
    if (!isSuperAdmin(user) && user.companySlug) {
      remote = remote.filter(
        (s) =>
          s.tenantSlug === user.companySlug ||
          s.tenantSlugs?.includes(user.companySlug!)
      );
    }
    const nameBySlug = new Map(
      (catalog.tenants || []).map((t) => [t.slug, t.name] as const)
    );
    remoteMapped = remote.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      username: s.username,
      role: s.role as any,
      phone: s.phone,
      email: s.email,
      active: s.active,
      tenantSlug: s.tenantSlug,
      companyId: (s as any).tenantId || (s as any).companyId,
      tenantSlugs: Array.isArray(s.tenantSlugs) && s.tenantSlugs.length ? s.tenantSlugs : (s.tenantSlug ? [s.tenantSlug] : []),
      companyName: (Array.isArray(s.tenantSlugs) && s.tenantSlugs.length
        ? s.tenantSlugs.map((slug: string) => nameBySlug.get(slug) || slug).join(', ')
        : (nameBySlug.get(s.tenantSlug) || s.tenantSlug)),
      source: 'gateway' as const,
      passwordReveal: (s as any).password || decryptPasswordPlain(s.passwordEnc) || '',
      updatedAt: s.updatedAt,
    }));
  } catch {
    /* */
  }

  const byUser = new Map<string, (typeof localMapped)[0]>();
  for (const s of localMapped) byUser.set(s.username.toLowerCase(), s);
  for (const s of remoteMapped) byUser.set(s.username.toLowerCase(), s);

  const staff = Array.from(byUser.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName)
  );

  return NextResponse.json({ staff, count: staff.length });
}

const upsertSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().min(1),
  username: z.string().min(3),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'editor', 'viewer']),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  active: z.boolean().default(true),
  tenantSlug: z.string().optional(),
  tenantSlugs: z.array(z.string()).optional(),
  previousTenantSlug: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || !canManageStaff(user.role)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  const online = await checkGatewayHealth();
  if (!online) {
    return NextResponse.json(
      { error: 'VPS Gateway bagly däl. Sync üçin online bolmaly.' },
      { status: 503 }
    );
  }

  const body = await req.json();
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Maglumatlar nädogry' }, { status: 400 });
  }

  const data = parsed.data;
  const requestedSlugs: string[] = Array.from(new Set(
    (data.tenantSlugs?.length ? data.tenantSlugs : (data.tenantSlug ? [data.tenantSlug] : []))
      .map((s: string) => String(s || '').trim())
      .filter((s): s is string => Boolean(s))
  ));
  const allowedSlugs = isSuperAdmin(user)
    ? requestedSlugs
    : requestedSlugs.filter((s) => s === user.companySlug);
  const tenantSlugs = allowedSlugs.length
    ? allowedSlugs
    : (user.companySlug ? [user.companySlug] : []);
  if (!tenantSlugs.length) {
    return NextResponse.json({ error: 'Kompaniýa saýlanmady' }, { status: 400 });
  }

  const catalog = await fetchCatalog(true);
  const allStaff = catalog.staff || [];
  const id = data.id || crypto.randomUUID();
  const existingAnywhere = allStaff.find(
    (s) => (data.id && s.id === data.id) || s.username.toLowerCase() === data.username.toLowerCase()
  );

  let passwordHash = 'synced-from-bi:keep';
  let passwordPlain: string | undefined;
  if (data.password) {
    passwordHash = hashPasswordBcrypt(data.password);
    passwordPlain = data.password;
  } else if (existingAnywhere) {
    const lookup = await staffLookup(existingAnywhere.username);
    if (lookup.ok && lookup.data?.passwordHash) passwordHash = lookup.data.passwordHash;
  } else {
    return NextResponse.json({ error: 'Täze işgär üçin parol gerek' }, { status: 400 });
  }

  const existingSlugs: string[] = Array.from(new Set(
    (
      (Array.isArray((existingAnywhere as any)?.tenantSlugs)
        ? (existingAnywhere as any).tenantSlugs
        : ((existingAnywhere as any)?.tenantSlug ? [(existingAnywhere as any).tenantSlug] : [])) as unknown[]
    )
      .map((s: unknown) => String(s ?? '').trim())
      .filter((s): s is string => s.length > 0)
  ));
  const entry: any = {
    id: existingAnywhere?.id || id,
    fullName: data.fullName,
    username: data.username,
    passwordHash,
    role: data.role === 'admin' ? 'admin' : data.role === 'editor' ? 'editor' : 'viewer',
    tenantSlugs,
    tenantSlug: tenantSlugs[0],
    phone: data.phone,
    email: data.email || undefined,
    active: data.active,
  };
  if (passwordPlain) entry.passwordPlain = passwordPlain;
  if ((existingAnywhere as any)?.passwordEnc && !passwordPlain) entry.passwordEnc = (existingAnywhere as any).passwordEnc;

  const affectedSlugs: string[] = Array.from(new Set([...existingSlugs, ...tenantSlugs]));
  const staffForTenant = (slug: string) => {
    const members = allStaff.filter((s: any) => {
      const slugs = Array.isArray(s.tenantSlugs) && s.tenantSlugs.length ? s.tenantSlugs : (s.tenantSlug ? [s.tenantSlug] : []);
      return slugs.includes(slug) && s.id !== entry.id && s.username.toLowerCase() !== entry.username.toLowerCase();
    }).map((s: any) => ({
      id: s.id, fullName: s.fullName, username: s.username, passwordHash: 'synced-from-bi:keep',
      role: s.role, tenantSlugs: Array.isArray(s.tenantSlugs) && s.tenantSlugs.length ? s.tenantSlugs : [slug],
      phone: s.phone, email: s.email, active: s.active, passwordEnc: s.passwordEnc,
    }));
    if (tenantSlugs.includes(slug)) members.push(entry);
    return members;
  };

  for (const slug of affectedSlugs) {
    const members = staffForTenant(slug);
    const res = await syncStaffToGateway(slug, members as any);
    if (!res.ok) {
      return NextResponse.json({ error: `VPS-e "${slug}" firmasyna işgär sync bolmady`, detail: res.data }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true, staffId: entry.id, synced: true, tenantSlugs });
}

export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user || !canManageStaff(user.role)) {
    return NextResponse.json({ error: 'Rugsat yok' }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get('id') || undefined;
  const username = req.nextUrl.searchParams.get('username') || undefined;
  if (!id && !username) {
    return NextResponse.json({ error: 'id ya-da username gerek' }, { status: 400 });
  }

  const tenantSlug =
    user.companySlug || req.nextUrl.searchParams.get('tenantSlug') || undefined;

  const online = await checkGatewayHealth();
  if (!online) {
    return NextResponse.json({ error: 'VPS offline' }, { status: 503 });
  }

  const res = await deleteStaffOnGateway({ id, username, tenantSlug });
  if (!res.ok) {
    return NextResponse.json(
      { error: res.data?.error || 'Pozmak sowusuz', detail: res.data },
      { status: res.status || 502 }
    );
  }
  return NextResponse.json({ ok: true, deleted: true, synced: true });
}
