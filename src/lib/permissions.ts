/**
 * Central role -> permission matrix.
 * Super_admin always has every permission (cannot be revoked).
 */
import type { StaffRole, SessionUser } from './types';

export type PermissionKey =
  | 'view_dashboards'
  | 'create_dashboards'
  | 'edit_dashboards'
  | 'delete_dashboards'
  | 'export_dashboards'
  | 'manage_dashboard_access'
  | 'manage_staff'
  | 'delete_staff'
  | 'confirm_registration'
  | 'assign_viewer'
  | 'assign_editor'
  | 'assign_admin'
  | 'assign_super_admin'
  | 'manage_companies'
  | 'delete_company'
  | 'toggle_company_active'
  | 'change_company_slug'
  | 'manage_billing'
  | 'view_billing_ledger'
  | 'manage_tariffs'
  | 'topup_billing'
  | 'manage_devices'
  | 'approve_devices'
  | 'delete_devices'
  | 'device_commands'
  | 'manage_apis'
  | 'manage_connections'
  | 'manage_apps'
  | 'manage_settings'
  | 'manage_mail_settings'
  | 'manage_permissions'
  | 'edit_news'
  | 'delete_news'
  | 'handle_support'
  | 'manage_support_contacts';

export type RolePermissionMatrix = Record<StaffRole, Partial<Record<PermissionKey, boolean>>>;

export interface PermissionDef {
  key: PermissionKey;
  label: string;
  description: string;
  group: string;
  superOnly?: boolean;
}

