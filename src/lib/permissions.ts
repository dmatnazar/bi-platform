/**
 * Central role → permission matrix.
 * Defaults match historical hardcoded RBAC; super_admin can override via Rugsatlar UI.
 * Super_admin always has every permission (cannot be revoked).
 */
import type { StaffRole, SessionUser } from './types';

export type PermissionKey =
  | 'view_dashboards'
  | 'edit_dashboards'
  | 'manage_staff'
  | 'manage_companies'
  | 'delete_company'
  | 'toggle_company_active'
  | 'change_company_slug'
  | 'manage_billing'
  | 'manage_tariffs'
  | 'topup_billing'
  | 'manage_devices'
  | 'approve_devices'
  | 'manage_apis'
  | 'manage_connections'
  | 'manage_apps'
  | 'manage_settings'
  | 'edit_news'
  | 'confirm_registration'
  | 'handle_support'
  | 'manage_permissions'
  | 'assign_viewer'
  | 'assign_editor'
  | 'assign_admin'
  | 'assign_super_admin';

export type RolePermissionMatrix = Record<StaffRole, Partial<Record<PermissionKey, boolean>>>;

export interface PermissionDef {
  key: PermissionKey;
  label: string;
  description: string;
  group: string;
  /** If true, only super_admin may ever hold it (UI locks others off) */
  superOnly?: boolean;
}

export const PERMISSION_DEFS: PermissionDef[] = [
  {
    key: 'view_dashboards',
    label: 'Dashboard görmek',
    description: 'Dashboard sanawyny we grafiklerini görmek',
    group: 'Dashboardlar',
  },
  {
    key: 'edit_dashboards',
    label: 'Dashboard üýtgetmek',
    description: 'Täze dashboard döretmek, widget goşmak we saklamak',
    group: 'Dashboardlar',
  },
  {
    key: 'manage_staff',
    label: 'Işgärler',
    description: 'Işgärler modulyny görmek we dolandyrmak',
    group: 'Işgärler',
  },
  {
    key: 'confirm_registration',
    label: 'Hasaba alyş tassyklamak',
    description: 'Garaşylýan registrasiýalary tassyklamak / ret etmek',
    group: 'Işgärler',
  },
  {
    key: 'assign_viewer',
    label: 'Viewer rol bermek',
    description: 'Işgäre viewer roluny bellemek',
    group: 'Işgärler',
  },
  {
    key: 'assign_editor',
    label: 'Editor rol bermek',
    description: 'Işgäre editor roluny bellemek',
    group: 'Işgärler',
  },
  {
    key: 'assign_admin',
    label: 'Admin rol bermek',
    description: 'Işgäre admin roluny bellemek',
    group: 'Işgärler',
  },
  {
    key: 'assign_super_admin',
    label: 'Super admin rol bermek',
    description: 'Işgäre super_admin roluny bellemek',
    group: 'Işgärler',
    superOnly: true,
  },
  {
    key: 'manage_companies',
    label: 'Firmalar',
    description: 'Ähli firmalar modulyny görmek we redaktirlemek',
    group: 'Firmalar',
  },
  {
    key: 'delete_company',
    label: 'Firma pozmak',
    description: 'Firmany doly pozmak',
    group: 'Firmalar',
  },
  {
    key: 'toggle_company_active',
    label: 'Firma işjeň/öçürilen',
    description: 'Firmany işjeň ýa-da öçürilen etmek',
    group: 'Firmalar',
  },
  {
    key: 'change_company_slug',
    label: 'Firma slug üýtgetmek',
    description: 'Firma identifikatoryny (slug) üýtgetmek',
    group: 'Firmalar',
    superOnly: true,
  },
  {
    key: 'manage_billing',
    label: 'Tarif & Balans',
    description: 'Billing modulyny görmek',
    group: 'Billing',
  },
  {
    key: 'manage_tariffs',
    label: 'Tarifleri dolandyrmak',
    description: 'Tarif planlaryny üýtgetmek',
    group: 'Billing',
    superOnly: true,
  },
  {
    key: 'topup_billing',
    label: 'Balans doldurmak',
    description: 'Firma balansyna pul goşmak',
    group: 'Billing',
    superOnly: true,
  },
  {
    key: 'manage_devices',
    label: 'Enjamlar',
    description: 'Enjamlar modulyny görmek we dolandyrmak',
    group: 'Platforma',
  },
  {
    key: 'approve_devices',
    label: 'Enjam tassyklamak',
    description: 'Garaşylýan enjamlary tassyklamak',
    group: 'Platforma',
    superOnly: true,
  },
  {
    key: 'manage_apis',
    label: 'API-lar',
    description: 'API / endpoint katalogy modulyny görmek',
    group: 'Platforma',
  },
  {
    key: 'manage_connections',
    label: 'DB baglanyşyklar',
    description: 'Maglumat bazasy baglanyşyklaryny dolandyrmak',
    group: 'Platforma',
  },
  {
    key: 'manage_apps',
    label: 'Programmalar',
    description: 'Klient programmalaryny dolandyrmak',
    group: 'Platforma',
    superOnly: true,
  },
  {
    key: 'manage_settings',
    label: 'Sazlamalar',
    description: 'Ulgam sazlamalaryny üýtgetmek',
    group: 'Platforma',
    superOnly: true,
  },
  {
    key: 'manage_permissions',
    label: 'Rugsatlar',
    description: 'Rol rugsatlaryny dolandyrmak (bu modul)',
    group: 'Platforma',
    superOnly: true,
  },
  {
    key: 'edit_news',
    label: 'Habarlar üýtgetmek',
    description: 'Habar ýazmak we redaktirlemek',
    group: 'Mazmun',
  },
  {
    key: 'handle_support',
    label: 'Tehniki goldaw',
    description: 'Goldaw ticket-lerini dolandyrmak',
    group: 'Mazmun',
  },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_DEFS.map((d) => d.key);

/** Historical defaults (before Rugsatlar UI) */
export const DEFAULT_ROLE_PERMISSIONS: RolePermissionMatrix = {
  super_admin: Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, true])) as Record<
    PermissionKey,
    boolean
  >,
  admin: {
    view_dashboards: true,
    edit_dashboards: true,
    manage_staff: true,
    manage_companies: true,
    delete_company: true,
    toggle_company_active: true,
    change_company_slug: false,
    manage_billing: true,
    manage_tariffs: false,
    topup_billing: false,
    manage_devices: true,
    approve_devices: false,
    manage_apis: true,
    manage_connections: true,
    manage_apps: false,
    manage_settings: false,
    edit_news: true,
    confirm_registration: true,
    handle_support: true,
    manage_permissions: false,
    assign_viewer: true,
    assign_editor: true,
    assign_admin: false,
    assign_super_admin: false,
  },
  editor: {
    view_dashboards: true,
    edit_dashboards: true,
    manage_staff: true,
    manage_companies: true,
    delete_company: false,
    toggle_company_active: false,
    change_company_slug: false,
    manage_billing: true,
    manage_tariffs: false,
    topup_billing: false,
    manage_devices: false,
    approve_devices: false,
    manage_apis: false,
    manage_connections: false,
    manage_apps: false,
    manage_settings: false,
    edit_news: true,
    confirm_registration: true,
    handle_support: true,
    manage_permissions: false,
    assign_viewer: true,
    assign_editor: false,
    assign_admin: false,
    assign_super_admin: false,
  },
  viewer: {
    view_dashboards: true,
    edit_dashboards: false,
    manage_staff: false,
    manage_companies: false,
    delete_company: false,
    toggle_company_active: false,
    change_company_slug: false,
    manage_billing: false,
    manage_tariffs: false,
    topup_billing: false,
    manage_devices: false,
    approve_devices: false,
    manage_apis: false,
    manage_connections: false,
    manage_apps: false,
    manage_settings: false,
    edit_news: false,
    confirm_registration: false,
    handle_support: false,
    manage_permissions: false,
    assign_viewer: false,
    assign_editor: false,
    assign_admin: false,
    assign_super_admin: false,
  },
};

