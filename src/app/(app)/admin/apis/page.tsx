'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Copy, ExternalLink, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/utils';
import { toastSuccess, toastInfo, toastError } from '@/components/ui/Toast';
import { buildFullApiUrl } from '@/lib/api-url';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

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
    setEditEp(e);
    setEditName(e.name);
    setEditPath(e.pathTemplate);
    setEditMethod(e.method);
    setEditSql(e.sqlQuery || '');
    setExecResult(null);
  }

  async function saveEdit() {
    if (!editEp) return;
    setSaving(true);
    try {
      const res = await fetch('/api/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editEp.id,
          tenantSlug: editEp.tenantSlug,
          name: editName,
          pathTemplate: editPath,
          method: editMethod,
          dbKey: editEp.dbKey || 'primary',
          sqlQuery: editSql,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Saklamak şowsuz', data.error || data.message);
        return;
      }
      toastSuccess('API üýtgedildi', 'VPS-e ýazyldy (SQL bilen)');
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
      </div>

      <DataTable
        columns={columns}
        rows={endpoints}
        rowKey={(r) => r.id}
        storageKey="bi-apis"
        searchPlaceholder="Gözle: ady, path, slug..."
        emptyMessage={loading ? 'Ýüklenýär...' : 'Endpoint ýok — Electron-dan VPS-e sync ediň'}
        onRowClick={openEdit}
      />

      {editEp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditEp(null)} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
            <h3 className="text-lg font-semibold text-white text-center">API üýtget</h3>
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
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">SQL Query (VPS-de saklanýar)</label>
              <textarea
                className="w-full min-h-[160px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-emerald-300 outline-none focus:ring-1 focus:ring-indigo-500/50"
                value={editSql}
                onChange={(e) => setEditSql(e.target.value)}
                spellCheck={false}
                placeholder="SELECT ..."
              />
            </div>
            {execResult && (
              <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 max-h-48 overflow-auto">
                {execResult.ok ? (
                  <>
                    <p className="text-[11px] text-emerald-400 mb-2">
                      {execResult.rowCount ?? 0} setir
                      {execResult.elapsedMs != null ? ` · ${execResult.elapsedMs}ms` : ''}
                    </p>
                    <pre className="text-[10px] font-mono text-slate-300 whitespace-pre-wrap break-all">
                      {JSON.stringify(execResult.rows?.slice?.(0, 20) ?? execResult.rows, null, 2)}
                    </pre>
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
              <Button variant="ghost" onClick={() => { setEditEp(null); setExecResult(null); }}>
                Ýatyr
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}