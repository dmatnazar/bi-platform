'use client';

/**
 * Reusable API picker — table + search + optional company auto-filter.
 * Used by widget config and any other place that needs to pick an endpoint.
 */
import { useEffect, useMemo, useState } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ApiPickerEndpoint {
  id: string;
  name: string;
  method?: string;
  pathTemplate?: string;
  tenantSlug?: string;
  dbKey?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  endpoints: ApiPickerEndpoint[];
  value?: string;
  onSelect: (ep: ApiPickerEndpoint) => void;
  /** Prefer showing this company's APIs first / default filter */
  preferredTenantSlug?: string;
  title?: string;
}

export function ApiPickerModal({
  open,
  onClose,
  endpoints,
  value,
  onSelect,
  preferredTenantSlug,
  title = 'API saýlaň (data source)',
}: Props) {
  const [q, setQ] = useState('');
  const [slugFilter, setSlugFilter] = useState<string>(preferredTenantSlug || '');
  const [autoFilter, setAutoFilter] = useState(Boolean(preferredTenantSlug));
  const [sortKey, setSortKey] = useState<'name' | 'method' | 'path' | 'tenant' | 'db'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  useEffect(() => {
    if (open) {
      setQ('');
      if (preferredTenantSlug) {
        setSlugFilter(preferredTenantSlug);
        setAutoFilter(true);
      }
    }
  }, [open, preferredTenantSlug]);

  const tenantOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of endpoints) {
      if (e.tenantSlug) set.add(e.tenantSlug);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tk'));
  }, [endpoints]);

  const filtered = useMemo(() => {
    let list = [...endpoints];
    const activeSlug = autoFilter ? preferredTenantSlug || slugFilter : slugFilter;
    if (activeSlug) {
      list = list.filter((e) => e.tenantSlug === activeSlug);
    }
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((e) => {
        const hay = `${e.name} ${e.method || ''} ${e.pathTemplate || ''} ${e.tenantSlug || ''} ${e.dbKey || ''}`.toLowerCase();
        return hay.includes(query);
      });
    }
    list.sort((a, b) => {
      if (preferredTenantSlug && !activeSlug) {
        const ap = a.tenantSlug === preferredTenantSlug ? 0 : 1;
        const bp = b.tenantSlug === preferredTenantSlug ? 0 : 1;
        if (ap !== bp) return ap - bp;
      }
      const av =
        sortKey === 'method'
          ? a.method || ''
          : sortKey === 'path'
            ? a.pathTemplate || ''
            : sortKey === 'tenant'
              ? a.tenantSlug || ''
              : sortKey === 'db'
                ? a.dbKey || ''
                : a.name || '';
      const bv =
        sortKey === 'method'
          ? b.method || ''
          : sortKey === 'path'
            ? b.pathTemplate || ''
            : sortKey === 'tenant'
              ? b.tenantSlug || ''
              : sortKey === 'db'
                ? b.dbKey || ''
                : b.name || '';
      const cmp = String(av).localeCompare(String(bv), 'tk', { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [endpoints, q, slugFilter, autoFilter, preferredTenantSlug, sortKey, sortDir]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2147483000] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full sm:max-w-3xl max-h-[min(92dvh,720px)] flex flex-col rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
            <p className="text-[10px] text-slate-500">
              {filtered.length} / {endpoints.length} API
              {preferredTenantSlug ? ` · dashboard firma: ${preferredTenantSlug}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-2.5 border-b border-slate-800 space-y-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Gözle: ady, path, method, firma…"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-700 bg-slate-950 text-sm text-white placeholder:text-slate-600"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {preferredTenantSlug && (
              <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-slate-600"
                  checked={autoFilter}
                  onChange={(e) => {
                    setAutoFilter(e.target.checked);
                    if (e.target.checked) setSlugFilter(preferredTenantSlug);
                    else setSlugFilter('');
                  }}
                />
                <Filter className="h-3 w-3 text-indigo-400" />
                Awto: diňe bu firma
              </label>
            )}
            <select
              value={autoFilter ? preferredTenantSlug || '' : slugFilter}
              disabled={autoFilter && !!preferredTenantSlug}
              onChange={(e) => {
                setAutoFilter(false);
                setSlugFilter(e.target.value);
              }}
              className="h-8 rounded-lg border border-slate-700 bg-slate-950 px-2 text-[11px] text-white disabled:opacity-60"
            >
              <option value="">Ähli firmalar</option>
              {tenantOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                {(
                  [
                    ['method', 'Method', ''],
                    ['name', 'Ady', ''],
                    ['path', 'Path', 'hidden sm:table-cell'],
                    ['tenant', 'Firma', ''],
                    ['db', 'DB', 'hidden md:table-cell'],
                  ] as const
                ).map(([key, label, cls]) => (
                  <th
                    key={key}
                    className={`px-3 py-2 font-medium cursor-pointer select-none hover:text-indigo-300 ${cls}`}
                    onClick={() => toggleSort(key)}
                  >
                    {label}
                    {sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                    Netije ýok
                  </td>
                </tr>
              ) : (
                filtered.map((e) => {
                  const selected = value === e.id;
                  return (
                    <tr
                      key={e.id}
                      onClick={() => {
                        onSelect(e);
                        onClose();
                      }}
                      className={cn(
                        'cursor-pointer transition-colors',
                        selected
                          ? 'bg-indigo-500/15 text-white'
                          : 'hover:bg-slate-800/70 text-slate-200'
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            'font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded',
                            e.method === 'POST'
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'bg-emerald-500/15 text-emerald-300'
                          )}
                        >
                          {e.method || 'GET'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium max-w-[140px] sm:max-w-none truncate">
                        {e.name}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-400 hidden sm:table-cell max-w-[200px] truncate">
                        {e.pathTemplate}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">{e.tenantSlug}</td>
                      <td className="px-3 py-2.5 text-slate-500 hidden md:table-cell">
                        {e.dbKey || 'primary'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
