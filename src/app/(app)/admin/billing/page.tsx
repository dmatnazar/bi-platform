'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDateTime } from '@/lib/utils';
import {
  Wallet,
  RefreshCw,
  Plus,
  Coins,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { toastSuccess, toastError, toastWarning } from '@/components/ui/Toast';

interface Tariff {
  id: string;
  code: string;
  name: string;
  description?: string;
  priceMonthly: number;
  currency: string;
  includedCredits: number;
  maxStaff: number;
  maxApiCallsDay: number;
  maxConnections: number;
  isActive: boolean;
}

interface WalletRow {
  tenantId: string;
  tenantSlug: string;
  tenantName?: string;
  tenantActive?: boolean;
  balanceCredits: number;
  lowBalanceThreshold: number;
  level: 'ok' | 'low' | 'critical' | 'empty';
  warning?: string | null;
  tariff?: Tariff | null;
  subscription?: { status: string; periodEnd?: string } | null;
}

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
  ip?: string;
  path?: string;
  method?: string;
  endpoint?: string;
  meta?: Record<string, unknown>;
}

const levelStyle: Record<string, string> = {
  ok: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  low: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  critical: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  empty: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

const levelLabel: Record<string, string> = {
  ok: 'Ýagdaý gowy',
  low: 'Pes',
  critical: 'Critiki',
  empty: 'Gutardy',
};


function parseMeta(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw);
      return j && typeof j === 'object' ? (j as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

/** Gateway may use snake_case or nest actor under meta */
function normalizeLedgerEntry(raw: any): LedgerEntry {
  const meta = parseMeta(raw?.meta ?? raw?.Meta);
  return {
    id: String(raw?.id ?? raw?._id ?? ''),
    tenantSlug: String(raw?.tenantSlug ?? raw?.tenant_slug ?? ''),
    type: String(raw?.type ?? raw?.entryType ?? ''),
    amount: Number(raw?.amount ?? 0),
    balanceAfter: Number(raw?.balanceAfter ?? raw?.balance_after ?? 0),
    reason: raw?.reason ?? raw?.description ?? meta.reason,
    createdAt: String(raw?.createdAt ?? raw?.created_at ?? ''),
    createdBy: raw?.createdBy ?? raw?.created_by ?? meta.createdBy ?? meta.created_by,
    username: raw?.username ?? raw?.userName ?? meta.username ?? meta.userName,
    user: raw?.user ?? meta.user,
    deviceId: raw?.deviceId ?? raw?.device_id ?? meta.deviceId ?? meta.device_id,
    deviceName:
      raw?.deviceName ??
      raw?.device_name ??
      meta.deviceName ??
      meta.device_name ??
      meta.deviceLabel,
    device: raw?.device ?? meta.device,
    ip: raw?.ip ?? meta.ip,
    path: raw?.path ?? meta.path,
    method: raw?.method ?? meta.method,
    endpoint: raw?.endpoint ?? meta.endpoint,
    meta,
  };
}

function pickStr(...vals: unknown[]): string | null {
  for (const c of vals) {
    if (c == null || c === '') continue;
    if (typeof c === 'object' && c !== null) {
      const o = c as Record<string, unknown>;
      const nested = pickStr(
        o.fullName,
        o.displayName,
        o.userName,
        o.username,
        o.name,
        o.login,
        o.label,
        o.deviceName,
        o.deviceLabel,
        o.actor
      );
      if (nested) return nested;
      continue;
    }
    const s = String(c).trim();
    if (!s) continue;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) continue;
    if (/^[0-9a-f]{24}$/i.test(s)) continue;
    return s;
  }
  return null;
}

function displayUser(e: LedgerEntry): string {
  const meta = parseMeta(e.meta);
  return (
    pickStr(
      meta.fullName,
      meta.displayName,
      meta.userName,
      meta.username,
      meta.user,
      meta.staff,
      meta.actor,
      meta.createdBy,
      meta.created_by,
      e.username,
      e.user,
      meta.login,
      e.createdBy,
      (e as any).userFullName,
      (e as any).staffName,
      (e as any).created_by,
      (e as any).user_name
    ) || '—'
  );
}

function displayDevice(e: LedgerEntry): string {
  const meta = parseMeta(e.meta);
  const s =
    pickStr(
      e.deviceName,
      meta.deviceName,
      meta.device_name,
      meta.deviceLabel,
      meta.device,
      e.device,
      meta.clientName,
      meta.hostname,
      meta.source === 'web' ? 'Web admin' : null,
      e.deviceId,
      meta.deviceId,
      meta.device_id,
      meta.userAgent,
      (e as any).device_name,
      (e as any).deviceLabel
    ) || null;
  if (!s) return '—';
  return s.length > 40 ? s.slice(0, 38) + '…' : s;
}

export default function BillingPage() {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [topupOpen, setTopupOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [tariffOpen, setTariffOpen] = useState(false);
  const [editingTariffId, setEditingTariffId] = useState<string | null>(null);
  const [selected, setSelected] = useState<WalletRow | null>(null);
  const [amount, setAmount] = useState('500');
  const [reason, setReason] = useState('');
  const [tariffId, setTariffId] = useState('');
  const [saving, setSaving] = useState(false);
  const [tariffForm, setTariffForm] = useState({
    code: '',
    name: '',
    description: '',
    priceMonthly: '0',
    includedCredits: '500',
    maxStaff: '5',
    maxApiCallsDay: '100',
    maxConnections: '2',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, led] = await Promise.all([
        fetch('/api/billing').then((r) => r.json()),
        fetch('/api/billing?action=ledger&limit=30').then((r) => r.json()),
      ]);
      if (ov.error) {
        toastError('Ýüklenmedi', ov.error);
        return;
      }
      setTariffs(ov.tariffs || []);
      setWallets(ov.wallets || []);
      const list = led.entries || led.ledger || led.rows || led.items || [];
      setLedger(Array.isArray(list) ? list.map(normalizeLedgerEntry) : []);

      // Beautiful warnings for low balances
      const bad = (ov.wallets || []).filter(
        (w: WalletRow) => w.level === 'empty' || w.level === 'critical'
      );
      if (bad.length > 0) {
        toastWarning(
          'Balans duýduryşy',
          `${bad.length} firma: ${bad
            .slice(0, 3)
            .map((w: WalletRow) => w.tenantName || w.tenantSlug)
            .join(', ')}${bad.length > 3 ? '…' : ''}`
        );
      }
    } catch (e) {
      toastError('Ýüklenmedi', String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const totalBal = wallets.reduce((s, w) => s + (w.balanceCredits || 0), 0);
    const low = wallets.filter((w) => w.level === 'low' || w.level === 'critical').length;
    const empty = wallets.filter((w) => w.level === 'empty').length;
    return { totalBal, low, empty, firms: wallets.length };
  }, [wallets]);

  async function doTopup() {
    if (!selected) return;
    const n = Number(amount);
    if (!n || n <= 0) {
      toastError('Mukdar', 'Pozitiw san ýazyň');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'topup',
          tenantSlug: selected.tenantSlug,
          amount: n,
          reason: reason || 'Admin top-up',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Top-up şowsuz', data.error);
        return;
      }
      toastSuccess(
        'REQ goşuldy',
        `${selected.tenantName || selected.tenantSlug}: +${n} → ${data.balanceAfter}`
      );
      setTopupOpen(false);
      setReason('');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function doAssign() {
    if (!selected || !tariffId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign-tariff',
          tenantSlug: selected.tenantSlug,
          tariffId,
          grantIncludedCredits: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Tarif', data.error);
        return;
      }
      toastSuccess(
        'Tarif bellenildi',
        `${selected.tenantName}: +${data.granted || 0} REQ berildi`
      );
      setAssignOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function doSaveTariff() {
    if (!tariffForm.code.trim() || !tariffForm.name.trim()) {
      toastError('Zerur', 'Kod we at gerek');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'tariff-upsert',
          id: editingTariffId || undefined,
          code: tariffForm.code,
          name: tariffForm.name,
          description: tariffForm.description,
          priceMonthly: Number(tariffForm.priceMonthly) || 0,
          currency: 'TMT',
          includedCredits: Number(tariffForm.includedCredits) || 0,
          maxStaff: Number(tariffForm.maxStaff) || 0,
          maxApiCallsDay: Number(tariffForm.maxApiCallsDay) || 0,
          maxConnections: Number(tariffForm.maxConnections) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Tarif saklanmady', data.error);
        return;
      }
      toastSuccess('Tarif saklandy', data.tariff?.name);
      setTariffOpen(false);
      setEditingTariffId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-2xl font-bold text-white flex items-center gap-1.5 sm:gap-2 truncate leading-tight">
            <Wallet className="h-6 w-6 text-emerald-400" />
            Tarif & Balans
          </h1>
          <p className="text-slate-400 text-[11px] sm:text-sm mt-0.5 truncate leading-snug">
            Firmalaryň gaplary, tarifler we REQ hereketleri · VPS primary
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={load} loading={loading}>
            <RefreshCw className="h-4 w-4" />
            Täzele
          </Button>
          <Button size="sm" onClick={() => {
              setEditingTariffId(null);
              setTariffForm({
                code: '',
                name: '',
                description: '',
                priceMonthly: '0',
                includedCredits: '500',
                maxStaff: '5',
                maxApiCallsDay: '100',
                maxConnections: '2',
              });
              setTariffOpen(true);
            }}>
            <Plus className="h-4 w-4" />
            Tarif
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Firmalar</p>
          <p className="text-2xl font-semibold text-white mt-1">{stats.firms}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wide text-emerald-500/80">Jemi REQ</p>
          <p className="text-2xl font-semibold text-emerald-400 mt-1 tabular-nums">
            {stats.totalBal.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wide text-amber-500/80">Pes balans</p>
          <p className="text-2xl font-semibold text-amber-400 mt-1">{stats.low}</p>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
          <p className="text-[11px] uppercase tracking-wide text-rose-500/80">Gutaran</p>
          <p className="text-2xl font-semibold text-rose-400 mt-1">{stats.empty}</p>
        </div>
      </div>

      {/* Tariffs */}
      <section>
        <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          Tarifler
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {tariffs.map((t) => (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                setTariffForm({
                  code: t.code,
                  name: t.name,
                  description: t.description || '',
                  priceMonthly: String(t.priceMonthly),
                  includedCredits: String(t.includedCredits),
                  maxStaff: String(t.maxStaff),
                  maxApiCallsDay: String(t.maxApiCallsDay),
                  maxConnections: String(t.maxConnections),
                });
                setEditingTariffId(t.id);
                setTariffOpen(true);
              }}
              className="rounded-xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-950 p-4 space-y-2 cursor-pointer hover:border-indigo-500/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-white">{t.name}</p>
                  <p className="text-[11px] font-mono text-slate-500">{t.code}</p>
                </div>
                <span className="text-sm font-semibold text-indigo-300 tabular-nums">
                  {t.priceMonthly === 0 ? 'Mugt' : `${t.priceMonthly} ${t.currency}`}
                  {t.priceMonthly > 0 && <span className="text-[10px] text-slate-500">/aý</span>}
                </span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2">{t.description || '—'}</p>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                <span>
                  <Coins className="inline h-3 w-3 mr-1 text-amber-400" />
                  {t.includedCredits.toLocaleString()} REQ
                </span>
                <span>{t.maxStaff} işgär</span>
                <span>{t.maxApiCallsDay}/gün REQ</span>
                <span>{t.maxConnections} DB</span>
              </div>
            </div>
          ))}
          {tariffs.length === 0 && !loading && (
            <p className="text-sm text-slate-500 col-span-3">Tarif ýok — täze goşuň</p>
          )}
        </div>
      </section>

      {/* Wallets */}
      <section>
        <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-sky-400" />
          Firma gaplary
        </h2>
        {/* Mobile cards */}
        <div className="sm:hidden space-y-3">
          {wallets.map((w) => (
            <div key={w.tenantId} className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{w.tenantName || w.tenantSlug}</p>
                  <p className="text-[11px] font-mono text-slate-500">{w.tenantSlug}</p>
                </div>
                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${levelStyle[w.level] || levelStyle.ok}`}>
                  {levelLabel[w.level] || w.level}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{w.tariff?.name || 'Tarif ýok'}</span>
                <span className="font-semibold tabular-nums text-white">
                  {w.balanceCredits.toLocaleString()} <span className="text-[10px] text-slate-500">REQ</span>
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 text-[11px] px-2 py-2 rounded-lg bg-emerald-500/15 text-emerald-300"
                  onClick={() => { setSelected(w); setAmount('500'); setTopupOpen(true); }}
                >
                  Top-up
                </button>
                <button
                  type="button"
                  className="flex-1 text-[11px] px-2 py-2 rounded-lg bg-indigo-500/15 text-indigo-300"
                  onClick={() => { setSelected(w); setTariffId(w.tariff?.id || tariffs[0]?.id || ''); setAssignOpen(true); }}
                >
                  Tarif
                </button>
              </div>
            </div>
          ))}
          {wallets.length === 0 && !loading && (
            <p className="text-center text-slate-500 text-sm py-6">Firma ýok</p>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block rounded-xl border border-slate-700/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900/90 text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
                  <th className="px-4 py-2.5">Firma</th>
                  <th className="px-4 py-2.5">Tarif</th>
                  <th className="px-4 py-2.5">Balans</th>
                  <th className="px-4 py-2.5">Ýagdaý</th>
                  <th className="px-4 py-2.5 text-right">Amal</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((w) => (
                  <tr key={w.tenantId} className="border-b border-slate-800/80 hover:bg-slate-900/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{w.tenantName || w.tenantSlug}</p>
                      <p className="text-[11px] font-mono text-slate-500">{w.tenantSlug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300">{w.tariff?.name || '—'}</span>
                      {w.tariff && (
                        <p className="text-[10px] text-slate-500">
                          {w.tariff.priceMonthly === 0
                            ? 'Mugt'
                            : `${w.tariff.priceMonthly} ${w.tariff.currency}/aý`}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold tabular-nums text-white">
                        {w.balanceCredits.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-1">REQ</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${levelStyle[w.level] || levelStyle.ok}`}
                      >
                        {w.level === 'ok' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        {levelLabel[w.level] || w.level}
                      </span>
                      {w.warning && (
                        <p className="text-[10px] text-amber-400/90 mt-0.5 max-w-[140px]">{w.warning}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          className="text-[11px] px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                          onClick={() => {
                            setSelected(w);
                            setAmount('500');
                            setTopupOpen(true);
                          }}
                        >
                          Top-up
                        </button>
                        <button
                          type="button"
                          className="text-[11px] px-2 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25"
                          onClick={() => {
                            setSelected(w);
                            setTariffId(w.tariff?.id || tariffs[0]?.id || '');
                            setAssignOpen(true);
                          }}
                        >
                          Tarif
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {wallets.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">
                      Firma ýok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Ledger — table like API list */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-slate-300">Soňky hereketler</h2>
          <Link
            href="/admin/billing/ledger"
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            Ählisi →
          </Link>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden space-y-2 mb-3">
          {ledger.slice(0, 10).map((e) => (
            <div key={e.id} className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">{formatDateTime(e.createdAt)}</span>
                <span className={`text-xs font-semibold tabular-nums ${e.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {e.amount >= 0 ? '+' : ''}{e.amount}
                </span>
              </div>
              <p className="text-sm text-white font-medium truncate">{e.tenantSlug}</p>
              <p className="text-xs text-slate-400 truncate">{e.reason || e.type}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                <span>Ulanyjy: <span className="text-slate-300">{displayUser(e)}</span></span>
                <span>Device: <span className="text-slate-300">{displayDevice(e)}</span></span>
              </div>
            </div>
          ))}
          {ledger.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-6">Hereket ýok</p>
          )}
        </div>

        <div className="hidden sm:block rounded-xl border border-slate-700/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Wagt</th>
                  <th className="px-3 py-2.5 font-medium">Firma</th>
                  <th className="px-3 py-2.5 font-medium">Görnüş</th>
                  <th className="px-3 py-2.5 font-medium">Sebäp</th>
                  <th className="px-3 py-2.5 font-medium">Ulanyjy</th>
                  <th className="px-3 py-2.5 font-medium">Device</th>
                  <th className="px-3 py-2.5 font-medium text-right">Mukdar</th>
                  <th className="px-3 py-2.5 font-medium text-right">Balans</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {ledger.slice(0, 10).map((e) => {
                  const user = displayUser(e);
                  const device = displayDevice(e);
                  return (
                    <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap text-xs">
                        {formatDateTime(e.createdAt)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-300 whitespace-nowrap">
                        {e.tenantSlug}
                      </td>
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
                      <td className="px-3 py-2 text-slate-300 max-w-[180px] truncate" title={e.reason || ''}>
                        {e.reason || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-300 whitespace-nowrap text-xs">{String(user)}</td>
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap text-xs font-mono max-w-[120px] truncate" title={String(device)}>
                        {String(device)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap ${
                          e.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {e.amount >= 0 ? '+' : ''}
                        {e.amount}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-400 tabular-nums whitespace-nowrap text-xs">
                        {e.balanceAfter}
                      </td>
                    </tr>
                  );
                })}
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      Hereket ýok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Top-up modal */}
      {topupOpen && selected && (
        <ModalPortal open>
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setTopupOpen(false)} />
            <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-4 shadow-2xl">
              <h3 className="text-lg font-semibold text-white text-center">REQ goş (Top-up)</h3>
              <p className="text-sm text-slate-400 text-center">
                {selected.tenantName} · häzir {selected.balanceCredits} REQ
              </p>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Mukdar</label>
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  type="number"
                  min={1}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[100, 500, 1000, 5000].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                    onClick={() => setAmount(String(n))}
                  >
                    +{n}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Sebäp (optional)</label>
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Mysal: Aýlyk dolduryş"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button className="flex-1" loading={saving} onClick={() => void doTopup()}>
                  Goş
                </Button>
                <Button variant="ghost" onClick={() => setTopupOpen(false)}>
                  Ýatyr
                </Button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Assign tariff */}
      {assignOpen && selected && (
        <ModalPortal open>
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAssignOpen(false)} />
            <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-4 shadow-2xl">
              <h3 className="text-lg font-semibold text-white text-center">Tarif belle</h3>
              <p className="text-sm text-slate-400 text-center">{selected.tenantName}</p>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                value={tariffId}
                onChange={(e) => setTariffId(e.target.value)}
              >
                {tariffs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.priceMonthly === 0 ? 'Mugt' : `${t.priceMonthly} TMT`} ·{' '}
                    {t.includedCredits} REQ
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">
                Tarif üýtgedilende included REQler gap-a goşulýar (bir gezek).
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" loading={saving} onClick={() => void doAssign()}>
                  Belle
                </Button>
                <Button variant="ghost" onClick={() => setAssignOpen(false)}>
                  Ýatyr
                </Button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* New tariff */}
      {tariffOpen && (
        <ModalPortal open>
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setTariffOpen(false)} />
            <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-3 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-white text-center">{editingTariffId ? 'Tarifi üýtget' : 'Täze tarif'}</h3>
              {(
                [
                  ['code', 'Kod (free, starter…)', 'starter'],
                  ['name', 'Ady', 'Starter'],
                  ['description', 'Düşündiriş', ''],
                  ['priceMonthly', 'Aýlyk baha (TMT)', '50'],
                  ['includedCredits', 'Aýlyk REQ', '5000'],
                  ['maxStaff', 'Max işgär', '10'],
                  ['maxApiCallsDay', 'Günde max REQ (sorag)', '1000'],
                  ['maxConnections', 'Max DB baglanyşyk', '3'],
                ] as const
              ).map(([key, label, ph]) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-slate-400">{label}</label>
                  <input
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    value={(tariffForm as any)[key]}
                    placeholder={ph}
                    onChange={(e) => setTariffForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" loading={saving} onClick={() => void doSaveTariff()}>
                  Sakla
                </Button>
                <Button variant="ghost" onClick={() => setTariffOpen(false)}>
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
