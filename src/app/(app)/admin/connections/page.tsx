'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, Plus, Pencil, Trash2, RefreshCw, Server, Activity } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { toastSuccess, toastError } from '@/components/ui/Toast';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

interface ConnRow {
  id: string;
  tenantSlug: string;
  tenantName: string;
  dbKey: string;
  label: string;
  database: string;
  host: string;
  port: number;
  username: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  isPrimary?: boolean;
  hasPassword?: boolean;
  devices?: { id: string; name: string; status: string; hostname?: string }[];
}

interface TenantOpt {
  slug: string;
  name: string;
}

const DB_TYPES = [
  { value: 'mssql', label: 'Microsoft SQL Server', port: 1433, ready: true },
  { value: 'postgresql', label: 'PostgreSQL (ýakynada)', port: 5432, ready: false },
  { value: 'mongodb', label: 'MongoDB (ýakynada)', port: 27017, ready: false },
  { value: 'excel', label: 'MS Excel (ýakynada)', port: 0, ready: false },
] as const;

const emptyForm = {
  tenantSlug: '',
  label: '',
  database: '',
  host: '',
  port: 1433,
  username: '',
  password: '',
  encrypt: true,
  trustServerCertificate: true,
  isPrimary: false,
  dbType: 'mssql' as string,
};

