/**
 * Server-side client for VPS Gateway admin APIs.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function staffPwKey() {
  const secret =
    process.env.GATEWAY_ADMIN_SECRET ||
    process.env.ADMIN_SYNC_SECRET ||
    'dev';
  return crypto.scryptSync(secret, 'staff-pw-v1', 32);
}

export function decryptPasswordPlain(enc?: string): string {
  if (!enc) return '';
  try {
    const buf = Buffer.from(enc, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', staffPwKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}


const CACHE_FILE = path.join(process.cwd(), 'data', 'catalog-cache.json');
const CACHE_TTL_MS = 15_000;

function readStoredSettings(): { gatewayUrl?: string; gatewayAdminSecret?: string } {
  try {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const file = path.join(process.cwd(), 'data', 'bi-platform.json');
    if (!fs.existsSync(file)) return {};
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return data.settings || {};
  } catch {
    return {};
  }
}

function gatewayUrl() {
  const stored = readStoredSettings().gatewayUrl;
  return (stored || process.env.GATEWAY_URL || 'http://localhost:4000').replace(/\/$/, '');
}

function adminSecret() {
  const stored = readStoredSettings().gatewayAdminSecret;
  return stored || process.env.GATEWAY_ADMIN_SECRET || process.env.ADMIN_SYNC_SECRET || '';
}

function sign(body: unknown): string {
  const secret = adminSecret();
  if (!secret) throw new Error('GATEWAY_ADMIN_SECRET is not configured');
  const payload = body === undefined || body === null ? '{}' : JSON.stringify(body);
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

async function gatewayFetch(
  method: string,
  pathSuffix: string,
  body?: unknown,
  timeoutMs = 8000
): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    if (!adminSecret()) {
      return { ok: false, status: 0, data: { error: 'GATEWAY_ADMIN_SECRET missing' } };
    }
    const url = `${gatewayUrl()}${pathSuffix}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Admin-Signature': sign(method === 'GET' || method === 'HEAD' ? null : body ?? {}),
    };
    const res = await fetch(url, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: String(err) } };
  }
}

export interface CatalogTenant {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  connections?: { dbKey: string; label: string; database?: string }[];
  updatedAt: string;
}

export interface CatalogEndpoint {
  id: string;
  tenantSlug: string;
  name: string;
  method: string;
  pathTemplate: string;
  paramsSchema?: unknown;
  cacheTtlSec?: number;
  authRequired?: boolean;
  dbKey?: string;
}

export interface CatalogStaff {
  id: string;
  tenantSlug: string;
  tenantSlugs: string[];
  fullName: string;
  username: string;
  role: string;
  phone?: string;
  email?: string;
  active: boolean;
  passwordEnc?: string;
  updatedAt: string;
}

export interface Catalog {
  tenants: CatalogTenant[];
  endpoints: CatalogEndpoint[];
  staff: CatalogStaff[];
  syncedAt: string;
  fromCache?: boolean;
}

function readCache(): (Catalog & { cachedAt: number }) | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function writeCache(catalog: Catalog) {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      CACHE_FILE,
      JSON.stringify({ ...catalog, cachedAt: Date.now() }, null, 2),
      'utf8'
    );
  } catch {
    /* ignore */
  }
}

export async function fetchCatalog(force = false): Promise<Catalog> {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { ...cached, fromCache: true };
  }

  const res = await gatewayFetch('GET', '/api/admin/catalog', undefined, 6000);
  if (res.ok) {
    const catalog: Catalog = {
      tenants: res.data.tenants || [],
      endpoints: res.data.endpoints || [],
      staff: res.data.staff || [],
      syncedAt: res.data.syncedAt || new Date().toISOString(),
    };
    writeCache(catalog);
    return catalog;
  }

  if (cached) {
    return {
      tenants: cached.tenants,
      endpoints: cached.endpoints,
      staff: cached.staff,
      syncedAt: cached.syncedAt,
      fromCache: true,
    };
  }

  return { tenants: [], endpoints: [], staff: [], syncedAt: new Date().toISOString(), fromCache: true };
}

export async function staffLookup(username: string) {
  return gatewayFetch('POST', '/api/admin/staff-lookup', { username }, 4000);
}

export async function createRegistration(payload: {
  tenantSlug: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  username: string;
  passwordHash: string;
  requestedRole?: string;
}) {
  return gatewayFetch('POST', '/api/admin/registrations', payload);
}

export async function listRegistrations(params?: { tenantSlug?: string; status?: string }) {
  const q = new URLSearchParams();
  if (params?.tenantSlug) q.set('tenantSlug', params.tenantSlug);
  if (params?.status) q.set('status', params.status);
  const qs = q.toString() ? `?${q}` : '';
  return gatewayFetch('GET', `/api/admin/registrations${qs}`);
}