export const PERMISSION_DEFS: PermissionDef[] = [
  { key: 'view_dashboards', label: 'Dashboard gormek', description: 'Dashboard sanawyny we grafiklerini gormek', group: 'Dashboardlar' },
  { key: 'create_dashboards', label: 'Dashboard doretmek', description: 'Taze dashboard, import, nusga', group: 'Dashboardlar' },
  { key: 'edit_dashboards', label: 'Dashboard uytgetmek', description: 'Ady, widget gosmak / saklamak', group: 'Dashboardlar' },
  { key: 'delete_dashboards', label: 'Dashboard pozmak', description: 'Dashboardy doly pozmak', group: 'Dashboardlar' },
  { key: 'export_dashboards', label: 'Dashboard export', description: 'JSON fayl yuklemek', group: 'Dashboardlar' },
  { key: 'manage_dashboard_access', label: 'Dashboard dostupy', description: 'Ulanyjy baglamak / firma dostupy', group: 'Dashboardlar' },
  { key: 'manage_staff', label: 'Isgarler (sanaw / uytget)', description: 'Isgarler: gormek, gosmak, redaktirlemek', group: 'Isgarler' },
  { key: 'delete_staff', label: 'Isgar pozmak', description: 'Isgari sanawdan pozmak', group: 'Isgarler' },
  { key: 'confirm_registration', label: 'Hasaba alys tassyklamak', description: 'Registrasiya tassyklamak / ret', group: 'Isgarler' },
  { key: 'assign_viewer', label: 'Viewer rol bermek', description: 'Viewer rol bellemek', group: 'Isgarler' },
  { key: 'assign_editor', label: 'Editor rol bermek', description: 'Editor rol bellemek', group: 'Isgarler' },
  { key: 'assign_admin', label: 'Admin rol bermek', description: 'Admin rol bellemek', group: 'Isgarler' },
  { key: 'assign_super_admin', label: 'Super admin rol bermek', description: 'Super_admin rol bellemek', group: 'Isgarler', superOnly: true },
  { key: 'manage_companies', label: 'Firmalar (sanaw / uytget)', description: 'Firmalar gormek we redaktirlemek', group: 'Firmalar' },
  { key: 'delete_company', label: 'Firma pozmak', description: 'Firmany doly pozmak', group: 'Firmalar' },
  { key: 'toggle_company_active', label: 'Firma isjen/ocurilen', description: 'Firmany isjen ya-da ocurilen etmek', group: 'Firmalar' },
  { key: 'change_company_slug', label: 'Firma slug uytgetmek', description: 'Firma slug uytgetmek', group: 'Firmalar', superOnly: true },
  { key: 'manage_billing', label: 'Tarif & Balans gormek', description: 'Billing modulyny gormek', group: 'Billing' },
  { key: 'view_billing_ledger', label: 'Billing taryh (ledger)', description: 'Balans hereketleri taryhy', group: 'Billing' },
  { key: 'manage_tariffs', label: 'Tarifleri dolandyrmak', description: 'Tarif planlaryny uytgetmek', group: 'Billing', superOnly: true },
  { key: 'topup_billing', label: 'Balans doldurmak', description: 'Firma balansyna pul gosmak', group: 'Billing', superOnly: true },
  { key: 'manage_devices', label: 'Enjamlar (sanaw / sazlama)', description: 'Enjamlar gormek we sazlamak', group: 'Enjamlar' },
  { key: 'approve_devices', label: 'Enjam tassyklamak', description: 'Garasylan enjamlary tassyklamak', group: 'Enjamlar', superOnly: true },
  { key: 'delete_devices', label: 'Enjam pozmak', description: 'Enjamy sanawdan pozmak', group: 'Enjamlar' },
  { key: 'device_commands', label: 'Enjam buyruklary', description: 'Restart / check update', group: 'Enjamlar' },
  { key: 'manage_apis', label: 'API-lar', description: 'API / endpoint katalogy', group: 'Platforma' },
  { key: 'manage_connections', label: 'DB baglansyklar', description: 'DB baglansyklary dolandyrmak', group: 'Platforma' },
  { key: 'manage_apps', label: 'Programmalar', description: 'Klient programmalary', group: 'Platforma', superOnly: true },
  { key: 'manage_settings', label: 'Sazlamalar', description: 'Ulgam sazlamalary', group: 'Platforma', superOnly: true },
  { key: 'manage_mail_settings', label: 'Pocta sazlamalary', description: 'SMTP / mail', group: 'Platforma', superOnly: true },
  { key: 'manage_permissions', label: 'Rugsatlar', description: 'Rol rugsatlaryny dolandyrmak', group: 'Platforma', superOnly: true },
  { key: 'edit_news', label: 'Habar yazmak / uytgetmek', description: 'Habar doretmek we redaktirlemek', group: 'Mazmun' },
  { key: 'delete_news', label: 'Habar pozmak', description: 'Habary doly pozmak', group: 'Mazmun' },
  { key: 'handle_support', label: 'Tehniki goldaw', description: 'Ticket gormek we jogap', group: 'Mazmun' },
  { key: 'manage_support_contacts', label: 'Goldaw kontaktlary', description: 'Login goldaw kontaktlary', group: 'Mazmun', superOnly: true },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_DEFS.map((d) => d.key);

function allTrue(): Record<PermissionKey, boolean> {
  return Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, true])) as Record<PermissionKey, boolean>;
}
function allFalse(): Record<PermissionKey, boolean> {
  return Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, false])) as Record<PermissionKey, boolean>;
}

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionMatrix = {
  super_admin: allTrue(),
  admin: {
    ...allFalse(),
    view_dashboards: true, create_dashboards: true, edit_dashboards: true, delete_dashboards: true,
    export_dashboards: true, manage_dashboard_access: true,
    manage_staff: true, delete_staff: true, confirm_registration: true,
    assign_viewer: true, assign_editor: true, assign_admin: false, assign_super_admin: false,
    manage_companies: true, delete_company: true, toggle_company_active: true, change_company_slug: false,
    manage_billing: true, view_billing_ledger: true, manage_tariffs: false, topup_billing: false,
    manage_devices: true, approve_devices: false, delete_devices: true, device_commands: true,
    manage_apis: true, manage_connections: true, manage_apps: false, manage_settings: false,
    manage_mail_settings: false, manage_permissions: false,
    edit_news: true, delete_news: true, handle_support: true, manage_support_contacts: false,
  },
  editor: {
    ...allFalse(),
    view_dashboards: true, create_dashboards: true, edit_dashboards: true, delete_dashboards: true,
    export_dashboards: true, manage_dashboard_access: true,
    manage_staff: true, delete_staff: true, confirm_registration: true,
    assign_viewer: true, assign_editor: false, assign_admin: false, assign_super_admin: false,
    manage_companies: true, delete_company: false, toggle_company_active: false, change_company_slug: false,
    manage_billing: true, view_billing_ledger: true, manage_tariffs: false, topup_billing: false,
    manage_devices: false, approve_devices: false, delete_devices: false, device_commands: false,
    manage_apis: false, manage_connections: false, manage_apps: false, manage_settings: false,
    manage_mail_settings: false, manage_permissions: false,
    edit_news: true, delete_news: true, handle_support: true, manage_support_contacts: false,
  },
  viewer: { ...allFalse(), view_dashboards: true },
};

