'use client';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RefreshCw, Copy, ExternalLink, Check, Plus, Trash2, Pencil, ArrowLeft, Play, ClipboardPaste, Scissors, Eraser, Sparkles, X, Building2, ChevronRight, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/utils';
import { toastSuccess, toastInfo, toastError } from '@/components/ui/Toast';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { buildFullApiUrl } from '@/lib/api-url';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SqlCodeEditor, preloadSqlEditor, type SqlCodeEditorHandle } from '@/components/sql/SqlCodeEditor';
import {
  fetchTableNames,
  fetchTableColumns,
  parseSqlTableAliases,
  buildHintTables,
  clearSqlSchemaCache,
  type SchemaLoadStatus,
} from '@/lib/sqlSchemaCache';

interface Endpoint {
  id: string;
  tenantSlug: string;
  name: string;
  method: string;
  pathTemplate: string;
  dbKey?: string;
  sqlQuery?: string;
  paramsSchema?: unknown;
  cacheTtlSec?: number;
  maxRows?: number;
  authRequired?: boolean;
}

interface TenantConnection {
  dbKey: string;
  label?: string;
  database?: string;
  host?: string;
  dbType?: string;
}

interface Tenant {
  id: string;
  slug: string;
  name: string;
  connections?: TenantConnection[];
}

function isExcelConn(c?: TenantConnection | null): boolean {
  if (!c) return false;
  return (
    String(c.dbType || '').toLowerCase() === 'excel' ||
    /\.(xlsx|xls|xlsm|xlsb|csv)$/i.test(String(c.host || ''))
  );
}

