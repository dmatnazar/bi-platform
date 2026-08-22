'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, Sparkles, Send, X, AlertTriangle, Check, Info, Clock, Zap } from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { Button } from '@/components/ui/Button';
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
  isActive?: boolean;
}

interface WalletInfo {
  balanceCredits: number;
  lowBalanceThreshold: number;
  level: 'ok' | 'low' | 'critical' | 'empty';
  warning?: string | null;
  tariff?: Tariff | null;
  subscription?: { status?: string; periodEnd?: string; periodStart?: string } | null;
}

function balanceColor(balance: number, threshold: number, level: string) {
  if (level === 'empty' || balance <= 0) {
    return { text: 'text-rose-400', bg: 'bg-rose-500/20', ring: 'ring-rose-500/40', bar: 'bg-rose-500' };
  }
  if (level === 'critical' || balance <= threshold * 0.25) {
    return { text: 'text-orange-400', bg: 'bg-orange-500/15', ring: 'ring-orange-500/35', bar: 'bg-orange-500' };
  }
  if (level === 'low' || balance <= threshold) {
    return { text: 'text-amber-400', bg: 'bg-amber-500/15', ring: 'ring-amber-500/30', bar: 'bg-amber-400' };
  }
  return { text: 'text-emerald-400', bg: 'bg-emerald-500/15', ring: 'ring-emerald-500/25', bar: 'bg-emerald-500' };
}

/** 1 birlik gapda = 1 REQ (görkezmek üçin) */
function fmtTmt(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Number(n).toLocaleString('ru-RU')} REQ`;
}

function TariffCard({
  t,
  selected,
  current,
  onSelect,
}: {
  t: Tariff;
  selected?: boolean;
  current?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!onSelect}
      className={`w-full text-left rounded-xl border p-3.5 space-y-2 transition-all ${
        selected
          ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/40'
          : current
            ? 'border-emerald-500/40 bg-emerald-500/5'
            : 'border-slate-700/80 bg-slate-900/60 hover:border-slate-600'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-white flex items-center gap-1.5">
            {t.name}
            {current && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                häzirki
              </span>
            )}
            {selected && !current && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                saýlanan
              </span>
            )}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{t.description || '—'}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-indigo-300">
            {t.priceMonthly === 0 ? 'Mugt' : `${t.priceMonthly} REQ`}
          </p>
          {t.priceMonthly > 0 && <p className="text-[9px] text-slate-500">aýda</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-slate-300 pt-2 border-t border-slate-800/80">
        <span className="flex items-center gap-1">
          <Wallet className="h-3 w-3 text-emerald-400" />
          Aýda <strong className="text-white">{t.includedCredits.toLocaleString()}</strong> REQ (sorgu)
        </span>
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-amber-400" />
          Günde max <strong className="text-white">{t.maxApiCallsDay}</strong> API
        </span>
        <span>
          Max <strong className="text-white">{t.maxStaff}</strong> işgär
        </span>
        <span>
          Max <strong className="text-white">{t.maxConnections}</strong> DB baglanyşyk
        </span>
      </div>
    </button>
  );
}

