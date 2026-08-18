import type { SessionUser, StaffRole } from './types';

/**
 * BI Platform 4 rol ulgamy:
 * - viewer : Diňe öz kärhanasynda dashboard görüp bilýär
 * - editor : Öz kärhanasynda dashboard + maglumatlary redaktirläp bilýär (staff däl)
 * - manager: Öz kärhanasynda dashboard + maglumatlar + işgärleri dolandyryp bilýär
 * - admin  : Ähli dolandyryş (devices, apis, staff, settings, companies)
 */

/** Dashboard döretmek / redaktirlemek */
export function canEditDashboard(role: StaffRole): boolean {
  return role === 'admin' || role === 'editor' || role === 'manager';
}

/** Kärhana sazlamalaryny, enjamlaryny, API-laryny dolandyrmak */
export function canManageCompany(role: StaffRole): boolean {
  return role === 'admin' || role === 'editor' || role === 'manager';
}

/** Işgär (staff) dolandyrmak */
export function canManageStaff(role: StaffRole): boolean {
  return role === 'admin' || role === 'manager';
}

/** Admin rol — ähli sistema giriş */
export function isAdmin(user: SessionUser): boolean {
  return user.role === 'admin';
}

/** Manager rol — öz kärhanasyny dolandyrmak */
export function isManager(user: SessionUser): boolean {
  return user.role === 'manager';
}

/** Diňe dashboard görmek üçin çäklendirilen rol */
export function isViewerOnly(role: StaffRole): boolean {
  return role === 'viewer';
}

/** Goldaw ýüzlenmelerini dolandyrmak */
export function canHandleSupport(role: StaffRole): boolean {
  return role === 'admin' || role === 'editor' || role === 'manager';
}

// Backward compat — isSuperAdmin diňe admin üçin
export function isSuperAdmin(user: SessionUser): boolean {
  return user.role === 'admin';
}
