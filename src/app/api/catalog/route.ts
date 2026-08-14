import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin, canManageStaff } from '@/lib/auth';
import { fetchCatalog } from '@/lib/gateway';

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get('refresh') === '1';
  const catalog = await fetchCatalog(force);

  // Super admin — everything
  if (isSuperAdmin(user)) {
    return NextResponse.json(catalog);
  }

  // Company admin / editor / viewer — their tenant only
  const slug = user.companySlug;
  if (!slug) {
    // Try match by companyId if it is actually a slug
    const byId = catalog.tenants.find((t) => t.id === user.companyId);
    const effectiveSlug = byId?.slug;
    if (!effectiveSlug) {
      return NextResponse.json({
        tenants: [],
        endpoints: [],
        staff: [],
        syncedAt: catalog.syncedAt,
        fromCache: catalog.fromCache,
      });
    }
    return NextResponse.json({
      tenants: catalog.tenants.filter((t) => t.slug === effectiveSlug),
      endpoints: catalog.endpoints.filter((e) => e.tenantSlug === effectiveSlug),
      staff: catalog.staff.filter(
        (s) => s.tenantSlug === effectiveSlug || s.tenantSlugs?.includes(effectiveSlug)
      ),
      syncedAt: catalog.syncedAt,
      fromCache: catalog.fromCache,
    });
  }

  return NextResponse.json({
    tenants: catalog.tenants.filter((t) => t.slug === slug),
    endpoints: catalog.endpoints.filter((e) => e.tenantSlug === slug),
    staff: catalog.staff.filter(
      (s) => s.tenantSlug === slug || s.tenantSlugs?.includes(slug)
    ),
    syncedAt: catalog.syncedAt,
    fromCache: catalog.fromCache,
  });
}
