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
    const catalog = await Promise.race([
      fetchCatalog(false),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('catalog-timeout')), 4000)
      ),
    ]);
    const tenants = catalog.tenants || [];
    // Diňe super_admin ähli firmalary görýär.
    // admin / editor / viewer — diňe bagly firmalar.
    if (isSuperAdmin(user) || user.role === 'super_admin') {
      companies = tenants.map((t: any) => ({
        id: String(t.id || t.slug),
        name: String(t.name || t.slug),
        slug: String(t.slug),
      }));
    } else {
      const allowedSlugs = new Set(
        [user.companySlug, ...(user.tenantSlugs || [])].filter(Boolean) as string[]
      );
      companies = tenants
        .filter((t: any) => {
          if (allowedSlugs.size === 0) {
            return (
              String(t.id) === String(user.companyId) ||
              String(t.slug) === String(user.companyId)
            );
          }
          return (
            allowedSlugs.has(String(t.slug)) ||
            String(t.id) === String(user.companyId)
          );
        })
        .map((t: any) => ({
          id: String(t.id || t.slug),
          name: String(t.name || t.slug),
          slug: String(t.slug),
        }));
    }
  } catch {
    companies = [];
  }

  // Admin/editor üçin görünýän firmalaryň id + slug — dashboard filter üçin
  const allowedTenantIds = companies.map((c) => c.id);
  const allowedTenantSlugs = companies.map((c) => c.slug);
  const dashboards = await listDashboardsVisibleTo({
    ...user,
    tenantSlugs: Array.from(
      new Set([...(user.tenantSlugs || []), ...allowedTenantSlugs].filter(Boolean))
    ),
    tenantIds: Array.from(
      new Set(
        [user.companyId, ...(user.tenantIds || []), ...allowedTenantIds].filter(Boolean) as string[]
      )
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
      isSuperAdmin={Boolean(user.isSuperAdmin || user.role === 'super_admin')}
      userCompanyId={user.companyId}
      companyIdBySlug={Object.fromEntries(idBySlug)}
      userTenantSlugs={user.tenantSlugs || []}
    />
  );
}
