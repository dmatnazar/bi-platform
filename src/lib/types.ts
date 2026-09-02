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
  /** Multi value columns (chart series) — preferred over singular valueField */
  valueFields?: string[];
  /** Multi series group columns — preferred over singular seriesField */
  seriesFields?: string[];
  /** for table: which columns to show (empty = all) */
  columns?: string[];
  /** Columns hidden in UI (ids used only for filters) */
  hiddenColumns?: string[];
  /** Footer aggregates: Sum/Count/Max shown under table */
  tableAggregates?: Array<{
    column: string;
    fn: 'sum' | 'count' | 'max' | 'min';
    label?: string;
    suffix?: string;
  }>;
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
    /** Modal title, supports {value}, {field}, {columnName} */
    titleTemplate?: string;
    /** Footer aggregates for drill-down table */
    aggregates?: Array<{
      column: string;
      fn: 'sum' | 'count' | 'max' | 'min';
      label?: string;
      suffix?: string;
    }>;
    /** Hide columns in drill-down table (persisted) */
    hiddenColumns?: string[];
    /** Column order in drill-down (persisted) */
    columnOrder?: string[];
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
  /** Mobile stack order (0-based). If set, used instead of desktop y on small screens */
  mobileOrder?: number;
  /** Mobile height in grid units */
  mobileH?: number;
  dataSource?: WidgetDataSource;
  /** static KPI value or text content when no dataSource */
  staticValue?: string | number;
  config?: {
    /** Primary series color */
    color?: string;
    /** Extra palette for multi-series / pie slices */
    colors?: string[];
    showLegend?: boolean;
    stacked?: boolean;
    /** Smooth lines (line/area) */
    smooth?: boolean;
    /** Show value labels on points/bars */
    showDataLabels?: boolean;
    /** Pie: show percentage in labels */
    showPercent?: boolean;
    unit?: string;
    /** KPI number format decimals */
    decimals?: number;
    /** KPI prefix/suffix e.g. currency */
    prefix?: string;
    suffix?: string;
    /** Horizontal bar chart */
    horizontal?: boolean;
    /** Table: columns hidden by user (persisted) */
    hiddenColumns?: string[];
    /** Table: column order (persisted) */
    columnOrder?: string[];
    /** Compact mobile-friendly density */
    dense?: boolean;
    /** Table mobile card: these columns on row 1; rest on row 2 */
    mobileCardPrimaryColumns?: string[];
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
export interface SupportAttachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  /** relative path under data/support-uploads or public URL */
  url: string;
  /** true if client-compressed image */
  compressed?: boolean;
}

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
  attachments?: SupportAttachment[];
  /** delivery / read receipts (ticks) */
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
}

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'trashed';

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
  /** soft-delete / trash */
  trashedAt?: string;
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
    /** Login / register particles & fade motion */
    authAnimations?: boolean;
    /** App shell particles & page animations after login */
    appAnimations?: boolean;
    /** Gmail / SMTP for forgot-password */
    mail?: {
      enabled?: boolean;
      host?: string;
      port?: number;
      secure?: boolean;
      user?: string;
      pass?: string;
      fromName?: string;
      fromEmail?: string;
    };
  };
  /** One-time password reset tokens */
  passwordResetTokens?: PasswordResetToken[];
}

export interface PasswordResetToken {
  token: string;
  username: string;
  staffId: string;
  email: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
}

/** Resolve final API params from widget + global filters */
export function resolveWidgetParams(
  ds: WidgetDataSource | undefined,
  globalValues: GlobalFilterValues
): Record<string, string | number | boolean | null> {
  // Fixed widget params first
  const out: Record<string, string | number | boolean | null> = { ...(ds?.params || {}) };

  if (ds?.paramBindings?.length) {
    for (const b of ds.paramBindings) {
      if (b.source === 'global' && b.globalKey) {
        const v = globalValues[b.globalKey];
        if (v !== undefined) {
          out[b.paramName] = v === '' || v === '__ALL__' ? null : (v as string | number | boolean | null);
        }
      } else if ((b.source === 'fixed' || b.source === 'widget') && b.value !== undefined && b.value !== null && b.value !== '') {
        // diňe global bilen basylmadyk bolsa
        if (out[b.paramName] === undefined) {
          out[b.paramName] = b.value as string | number | boolean;
        }
      }
    }
  }

  // Global filterler HEMişE deň key-leri basýar (null = hemmesini saýla)
  for (const [k, v] of Object.entries(globalValues)) {
    if (v === undefined) continue;
    if (v === '' || v === '__ALL__') {
      out[k] = null;
    } else {
      out[k] = v as string | number | boolean | null;
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
