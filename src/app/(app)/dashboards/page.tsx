import { getSession, canEditDashboard, isSuperAdmin } from '@/lib/auth';
import { listDashboardsVisibleTo } from '@/lib/db';
import { fetchCatalog } from '@/lib/gateway';
import { DashboardListClient } from '@/components/dashboard/DashboardListClient';

export default async function DashboardsPage() {
  const user = await getSession();
  if (!user) return null;

  // Firms from VPS gateway catalog (source of truth), not local seed JSON
  let companies: { id: string; name: string; slug: string }[] = [];
  try {
    const catalog = await fetchCatalog(false);
    const tenants = catalog.tenants || [];
    if (isSuperAdmin(user) || user.role === 'admin' || user.role === 'super_admin') {
      companies = tenants.map((t: any) => ({
        id: String(t.id || t.slug),
        name: String(t.name || t.slug),
        slug: String(t.slug),
      }));
    } else {
      // Viewer/editor: only their company (+ firms they already see dashboards for)
      const allowedSlugs = new Set([user.companySlug, ...(user.tenantSlugs || [])].filter(Boolean));
      companies = tenants
        .filter((t: any) => allowedSlugs.size === 0 || allowedSlugs.has(t.slug))
        .map((t: any) => ({
          id: String(t.id || t.slug),
          name: String(t.name || t.slug),
          slug: String(t.slug),
        }));
    }
  } catch {
    companies = [];
  }

  const catalogTenantIds = companies.map((c) => c.id);
  const dashboards = await listDashboardsVisibleTo({
    ...user,
    tenantSlugs: user.tenantSlugs || [],
    tenantIds: catalogTenantIds.filter((id) => (user.tenantSlugs || []).some((slug) => companies.find((c) => c.id === id)?.slug === slug)),
  });
  const canEdit = canEditDashboard(user.role);

  // Map dashboard.companyId (often slug or local id) — normalize so filter works
  const slugById = new Map(companies.map((c) => [c.id, c.slug]));
  const idBySlug = new Map(companies.map((c) => [c.slug, c.id]));

  return (
    <DashboardListClient
      initial={dashboards}
      canEdit={canEdit}
      companies={companies}
      userRole={user.role}
      isSuperAdmin={Boolean(user.isSuperAdmin || user.role === 'super_admin' || user.role === 'admin')}
      userCompanyId={user.companyId}
      companyIdBySlug={Object.fromEntries(idBySlug)}
      userTenantSlugs={user.tenantSlugs || []}
    />
  );
}
