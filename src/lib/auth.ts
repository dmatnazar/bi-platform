import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { getSettings, getStaffByUsername, getCompanyById } from './db';
import type { SessionUser, StaffRole } from './types';

const COOKIE_NAME = 'bi_session';

async function getSecret() {
  const settings = await getSettings();
  return new TextEncoder().encode(settings.jwtSecret);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  const secret = await getSecret();
  return new SignJWT({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    companyId: user.companyId,
    companySlug: user.companySlug,
    companyName: user.companyName,
    tenantSlugs: user.tenantSlugs,
    tenantIds: user.tenantIds,
    isSuperAdmin: user.isSuperAdmin,
    sessionId: user.sessionId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const secret = await getSecret();
    const { payload } = await jwtVerify(token, secret);
    return {
      id: payload.id as string,
      username: payload.username as string,
      fullName: payload.fullName as string,
      role: payload.role as StaffRole,
      companyId: payload.companyId as string,
      companySlug: payload.companySlug as string | undefined,
      companyName: payload.companyName as string | undefined,
      tenantSlugs: Array.isArray(payload.tenantSlugs) ? payload.tenantSlugs.map(String) : undefined,
      tenantIds: Array.isArray(payload.tenantIds) ? payload.tenantIds.map(String) : undefined,
      isSuperAdmin: Boolean(payload.isSuperAdmin),
      sessionId: payload.sessionId ? String(payload.sessionId) : undefined,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    // localhost HTTP-de secure=false bolmaly, bolmasa cookie ýazylmaýar
    secure: process.env.NODE_ENV === 'production' && process.env.FORCE_INSECURE_COOKIE !== '1',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/** Logout: revoke server session then clear cookie */
export async function logoutCurrentSession() {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (token) {
      const user = await verifySessionToken(token);
      if (user?.sessionId) {
        const { revokeSession } = await import('./session-store');
        revokeSession(user.sessionId, 'logout');
      }
    }
  } catch {
    /* */
  }
  await clearSessionCookie();
}

let permissionsHydrated = false;

export async function getSession(): Promise<SessionUser | null> {
  // One-time load of rolePermissions matrix so canManage* see overrides
  if (!permissionsHydrated) {
    permissionsHydrated = true;
    try {
      const { getSettings } = await import('./db');
      await getSettings();
    } catch {
      /* */
    }
  }
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySessionToken(token);
  if (!user) return null;

  // Server session registry: revoked / missing session => logged out
  if (user.sessionId) {
    try {
      const { getSessionById, touchSession } = await import('./session-store');
      const s = getSessionById(user.sessionId);
      if (!s || !s.active) {
        await clearSessionCookie();
        return null;
      }
      // light touch (throttle inside would be ideal; ok for small installs)
      touchSession(user.sessionId);
    } catch {
      /* store offline — allow JWT-only fallback */
    }
  }
  return user;
}

export async function loginWithCredentials(
  username: string,
  password: string
): Promise<{ ok: true; user: SessionUser; token: string } | { ok: false; error: string }> {
  const staff = await getStaffByUsername(username);
  if (!staff || !staff.active) {
    return { ok: false, error: 'Ulanyjy tapyimady ýa-da işlemeýär' };
  }

  const valid = await verifyPassword(password, staff.passwordHash);
  if (!valid) {
    return { ok: false, error: 'Login ýa-da parol nädogry' };
  }

  const company = await getCompanyById(staff.companyId);

  const user: SessionUser = {
    id: staff.id,
    username: staff.username,
    fullName: staff.fullName,
    role: staff.role,
    companyId: staff.companyId,
    companySlug: company?.slug,
    companyName: company?.name,
    isSuperAdmin: Boolean(staff.isSuperAdmin || staff.role === 'super_admin'),
  };

  const token = await createSessionToken(user);
  return { ok: true, user, token };
}

export function canEditDashboard(role: StaffRole): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'editor';
}

export function canManageStaff(role: StaffRole): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'editor';
}

export function canManageCompany(role: StaffRole): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'editor';
}

export function isSuperAdmin(user: SessionUser): boolean {
  return user.isSuperAdmin || user.role === 'super_admin';
}

/** Platform/company admin (not editor) */
export function isAdmin(user: SessionUser): boolean {
  return user.role === 'admin' || isSuperAdmin(user);
}

/** Devices / API / DB / Apps / Settings — admin+ only */
export function canAccessPlatformModules(role: StaffRole): boolean {
  return role === 'super_admin' || role === 'admin';
}


// Re-export RBAC helpers for API routes
export {
  actorTenantSlugs,
  canAccessTenant,
  canAccessAnyTenant,
  filterByTenantScope,
  clampTenantSlugs,
  canManageDevices,
  canManageApis,
  canManageConnections,
  canManageApps,
  canManageSettings,
  canApproveDevices,
  canDeleteCompany,
  canToggleCompanyActive,
  canChangeCompanySlug,
  canManageTariffs,
  canTopupBilling,
  canManageBilling,
  canManageCompanies,
  canManagePermissions,
  canHandleSupport,
  canEditDashboards,
  canCreateDashboards,
  canDeleteDashboards,
  canExportDashboards,
  canManageDashboardAccess,
  canViewDashboards,
  assignableRoles,
  visibleStaffRoles,
  canDeleteStaffMember,
  wouldRemoveLastSuperAdmin,
  isAdminRole,
  isAdminOrSuper,
  canConfirmStaffRegistration,
  canEditNews as rbacCanEditNews,
  canManageStaff as canManageStaffUser,
} from './rbac';
