/**
 * Silent MSSQL table/column cache for SQL editor autocomplete.
 * Failures never surface to the UI — editor keeps working as before.
 */

type TablesCache = {
  at: number;
  tables: string[]; // "schema.table" or "table"
};

type ColsCache = {
  at: number;
  columns: string[];
};

const TTL_MS = 10 * 60 * 1000; // 10 min
const tablesMem = new Map<string, TablesCache>();
const colsMem = new Map<string, ColsCache>();

function cacheKey(tenantSlug: string, dbKey: string) {
  return `${tenantSlug}::${dbKey || 'primary'}`;
}

function colsKey(tenantSlug: string, dbKey: string, table: string) {
  return `${cacheKey(tenantSlug, dbKey)}::${table.toLowerCase()}`;
}

function lsGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function lsSet(key: string, val: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* quota */
  }
}

async function runMetaQuery(
  tenantSlug: string,
  dbKey: string,
  sqlQuery: string
): Promise<Record<string, unknown>[]> {
  const res = await fetch('/api/admin-test-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantSlug,
      dbKey: dbKey || 'primary',
      sqlQuery,
      params: {},
      timeoutMs: 25000,
    }),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.rows) ? data.rows : [];
}

/** Safe identifier for embedding in meta SQL (letters, digits, _, $) */
function safeIdent(name: string): string | null {
  const s = String(name || '').trim().replace(/^\[|\]$/g, '');
  if (!/^[A-Za-z_@#][A-Za-z0-9_@#$]*$/.test(s)) return null;
  return s;
}

export async function fetchTableNames(
  tenantSlug: string,
  dbKey: string
): Promise<string[]> {
  if (!tenantSlug) return [];
  const key = cacheKey(tenantSlug, dbKey);
  const mem = tablesMem.get(key);
  if (mem && Date.now() - mem.at < TTL_MS) return mem.tables;

  const lsKey = `bi-sql-tables:${key}`;
  const fromLs = lsGet<TablesCache>(lsKey);
  if (fromLs && Date.now() - fromLs.at < TTL_MS) {
    tablesMem.set(key, fromLs);
    return fromLs.tables;
  }

  try {
    const rows = await runMetaQuery(
      tenantSlug,
      dbKey,
      `SELECT TABLE_SCHEMA AS s, TABLE_NAME AS t
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_TYPE IN ('BASE TABLE','VIEW')
       ORDER BY TABLE_SCHEMA, TABLE_NAME`
    );
    const tables: string[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const schema = String(r.s ?? r.S ?? r.TABLE_SCHEMA ?? '').trim();
      const name = String(r.t ?? r.T ?? r.TABLE_NAME ?? '').trim();
      if (!name) continue;
      // Prefer short name; keep schema.table if not dbo
      const full =
        schema && schema.toLowerCase() !== 'dbo' ? `${schema}.${name}` : name;
      if (seen.has(full.toLowerCase())) continue;
      seen.add(full.toLowerCase());
      tables.push(full);
    }
    const entry: TablesCache = { at: Date.now(), tables };
    tablesMem.set(key, entry);
    lsSet(lsKey, entry);
    return tables;
  } catch {
    return fromLs?.tables || mem?.tables || [];
  }
}

export async function fetchTableColumns(
  tenantSlug: string,
  dbKey: string,
  tableName: string
): Promise<string[]> {
  if (!tenantSlug || !tableName) return [];
  let schema = 'dbo';
  let table = tableName.trim();
  if (table.includes('.')) {
    const parts = table.split('.');
    schema = parts[0].replace(/^\[|\]$/g, '');
    table = parts.slice(1).join('.').replace(/^\[|\]$/g, '');
  } else {
    table = table.replace(/^\[|\]$/g, '');
  }
  const safeTable = safeIdent(table);
  const safeSchema = safeIdent(schema);
  if (!safeTable || !safeSchema) return [];

  const key = colsKey(tenantSlug, dbKey, `${safeSchema}.${safeTable}`);
  const mem = colsMem.get(key);
  if (mem && Date.now() - mem.at < TTL_MS) return mem.columns;

  const lsKey = `bi-sql-cols:${key}`;
  const fromLs = lsGet<ColsCache>(lsKey);
  if (fromLs && Date.now() - fromLs.at < TTL_MS) {
    colsMem.set(key, fromLs);
    return fromLs.columns;
  }

  try {
    const rows = await runMetaQuery(
      tenantSlug,
      dbKey,
      `SELECT COLUMN_NAME AS c
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = '${safeSchema}' AND TABLE_NAME = '${safeTable}'
       ORDER BY ORDINAL_POSITION`
    );
    const columns = rows
      .map((r) => String(r.c ?? r.C ?? r.COLUMN_NAME ?? '').trim())
      .filter(Boolean);
    const entry: ColsCache = { at: Date.now(), columns };
    colsMem.set(key, entry);
    lsSet(lsKey, entry);
    return columns;
  } catch {
    return fromLs?.columns || mem?.columns || [];
  }
}

/**
 * Parse FROM / JOIN aliases:
 *   FROM dbo.Users u
 *   FROM [Orders] AS o
 * Returns alias → real table name (as used for column lookup)
 */
export function parseSqlTableAliases(sql: string): Record<string, string> {
  const map: Record<string, string> = {};
  const re =
    /\b(?:FROM|JOIN)\s+(?:\[?([A-Za-z_][\w]*)\]?\.)?\[?([A-Za-z_][\w]*)\]?(?:\s+(?:AS\s+)?([A-Za-z_][\w]*))?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const schema = m[1];
    const table = m[2];
    const alias = m[3];
    if (!table) continue;
    // skip SQL keywords used as false aliases
    if (alias && /^(WHERE|ON|INNER|LEFT|RIGHT|FULL|CROSS|JOIN|GROUP|ORDER|HAVING|SELECT|SET|AND|OR)$/i.test(alias)) {
      continue;
    }
    const full = schema && schema.toLowerCase() !== 'dbo' ? `${schema}.${table}` : table;
    if (alias) map[alias] = full;
    map[table] = full;
    if (schema) map[`${schema}.${table}`] = full;
  }
  return map;
}

/** Build CodeMirror sql-hint tables map: { tableOrAlias: string[] columns } */
export function buildHintTables(
  tableNames: string[],
  aliasMap: Record<string, string>,
  colsByTable: Record<string, string[]>
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const t of tableNames) {
    const cols = colsByTable[t.toLowerCase()] || colsByTable[t] || [];
    out[t] = cols;
    // also short name without schema
    if (t.includes('.')) {
      const short = t.split('.').pop()!;
      if (!out[short]) out[short] = cols;
    }
  }
  for (const [alias, real] of Object.entries(aliasMap)) {
    const cols =
      colsByTable[real.toLowerCase()] ||
      colsByTable[real] ||
      colsByTable[real.split('.').pop()!.toLowerCase()] ||
      [];
    out[alias] = cols;
  }
  return out;
}
