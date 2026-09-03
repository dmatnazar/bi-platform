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

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
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
    isSuperAdmin: Boolean(
      staff.isSuperAdmin || staff.role === 'super_admin' || staff.role === 'admin'
    ),
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
  // Electron "admin" = platform super; mapped to super_admin on login
  return (
    user.isSuperAdmin ||
    user.role === 'super_admin' ||
    user.role === 'admin'
  );
}
