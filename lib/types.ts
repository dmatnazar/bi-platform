export type StaffRole = 'super_admin' | 'admin' | 'editor' | 'viewer';

export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export interface Company {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  legalName?: string;
  taxId?: string;
  registrationNumber?: string;
  industry?: string;
  country?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffMember {
  id: string;
  companyId: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  username: string;
  passwordHash: string;
  role: StaffRole;
  active: boolean;
  /** If true, this is a platform-level super admin (sees all companies) */
  isSuperAdmin?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationRequest {
  id: string;
  companyId: string;
  companyName: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  username: string;
  passwordHash: string;
  status: RegistrationStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  note?: string;
  createdAt: string;
}

/** Widget types supported by the dashboard builder */
export type WidgetType = 'bar' | 'line' | 'pie' | 'area' | 'table' | 'kpi' | 'text';

/** Parameter types from Electron / VPS Gateway paramsSchema */
export type ParamType = 'int' | 'bigint' | 'date' | 'datetime' | 'nvarchar' | 'bit' | 'float' | 'string' | 'number';

export interface ParamDef {
  name: string;
  sqlParam?: string;
  type: ParamType;
  required?: boolean;
  default?: unknown;
}

export interface ParamsSchema {
  urlParams?: ParamDef[];
  queryParams?: ParamDef[];
  bodyParams?: ParamDef[];
}

/**
 * How a widget param is resolved at runtime:
 * - fixed: use static value from dataSource.params
 * - global: take value from dashboard global filter by key
 * - widget: local override in the widget filter row
 */
export type ParamBindingSource = 'fixed' | 'global' | 'widget';

export interface ParamBinding {
  /** API param name, e.g. beginDate */
  paramName: string;
  source: ParamBindingSource;
  /** when source=global — key in Dashboard.globalFilters, e.g. "beginDate" */
  globalKey?: string;
  /** when source=fixed or widget — literal value */
  value?: string | number | boolean | null;
}

export interface WidgetDataSource {
  /** tenant slug on VPS gateway */
  tenantSlug: string;
  /** connection key, default primary */
  dbKey?: string;
  /** endpoint id from catalog */
  endpointId?: string;
  /** path template e.g. /sales/monthly */
  path: string;
  method: 'GET' | 'POST';
  /** auto refresh seconds (0 = off) */
  refreshSec?: number;
  /** static / fixed query-body params */
  params?: Record<string, string | number | boolean>;
  /**
   * Per-param bindings. If present, takes precedence over plain `params`
   * for keys that are listed. Global filters are merged at query time.
   */
  paramBindings?: ParamBinding[];
  /** cached paramsSchema snapshot from catalog (for editor UI) */
  paramsSchema?: ParamsSchema;
  /** field mapping: chart category / value keys */
  categoryField?: string;
  valueField?: string;
  seriesField?: string;
  /** for table: which columns to show (empty = all) */
  columns?: string[];
  /**
   * Table default / fixed sort order (multi-column).
   * Applied client-side on fetched rows.
   */
  orderBy?: { field: string; dir: 'asc' | 'desc' }[];
  /** enable client search box on table widget (default true for table) */
  enableSearch?: boolean;
  /**
   * Hierarchical drill-down: click a table row → open detail from another API.
   * Example: invoices table → click row → pass fich_id to /invoice-items API.
   */
  drillDown?: {
    enabled: boolean;
    /** Column from parent row whose value is sent to child API, e.g. "fich_id" */
    sourceField: string;
    /** Child API param name (defaults to sourceField) */
    targetParam?: string;
    /** Child endpoint */
    tenantSlug: string;
    path: string;
    method?: 'GET' | 'POST';
    endpointId?: string;
    dbKey?: string;
    /** Also forward current global filter values (beginDate, endDate, …) */
    passGlobalFilters?: boolean;
    /** Modal title, supports {value} and {field} */
    titleTemplate?: string;
  };
}

/** Portable dashboard export payload (cross-machine import) */
export interface DashboardExportPayload {
  format: 'bi-platform-dashboard';
  version: 1;
  exportedAt: string;
  dashboard: {
    name: string;
    description?: string;
    widgets: DashboardWidget[];
    globalFilters?: GlobalFilterDef[];
    version?: number;
  };
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  /** react-grid-layout position */
  x: number;
  y: number;
  w: number;
  h: number;
  dataSource?: WidgetDataSource;
  /** static KPI value or text content when no dataSource */
  staticValue?: string | number;
  config?: {
    color?: string;
    /** Color for numeric value labels on line/area/bar (independent of stroke) */
    valueLabelColor?: string;
    showLegend?: boolean;
    stacked?: boolean;
    unit?: string;
  };
}

/**
 * Global filter definition stored on the dashboard.
 * Values are runtime state (not persisted by default) or optional defaults.
 */
export type GlobalFilterType = 'date' | 'datetime' | 'daterange' | 'text' | 'number' | 'select' | 'multiselect' | 'boolean';

export interface GlobalFilterDef {
  /** unique key used in bindings, e.g. beginDate, endDate, search, region */
  key: string;
  label: string;
  type: GlobalFilterType;
  /** for daterange — the pair key for end (when type=daterange, key is begin) */
  endKey?: string;
  required?: boolean;
  defaultValue?: string | number | boolean | null;
  /** for select / multiselect */
  options?: { value: string; label: string }[];
  /**
   * Optional: load options from another API (e.g. sellers list).
   * valueField → sent to main API (seller_id)
   * labelField → shown in UI (seller_name)
   */
  optionsSource?: {
    tenantSlug?: string;
    path: string;
    method?: 'GET' | 'POST';
    dbKey?: string;
    valueField: string;
    labelField?: string;
    params?: Record<string, string | number | boolean>;
  };
  /** placeholder */
  placeholder?: string;
}

export interface Dashboard {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  /** owner staff id */
  ownerId: string;
  /** staff ids who can view (empty = all company members with viewer+) */
  sharedWith: string[];
  widgets: DashboardWidget[];
  /**
   * Declared global filters for this dashboard (DataLens-style selector bar).
   * Runtime values live in React state; defaults can be stored here.
   */
  globalFilters?: GlobalFilterDef[];
  /** layout version for migrations */
  version: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Runtime values of global filters: key -> value */
export type GlobalFilterValues = Record<string, string | number | boolean | null | undefined>;


/** Support chat: users write only to admins */
export type SupportCategory = 'error' | 'suggestion' | 'question' | 'feedback' | 'other';
export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportMessage {
  id: string;
  ticketId: string;
  /** staff id of author */
  authorId: string;
  authorName: string;
  authorRole: StaffRole;
  /** true if author is admin/super_admin/editor acting as support */
  isStaffReply: boolean;
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  companyId: string;
  /** creator (regular user) */
  userId: string;
  userName: string;
  userUsername: string;
  subject: string;
  category: SupportCategory;
  status: SupportTicketStatus;
  messages: SupportMessage[];
  /** last message timestamp for sorting */
  lastMessageAt: string;
  /** unread for the other side */
  unreadForUser: number;
  unreadForAdmin: number;
  assignedAdminId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  role: StaffRole;
  companyId: string;
  companySlug?: string;
  companyName?: string;
  isSuperAdmin: boolean;
}

export interface DbSchema {
  companies: Company[];
  staff: StaffMember[];
  registrations: RegistrationRequest[];
  dashboards: Dashboard[];
  supportTickets: SupportTicket[];
  /** synced endpoint catalog from VPS (optional cache) */
  endpointCatalog: {
    tenantSlug: string;
    name: string;
    method: string;
    pathTemplate: string;
    syncedAt: string;
  }[];
  settings: {
    gatewayUrl: string;
    jwtSecret: string;
    /** shared secret to pull metadata from VPS if needed */
    gatewayAdminSecret?: string;
    /** catalog / sync poll interval seconds (0 = manual only) */
    catalogSyncIntervalSec?: number;
  };
}

/** Resolve final API params from widget + global filters */
export function resolveWidgetParams(
  ds: WidgetDataSource | undefined,
  globalValues: GlobalFilterValues
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = { ...(ds?.params || {}) };

  if (ds?.paramBindings?.length) {
    for (const b of ds.paramBindings) {
      if (b.source === 'global' && b.globalKey) {
        const v = globalValues[b.globalKey];
        if (v !== undefined && v !== null && v !== '') {
          out[b.paramName] = v as string | number | boolean;
        }
      } else if ((b.source === 'fixed' || b.source === 'widget') && b.value !== undefined && b.value !== null && b.value !== '') {
        out[b.paramName] = b.value as string | number | boolean;
      }
    }
  }

  // Convenience: common date keys from global if not already set via bindings
  for (const k of ['beginDate', 'endDate', 'startDate', 'from', 'to', 'dateFrom', 'dateTo']) {
    if (out[k] === undefined && globalValues[k] !== undefined && globalValues[k] !== null && globalValues[k] !== '') {
      out[k] = globalValues[k] as string | number | boolean;
    }
  }

  return out;
}

/** Collect all ParamDefs from a paramsSchema */
export function flattenParamsSchema(schema?: ParamsSchema | null): ParamDef[] {
  if (!schema) return [];
  return [
    ...(schema.urlParams || []),
    ...(schema.queryParams || []),
    ...(schema.bodyParams || []),
  ];
}

/** Suggest global filter defs from endpoint paramsSchema (date-heavy APIs) */

/** Extract free-text global search query from filter values */
export function getGlobalSearchQuery(values: GlobalFilterValues): string {
  const candidates = ['search', 'q', 'query', 'keyword', 'gözleg', 'gozleg', 'text'];
  for (const k of candidates) {
    const v = values[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  // any text-like key named *search*
  for (const [k, v] of Object.entries(values)) {
    if (/search|gözleg|gozleg|keyword|query/i.test(k) && v != null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return '';
}

/**
 * Client-side filter: global search hits any cell (priority: name/info-like fields).
 * Applies to every widget dataset so one search affects the whole dashboard.
 */
export function filterRowsByGlobalSearch(
  rows: Record<string, unknown>[] | undefined,
  query: string
): Record<string, unknown>[] | undefined {
  if (!rows) return rows;
  const q = query.trim().toLowerCase();
  if (!q) return rows;

  const priorityRe = /^(name|title|info|description|label|caption|fullname|full_name|ad|ady)$/i;

  return rows.filter((row) => {
    const keys = Object.keys(row);
    // prefer name/info fields first
    for (const k of keys) {
      if (priorityRe.test(k)) {
        const v = row[k];
        if (v != null && String(v).toLowerCase().includes(q)) return true;
      }
    }
    // then any field
    for (const k of keys) {
      const v = row[k];
      if (v != null && String(v).toLowerCase().includes(q)) return true;
    }
    return false;
  });
}

export function suggestFiltersFromSchema(schema?: ParamsSchema | null): GlobalFilterDef[] {
  const defs = flattenParamsSchema(schema);
  const filters: GlobalFilterDef[] = [];
  const names = new Set(defs.map((d) => d.name.toLowerCase()));

  const hasBegin = [...names].some((n) => /begindate|startdate|datefrom|from/i.test(n));
  const hasEnd = [...names].some((n) => /enddate|dateto|to/i.test(n));

  if (hasBegin || hasEnd) {
    const beginName = defs.find((d) => /begindate|startdate|datefrom|^from$/i.test(d.name))?.name || 'beginDate';
    const endName = defs.find((d) => /enddate|dateto|^to$/i.test(d.name))?.name || 'endDate';
    filters.push({
      key: beginName,
      endKey: endName,
      label: 'Sene aralygy',
      type: 'daterange',
      required: defs.some((d) => d.name === beginName && d.required),
    });
  }

  for (const d of defs) {
    const lower = d.name.toLowerCase();
    if (/begindate|enddate|startdate|dateto|datefrom|^from$|^to$/i.test(lower)) continue;
    if (d.type === 'date' || d.type === 'datetime') {
      filters.push({
        key: d.name,
        label: d.name,
        type: d.type === 'datetime' ? 'datetime' : 'date',
        required: !!d.required,
        defaultValue: d.default as string | null,
      });
    } else if (d.type === 'nvarchar' || d.type === 'string') {
      filters.push({
        key: d.name,
        label: d.name,
        type: 'text',
        required: !!d.required,
        defaultValue: d.default as string | null,
        placeholder: d.name,
      });
    } else if (d.type === 'int' || d.type === 'bigint' || d.type === 'float' || d.type === 'number') {
      filters.push({
        key: d.name,
        label: d.name,
        type: 'number',
        required: !!d.required,
        defaultValue: d.default as number | null,
      });
    } else if (d.type === 'bit' || d.type === 'boolean') {
      filters.push({
        key: d.name,
        label: d.name,
        type: 'boolean',
        required: !!d.required,
        defaultValue: d.default as boolean | null,
      });
    }
  }

  return filters;
}
