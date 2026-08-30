'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Copy, ExternalLink, Check, Plus, Trash2, Pencil, ArrowLeft, Play, ClipboardPaste, Scissors, Eraser, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/utils';
import { toastSuccess, toastInfo, toastError } from '@/components/ui/Toast';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { buildFullApiUrl } from '@/lib/api-url';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SqlCodeEditor, preloadSqlEditor } from '@/components/sql/SqlCodeEditor';

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
  authRequired?: boolean;
}

interface TenantConnection {
  dbKey: string;
  label?: string;
  database?: string;
}

interface Tenant {
  id: string;
  slug: string;
  name: string;
  connections?: TenantConnection[];
}

export default function ApisPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [syncedAt, setSyncedAt] = useState('');
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gatewayBase, setGatewayBase] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

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
  const [editCache, setEditCache] = useState(0);
  const [editAuth, setEditAuth] = useState(true);
  const [isCreate, setIsCreate] = useState(false);
  type ParamRow = { name: string; type: string; required: boolean; source: 'query' | 'url' | 'body' };
  const [editParams, setEditParams] = useState<ParamRow[]>([]);
  const [editTenantSlug, setEditTenantSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<{
    ok?: boolean;
    rows?: unknown[];
    rowCount?: number;
    elapsedMs?: number;
    error?: string;
  } | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);


  function pathFromName(name: string) {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
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

  function autoCompleteParams() {
    const next = mergeParamsFromSql(editSql, editParams);
    const added = next.length - editParams.length;
    setEditParams(next);
    toastSuccess('Auto params', added > 0 ? `${added} parametr goşuldy` : 'Täze ýok / eýýäm doly');
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
  }

  function openCreate() {
    void preloadSqlEditor();
    setIsCreate(true);
    const slug = tenants[0]?.slug || '';
    setEditEp({
      id: '',
      tenantSlug: slug,
      name: '',
      method: 'GET',
      pathTemplate: '/report',
      dbKey: 'primary',
      sqlQuery: 'SELECT 1 AS ok',
      authRequired: true,
      cacheTtlSec: 0,
    });
    setEditName('');
    setEditPath('/report');
    setEditMethod('GET');
    setEditSql('SELECT 1 AS ok');
    // params empty for new
    setEditDbKey('primary');
    setEditCache(0);
    setEditAuth(true);
    setEditTenantSlug(slug);
    setEditParams([]);
    setExecResult(null);
  }

  function closeEdit() {
    setEditEp(null);
    setExecResult(null);
    setShowResultModal(false);
    setIsCreate(false);
    try { document.body.style.overflow = ''; } catch { /* */ }
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
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Saklamak şowsuz', data.error || data.message);
        return;
      }
      toastSuccess(isCreate ? 'API goşuldy' : 'API üýtgedildi', 'VPS-e ýazyldy · Electron catalog-dan görer');
      closeEdit();
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
    let s = editSql || '';
    // simple SQL beautify
    s = s.replace(/\s+/g, ' ').trim();
    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
      'JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'INSERT INTO', 'VALUES',
      'UPDATE', 'SET', 'DELETE FROM', 'UNION', 'LIMIT', 'OFFSET',
    ];
    for (const kw of keywords) {
      const re = new RegExp('\\b' + kw.replace(' ', '\\s+') + '\\b', 'gi');
      s = s.replace(re, '\n' + kw);
    }
    s = s.replace(/,\s*/g, ',\n  ');
    setEditSql(s.trim() + '\n');
    toastSuccess('Beautify');
  }

  async function executeSql() {
    if (!editEp || !editSql.trim()) {
      toastError('SQL boş', 'Query ýazyň');
      return;
    }
    setExecuting(true);
    setExecResult(null);
    try {
      const res = await fetch('/api/admin-test-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: editEp.tenantSlug,
          sqlQuery: editSql,
          dbKey: editEp.dbKey || 'primary',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExecResult({ ok: false, error: data.error || 'şowsuz' });
        setShowResultModal(true);
        toastError('Execute şowsuz', data.error);
        return;
      }
      setExecResult({
        ok: true,
        rows: data.rows || [],
        rowCount: data.rowCount ?? (data.rows?.length || 0),
        elapsedMs: data.elapsedMs,
      });
      setShowResultModal(true);
      toastSuccess('Execute OK', `${data.rowCount ?? data.rows?.length ?? 0} setir`);
    } catch (e: any) {
      setExecResult({ ok: false, error: String(e) });
      toastError('Execute şowsuz', String(e));
    } finally {
      setExecuting(false);
    }
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
            <h1 className="text-lg font-semibold text-white truncate">
              {isCreate ? 'Täze API' : editName || editEp.name || 'API üýtget'}
            </h1>
            <p className="text-xs text-slate-500 font-mono truncate">
              {editMethod} /api/v1/{editTenantSlug || editEp.tenantSlug}/{editDbKey || 'primary'}/
              {(editPath || '').replace(/^\//, '')}
            </p>
          </div>
          <div className="flex items-center gap-2">
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
            <Button variant="secondary" size="sm" onClick={closeEdit}>
              Ýatyr
            </Button>
            <Button size="sm" loading={saving} onClick={() => void saveEdit()}>
              Sakla
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
            {/* Left: meta */}
            <div className="space-y-4 lg:col-span-3 overflow-y-auto max-h-[calc(100vh-5rem)]">
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
                    const firstConn = tn?.connections?.[0]?.dbKey;
                    setEditDbKey(firstConn || 'primary');
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
                      if (isCreate) setEditPath(pathFromName(v));
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
                            setEditDbKey(e.target.value);
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
                            onChange={(e) => setEditDbKey(e.target.value)}
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
                <div className="flex items-end pb-2">
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
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {editParams.map((pr, i) => (
                    <div key={i} className="flex flex-wrap gap-2 items-center text-xs">
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
                      >
                        <option value="url">url</option>
                        <option value="query">query</option>
                        <option value="body">body</option>
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
                  ))}
                </div>
              </div>
            </div>

                        {/* Right: SQL ~80% */}
            <div className="flex flex-col lg:col-span-9 min-h-0" style={{ height: 'min(80vh, calc(100vh - 5.5rem))' }}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <label className="text-xs text-slate-400 mr-auto">SQL query</label>
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
                <Button size="sm" variant="secondary" loading={executing} onClick={() => void executeSql()}>
                  <Play className="h-3.5 w-3.5" />
                  Run
                </Button>
              </div>
              <div className="relative flex-1 rounded-xl border border-slate-700 overflow-hidden bg-slate-950 min-h-[50vh]">
                <SqlCodeEditor
                  value={editSql}
                  onChange={(v) => {
                    setEditSql(v);
                    setEditParams((prev) => mergeParamsFromSql(v, prev));
                  }}
                  height="100%"
                />
              </div>
            </div>
          </div>
        </div>

        {showResultModal && execResult && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/90" onClick={() => setShowResultModal(false)} />
            <div className="relative w-full max-w-6xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden">
              <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900">
                <h3 className="text-sm font-semibold text-white flex-1">
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
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
                  onClick={() => setShowResultModal(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-auto p-3">
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
          <h1 className="text-2xl font-bold text-white">API-lar</h1>
          <p className="text-slate-400 text-sm mt-1">
            Doly URL · basyp aç · copy
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
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Täze API
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={endpoints}
        rowKey={(r) => r.id}
        storageKey="bi-apis"
        searchPlaceholder="Gözle: ady, path, slug..."
        emptyMessage={loading ? 'Ýüklenýär...' : 'Endpoint ýok — «Täze API» bilen goşuň'}
        onRowClick={openEdit}
      />
    </div>
  );
}