export async function resolveRegistration(payload: {
  id: string;
  action: 'approve' | 'reject';
  note?: string;
  role?: string;
  reviewedBy?: string;
}) {
  return gatewayFetch('POST', '/api/admin/registrations/resolve', payload);
}

export async function getRegistrationStatus(id: string) {
  return gatewayFetch('GET', `/api/admin/registrations/${id}`);
}

export async function listNotifications(username: string, unreadOnly = false) {
  const q = new URLSearchParams({ username });
  if (unreadOnly) q.set('unreadOnly', '1');
  return gatewayFetch('GET', `/api/admin/notifications?${q}`);
}

export async function markNotificationsRead(payload: { ids?: string[]; username?: string }) {
  return gatewayFetch('POST', '/api/admin/notifications/read', payload);
}

export function verifyPasswordHash(plain: string, stored: string): boolean {
  if (!stored) return false;
  // Electron scrypt format: "saltHex:hashHex" where scrypt used salt AS UTF-8 STRING
  if (stored.includes(':') && !stored.startsWith('$')) {
    const [saltPart, hashHex] = stored.split(':');
    if (!saltPart || !hashHex) return false;
    const tryEqual = (candidateHex: string) => {
      try {
        const a = Buffer.from(candidateHex, 'hex');
        const b = Buffer.from(hashHex, 'hex');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
      } catch {
        return false;
      }
    };
    try {
      // 1) Electron main: scryptSync(plain, saltString, 64)
      const c1 = crypto.scryptSync(plain, saltPart, 64).toString('hex');
      if (tryEqual(c1)) return true;
      // 2) Fallback: salt as Buffer.from(hex)
      const c2 = crypto.scryptSync(plain, Buffer.from(saltPart, 'hex'), 64).toString('hex');
      if (tryEqual(c2)) return true;
    } catch {
      return false;
    }
    return false;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
    return bcrypt.compareSync(plain, stored);
  } catch {
    return false;
  }
}

export function hashPasswordBcrypt(plain: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
  return bcrypt.hashSync(plain, 10);
}

export async function checkGatewayHealth(): Promise<boolean> {
  try {
    const base = gatewayUrl();
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function syncStaffToGateway(
  tenantSlug: string,
  staff: Array<{
    id: string;
    fullName: string;
    username: string;
    passwordHash: string;
    role: string;
    tenantSlugs?: string[];
    phone?: string;
    email?: string;
    active: boolean;
  }>
) {
  return gatewayFetch('POST', '/api/admin/sync-staff', { tenantSlug, staff });
}

export async function updateTenantOnGateway(payload: {
  slug: string;
  name?: string;
  isActive?: boolean;
  expectedUpdatedAt?: string;
}) {
  return gatewayFetch('POST', '/api/admin/tenant-update', payload);
}


export async function updateEndpointOnGateway(payload: {
  id: string;
  tenantSlug: string;
  name: string;
  pathTemplate: string;
  method: string;
  dbKey?: string;
}) {
  return gatewayFetch('POST', '/api/admin/endpoint-update', payload);
}


export async function entityLockOnGateway(payload: {
  entityType: 'tenant' | 'staff' | 'endpoint';
  entityId: string;
  action: 'lock' | 'unlock' | 'heartbeat';
  openedBy?: string;
}) {
  return gatewayFetch('POST', '/api/admin/entity-lock', payload);
}

export async function deleteTenantOnGateway(payload: { slug: string }) {
  return gatewayFetch('POST', '/api/admin/tenant-delete', payload);
}

export async function deleteStaffOnGateway(payload: {
  id?: string;
  username?: string;
  tenantSlug?: string;
}) {
  return gatewayFetch('POST', '/api/admin/staff-delete', payload);
}


// ── Devices (Electron agents) ────────────────────────────────────────────

export async function listDevicesOnGateway() {
  return gatewayFetch('GET', '/api/admin/devices');
}

export async function approveDeviceOnGateway(
  id: string,
  payload: { tenantSlugs?: string[]; tenantSlug?: string; name?: string }
) {
  return gatewayFetch('POST', `/api/admin/devices/${encodeURIComponent(id)}/approve`, payload);
}

export async function updateDeviceStatusOnGateway(
  id: string,
  payload: {
    status: 'pending' | 'approved' | 'blocked';
    tenantSlug?: string;
    tenantSlugs?: string[];
    name?: string;
  }
) {
  return gatewayFetch('PATCH', `/api/admin/devices/${encodeURIComponent(id)}/status`, payload);
}

export async function deleteDeviceOnGateway(id: string) {
  return gatewayFetch('DELETE', `/api/admin/devices/${encodeURIComponent(id)}`);
}
