/**
 * Silent MSSQL table/column cache for SQL editor autocomplete.
 * Failures never break the editor — status is reported to callers.
 */

type TablesCache = {
  at: number;
  tables: string[]; // "schema.table" or "table"
};

type ColsCache = {
  at: number;
  columns: string[];
};

export type SchemaLoadStatus =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ok'; tables: number; dbKey: string }
  | { state: 'empty'; dbKey: string }
  | { state: 'error'; message: string; dbKey: string };

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

function pickRows(data: any): Record<string, unknown>[] {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.result)) return data.result;
  if (Array.isArray(data.recordset)) return data.recordset;
  if (data.data && Array.isArray(data.data.rows)) return data.data.rows;
  if (data.result && Array.isArray(data.result.rows)) return data.result.rows;
  return [];
}

/** Lower-case key lookup for driver-dependent column names */
function rowGet(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    if (r[k] != null && String(r[k]).trim() !== '') return String(r[k]).trim();
  }
  // case-insensitive fallback
  const lower = Object.fromEntries(
    Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])
  );
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

async function runMetaQuery(
  tenantSlug: string,
  dbKey: string,
  sqlQuery: string
): Promise<{ rows: Record<string, unknown>[]; error?: string }> {
  try {
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        rows: [],
        error: String(data.error || data.message || `HTTP ${res.status}`),
      };
    }
    return { rows: pickRows(data) };
  } catch (e: any) {
    return { rows: [], error: e?.message || String(e) };
  }
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
): Promise<{ tables: string[]; error?: string }> {
  if (!tenantSlug) return { tables: [], error: 'tenantSlug ýok' };
  const key = cacheKey(tenantSlug, dbKey);
  const mem = tablesMem.get(key);
  if (mem && Date.now() - mem.at < TTL_MS) return { tables: mem.tables };

  const lsKey = `bi-sql-tables:${key}`;
  const fromLs = lsGet<TablesCache>(lsKey);
  if (fromLs && Date.now() - fromLs.at < TTL_MS) {
    tablesMem.set(key, fromLs);
    return { tables: fromLs.tables };
  }

  const parseTableRows = (rows: Record<string, unknown>[]): string[] => {
    const tables: string[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const schema = rowGet(
        r,
        's',
        'S',
        'TABLE_SCHEMA',
        'schema_name',
        'SCHEMA_NAME',
        'table_schema'
      );
      const name = rowGet(
        r,
        't',
        'T',
        'TABLE_NAME',
        'name',
        'NAME',
        'table_name'
      );
      if (!name) continue;
      // Prefer short name; keep schema.table if not dbo
      const full =
        schema && schema.toLowerCase() !== 'dbo' ? `${schema}.${name}` : name;
      if (seen.has(full.toLowerCase())) continue;
      seen.add(full.toLowerCase());
      tables.push(full);
    }
    return tables;
  };

  let lastError: string | undefined;

  // Primary: INFORMATION_SCHEMA (portable)
  let { rows, error } = await runMetaQuery(
    tenantSlug,
    dbKey,
    `SELECT TABLE_SCHEMA AS s, TABLE_NAME AS t
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_TYPE IN ('BASE TABLE','VIEW')
     ORDER BY TABLE_SCHEMA, TABLE_NAME`
  );
  if (error) lastError = error;
  let tables = parseTableRows(rows);

  // Fallback: sys.tables + sys.views (MSSQL)
  if (!tables.length) {
    ({ rows, error } = await runMetaQuery(
      tenantSlug,
      dbKey,
      `SELECT SCHEMA_NAME(schema_id) AS s, name AS t
       FROM (
         SELECT schema_id, name FROM sys.tables
         UNION ALL
         SELECT schema_id, name FROM sys.views
       ) x
       ORDER BY s, t`
    ));
    if (error) lastError = error;
    tables = parseTableRows(rows);
  }

  // Last resort: simple sys.tables name only
  if (!tables.length) {
    ({ rows, error } = await runMetaQuery(
      tenantSlug,
      dbKey,
      `SELECT name AS t FROM sys.tables ORDER BY name`
    ));
    if (error) lastError = error;
    tables = parseTableRows(rows);
  }

  if (tables.length) {
    const entry: TablesCache = { at: Date.now(), tables };
    tablesMem.set(key, entry);
    lsSet(lsKey, entry);
    return { tables };
  }

  return {
    tables: fromLs?.tables || mem?.tables || [],
    error: lastError || (fromLs?.tables?.length || mem?.tables?.length ? undefined : 'Table sanawy boş'),
  };
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
    let { rows } = await runMetaQuery(
      tenantSlug,
      dbKey,
      `SELECT COLUMN_NAME AS c
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = '${safeSchema}' AND TABLE_NAME = '${safeTable}'
       ORDER BY ORDINAL_POSITION`
    );

    // Fallback: sys.columns
    if (!rows.length) {
      ({ rows } = await runMetaQuery(
        tenantSlug,
        dbKey,
        `SELECT c.name AS c
         FROM sys.columns c
         INNER JOIN sys.objects o ON c.object_id = o.object_id
         INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
         WHERE s.name = '${safeSchema}' AND o.name = '${safeTable}'
         ORDER BY c.column_id`
      ));
    }

    const columns = rows
      .map((r) => rowGet(r, 'c', 'C', 'COLUMN_NAME', 'name', 'NAME'))
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
    if (
      alias &&
      /^(WHERE|ON|INNER|LEFT|RIGHT|FULL|CROSS|JOIN|GROUP|ORDER|HAVING|SELECT|SET|AND|OR)$/i.test(
        alias
      )
    ) {
      continue;
    }
    const full =
      schema && schema.toLowerCase() !== 'dbo' ? `${schema}.${table}` : table;
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