let cachedOverrides: RolePermissionMatrix | null = null;

export function setPermissionOverrides(matrix: RolePermissionMatrix | null | undefined) {
  if (!matrix || typeof matrix !== 'object') { cachedOverrides = null; return; }
  cachedOverrides = matrix;
}
export function getPermissionOverrides(): RolePermissionMatrix | null { return cachedOverrides; }

export function mergeMatrix(base: RolePermissionMatrix, override?: RolePermissionMatrix | null): RolePermissionMatrix {
  if (!override) return structuredClone(base);
  const roles: StaffRole[] = ['super_admin', 'admin', 'editor', 'viewer'];
  const out = structuredClone(base);
  for (const role of roles) {
    const patch = override[role];
    if (!patch) continue;
    out[role] = { ...out[role], ...patch };
  }
  out.super_admin = allTrue();
  for (const def of PERMISSION_DEFS) {
    if (!def.superOnly) continue;
    for (const role of roles) {
      if (role === 'super_admin') continue;
      out[role][def.key] = false;
    }
  }
  return out;
}

export function getEffectiveMatrix(): RolePermissionMatrix {
  return mergeMatrix(DEFAULT_ROLE_PERMISSIONS, cachedOverrides);
}

export function roleHasPermission(role: StaffRole | string | undefined, key: PermissionKey): boolean {
  const r = String(role || '').toLowerCase() as StaffRole;
  if (r === 'super_admin') return true;
  const matrix = getEffectiveMatrix();
  const row = matrix[r];
  if (!row) return false;
  return Boolean(row[key]);
}

export function userHasPermission(user: SessionUser | null | undefined, key: PermissionKey): boolean {
  if (!user) return false;
  if (user.isSuperAdmin || user.role === 'super_admin') return true;
  return roleHasPermission(user.role, key);
}

export function permissionsForRole(role: StaffRole): Record<PermissionKey, boolean> {
  const matrix = getEffectiveMatrix();
  const row = matrix[role] || {};
  const out = {} as Record<PermissionKey, boolean>;
  for (const k of ALL_PERMISSION_KEYS) {
    out[k] = role === 'super_admin' ? true : Boolean(row[k]);
  }
  return out;
}

export function permissionGroups(): { group: string; items: PermissionDef[] }[] {
  const map = new Map<string, PermissionDef[]>();
  for (const d of PERMISSION_DEFS) {
    const list = map.get(d.group) || [];
    list.push(d);
    map.set(d.group, list);
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
}

export function sanitizeMatrixInput(raw: unknown): RolePermissionMatrix {
  const base = structuredClone(DEFAULT_ROLE_PERMISSIONS);
  if (!raw || typeof raw !== 'object') return base;
  const roles: StaffRole[] = ['admin', 'editor', 'viewer'];
  const obj = raw as Record<string, Record<string, unknown>>;
  for (const role of roles) {
    const patch = obj[role];
    if (!patch || typeof patch !== 'object') continue;
    for (const key of ALL_PERMISSION_KEYS) {
      const def = PERMISSION_DEFS.find((d) => d.key === key);
      if (def?.superOnly) { base[role][key] = false; continue; }
      if (typeof patch[key] === 'boolean') base[role][key] = patch[key] as boolean;
    }
  }
  base.super_admin = allTrue();
  return base;
}
