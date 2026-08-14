import type { SessionUser, StaffRole } from './types';

/**
 * 3 effective roles in BI:
 * - viewer: diňe dashboard görýär
 * - admin: öz kompaniýasynda ähli dolandyryş (Electron editor/admin)
 * - super_admin: ähli firmalar
 */

export function canEditDashboard(role: StaffRole): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'editor';
}

export function canManageCompany(role: StaffRole): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'editor';
}

export function canManageStaff(role: StaffRole): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'editor';
}

export function isSuperAdmin(user: SessionUser): boolean {
  return user.isSuperAdmin || user.role === 'super_admin';
}

export function isViewerOnly(role: StaffRole): boolean {
  return role === 'viewer';
}

export function canHandleSupport(role: StaffRole): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'editor';
}
