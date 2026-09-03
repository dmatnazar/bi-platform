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
        tenantSlugs: [co?.slug || 'demo'],
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
      tenantSlugs: Array.from(new Set(
        (Array.isArray(s.tenantSlugs) ? s.tenantSlugs : []).concat(s.tenantSlug ? [s.tenantSlug] : [])
      )),
      companyName: (Array.isArray(s.tenantSlugs) ? s.tenantSlugs : [s.tenantSlug])
        .filter(Boolean)
        .map((slug: string) => nameBySlug.get(slug) || slug)
        .join(', '),
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
  tenantSlugs: z.array(z.string().min(1)).optional(),
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

  // Superadmin may assign an employee to any number of companies.
  // Company admins/editors are restricted to their own company.
  const requestedSlugs = Array.from(
    new Set(
      (Array.isArray(data.tenantSlugs) ? data.tenantSlugs : [])
        .concat(data.tenantSlug ? [data.tenantSlug] : [])
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
    )
  );
  const tenantSlugs = isSuperAdmin(user)
    ? requestedSlugs
    : user.companySlug
      ? [user.companySlug]
      : requestedSlugs.slice(0, 1);

  if (tenantSlugs.length === 0) {
    return NextResponse.json({ error: 'Iň az bir firma saýlaň' }, { status: 400 });
  }

  const primaryTenantSlug = tenantSlugs[0];
  const catalog = await fetchCatalog(true);
  const allStaff = catalog.staff || [];

  const id = data.id || crypto.randomUUID();
  const existingAnywhere = allStaff.find(
    (s) =>
      (data.id && s.id === data.id) ||
      s.username.toLowerCase() === data.username.toLowerCase()
  );

  const oldTenantSlugs = Array.from(
    new Set(
      (
        (existingAnywhere as { tenantSlugs?: string[] } | undefined)?.tenantSlugs ||
        (existingAnywhere?.tenantSlug ? [existingAnywhere.tenantSlug] : [])
      ).filter(Boolean)
    )
  );

  let existing = existingAnywhere;
  let passwordHash = 'synced-from-bi:keep';
  let passwordPlain: string | undefined;

  if (data.password) {
    passwordHash = hashPasswordBcrypt(data.password);
    passwordPlain = data.password;
  } else if (existing) {
    const lookup = await staffLookup(existing.username);
    if (lookup.ok && lookup.data?.passwordHash) {
      passwordHash = lookup.data.passwordHash;
    }
  } else {
    return NextResponse.json({ error: 'Täze işgär üçin parol gerek' }, { status: 400 });
  }

  const entry: any = {
    id: existing?.id || id,
    fullName: data.fullName,
    username: data.username,
    passwordHash,
    role: data.role === 'admin' ? 'admin' : data.role === 'editor' ? 'editor' : 'viewer',
    tenantSlug: primaryTenantSlug,
    tenantSlugs,
    phone: data.phone,
    email: data.email || undefined,
    active: data.active,
  };
  if (passwordPlain) entry.passwordPlain = passwordPlain;
  if (existing?.passwordEnc && !passwordPlain) entry.passwordEnc = existing.passwordEnc;

  // /sync-staff is tenant-scoped, so synchronize every affected company.
  // For each company, preserve its other staff and put this employee into
  // exactly the selected tenant list.
  const affectedSlugs = Array.from(new Set([...oldTenantSlugs, ...tenantSlugs]));
  const selectedSet = new Set(tenantSlugs);

  for (const slug of affectedSlugs) {
    const list = allStaff.filter(
      (s) =>
        s.tenantSlug === slug ||
        (Array.isArray((s as { tenantSlugs?: string[] }).tenantSlugs) &&
          (s as { tenantSlugs?: string[] }).tenantSlugs!.includes(slug))
    );

    const others = list.filter(
      (s) =>
        s.id !== entry.id &&
        s.username.toLowerCase() !== entry.username.toLowerCase()
    );

    const shouldIncludeEmployee = selectedSet.has(slug);
    const payloadStaff = [
      ...others.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        username: s.username,
        passwordHash: 'synced-from-bi:keep',
        role: s.role,
        tenantSlug: s.tenantSlug,
        tenantSlugs: s.tenantSlugs || [s.tenantSlug],
        phone: s.phone,
        email: s.email,
        active: s.active,
        passwordEnc: s.passwordEnc,
      })),
      ...(shouldIncludeEmployee
        ? [{
            ...entry,
            // Keep the complete assignment list in the record, while the
            // sync itself is scoped to this company.
            tenantSlug: slug,
            tenantSlugs,
          }]
        : []),
    ];

    const res = await syncStaffToGateway(slug, payloadStaff as any);
    if (!res.ok) {
      return NextResponse.json(
        { error: `VPS-e "${slug}" kompaniýasyna ýazyp bolmady`, detail: res.data },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ ok: true, staffId: entry.id, synced: true, tenantSlug: primaryTenantSlug, tenantSlugs });
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
