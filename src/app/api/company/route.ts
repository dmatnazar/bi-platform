import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageCompany } from '@/lib/auth';
import { checkGatewayHealth, updateTenantOnGateway, fetchCatalog, deleteTenantOnGateway, entityLockOnGateway } from '@/lib/gateway';
import { getCompanyById, getCompanyBySlug, upsertCompany } from '@/lib/db';
import type { Company } from '@/lib/types';
import { z } from 'zod';

const profileSchema = z.object({
  slug: z.string().optional(),
  name: z.string().min(1),
  legalName: z.string().optional(),
  taxId: z.string().optional(),
  registrationNumber: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

/** Resolve company from local DB or VPS catalog (tenant) */
async function resolveCompany(user: {
  companyId: string;
  companySlug?: string;
  companyName?: string;
}): Promise<Company | null> {
  // 1) Local by id
  let company = await getCompanyById(user.companyId);
  if (company) return company;

  // 2) Local by slug
  if (user.companySlug) {
    company = await getCompanyBySlug(user.companySlug);
    if (company) return company;
  }

  // 3) VPS catalog tenant → materialize local record
  try {
    const catalog = await fetchCatalog(false);
    const tenant =
      catalog.tenants.find((t) => t.slug === user.companySlug) ||
      catalog.tenants.find((t) => t.id === user.companyId) ||
      catalog.tenants.find(
        (t) => t.name && user.companyName && t.name === user.companyName
      );

    if (tenant) {
      const now = new Date().toISOString();
      const materialized: Company = {
        id: tenant.id || user.companyId,
        slug: tenant.slug,
        name: tenant.name || user.companyName || tenant.slug,
        isActive: tenant.isActive !== false,
        createdAt: now,
        updatedAt: tenant.updatedAt || now,
      };
      await upsertCompany(materialized);
      return materialized;
    }
  } catch {
    /* offline */
  }

  // 4) Last resort — synthetic from session
  if (user.companySlug || user.companyName) {
    const now = new Date().toISOString();
    return {
      id: user.companyId || user.companySlug || 'unknown',
      slug: user.companySlug || 'unknown',
      name: user.companyName || user.companySlug || 'Kompaniýa',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
  }
  return null;
}

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  const company = await resolveCompany(user);
  if (!company) return NextResponse.json({ error: 'Kompaniýa ýok' }, { status: 404 });
  return NextResponse.json({ company });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || !canManageCompany(user.role)) {
    return NextResponse.json({ error: 'Rugsat yok' }, { status: 403 });
  }

  const body = await req.json();

  // Hard delete company when requested
  if (body?.delete === true || req.nextUrl.searchParams.get('action') === 'delete') {
    const slug = body.slug || user.companySlug;
    if (!slug) return NextResponse.json({ error: 'slug gerek' }, { status: 400 });
    const online = await checkGatewayHealth();
    if (!online) return NextResponse.json({ error: 'VPS offline' }, { status: 503 });
    const res = await deleteTenantOnGateway({ slug });
    if (res.status === 409) {
      return NextResponse.json(
        {
          error: 'has_dependencies',
          message: res.data?.message || 'Bagly ishgar yada API bar',
          staffCount: res.data?.staffCount,
          endpointCount: res.data?.endpointCount,
        },
        { status: 409 }
      );
    }
    if (!res.ok) {
      return NextResponse.json({ error: res.data?.error || 'Pozmak sowusuz' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, deleted: true });
  }

  // Edit lock acquire/release
  if (body?.lockAction && body?.entityId) {
    const online = await checkGatewayHealth();
    if (!online) return NextResponse.json({ error: 'VPS offline' }, { status: 503 });
    const res = await entityLockOnGateway({
      entityType: body.entityType || 'tenant',
      entityId: body.entityId,
      action: body.lockAction,
      openedBy: body.openedBy || user.username || 'bi',
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: res.data?.error || 'locked', message: res.data?.message },
        { status: res.status || 423 }
      );
    }
    return NextResponse.json({ ok: true, ...res.data });
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'nadogry' }, { status: 400 });

  const targetSlug = parsed.data.slug || user.companySlug;
  let company = await resolveCompany(user);

  // Super-admin may update any tenant by slug from body
  if (parsed.data.slug && parsed.data.slug !== company?.slug) {
    try {
      const catalog = await fetchCatalog(true);
      const tenant = catalog.tenants.find((t) => t.slug === parsed.data.slug);
      if (tenant) {
        company = {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          isActive: tenant.isActive !== false,
          createdAt: new Date().toISOString(),
          updatedAt: tenant.updatedAt || new Date().toISOString(),
        };
      }
    } catch {
      /* ignore */
    }
  }

  if (!company) return NextResponse.json({ error: 'Kompaniýa ýok' }, { status: 404 });

  const now = new Date().toISOString();
  const updated: Company = {
    ...company,
    ...parsed.data,
    slug: company.slug,
    id: company.id,
    updatedAt: now,
  };
  await upsertCompany(updated);

  let gatewaySynced = false;
  const online = await checkGatewayHealth();
  if (online) {
    const res = await updateTenantOnGateway({
      slug: company.slug,
      name: updated.name,
      isActive: updated.isActive,
      expectedUpdatedAt: (body as any).expectedUpdatedAt || company.updatedAt,
    });
    if (res.status === 409) {
      return NextResponse.json(
        {
          error: 'conflict',
          message: res.data?.message || 'Bashga yerde uytgedildi',
          tenant: res.data?.tenant,
        },
        { status: 409 }
      );
    }
    gatewaySynced = res.ok;
    if (!res.ok) {
      return NextResponse.json(
        { error: res.data?.error || 'VPS sync şowsuz', detail: res.data },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ ok: true, company: updated, gatewaySynced });
}
