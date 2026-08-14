'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';
import { Cloud, CloudOff, Database, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface Props {
  /** super_admin sees global counts; others see company-scoped or nothing detailed */
  isSuperAdmin?: boolean;
  companyName?: string;
}

export function ConnectionStatusBar({ isSuperAdmin = false, companyName }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);

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

  // Non-super: minimal status only
  if (!isSuperAdmin) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400 px-1 py-1.5">
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
        {(companyName || status?.scoped?.companyName) && (
          <span className="text-slate-500 truncate max-w-[200px]">
            {companyName || status?.scoped?.companyName}
          </span>
        )}
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

      <div
        className="inline-flex items-center gap-1.5"
        title={
          status?.fromCache
            ? 'Maglumat local cache-den'
            : 'Maglumat VPS-den täze alyndy'
        }
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
          BI Client {status?.biClientDataAvailable ? (status.fromCache ? 'cache' : 'live') : 'ýok'}
        </span>
      </div>

      <div className="inline-flex items-center gap-1.5 text-slate-500" title="Soňky catalog sync">
        <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
        <span>
          Sync: <span className="text-slate-300">{syncLabel}</span>
          <span className="mx-1 opacity-40">·</span>
          {intervalLabel}
        </span>
      </div>

      {status && (
        <span className="text-slate-600 hidden sm:inline">
          {status.counts.tenants} firma · {status.counts.endpoints} API · {status.counts.staff} işgär
        </span>
      )}
    </div>
  );
}