export default function ConnectionsPage() {
  const [list, setList] = useState<ConnRow[]>([]);
  const [tenants, setTenants] = useState<TenantOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<ConnRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [dbList, setDbList] = useState<string[]>([]);
  const [loadingDbs, setLoadingDbs] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/connections');
      const data = await res.json();
      if (!res.ok) {
        toastError('Ýüklenmedi', data.error);
        setList([]);
        return;
      }
      setList(data.connections || []);
      setTenants(
        (data.tenants || []).map((t: any) => ({ slug: t.slug, name: t.name }))
      );
    } catch (e) {
      toastError('Ýüklenmedi', String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const [testingId, setTestingId] = useState<string | null>(null);

  async function testConn(row: ConnRow) {
    setTestingId(row.id);
    try {
      const res = await fetch('/api/admin-test-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: row.tenantSlug,
          sqlQuery: 'SELECT 1 AS ok',
          dbKey: row.dbKey || 'primary',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Baglanyşyk şowsuz', data.error || 'Device offline ýa-da DB ýalňyş');
        return;
      }
      toastSuccess(
        'Baglanyşyk OK',
        `${row.label || row.dbKey} · device üstünden · ${data.elapsedMs ?? '?'}ms`
      );
    } catch (e) {
      toastError('Baglanyşyk şowsuz', String(e));
    } finally {
      setTestingId(null);
    }
  }


  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      tenantSlug: tenants[0]?.slug || '',
      dbType: 'mssql',
    });
    setDbList([]);
    setModal(true);
  }

  function openEdit(c: ConnRow) {
    setEditing(c);
    setForm({
      tenantSlug: c.tenantSlug,
      label: c.label || c.dbKey,
      database: c.database || '',
      host: c.host || '',
      port: c.port || 1433,
      username: c.username || '',
      password: '',
      encrypt: c.encrypt !== false,
      trustServerCertificate: c.trustServerCertificate !== false,
      isPrimary: Boolean(c.isPrimary),
      dbType: (c as any).dbType || 'mssql',
    });
    setDbList(c.database ? [c.database] : []);
    setModal(true);
  }

  async function fetchDatabases() {
    if (!form.tenantSlug) {
      toastError('Firma gerek', 'Ilki firma saýlaň');
      return;
    }
    if (form.dbType !== 'mssql') {
      toastError('Goldanmaýar', 'Häzirlikçe diňe MSSQL üçin database sanawy elýeterli');
      return;
    }
    // Existing connection: use test-query through agent
    if (!editing?.id && !form.host.trim()) {
      toastError('Host gerek', 'Host / username dolduryň');
      return;
    }
    setLoadingDbs(true);
    try {
      const res = await fetch('/api/admin-test-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: form.tenantSlug,
          dbKey: editing?.dbKey || 'primary',
          sqlQuery:
            "SELECT name FROM sys.databases WHERE state = 0 AND name NOT IN ('master','tempdb','model','msdb') ORDER BY name",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError(
          'Database sanawy alynmady',
          data.error ||
            'Baglanyşyk heniz saklanmadyk ýa-da device offline. Ilki saklap, soňra barlaň.'
        );
        return;
      }
      const rows = (data.rows || []) as { name?: string }[];
      const names = rows.map((r) => r.name).filter(Boolean) as string[];
      if (names.length === 0) {
        toastError('Database ýok', 'Serwerde elýeterli database tapylmady');
        setDbList([]);
        return;
      }
      setDbList(names);
      if (!form.database && names[0]) {
        setForm((f) => ({ ...f, database: names[0] }));
      }
      toastSuccess('Database-ler', `${names.length} sany tapyldy`);
    } catch (e) {
      toastError('Database sanawy', String(e));
    } finally {
      setLoadingDbs(false);
    }
  }

  async function save() {
    if (!form.tenantSlug || !form.host.trim()) {
      toastError('Zerur', 'Firma we host gerek');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing?.id,
          tenantSlug: form.tenantSlug,
          label: form.label,
          database: form.database,
          host: form.host.trim(),
          port: Number(form.port) || 1433,
          username: form.username,
          password: form.password || undefined,
          encrypt: form.encrypt,
          trustServerCertificate: form.trustServerCertificate,
          isPrimary: form.isPrimary,
          dbType: form.dbType || 'mssql',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Saklamak şowsuz', data.error);
        return;
      }
      toastSuccess('Baglanyşyk saklandy', 'VPS + Electron sync');
      setModal(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: ConnRow) {
    const ok = await confirmDialog({
      title: 'Baglanyşygy poz',
      message: `«${c.label || c.dbKey}» (${c.tenantName}) pozmak isleýärsiňizmi?`,
      confirmLabel: 'Poz',
      danger: true,
    });
    if (!ok) return;
    const res = await fetch('/api/connections', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, tenantSlug: c.tenantSlug, dbKey: c.dbKey }),
    });
    const data = await res.json();
    if (!res.ok) {
      toastError('Pozup bolmady', data.error);
      return;
    }
    toastSuccess('Pozuldy');
    await load();
  }

  const columns = useMemo<DataTableColumn<ConnRow>[]>(
    () => [
      {
        id: 'tenant',
        header: 'Firma',
        mobilePrimary: true,
        accessor: (r) => r.tenantName,
        cell: (r) => (
          <span className="font-medium text-white inline-flex items-center gap-2">
            <Database className="h-4 w-4 text-sky-400" />
            {r.tenantName}
            <span className="text-[10px] font-mono text-slate-500">{r.tenantSlug}</span>
          </span>
        ),
      },
      {
        id: 'label',
        header: 'Label / Key',
        accessor: (r) => r.label || r.dbKey,
        cell: (r) => (
          <span className="font-mono text-xs">
            {r.label || r.dbKey}
            {r.isPrimary ? (
              <span className="ml-2 text-[10px] text-emerald-400">primary</span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'host',
        header: 'Host',
        accessor: (r) => `${r.host}:${r.port}`,
        cell: (r) => (
          <span className="font-mono text-[11px] text-slate-300">
            {r.host || '—'}:{r.port || 1433}
          </span>
        ),
      },
      {
        id: 'database',
        header: 'Database',
        accessor: (r) => r.database,
      },
      {
        id: 'devices',
        header: 'Devices',
        accessor: (r) => (r.devices || []).map((d) => d.name).join(', '),
        cell: (r) =>
          (r.devices || []).length === 0 ? (
            <span className="text-slate-500 text-xs">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {(r.devices || []).map((d) => (
                <span
                  key={d.id}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300"
                  title={d.hostname}
                >
                  <Server className="h-3 w-3 text-amber-400" />
                  {d.name}
                </span>
              ))}
            </div>
          ),
      },
      {
        id: 'actions',
        header: 'Amal',
        accessor: () => '',
        cell: (r) => (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              title="Device üstünden DB barla"
              disabled={testingId === r.id}
              onClick={() => void testConn(r)}
            >
              <Activity className={`h-3.5 w-3.5 ${testingId === r.id ? 'animate-pulse text-emerald-400' : ''}`} />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-rose-400"
              onClick={() => void remove(r)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [tenants, testingId]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Database baglanyşyklary</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Her firmanyň MSSQL baglanyşyklary · VPS-de saklanýar · Electron bilen sync
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => load()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Goş
          </Button>
        </div>
      </div>

      <DataTable
        rows={list}
        columns={columns}
        rowKey={(r) => `${r.tenantSlug}:${r.id}`}
        storageKey="bi-connections"
        searchPlaceholder="Gözle: firma, host, db..."
        emptyMessage={loading ? 'Ýüklenýär...' : 'Baglanyşyk ýok'}
      />

      {modal && (
        <ModalPortal open={Boolean(modal)}>
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModal(false)} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3">
            <h3 className="text-lg font-semibold text-white text-center">
              {editing ? 'Baglanyşygy üýtget' : 'Täze baglanyşyk'}
            </h3>
            <Select
              label="Firma"
              value={form.tenantSlug}
              onChange={(e) => setForm((f) => ({ ...f, tenantSlug: e.target.value }))}
              options={tenants.map((t) => ({ value: t.slug, label: `${t.name} (${t.slug})` }))}
              disabled={!!editing}
            />
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Database görnüşi</label>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500/50"
                value={form.dbType}
                onChange={(e) => {
                  const t = DB_TYPES.find((d) => d.value === e.target.value);
                  setForm((f) => ({
                    ...f,
                    dbType: e.target.value,
                    port: t && t.port ? t.port : f.port,
                  }));
                  setDbList([]);
                }}
              >
                {DB_TYPES.map((d) => (
                  <option key={d.value} value={d.value} disabled={!d.ready}>
                    {d.label}
                  </option>
                ))}
              </select>
              {form.dbType !== 'mssql' && (
                <p className="text-[11px] text-amber-400/90">Bu görnüş ýakynada goşular — häzir diňe MSSQL işjeň.</p>
              )}
            </div>
            <Input
              label="Label"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="primary"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Host"
                value={form.host}
                onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
              />
              <Input
                label="Port"
                type="number"
                value={String(form.port)}
                onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) || 1433 }))}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs text-slate-400">Database</label>
                <button
                  type="button"
                  onClick={() => void fetchDatabases()}
                  disabled={loadingDbs}
                  className="text-[11px] px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 disabled:opacity-50"
                >
                  {loadingDbs ? 'Barlanýar…' : 'Database-leri barla'}
                </button>
              </div>
              {dbList.length > 0 ? (
                <select
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500/50"
                  value={form.database}
                  onChange={(e) => setForm((f) => ({ ...f, database: e.target.value }))}
                >
                  <option value="">— saýlaň —</option>
                  {dbList.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={form.database}
                  onChange={(e) => setForm((f) => ({ ...f, database: e.target.value }))}
                  placeholder="Ilki maglumatlary dolduryň, soň «Database-leri barla»"
                />
              )}
              <p className="text-[10px] text-slate-500">
                Host, username, password dolduryp saklaň → soňra «Database-leri barla» bilen bar bolan DB-lerden saýlaň.
              </p>
            </div>
            <Input
              label="Username"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            />
            <Input
              label={editing ? 'Password (boş = üýtgetme)' : 'Password'}
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <label className="flex items-center justify-between text-sm text-slate-200">
              <span>Encrypt</span>
              <input
                type="checkbox"
                checked={form.encrypt}
                onChange={(e) => setForm((f) => ({ ...f, encrypt: e.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between text-sm text-slate-200">
              <span>Trust server certificate</span>
              <input
                type="checkbox"
                checked={form.trustServerCertificate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, trustServerCertificate: e.target.checked }))
                }
              />
            </label>
            <label className="flex items-center justify-between text-sm text-slate-200">
              <span>Primary</span>
              <input
                type="checkbox"
                checked={form.isPrimary}
                onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
              />
            </label>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" loading={saving} onClick={save}>
                Ýatda sakla · Sync
              </Button>
              <Button variant="ghost" onClick={() => setModal(false)}>
                Ýatyr
              </Button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}

