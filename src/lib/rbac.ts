import type { SessionUser, StaffRole } from './types';
import { userHasPermission, roleHasPermission } from './permissions';

/** Tenant slugs the actor may touch (empty = none; super_admin = unrestricted) */
export function actorTenantSlugs(user: SessionUser | null | undefined): string[] {
  if (!user) return [];
  const raw = [
    ...(Array.isArray(user.tenantSlugs) ? user.tenantSlugs : []),
    user.companySlug || '',
  ];
  return Array.from(new Set(raw.map((s) => String(s || '').trim()).filter(Boolean)));
}

export function isSuperAdmin(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.isSuperAdmin || user.role === 'super_admin');
}

export function isAdminRole(user: SessionUser | null | undefined): boolean {
  return Boolean(user && user.role === 'admin');
}

/** admin or super_admin */
export function isAdminOrSuper(user: SessionUser | null | undefined): boolean {
  return isSuperAdmin(user) || isAdminRole(user);
}

export function isEditorRole(user: SessionUser | null | undefined): boolean {
  return Boolean(user && user.role === 'editor');
}

export function isViewerRole(user: SessionUser | null | undefined): boolean {
  return Boolean(user && user.role === 'viewer');
}

/** True if actor may access this tenant slug (super = all) */
export function canAccessTenant(
  user: SessionUser | null | undefined,
  tenantSlug: string | null | undefined
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const slug = String(tenantSlug || '').trim();
  if (!slug) return false;
  return actorTenantSlugs(user).includes(slug);
}

/** Any of the given slugs is in scope */
export function canAccessAnyTenant(
  user: SessionUser | null | undefined,
  slugs: string[] | null | undefined
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const mine = new Set(actorTenantSlugs(user));
  return (slugs || []).some((s) => mine.has(String(s || '').trim()));
}

/** Filter list of objects that have tenantSlug / tenantSlugs */
export function filterByTenantScope<T extends { tenantSlug?: string; tenantSlugs?: string[] }>(
  user: SessionUser,
  rows: T[]
): T[] {
  if (isSuperAdmin(user)) return rows;
  const mine = new Set(actorTenantSlugs(user));
  if (!mine.size) return [];
  return rows.filter((r) => {
    const slugs = [
      r.tenantSlug,
      ...(Array.isArray(r.tenantSlugs) ? r.tenantSlugs : []),
    ]
      .map((s) => String(s || '').trim())
      .filter(Boolean);
    return slugs.some((s) => mine.has(s));
  });
}

/** Clamp requested tenant slugs to actor scope */
export function clampTenantSlugs(
  user: SessionUser,
  requested: string[] | undefined | null
): string[] {
  const req = Array.from(
    new Set((requested || []).map((s) => String(s || '').trim()).filter(Boolean))
  );
  if (isSuperAdmin(user)) return req;
  const mine = new Set(actorTenantSlugs(user));
  return req.filter((s) => mine.has(s));
}

/* ─── module gates (driven by Rugsatlar matrix; super always allowed) ─── */

export function canViewDashboards(user: SessionUser): boolean {
  return userHasPermission(user, 'view_dashboards');
}

export function canCreateDashboards(user: SessionUser): boolean {
  return userHasPermission(user, 'create_dashboards');
}

export function canEditDashboards(user: SessionUser): boolean {
  return userHasPermission(user, 'edit_dashboards');
}

export function canDeleteDashboards(user: SessionUser): boolean {
  return userHasPermission(user, 'delete_dashboards');
}

export function canExportDashboards(user: SessionUser): boolean {
  return userHasPermission(user, 'export_dashboards');
}

export function canManageDashboardAccess(user: SessionUser): boolean {
  return userHasPermission(user, 'manage_dashboard_access');
}

export function canDeleteStaff(user: SessionUser): boolean {
  return userHasPermission(user, 'delete_staff');
}

export function canViewBillingLedger(user: SessionUser): boolean {
  return userHasPermission(user, 'view_billing_ledger');
}

export function canDeleteDevices(user: SessionUser): boolean {
  return userHasPermission(user, 'delete_devices');
}

export function canSendDeviceCommands(user: SessionUser): boolean {
  return userHasPermission(user, 'device_commands');
}

export function canManageMailSettings(user: SessionUser): boolean {
  return userHasPermission(user, 'manage_mail_settings');
}

export function canDeleteNews(user: SessionUser): boolean {
  return userHasPermission(user, 'delete_news');
}

export function canManageSupportContacts(user: SessionUser): boolean {
  return userHasPermission(user, 'manage_support_contacts');
}

export function canManageStaff(user: SessionUser): boolean {
  return userHasPermission(user, 'manage_staff');
}

export function canManageCompanies(user: SessionUser): boolean {
  return userHasPermission(user, 'manage_companies');
}

export function canDeleteCompany(user: SessionUser): boolean {
  return userHasPermission(user, 'delete_company');
}

