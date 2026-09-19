'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';

import { Wallet, Sparkles, Send, X, AlertTriangle, Check, Info, Clock, Zap } from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { Button } from '@/components/ui/Button';
import { toastSuccess, toastError, toastWarning } from '@/components/ui/Toast';
import { shouldShowBalanceWarn, balanceWarnKey } from '@/lib/balance-warn';
import { useLocale } from '@/components/LocaleProvider';

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
  if (level === 'empty' /* REQ gutardy — tarif teklip */ || balance <= 0) {
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
function fmtReq(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Number(n).toLocaleString('ru-RU')} REQ`;
}

/** 50 TMT = 500 REQ → 400 REQ = 40 TMT; Free → "Free" */
function formatBalancePair(
  balanceReq: number,
  tariff?: { priceMonthly?: number; includedCredits?: number; code?: string; name?: string } | null
): { primary: string; secondary: string } {
  const reqStr = `${Number(balanceReq).toLocaleString('ru-RU')} REQ`;
  const price = Number(tariff?.priceMonthly ?? 0);
  const included = Number(tariff?.includedCredits ?? 0);
  const isFree =
    price <= 0 ||
    (tariff?.code || '').toLowerCase() === 'free' ||
    (tariff?.name || '').toLowerCase() === 'free';
  if (isFree) {
    return { primary: reqStr, secondary: 'Free' };
  }
  if (included > 0 && price > 0) {
    const tmt = (balanceReq / included) * price;
    const tmtStr = `${Math.round(tmt * 100) / 100} TMT`;
    return { primary: reqStr, secondary: tmtStr };
  }
  return { primary: reqStr, secondary: '' };
}

function fmtTmt(n: number | null | undefined) {
  return fmtReq(n);
}

function TariffCard({
  tariff,
  selected,
  current,
  onSelect,
}: {
  tariff: Tariff;
  selected?: boolean;
  current?: boolean;
  onSelect?: () => void;
}) {
  const { t } = useLocale();
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
            {tariff.name}
            {current && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                {t('currentBadge')}
              </span>
            )}
            {selected && !current && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                {t('selected')}
              </span>
            )}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{tariff.description || '—'}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-indigo-300">
            {tariff.priceMonthly === 0 ? t('freePlan') : `${tariff.priceMonthly} TMT`}
          </p>
          {tariff.priceMonthly > 0 && <p className="text-[9px] text-slate-500">{t('perMonth')}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-slate-300 pt-2 border-t border-slate-800/80">
        <span className="flex items-center gap-1">
          <Wallet className="h-3 w-3 text-emerald-400" />
          {t('monthReq').replace('{n}', tariff.includedCredits.toLocaleString())}
        </span>
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-amber-400" />
          {t('dayMaxReq').replace('{n}', String(tariff.maxApiCallsDay))}
        </span>
        <span>{t('maxStaffN').replace('{n}', String(tariff.maxStaff))}</span>
        <span>{t('maxDbN').replace('{n}', String(tariff.maxConnections))}</span>
      </div>
    </button>
  );
}

interface WalletEntry {
  tenantSlug: string;
  tenantName: string;
  wallet: WalletInfo;
}

export function BalanceBadge({
  companySlug,
  tenantSlugs,
  username,
  compact,
  role,
}: {
  companySlug?: string;
  /** Multi-company staff: all linked firm slugs */
  tenantSlugs?: string[];
  username?: string;
  compact?: boolean;
  /** admin / super_admin — REQ hasaplanýar, free */
  role?: string;
}) {
  const { t } = useLocale();

  const isAdminFree =
    role === 'admin' ||
    role === 'super_admin' ||
    role === 'superadmin' ||
    role === 'manager';
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [wallets, setWallets] = useState<WalletEntry[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedTariffId, setSelectedTariffId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [activePanel, setActivePanel] = useState(0);

  const stopped = useRef(false);

  useEffect(() => {
    const stop = () => {
      stopped.current = true;
    };
    window.addEventListener('bi-logged-out', stop);
    return () => window.removeEventListener('bi-logged-out', stop);
  }, []);

  const load = useCallback(async () => {
    if (stopped.current) return;
    if (!companySlug && !(tenantSlugs && tenantSlugs.length)) return;
    try {
      const res = await fetch('/api/billing?action=my-wallet');
      if (res.status === 401) {
        stopped.current = true;
        return;
      }
      const data = await res.json();
      if (!res.ok) return;
      const list: WalletEntry[] = Array.isArray(data.wallets)
        ? data.wallets.map((x: any) => ({
            tenantSlug: String(x.tenantSlug || ''),
            tenantName: String(x.tenantName || x.tenantSlug || ''),
            wallet: x.wallet as WalletInfo,
          }))
        : data.wallet
          ? [
              {
                tenantSlug: String(data.tenantSlug || companySlug || ''),
                tenantName: String(data.tenantName || companySlug || ''),
                wallet: data.wallet as WalletInfo,
              },
            ]
          : [];
      setWallets(list);
      if (list[0]?.wallet) {
        setWallet(list[0].wallet);
      }
      // Bir gezek (badge + billing sahypa deňleşdirilen)
      try {
        if (typeof window !== 'undefined' && window.location.pathname.includes('/admin/billing')) {
          // billing page özüni görkezýär
        } else {
          const bad = list.filter(
            (e) => e.wallet && (e.wallet.level === 'empty' || e.wallet.level === 'critical')
          );
          if (bad.length) {
            const key = balanceWarnKey(bad.map((e) => e.tenantSlug));
            if (shouldShowBalanceWarn(key)) {
              const names = bad.map((e) => e.tenantName || e.tenantSlug).join(', ');
              toastWarning(
                t('balanceWarning'),
                (bad.length === 1
                  ? `${names}: top-up ýa-da tarif üýtgetme gerek`
                  : `${bad.length} firma: ${names}`) + t('clickFirms'),
                '/admin/billing?alert=1'
              );
            }
          }
        }
      } catch {
        /* */
      }
      if (Array.isArray(data.tariffs)) setTariffs(data.tariffs.filter((t: Tariff) => t.isActive !== false));
    } catch {
      /* offline */
    }
  }, [companySlug, tenantSlugs]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  const alertFirms = useMemo(
    () =>
      wallets.filter(
        (e) => e.wallet && (e.wallet.level === 'empty' || e.wallet.level === 'critical')
      ),
    [wallets]
  );

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
    if (ms <= 0) return t('periodEndedNeedTopup');
    const days = Math.ceil(ms / (24 * 3600 * 1000));
    return t('periodDaysLeft').replace('{n}', String(days));
  }, [wallet?.subscription?.periodEnd]);

  /** Sum REQ + approx TMT across all linked companies */
  const totals = useMemo(() => {
    let req = 0;
    let tmt = 0;
    let anyPaid = false;
    for (const e of wallets) {
      const bal = Number(e.wallet?.balanceCredits || 0);
      req += bal;
      const pair = formatBalancePair(bal, e.wallet?.tariff);
      if (pair.secondary && pair.secondary !== 'Free') {
        anyPaid = true;
        const n = parseFloat(pair.secondary.replace(/[^\d.]/g, ''));
        if (!Number.isNaN(n)) tmt += n;
      }
    }
    return { req, tmt, anyPaid, multi: wallets.length > 1 };
  }, [wallets]);

  async function sendRequest() {
    if (!selectedTariffId) {
      toastError(t('selectTariff'), t('pickNextTariffThenRequest'));
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
        t('tariffChangeNote')
      );
      setOpen(false);
      setMessage('');
    } catch (e) {
      toastError(t('failed'), String(e));
    } finally {
      setSending(false);
    }
  }

  if (!companySlug) return null;

  if (isAdminFree) {
    return (
      <div
        title={t('adminFreeReq')}
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
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
          void load();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
            void load();
          }
        }}
        title={t('balanceAndTariff')}
        className={`
          group flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-left transition-all duration-500 cursor-pointer
          ring-1 ${colors.ring} ${colors.bg} shadow-lg hover:brightness-110
          ${wallet?.level === 'empty' /* REQ gutardy — tarif teklip */ || wallet?.level === 'critical' ? 'animate-pulse' : ''}
        `}
      >
        <Wallet className={`h-3.5 w-3.5 shrink-0 ${colors.text}`} />
        <div className="min-w-0">
          {(() => {
            if (totals.multi) {
              const reqStr = `${totals.req.toLocaleString('ru-RU')} REQ`;
              const sec = totals.anyPaid
                ? `${Math.round(totals.tmt * 100) / 100} TMT`
                : wallets.every((e) => formatBalancePair(Number(e.wallet?.balanceCredits || 0), e.wallet?.tariff).secondary === 'Free')
                  ? 'Free'
                  : '';
              return (
                <>
                  <p className={`text-xs font-semibold tabular-nums leading-tight ${colors.text}`}>
                    {reqStr}
                    {sec ? (
                      <span className="font-medium opacity-80 text-[10px]"> / {sec}</span>
                    ) : null}
                  </p>
                  {!compact && (
                    <p className="text-[9px] text-slate-500 truncate max-w-[120px] leading-tight">
                      {wallets.length} firma
                    </p>
                  )}
                </>
              );
            }
            const pair =
              bal == null
                ? { primary: '…', secondary: '' }
                : formatBalancePair(bal, wallet?.tariff);
            return (
              <>
                <p className={`text-xs font-semibold tabular-nums leading-tight ${colors.text}`}>
                  {pair.primary}
                  {pair.secondary ? (
                    <span className="font-medium opacity-80 text-[10px]"> / {pair.secondary}</span>
                  ) : null}
                </p>
                {!compact && wallet?.tariff && (
                  <p className="text-[9px] text-slate-500 truncate max-w-[100px] leading-tight">
                    {wallet.tariff.name}
                  </p>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {open && (
        <ModalPortal open>
          <div className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <div
              className={`relative w-full max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-gradient-to-b from-slate-900 to-slate-950 p-5 space-y-4 shadow-2xl ${
                totals.multi ? 'sm:max-w-4xl' : 'sm:max-w-lg'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {totals.multi ? t('balanceTariffAll') : t('balanceAndTariff')}
                  {alertFirms.length > 0 && (
                    <p className="text-[11px] text-amber-300 mt-1">
                      Duýduryş: {alertFirms.map((e) => e.tenantName || e.tenantSlug).join(', ')} —
                      aşakda tarif / top-up
                    </p>
                  )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{t('allNumbersReq')}</p>
                </div>
                <button type="button" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Multi-company panels: side-by-side on desktop, stacked on mobile */}
              {totals.multi ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {wallets.map((e, idx) => {
                    const pair = formatBalancePair(Number(e.wallet.balanceCredits || 0), e.wallet.tariff);
                    const c = balanceColor(
                      e.wallet.balanceCredits,
                      e.wallet.lowBalanceThreshold || 50,
                      e.wallet.level
                    );
                    const end = e.wallet.subscription?.periodEnd;
                    let left: string | null = null;
                    if (end) {
                      const ms = Date.parse(end) - Date.now();
                      if (!Number.isNaN(ms)) {
                        left =
                          ms <= 0
                            ? t('periodEnded')
                            : t('periodDaysLeft').replace('{n}', String(Math.ceil(ms / (24 * 3600 * 1000))));
                      }
                    }
                    return (
                      <div
                        key={e.tenantSlug || idx}
                        className={`rounded-xl border border-slate-700/80 p-4 ${c.bg} ${
                          activePanel === idx ? 'ring-1 ring-indigo-500/40' : ''
                        }`}
                        onClick={() => {
                          setActivePanel(idx);
                          setWallet(e.wallet);
                        }}
                      >
                        <p className="text-[11px] uppercase tracking-wide text-slate-500 text-center">
                          {t('balanceAndTariff')} ({e.tenantName || e.tenantSlug})
                        </p>
                        <p className="text-[10px] text-slate-500 text-center mt-0.5">
                          {t('allNumbersReq')}
                        </p>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500 text-center mt-3">
                          {t('firmWallet')}
                        </p>
                        <p className={`text-2xl font-bold tabular-nums text-center mt-1 ${c.text}`}>
                          {pair.primary}
                        </p>
                        {pair.secondary && (
                          <p className="text-center text-sm text-slate-400 mt-1">≈ {pair.secondary}</p>
                        )}
                        {e.wallet.warning && (
                          <p className="mt-2 text-xs text-center text-amber-300 flex items-center justify-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {e.wallet.warning}
                          </p>
                        )}
                        {left && (
                          <p className="mt-1.5 text-[11px] text-center text-slate-400 flex items-center justify-center gap-1">
                            <Clock className="h-3 w-3" />
                            {left}
                          </p>
                        )}
                        {e.wallet.tariff && (
                          <p className="mt-2 text-center text-[11px] text-slate-400 truncate">
                            {e.wallet.tariff.name}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
              <div className={`rounded-xl border border-slate-700/80 p-4 ${colors.bg}`}>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 text-center">{t('firmWallet')}</p>
                <p className={`text-3xl font-bold tabular-nums text-center mt-1 ${colors.text}`}>
                  {bal == null
                    ? '—'
                    : formatBalancePair(bal, wallet?.tariff).primary}
                </p>
                {bal != null && formatBalancePair(bal, wallet?.tariff).secondary && (
                  <p className="text-center text-sm text-slate-400 mt-1">
                    ≈ {formatBalancePair(bal, wallet?.tariff).secondary}
                  </p>
                )}
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
              )}

              {/* How it works - plain language */}
              <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-3.5 space-y-2">
                <p className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-sky-400" />
                  {t('whatIsThis')}
                </p>
                <ul className="text-[11px] text-slate-400 space-y-1.5 leading-relaxed list-disc pl-4">
                  <li>
                    {t('helpBalans')}
                  </li>
                  <li>{t('helpApiCost')}</li>
                  <li>{t('helpTariffMonth')}</li>
                  <li>{t('helpColor')}</li>
                  <li>{t('helpKeepReq')}</li>
                </ul>
              </div>

              {/* Current tariff */}
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                  {t('currentTariff')}
                </p>
                {wallet?.tariff ? (
                  <TariffCard tariff={wallet.tariff} current />
                ) : (
                  <p className="text-sm text-slate-500 px-1">{t('noTariffSet')}</p>
                )}
              </div>

              {/* Change request */}
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <p className="text-sm font-medium text-slate-200">{t('wantOtherTariff')}</p>
                <p className="text-[11px] text-slate-500">
                  {t('pickTariffHint')}
                </p>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                  {otherTariffs.length === 0 && (
                    <p className="text-xs text-slate-500">{t('noOtherTariff')}</p>
                  )}
                  {otherTariffs.map((t) => (
                    <TariffCard key={t.id} tariff={t}
                      selected={selectedTariffId === t.id}
                      onSelect={() => setSelectedTariffId(t.id)}
                    />
                  ))}
                </div>

                {selectedTariff && (
                  <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/30 p-3 text-[11px] text-indigo-100/90 space-y-1">
                    <p className="font-semibold text-indigo-200 flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" />
                      {t('nextLabel')}: {selectedTariff.name}
                    </p>
                    <p>
                      {selectedTariff.priceMonthly === 0 ? t('freePlan') : `${selectedTariff.priceMonthly} TMT`} · {t('monthReq').replace('{n}', selectedTariff.includedCredits.toLocaleString())} · {t('dayMaxReq').replace('{n}', String(selectedTariff.maxApiCallsDay))}
                    </p>
                    <p className="text-indigo-200/70">
                      {t('helpKeepReq')}
                    </p>
                  </div>
                )}

                <textarea
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white min-h-[56px]"
                  placeholder={t('whyChangeOptional')}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <Button className="w-full" loading={sending} disabled={!selectedTariffId} onClick={() => void sendRequest()}>
                  <Send className="h-4 w-4" />
                  {t('sendTariffRequest')}
                </Button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
