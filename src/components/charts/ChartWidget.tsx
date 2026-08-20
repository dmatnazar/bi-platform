'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { DashboardWidget, GlobalFilterValues } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  Filter,
  GripVertical,
  Loader2,
  Search,
  X,
} from 'lucide-react';

const DEMO_BAR = [
  { name: 'Ýan', value: 420 },
  { name: 'Few', value: 380 },
  { name: 'Mar', value: 510 },
  { name: 'Apr', value: 460 },
  { name: 'Maý', value: 590 },
  { name: 'Iýun', value: 640 },
];

const DEMO_PIE = [
  { name: 'Haryt A', value: 35 },
  { name: 'Haryt B', value: 28 },
  { name: 'Haryt C', value: 22 },
  { name: 'Beýleki', value: 15 },
];

interface Props {
  widget: DashboardWidget;
  data?: Record<string, unknown>[];
  className?: string;
  /** dashboard-level search (already applied upstream; also used for table highlight) */
  globalSearch?: string;
  /** current global filter values — used for drill-down child API */
  globalFilters?: GlobalFilterValues;
}

type SortSpec = { field: string; dir: 'asc' | 'desc' };

function compareValues(av: unknown, bv: unknown, dir: 'asc' | 'desc'): number {
  const mult = dir === 'asc' ? 1 : -1;
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mult;
  const an = Number(av);
  const bn = Number(bv);
  if (
    !Number.isNaN(an) &&
    !Number.isNaN(bn) &&
    String(av).trim() !== '' &&
    String(bv).trim() !== ''
  ) {
    return (an - bn) * mult;
  }
  return (
    String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * mult
  );
}

