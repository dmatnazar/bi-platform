'use client';

// Optimized LiveWidget:
// - TTL client cache for /api/gateway/query
// - IntersectionObserver lazy fetch (viewport)
// - Global filter: only API-bound keys affect queryKey
// - memo: layout x/y/w/h changes do not re-fetch

import { useEffect, useMemo, useRef, useState, memo } from 'react';
import type { DashboardWidget, GlobalFilterValues, ParamBinding } from '@/lib/types';
import {
  resolveWidgetParams,
  getGlobalSearchQuery,
  filterRowsByGlobalSearch,
} from '@/lib/types';
import { ChartWidget } from '@/components/charts/ChartWidget';
import { cn } from '@/lib/utils';
import { getEndpointCatalog, resolveLiveEndpoint, type CatalogEndpoint } from '@/lib/endpoint-catalog-client';

interface Props {
  widget: DashboardWidget;
  editable?: boolean;
  onConfigure?: () => void;
  globalFilters?: GlobalFilterValues;
  /** bump this number to force an immediate re-fetch (manual refresh button) */
  refreshToken?: number;
  className?: string;
}

const SEARCH_KEY_RE = /search|gözleg|gozleg|keyword|^q$|query/i;
const BEGIN_KEY_RE = /begin|start|from|dateFrom|^sene/i;
const END_KEY_RE = /end|gutar|to$|dateTo|until/i;

/** Client query cache: queryKey → { rows, at } */
const QUERY_CACHE = new Map<string, { rows: Record<string, unknown>[]; at: number }>();
const CACHE_TTL_MS = 45_000;
const MAX_CACHE_ENTRIES = 80;

function cacheGet(key: string): Record<string, unknown>[] | null {
  const hit = QUERY_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    QUERY_CACHE.delete(key);
    return null;
  }
  return hit.rows;
}

function cacheSet(key: string, rows: Record<string, unknown>[]) {
  QUERY_CACHE.set(key, { rows, at: Date.now() });
  if (QUERY_CACHE.size > MAX_CACHE_ENTRIES) {
    // drop oldest
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [k, v] of QUERY_CACHE) {
      if (v.at < oldestAt) {
        oldestAt = v.at;
        oldestKey = k;
      }
    }
    if (oldestKey) QUERY_CACHE.delete(oldestKey);
  }
}

/** Invalidate one key or entire cache (manual full refresh) */
export function invalidateWidgetQueryCache(key?: string) {
  if (key) QUERY_CACHE.delete(key);
  else QUERY_CACHE.clear();
}

function extractDatePart(v: string): string | null {
  const m = v.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function apiFilterValues(values: GlobalFilterValues): GlobalFilterValues {
  const out: GlobalFilterValues = {};
  for (const [k, v] of Object.entries(values)) {
    if (SEARCH_KEY_RE.test(k)) continue;
    if (v === '__ALL__' || v === '' || v === null || v === undefined) {
      out[k] = null;
      continue;
    }
    if (typeof v === 'string') {
      const datePart = extractDatePart(v);
      if (datePart && (BEGIN_KEY_RE.test(k) || END_KEY_RE.test(k) || /^\d{4}-\d{2}-\d{2}/.test(v))) {
        if (END_KEY_RE.test(k)) {
          out[k] = datePart + ' 23:59:59';
          continue;
        }
        if (BEGIN_KEY_RE.test(k)) {
          out[k] = datePart + ' 00:00:00';
          continue;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
          out[k] = datePart + ' 00:00:00';
          continue;
        }
      }
    }
    out[k] = v;
  }
  return out;
}

/**
 * Only global-filter keys that this widget actually binds to (paramBindings source=global).
 * Unrelated filter changes must not change queryKey / trigger fetch.
 */
function boundGlobalFilters(
  all: GlobalFilterValues,
  bindings?: ParamBinding[]
): GlobalFilterValues {
  if (!bindings?.length) {
    // No bindings declared → keep previous behavior (all API filters) for legacy widgets
    return all;
  }
  const globalKeys = new Set(
    bindings
      .filter((b) => b.source === 'global' && b.globalKey)
      .map((b) => String(b.globalKey))
  );
  if (globalKeys.size === 0) {
    // Widget ignores global filters entirely
    return {};
  }
  const out: GlobalFilterValues = {};
  for (const k of globalKeys) {
    if (k in all) out[k] = all[k];
  }
  return out;
}

function LoadingOverlay({ active }: { active: boolean }) {
  const [src, setSrc] = useState('/loading.gif');
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      setSrc((prev) => {
        if (prev.endsWith('.gif')) return '/loading.webp';
        if (prev.endsWith('.webp')) return '/loading.svg';
        return '/loading.gif';
      });
    }, 4000);
    return () => clearInterval(t);
  }, [active]);
  if (!active) return null;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/40 backdrop-blur-[1px] rounded-xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-10 w-10 opacity-80" />
    </div>
  );
}