export function BalanceBadge({
  companySlug,
  username,
  compact,
  role,
}: {
  companySlug?: string;
  username?: string;
  compact?: boolean;
  /** admin / super_admin — REQ hasaplanýar, free */
  role?: string;
}) {
  const isAdminFree =
    role === 'admin' ||
    role === 'super_admin' ||
    role === 'superadmin' ||
    role === 'manager';
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedTariffId, setSelectedTariffId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!companySlug) return;
    try {
      const res = await fetch('/api/billing?action=my-wallet');
      const data = await res.json();
      if (!res.ok) return;
      if (data.wallet) {
        setWallet(data.wallet);
        const w = data.wallet as WalletInfo;
        if (w.level === 'empty' || w.level === 'critical') {
          try {
            const key = `bal-warn-${companySlug}-${w.level}`;
            const last = sessionStorage.getItem(key);
            const now = Date.now();
            if (!last || now - Number(last) > 10 * 60 * 1000) {
              sessionStorage.setItem(key, String(now));
              toastWarning(
                w.level === 'empty' ? 'Balans gutardy' : 'Balans critiki pes',
                `${fmtTmt(w.balanceCredits)} galdy — top-up ýa-da tarif üýtgetme gerek bolup biler`
              );
            }
          } catch {
            /* */
          }
        }
      }
      if (Array.isArray(data.tariffs)) setTariffs(data.tariffs.filter((t: Tariff) => t.isActive !== false));
    } catch {
      /* offline */
    }
  }, [companySlug]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30000);
    return () => clearInterval(t);
  }, [load]);

  const colors = useMemo(() => {
    if (!wallet) return { text: 'text-slate-400', bg: 'bg-slate-800/60', ring: 'ring-slate-700/40', bar: 'bg-slate-600' };
    return balanceColor(wallet.balanceCredits, wallet.lowBalanceThreshold || 50, wallet.level);
  }, [wallet]);

  const selectedTariff = tariffs.find((t) => t.id === selectedTariffId);
  const otherTariffs = tariffs.filter((t) => t.id !== wallet?.tariff?.id);

  const periodLeft = useMemo(() => {
    const end = wallet?.subscription?.periodEnd;
    if (!end) return null;
    const ms = Date.parse(end) - Date.now();
    if (Number.isNaN(ms)) return null;
    if (ms <= 0) return 'Döwür gutardy — täze döwür / top-up gerek';
    const days = Math.ceil(ms / (24 * 3600 * 1000));
    return `Tarif döwri ~${days} gün galdy`;
  }, [wallet?.subscription?.periodEnd]);

  async function sendRequest() {
    if (!selectedTariffId) {
      toastError('Tarif saýlaň', 'Indiki tarifi saýlap, soň sorag ugradyň');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request-tariff-change',
          requestedTariffId: selectedTariffId,
          message: message || undefined,
          requestedBy: username,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Sorag ugradylmady', data.error || data.message);
        return;
      }
      toastSuccess(
        'Sorag ugradyldy',
        'Admin tassyklansoň tarif üýtgär. Galan REQ balansyňyz ýitmeýär — täze tarife geçýär.'
      );
      setOpen(false);
      setMessage('');
    } catch (e) {
      toastError('Şowsuz', String(e));
    } finally {
      setSending(false);
    }
  }

  if (!companySlug) return null;

  if (isAdminFree) {
    return (
      <div
        title="Administrator — REQ hasaplanmaýar (free)"
        className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 ring-1 ring-emerald-500/30 bg-emerald-500/10"
      >
        <Wallet className="h-3.5 w-3.5 text-emerald-400" />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-emerald-400 leading-tight">Admin</p>
          {!compact && <p className="text-[9px] text-emerald-500/80 leading-tight">free</p>}
        </div>
      </div>
    );
  }

  const bal = wallet?.balanceCredits;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          void load();
        }}
        title="Balans (REQ) we tarif"
        className={`
          group flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-left transition-all duration-500
          ring-1 ${colors.ring} ${colors.bg} shadow-lg hover:brightness-110
          ${wallet?.level === 'empty' || wallet?.level === 'critical' ? 'animate-pulse' : ''}
        `}
      >
        <Wallet className={`h-3.5 w-3.5 shrink-0 ${colors.text}`} />
        <div className="min-w-0">
          <p className={`text-xs font-semibold tabular-nums leading-tight ${colors.text}`}>
            {bal == null ? '…' : Number(bal).toLocaleString('ru-RU')}
            <span className="font-medium opacity-80 text-[10px] ml-0.5">REQ</span>
          </p>
          {!compact && wallet?.tariff && (
            <p className="text-[9px] text-slate-500 truncate max-w-[88px] leading-tight">{wallet.tariff.name}</p>
          )}
        </div>
      </button>

      {open && (
        <ModalPortal open>
          <div className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-gradient-to-b from-slate-900 to-slate-950 p-5 space-y-4 shadow-2xl">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-white">Balans we tarif</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Ähli sanlar REQ bilen · aňsat düşündiriş</p>
                </div>
                <button type="button" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Balance */}
              <div className={`rounded-xl border border-slate-700/80 p-4 ${colors.bg}`}>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 text-center">Firmanyň gapy</p>
                <p className={`text-3xl font-bold tabular-nums text-center mt-1 ${colors.text}`}>{fmtTmt(bal)}</p>
                {wallet?.warning && (
                  <p className="mt-2 text-xs text-center text-amber-300 flex items-center justify-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {wallet.warning}
                  </p>
                )}
                {periodLeft && (
                  <p className="mt-1.5 text-[11px] text-center text-slate-400 flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" />
                    {periodLeft}
                  </p>
                )}
              </div>

              {/* How it works - plain language */}
              <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-3.5 space-y-2">
                <p className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-sky-400" />
                  Bu näme we nähili azalýar?
                </p>
                <ul className="text-[11px] text-slate-400 space-y-1.5 leading-relaxed list-disc pl-4">
                  <li>
                    <strong className="text-slate-300">Balans</strong> — firmanyň hasabyndaky sorgu birligi (REQ).
                  </li>
                  <li>
                    Her <strong className="text-slate-300">API sorgu</strong> (hasabat, maglumat çekmek) gapdan
                    aýrylýar. Häzir: <strong className="text-slate-300">1 API sorgu = 1 REQ</strong>.
                  </li>
                  <li>
                    Tarif aýda <strong className="text-slate-300">mugt REQ</strong> berýär (mysal: Free = 500 REQ).
                    Döwür gutanda admin täzeleýär ýa-da top-up edýär.
                  </li>
                  <li>
                    Balans <strong className="text-amber-300">peselse reňk üýtgeýär</strong> (ýaşyl → sary → gyzyl).
                    0 bolanda hyzmat çäklener.
                  </li>
                  <li>
                    Tarif üýtgese <strong className="text-emerald-300">galan REQ ýitmeýär</strong> — täze tarife
                    geçýär.
                  </li>
                </ul>
              </div>

              {/* Current tariff */}
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                  Häzirki tarif
                </p>
                {wallet?.tariff ? (
                  <TariffCard t={wallet.tariff} current />
                ) : (
                  <p className="text-sm text-slate-500 px-1">Tarif bellenmedik — admin bilen habarlaşyň</p>
                )}
              </div>

              {/* Change request */}
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <p className="text-sm font-medium text-slate-200">Başga tarife geçmek isleýärsiňizmi?</p>
                <p className="text-[11px] text-slate-500">
                  Aşakdan tarifi saýlaň — ähli şertler görner. Soň «Sorag ugrat». Admin tassyklansoň üýtgeýär.
                </p>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                  {otherTariffs.length === 0 && (
                    <p className="text-xs text-slate-500">Başga aktiv tarif ýok</p>
                  )}
                  {otherTariffs.map((t) => (
                    <TariffCard
                      key={t.id}
                      t={t}
                      selected={selectedTariffId === t.id}
                      onSelect={() => setSelectedTariffId(t.id)}
                    />
                  ))}
                </div>

                {selectedTariff && (
                  <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/30 p-3 text-[11px] text-indigo-100/90 space-y-1">
                    <p className="font-semibold text-indigo-200 flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" />
                      Indiki: {selectedTariff.name}
                    </p>
                    <p>
                      Aýlyk: {selectedTariff.priceMonthly === 0 ? 'Mugt' : `${selectedTariff.priceMonthly} REQ`} ·
                      Berilýän: {selectedTariff.includedCredits.toLocaleString()} REQ · Günde{' '}
                      {selectedTariff.maxApiCallsDay} API
                    </p>
                    <p className="text-indigo-200/70">
                      Tassyklananda: häzirki <strong>{fmtTmt(bal)}</strong> saklanýar + tarifiň aýlyk
                      berilýän REQ-si goşulyp bilner.
                    </p>
                  </div>
                )}

                <textarea
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white min-h-[56px]"
                  placeholder="Näme üçin üýtgetmek isleýärsiňiz? (islege görä)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <Button className="w-full" loading={sending} disabled={!selectedTariffId} onClick={() => void sendRequest()}>
                  <Send className="h-4 w-4" />
                  Tarif üýtgetme soragyny ugrat
                </Button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