function ApisPageInner() {
  const searchParams = useSearchParams();
  const embedMode = searchParams.get('embed') === '1';
  const embedBootstrapped = useRef(false);

  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [syncedAt, setSyncedAt] = useState('');
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gatewayBase, setGatewayBase] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedTenantSlug, setSelectedTenantSlug] = useState<string | null>(null);
  const [metaSheetOpen, setMetaSheetOpen] = useState(false);

  async function load(refresh = false) {
    setLoading(true);
    try {
      const res = await fetch(`/api/catalog${refresh ? '?refresh=1' : ''}`);
      const data = await res.json();
      setEndpoints(data.endpoints || []);
      setTenants(data.tenants || []);
      setSyncedAt(data.syncedAt || '');
      setFromCache(Boolean(data.fromCache));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    fetch('/api/settings/public')
      .then((r) => r.json())
      .then((d) => {
        if (d.gatewayUrl) setGatewayBase(String(d.gatewayUrl).replace(/\/$/, ''));
      })
      .catch(() => {});
  }, []);



  const tenantCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of endpoints) m.set(e.tenantSlug, (m.get(e.tenantSlug) || 0) + 1);
    return m;
  }, [endpoints]);

  const visibleEndpoints = useMemo(() => {
    if (!selectedTenantSlug) return [];
    return endpoints.filter((e) => e.tenantSlug === selectedTenantSlug);
  }, [endpoints, selectedTenantSlug]);

  const selectedTenantName =
    tenants.find((t) => t.slug === selectedTenantSlug)?.name || selectedTenantSlug || '';

  function fullUrl(e: Endpoint) {

    return buildFullApiUrl({
      gatewayBase: gatewayBase || 'http://localhost:4000',
      tenantSlug: e.tenantSlug,
      pathTemplate: e.pathTemplate,
      dbKey: e.dbKey || 'primary',
    });
  }

  const [editEp, setEditEp] = useState<Endpoint | null>(null);
  const [editName, setEditName] = useState('');
  const [editPath, setEditPath] = useState('');
  const [editMethod, setEditMethod] = useState('GET');
  const [editSql, setEditSql] = useState('');
  const [editDbKey, setEditDbKey] = useState('primary');
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [excelSelCols, setExcelSelCols] = useState<Set<string>>(new Set());
  const [excelFilterCols, setExcelFilterCols] = useState<Set<string>>(new Set());
  const [excelColsLoading, setExcelColsLoading] = useState(false);
  const [excelColsError, setExcelColsError] = useState<string | null>(null);

  const [editCache, setEditCache] = useState(0);
  const [editMaxRows, setEditMaxRows] = useState(1000);
  const [editAuth, setEditAuth] = useState(true);
  const [isCreate, setIsCreate] = useState(false);
  type ParamRow = { name: string; type: string; required: boolean; source: 'query' | 'url' | 'body' };
  const [editParams, setEditParams] = useState<ParamRow[]>([]);
  const [editTenantSlug, setEditTenantSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const execAbortRef = useRef<AbortController | null>(null);
  const [execResult, setExecResult] = useState<{
    ok?: boolean;
    rows?: unknown[];
    rowCount?: number;
    elapsedMs?: number;
    error?: string;
  } | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  /** Values used when running test SQL (per declared param) */
  const [testParamValues, setTestParamValues] = useState<Record<string, string>>({});
  const sqlEditorRef = useRef<SqlCodeEditorHandle | null>(null);

  const [sqlHintTables, setSqlHintTables] = useState<Record<string, string[]>>({});
  const [sqlTableNames, setSqlTableNames] = useState<string[]>([]);
  const sqlColsByTableRef = useRef<Record<string, string[]>>({});
  const sqlTablesListRef = useRef<string[]>([]);
  const [schemaStatus, setSchemaStatus] = useState<SchemaLoadStatus>({ state: 'idle' });


  function pathFromName(name: string) {
    // Turkmen / Latin extras → ASCII so path always usable in URLs
    const map: Record<string, string> = {
      ý: 'y', Ý: 'y', ä: 'a', Ä: 'a', ö: 'o', Ö: 'o', ü: 'u', Ü: 'u',
      ň: 'n', Ň: 'n', ş: 's', Ş: 's', ç: 'c', Ç: 'c', ž: 'z', Ž: 'z',
      ə: 'e', Ə: 'e', ı: 'i', İ: 'i', ğ: 'g', Ğ: 'g',
    };
    let s = (name || '').trim();
    s = s
      .split('')
      .map((ch) => map[ch] ?? ch)
      .join('');
    const slug = s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
    return slug ? `/${slug}` : '/';
  }

  function pathConflict(path: string, method: string, excludeId?: string) {
    const norm = (path || '').replace(/\/+$/, '') || '/';
    return endpoints.find(
      (e) =>
        e.id !== excludeId &&
        (e.method || 'GET').toUpperCase() === (method || 'GET').toUpperCase() &&
        ((e.pathTemplate || '').replace(/\/+$/, '') || '/') === norm &&
        e.tenantSlug === (editTenantSlug || editEp?.tenantSlug)
    );
  }


  function extractSqlParamNames(sql: string): string[] {
    const found = [...(sql || '').matchAll(/@([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]);
    // also :name style
    const pathStyle = [...(sql || '').matchAll(/(?:^|[^:\w]):([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]);
    return [...new Set([...found, ...pathStyle])];
  }


  function refreshSqlHints(sqlText?: string) {
    const sql = sqlText ?? editSql;
    const aliases = parseSqlTableAliases(sql || '');
    setSqlHintTables(
      buildHintTables(sqlTablesListRef.current, aliases, sqlColsByTableRef.current)
    );
  }

  /** Load table list when editor opens / tenant+db changes — status shown in SQL toolbar */

  function currentEditConnection(): TenantConnection | undefined {
    const slug = editTenantSlug || editEp?.tenantSlug || '';
    const tn = tenants.find((x) => x.slug === slug);
    const key = editDbKey || 'primary';
    return (tn?.connections || []).find((c) => (c.dbKey || 'primary') === key);
  }

  async function loadExcelColumnsForEditor() {
    const slug = editTenantSlug || editEp?.tenantSlug || '';
    const conn = currentEditConnection();
    if (!slug || !conn) {
      setExcelColsError('Firma / Excel connection saýlaň');
      return;
    }
    setExcelColsLoading(true);
    setExcelColsError(null);
    try {
      const res = await fetch('/api/connections/agent-rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: slug,
          action: 'listColumns',
          host: conn.host,
          database: conn.database,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExcelColsError(data.error || 'Sütünler alynmady');
        setExcelColumns([]);
        return;
      }
      const cols: string[] = data.columns || (data.rows || []).map((r: any) => r.name).filter(Boolean);
      setExcelColumns(cols);
      setExcelSelCols(new Set(cols));
      setExcelFilterCols(new Set());
    } catch (e) {
      setExcelColsError(String(e));
    } finally {
      setExcelColsLoading(false);
    }
  }

  function applyExcelBuilderSql() {
    const conn = currentEditConnection();
    const sheet = conn?.database || 'Sheet1';
    const cols =
      excelSelCols.size === 0 || excelSelCols.size === excelColumns.length
        ? '*'
        : [...excelSelCols].map((c) => `[${c}]`).join(', ');
    let sql = `SELECT ${cols} FROM [${sheet}]`;
    const filters = [...excelFilterCols];
    if (filters.length) {
      const where = filters
        .map((c) => {
          const param = c.replace(/[^\w]/g, '_') || 'p';
          return `[${c}] IN (@${param})`;
        })
        .join(' AND ');
      sql += `\nWHERE ${where}`;
    }
    setEditSql(sql);
    if (filters.length) {
      setEditParams((prev) => {
        const existing = new Set(prev.map((p) => p.name));
        const next = [...prev];
        for (const c of filters) {
          const name = c.replace(/[^\w]/g, '_') || 'p';
          if (!existing.has(name)) {
            next.push({ name, type: 'nvarchar', required: false, source: 'query' as const });
          }
        }
        return next;
      });
    }
    toastSuccess('Excel SQL', 'SQL we filter param-lar ýazylý');
  }

  async function warmSqlSchema(tenantSlug: string, dbKey: string, force = false) {
    // Excel connections have no MSSQL schema — skip table/column introspection
    try {
      const tn = tenants.find((x) => x.slug === tenantSlug);
      const conn = (tn?.connections || []).find((c) => (c.dbKey || 'primary') === (dbKey || 'primary'));
      if (
        conn &&
        (String(conn.dbType || '').toLowerCase() === 'excel' ||
          /\.(xlsx|xls|csv)$/i.test(String(conn.host || '')))
      ) {
        setSchemaStatus({ state: 'ok', tables: 0, dbKey: dbKey || 'primary' });
        return;
      }
    } catch { /* */ }
    if (!tenantSlug) {
      setSchemaStatus({ state: 'idle' });
      return;
    }
    const key = dbKey || 'primary';
    setSchemaStatus({ state: 'loading' });
    try {
      if (force) clearSqlSchemaCache(tenantSlug, key);
      const { tables, error } = await fetchTableNames(tenantSlug, key, { force });
      if (tables.length) {
        sqlTablesListRef.current = tables;
        setSqlTableNames(tables);
        // Seed empty column arrays so table names appear in autocomplete
        for (const tname of tables) {
          const k = tname.toLowerCase();
          if (!sqlColsByTableRef.current[k]) sqlColsByTableRef.current[k] = [];
        }
        refreshSqlHints();
        setSchemaStatus({ state: 'ok', tables: tables.length, dbKey: key });
      } else {
        sqlTablesListRef.current = [];
        setSqlTableNames([]);
        if (error) {
          setSchemaStatus({ state: 'error', message: error, dbKey: key });
        } else {
          setSchemaStatus({ state: 'empty', dbKey: key });
        }
      }
    } catch (e: any) {
      setSchemaStatus({
        state: 'error',
        message: e?.message || String(e),
        dbKey: key,
      });
    }
  }

  async function ensureTableColumns(tableOrAlias: string) {
    const tenant = editTenantSlug || editEp?.tenantSlug || '';
    const dbKey = editDbKey || editEp?.dbKey || 'primary';
    if (!tenant || !tableOrAlias) return;
    const aliases = parseSqlTableAliases(editSql || '');
    const real =
      aliases[tableOrAlias] ||
      aliases[tableOrAlias.toLowerCase()] ||
      tableOrAlias;
    const key = real.toLowerCase();
    if (sqlColsByTableRef.current[key]?.length) {
      refreshSqlHints();
      return;
    }
    try {
      const cols = await fetchTableColumns(tenant, dbKey, real);
      if (!cols.length) return;
      sqlColsByTableRef.current[key] = cols;
      // short name
      if (real.includes('.')) {
        sqlColsByTableRef.current[real.split('.').pop()!.toLowerCase()] = cols;
      }
      refreshSqlHints();
    } catch {
      /* silent */
    }
  }

  function autoCompleteParams() {
    const next = mergeParamsFromSql(editSql, editParams);
    const addedNames = next
      .filter((n) => !editParams.some((p) => p.name.trim().toLowerCase() === n.name.trim().toLowerCase()))
      .map((n) => n.name);
    setEditParams(next);
    if (addedNames.length > 0) {
      toastInfo(
        'Parametrler awto goşuldy',
        `${addedNames.length} sany: ${addedNames.join(', ')}. ` +
          'Default: source=query, type=string, required=ýok. ' +
          'Her biriniň type / required / query|body|url sazlamasyny barlaň — soň test üçin aşakdaky "Test bahalar" meýdançalaryny dolduryň.'
      );
    } else {
      toastSuccess('Auto params', 'Täze ýok — SQL-däki ähli @param eýýäm sanawda');
    }
  }

  function mergeParamsFromSql(sql: string, current: ParamRow[]): ParamRow[] {
    const names = extractSqlParamNames(sql);
    if (!names.length) return current;
    const existing = new Set(current.map((p) => p.name.trim().toLowerCase()).filter(Boolean));
    const next = [...current];
    for (const name of names) {
      if (existing.has(name.toLowerCase())) continue;
      next.push({ name, type: 'string', required: false, source: 'query' });
      existing.add(name.toLowerCase());
    }
    return next;
  }

  function openEdit(e: Endpoint) {
    void preloadSqlEditor();
    setIsCreate(false);
    setEditEp(e);
    setEditName(e.name);
    setEditPath(e.pathTemplate);
    setEditMethod(e.method);
    setEditSql(e.sqlQuery || '');
    setEditParams((prev) => {
      const rows: ParamRow[] = [];
      // existing parse happens below; merge after
      return prev;
    });
    setEditDbKey(e.dbKey || 'primary');
    setEditCache(e.cacheTtlSec || 0);
    setEditMaxRows((() => {
      const fromEp = typeof e.maxRows === 'number' && e.maxRows > 0 ? e.maxRows : 0;
      const ps = e.paramsSchema as any;
      const fromPs = ps && typeof ps.maxRows === 'number' && ps.maxRows > 0 ? ps.maxRows : 0;
      return fromEp || fromPs || 1000;
    })());
    setEditAuth(e.authRequired !== false);
    setEditTenantSlug(e.tenantSlug);
    // Parse paramsSchema into editable rows
    const rows: ParamRow[] = [];
    const ps = e.paramsSchema as any;
    if (ps && typeof ps === 'object') {
      for (const source of ['urlParams', 'queryParams', 'bodyParams'] as const) {
        const arr = ps[source];
        if (Array.isArray(arr)) {
          for (const p of arr) {
            rows.push({
              name: String(p.name || ''),
              type: String(p.type || 'string'),
              required: Boolean(p.required),
              source: source === 'urlParams' ? 'url' : source === 'bodyParams' ? 'body' : 'query',
            });
          }
        }
      }
    }
    setEditParams(mergeParamsFromSql(e.sqlQuery || '', rows));
    setExecResult(null);
    try { document.body.style.overflow = 'hidden'; } catch { /* */ }
    // Warm SQL table names for autocomplete (silent)
    void warmSqlSchema(e.tenantSlug, e.dbKey || 'primary');
  }

  function openCreate(prefillSlug?: string) {
    void preloadSqlEditor();
    setIsCreate(true);
    const slug = prefillSlug || selectedTenantSlug || tenants[0]?.slug || '';
    const tn = tenants.find((t) => t.slug === slug);
    const firstDb = tn?.connections?.[0]?.dbKey || 'primary';
    setEditEp({
      id: '',
      tenantSlug: slug,
      name: '',
      method: 'GET',
      pathTemplate: '/report',
      dbKey: firstDb,
      sqlQuery: 'SELECT 1 AS ok',
      authRequired: false,
      cacheTtlSec: 0,
    });
    setEditName('');
    setEditPath('/report');
    setEditMethod('GET');
    setEditSql('SELECT 1 AS ok');
    setEditDbKey(firstDb);
    setEditCache(0);
    setEditMaxRows(1000);
    setEditAuth(false);
    setEditTenantSlug(slug);
    setEditParams([]);
    setTestParamValues({});
    setExecResult(null);
    try { document.body.style.overflow = 'hidden'; } catch { /* */ }
    void warmSqlSchema(slug, firstDb);
  }


  // Embed from widget/filter ApiPicker: ?embed=1&edit=ID or &new=1&tenant=
  useEffect(() => {
    if (!embedMode || embedBootstrapped.current || loading) return;
    const editId = searchParams.get('edit');
    const isNew = searchParams.get('new') === '1';
    const tenant = searchParams.get('tenant') || '';
    if (editId) {
      const ep = endpoints.find((e) => e.id === editId);
      if (ep) {
        embedBootstrapped.current = true;
        openEdit(ep);
      } else if (endpoints.length > 0) {
        embedBootstrapped.current = true;
      }
    } else if (isNew) {
      embedBootstrapped.current = true;
      openCreate(tenant || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedMode, loading, endpoints, searchParams]);

  // Embed: after editor closed, notify parent
  useEffect(() => {
    if (!embedMode || editEp || !embedBootstrapped.current) return;
    try {
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'bi-api-editor-closed' }, '*');
      }
    } catch {
      /* */
    }
  }, [embedMode, editEp]);

  function isEditorDirty(): boolean {
    if (!editEp) return false;
    if (isCreate) {
      return Boolean(
        editName.trim() ||
          (editSql && editSql !== 'SELECT 1 AS ok') ||
          (editPath && editPath !== '/report')
      );
    }
    const ps = editEp.paramsSchema as any;
    const origParams: ParamRow[] = [];
    if (ps && typeof ps === 'object') {
      for (const source of ['urlParams', 'queryParams', 'bodyParams'] as const) {
        const arr = ps[source];
        if (Array.isArray(arr)) {
          for (const p of arr) {
            origParams.push({
              name: String(p.name || ''),
              type: String(p.type || 'string'),
              required: Boolean(p.required),
              source: source === 'urlParams' ? 'url' : source === 'bodyParams' ? 'body' : 'query',
            });
          }
        }
      }
    }
    return (
      editName !== (editEp.name || '') ||
      editPath !== (editEp.pathTemplate || '') ||
      editMethod !== (editEp.method || 'GET') ||
      editSql !== (editEp.sqlQuery || '') ||
      editDbKey !== (editEp.dbKey || 'primary') ||
      editCache !== (editEp.cacheTtlSec || 0) ||
      editMaxRows !== (editEp.maxRows || 1000) ||
      editAuth !== (editEp.authRequired !== false) ||
      JSON.stringify(editParams) !== JSON.stringify(origParams)
    );
  }

  async function closeEdit() {
    if (isEditorDirty()) {
      const choice = await confirmDialog({
        title: 'Saklanmadyk üýtgeşmeler',
        message:
          'API redaktorynda saklanmadyk üýtgeşmeler bar.\n\n• Sakla we çyk — üýtgeşmeleri VPS-e ýazyp çykýar\n• Saklamazdan çyk — üýtgeşmeler ýitýär\n• Redaktorda gal — hiç zat üýtgemän dowam edersiňiz',
        confirmLabel: 'Sakla we çyk',
        cancelLabel: 'Saklamazdan çyk',
        stayLabel: 'Redaktorda gal',
        danger: false,
      });
      if (choice === 'stay') return;
      if (choice === true) {
        await saveEdit();
        // saveEdit force-closes on success; if validation failed stay open
        return;
      }
      // false → discard and close
    }
    forceClose();
  }

  /** Close the editor without re-checking dirty state (used right after a
   * successful save, so the user doesn't get a second "unsaved changes"
   * warning immediately after saving). */
  function forceClose() {
    setEditEp(null);
    setExecResult(null);
    setShowResultModal(false);
    setIsCreate(false);
    try {
      document.body.style.overflow = '';
    } catch {
      /* */
    }
    try {
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'bi-api-editor-closed' }, '*');
      }
    } catch {
      /* */
    }
  }

  async function saveEdit() {
    if (!editEp) return;
    if (!(editName || '').trim()) {
      toastError('At gerek', 'API adyny ýazyň');
      return;
    }
    if (!(editPath || '').trim() || editPath === '/') {
      toastError('Path gerek', 'Path dolduryň');
      return;
    }
    const conflict = pathConflict(editPath, editMethod, isCreate ? undefined : editEp.id);
    if (conflict) {
      toastError(
        'Path eýýäm bar',
        `«${conflict.name}» bilen birmeňzeş: ${editMethod} ${editPath}\nPath ýa-da method üýtgetiň.`
      );
      return;
    }
    // Mutating SQL blocked
    {
      const { assertReadOnlySql } = await import('@/lib/sqlSafety');
      const safe = assertReadOnlySql(editSql || '');
      if (!safe.ok) {
        toastError('SQL rugsat edilmedi', safe.reason);
        return;
      }
    }
    // Params in SQL must be declared before save
    {
      const sqlNames = extractSqlParamNames(editSql);
      const declared = new Set(
        editParams.map((x) => x.name.trim().toLowerCase()).filter(Boolean)
      );
      const missing = sqlNames.filter((n) => !declared.has(n.toLowerCase()));
      if (missing.length) {
        toastError(
          'Parametrler doly däl',
          `SQL-de bar, sanawda ýok: ${missing.map((m) => '@' + m).join(', ')}. ` +
            `"Auto params" basyň ýa-da el bilen goşuň — soň type / required / query|body|url barlaň.`
        );
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch('/api/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editEp.id || undefined,
          create: isCreate || !editEp.id,
          tenantSlug: editTenantSlug || editEp.tenantSlug,
          name: editName,
          pathTemplate: editPath,
          method: editMethod,
          dbKey: editDbKey || 'primary',
          sqlQuery: editSql,
          cacheTtlSec: editCache,
          maxRows: editMaxRows > 0 ? editMaxRows : 1000,
          authRequired: editAuth,
          paramsSchema: {
            urlParams: editParams.filter((x) => x.source === 'url' && x.name.trim()).map((x) => ({
              name: x.name.trim(),
              type: x.type || 'string',
              required: x.required,
            })),
            queryParams: editParams.filter((x) => x.source === 'query' && x.name.trim()).map((x) => ({
              name: x.name.trim(),
              type: x.type || 'string',
              required: x.required,
            })),
            bodyParams: editParams.filter((x) => x.source === 'body' && x.name.trim()).map((x) => ({
              name: x.name.trim(),
              type: x.type || 'string',
              required: x.required,
            })),
            maxRows: editMaxRows > 0 ? editMaxRows : 1000,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Saklamak şowsuz', data.error || data.message);
        return;
      }
      toastSuccess(isCreate ? 'API goşuldy' : 'API üýtgedildi', 'VPS-e ýazyldy · Electron catalog-dan görer');
      forceClose();
      await load(true);
    } finally {
      setSaving(false);
    }
  }


  function sqlCopy() {
    void navigator.clipboard.writeText(editSql || '');
    toastSuccess('SQL göçürildi');
  }
  async function sqlPaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setEditSql((prev) => (prev ? prev + (prev.endsWith('\n') ? '' : '\n') + text : text));
      toastSuccess('Paste');
    } catch {
      toastError('Clipboard', 'Brauzer paste rugsady gerek');
    }
  }
  function sqlCut() {
    void navigator.clipboard.writeText(editSql || '');
    setEditSql('');
    toastSuccess('Cut');
  }
  function sqlClear() {
    setEditSql('');
  }
  function sqlBeautify() {
    let s = (editSql || '').replace(/\r\n/g, '\n').trim();
    if (!s) return;
    // Collapse whitespace but keep string literals roughly
    s = s.replace(/[ \t]+/g, ' ');
    s = s.replace(/\s*\n\s*/g, ' ');
    // Major clause breaks
    const major = [
      'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING',
      'UNION ALL', 'UNION', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
    ];
    for (const kw of major) {
      const re = new RegExp('\\b' + kw.replace(/ /g, '\\s+') + '\\b', 'gi');
      s = s.replace(re, (m) => '\n' + m.toUpperCase());
    }
    // JOIN lines
    s = s.replace(/\b((?:LEFT|RIGHT|INNER|FULL|CROSS)?\s*JOIN)\b/gi, (m) => '\n    ' + m.replace(/\s+/g, ' ').toUpperCase());
    s = s.replace(/\bON\b/gi, 'ON');
    // AND/OR under WHERE — keep compact on same indent style
    s = s.replace(/\bAND\b/gi, '\n      AND');
    s = s.replace(/\bOR\b/gi, '\n      OR');
    // SELECT / GROUP BY / ORDER BY list: commas with indent
    const lines = s.split('\n').map((line) => line.trim()).filter(Boolean);
    const out: string[] = [];
    for (const line of lines) {
      const upper = line.toUpperCase();
      if (upper.startsWith('SELECT')) {
        out.push('SELECT');
        const rest = line.replace(/^SELECT\s+/i, '');
        const parts = rest.split(',').map((p) => p.trim()).filter(Boolean);
        parts.forEach((p, i) => out.push('    ' + p + (i < parts.length - 1 ? ',' : '')));
      } else if (upper.startsWith('GROUP BY')) {
        out.push('GROUP BY');
        const rest = line.replace(/^GROUP\s+BY\s+/i, '');
        const parts = rest.split(',').map((p) => p.trim()).filter(Boolean);
        parts.forEach((p, i) => out.push('    ' + p + (i < parts.length - 1 ? ',' : '')));
      } else if (upper.startsWith('ORDER BY')) {
        out.push('ORDER BY');
        const rest = line.replace(/^ORDER\s+BY\s+/i, '');
        const parts = rest.split(',').map((p) => p.trim()).filter(Boolean);
        parts.forEach((p, i) => out.push('    ' + p + (i < parts.length - 1 ? ',' : '')));
      } else if (upper.startsWith('FROM')) {
        out.push('FROM');
        out.push('    ' + line.replace(/^FROM\s+/i, ''));
      } else if (/^(LEFT|RIGHT|INNER|FULL|CROSS)?\s*JOIN/i.test(line) || upper.startsWith('JOIN')) {
        // JOIN ... ON ... on one line
        out.push('    ' + line.replace(/\s+/g, ' '));
      } else if (upper.startsWith('WHERE')) {
        out.push('WHERE');
        const rest = line.replace(/^WHERE\s+/i, '');
        if (rest) out.push('      ' + rest);
      } else if (upper.startsWith('AND') || upper.startsWith('OR')) {
        out.push('      ' + line.replace(/\s+/g, ' '));
      } else {
        out.push(line);
      }
    }
    // Merge JOIN with following ON if split
    const merged: string[] = [];
    for (let i = 0; i < out.length; i++) {
      const cur = out[i];
      if (/\bJOIN\b/i.test(cur) && i + 1 < out.length && /^\s*ON\b/i.test(out[i + 1])) {
        merged.push(cur + ' ' + out[i + 1].trim());
        i++;
      } else {
        merged.push(cur);
      }
    }
    setEditSql(merged.join('\n').trim() + '\n');
    toastSuccess('Beautify');
  }

  async function executeSql() {
    const selectedOrFull = (sqlEditorRef.current?.getSelectedOrFull() || editSql || '').trim();
    if (!editEp || !selectedOrFull) {
      toastError('SQL boş', 'Query ýazyň');
      return;
    }
    const sqlToRun = selectedOrFull;
    const usedSelection =
      Boolean(sqlEditorRef.current?.getSelection()?.trim()) &&
      sqlEditorRef.current!.getSelection()!.trim() !== (editSql || '').trim();
    {
      const { assertReadOnlySql } = await import('@/lib/sqlSafety');
      const safe = assertReadOnlySql(sqlToRun);
      if (!safe.ok) {
        toastError('SQL rugsat edilmedi', safe.reason);
        return;
      }
    }
    const sqlNames = extractSqlParamNames(sqlToRun);
    const params: Record<string, unknown> = {};
    for (const n of sqlNames) {
      const raw = testParamValues[n];
      if (raw === undefined || raw === '') {
        // still send null so backend can show missing if needed
        params[n] = null;
      } else {
        const meta = editParams.find((p) => p.name.trim().toLowerCase() === n.toLowerCase());
        const tp = (meta?.type || 'string').toLowerCase();
        if (tp === 'number' || tp === 'int') {
          const num = Number(raw);
          params[n] = Number.isFinite(num) ? num : raw;
        } else if (tp === 'boolean') {
          params[n] = /^(1|true|yes|hawa)$/i.test(raw);
        } else {
          params[n] = raw;
        }
      }
    }
    if (execAbortRef.current) {
      try {
        execAbortRef.current.abort();
      } catch {
        /* */
      }
    }
    const ac = new AbortController();
    execAbortRef.current = ac;
    setExecuting(true);
    setExecResult(null);
    try {
      const res = await fetch('/api/admin-test-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: editEp.tenantSlug || editTenantSlug,
          sqlQuery: sqlToRun,
          dbKey: editDbKey || editEp.dbKey || 'primary',
          params,
        }),
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      const data = await res.json();
      if (ac.signal.aborted) return;
      if (!res.ok) {
        setExecResult({ ok: false, error: data.error || 'şowsuz' });
        setShowResultModal(true);
        toastError('Execute şowsuz', data.error);
        return;
      }
      let rows = Array.isArray(data.rows) ? data.rows : [];
      const lim = editMaxRows > 0 ? editMaxRows : 1000;
      let truncated = false;
      if (rows.length > lim) {
        rows = rows.slice(0, lim);
        truncated = true;
      }
      setExecResult({
        ok: true,
        rows,
        rowCount: rows.length,
        elapsedMs: data.elapsedMs,
      });
      setShowResultModal(true);
      toastSuccess(
        'Execute OK',
        `${rows.length} setir` +
          (usedSelection ? ' · diňe saýlanan bölek' : '') +
          (truncated ? ` · max ${lim}` : '')
      );
    } catch (e: any) {
      if (e?.name === 'AbortError' || ac.signal.aborted) {
        toastInfo('Run togtadyldy', 'SQL execute stop edildi');
        return;
      }
      setExecResult({ ok: false, error: String(e) });
      toastError('Execute şowsuz', String(e));
    } finally {
      if (execAbortRef.current === ac) execAbortRef.current = null;
      setExecuting(false);
    }
  }

  function stopExecuteSql() {
    if (execAbortRef.current) {
      try {
        execAbortRef.current.abort();
      } catch {
        /* */
      }
      execAbortRef.current = null;
    }
    setExecuting(false);
  }

  async function deleteEp(e: Endpoint) {
    const ok = await confirmDialog({
      title: 'API pozulsynmy?',
      message: `«${e.name}»\n${e.method} ${e.pathTemplate}\n\nBu amal yzyna alynmaýar. VPS-den hem öçüriler.`,
      confirmLabel: 'Hawa, poz',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch('/api/endpoints', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: e.id, tenantSlug: e.tenantSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError('Pozup bolmady', data.error || data.message);
        return;
      }
      toastSuccess('API pozuldy', 'VPS-den öçürildi');
      closeEdit();
      await load(true);
    } catch (err: any) {
      toastError('Pozup bolmady', String(err));
    }
  }

  async function copyUrl(e: Endpoint) {
    await navigator.clipboard.writeText(fullUrl(e));
    setCopied(e.id);
    toastSuccess('URL göçürildi');
    setTimeout(() => setCopied(null), 1500);
  }

  const tenantName = (slug: string) => tenants.find((t) => t.slug === slug)?.name || slug;

  const columns = useMemo<DataTableColumn<Endpoint>[]>(
    () => [
      {
        id: 'method',
        header: 'Method',
        accessor: (r) => r.method,
        cell: (r) => (
          <span className="font-mono text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
            {r.method}
          </span>
        ),
      },
      {
        id: 'name',
        header: 'Ady',
        mobilePrimary: true,
        accessor: (r) => r.name,
      },
      {
        id: 'url',
        header: 'Doly URL',
        accessor: (r) => fullUrl(r),
        cell: (r) => (
          <a
            href={fullUrl(r)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] text-sky-400 hover:text-sky-300 hover:underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {fullUrl(r)}
          </a>
        ),
      },
      {
        id: 'company',
        header: 'Kompaniýa',
        accessor: (r) => tenantName(r.tenantSlug),
      },
      {
        id: 'actions',
        header: 'Amal',
        sortable: false,
        accessor: () => '',
        cell: (r) => (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => openEdit(r)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10"
              title="Üýtget"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void deleteEp(r)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10"
              title="Poz"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => copyUrl(r)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10"
              title="Copy"
            >
              {copied === r.id ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            <a
              href={fullUrl(r)}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-sky-500/10"
              title="Open"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        ),
      },
    ],
    [gatewayBase, tenants, copied]
  );


  // ── Full-screen API editor (not modal) ──────────────────────
  if (editEp) {
    return (
      <ModalPortal open={Boolean(editEp)}>
      <div className="fixed inset-0 z-[320] flex flex-col bg-slate-950">
        <div className="shrink-0 border-b border-slate-800 bg-slate-900/95 px-4 py-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={closeEdit}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Yza
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-semibold text-white truncate max-w-[50vw] sm:max-w-none">
              {isCreate ? (editName.trim() || 'Täze API') : (editName.trim() || editEp.name || 'API üýtget')}
            </h1>
            <p className="text-xs text-slate-500 font-mono truncate">
              {editMethod} /api/v1/{editTenantSlug || editEp.tenantSlug}/{editDbKey || 'primary'}/
              {(editPath || '').replace(/^\//, '')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="lg:hidden"
              onClick={() => setMetaSheetOpen(true)}
            >
              Meta / Firma
            </Button>
            {!isCreate && (
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-400 hover:text-rose-300"
                onClick={() => void deleteEp(editEp)}
              >
                <Trash2 className="h-4 w-4" />
                Poz
              </Button>
            )}
            <Button size="sm" loading={saving} onClick={() => void saveEdit()}>
              Sakla
            </Button>
          </div>
        </div>

        {/* Mobile meta sheet */}
        {metaSheetOpen && (
          <div className="lg:hidden fixed inset-0 z-[330] flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMetaSheetOpen(false)} />
            <div className="relative max-h-[85dvh] overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-900 p-4 space-y-3 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">API meta / Firma</h3>
                <button type="button" className="text-slate-400 hover:text-white" onClick={() => setMetaSheetOpen(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div>
                <label className="text-xs text-slate-400">Firma</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
                  value={editTenantSlug}
                  disabled={!isCreate}
                  onChange={(e) => {
                    const slug = e.target.value;
                    setEditTenantSlug(slug);
                    const tn = tenants.find((t) => t.slug === slug);
                    const db = tn?.connections?.[0]?.dbKey || 'primary';
                    setEditDbKey(db);
                    void warmSqlSchema(slug, db);
                  }}
                >
                  <option value="">— saýlaň —</option>
                  {tenants.map((tn) => (
                    <option key={tn.slug} value={tn.slug}>{tn.name} ({tn.slug})</option>
                  ))}
                </select>
              </div>
              <Input
                label="Ady"
                value={editName}
                onChange={(e) => {
                  const v = e.target.value;
                  setEditName(v);
                  setEditPath(pathFromName(v));
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400">Method</label>
                  <select className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" value={editMethod} onChange={(e) => setEditMethod(e.target.value)}>
                    {['GET','POST','PUT','PATCH','DELETE'].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <Input label="Path" value={editPath} onChange={(e) => setEditPath(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-400">Connection (dbKey)</label>
                <select className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" value={editDbKey} onChange={(e) => { const v = e.target.value; setEditDbKey(v); void warmSqlSchema(editTenantSlug || editEp?.tenantSlug || '', v); }}>
                  {(() => {
                    const tn = tenants.find((t) => t.slug === (editTenantSlug || editEp?.tenantSlug));
                    const conns = tn?.connections || [];
                    return (
                      <>
                        {conns.map((c: any) => (
                          <option key={c.dbKey || c.id} value={c.dbKey || 'primary'}>
                            {String(c.dbType || '').toLowerCase() === 'excel' || /\.(xlsx|xls|csv)$/i.test(String(c.host || ''))
                              ? `EXCEL · ${(c.label || c.dbKey || 'primary')} [${c.database || 'Sheet'}]`
                              : `${(c.label || c.dbKey || 'primary')} (${c.dbKey || 'primary'})`}
                          </option>
                        ))}
                        <option value="__custom">— el bilen ýaz —</option>
                      </>
                    );
                  })()}
                </select>
              </div>
              <Input label="Cache TTL (sek)" type="number" value={String(editCache)} onChange={(e) => setEditCache(Number(e.target.value) || 0)} />
              <Input label="Max setir (default 1000)" type="number" value={String(editMaxRows)} onChange={(e) => setEditMaxRows(Math.max(1, Number(e.target.value) || 1000))} />
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={editAuth} onChange={(e) => setEditAuth(e.target.checked)} />
                Auth required
              </label>
              <div className="border-t border-slate-800 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-300">Parametrler (mobile)</p>
                  <button
                    type="button"
                    className="text-[11px] text-indigo-400"
                    onClick={() =>
                      setEditParams((rows) => [
                        ...rows,
                        { name: '', type: 'nvarchar', required: false, source: 'query' as const },
                      ])
                    }
                  >
                    + Param
                  </button>
                </div>
                {editParams.map((p, i) => (
                  <div key={i} className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 space-y-1.5">
                    <div className="grid grid-cols-12 gap-1.5 items-center">
                      <input
                        className="col-span-5 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                        placeholder="ady"
                        value={p.name}
                        onChange={(e) =>
                          setEditParams((rows) =>
                            rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r))
                          )
                        }
                      />
                      <select
                        className="col-span-4 rounded-lg border border-slate-700 bg-slate-950 px-1 py-1.5 text-xs text-white"
                        value={p.type}
                        onChange={(e) =>
                          setEditParams((rows) =>
                            rows.map((r, j) => (j === i ? { ...r, type: e.target.value } : r))
                          )
                        }
                      >
                        {['nvarchar','int','bigint','date','datetime','bit','float'].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <select
                        className="col-span-3 rounded-lg border border-slate-700 bg-slate-950 px-1 py-1.5 text-xs text-white"
                        value={p.source}
                        onChange={(e) =>
                          setEditParams((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, source: e.target.value as any } : r
                            )
                          )
                        }
                      >
                        <option value="query">query</option>
                        <option value="url">url</option>
                        <option value="body">body</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          className="rounded border-slate-600"
                          checked={!!p.required}
                          onChange={(e) => {
                            const v = e.target.checked;
                            setEditParams((rows) =>
                              rows.map((r, j) => (j === i ? { ...r, required: v } : r))
                            );
                          }}
                        />
                        <span className="font-medium text-amber-300/90">req</span>
                        <span className="text-slate-500">(required)</span>
                      </label>
                      <button
                        type="button"
                        className="text-rose-400 text-xs px-2 py-1"
                        onClick={() => setEditParams((rows) => rows.filter((_, j) => j !== i))}
                      >
                        Poz
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full" size="sm" onClick={() => setMetaSheetOpen(false)}>Ýatda sakla / Ýap</Button>
            </div>
          </div>
        )}


        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
            {/* Left: meta — desktop only; mobile uses sheet */}
            <div className="hidden lg:block space-y-4 lg:col-span-3 overflow-y-auto max-h-[calc(100vh-5rem)]">
              <div>
                <label className="text-xs text-slate-400">Firma</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
                  value={editTenantSlug}
                  disabled={!isCreate}
                  title={!isCreate ? 'Bar bolan API-de firma üýtgedip bolanok — täze API dörediň' : undefined}
                  onChange={(e) => {
                    const slug = e.target.value;
                    setEditTenantSlug(slug);
                    // company changed → connection list changes, reset to that
                    // company's first connection so dbKey never points at a
                    // connection belonging to the previous firma
                    const tn = tenants.find((t) => t.slug === slug);
                    const firstConn = tn?.connections?.[0]?.dbKey || 'primary';
                    setEditDbKey(firstConn);
                    void warmSqlSchema(slug, firstConn);
                  }}
                >
                  <option value="">— saýlaň —</option>
                  {tenants.map((tn) => (
                    <option key={tn.slug} value={tn.slug}>
                      {tn.name} ({tn.slug})
                    </option>
                  ))}
                </select>
                {!isCreate && (
                  <p className="mt-1 text-[10px] text-slate-500">
                    Firma diňe API döredilende saýlanýar.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Ady</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    value={editName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditName(v);
                      // Ady üýtgände path-i hem täzele (create + edit)
                      setEditPath(pathFromName(v));
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Method</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    value={editMethod}
                    onChange={(e) => setEditMethod(e.target.value)}
                  >
                    {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Path</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-mono text-white"
                    value={editPath}
                    onChange={(e) => setEditPath(e.target.value)}
                    placeholder="/test"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Connection (dbKey)</label>
                  {(() => {
                    const tn = tenants.find((t) => t.slug === (editTenantSlug || editEp?.tenantSlug));
                    const conns = tn?.connections || [];
                    const knownKeys = new Set(conns.map((c) => c.dbKey));
                    const isCustom = editDbKey !== '' && !knownKeys.has(editDbKey);
                    return (
                      <>
                        <select
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-mono text-white"
                          value={isCustom ? '__custom__' : editDbKey || 'primary'}
                          onChange={(e) => {
                            if (e.target.value === '__custom__') {
                              setEditDbKey((prev) => (knownKeys.has(prev) ? '' : prev));
                              return;
                            }
                            const v = e.target.value;
                            setEditDbKey(v);
                            void warmSqlSchema(editTenantSlug || editEp?.tenantSlug || '', v);
                          }}
                        >
                          {conns.length === 0 && <option value="primary">primary</option>}
                          {conns.map((c) => (
                            <option key={c.dbKey} value={c.dbKey}>
                              {c.label ? `${c.label} (${c.dbKey})` : c.dbKey}
                              {c.database ? ` · ${c.database}` : ''}
                            </option>
                          ))}
                          <option value="__custom__">— el bilen ýaz —</option>
                        </select>
                        {conns.length === 0 && (editTenantSlug || editEp?.tenantSlug) && (
                          <p className="mt-1 text-[10px] text-amber-400">
                            Bu firma üçin baglanyşyk tapylmady — «DB baglanyşyklar» sahypasyndan goşuň.
                          </p>
                        )}
                        {isCustom && (
                          <input
                            autoFocus
                            className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-mono text-white"
                            placeholder="dbKey el bilen ýaz"
                            value={editDbKey}
                            onChange={(e) => { const v = e.target.value; setEditDbKey(v); void warmSqlSchema(editTenantSlug || editEp?.tenantSlug || '', v); }}
                          />
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Cache TTL (sek)</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    value={editCache}
                    onChange={(e) => setEditCache(Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Max setir (default 1000)</label>
                  <input
                    type="number"
                    min={1}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    value={editMaxRows}
                    onChange={(e) => setEditMaxRows(Math.max(1, Number(e.target.value) || 1000))}
                  />
                </div>
                <div className="flex items-end pb-2 col-span-2">
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={editAuth}
                      onChange={(e) => setEditAuth(e.target.checked)}
                    />
                    Auth required
                  </label>
                </div>
              </div>

              {/* Params */}
              <div>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <label className="text-xs text-slate-400">Parametrler</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-[11px] text-emerald-400 hover:text-emerald-300"
                      onClick={autoCompleteParams}
                      title="SQL-däki @param-lary awto goş"
                    >
                      Auto params
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-indigo-400 hover:text-indigo-300"
                      onClick={() =>
                        setEditParams((p) => [
                          ...p,
                          { name: '', type: 'string', required: false, source: 'query' },
                        ])
                      }
                    >
                      + Param
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mb-2 leading-snug">
                  <span className="text-slate-400 font-medium">query</span> = URL ?key=value (GET).{' '}
                  <span className="text-slate-400 font-medium">body</span> = JSON göwde (POST/PUT).{' '}
                  <span className="text-slate-400 font-medium">url</span> = path /api/:id. SQL-de{' '}
                  <span className="font-mono text-slate-400">@name</span> bilen gabat gelmeli.
                </p>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {editParams.map((pr, i) => (
                    <div key={i} className="rounded-lg border border-slate-800 bg-slate-950/50 p-2 space-y-1.5">
                      <div className="flex flex-wrap gap-2 items-center text-xs">
                        <input
                          className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-white"
                          placeholder="name"
                          value={pr.name}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEditParams((rows) => rows.map((r, j) => (j === i ? { ...r, name: v } : r)));
                          }}
                        />
                        <select
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                          value={pr.source}
                          onChange={(e) => {
                            const v = e.target.value as ParamRow['source'];
                            setEditParams((rows) => rows.map((r, j) => (j === i ? { ...r, source: v } : r)));
                          }}
                          title="Parametr nireden okalsyn"
                        >
                          <option value="query">query (?key=)</option>
                          <option value="body">body (JSON)</option>
                          <option value="url">url (/:id)</option>
                        </select>
                        <select
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                          value={pr.type}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEditParams((rows) => rows.map((r, j) => (j === i ? { ...r, type: v } : r)));
                          }}
                        >
                          {['string', 'number', 'int', 'boolean', 'date', 'datetime', 'time', 'uuid', 'text', 'json'].map((tp) => (
                            <option key={tp} value={tp}>
                              {tp}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1 text-slate-400">
                          <input
                            type="checkbox"
                            checked={pr.required}
                            onChange={(e) => {
                              const v = e.target.checked;
                              setEditParams((rows) =>
                                rows.map((r, j) => (j === i ? { ...r, required: v } : r))
                              );
                            }}
                          />
                          req
                        </label>
                        <button
                          type="button"
                          className="text-rose-400"
                          onClick={() => setEditParams((rows) => rows.filter((_, j) => j !== i))}
                        >
                          ×
                        </button>
                      </div>
                      {pr.name.trim() ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 shrink-0">Test:</span>
                          <input
                            className="flex-1 min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-mono text-emerald-200"
                            placeholder={
                              pr.type === 'date' || pr.type === 'datetime'
                                ? '2026-09-06'
                                : pr.type === 'boolean'
                                  ? 'true / false'
                                  : pr.type === 'number' || pr.type === 'int'
                                    ? '0'
                                    : `@${pr.name} bahasy`
                            }
                            type={
                              pr.type === 'number' || pr.type === 'int'
                                ? 'number'
                                : pr.type === 'date'
                                  ? 'date'
                                  : pr.type === 'datetime'
                                    ? 'datetime-local'
                                    : 'text'
                            }
                            value={testParamValues[pr.name] ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              const key = pr.name;
                              setTestParamValues((prev) => ({ ...prev, [key]: v }));
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>

                        {/* Right: SQL ~80% */}
            <div className="flex flex-col lg:col-span-9 min-h-0" style={{ height: 'min(80vh, calc(100vh - 5.5rem))' }}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <label className="text-xs text-slate-400">SQL query</label>
                {schemaStatus.state === 'loading' && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-400">
                    <RefreshCw className="h-3 w-3 animate-spin" /> tables…
                  </span>
                )}
                {schemaStatus.state === 'ok' && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-700/50 bg-emerald-950/50 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-900/40"
                    title={`Autocomplete: ${schemaStatus.tables} table · ${schemaStatus.dbKey} · täzele üçin bas`}
                    onClick={() =>
                      void warmSqlSchema(
                        editTenantSlug || editEp?.tenantSlug || '',
                        editDbKey || editEp?.dbKey || 'primary',
                        true
                      )
                    }
                  >
                    <Check className="h-3 w-3" /> tables({schemaStatus.tables}) OK
                  </button>
                )}
                {schemaStatus.state === 'empty' && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-700/40 bg-amber-950/30 px-2 py-0.5 text-[10px] text-amber-300" title="DB bagly, ýöne table tapylmady">
                    tables(0)
                  </span>
                )}
                {schemaStatus.state === 'error' && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-rose-700/50 bg-rose-950/40 px-2 py-0.5 text-[10px] text-rose-300 max-w-[14rem] truncate hover:bg-rose-900/40"
                    title={`${schemaStatus.message} · täzele üçin bas`}
                    onClick={() =>
                      void warmSqlSchema(
                        editTenantSlug || editEp?.tenantSlug || '',
                        editDbKey || editEp?.dbKey || 'primary',
                        true
                      )
                    }
                  >
                    tables ✗ {schemaStatus.message}
                  </button>
                )}
                <span className="mr-auto" />
                <button
                  type="button"
                  onClick={autoCompleteParams}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-700/50 bg-emerald-950/40 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-900/40"
                  title="SQL-däki @param-lary sanawa goş"
                >
                  <Sparkles className="h-3 w-3" /> Auto params
                </button>
                <button type="button" onClick={() => void sqlPaste()} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800">
                  <ClipboardPaste className="h-3 w-3" /> Paste
                </button>
                <button type="button" onClick={sqlCopy} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800">
                  <Copy className="h-3 w-3" /> Copy
                </button>
                <button type="button" onClick={sqlCut} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800">
                  <Scissors className="h-3 w-3" /> Cut
                </button>
                <button type="button" onClick={sqlClear} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800">
                  <Eraser className="h-3 w-3" /> Clear
                </button>
                <button type="button" onClick={sqlBeautify} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-emerald-300 hover:bg-slate-800">
                  <Sparkles className="h-3 w-3" /> Beautify
                </button>
                {executing ? (
                  <Button size="sm" variant="danger" onClick={stopExecuteSql}>
                    <Square className="h-3.5 w-3.5 fill-current" />
                    Stop
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => void executeSql()}>
                    <Play className="h-3.5 w-3.5" />
                    Run
                  </Button>
                )}
              </div>
              <div className="relative flex-1 rounded-xl border border-slate-700 overflow-hidden bg-slate-950 min-h-[50vh]">
                
              {isExcelConn(currentEditConnection()) && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-300">Excel Query Builder</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      loading={excelColsLoading}
                      onClick={() => void loadExcelColumnsForEditor()}
                    >
                      Sütünleri ýükle
                    </Button>
                    <Button type="button" size="sm" onClick={() => applyExcelBuilderSql()}>
                      SQL we param goý
                    </Button>
                  </div>
                  {excelColsError && (
                    <p className="text-xs text-rose-400">{excelColsError}</p>
                  )}
                  {excelColumns.length > 0 && (
                    <>
                      <p className="text-[11px] text-slate-400">SELECT sütünleri</p>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                        {excelColumns.map((c) => (
                          <label
                            key={`sel-${c}`}
                            className={`text-[11px] px-2 py-1 rounded-md border cursor-pointer ${
                              excelSelCols.has(c)
                                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100'
                                : 'border-slate-700 text-slate-400'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={excelSelCols.has(c)}
                              onChange={() => {
                                setExcelSelCols((prev) => {
                                  const n = new Set(prev);
                                  if (n.has(c)) n.delete(c);
                                  else n.add(c);
                                  return n;
                                });
                              }}
                            />
                            {c}
                          </label>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400">Filter (WHERE col IN (@col))</p>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                        {excelColumns.map((c) => (
                          <label
                            key={`flt-${c}`}
                            className={`text-[11px] px-2 py-1 rounded-md border cursor-pointer ${
                              excelFilterCols.has(c)
                                ? 'border-amber-500/50 bg-amber-500/15 text-amber-100'
                                : 'border-slate-700 text-slate-400'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={excelFilterCols.has(c)}
                              onChange={() => {
                                setExcelFilterCols((prev) => {
                                  const n = new Set(prev);
                                  if (n.has(c)) n.delete(c);
                                  else n.add(c);
                                  return n;
                                });
                              }}
                            />
                            {c}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
<SqlCodeEditor
                  ref={sqlEditorRef}
                  value={editSql}
                  onChange={(v) => {
                    setEditSql(v);
                    // silent alias → hint refresh
                    try {
                      const aliases = parseSqlTableAliases(v || '');
                      setSqlHintTables(
                        buildHintTables(
                          sqlTablesListRef.current,
                          aliases,
                          sqlColsByTableRef.current
                        )
                      );
                      // Prefetch columns for tables mentioned in SQL
                      for (const real of new Set(Object.values(aliases))) {
                        void ensureTableColumns(real);
                      }
                    } catch {
                      /* */
                    }
                  }}
                  height="100%"
                  hintTables={sqlHintTables}
                  tableNames={sqlTableNames}
                  onNeedTableColumns={(name) => void ensureTableColumns(name)}
                />
              </div>
            </div>
          </div>
        </div>

        {showResultModal && execResult && (
          <div className="fixed inset-0 z-[400] flex items-stretch sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-slate-950/90" onClick={() => setShowResultModal(false)} />
            <div className="relative w-full h-[100dvh] sm:h-auto sm:max-w-6xl sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-2xl border-0 sm:border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden">
              <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 border-b border-slate-800 bg-slate-900">
                <h3 className="text-sm font-semibold text-white flex-1 min-w-0 truncate">
                  SQL netije
                  {execResult.rowCount != null && (
                    <span className="text-slate-400 font-normal ml-2">{execResult.rowCount} setir</span>
                  )}
                  {execResult.elapsedMs != null && (
                    <span className="text-slate-500 font-normal ml-2">{execResult.elapsedMs} ms</span>
                  )}
                </h3>
                <button
                  type="button"
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white shrink-0"
                  onClick={() => setShowResultModal(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-auto p-2 sm:p-3">
                {execResult.error ? (
                  <p className="p-4 text-sm text-rose-400 font-mono whitespace-pre-wrap">{execResult.error}</p>
                ) : execResult.rows && execResult.rows.length > 0 ? (
                  <DataTable
                    rows={(execResult.rows as Record<string, unknown>[]).map((r, i) => ({
                      ...r,
                      __rowId: String(i),
                    }))}
                    columns={Object.keys(execResult.rows[0] as object).map((col) => ({
                      id: col,
                      header: col,
                      accessor: (r: Record<string, unknown>) => r[col] as string | number | null,
                      cell: (r: Record<string, unknown>) => (
                        <span className="font-mono text-xs text-slate-300">
                          {r[col] == null ? '' : String(r[col])}
                        </span>
                      ),
                    }))}
                    rowKey={(r) => String(r.__rowId ?? '')}
                    storageKey="api-sql-result"
                    searchPlaceholder="Netijede gözle..."
                    emptyMessage="Setir ýok"
                  />
                ) : (
                  <p className="p-4 text-sm text-slate-500">Netije boş</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      </ModalPortal>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {selectedTenantSlug && (
            <button
              type="button"
              onClick={() => setSelectedTenantSlug(null)}
              className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 mb-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Firmalara dolan
            </button>
          )}
          <h1 className="text-base sm:text-2xl font-bold text-white truncate leading-tight">
            {selectedTenantSlug ? `${selectedTenantName} — API-lar` : 'API-lar · Firmalar'}
          </h1>
          <p className="text-slate-400 text-[11px] sm:text-sm mt-0.5 truncate leading-snug">
            {selectedTenantSlug
              ? 'Doly URL · basyp aç · copy'
              : 'Ilki firma saýlaň — soň bagly API-lar'}
            {syncedAt && (
              <span className="text-slate-500">
                {' '}
                · {fromCache ? 'keş' : 'janly'} · {formatDate(syncedAt)}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              load(true);
              toastInfo('Catalog täzelendi');
            }}
            loading={loading}
          >
            <RefreshCw className="h-4 w-4" />
            Sync
          </Button>
          {selectedTenantSlug && (
            <Button size="sm" onClick={() => openCreate(selectedTenantSlug)}>
              <Plus className="h-4 w-4" />
              Täze API
            </Button>
          )}
        </div>
      </div>

      {!selectedTenantSlug ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tenants.length === 0 && !loading ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center text-slate-400 text-sm">
              Firma ýok. Catalog sync ediň ýa-da tenant goşuň.
            </div>
          ) : (
            tenants.map((tn) => {
              const count = tenantCounts.get(tn.slug) || 0;
              return (
                <button
                  key={tn.slug}
                  type="button"
                  onClick={() => setSelectedTenantSlug(tn.slug)}
                  className="group text-left rounded-2xl border border-slate-700/80 bg-slate-900/70 hover:border-indigo-500/50 hover:bg-slate-900 p-5 transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-violet-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white truncate group-hover:text-violet-200">{tn.name}</h3>
                        <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-violet-400 shrink-0" />
                      </div>
                      <p className="text-xs text-slate-500 mt-1 truncate">{tn.slug}</p>
                      <p className="text-xs text-slate-400 mt-2">{count} API</p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={visibleEndpoints}
          rowKey={(r) => r.id}
          storageKey="bi-apis"
          searchPlaceholder="Gözle: ady, path..."
          emptyMessage={loading ? 'Ýüklenýär...' : 'Bu firma üçin endpoint ýok — «Täze API» bilen goşuň'}
          onRowClick={openEdit}
        />
      )}
    </div>
  );
}

export default function ApisPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 text-sm">API-lar ýüklenýär…</div>}>
      <ApisPageInner />
    </Suspense>
  );
}
