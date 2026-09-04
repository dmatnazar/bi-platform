'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';
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
  if (list.length > 1) {
    return list
      .map((t) => {
        const state = t.online ? 'online' : t.live ? 'live' : 'offline';
        return `${t.name} ${state}`;
      })
      .join(', ');
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
    if (!clientModal) return;
    const t = setTimeout(() => setClientModal(false), 5000);
    return () => clearTimeout(t);
  }, [clientModal]);

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

  // Viewer / company user: still show live sync strip (not only VPS)
  if (!isSuperAdmin) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-300 px-1 py-1.5">
        <div className="inline-flex items-center gap-1.5" title="VPS Gateway">
          <Dot ok={!!status?.gatewayOnline} />
          {status?.gatewayOnline ? (
            <Cloud className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <CloudOff className="h-3.5 w-3.5 text-rose-400" />
          )}
          <span className={status?.gatewayOnline ? 'text-emerald-300' : 'text-rose-300'}>
            VPS {status?.gatewayOnline ? 'online' : 'offline'}
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 max-w-full" title="BI Client / catalog">
          <Dot ok={!!status?.biClientDataAvailable} warn={!!status?.fromCache && status?.biClientDataAvailable} />
          <Database className="h-3.5 w-3.5 text-sky-400 shrink-0" />
          <span className={status?.biClientDataAvailable ? 'text-sky-300 truncate' : 'text-slate-500 truncate'}>
            BI Client ({formatClientLabel(status, companyName)})
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 text-white">
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          <span>
            Sync: <span className="text-white">{syncLabel}</span>
            <span className="text-white/80"> · {intervalLabel}</span>
          </span>
        </div>
        {(companyName || status?.scoped?.companyName) && (
          <span className="text-slate-500 truncate max-w-[160px]">
            {companyName || status?.scoped?.companyName}
          </span>
        )}
        {/* Viewer: no global firma/API/işgär counts */}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400 px-1 py-1.5">
      <div className="inline-flex items-center gap-1.5" title="VPS Gateway /health">
        <Dot ok={!!status?.gatewayOnline} />
        {status?.gatewayOnline ? (
          <Cloud className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <CloudOff className="h-3.5 w-3.5 text-rose-400" />
        )}
        <span className={status?.gatewayOnline ? 'text-emerald-300' : 'text-rose-300'}>
          VPS {status?.gatewayOnline ? 'connected' : 'offline'}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setClientModal(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 hover:bg-slate-800/80 transition-colors text-left"
        title="Firma tunnel statuslary — basyp aç"
      >
        <Dot ok={!!status?.biClientDataAvailable} warn={status?.fromCache && status?.biClientDataAvailable} />
        <Database className="h-3.5 w-3.5 text-slate-400" />
        <span
          className={
            status?.biClientDataAvailable
              ? status.fromCache
                ? 'text-amber-300'
                : 'text-emerald-300'
              : 'text-rose-300'
          }
        >
          BI Client ({formatAdminClientSummary(status)})
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
        <span className="text-white hidden sm:inline">
          {status.counts.tenants} firma · {status.counts.endpoints} API · {status.counts.staff} işgär
        </span>
      )}

      {clientModal && (
        <div className="fixed inset-0 z-[2147483000] flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setClientModal(false)} />
          <div className="relative w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden max-h-[min(70dvh,420px)] flex flex-col">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800 shrink-0">
              <p className="text-sm font-semibold text-white">BI Client — firmalar</p>
              <button
                type="button"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                onClick={() => setClientModal(false)}
                aria-label="Ýap"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-800">
              {(status?.tenantStatuses || []).length === 0 ? (
                <li className="px-3 py-4 text-xs text-slate-500 text-center">Firma statusy ýok</li>
              ) : (
                (status?.tenantStatuses || []).map((t) => {
                  const state = t.online ? 'online' : t.live ? 'live' : 'offline';
                  const color =
                    state === 'online' || state === 'live'
                      ? 'text-emerald-300'
                      : 'text-rose-300';
                  return (
                    <li key={t.slug} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                      <span className="text-slate-200 truncate">{t.name}</span>
                      <span className={`text-[11px] font-medium ${color}`}>{state}</span>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
