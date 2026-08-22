'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
      setLedger(led.entries || []);

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
          currency: 'REQ',
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
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="h-6 w-6 text-emerald-400" />
            Tarif & Balans
          </h1>
          <p className="text-slate-400 text-sm mt-1">
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
                <span>{t.maxApiCallsDay}/gün API</span>
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
        <div className="rounded-xl border border-slate-700/80 overflow-hidden">
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
                      Firma gapy ýok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Ledger */}
      <section>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Soňky hereketler</h2>
        <div className="rounded-xl border border-slate-700/80 divide-y divide-slate-800">
          {ledger.slice(0, 15).map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              {e.amount >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-rose-400 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-slate-200 truncate">
                  <span className="font-mono text-xs text-slate-500">{e.tenantSlug}</span>
                  {' · '}
                  {e.reason || e.type}
                </p>
                <p className="text-[10px] text-slate-500">
                  {e.createdAt?.replace('T', ' ').slice(0, 19)} · {e.type}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={`font-semibold tabular-nums ${e.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                >
                  {e.amount >= 0 ? '+' : ''}
                  {e.amount}
                </p>
                <p className="text-[10px] text-slate-500">→ {e.balanceAfter}</p>
              </div>
            </div>
          ))}
          {ledger.length === 0 && (
            <p className="px-4 py-6 text-center text-slate-500 text-sm">Hereket ýok</p>
          )}
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
                    {t.name} — {t.priceMonthly === 0 ? 'Mugt' : `${t.priceMonthly} REQ`} ·{' '}
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
                  ['priceMonthly', 'Aýlyk baha (REQ)', '50'],
                  ['includedCredits', 'Aýlyk REQ', '5000'],
                  ['maxStaff', 'Max işgär', '10'],
                  ['maxApiCallsDay', 'Günde max API', '1000'],
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