export function canToggleCompanyActive(user: SessionUser): boolean {
  return userHasPermission(user, 'toggle_company_active');
}

export function canChangeCompanySlug(user: SessionUser): boolean {
  return userHasPermission(user, 'change_company_slug');
}

export function canManageBilling(user: SessionUser): boolean {
  return userHasPermission(user, 'manage_billing');
}

export function canManageTariffs(user: SessionUser): boolean {
  return userHasPermission(user, 'manage_tariffs');
}

export function canTopupBilling(user: SessionUser): boolean {
  return userHasPermission(user, 'topup_billing');
}

export function canManageDevices(user: SessionUser): boolean {
  return userHasPermission(user, 'manage_devices');
}

/** Pending device approve UI — super only by default */
export function canApproveDevices(user: SessionUser): boolean {
  return userHasPermission(user, 'approve_devices');
}

export function canManageApis(user: SessionUser): boolean {
  return userHasPermission(user, 'manage_apis');
}

export function canManageConnections(user: SessionUser): boolean {
  return userHasPermission(user, 'manage_connections');
}

export function canManageApps(user: SessionUser): boolean {
  return userHasPermission(user, 'manage_apps');
}

export function canManageSettings(user: SessionUser): boolean {
  return userHasPermission(user, 'manage_settings');
}

export function canEditNews(user: SessionUser): boolean {
  return userHasPermission(user, 'edit_news');
}

export function canConfirmStaffRegistration(user: SessionUser): boolean {
  return userHasPermission(user, 'confirm_registration');
}

export function canManagePermissions(user: SessionUser): boolean {
  return userHasPermission(user, 'manage_permissions');
}

export function canHandleSupport(user: SessionUser): boolean {
  return userHasPermission(user, 'handle_support');
}

/** Roles actor may assign to staff (matrix-driven) */
export function assignableRoles(actor: SessionUser): StaffRole[] {
  if (isSuperAdmin(actor)) return ['viewer', 'editor', 'admin', 'super_admin'];
  const out: StaffRole[] = [];
  if (roleHasPermission(actor.role, 'assign_viewer')) out.push('viewer');
  if (roleHasPermission(actor.role, 'assign_editor')) out.push('editor');
  if (roleHasPermission(actor.role, 'assign_admin')) out.push('admin');
  if (roleHasPermission(actor.role, 'assign_super_admin')) out.push('super_admin');
  return out;
}

/** Roles actor may see in staff list (tenant scope still applies separately) */
export function visibleStaffRoles(actor: SessionUser): StaffRole[] {
  if (isSuperAdmin(actor)) return ['viewer', 'editor', 'admin', 'super_admin'];
  // admin: no super_admin / other admins — only viewer + editor of own firm
  if (actor.role === 'admin') return ['viewer', 'editor'];
  // editor: viewers + editors of own firm
  if (actor.role === 'editor') return ['viewer', 'editor'];
  return [];
}

/** May delete this staff member? */
export function canDeleteStaffMember(
  actor: SessionUser,
  target: { role?: string; id?: string }
): { ok: boolean; reason?: string } {
  if (!canManageStaff(actor) || !userHasPermission(actor, 'delete_staff')) return { ok: false, reason: 'Rugsat ýok' };
  const tr = String(target.role || '').toLowerCase();
  if (tr === 'super_admin') {
    return { ok: false, reason: 'Super admin işgäri pozup bolanok' };
  }
  if (target.id && actor.id && target.id === actor.id) {
    return { ok: false, reason: 'Öz hasabyňy pozup bolanok' };
  }
  // admin cannot delete admin (only super)
  if (tr === 'admin' && !isSuperAdmin(actor)) {
    return { ok: false, reason: 'Admin işgäri diňe super admin pozup bilýär' };
  }
  // editor may only manage / delete viewers
  if (actor.role === 'editor' && tr !== 'viewer') {
    return { ok: false, reason: 'Editor diňe viewer işgärleri dolandryp bilýär' };
  }
  return { ok: true };
}

/** Ensure at least one super_admin remains after a role demotion / delete */
export function wouldRemoveLastSuperAdmin(
  allStaff: { id: string; role?: string; active?: boolean }[],
  targetId: string,
  nextRole?: string,
  nextActive?: boolean
): boolean {
  const supers = allStaff.filter(
    (s) =>
      String(s.role || '').toLowerCase() === 'super_admin' &&
      s.active !== false &&
      s.id !== targetId
  );
  if (supers.length > 0) return false;
  // target is the only super
  const target = allStaff.find((s) => s.id === targetId);
  if (!target || String(target.role || '').toLowerCase() !== 'super_admin') return false;
  if (nextRole && nextRole !== 'super_admin') return true;
  if (nextActive === false) return true;
  return false; // delete case handled by canDeleteStaffMember
}