function TableWidgetBody({
  widget,
  data,
  className,
  globalFilters = {},
}: {
  widget: DashboardWidget;
  data?: Record<string, unknown>[];
  className?: string;
  globalFilters?: GlobalFilterValues;
}) {
  // Only show demo sample when widget has NO dataSource (preview mode).
  // If API returned empty array → show empty state, not static demo rows.
  const hasDataSource = !!(widget.dataSource?.path || widget.dataSource?.endpointId);
  const rows = (
    data !== undefined
      ? data
      : hasDataSource
        ? []
        : (DEMO_BAR as unknown as Record<string, unknown>[])
  ) as Record<string, unknown>[];

  const row0Key = rows[0] ? Object.keys(rows[0]).join('\0') : '';
  const allKeys = useMemo(() => {
    if (row0Key) return row0Key.split('\0');
    if (widget.dataSource?.columns?.length) return [...widget.dataSource.columns];
    return hasDataSource ? [] : ['name', 'value'];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row0Key, widget.dataSource?.columns?.join('\0'), hasDataSource]);

  // dataKeys = visible columns (from config columns or all)
  const dataKeys = useMemo(() => {
    if (widget.dataSource?.columns?.length) {
      const cfg = widget.dataSource.columns;
      const extra = allKeys.filter((k) => !cfg.includes(k));
      return [...cfg, ...extra];
    }
    return allKeys;
  }, [widget.dataSource?.columns, allKeys]);

  const [colOrder, setColOrder] = useState<string[]>(dataKeys);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [showColPicker, setShowColPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [showColFilters, setShowColFilters] = useState(false);
  const [sorts, setSorts] = useState<SortSpec[]>(widget.dataSource?.orderBy || []);
  const enableSearch = widget.dataSource?.enableSearch !== false;
  const dragCol = useRef<string | null>(null);

  // Drill-down state
  const dd = widget.dataSource?.drillDown;
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillTitle, setDrillTitle] = useState('');
  const [drillRows, setDrillRows] = useState<Record<string, unknown>[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState('');

  const visibleCols = useMemo(
    () => colOrder.filter((c) => !hiddenCols.has(c)),
    [colOrder, hiddenCols]
  );

  // sync new columns from data without wiping user order (only when keys actually change)
  const dataKeysKey = dataKeys.join('\0');
  useEffect(() => {
    setColOrder((prev) => {
      const kept = prev.filter((c) => dataKeys.includes(c));
      const missing = dataKeys.filter((c) => !kept.includes(c));
      const next = [...kept, ...missing];
      // Avoid infinite loop: only update state if order/content changed
      if (next.length === prev.length && next.every((c, i) => c === prev[i])) {
        return prev;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKeysKey]);

  async function openDrillDown(row: Record<string, unknown>) {
    if (!dd?.enabled || !dd.sourceField || !dd.path || !dd.tenantSlug) return;
    const value = row[dd.sourceField];
    if (value == null || value === '') return;

    const title = (dd.titleTemplate || '{field}: {value}')
      .replace('{field}', dd.sourceField)
      .replace('{value}', String(value));
    setDrillTitle(title);
    setDrillOpen(true);
    setDrillLoading(true);
    setDrillError('');
    setDrillRows([]);

    try {
      const targetParam = dd.targetParam || dd.sourceField;
      const params: Record<string, string | number | boolean> = {
        [targetParam]: value as string | number | boolean,
      };
      if (dd.passGlobalFilters !== false) {
        for (const [k, v] of Object.entries(globalFilters)) {
          if (v != null && v !== '') params[k] = v as string | number | boolean;
        }
      }
      const res = await fetch('/api/gateway/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: dd.tenantSlug,
          path: dd.path,
          method: dd.method || 'GET',
          dbKey: dd.dbKey || 'primary',
          params,
        }),
      });
      const data = await res.json();
      if (!res.ok) setDrillError(data.error || 'API säwlik');
      else setDrillRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (e) {
      setDrillError(String(e));
    } finally {
      setDrillLoading(false);
    }
  }

  const activeColFilterCount = useMemo(
    () =>
      Object.values(colFilters).filter((v) => {
        const s = (v || '').trim();
        return s && s !== '__ALL__';
      }).length,
    [colFilters]
  );

  const filtered = useMemo(() => {
    let out = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((row) =>
        colOrder.some((c) => {
          const v = row[c];
          return v != null && String(v).toLowerCase().includes(q);
        })
      );
    }
    for (const [col, fv] of Object.entries(colFilters)) {
      const raw = (fv || '').trim();
      // __ALL__ / boş = filter ýok (ähli hatlar)
      if (!raw || raw === '__ALL__') continue;
      // __NONE__ = hiç zat görkezme
      if (raw === '__NONE__') {
        out = [];
        break;
      }
      const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length > 1 || raw.includes(',')) {
        const set = new Set(parts.map((s) => s.toLowerCase()));
        out = out.filter((row) => {
          const v = row[col];
          return v != null && set.has(String(v).toLowerCase());
        });
      } else {
        const f = raw.toLowerCase();
        // exact match if from checkbox single; also allow substring for typed
        out = out.filter((row) => {
          const v = row[col];
          if (v == null) return false;
          const s = String(v).toLowerCase();
          return s === f || s.includes(f);
        });
      }
    }
    return out;
  }, [rows, search, colFilters, colOrder]);

  const sorted = useMemo(() => {
    if (!sorts.length) return filtered;
    return [...filtered].sort((a, b) => {
      for (const s of sorts) {
        const cmp = compareValues(a[s.field], b[s.field], s.dir);
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  }, [filtered, sorts]);

  function toggleSort(field: string, multi: boolean) {
    setSorts((prev) => {
      const idx = prev.findIndex((s) => s.field === field);
      if (!multi) {
        if (idx < 0) return [{ field, dir: 'asc' }];
        if (prev[idx].dir === 'asc') return [{ field, dir: 'desc' }];
        return [];
      }
      if (idx < 0) return [...prev, { field, dir: 'asc' }];
      const next = [...prev];
      if (next[idx].dir === 'asc') next[idx] = { field, dir: 'desc' };
      else next.splice(idx, 1);
      return next;
    });
  }

  function sortIcon(field: string) {
    const s = sorts.find((x) => x.field === field);
    if (!s) return <ArrowUpDown className="h-3 w-3 opacity-40 shrink-0" />;
    const n = sorts.length > 1 ? sorts.findIndex((x) => x.field === field) + 1 : null;
    return (
      <span className="inline-flex items-center gap-0.5 text-indigo-400 shrink-0">
        {s.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {n != null && <span className="text-[9px] font-bold">{n}</span>}
      </span>
    );
  }

  function onDragStart(id: string) {
    dragCol.current = id;
  }
  function onDragOver(e: React.DragEvent, overId: string) {
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
  }

  function clearFilters() {
    setSearch('');
    setColFilters({});
  }

  return (
    <div className={cn('h-full max-h-full flex flex-col min-h-0 overflow-hidden gap-1.5', className)}>
      {/* Toolbar — same style as global/table search */}
      <div className="shrink-0 flex items-center gap-1.5 w-full">
          {enableSearch ? (
            <div className="relative flex-1 min-w-0 max-w-full">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tablo gözle..."
                className="w-full h-8 pl-7 pr-7 rounded-lg bg-slate-950/80 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 min-w-0" aria-hidden />
          )}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => setShowColFilters((v) => !v)}
            className={cn(
              'h-8 px-2 rounded-lg border text-xs inline-flex items-center gap-1 shrink-0',
              showColFilters || activeColFilterCount
                ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                : 'border-slate-700 bg-slate-950/80 text-slate-400 hover:text-slate-200'
            )}
            title="Sütün filterleri"
          >
            <Filter className="h-3.5 w-3.5" />
            {activeColFilterCount > 0 ? activeColFilterCount : 'Filter'}
          </button>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowColPicker((v) => !v)}
              className={cn(
                'h-8 px-2 rounded-lg border text-xs inline-flex items-center gap-1',
                showColPicker || hiddenCols.size
                  ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                  : 'border-slate-700 bg-slate-950/80 text-slate-400 hover:text-slate-200'
              )}
              title="Sütünleri görkez / gizle"
            >
              <Columns3 className="h-3.5 w-3.5" />
              Sütünler
              {hiddenCols.size > 0 && (
                <span className="text-[10px] opacity-80">({visibleCols.length}/{colOrder.length})</span>
              )}
            </button>
            {showColPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowColPicker(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-56 max-h-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl p-2 space-y-0.5">
                  <div className="flex gap-1 mb-1.5">
                    <button
                      type="button"
                      className="flex-1 text-[10px] py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                      onClick={() => setHiddenCols(new Set())}
                    >
                      Hemmesi
                    </button>
                    <button
                      type="button"
                      className="flex-1 text-[10px] py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                      onClick={() => setHiddenCols(new Set(colOrder))}
                    >
                      Hiçisi
                    </button>
                  </div>
                  {colOrder.map((c) => (
                    <label
                      key={c}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenCols.has(c)}
                        onChange={(e) => {
                          setHiddenCols((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.delete(c);
                            else next.add(c);
                            return next;
                          });
                        }}
                        className="rounded border-slate-600"
                      />
                      <span className="text-slate-200 truncate">{c}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          {(search || activeColFilterCount > 0) && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-8 px-2 rounded-lg border border-slate-700 text-[11px] text-slate-400 hover:text-white shrink-0"
            >
              Arassala
            </button>
          )}
          </div>
        </div>

      <div className="hidden md:block flex-1 min-h-0 overflow-x-auto overflow-y-auto -mx-0.5 px-0.5 overscroll-contain">
        <table className="w-full text-sm min-w-[280px] border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-slate-400">
              {visibleCols.map((c) => (
                <th
                  key={c}
                  draggable
                  onDragStart={() => onDragStart(c)}
                  onDragOver={(e) => onDragOver(e, c)}
                  onDragEnd={() => {
                    dragCol.current = null;
                  }}
                  className="py-1.5 pr-2 font-medium sticky top-0 bg-slate-900/95 backdrop-blur z-10 border-b border-slate-700 cursor-grab active:cursor-grabbing select-none"
                >
                  <div className="inline-flex items-center gap-1 max-w-full">
                    <GripVertical className="h-3 w-3 text-slate-600 shrink-0" />
                    <button
                      type="button"
                      onClick={(e) => toggleSort(c, e.shiftKey || e.metaKey || e.ctrlKey)}
                      className="inline-flex items-center gap-1 hover:text-slate-200 min-w-0"
                      title="Sort · Shift+klik = multi · Sütüni süýşürip tertip çalyş"
                    >
                      <span className="truncate">{c}</span>
                      {sortIcon(c)}
                    </button>
                  </div>
                </th>
              ))}
            </tr>
            {showColFilters && (
              <tr className="bg-slate-950/80">
                {visibleCols.map((c) => (
                  <th key={`f-${c}`} className="py-1 pr-2 sticky top-8 z-10 bg-slate-950/95 border-b border-slate-800">
                    <input
                      value={colFilters[c] || ''}
                      onChange={(e) => setColFilters((prev: any) => ({ ...prev, [c]: e.target.value }))}
                      placeholder="Filter..."
                      className="w-full text-[11px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 outline-none"
                    />
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(visibleCols.length, 1)}
                  className="py-10 text-center text-slate-500 text-sm"
                >
                  {search || activeColFilterCount
                    ? 'Filter boýunça netije ýok'
                    : hasDataSource
                      ? 'Maglumat tapylmady'
                      : 'Maglumat ýok'}
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr
                  key={i}
                  className={cn(
                    'border-b border-slate-800/80 text-slate-200 hover:bg-slate-800/30',
                    dd?.enabled && 'cursor-pointer hover:bg-indigo-500/10'
                  )}
                  onClick={() => {
                    if (dd?.enabled) openDrillDown(row);
                  }}
                  title={dd?.enabled ? `Detal: ${dd.sourceField}` : undefined}
                >
                  {visibleCols.map((c) => (
                    <td
                      key={c}
                      className="py-1.5 pr-2 whitespace-nowrap max-w-[220px] truncate border-b border-slate-800/60"
                    >
                      {String(row[c] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile compact cards */}
      <div className="md:hidden flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
        {sorted.length === 0 ? (
          <p className="text-center text-slate-500 text-xs py-8">
            {search || activeColFilterCount ? 'Filter boýunça netije ýok' : 'Maglumat ýok'}
          </p>
        ) : (
          sorted.slice(0, 200).map((row, i) => (
            <div
              key={i}
              className={cn(
                'rounded-lg border border-slate-800/80 bg-slate-900/50 px-2.5 py-2 space-y-0.5',
                dd?.enabled && 'active:bg-indigo-500/10'
              )}
              onClick={() => {
                if (dd?.enabled) openDrillDown(row);
              }}
            >
              {visibleCols.slice(0, 6).map((c, j) => (
                <div key={c} className="flex justify-between gap-2 text-[11px] leading-snug">
                  <span className="text-slate-500 shrink-0 max-w-[40%] truncate">{c}</span>
                  <span className={cn('text-right truncate text-slate-200', j === 0 && 'font-medium text-white')}>
                    {String(row[c] ?? '—')}
                  </span>
                </div>
              ))}
              {visibleCols.length > 6 && (
                <p className="text-[10px] text-slate-600">+{visibleCols.length - 6} sütün</p>
              )}
            </div>
          ))
        )}
      </div>

      <div className="shrink-0 text-[10px] text-slate-500 flex flex-wrap justify-between gap-1">
        <span>
          {sorted.length}/{rows.length} hat
          {sorts.length > 0 && <> · sort: {sorts.map((s) => `${s.field} ${s.dir}`).join(', ')}</>}
          {dd?.enabled && <> · setir basyp detal</>}
        </span>
        <span className="opacity-70 hidden sm:inline">Sütün süýşür · Shift+klik multi-sort</span>
      </div>

      {/* Drill-down modal */}
      {drillOpen && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrillOpen(false)}
          />
          <div className="relative w-full sm:max-w-3xl max-h-[85dvh] rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
              <h3 className="text-sm font-semibold text-white truncate">{drillTitle}</h3>
              <button
                type="button"
                onClick={() => setDrillOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-3">
              {drillLoading && (
                <div className="flex items-center justify-center gap-2 py-12 text-slate-400 text-sm">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Ýüklenýär...
                </div>
              )}
              {drillError && (
                <p className="text-sm text-rose-400 py-6 text-center">{drillError}</p>
              )}
              {!drillLoading && !drillError && drillRows.length === 0 && (
                <p className="text-sm text-slate-500 py-10 text-center">Maglumat tapylmady</p>
              )}
              {!drillLoading && drillRows.length > 0 && (
                <table className="w-full text-sm min-w-[240px]">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-700">
                      {Object.keys(drillRows[0]).map((k) => (
                        <th key={k} className="py-1.5 pr-3 font-medium sticky top-0 bg-slate-900">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {drillRows.map((r, idx) => (
                      <tr key={idx} className="border-b border-slate-800/60 text-slate-200">
                        {Object.keys(drillRows[0]).map((k) => (
                          <td key={k} className="py-1.5 pr-3 whitespace-nowrap max-w-[200px] truncate">
                            {String(r[k] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="shrink-0 px-4 py-2 border-t border-slate-800 text-[10px] text-slate-500">
              {drillRows.length} hat
              {dd?.sourceField && <> · {dd.sourceField} → {dd.targetParam || dd.sourceField}</>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ChartWidget({ widget, data, className, globalFilters }: Props) {
  const option = useMemo(() => {
    const color = widget.config?.color || '#6366f1';
    const showLegend = widget.config?.showLegend !== false;

    if (widget.type === 'kpi' || widget.type === 'text' || widget.type === 'table') return null;

    const hasDs = !!(widget.dataSource?.path || widget.dataSource?.endpointId);

    if (widget.type === 'bar' || widget.type === 'line' || widget.type === 'area') {
      const rows =
        data !== undefined
          ? data
          : hasDs
            ? []
            : DEMO_BAR.map((d) => ({
                [widget.dataSource?.categoryField || 'name']: d.name,
                [widget.dataSource?.valueField || 'value']: d.value,
              }));
      const catKey = widget.dataSource?.categoryField || 'name';
      const valKey = widget.dataSource?.valueField || 'value';
      const seriesKey = widget.dataSource?.seriesField;
      const palette = widget.config?.colors?.length
        ? widget.config.colors
        : [color, '#22d3ee', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#fb7185', '#60a5fa'];
      const seriesType = widget.type === 'bar' ? 'bar' : 'line';
      const smooth = widget.config?.smooth !== false && widget.type !== 'bar';
      const stacked = !!widget.config?.stacked;
      const showLabels = !!widget.config?.showDataLabels;
      const horizontal = !!widget.config?.horizontal && widget.type === 'bar';

      let cats: string[] = [];
      let series: any[] = [];

      if (seriesKey) {
        // Group by category, one series per seriesField value
        const catSet: string[] = [];
        const seriesSet: string[] = [];
        const matrix = new Map<string, Map<string, number>>();
        for (const r of rows) {
          const cat = String(r[catKey] ?? '');
          const ser = String(r[seriesKey] ?? 'Series');
          if (!catSet.includes(cat)) catSet.push(cat);
          if (!seriesSet.includes(ser)) seriesSet.push(ser);
          if (!matrix.has(ser)) matrix.set(ser, new Map());
          matrix.get(ser)!.set(cat, Number(r[valKey] ?? 0));
        }
        cats = catSet;
        series = seriesSet.map((ser, i) => ({
          name: ser,
          type: seriesType,
          stack: stacked ? 'total' : undefined,
          data: catSet.map((cat) => matrix.get(ser)?.get(cat) ?? 0),
          smooth,
          areaStyle: widget.type === 'area' ? { opacity: 0.15 } : undefined,
          itemStyle: {
            color: palette[i % palette.length],
            borderRadius: widget.type === 'bar' ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0,
          },
          lineStyle: { width: 2.5 },
          label: showLabels
            ? { show: true, position: horizontal ? 'right' : 'top', color: '#94a3b8', fontSize: 10 }
            : undefined,
        }));
      } else {
        // Single or multi value fields via columns config (numeric extras)
        cats = rows.map((r) => String(r[catKey] ?? ''));
        const extraVals = (widget.dataSource?.columns || []).filter(
          (c) => c !== catKey && c !== seriesKey
        );
        const valueKeys =
          extraVals.length > 0
            ? extraVals
            : [valKey];
        series = valueKeys.map((vk, i) => ({
          name: vk,
          type: seriesType,
          stack: stacked ? 'total' : undefined,
          data: rows.map((r) => Number(r[vk] ?? 0)),
          smooth,
          areaStyle: widget.type === 'area' ? { opacity: 0.15 } : undefined,
          itemStyle: {
            color: palette[i % palette.length],
            borderRadius: widget.type === 'bar' ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0,
          },
          lineStyle: { width: 2.5 },
          label: showLabels
            ? { show: true, position: horizontal ? 'right' : 'top', color: '#94a3b8', fontSize: 10 }
            : undefined,
        }));
      }

      const categoryAxis = {
        type: 'category' as const,
        data: cats,
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        axisLine: { lineStyle: { color: '#334155' } },
      };
      const valueAxis = {
        type: 'value' as const,
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        splitLine: { lineStyle: { color: '#1e293b' } },
      };

      return {
        backgroundColor: 'transparent',
        color: palette,
        grid: { left: 48, right: 16, top: 28, bottom: showLegend && series.length > 1 ? 48 : 36 },
        tooltip: { trigger: 'axis' },
        legend:
          showLegend && series.length > 1
            ? { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 } }
            : undefined,
        xAxis: horizontal ? valueAxis : categoryAxis,
        yAxis: horizontal ? categoryAxis : valueAxis,
        series,
        graphic:
          rows.length === 0
            ? [
                {
                  type: 'text',
                  left: 'center',
                  top: 'middle',
                  style: {
                    text: 'Maglumat tapylmady',
                    fill: '#64748b',
                    fontSize: 13,
                  },
                },
              ]
            : undefined,
      };
    }

    if (widget.type === 'pie') {
      const rows =
        data !== undefined
          ? data
          : hasDs
            ? []
            : DEMO_PIE.map((d) => ({
                [widget.dataSource?.categoryField || 'name']: d.name,
                [widget.dataSource?.valueField || 'value']: d.value,
              }));
      const catKey = widget.dataSource?.categoryField || 'name';
      const valKey = widget.dataSource?.valueField || 'value';
      return {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item' },
        legend: showLegend
          ? { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 } }
          : undefined,
        series: [
          {
            type: 'pie',
            radius: ['42%', '68%'],
            center: ['50%', showLegend ? '44%' : '50%'],
            data: rows.map((r, i) => ({
              name: String(r[catKey] ?? ''),
              value: Number(r[valKey] ?? 0),
              itemStyle: {
                color: (widget.config?.colors?.length
                  ? widget.config.colors
                  : [color, '#22d3ee', '#a78bfa', '#f472b6', '#fbbf24', '#34d399'])[i % 6],
              },
            })),
            label: {
              color: '#cbd5e1',
              fontSize: 11,
              show: widget.config?.showDataLabels !== false,
            },
            itemStyle: { borderRadius: 4, borderColor: '#0f172a', borderWidth: 2 },
          },
        ],
        graphic:
          rows.length === 0
            ? [
                {
                  type: 'text',
                  left: 'center',
                  top: 'middle',
                  style: {
                    text: 'Maglumat tapylmady',
                    fill: '#64748b',
                    fontSize: 13,
                  },
                },
              ]
            : undefined,
      };
    }

    return null;
  }, [widget, data]);

  if (widget.type === 'kpi') {
    const live =
      data?.length && widget.dataSource?.valueField
        ? data[0]?.[widget.dataSource.valueField]
        : undefined;
    const raw = live != null && live !== '' ? live : widget.staticValue ?? '—';
    let display = String(raw);
    if (typeof raw === 'number' || (typeof raw === 'string' && raw !== '—' && !Number.isNaN(Number(raw)))) {
      const n = Number(raw);
      const dec = widget.config?.decimals;
      display = dec != null ? n.toFixed(dec) : n.toLocaleString();
    }
    const prefix = widget.config?.prefix || '';
    const suffix = widget.config?.suffix || widget.config?.unit || '';
    const kpiColor = widget.config?.color || '#ffffff';
    return (
      <div className={cn('h-full flex flex-col justify-center px-1', className)}>
        <p className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: kpiColor }}>
          {prefix}{display}{suffix && !widget.config?.suffix && widget.config?.unit ? '' : ''}
          {widget.config?.suffix ? suffix : ''}
        </p>
        {widget.config?.unit && !widget.config?.suffix && (
          <p className="text-sm text-slate-400 mt-1">{widget.config.unit}</p>
        )}
      </div>
    );
  }

  if (widget.type === 'text') {
    return (
      <div className={cn('h-full text-sm text-slate-300 leading-relaxed', className)}>
        {String(widget.staticValue ?? '')}
      </div>
    );
  }

  if (widget.type === 'table') {
    return (
      <TableWidgetBody
        widget={widget}
        data={data}
        className={className}
        globalFilters={globalFilters}
      />
    );
  }

  if (!option) return null;

  return (
    <ReactECharts
      option={option}
      style={{ height: '100%', width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
    />
  );
}
