'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Columns3,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  id: string;
  header: string;
  visible?: boolean;
  sortable?: boolean;
  width?: number;
  accessor: (row: T) => unknown;
  cell?: (row: T) => React.ReactNode;
  /** mobile card primary title */
  mobilePrimary?: boolean;
}

interface Props<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  storageKey?: string;
  searchPlaceholder?: string;
  pageSizeOptions?: number[];
  emptyMessage?: string;
  toolbarLeft?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
}

type SortDir = 'asc' | 'desc' | null;

function loadPrefs(key?: string) {
  if (!key || typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(`bi-dt:${key}`) || 'null');
  } catch {
    return null;
  }
}

function savePrefs(key: string | undefined, data: unknown) {
  if (!key || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`bi-dt:${key}`, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function DataTable<T>({
  columns: columnsProp,
  rows,
  rowKey,
  storageKey,
  searchPlaceholder = 'Gözle...',
  pageSizeOptions = [10, 25, 50],
  emptyMessage = 'Maglumat ýok',
  toolbarLeft,
  toolbarRight,
  onRowClick,
  selectedKey,
}: Props<T>) {
  const prefs = loadPrefs(storageKey);
  const [search, setSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showColFilters, setShowColFilters] = useState(false);
  const [sortId, setSortId] = useState<string | null>(() => prefs?.sortId ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(() => prefs?.sortDir ?? null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(() => prefs?.pageSize ?? pageSizeOptions[0] ?? 10);
  const [colOrder, setColOrder] = useState<string[]>(() => {
    const ids = columnsProp.map((c) => c.id);
    const saved: string[] = Array.isArray(prefs?.colOrder) ? prefs.colOrder : [];
    const kept = saved.filter((id: string) => ids.includes(id));
    const missing = ids.filter((id) => !kept.includes(id));
    return kept.length ? [...kept, ...missing] : ids;
  });
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    const base: Record<string, boolean> = {};
    for (const c of columnsProp) base[c.id] = c.visible !== false;
    const saved = (prefs?.visibility && typeof prefs.visibility === 'object') ? prefs.visibility : {};
    return { ...base, ...saved };
  });
  const [colsOpen, setColsOpen] = useState(false);
  const dragCol = useRef<string | null>(null);
  const prefsReady = useRef(false);

  // persist prefs (skip first paint to avoid overwriting with defaults before merge)
  useEffect(() => {
    if (!prefsReady.current) {
      prefsReady.current = true;
      // still save merged state once so key exists
      savePrefs(storageKey, { sortId, sortDir, pageSize, colOrder, visibility });
      return;
    }
    savePrefs(storageKey, { sortId, sortDir, pageSize, colOrder, visibility });
  }, [storageKey, sortId, sortDir, pageSize, colOrder, visibility]);

  // keep order / visibility in sync if new columns appear (never reset user choices)
  useEffect(() => {
    const ids = columnsProp.map((c) => c.id);
    setColOrder((prev) => {
      const kept = prev.filter((id) => ids.includes(id));
      const missing = ids.filter((id) => !kept.includes(id));
      return [...kept, ...missing];
    });
    setVisibility((prev) => {
      const next = { ...prev };
      for (const c of columnsProp) {
        if (next[c.id] === undefined) next[c.id] = c.visible !== false;
      }
      return next;
    });
  }, [columnsProp.map((c) => c.id).join('|')]);

  const orderedCols = useMemo(() => {
    const map = new Map(columnsProp.map((c) => [c.id, c]));
    return colOrder.map((id) => map.get(id)).filter(Boolean) as DataTableColumn<T>[];
  }, [columnsProp, colOrder]);

  const visibleCols = orderedCols.filter((c) => visibility[c.id] !== false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (q) {
        const hit = orderedCols.some((c) => {
          const v = c.accessor(row);
          return v != null && String(v).toLowerCase().includes(q);
        });
        if (!hit) return false;
      }
      for (const [colId, fv] of Object.entries(columnFilters)) {
        const needle = fv.trim().toLowerCase();
        if (!needle) continue;
        const col = orderedCols.find((c) => c.id === colId);
        if (!col) continue;
        const v = col.accessor(row);
        if (v == null || !String(v).toLowerCase().includes(needle)) return false;
      }
      return true;
    });
  }, [rows, search, orderedCols, columnFilters]);

  const sorted = useMemo(() => {
    if (!sortId || !sortDir) return filtered;
    const col = orderedCols.find((c) => c.id === sortId);
    if (!col) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.accessor(a);
      const bv = col.accessor(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * dir;
    });
  }, [filtered, sortId, sortDir, orderedCols]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const toggleSort = (id: string) => {
    const col = orderedCols.find((c) => c.id === id);
    if (col?.sortable === false) return;
    if (sortId !== id) {
      setSortId(id);
      setSortDir('asc');
    } else if (sortDir === 'asc') setSortDir('desc');
    else {
      setSortId(null);
      setSortDir(null);
    }
  };

  const onDragStart = (id: string) => {
    dragCol.current = id;
  };
  const onDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    const from = dragCol.current;
    if (!from || from === overId) return;
    setColOrder((prev) => {
      const next = [...prev];
      const fi = next.indexOf(from);
      const ti = next.indexOf(overId);
      if (fi < 0 || ti < 0) return prev;
      next.splice(fi, 1);
      next.splice(ti, 0, from);
      return next;
    });
    dragCol.current = overId;
  };

  const primaryCol =
    orderedCols.find((c) => c.mobilePrimary) || visibleCols[0] || orderedCols[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
          {toolbarLeft}
          <div className="relative flex-1 min-w-[140px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder={searchPlaceholder}
              className="w-full h-9 pl-8 pr-8 rounded-xl bg-slate-900/80 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
            <button
              type="button"
              onClick={() => setShowColFilters((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
                showColFilters
                  ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
              title="Sütün filterleri"
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
            </button>
        </div>
        <div className="flex items-center gap-2">
          {toolbarRight}
          <div className="relative">
            <button
              type="button"
              onClick={() => setColsOpen((v) => !v)}
              className="h-9 px-3 rounded-xl border border-slate-700 bg-slate-900/80 text-xs text-slate-300 inline-flex items-center gap-1.5"
            >
              <Columns3 className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Sütünler</span>
            </button>
            {colsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setColsOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-[min(14rem,calc(100vw-2rem))] max-h-[60vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-xl p-2">
                  {orderedCols.map((c) => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => onDragStart(c.id)}
                      onDragOver={(e) => onDragOver(e, c.id)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-sm cursor-grab"
                    >
                      <GripVertical className="h-3 w-3 text-slate-600" />
                      <label className="flex items-center gap-2 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visibility[c.id] !== false}
                          onChange={(e) =>
                            setVisibility((v) => ({ ...v, [c.id]: e.target.checked }))
                          }
                        />
                        <span className="text-slate-200 truncate">{c.header}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-left text-slate-400">
              {visibleCols.map((c) => (
                <th
                  key={c.id}
                  draggable
                  onDragStart={() => onDragStart(c.id)}
                  onDragOver={(e) => onDragOver(e, c.id)}
                  className="px-3 py-2.5 font-medium whitespace-nowrap text-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(c.id)}
                    className="inline-flex items-center gap-1.5 hover:text-slate-200"
                    disabled={c.sortable === false}
                  >
                    {c.header}
                    {c.sortable !== false &&
                      (sortId === c.id ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-indigo-400" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-indigo-400" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      ))}
                  </button>
                </th>
              ))}
            </tr>

            {showColFilters && (
            <tr className="bg-slate-950/90 border-b border-slate-800">
              {visibleCols.map((c) => (
                <th key={`f-${c.id}`} className="px-2 py-1.5 font-normal">
                  <input
                    className="w-full min-w-[4rem] rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/50"
                    placeholder="Filter..."
                    value={columnFilters[c.id] || ''}
                    onChange={(e) =>
                      setColumnFilters((prev) => ({ ...prev, [c.id]: e.target.value }))
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>
              ))}
            </tr>
            )}
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(visibleCols.length, 1)} className="px-4 py-12 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const key = rowKey(row);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'border-b border-slate-800/60',
                      onRowClick && 'cursor-pointer hover:bg-slate-900/50',
                      selectedKey === key && 'bg-indigo-500/10'
                    )}
                  >
                    {visibleCols.map((c) => (
                      <td key={c.id} className="px-3 py-2.5 text-slate-200">
                        {c.cell ? c.cell(row) : String(c.accessor(row) ?? '—')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — 2-column widget grid, labeled fields */}
      <div className="md:hidden grid grid-cols-1 xs:grid-cols-2 gap-3">
        {pageRows.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-slate-500 text-sm">
            {emptyMessage}
          </div>
        ) : (
          pageRows.map((row) => {
            const key = rowKey(row);
            const dataCols = visibleCols.filter((c) => c.id !== 'actions');
            const primary = primaryCol && dataCols.find((c) => c.id === primaryCol.id);
            const rest = dataCols.filter((c) => !primary || c.id !== primary.id);
            return (
              <div
                key={key}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-3 space-y-2 shadow-sm',
                  onRowClick && 'active:scale-[0.99] cursor-pointer',
                  selectedKey === key && 'border-indigo-500/50 ring-1 ring-indigo-500/20'
                )}
              >
                {primary && (
                  <div className="font-semibold text-white text-base leading-snug break-words border-b border-slate-800 pb-2">
                    {primary.cell ? primary.cell(row) : String(primary.accessor(row) ?? '')}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                  {rest.map((c) => {
                    const content = c.cell ? c.cell(row) : String(c.accessor(row) ?? '—');
                    return (
                      <div key={c.id} className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 truncate">{c.header}</p>
                        <div className="text-[13px] text-slate-200 leading-snug break-words mt-0.5">{content}</div>
                      </div>
                    );
                  })}
                </div>
                {visibleCols.find((c) => c.id === 'actions') && (
                  <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                    {visibleCols.find((c) => c.id === 'actions')!.cell?.(row)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>
            {sorted.length} · {safePage * pageSize + 1}–
            {Math.min((safePage + 1) * pageSize, sorted.length)}
          </span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            className="h-8 rounded-lg bg-slate-900 border border-slate-700 px-2 text-slate-300"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-700 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2">
            {safePage + 1}/{pageCount}
          </span>
          <button
            type="button"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-700 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
