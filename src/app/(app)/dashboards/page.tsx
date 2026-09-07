import {
  getSession,
  canEditDashboards,
  canCreateDashboards,
  canDeleteDashboards,
  canExportDashboards,
  canManageDashboardAccess,
  isSuperAdmin,
} from '@/lib/auth';
import { listDashboardsVisibleTo } from '@/lib/db';
import { fetchCatalog } from '@/lib/gateway';
import { DashboardListClient } from '@/components/dashboard/DashboardListClient';

export default async function DashboardsPage() {
  const user = await getSession();
  if (!user) return null;

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
    tenantIds: catalogTenantIds.filter((id) =>
      (user.tenantSlugs || []).some((slug) => companies.find((c) => c.id === id)?.slug === slug)
    ),
  });

  const idBySlug = new Map(companies.map((c) => [c.slug, c.id]));

  return (
    <DashboardListClient
      initial={dashboards}
      canEdit={canEditDashboards(user)}
      canCreate={canCreateDashboards(user)}
      canDelete={canDeleteDashboards(user)}
      canExport={canExportDashboards(user)}
      canManageAccess={canManageDashboardAccess(user)}
      companies={companies}
      userRole={user.role}
      isSuperAdmin={Boolean(user.isSuperAdmin || user.role === 'super_admin' || user.role === 'admin')}
      userCompanyId={user.companyId}
      companyIdBySlug={Object.fromEntries(idBySlug)}
      userTenantSlugs={user.tenantSlugs || []}
    />
  );
}
