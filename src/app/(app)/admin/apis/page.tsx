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
  const [saving, setSaving] = useState(false);

  function openEdit(e: Endpoint) {
    setEditEp(e);
    setEditName(e.name);
    setEditPath(e.pathTemplate);
    setEditMethod(e.method);
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Saklamak şowsuz', data.error);
        return;
      }
      toastSuccess('API üýtgedildi', 'VPS-e ýazyldy');
      setEditEp(null);
      await load(true);
    } finally {
      setSaving(false);
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
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
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
            <div className="flex gap-2">
              <Button className="flex-1" loading={saving} onClick={saveEdit}>
                Ýatda sakla · Sync
              </Button>
              <Button variant="ghost" onClick={() => setEditEp(null)}>
                Ýatyr
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}