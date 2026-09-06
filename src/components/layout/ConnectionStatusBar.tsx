'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Cloud, CloudOff, Database, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TenantClientStatus {
  slug: string;
  name: string;
  online: boolean;
  live: boolean;
}

interface Status {
  gatewayOnline: boolean;
  biClientDataAvailable: boolean;
  fromCache: boolean;
  catalogSyncedAt: string | null;
  cachedAt: string | null;
  catalogSyncIntervalSec: number;
  checkedAt: string;
  counts: { tenants: number; endpoints: number; staff: number };
  /** scoped counts for non-super users */
  scoped?: { endpoints: number; staff: number; companyName?: string };
  /** Per-company BI Client tunnel status */
  tenantStatuses?: TenantClientStatus[];
}

function Dot({ ok, warn }: { ok?: boolean; warn?: boolean }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full shrink-0',
        ok ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : warn ? 'bg-amber-400' : 'bg-rose-500'
      )}
    />
  );
}

function formatClientLabel(status: Status | null, companyName?: string): string {
  const list = status?.tenantStatuses || [];
  // Multiple firms (viewer linked to several companies): show live(n), offline(n)
  if (list.length > 1) {
    let live = 0;
    let offline = 0;
    for (const t of list) {
      if (t.online || t.live) live += 1;
      else offline += 1;
    }
    const parts: string[] = [];
    if (live) parts.push(`live(${live})`);
    if (offline) parts.push(`offline(${offline})`);
    return parts.join(', ') || '—';
  }
  if (list.length === 1) {
    const t = list[0];
    if (t.online) return `${t.name} online`;
    if (status?.biClientDataAvailable) return status.fromCache ? `${t.name} cache` : `${t.name} live`;
    return `${t.name} offline`;
  }
  if (status?.biClientDataAvailable) {
    return status.fromCache ? 'cache' : 'live';
  }
  return companyName ? `${companyName} —` : '—';
}

/** Admin strip: live(n), offline(n) — details in modal */
function formatAdminClientSummary(status: Status | null): string {
  const list = status?.tenantStatuses || [];
  if (list.length === 0) {
    if (status?.biClientDataAvailable) return status.fromCache ? 'cache' : 'live';
    return 'ýok';
  }
  let live = 0;
  let offline = 0;
  for (const t of list) {
    if (t.online || t.live) live += 1;
    else offline += 1;
  }
  if (list.length === 1) {
    const t = list[0];
    if (t.online) return `${t.name} online`;
    if (t.live || status?.biClientDataAvailable) return `${t.name} live`;
    return `${t.name} offline`;
  }
  const parts: string[] = [];
  if (live) parts.push(`live(${live})`);
  if (offline) parts.push(`offline(${offline})`);
  return parts.join(', ') || '—';
}

interface Props {
  /** super_admin sees global counts; others see company-scoped or nothing detailed */
  isSuperAdmin?: boolean;
  companyName?: string;
  /** When staff has multiple firms, prefer showing all */
  tenantSlugs?: string[];
}

