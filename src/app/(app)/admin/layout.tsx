import { redirect } from 'next/navigation';
import { getSession, isSuperAdmin, canManageCompany } from '@/lib/auth';
import {
  canManageSettings,
  canManageApis,
  canManageConnections,
  canManageDevices,
  canManageCompanies,
  canManagePermissions,
  canManageBilling,
  canManageApps,
  canHandleSupport,
  canManageStaff as canManageStaffUser,
} from '@/lib/rbac';
import { headers } from 'next/headers';

/**
 * Server-side gate for /admin/* — URL bilen girmek hem rugsat talap edýär.
 * Client-only gizleme ýeterlik däl.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect('/login');

  const h = await headers();
  // Next may expose path via x-url / middleware; fallback: allow check by any admin capability
  const pathname =
    h.get('x-pathname') ||
    h.get('x-invoke-path') ||
    h.get('next-url') ||
    '';

  const path = pathname.includes('/admin/')
    ? pathname.slice(pathname.indexOf('/admin/'))
    : '';

  const superA = isSuperAdmin(user);

  const rules: { prefix: string; ok: boolean }[] = [
    { prefix: '/admin/settings', ok: superA || canManageSettings(user) },
    { prefix: '/admin/apis', ok: superA || canManageApis(user) },
    { prefix: '/admin/connections', ok: superA || canManageConnections(user) },
    { prefix: '/admin/devices', ok: superA || canManageDevices(user) },
    { prefix: '/admin/companies', ok: superA || canManageCompanies(user) },
    { prefix: '/admin/company', ok: superA || canManageCompany(user.role) },
    { prefix: '/admin/permissions', ok: superA || canManagePermissions(user) },
    { prefix: '/admin/billing', ok: superA || canManageBilling(user) },
    { prefix: '/admin/apps', ok: superA || canManageApps(user) },
    { prefix: '/admin/support', ok: superA || canHandleSupport(user) },
    { prefix: '/admin/staff', ok: superA || canManageStaffUser(user) },
    { prefix: '/admin/sessions', ok: superA || canManageSettings(user) },
    { prefix: '/admin/registrations', ok: superA || canManageStaffUser(user) },
  ];

  // If we know the path, enforce specific rule; otherwise require any admin-ish capability
  if (path) {
    const rule = rules.find((r) => path === r.prefix || path.startsWith(r.prefix + '/'));
    if (rule && !rule.ok) {
      redirect('/dashboards?denied=1');
    }
  } else {
    // Soft gate: at least one admin permission
    const anyAdmin =
      superA ||
      canManageSettings(user) ||
      canManageApis(user) ||
      canManageConnections(user) ||
      canManageDevices(user) ||
      canManageCompanies(user) ||
      canManagePermissions(user) ||
      canManageBilling(user) ||
      canManageApps(user) ||
      canHandleSupport(user) ||
      canManageStaffUser(user) ||
      canManageCompany(user.role);
    if (!anyAdmin) {
      redirect('/dashboards?denied=1');
    }
  }

  return <>{children}</>;
}
