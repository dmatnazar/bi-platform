'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Copy, ExternalLink, Check, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/utils';
import { toastSuccess, toastInfo, toastError } from '@/components/ui/Toast';
import { buildFullApiUrl } from '@/lib/api-url';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SqlCodeEditor } from '@/components/sql/SqlCodeEditor';

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

interface Tenant {
  id: string;
  slug: string;
  name: string;
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
  const [sqlStudio, setSqlStudio] = useState(false);
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

  function openEdit(e: Endpoint) {
    setSqlStudio(false);
    setIsCreate(false);
    setEditEp(e);
    setEditName(e.name);
    setEditPath(e.pathTemplate);
    setEditMethod(e.method);
    setEditSql(e.sqlQuery || '');
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
    setEditParams(rows);
    setExecResult(null);
  }

  function openCreate() {
    setSqlStudio(false);
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
    setEditDbKey('primary');
    setEditCache(0);
    setEditAuth(true);
    setEditTenantSlug(slug);
    setEditParams([]);
    setExecResult(null);
  }

  function closeEdit() {
    setEditEp(null);
    setSqlStudio(false);
    setExecResult(null);
    setIsCreate(false);
  }

  async function saveEdit() {
    if (!editEp) return;
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
      setEditEp(null);
      await load(true);
    } finally {
      setSaving(false);
    }
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
        toastError('Execute şowsuz', data.error);
        return;
      }
      setExecResult({
        ok: true,
        rows: data.rows || [],
        rowCount: data.rowCount ?? (data.rows?.length || 0),
        elapsedMs: data.elapsedMs,
      });
      toastSuccess('Execute OK', `${data.rowCount ?? data.rows?.length ?? 0} setir`);
    } catch (e: any) {
      setExecResult({ ok: false, error: String(e) });
      toastError('Execute şowsuz', String(e));
    } finally {
      setExecuting(false);
    }
  }

  async function deleteEp(e: Endpoint) {
    if (!confirm(`«${e.name}» (${e.method} ${e.pathTemplate}) pozulsynmy?`)) return;
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
              className="px-2 py-1 text-[10px] rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10"
            >
              Üýtget
            </button>
            <button
              type="button"
              onClick={() => void deleteEp(r)}
              className="px-2 py-1 text-[10px] rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10"
            >
              Poz
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

      {editEp && !sqlStudio && (
        <ModalPortal open={Boolean(editEp && !sqlStudio)}>
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="absolute inset-0 bg-black/60" onClick={closeEdit} />
          <div className="relative w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4 animate-in slide-in-from-bottom-4 duration-200">
            <h3 className="text-lg font-semibold text-white text-center">
              {isCreate ? 'Täze API' : 'API üýtget'}
            </h3>
            {isCreate && (
              <Select
                label="Firma *"
                value={editTenantSlug}
                onChange={(e) => {
                  setEditTenantSlug(e.target.value);
                  setEditEp((ep) => (ep ? { ...ep, tenantSlug: e.target.value } : ep));
                }}
                options={tenants.map((t) => ({ value: t.slug, label: `${t.name} (${t.slug})` }))}
              />
            )}
            <Input label="Ady" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <Select
              label="Method"
              value={editMethod}
              onChange={(e) => setEditMethod(e.target.value)}
              options={[
                { value: 'GET', label: 'GET' },
                { value: 'POST', label: 'POST' },
                { value: 'PUT', label: 'PUT' },
                { value: 'DELETE', label: 'DELETE' },
              ]}
            />
            <Input
              label="Path template"
              value={editPath}
              onChange={(e) => setEditPath(e.target.value)}
              placeholder="/orders"
            />
            <p className="text-[10px] font-mono text-slate-500 break-all">
              {buildFullApiUrl({
                gatewayBase: gatewayBase || 'http://localhost:4000',
                tenantSlug: editEp.tenantSlug,
                pathTemplate: editPath,
                dbKey: editEp.dbKey || 'primary',
              })}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input label="DB key" value={editDbKey} onChange={(e) => setEditDbKey(e.target.value)} placeholder="primary" />
              <Input
                label="Cache TTL (sek)"
                type="number"
                value={String(editCache)}
                onChange={(e) => setEditCache(Number(e.target.value) || 0)}
              />
              <label className="flex items-end gap-2 pb-2 text-sm text-slate-300">
                <input type="checkbox" checked={editAuth} onChange={(e) => setEditAuth(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
                Auth required
              </label>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-700/80 p-3">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">Parametrler (query / url / body)</label>
                <button
                  type="button"
                  className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                  onClick={() =>
                    setEditParams((p) => [
                      ...p,
                      { name: '', type: 'string', required: false, source: 'query' },
                    ])
                  }
                >
                  + Parametr
                </button>
              </div>
              {editParams.length === 0 && (
                <p className="text-[11px] text-slate-500">Parametr ýok — SQL-de @name ulansa goşuň</p>
              )}
              {editParams.map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                  <input
                    className="col-span-3 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                    placeholder="ady"
                    value={row.name}
                    onChange={(e) =>
                      setEditParams((ps) =>
                        ps.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x))
                      )
                    }
                  />
                  <select
                    className="col-span-2 rounded border border-slate-700 bg-slate-950 px-1 py-1.5 text-xs text-white"
                    value={row.type}
                    onChange={(e) =>
                      setEditParams((ps) =>
                        ps.map((x, i) => (i === idx ? { ...x, type: e.target.value } : x))
                      )
                    }
                  >
                    {['string', 'int', 'bigint', 'float', 'date', 'datetime', 'bit'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <select
                    className="col-span-2 rounded border border-slate-700 bg-slate-950 px-1 py-1.5 text-xs text-white"
                    value={row.source}
                    onChange={(e) =>
                      setEditParams((ps) =>
                        ps.map((x, i) =>
                          i === idx ? { ...x, source: e.target.value as ParamRow['source'] } : x
                        )
                      )
                    }
                  >
                    <option value="query">query</option>
                    <option value="url">url</option>
                    <option value="body">body</option>
                  </select>
                  <label className="col-span-3 flex items-center gap-1 text-[11px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={row.required}
                      onChange={(e) =>
                        setEditParams((ps) =>
                          ps.map((x, i) => (i === idx ? { ...x, required: e.target.checked } : x))
                        )
                      }
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    className="col-span-2 text-rose-400 hover:text-rose-300 text-xs flex justify-end"
                    onClick={() => setEditParams((ps) => ps.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">SQL Query</label>
                <button
                  type="button"
                  onClick={() => setSqlStudio(true)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 border border-indigo-500/30"
                >
                  SQL Studio · uly redaktor
                </button>
              </div>
              <textarea
                className="w-full min-h-[100px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-emerald-300 outline-none focus:ring-1 focus:ring-indigo-500/50"
                value={editSql}
                onChange={(e) => setEditSql(e.target.value)}
                spellCheck={false}
                placeholder="SELECT ..."
                readOnly
                onClick={() => setSqlStudio(true)}
              />
            </div>
            {execResult && (
              <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 max-h-72 overflow-auto">
                {execResult.ok ? (
                  <>
                    <p className="text-[11px] text-emerald-400 mb-2">
                      {execResult.rowCount ?? 0} setir
                      {execResult.elapsedMs != null ? ` · ${execResult.elapsedMs}ms` : ''}
                      {(execResult.rows?.length || 0) > 100 ? ' · ilkinji 100 görkezilýär' : ''}
                    </p>
                    {Array.isArray(execResult.rows) && execResult.rows.length > 0 && typeof execResult.rows[0] === 'object' && execResult.rows[0] !== null ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-[11px] border-collapse">
                          <thead>
                            <tr className="border-b border-slate-700 text-left text-slate-400">
                              {Object.keys(execResult.rows[0] as Record<string, unknown>).map((col) => (
                                <th key={col} className="px-2 py-1.5 font-medium whitespace-nowrap sticky top-0 bg-slate-950">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(execResult.rows as Record<string, unknown>[]).slice(0, 100).map((row, i) => (
                              <tr key={i} className="border-b border-slate-800/80 hover:bg-slate-900/80">
                                {Object.keys(execResult.rows![0] as Record<string, unknown>).map((col) => {
                                  const v = row[col];
                                  const display =
                                    v === null || v === undefined
                                      ? ''
                                      : typeof v === 'object'
                                        ? JSON.stringify(v)
                                        : String(v);
                                  return (
                                    <td key={col} className="px-2 py-1 font-mono text-slate-300 whitespace-nowrap max-w-[240px] truncate" title={display}>
                                      {display}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <pre className="text-[10px] font-mono text-slate-300 whitespace-pre-wrap break-all">
                        {JSON.stringify(execResult.rows?.slice?.(0, 20) ?? execResult.rows, null, 2)}
                      </pre>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-rose-400">{execResult.error}</p>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button className="flex-1" loading={saving} onClick={saveEdit}>
                Ýatda sakla · Sync
              </Button>
              <Button variant="secondary" loading={executing} onClick={executeSql}>
                Execute
              </Button>
              <Button variant="ghost" onClick={closeEdit}>
                Ýatyr
              </Button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {sqlStudio && editEp && (
        <ModalPortal open={Boolean(sqlStudio)}>
        <div className="fixed inset-0 z-[310] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSqlStudio(false)} />
          <div className="relative w-full max-w-5xl max-h-[94vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/90">
              <div>
                <h3 className="text-base font-semibold text-white">SQL Studio</h3>
                <p className="text-[11px] text-slate-500 font-mono truncate">
                  {editMethod} {editPath} · {editEp.tenantSlug}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" loading={executing} onClick={executeSql}>
                  Execute
                </Button>
                <Button size="sm" onClick={() => setSqlStudio(false)}>
                  Taýýar
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-0 grid grid-rows-2 lg:grid-rows-1 lg:grid-cols-2">
              <div className="relative flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 min-h-[280px] lg:min-h-0">
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-800/80 flex items-center justify-between">
                  <span>Query · SQL Studio</span>
                  <span className="normal-case text-slate-600">Ctrl+Space autocomplete</span>
                </div>
                <div className="flex-1 min-h-[240px] relative">
                  <SqlCodeEditor value={editSql} onChange={setEditSql} height="100%" autoFocus />
                </div>
              </div>
              <div className="flex flex-col min-h-[180px] overflow-hidden">
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-800/80">
                  Netije
                  {execResult?.ok && (
                    <span className="ml-2 normal-case text-emerald-400">
                      {execResult.rowCount ?? 0} setir
                      {execResult.elapsedMs != null ? ` · ${execResult.elapsedMs}ms` : ''}
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-auto p-2">
                  {execResult?.ok && Array.isArray(execResult.rows) && execResult.rows.length > 0 && typeof execResult.rows[0] === 'object' ? (
                    <table className="min-w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-700 text-left text-slate-400">
                          {Object.keys(execResult.rows[0] as object).map((col) => (
                            <th key={col} className="px-2 py-1.5 font-medium whitespace-nowrap sticky top-0 bg-slate-950">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(execResult.rows as Record<string, unknown>[]).slice(0, 200).map((row, i) => (
                          <tr key={i} className="border-b border-slate-800/80">
                            {Object.keys(execResult.rows![0] as object).map((col) => {
                              const v = row[col];
                              const d = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
                              return (
                                <td key={col} className="px-2 py-1 font-mono text-slate-300 whitespace-nowrap max-w-[200px] truncate" title={d}>{d}</td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : execResult && !execResult.ok ? (
                    <p className="text-sm text-rose-400 p-2">{execResult.error}</p>
                  ) : (
                    <p className="text-xs text-slate-600 p-2">Execute basyň — netije şu ýerde tablisa görnüşinde çykar</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}