function LiveWidgetInner({
  widget,
  editable,
  onConfigure,
  globalFilters = {},
  refreshToken,
  className,
}: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[] | undefined>(undefined);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const ds = widget.dataSource;

  // Lazy: only fetch when widget is near viewport
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            // once visible, keep loaded (don't unload when scrolled away)
            io.disconnect();
            break;
          }
        }
      },
      { root: null, rootMargin: '200px 0px', threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const [catalog, setCatalog] = useState<CatalogEndpoint[]>([]);
  useEffect(() => {
    let alive = true;
    getEndpointCatalog()
      .then((list) => {
        if (alive) setCatalog(list);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const resolved = useMemo(() => resolveLiveEndpoint(catalog, ds), [catalog, ds]);

  const searchQuery = useMemo(() => getGlobalSearchQuery(globalFilters), [globalFilters]);
  const allApiFilters = useMemo(() => apiFilterValues(globalFilters), [globalFilters]);
  const apiFilters = useMemo(
    () => boundGlobalFilters(allApiFilters, ds?.paramBindings),
    [allApiFilters, ds?.paramBindings]
  );
  const apiFiltersKey = useMemo(() => JSON.stringify(apiFilters), [apiFilters]);

  const paramsKey = useMemo(
    () => JSON.stringify(ds?.params || {}) + '|' + JSON.stringify(ds?.paramBindings || {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(ds?.params), JSON.stringify(ds?.paramBindings)]
  );

  // refreshToken intentionally in key so manual refresh bypasses TTL cache
  const queryKey = useMemo(
    () =>
      [
        resolved?.tenantSlug || '',
        resolved?.path || '',
        resolved?.method || 'GET',
        resolved?.dbKey || 'primary',
        paramsKey,
        apiFiltersKey,
      ].join('::'),
    [
      resolved?.tenantSlug,
      resolved?.path,
      resolved?.method,
      resolved?.dbKey,
      paramsKey,
      apiFiltersKey,
    ]
  );

  const lastFetchedKey = useRef<string>('');
  const inflightKey = useRef<string>('');
  const lastRefreshHandled = useRef<number>(0);
  const hasRowsRef = useRef(false);
  useEffect(() => {
    hasRowsRef.current = rows !== undefined;
  }, [rows]);

  useEffect(() => {
    if (!inView) return;
    if (!resolved?.tenantSlug || !resolved?.path) {
      setRows(undefined);
      lastFetchedKey.current = '';
      return;
    }

    // Manual refresh: only when token actually increases (not every re-render)
    const token = typeof refreshToken === 'number' ? refreshToken : 0;
    const force = token > 0 && token !== lastRefreshHandled.current;
    // Same query already in component state
    if (!force && lastFetchedKey.current === queryKey && hasRowsRef.current) {
      return;
    }

    // TTL cache hit (skip network) — still respect force refresh
    if (!force) {
      const cached = cacheGet(queryKey);
      if (cached) {
        setRows(cached);
        lastFetchedKey.current = queryKey;
        setLoading(false);
        setError('');
        return;
      }
    } else {
      QUERY_CACHE.delete(queryKey);
      lastRefreshHandled.current = token;
    }

    let cancelled = false;
    async function load(showOverlay: boolean) {
      if (inflightKey.current === queryKey && !force) return;
      inflightKey.current = queryKey;
      if (showOverlay) setLoading(true);
      setError('');
      try {
        const params = resolveWidgetParams(ds, apiFilters);
        const res = await fetch('/api/gateway/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantSlug: resolved!.tenantSlug,
            path: resolved!.path,
            method: resolved!.method || 'GET',
            dbKey: resolved!.dbKey || 'primary',
            params,
          }),
        });
        const data = await res.json();
        if (!cancelled) {
          if (!res.ok) setError(data.error || 'API säwlik');
          else {
            const next = Array.isArray(data.rows) ? data.rows : [];
            setRows(next);
            cacheSet(queryKey, next);
            lastFetchedKey.current = queryKey;
          }
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (inflightKey.current === queryKey) inflightKey.current = '';
        if (!cancelled) setLoading(false);
      }
    }

    void load(!hasRowsRef.current || force);

    const sec = ds?.refreshSec || 0;
    const id =
      sec > 0
        ? setInterval(() => {
            lastFetchedKey.current = '';
            QUERY_CACHE.delete(queryKey);
            void load(false);
          }, sec * 1000)
        : null;

    return () => {
      cancelled = true;
      if (id) clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, queryKey, resolved?.tenantSlug, resolved?.path, ds?.refreshSec, refreshToken]);

  const displayRows = useMemo(() => {
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
  }, [rows, searchQuery, ds?.hiddenColumns]);

  return (
    <div ref={rootRef} className="relative h-full min-h-0 flex flex-col">
      <LoadingOverlay active={loading} />
      {error && (
        <div className="absolute inset-x-2 bottom-2 z-30 text-[10px] text-rose-400 bg-rose-500/10 rounded px-2 py-1 truncate">
          {error}
        </div>
      )}
      {!inView && rows === undefined && (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-slate-600">
          …
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
          className={cn('h-full', className)}
        />
      </div>
    </div>
  );
}

function liveWidgetPropsEqual(a: Props, b: Props): boolean {
  if (a.widget.id !== b.widget.id) return false;
  if (a.editable !== b.editable) return false;
  if (a.refreshToken !== b.refreshToken) return false;
  if (a.className !== b.className) return false;
  const aw = a.widget;
  const bw = b.widget;
  if (aw.type !== bw.type) return false;
  if (aw.title !== bw.title) return false;
  if (aw.staticValue !== bw.staticValue) return false;
  if (JSON.stringify(aw.dataSource) !== JSON.stringify(bw.dataSource)) return false;
  if (JSON.stringify(aw.config) !== JSON.stringify(bw.config)) return false;
  if (JSON.stringify(a.globalFilters || {}) !== JSON.stringify(b.globalFilters || {})) return false;
  return true;
}

export const LiveWidget = memo(LiveWidgetInner, liveWidgetPropsEqual);
export default LiveWidget;
