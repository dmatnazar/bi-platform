import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin, actorTenantSlugs } from '@/lib/auth';
import { fetchCatalog } from '@/lib/gateway';

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get('refresh') === '1';
  const catalog = await fetchCatalog(force);

  if (isSuperAdmin(user)) {
    return NextResponse.json(catalog);
  }

  const mine = new Set(actorTenantSlugs(user));
  if (!mine.size && user.companyId) {
    const byId = catalog.tenants.find((t) => t.id === user.companyId);
    if (byId?.slug) mine.add(byId.slug);
  }

  const inScope = (slug: string | undefined) => Boolean(slug && mine.has(slug));
  const staffInScope = (s: any) => {
    const slugs = [
      s.tenantSlug,
      ...(Array.isArray(s.tenantSlugs) ? s.tenantSlugs : []),
    ]
      .map((x: any) => String(x || '').trim())
      .filter(Boolean);
    return slugs.some((x: string) => mine.has(x));
  };

  return NextResponse.json({
    tenants: (catalog.tenants || []).filter((t) => inScope(t.slug)),
    endpoints: (catalog.endpoints || []).filter((e) => inScope(e.tenantSlug)),
    staff: (catalog.staff || []).filter(staffInScope),
    connections: Array.isArray((catalog as any).connections)
      ? (catalog as any).connections.filter((c: any) => inScope(c.tenantSlug))
      : undefined,
    syncedAt: catalog.syncedAt,
    fromCache: catalog.fromCache,
  });
}
