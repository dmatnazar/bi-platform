'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toastSuccess, toastError } from '@/components/ui/Toast';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

interface LedgerEntry {
  id: string;
  tenantSlug: string;
  type: string;
  amount: number;
  balanceAfter: number;
  reason?: string;
  createdAt: string;
  createdBy?: string;
  username?: string;
  user?: string;
  deviceId?: string;
  deviceName?: string;
  device?: string;
  meta?: Record<string, unknown>;
}

function displayUser(e: LedgerEntry): string {
  const meta = e.meta || {};
  const candidates = [
    meta.fullName,
    meta.displayName,
    meta.userName,
    meta.username,
    e.username,
    e.user,
    meta.login,
    e.createdBy,
  ];
  for (const c of candidates) {
    if (c == null || c === '') continue;
    const s = String(c);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) continue;
    if (/^[0-9a-f]{24}$/i.test(s)) continue;
    return s;
  }
  return '—';
}

function displayDevice(e: LedgerEntry): string {
  const meta = e.meta || {};
  const candidates = [
    e.deviceName,
    meta.deviceName,
    meta.deviceLabel,
    e.device,
    meta.device,
    e.deviceId,
    meta.deviceId,
  ];
  for (const c of candidates) {
    if (c == null || c === '') continue;
    const s = String(c);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) continue;
    return s.length > 48 ? s.slice(0, 46) + '…' : s;
  }
  return '—';
}

export default function BillingLedgerPage() {
  const [rows, setRows] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing?action=ledger&limit=500');
      const data = await res.json();
      const list = data.entries || data.ledger || data.rows || data.items || [];
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      toastError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tenants = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.tenantSlug) s.add(r.tenantSlug);
    return [...s].sort();
  }, [rows]);

  const types = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.type) s.add(r.type);
    return [...s].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((e) => {
      if (typeFilter && e.type !== typeFilter) return false;
      if (tenantFilter && e.tenantSlug !== tenantFilter) return false;
      if (!qq) return true;
      const blob = [
        e.tenantSlug,
        e.type,
        e.reason,
        displayUser(e),
        displayDevice(e),
        e.createdAt,
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(qq);
    });
  }, [rows, q, typeFilter, tenantFilter]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  }

  async function deleteSelected() {
    if (!selected.size) return;
    const ok = await confirmDialog({
      title: 'Loglary poz',
      message: `${selected.size} sany hereket pozular. Dowam edilsinmi?`,
      confirmLabel: 'Poz',
      cancelLabel: 'Ýatyr',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-ledger', ids: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pozup bolmady');
      toastSuccess('Pozuldy');
      setSelected(new Set());
      await load();
    } catch (e) {
      toastError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteOne(id: string) {
    const ok = await confirmDialog({
      title: 'Logy poz',
      message: 'Bu hereket pozular. Dowam?',
      confirmLabel: 'Poz',
      cancelLabel: 'Ýatyr',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-ledger', id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pozup bolmady');
      toastSuccess('Pozuldy');
      await load();
    } catch (e) {
      toastError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/admin/billing"
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Ähli hereketler</h1>
            <p className="text-xs text-slate-500">{filtered.length} / {rows.length} log</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
            <RefreshCw className="h-4 w-4" />
            Täzele
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={!selected.size || busy}
            onClick={() => void deleteSelected()}
          >
            <Trash2 className="h-4 w-4" />
            Poz ({selected.size})
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Gözle: firma, ulanyjy, device, sebäp…"
            className="w-full h-10 pl-10 pr-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>
        <select
          value={tenantFilter}
          onChange={(e) => setTenantFilter(e.target.value)}
          className="h-10 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white px-3"
        >
          <option value="">Ähli firmalar</option>
          {tenants.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white px-3"
        >
          <option value="">Ähli görnüş</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Ýüklenýär…
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {filtered.map((e) => (
              <div key={e.id} className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(e.id)}
                    onChange={() => toggle(e.id)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="text-[11px] text-slate-500">
                        {e.createdAt?.replace('T', ' ').slice(0, 19)}
                      </span>
                      <span
                        className={`text-xs font-semibold tabular-nums ${
                          e.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {e.amount >= 0 ? '+' : ''}
                        {e.amount}
                      </span>
                    </div>
                    <p className="text-sm text-white font-medium">{e.tenantSlug}</p>
                    <p className="text-xs text-slate-400">{e.reason || e.type}</p>
                    <p className="text-[11px] text-slate-500">
                      Ulanyjy: <span className="text-slate-300">{displayUser(e)}</span>
                      {' · '}
                      Device: <span className="text-slate-300">{displayDevice(e)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="p-1.5 text-slate-500 hover:text-rose-400"
                    onClick={() => void deleteOne(e.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {!filtered.length && (
              <p className="text-center text-slate-500 py-10 text-sm">Netije ýok</p>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block rounded-xl border border-slate-700/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && selected.size === filtered.length}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="px-3 py-2.5 font-medium">Wagt</th>
                    <th className="px-3 py-2.5 font-medium">Firma</th>
                    <th className="px-3 py-2.5 font-medium">Görnüş</th>
                    <th className="px-3 py-2.5 font-medium">Sebäp</th>
                    <th className="px-3 py-2.5 font-medium">Ulanyjy</th>
                    <th className="px-3 py-2.5 font-medium">Device</th>
                    <th className="px-3 py-2.5 font-medium text-right">Mukdar</th>
                    <th className="px-3 py-2.5 font-medium text-right">Balans</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filtered.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-800/40">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(e.id)}
                          onChange={() => toggle(e.id)}
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">
                        {e.createdAt?.replace('T', ' ').slice(0, 19)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-300">{e.tenantSlug}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md border ${
                            e.amount >= 0
                              ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                              : 'border-rose-500/30 text-rose-400 bg-rose-500/10'
                          }`}
                        >
                          {e.amount >= 0 ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {e.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-300 max-w-[200px] truncate" title={e.reason}>
                        {e.reason || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-200 text-xs whitespace-nowrap">
                        {displayUser(e)}
                      </td>
                      <td className="px-3 py-2 text-slate-400 text-xs max-w-[140px] truncate">
                        {displayDevice(e)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold tabular-nums ${
                          e.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {e.amount >= 0 ? '+' : ''}
                        {e.amount}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-400 text-xs tabular-nums">
                        {e.balanceAfter}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="p-1 text-slate-500 hover:text-rose-400"
                          onClick={() => void deleteOne(e.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                        Netije ýok
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
