import type { SessionUser, StaffRole } from './types';
import {
  isSuperAdmin as rbacIsSuper,
  isAdminRole,
  actorTenantSlugs as rbacSlugs,
  assignableRoles as rbacAssignable,
  canManageStaff as rbacStaff,
  canManageCompanies,
  canManageDevices,
  canManageApis,
  canManageConnections,
  canManageApps,
  canManageSettings,
  canEditNews as rbacNews,
  canApproveDevices,
  canDeleteCompany,
  canToggleCompanyActive,
  canManageBilling,
  canManageTariffs,
  canTopupBilling,
} from './rbac';

/** Client-side role check — mirrors server matrix defaults; live overrides need server. */
export function canEditDashboard(role: StaffRole): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'editor';
}

export function canCreateDashboard(role: StaffRole): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'editor';
}

export function canDeleteDashboard(role: StaffRole): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'editor';
}

export function canExportDashboard(role: StaffRole): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'editor';
}

export function canManageCompany(role: StaffRole): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'editor';
}

export function canManageStaff(role: StaffRole): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'editor';
}

export function isSuperAdmin(user: SessionUser): boolean {
  return rbacIsSuper(user);
}

export function isAdmin(user: SessionUser): boolean {
  return isAdminRole(user) || rbacIsSuper(user);
}

export function canAccessPlatformModules(role: StaffRole): boolean {
  return role === 'super_admin' || role === 'admin';
}

export function isViewerOnly(role: StaffRole): boolean {
  return role === 'viewer';
}

export function isEditor(role: StaffRole): boolean {
  return role === 'editor';
}

export function canHandleSupport(role: StaffRole): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'editor';
}

export function canEditNews(role: StaffRole, user?: SessionUser): boolean {
  if (user) return rbacNews(user);
  return role === 'super_admin' || role === 'admin' || role === 'editor';
}

export function assignableRoles(actor: SessionUser): StaffRole[] {
  return rbacAssignable(actor);
}

export function actorTenantSlugs(user: SessionUser): string[] {
  return rbacSlugs(user);
}

export {
  canManageDevices,
  canManageApis,
  canManageConnections,
  canManageApps,
  canManageSettings,
  canApproveDevices,
  canDeleteCompany,
  canToggleCompanyActive,
  canManageBilling,
  canManageTariffs,
  canTopupBilling,
  canManageCompanies,
  rbacStaff as canManageStaffUser,
};
