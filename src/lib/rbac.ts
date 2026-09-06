import type { SessionUser, StaffRole } from './types';

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

/* ─── module gates ─────────────────────────────────────────── */

export function canViewDashboards(user: SessionUser): boolean {
  return Boolean(user);
}

export function canEditDashboards(user: SessionUser): boolean {
  return user.role === 'super_admin' || user.role === 'admin' || user.role === 'editor';
}

export function canManageStaff(user: SessionUser): boolean {
  return user.role === 'super_admin' || user.role === 'admin' || user.role === 'editor';
}

export function canManageCompanies(user: SessionUser): boolean {
  return user.role === 'super_admin' || user.role === 'admin' || user.role === 'editor';
}

export function canDeleteCompany(user: SessionUser): boolean {
  return isSuperAdmin(user) || isAdminRole(user);
}

export function canToggleCompanyActive(user: SessionUser): boolean {
  return isSuperAdmin(user) || isAdminRole(user);
}

export function canChangeCompanySlug(user: SessionUser): boolean {
  return isSuperAdmin(user);
}

export function canManageBilling(user: SessionUser): boolean {
  return user.role === 'super_admin' || user.role === 'admin' || user.role === 'editor';
}

export function canManageTariffs(user: SessionUser): boolean {
  return isSuperAdmin(user);
}

export function canTopupBilling(user: SessionUser): boolean {
  return isSuperAdmin(user);
}

export function canManageDevices(user: SessionUser): boolean {
  return isSuperAdmin(user) || isAdminRole(user);
}

/** Pending device approve UI — super only */
export function canApproveDevices(user: SessionUser): boolean {
  return isSuperAdmin(user);
}

export function canManageApis(user: SessionUser): boolean {
  return isSuperAdmin(user) || isAdminRole(user);
}

export function canManageConnections(user: SessionUser): boolean {
  return isSuperAdmin(user) || isAdminRole(user);
}

export function canManageApps(user: SessionUser): boolean {
  return isSuperAdmin(user);
}

export function canManageSettings(user: SessionUser): boolean {
  return isSuperAdmin(user);
}

export function canEditNews(user: SessionUser): boolean {
  return user.role === 'super_admin' || user.role === 'admin' || user.role === 'editor';
}

export function canConfirmStaffRegistration(user: SessionUser): boolean {
  return user.role === 'super_admin' || user.role === 'admin' || user.role === 'editor';
}

/** Roles actor may assign to staff */
export function assignableRoles(actor: SessionUser): StaffRole[] {
  if (isSuperAdmin(actor)) return ['viewer', 'editor', 'admin', 'super_admin'];
  // admin & editor: only viewer + editor
  if (actor.role === 'admin' || actor.role === 'editor') return ['viewer', 'editor'];
  return [];
}

/** May delete this staff member? */
export function canDeleteStaffMember(
  actor: SessionUser,
  target: { role?: string; id?: string }
): { ok: boolean; reason?: string } {
  if (!canManageStaff(actor)) return { ok: false, reason: 'Rugsat ýok' };
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
