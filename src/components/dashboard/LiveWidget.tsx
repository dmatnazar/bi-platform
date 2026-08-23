'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DashboardWidget, GlobalFilterValues } from '@/lib/types';
import {
  resolveWidgetParams,
  getGlobalSearchQuery,
  filterRowsByGlobalSearch,
} from '@/lib/types';
import { ChartWidget } from '@/components/charts/ChartWidget';
import { Settings2 } from 'lucide-react';

interface Props {
  widget: DashboardWidget;
  editable?: boolean;
  onConfigure?: () => void;
  globalFilters?: GlobalFilterValues;
}

const SEARCH_KEY_RE = /search|gözleg|gozleg|keyword|^q$|query/i;
const BEGIN_KEY_RE = /begin|start|from|dateFrom|^sene/i;
const END_KEY_RE = /end|gutar|to$|dateTo|until/i;

/** Extract YYYY-MM-DD from date / datetime-local / ISO strings */
function extractDatePart(v: string): string | null {
  const m = v.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/**
 * API-bound filters only (exclude pure text search — handled client-side).
 * Date/datetime params always expand to full-day bounds:
 *   begin* → YYYY-MM-DD 00:00:00
 *   end*   → YYYY-MM-DD 23:59:59
 * so picking "today" never sends the wall-clock time (e.g. 15:22:01).
 */
function apiFilterValues(values: GlobalFilterValues): GlobalFilterValues {
  const out: GlobalFilterValues = {};
  for (const [k, v] of Object.entries(values)) {
    if (SEARCH_KEY_RE.test(k)) continue;
    // Hemmesini saýla / boş → NULL (SQL: @id IS NULL OR col=@id)
    if (v === '__ALL__' || v === '' || v === null || v === undefined) {
      out[k] = null;
      continue;
    }
    if (typeof v === 'string') {
      const datePart = extractDatePart(v);
      if (datePart && (BEGIN_KEY_RE.test(k) || END_KEY_RE.test(k) || /^\d{4}-\d{2}-\d{2}/.test(v))) {
        if (END_KEY_RE.test(k)) {
          // Literal local end-of-day — no Date()/toISOString (UTC shift)
          out[k] = datePart + ' 23:59:59';
          continue;
        }
        if (BEGIN_KEY_RE.test(k)) {
          out[k] = datePart + ' 00:00:00';
          continue;
        }
        // Generic date-looking value without begin/end in key: keep date-only day start
        if (/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
          out[k] = `${datePart} 00:00:00`;
          continue;
        }
      }
    }
    out[k] = v;
  }
  return out;
}

function LoadingOverlay({ active }: { active: boolean }) {
  const [src, setSrc] = useState('/loading.gif');
  if (!active) return null;
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-slate-950/55 backdrop-blur-[2px] rounded-xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Ýüklenýär"
        className="h-14 w-14 object-contain"
        onError={() => {
          setSrc((prev) => {
            if (prev.endsWith('.gif')) return '/loading.webp';
            if (prev.endsWith('.webp')) return '/loading.svg';
            return prev;
          });
        }}
      />
      <span className="text-[11px] text-slate-400">Ýüklenýär...</span>
    </div>
  );
}

export function LiveWidget({ widget, editable, onConfigure, globalFilters = {} }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[] | undefined>(undefined);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const ds = widget.dataSource;

  const searchQuery = useMemo(() => getGlobalSearchQuery(globalFilters), [globalFilters]);
  const apiFilters = useMemo(() => apiFilterValues(globalFilters), [globalFilters]);
  const apiFiltersKey = useMemo(() => JSON.stringify(apiFilters), [apiFilters]);

  useEffect(() => {
    if (!ds?.tenantSlug || !ds?.path) {
      setRows(undefined);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = resolveWidgetParams(ds, apiFilters);
        const res = await fetch('/api/gateway/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantSlug: ds!.tenantSlug,
            path: ds!.path,
            method: ds!.method || 'GET',
            dbKey: ds!.dbKey || 'primary',
            params,
          }),
        });
        const data = await res.json();
        if (!cancelled) {
          if (!res.ok) setError(data.error || 'API säwlik');
          else setRows(Array.isArray(data.rows) ? data.rows : []);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const sec = ds.refreshSec || 0;
    const id = sec > 0 ? setInterval(load, sec * 1000) : null;
    return () => {
      cancelled = true;
      if (id) clearInterval(id);
    };
  }, [
    ds?.tenantSlug,
    ds?.path,
    ds?.method,
    ds?.dbKey,
    ds?.refreshSec,
    JSON.stringify(ds?.params),
    JSON.stringify(ds?.paramBindings),
    apiFiltersKey,
  ]);

  const displayRows = useMemo(
    () => {
      let r = filterRowsByGlobalSearch(rows, searchQuery);
      const hide = ds?.hiddenColumns || [];
      if (hide.length && r?.length) {
        r = r.map((row) => {
          const o = { ...row };
          for (const h of hide) delete o[h];
          return o;
        });
      }
      return r;
    },
    [rows, searchQuery]
  );

  return (
    <div className="relative h-full min-h-0 flex flex-col">

      <LoadingOverlay active={loading} />
      {error && (
        <div className="absolute inset-x-2 bottom-2 z-30 text-[10px] text-rose-400 bg-rose-500/10 rounded px-2 py-1 truncate">
          {error}
        </div>
      )}
      <div
        className={
          loading
            ? 'opacity-40 pointer-events-none transition-opacity flex-1 min-h-0 h-full'
            : 'transition-opacity flex-1 min-h-0 h-full'
        }
      >
        <ChartWidget
          widget={widget}
          data={displayRows}
          globalSearch={searchQuery}
          globalFilters={apiFilters}
          className="h-full"
        />
      </div>
    </div>
  );
}