/** In-memory override (hydrated from settings). null = use pure defaults */
let cachedOverrides: RolePermissionMatrix | null = null;

export function setPermissionOverrides(matrix: RolePermissionMatrix | null | undefined) {
  if (!matrix || typeof matrix !== 'object') {
    cachedOverrides = null;
    return;
  }
  cachedOverrides = matrix;
}

export function getPermissionOverrides(): RolePermissionMatrix | null {
  return cachedOverrides;
}

export function mergeMatrix(
  base: RolePermissionMatrix,
  override?: RolePermissionMatrix | null
): RolePermissionMatrix {
  if (!override) return structuredClone(base);
  const roles: StaffRole[] = ['super_admin', 'admin', 'editor', 'viewer'];
  const out = structuredClone(base);
  for (const role of roles) {
    const patch = override[role];
    if (!patch) continue;
    out[role] = { ...out[role], ...patch };
  }
  // super_admin always all true
  out.super_admin = Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, true])) as Record<
    PermissionKey,
    boolean
  >;
  // superOnly keys: force false for non-super
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

export function userHasPermission(
  user: SessionUser | null | undefined,
  key: PermissionKey
): boolean {
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

/** Group defs for UI */
export function permissionGroups(): { group: string; items: PermissionDef[] }[] {
  const map = new Map<string, PermissionDef[]>();
  for (const d of PERMISSION_DEFS) {
    const list = map.get(d.group) || [];
    list.push(d);
    map.set(d.group, list);
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
}

/** Sanitize incoming matrix from client */
export function sanitizeMatrixInput(raw: unknown): RolePermissionMatrix {
  const base = structuredClone(DEFAULT_ROLE_PERMISSIONS);
  if (!raw || typeof raw !== 'object') return base;
  const roles: StaffRole[] = ['admin', 'editor', 'viewer']; // never trust super_admin from client
  const obj = raw as Record<string, Record<string, unknown>>;
  for (const role of roles) {
    const patch = obj[role];
    if (!patch || typeof patch !== 'object') continue;
    for (const key of ALL_PERMISSION_KEYS) {
      const def = PERMISSION_DEFS.find((d) => d.key === key);
      if (def?.superOnly) {
        base[role][key] = false;
        continue;
      }
      if (typeof patch[key] === 'boolean') {
        base[role][key] = patch[key] as boolean;
      }
    }
  }
  base.super_admin = Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, true])) as Record<
    PermissionKey,
    boolean
  >;
  return base;
}