export function ConnectionStatusBar({ isSuperAdmin = false, companyName }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [clientModal, setClientModal] = useState(false);
  /** Modal top (px) — just under the status indicator strip */
  const [modalTop, setModalTop] = useState(72);
  const barRef = useRef<HTMLDivElement | null>(null);

  function openClientModal() {
    const el = barRef.current;
    if (el) {
      const bottom = el.getBoundingClientRect().bottom;
      // Anchor just under indicators (not page top, not screen bottom)
      setModalTop(Math.max(48, Math.min(bottom + 8, window.innerHeight - 120)));
    } else {
      setModalTop(72);
    }
    setClientModal(true);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (res.ok) setStatus(data);
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!status?.catalogSyncIntervalSec || status.catalogSyncIntervalSec <= 0) return;
    const id = setInterval(load, status.catalogSyncIntervalSec * 1000);
    return () => clearInterval(id);
  }, [status?.catalogSyncIntervalSec, load]);

  const syncLabel =
    status?.cachedAt || status?.catalogSyncedAt
      ? formatDate(status.cachedAt || status.catalogSyncedAt || '')
      : '—';

  const intervalLabel =
    !status || status.catalogSyncIntervalSec <= 0
      ? 'el bilen'
      : `her ${status.catalogSyncIntervalSec}s`;

  const lastSyncIso = status?.cachedAt || status?.catalogSyncedAt || null;
  const lastSyncFull = lastSyncIso ? formatDateTime(lastSyncIso) : '—';
  const checkedFull = status?.checkedAt ? formatDateTime(status.checkedAt) : '—';
  const dataSource = !status
    ? '—'
    : status.fromCache
      ? 'Cache (ýerli saklanan)'
      : status.biClientDataAvailable
        ? 'Live (VPS / tunnel)'
        : 'Maglumat ýok';

  const clientModalUi = clientModal ? (
    <div
      className="fixed inset-0 z-[2147483000]"
      role="dialog"
      aria-modal="true"
      aria-label="Birikme statusy"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onClick={() => setClientModal(false)} />
      {/* Anchored under the indicator bar, centered horizontally */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[min(28rem,calc(100vw-1.5rem))] max-h-[min(70dvh,480px)] rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col"
        style={{ top: modalTop }}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 shrink-0 bg-slate-950/80">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">Birikme statusy</p>
            <p className="text-[10px] text-slate-500 truncate">VPS · BI Client · Sync</p>
          </div>
          <button
            type="button"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
            onClick={() => setClientModal(false)}
            aria-label="Ýap"
            title="Ýap"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Summary cards */}
          <div className="px-4 py-3 space-y-2 border-b border-slate-800/80">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-2.5 py-2">
                <p className="text-slate-500 text-[10px]">VPS Gateway</p>
                <p className={status?.gatewayOnline ? 'text-emerald-300 font-medium' : 'text-rose-300 font-medium'}>
                  {status?.gatewayOnline ? 'Connected' : 'Offline'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-2.5 py-2">
                <p className="text-slate-500 text-[10px]">Maglumat çeşmesi</p>
                <p className="text-slate-200 font-medium truncate" title={dataSource}>
                  {dataSource}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-2.5 py-2 col-span-2">
                <p className="text-slate-500 text-[10px]">Soňky catalog sync</p>
                <p className="text-white font-medium tabular-nums">{lastSyncFull}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Interval: {intervalLabel}
                  {status?.catalogSyncIntervalSec ? ' · awto' : ''}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-2.5 py-2 col-span-2">
                <p className="text-slate-500 text-[10px]">Status barlandy</p>
                <p className="text-slate-300 tabular-nums">{checkedFull}</p>
              </div>
            </div>

            {status && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="inline-flex items-center rounded-lg bg-indigo-500/15 border border-indigo-500/25 px-2 py-0.5 text-[10px] text-indigo-200">
                  {status.counts.tenants} firma
                </span>
                <span className="inline-flex items-center rounded-lg bg-sky-500/15 border border-sky-500/25 px-2 py-0.5 text-[10px] text-sky-200">
                  {status.counts.endpoints} API
                </span>
                <span className="inline-flex items-center rounded-lg bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-[10px] text-emerald-200">
                  {status.counts.staff} işgär
                </span>
              </div>
            )}
          </div>

          {/* Per-firm tunnel list */}
          <div className="px-4 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">BI Client — firmalar</p>
            <ul className="rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800">
              {(status?.tenantStatuses || []).length === 0 ? (
                <li className="px-3 py-4 text-xs text-slate-500 text-center">Firma statusy ýok</li>
              ) : (
                (status?.tenantStatuses || []).map((t) => {
                  const state = t.online ? 'online' : t.live ? 'live' : 'offline';
                  const color =
                    state === 'online' || state === 'live' ? 'text-emerald-300' : 'text-amber-300';
                  const bg =
                    state === 'online' || state === 'live'
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-amber-500/10 border-amber-500/30';
                  return (
                    <li key={t.slug} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="text-slate-100 truncate font-medium">{t.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono truncate">{t.slug}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${color} ${bg}`}>
                        {state}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>

        <div className="shrink-0 px-4 py-3 border-t border-slate-800 flex gap-2 bg-slate-950/50">
          <button
            type="button"
            onClick={() => void load()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Täzele
          </button>
          <button
            type="button"
            onClick={() => setClientModal(false)}
            className="flex-1 rounded-xl border border-slate-600 bg-slate-700/80 px-3 py-2 text-xs font-medium text-white hover:bg-slate-600"
          >
            Ýap
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // Viewer / company user: still show live sync strip (not only VPS)
  if (!isSuperAdmin) {
    return (
      <div ref={barRef} className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] sm:text-[11px] text-slate-300 px-11 sm:px-2 py-1.5 text-center">
        <button
          type="button"
          onClick={() => openClientModal()}
          className="inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 hover:bg-slate-800/80 transition-colors"
          title="Birikme statusy — basyp aç"
        >
          <Dot ok={!!status?.gatewayOnline} />
          {status?.gatewayOnline ? (
            <Cloud className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <CloudOff className="h-3.5 w-3.5 text-rose-400" />
          )}
          <span className={status?.gatewayOnline ? 'text-emerald-300' : 'text-rose-300'}>
            VPS {status?.gatewayOnline ? 'online' : 'offline'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => openClientModal()}
          className="inline-flex items-center gap-1.5 max-w-full rounded-lg px-1 py-0.5 hover:bg-slate-800/80 transition-colors text-left"
          title="Firma tunnel statuslary — basyp aç"
        >
          <Dot ok={!!status?.biClientDataAvailable} warn={!!status?.fromCache && status?.biClientDataAvailable} />
          <Database className="h-3.5 w-3.5 text-sky-400 shrink-0" />
          <span className={status?.biClientDataAvailable ? 'text-sky-300 truncate' : 'text-slate-500 truncate'}>
            BI Client ({formatClientLabel(status, companyName)})
          </span>
        </button>
        <div className="inline-flex items-center gap-1.5 text-white">
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          <span>
            Sync: <span className="text-white">{syncLabel}</span>
            <span className="text-white/80"> · {intervalLabel}</span>
          </span>
        </div>
        {clientModalUi}
      </div>
    );
  }

  return (
    <div ref={barRef} className="flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-4 gap-y-1 text-[10px] sm:text-[11px] text-slate-400 px-11 sm:px-2 py-1.5 text-center">
      <button
        type="button"
        onClick={() => openClientModal()}
        className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 hover:bg-slate-800/80 transition-colors"
        title="Birikme statusy — basyp aç"
      >
        <Dot ok={!!status?.gatewayOnline} />
        {status?.gatewayOnline ? (
          <Cloud className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <CloudOff className="h-3.5 w-3.5 text-rose-400" />
        )}
        <span className={status?.gatewayOnline ? 'text-emerald-300' : 'text-rose-300'}>
          VPS {status?.gatewayOnline ? 'connected' : 'offline'}
        </span>
      </button>

      <button
        type="button"
        onClick={() => openClientModal()}
        className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 hover:bg-slate-800/80 transition-colors text-left"
        title="Firma tunnel statuslary — basyp aç"
      >
        <Dot ok={!!status?.biClientDataAvailable} warn={status?.fromCache && status?.biClientDataAvailable} />
        <Database className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-slate-300 inline-flex items-center gap-1 flex-wrap">
          BI Client (
          {(() => {
            const list = status?.tenantStatuses || [];
            if (list.length <= 1) {
              return (
                <span className={status?.biClientDataAvailable ? 'text-emerald-300' : 'text-rose-300'}>
                  {formatAdminClientSummary(status)}
                </span>
              );
            }
            let live = 0;
            let offline = 0;
            for (const t of list) {
              if (t.online || t.live) live += 1;
              else offline += 1;
            }
            return (
              <>
                {live > 0 && (
                  <span className="text-emerald-300 font-medium">live({live})</span>
                )}
                {live > 0 && offline > 0 && <span className="text-slate-500">,</span>}
                {offline > 0 && (
                  <span className="text-amber-300 font-medium">offline({offline})</span>
                )}
                {live === 0 && offline === 0 && <span className="text-slate-500">—</span>}
              </>
            );
          })()}
          )
        </span>
      </button>

      <div className="inline-flex items-center gap-1.5 text-white" title="Soňky catalog sync">
        <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
        <span>
          Sync: <span className="text-white">{syncLabel}</span>
          <span className="mx-1 text-white/70">·</span>
          <span className="text-white">{intervalLabel}</span>
        </span>
      </div>

      {status && (
        <span className="text-white text-[10px] sm:text-[11px]">
          {status.counts.tenants}firma · {status.counts.endpoints}API · {status.counts.staff}işgär
        </span>
      )}

      {clientModalUi}
    </div>
  );
}
