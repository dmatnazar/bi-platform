'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactECharts from 'echarts-for-react';
import type { DashboardWidget, GlobalFilterValues } from '@/lib/types';
import { cn, formatCellValue } from '@/lib/utils';
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Download, Filter, GripVertical, Loader2, Maximize2, RotateCcw, Search, X, Undo2, ChevronRight } from 'lucide-react';

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

  const [colOrder, setColOrder] = useState<string[]>(() => {
    const saved = widget.config?.columnOrder;
    if (saved?.length) {
      const kept = saved.filter((c) => dataKeys.includes(c));
      const missing = dataKeys.filter((c) => !kept.includes(c));
      return [...kept, ...missing];
    }
    return dataKeys;
  });
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    const fromCfg = widget.config?.hiddenColumns || [];
    try {
      const ls = localStorage.getItem(`bi-table-hidden:${widget.id}`);
      if (ls) return new Set(JSON.parse(ls) as string[]);
    } catch { /* */ }
    return new Set(fromCfg);
  });
  const [showColPicker, setShowColPicker] = useState(false);

  const persistHiddenCols = (next: Set<string>) => {
    setHiddenCols(next);
    try {
      localStorage.setItem(`bi-table-hidden:${widget.id}`, JSON.stringify([...next]));
    } catch { /* */ }
  };

  /** Mobile card row-1 columns (rest go to row 2) */
  const [mobilePrimaryCols, setMobilePrimaryCols] = useState<string[]>(() => {
    const fromCfg = widget.config?.mobileCardPrimaryColumns || [];
    try {
      const ls = localStorage.getItem(`bi-table-mobile-primary:${widget.id}`);
      if (ls) {
        const parsed = JSON.parse(ls) as string[];
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch { /* */ }
    return fromCfg;
  });
  const persistMobilePrimary = (next: string[]) => {
    setMobilePrimaryCols(next);
    try {
      localStorage.setItem(`bi-table-mobile-primary:${widget.id}`, JSON.stringify(next));
    } catch { /* */ }
  };

  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [showColFilters, setShowColFilters] = useState(false);
  const [sorts, setSorts] = useState<SortSpec[]>(widget.dataSource?.orderBy || []);
  const enableSearch = widget.dataSource?.enableSearch !== false;
  const dragCol = useRef<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const tableRootRef = useRef<HTMLDivElement | null>(null);

  function csvEscape(v: unknown): string {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportCsv(rowsToExport: Record<string, unknown>[], cols: string[]) {
    if (!rowsToExport.length || !cols.length) return;
    const lines = [
      cols.map(csvEscape).join(','),
      ...rowsToExport.map((r) => cols.map((c) => csvEscape(r[c])).join(',')),
    ];
    // BOM so Excel opens UTF-8 (Turkmen/Cyrillic chars) correctly
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (widget.title || 'table').trim().replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'table';
    a.download = `${safeName}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function safeFileName() {
    return (widget.title || 'table').trim().replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'table';
  }

  async function exportTable(
    fmt: 'csv' | 'xlsx' | 'pdf' | 'png',
    rowsToExport: Record<string, unknown>[],
    cols: string[]
  ) {
    if (!rowsToExport.length || !cols.length) return;
    const name = safeFileName();
    if (fmt === 'csv') {
      exportCsv(rowsToExport, cols);
      return;
    }
    if (fmt === 'xlsx') {
      // Simple SpreadsheetML so Excel opens without extra libs
      const sheetRows = [
        `<Row>${cols.map((c) => `<Cell><Data ss:Type="String">${String(c).replace(/[<>&]/g, '')}</Data></Cell>`).join('')}</Row>`,
        ...rowsToExport.map(
          (r) =>
            `<Row>${cols
              .map((c) => {
                const v = r[c];
                const n = typeof v === 'number' || (typeof v === 'string' && v !== '' && !Number.isNaN(Number(v)));
                const t = n ? 'Number' : 'String';
                const cell = v == null ? '' : String(v).replace(/[<>&]/g, '');
                return `<Cell><Data ss:Type="${t}">${cell}</Data></Cell>`;
              })
              .join('')}</Row>`
        ),
      ].join('');
      const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Data"><Table>${sheetRows}</Table></Worksheet></Workbook>`;
      const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.xls`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (fmt === 'pdf') {
      const w = window.open('', '_blank');
      if (!w) return;
      const head = cols.map((c) => `<th style="border:1px solid #ccc;padding:4px;font-size:11px">${String(c)}</th>`).join('');
      const body = rowsToExport
        .map(
          (r) =>
            `<tr>${cols
              .map((c) => `<td style="border:1px solid #eee;padding:4px;font-size:11px">${r[c] == null ? '' : String(r[c])}</td>`)
              .join('')}</tr>`
        )
        .join('');
      w.document.write(`<html><head><title>${name}</title></head><body><h3>${name}</h3><table style="border-collapse:collapse;width:100%"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`);
      w.document.close();
      return;
    }
    if (fmt === 'png') {
      try {
        // Native canvas export — no html2canvas dependency
        const canvas = document.createElement('canvas');
        canvas.width = 1400;
        canvas.height = Math.min(2400, 48 + Math.max(rowsToExport.length, 1) * 22);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px monospace';
        ctx.fillText(cols.join(' | ').slice(0, 160), 12, 28);
        ctx.fillStyle = '#e2e8f0';
        rowsToExport.slice(0, 100).forEach((r, i) => {
          ctx.fillText(
            cols.map((c) => String(r[c] ?? '')).join(' | ').slice(0, 160),
            12,
            52 + i * 22
          );
        });
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.png`;
        a.click();
      } catch (e) {
        console.warn('png export failed', e);
      }
    }
  }

  // Drill-down state
  const dd = widget.dataSource?.drillDown;
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillTitle, setDrillTitle] = useState('');
  const [drillRows, setDrillRows] = useState<Record<string, unknown>[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState('');

  // Drill-down table: user-adjustable columns + row search, remembered per
  // widget across sessions (same idea as the parent table above) so removing
  // a column here stays removed next time this hierarchy is opened.
  const [drillSearch, setDrillSearch] = useState('');
  const [drillColFilters, setDrillColFilters] = useState<Record<string, string>>({});
  const [showDrillColFilters, setShowDrillColFilters] = useState(false);
  const [drillHiddenCols, setDrillHiddenCols] = useState<Set<string>>(() => {
    try {
      const ls = localStorage.getItem(`bi-drill-hidden:${widget.id}`);
      if (ls) return new Set(JSON.parse(ls) as string[]);
    } catch { /* */ }
    return new Set(dd?.hiddenColumns || []);
  });
  const [drillColOrderSaved, setDrillColOrderSaved] = useState<string[]>(() => {
    try {
      const ls = localStorage.getItem(`bi-drill-order:${widget.id}`);
      if (ls) {
        const parsed = JSON.parse(ls) as string[];
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch { /* */ }
    return dd?.columnOrder || [];
  });
  const [drillMobilePrimaryCols, setDrillMobilePrimaryCols] = useState<string[]>(() => {
    try {
      const ls = localStorage.getItem(`bi-drill-mobile-primary:${widget.id}`);
      if (ls) {
        const parsed = JSON.parse(ls) as string[];
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch { /* */ }
    return [];
  });
  const [showDrillColPicker, setShowDrillColPicker] = useState(false);
  const persistDrillHiddenCols = (next: Set<string>) => {
    setDrillHiddenCols(next);
    try {
      localStorage.setItem(`bi-drill-hidden:${widget.id}`, JSON.stringify([...next]));
    } catch { /* */ }
  };
  const persistDrillColOrder = (next: string[]) => {
    setDrillColOrderSaved(next);
    try {
      localStorage.setItem(`bi-drill-order:${widget.id}`, JSON.stringify(next));
    } catch { /* */ }
  };
  const persistDrillMobilePrimary = (next: string[]) => {
    setDrillMobilePrimaryCols(next);
    try {
      localStorage.setItem(`bi-drill-mobile-primary:${widget.id}`, JSON.stringify(next));
    } catch { /* */ }
  };
  function clearDrillFilters() {
    setDrillSearch('');
    setDrillColFilters({});
  }


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

  function resolveDrillValue(row: Record<string, unknown>, sourceField: string): unknown {
    if (row[sourceField] != null && row[sourceField] !== '') return row[sourceField];
    // Column hidden in UI but still present under alternate casing / common id keys
    const keys = Object.keys(row);
    const lower = sourceField.toLowerCase();
    const hit =
      keys.find((k) => k.toLowerCase() === lower) ||
      keys.find((k) => k.replace(/\s+/g, '').toLowerCase() === lower.replace(/\s+/g, '')) ||
      (lower === 'id' || lower.endsWith('id')
        ? keys.find((k) => /^(id|.*_id|.*Id)$/i.test(k) && row[k] != null && row[k] !== '')
        : undefined);
    return hit != null ? row[hit] : undefined;
  }

  async function openDrillDown(row: Record<string, unknown>) {
    if (!dd?.enabled || !dd.sourceField || !dd.path || !dd.tenantSlug) return;
    const value = resolveDrillValue(row, dd.sourceField);
    if (value == null || value === '') return;

    let title = dd.titleTemplate || '{field}: {value}';
    title = title.replace(/\{field\}/gi, dd.sourceField).replace(/\{value\}/gi, String(value));
    // Any {column name} from the clicked row — supports spaces & unicode (e.g. {Müşderi ady})
    title = title.replace(/\{([^}]+)\}/g, (full, colRaw: string) => {
      const col = String(colRaw).trim();
      if (/^(field|value)$/i.test(col)) return full;
      // exact key
      if (Object.prototype.hasOwnProperty.call(row, col) && row[col] != null) return String(row[col]);
      // case-insensitive / trim match
      const keys = Object.keys(row);
      const hit =
        keys.find((k) => k === col) ||
        keys.find((k) => k.toLowerCase() === col.toLowerCase()) ||
        keys.find((k) => k.replace(/\s+/g, '').toLowerCase() === col.replace(/\s+/g, '').toLowerCase());
      if (hit != null && row[hit] != null) return String(row[hit]);
      return full; // keep token if unknown so user sees mismatch
    });
    setDrillTitle(title);
    setDrillOpen(true);
    setDrillLoading(true);
    setDrillError('');
    setDrillRows([]);
    setDrillSearch('');
    setDrillColFilters({});

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

  // Fullscreen expand may request drill-open on this widget instance
  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ id?: string; row?: Record<string, unknown> }>;
      if (e.detail?.id !== widget.id || !e.detail?.row) return;
      if (!widget.dataSource?.drillDown?.enabled) return;
      void openDrillDown(e.detail.row);
    };
    window.addEventListener('bi-widget-drill', handler as EventListener);
    return () => window.removeEventListener('bi-widget-drill', handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.id, widget.dataSource?.drillDown?.enabled]);


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

  const configuredAggs = widget.dataSource?.tableAggregates || [];

  function computeAgg(
    rows: Record<string, unknown>[],
    col: string,
    fn: 'sum' | 'count' | 'max' | 'min' | 'distinct'
  ): string {
    if (fn === 'count') return String(rows.length);
    if (fn === 'distinct') {
      const set = new Set(rows.map((r) => String(r[col] ?? '')));
      return String(set.size);
    }
    const nums = rows.map((r) => Number(r[col])).filter((n) => Number.isFinite(n));
    if (!nums.length) return '—';
    if (fn === 'sum') return String(Math.round(nums.reduce((a, b) => a + b, 0) * 1000) / 1000);
    if (fn === 'max') return String(Math.max(...nums));
    if (fn === 'min') return String(Math.min(...nums));
    return '—';
  }

  const aggregates = useMemo(() => {
    if (!sorted?.length || !configuredAggs.length) return [] as { label: string; value: string; suffix?: string }[];
    return configuredAggs.map((a) => ({
      label: a.label || a.column,
      value: computeAgg(sorted, a.column, a.fn),
      suffix: a.suffix,
    }));
  }, [configuredAggs, sorted]);


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


  // All columns available in the drill-down result (order + hidden are the
  // user's saved choices, falling back to the widget's static config).
  const drillAllColKeys = useMemo(() => {
    if (!drillRows[0]) return [] as string[];
    const all = Object.keys(drillRows[0]);
    const savedOrder = drillColOrderSaved;
    const order = savedOrder.length
      ? [...savedOrder.filter((c) => all.includes(c)), ...all.filter((c) => !savedOrder.includes(c))]
      : all;
    return order;
  }, [drillRows, drillColOrderSaved]);

  const drillColKeys = useMemo(
    () => drillAllColKeys.filter((c) => !drillHiddenCols.has(c)),
    [drillAllColKeys, drillHiddenCols]
  );

  const drillFilteredRows = useMemo(() => {
    let out = drillRows;
    const q = drillSearch.trim().toLowerCase();
    if (q) out = out.filter((r) => drillColKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)));
    for (const [col, fv] of Object.entries(drillColFilters)) {
      const fq = fv.trim().toLowerCase();
      if (!fq) continue;
      out = out.filter((r) => String(r[col] ?? '').toLowerCase().includes(fq));
    }
    return out;
  }, [drillRows, drillSearch, drillColFilters, drillColKeys]);

  const activeDrillColFilterCount = useMemo(
    () => Object.values(drillColFilters).filter((v) => v.trim()).length,
    [drillColFilters]
  );

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
                <div className="absolute right-0 top-full mt-1 z-50 w-64 max-h-80 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl p-2 space-y-0.5">
                  <div className="flex gap-1 mb-1.5">
                    <button
                      type="button"
                      className="flex-1 text-[10px] py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                      onClick={() => persistHiddenCols(new Set())}
                    >
                      Hemmesi
                    </button>
                    <button
                      type="button"
                      className="flex-1 text-[10px] py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                      onClick={() => persistHiddenCols(new Set(colOrder))}
                    >
                      Hiçisi
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 px-1 pt-0.5">Görkez / gizle</p>
                  {colOrder.map((c) => (
                    <label
                      key={c}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenCols.has(c)}
                        onChange={(e) => {
                          const next = new Set(hiddenCols);
                          if (e.target.checked) next.delete(c);
                          else next.add(c);
                          persistHiddenCols(next);
                        }}
                        className="rounded border-slate-600"
                      />
                      <span className="text-slate-200 truncate">{c}</span>
                    </label>
                  ))}
                  <div className="border-t border-slate-800 mt-2 pt-2">
                    <p className="text-[10px] text-indigo-300/90 px-1 mb-1 leading-snug">
                      Mobile card · 1-nji setir (saýlananlar). Galanlar 2-nji setirde.
                    </p>
                    {visibleCols.map((c) => {
                      const on = mobilePrimaryCols.includes(c);
                      return (
                        <label
                          key={`m-${c}`}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...mobilePrimaryCols.filter((x) => x !== c), c]
                                : mobilePrimaryCols.filter((x) => x !== c);
                              persistMobilePrimary(next);
                            }}
                            className="rounded border-indigo-600/50"
                          />
                          <span className="text-slate-200 truncate">{c}</span>
                          {on && (
                            <span className="ml-auto text-[9px] text-indigo-400 shrink-0">row1</span>
                          )}
                        </label>
                      );
                    })}
                    {visibleCols.length === 0 && (
                      <p className="text-[10px] text-slate-500 px-2 py-1">Ilki sütünleri görkeziň</p>
                    )}
                  </div>
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
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setExportMenuOpen((v) => !v)}
              disabled={!sorted.length}
              className="h-8 px-2 rounded-lg border border-slate-700 bg-slate-950/80 text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 disabled:opacity-40"
              title="Export"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            {exportMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-xl border border-slate-700 bg-slate-900 shadow-xl py-1 text-xs">
                  {(['csv', 'xlsx', 'pdf', 'png'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-800 uppercase"
                      onClick={() => {
                        setExportMenuOpen(false);
                        void exportTable(fmt, sorted, visibleCols);
                      }}
                    >
                      {fmt === 'xlsx' ? 'Excel (.xlsx)' : fmt === 'pdf' ? 'PDF' : fmt === 'png' ? 'PNG' : 'CSV'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          </div>
        </div>

      {/*
        overscroll-behavior must stay 'auto' (not 'contain'/'none') here: once the
        user scrolls this inner region to its top/bottom edge, 'auto' lets the
        remaining wheel/touch delta chain to the dashboard page so it keeps
        scrolling instead of getting stuck.
      */}
      <div className="hidden md:block flex-1 min-h-0 overflow-x-auto overflow-y-auto -mx-0.5 px-0.5 [overscroll-behavior:auto]">
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
                      {formatCellValue(row[c])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards: row1 = selected primary cols, row2 = the rest (2-col grids) */}
      <div className="md:hidden flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5 [overscroll-behavior:auto]">
        {sorted.length === 0 ? (
          <p className="text-center text-slate-500 text-xs py-8">
            {search || activeColFilterCount ? 'Filter boýunça netije ýok' : 'Maglumat ýok'}
          </p>
        ) : (
          sorted.slice(0, 200).map((row, i) => {
            const primary = (
              mobilePrimaryCols.length
                ? mobilePrimaryCols.filter((c) => visibleCols.includes(c))
                : visibleCols.slice(0, Math.min(2, visibleCols.length))
            );
            const secondary = visibleCols.filter((c) => !primary.includes(c));
            return (
              <button
                type="button"
                key={i}
                className={cn(
                  'w-full text-left rounded-lg border border-slate-800/80 bg-slate-900/50 px-2 py-1.5 transition',
                  dd?.enabled && 'active:bg-indigo-500/15 hover:border-indigo-500/40 cursor-pointer'
                )}
                onClick={() => {
                  // Hierarchy only — modal drill, no dashboard fullscreen / no reload
                  if (dd?.enabled) void openDrillDown(row);
                }}
              >
                {/* Row 1 — primary cols: "col: value" same line, wrap if long */}
                <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5">
                  {primary.map((c, j) => (
                    <div
                      key={c}
                      className={cn(
                        'min-w-0 text-[10px] sm:text-[11px] leading-snug break-words',
                        primary.length === 1 || j === 0 ? 'col-span-2' : ''
                      )}
                    >
                      <span className="text-slate-500">{c}: </span>
                      <span
                        className={cn(
                          'text-slate-100',
                          (primary.length === 1 || j === 0) && 'font-medium text-white'
                        )}
                      >
                        {formatCellValue(row[c])}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Row 2 — rest */}
                {secondary.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5 mt-1 pt-1 border-t border-slate-800/50">
                    {secondary.map((c) => (
                      <div key={c} className="min-w-0 text-[10px] leading-snug break-words">
                        <span className="text-slate-500">{c}: </span>
                        <span className="text-slate-300">{formatCellValue(row[c])}</span>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="shrink-0 text-[10px] text-slate-500 space-y-1.5 border-t border-slate-800/60 pt-1.5">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <span>
            {sorted.length}/{rows.length} hat
            {sorts.length > 0 && <> · sort: {sorts.map((s) => `${s.field} ${s.dir}`).join(', ')}</>}
            {dd?.enabled && <span className="hidden sm:inline"> · setir basyp detal</span>}
          </span>
          <span className="opacity-70 hidden sm:inline">Sütün süýşür · Shift+klik multi-sort</span>
        </div>
        {aggregates.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-200">
            {aggregates.map((a, i) => (
              <span key={a.label + i} className="inline-flex items-baseline gap-1">
                {i > 0 && <span className="text-slate-600 mr-1">/</span>}
                <span className="font-semibold text-white">{a.label}</span>
                <span className="text-slate-500">:</span>
                <strong className="font-bold text-emerald-300 tabular-nums">{a.value}</strong>
                {a.suffix ? <span className="text-slate-400 text-[11px]">{a.suffix}</span> : null}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Drill-down modal */}
      {drillOpen &&
        typeof document !== 'undefined' &&
        createPortal(
        <div className="fixed inset-0 z-[2147482000] flex items-stretch sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setDrillOpen(false)}
          />
          <div className="relative w-full h-[100dvh] sm:h-[min(92dvh,900px)] sm:max-w-6xl rounded-none sm:rounded-2xl border-0 sm:border border-slate-700 bg-slate-950 shadow-2xl flex flex-col overflow-hidden z-10">
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
            {!drillLoading && !drillError && drillRows.length > 0 && (
              <div className="shrink-0 flex items-center gap-1.5 px-3 pt-2.5">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                  <input
                    value={drillSearch}
                    onChange={(e) => setDrillSearch(e.target.value)}
                    placeholder="Gözle..."
                    className="w-full h-8 pl-7 pr-7 rounded-lg bg-slate-950/80 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                  {drillSearch && (
                    <button
                      type="button"
                      onClick={() => setDrillSearch('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowDrillColFilters((v) => !v)}
                    className={cn(
                      'h-8 px-2 rounded-lg border text-xs inline-flex items-center gap-1 shrink-0',
                      showDrillColFilters || activeDrillColFilterCount
                        ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                        : 'border-slate-700 bg-slate-950/80 text-slate-400 hover:text-slate-200'
                    )}
                    title="Sütün filterleri"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    {activeDrillColFilterCount > 0 ? activeDrillColFilterCount : 'Filter'}
                  </button>
                </div>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowDrillColPicker((v) => !v)}
                    className={cn(
                      'h-8 px-2 rounded-lg border text-xs inline-flex items-center gap-1',
                      showDrillColPicker || drillHiddenCols.size
                        ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                        : 'border-slate-700 bg-slate-950/80 text-slate-400 hover:text-slate-200'
                    )}
                    title="Sütünleri görkez / gizle"
                  >
                    <Columns3 className="h-3.5 w-3.5" />
                    Sütünler
                    {drillHiddenCols.size > 0 && (
                      <span className="text-[10px] opacity-80">({drillColKeys.length}/{drillAllColKeys.length})</span>
                    )}
                  </button>
                  {showDrillColPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowDrillColPicker(false)} />
                      <div className="absolute right-0 top-full mt-1 z-50 w-64 max-h-80 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl p-2 space-y-0.5">
                        <div className="flex gap-1 mb-1.5">
                          <button
                            type="button"
                            className="flex-1 text-[10px] py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                            onClick={() => persistDrillHiddenCols(new Set())}
                          >
                            Hemmesi
                          </button>
                          <button
                            type="button"
                            className="flex-1 text-[10px] py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                            onClick={() => persistDrillHiddenCols(new Set(drillAllColKeys))}
                          >
                            Hiçisi
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500 px-1 pt-0.5">Görkez / gizle</p>
                        {drillAllColKeys.map((c) => (
                          <label
                            key={c}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={!drillHiddenCols.has(c)}
                              onChange={(e) => {
                                const next = new Set(drillHiddenCols);
                                if (e.target.checked) next.delete(c);
                                else next.add(c);
                                persistDrillHiddenCols(next);
                              }}
                              className="rounded border-slate-600"
                            />
                            <span className="truncate text-slate-200">{c}</span>
                          </label>
                        ))}
                        <div className="border-t border-slate-800 mt-2 pt-2">
                          <p className="text-[10px] text-indigo-300/90 px-1 mb-1 leading-snug">
                            Mobile card · 1-nji setir (saýlananlar). Galanlar 2-nji setirde.
                          </p>
                          {drillColKeys.map((c) => {
                            const on = drillMobilePrimaryCols.includes(c);
                            return (
                              <label
                                key={`dm-${c}`}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer text-xs"
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...drillMobilePrimaryCols.filter((x) => x !== c), c]
                                      : drillMobilePrimaryCols.filter((x) => x !== c);
                                    persistDrillMobilePrimary(next);
                                  }}
                                  className="rounded border-indigo-600/50"
                                />
                                <span className="text-slate-200 truncate">{c}</span>
                                {on && (
                                  <span className="ml-auto text-[9px] text-indigo-400 shrink-0">row1</span>
                                )}
                              </label>
                            );
                          })}
                          {drillColKeys.length === 0 && (
                            <p className="text-[10px] text-slate-500 px-2 py-1">Ilki sütünleri görkeziň</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {(drillSearch || activeDrillColFilterCount > 0) && (
                  <button
                    type="button"
                    onClick={clearDrillFilters}
                    className="h-8 px-2 rounded-lg border border-slate-700 text-[11px] text-slate-400 hover:text-white shrink-0"
                  >
                    Arassala
                  </button>
                )}
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-auto p-3 flex flex-col">
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
              {!drillLoading && !drillError && drillRows.length > 0 && drillFilteredRows.length === 0 && (
                <p className="text-sm text-slate-500 py-10 text-center">Gözlege gabat gelýän hat ýok</p>
              )}
              {!drillLoading && drillFilteredRows.length > 0 && (
                <>
                  <div className="hidden sm:block overflow-auto flex-1 min-h-0">
                    <table className="w-full text-sm min-w-[240px]">
                      <thead>
                        <tr className="text-left text-slate-400 border-b border-slate-700">
                          {drillColKeys.map((k) => (
                            <th key={k} className="py-1.5 pr-3 font-medium sticky top-0 bg-slate-900">
                              {k}
                            </th>
                          ))}
                        </tr>
                        {showDrillColFilters && (
                          <tr className="bg-slate-950/80">
                            {drillColKeys.map((k) => (
                              <th key={`df-${k}`} className="py-1 pr-3 sticky top-6 z-10 bg-slate-950/95 border-b border-slate-800">
                                <input
                                  value={drillColFilters[k] || ''}
                                  onChange={(e) => setDrillColFilters((prev) => ({ ...prev, [k]: e.target.value }))}
                                  placeholder="Filter..."
                                  className="w-full text-[11px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 outline-none"
                                />
                              </th>
                            ))}
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {drillFilteredRows.map((r, idx) => (
                          <tr key={idx} className="border-b border-slate-800/60 text-slate-200">
                            {drillColKeys.map((k) => (
                              <td key={k} className="py-1.5 pr-3 whitespace-nowrap max-w-[200px] truncate">
                                {String(r[k] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="sm:hidden space-y-1.5 flex-1 min-h-0 overflow-y-auto">
                    {drillFilteredRows.map((r, idx) => {
                      const primary = (
                        drillMobilePrimaryCols.length
                          ? drillMobilePrimaryCols.filter((c) => drillColKeys.includes(c))
                          : drillColKeys.slice(0, Math.min(2, drillColKeys.length))
                      );
                      const secondary = drillColKeys.filter((c) => !primary.includes(c));
                      return (
                        <div key={idx} className="rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1.5">
                          {/* Row 1 — primary (saýlanan) sütünler */}
                          <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5">
                            {primary.map((c, j) => (
                              <div
                                key={c}
                                className={cn(
                                  'min-w-0 text-[10px] sm:text-[11px] leading-snug break-words',
                                  primary.length === 1 || j === 0 ? 'col-span-2' : ''
                                )}
                              >
                                <span className="text-slate-500">{c}: </span>
                                <span
                                  className={cn(
                                    'text-slate-100',
                                    (primary.length === 1 || j === 0) && 'font-medium text-white'
                                  )}
                                >
                                  {String(r[c] ?? '—')}
                                </span>
                              </div>
                            ))}
                          </div>
                          {/* Row 2 — galanlar */}
                          {secondary.length > 0 && (
                            <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5 mt-1 pt-1 border-t border-slate-800/50">
                              {secondary.map((c) => (
                                <div key={c} className="min-w-0 text-[10px] leading-snug break-words">
                                  <span className="text-slate-500">{c}: </span>
                                  <span className="text-slate-300">{String(r[c] ?? '—')}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div className="shrink-0 px-4 py-2.5 border-t border-slate-800 space-y-1.5">
              <div className="text-[10px] text-slate-500">
                {drillFilteredRows.length === drillRows.length
                  ? `${drillRows.length} hat`
                  : `${drillFilteredRows.length} / ${drillRows.length} hat`}
                {dd?.sourceField && <> · {dd.sourceField} → {dd.targetParam || dd.sourceField}</>}
              </div>
              {(() => {
                const cfgs = dd?.aggregates || [];
                if (!cfgs.length || !drillRows.length) return null;
                const items = cfgs.map((a) => {
                  const fn = a.fn || 'sum';
                  let value = '—';
                  if (fn === 'count') value = String(drillRows.length);
                  else {
                    const nums = drillRows.map((r) => Number(r[a.column])).filter((n) => Number.isFinite(n));
                    if (nums.length) {
                      if (fn === 'sum') value = String(Math.round(nums.reduce((x, y) => x + y, 0) * 1000) / 1000);
                      else if (fn === 'max') value = String(Math.max(...nums));
                      else if (fn === 'min') value = String(Math.min(...nums));
                    }
                  }
                  return { label: a.label || a.column, value, suffix: a.suffix };
                });
                return (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-200">
                    {items.map((a, i) => (
                      <span key={a.label + i} className="inline-flex items-baseline gap-1">
                        {i > 0 && <span className="text-slate-600 mr-1">/</span>}
                        <span className="font-semibold text-white">{a.label}</span>
                        <span className="text-slate-500">:</span>
                        <strong className="font-bold text-emerald-300 tabular-nums">{a.value}</strong>
                        {a.suffix ? <span className="text-slate-400 text-[11px]">{a.suffix}</span> : null}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      , document.body)}
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
      const valueKeys: string[] =
        widget.dataSource?.valueFields?.length
          ? widget.dataSource.valueFields
          : widget.dataSource?.valueField
            ? [widget.dataSource.valueField]
            : ['value'];
      const valKey = valueKeys[0] || 'value';
      const seriesFieldList: string[] =
        widget.dataSource?.seriesFields?.length
          ? widget.dataSource.seriesFields
          : widget.dataSource?.seriesField
            ? [widget.dataSource.seriesField]
            : [];
      const seriesKey = seriesFieldList[0];
      const seriesKeyFn = (r: Record<string, unknown>) =>
        seriesFieldList.length
          ? seriesFieldList.map((f) => String(r[f] ?? '')).filter(Boolean).join(' / ') || 'Series'
          : '';
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

      if (seriesFieldList.length > 0) {
        // Group by category, one chart series per series field combination × value field
        const catSet: string[] = [];
        const seriesSet: string[] = [];
        const matrix = new Map<string, Map<string, number>>();
        for (const r of rows) {
          const cat = String(r[catKey] ?? '');
          if (!catSet.includes(cat)) catSet.push(cat);
          for (const vk of valueKeys) {
            const base = seriesKeyFn(r);
            const ser = valueKeys.length > 1 ? `${base}${base ? ' · ' : ''}${vk}` : base || vk;
            if (!seriesSet.includes(ser)) seriesSet.push(ser);
            if (!matrix.has(ser)) matrix.set(ser, new Map());
            matrix.get(ser)!.set(cat, Number(r[vk] ?? 0));
          }
        }
        cats = catSet;
        // Task 16: multi value under series field → dual axis when not stacked
        const multiScaleSF =
          !stacked &&
          !horizontal &&
          valueKeys.length > 1 &&
          (widget.type === 'line' || widget.type === 'area' || widget.type === 'bar');
        series = seriesSet.map((ser, i) => ({
          name: ser,
          type: seriesType,
          stack: stacked ? 'total' : undefined,
          yAxisIndex: multiScaleSF ? i % 2 : 0,
          data: catSet.map((cat) => matrix.get(ser)?.get(cat) ?? 0),
          smooth,
          areaStyle: widget.type === 'area' ? { opacity: multiScaleSF ? 0.08 : 0.15 } : undefined,
          itemStyle: {
            color: palette[i % palette.length],
            borderRadius: widget.type === 'bar' ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0,
          },
          lineStyle: { width: 2.5 },
          label: {
                // Always show one label per value-field series when multi-selected
                show: !!showLabels,
                // Overlap handling via hideOverlap; dense points still labeled until zoom
                position: horizontal ? 'right' : 'top',
                color: palette[i % palette.length],
                fontSize: Math.max(9, (widget.config?.labelFontSize || 10) - (valueKeys.length > 2 ? 1 : 0)),
                distance: horizontal ? 8 : 6,
                // keep label above/ beside THIS series bar (not stacked on sibling)
                offset: [0, 0],
                overflow: 'none',
                formatter: (p: any) => {
                  const v = p.value;
                  if (v == null || v === '') return '';
                  if (valueKeys.length > 1) {
                    // short series tag so 2+ labels are distinguishable
                    const short =
                      String(p.seriesName || '').length > 12
                        ? String(p.seriesName).slice(0, 11) + '…'
                        : p.seriesName;
                    return short + '\n' + v;
                  }
                  return String(v);
                },
              },
        }));
      } else {
        // Multi value fields → one series each (separate bars + own label)
        cats = rows.map((r) => String(r[catKey] ?? ''));
        const multiScale =
          !stacked &&
          valueKeys.length > 1 &&
          (widget.type === 'line' || widget.type === 'area' || widget.type === 'bar');
        series = valueKeys.map((vk, i) => {
          const color = palette[i % palette.length];
          return {
            name: vk,
            type: seriesType,
            stack: stacked ? 'total' : undefined,
            // Each value field on alternating Y axis so 170k and 426 both visible
            yAxisIndex: multiScale && !horizontal ? i % 2 : 0,
            data: rows.map((r) => Number(r[vk] ?? 0)),
            smooth,
            // Dense line/area: sample points so labels/markers don't stack
            ...(seriesType === 'line' && rows.length > 40
              ? { sampling: 'lttb', large: true, showSymbol: false }
              : {}),
            barGap: valueKeys.length > 1 ? '20%' : undefined,
            barMaxWidth: 48,
            areaStyle: widget.type === 'area' ? { opacity: multiScale ? 0.08 : 0.15 } : undefined,
            itemStyle: {
              color,
              borderRadius: widget.type === 'bar' ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0,
            },
            lineStyle: { width: 2.5 },
            // One label per series, always when multi value fields
            label: {
              show: !!showLabels,
              position: horizontal ? 'right' : 'top',
              color,
              fontSize: Math.max(9, (widget.config?.labelFontSize || 10) - (valueKeys.length > 2 ? 1 : 0)),
              distance: 6,
              overflow: 'truncate',
              hideOverlap: true,
              formatter: (p: any) => {
                const v = p.value;
                if (v == null || v === '') return '';
                const num = typeof v === 'number' ? v : Number(v);
                const text = Number.isFinite(num) ? formatAxisNumber(num) : String(v);
                if (valueKeys.length > 1) {
                  const nm = String(p.seriesName || vk);
                  const short = nm.length > 14 ? nm.slice(0, 13) + '…' : nm;
                  return short + '\n' + text;
                }
                return text;
              },
            },
            labelLayout: { hideOverlap: true },
          };
        });
      }

      // Task 15: configurable label/axis colors
      const labelColor = widget.config?.labelColor || '#94a3b8';
      const axisLabelColor = widget.config?.axisLabelColor || '#94a3b8';
      const baseLabelFs = Math.min(14, Math.max(9, widget.config?.labelFontSize || 11));

      // Task 16: multi value fields → independent Y scales (else small series looks flat / overlapped)
      const multiY =
        !stacked &&
        !horizontal &&
        series.length > 1 &&
        valueKeys.length > 1 &&
        (widget.type === 'line' || widget.type === 'area' || widget.type === 'bar');

      // Ensure every series has correct yAxisIndex when multiY
      if (multiY) {
        series = series.map((s: any, i: number) => ({
          ...s,
          yAxisIndex: i % 2,
          // slight z so lines stay readable
          z: 2 + (i % 2),
        }));
      }

      const categoryAxis = {
        type: 'category' as const,
        data: cats,
        axisLabel: {
          color: axisLabelColor,
          fontSize: baseLabelFs,
          // Dense categories: auto-hide overlapping tick labels (zoom reveals more)
          hideOverlap: true,
          interval: rows.length > 24 ? 'auto' : 0,
          width: horizontal ? 120 : undefined,
          overflow: horizontal ? 'truncate' : 'truncate',
          ellipsis: '…',
          // Fix: truncated category labels had no way to read the full text.
          // Emit a click event so onChartClick can pop up the untruncated label.
          triggerEvent: true,
        },
        axisLine: { lineStyle: { color: '#334155' } },
        axisTick: { alignWithLabel: true },
      };
      // Axis number format: compact (400k) | full (400000) | grouped (400,000)
      const axisNumFmt = (widget.config?.axisNumberFormat as 'compact' | 'full' | 'grouped') || 'compact';
      const formatAxisNumber = (v: number) => {
        if (v == null || !Number.isFinite(v)) return '';
        const abs = Math.abs(v);
        if (axisNumFmt === 'full') {
          return String(Math.round(v * 1000) / 1000);
        }
        if (axisNumFmt === 'grouped') {
          return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
        }
        // compact default — fewer digits, less left padding
        if (abs >= 1e9) return (v / 1e9).toFixed(abs >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
        if (abs >= 1e6) return (v / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
        if (abs >= 1e3) return (v / 1e3).toFixed(abs >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k';
        return String(Math.round(v * 100) / 100);
      };
      const valueAxisLeft = {
        type: 'value' as const,
        name: multiY ? String(series[0]?.name || '') : undefined,
        nameTextStyle: { color: palette[0] || axisLabelColor, fontSize: baseLabelFs - 1 },
        axisLabel: {
          color: multiY ? palette[0] || axisLabelColor : axisLabelColor,
          fontSize: baseLabelFs,
          hideOverlap: true,
          margin: 4,
          formatter: formatAxisNumber,
        },
        splitLine: { lineStyle: { color: '#1e293b' } },
        scale: true,
        alignTicks: false,
      };
      const valueAxisRight = {
        type: 'value' as const,
        name: multiY ? String(series[1]?.name || '') : undefined,
        nameTextStyle: { color: palette[1] || axisLabelColor, fontSize: baseLabelFs - 1 },
        nameGap: 8,
        axisLabel: {
          color: palette[1] || axisLabelColor,
          fontSize: baseLabelFs,
          hideOverlap: true,
          margin: 10,
          formatter: formatAxisNumber,
        },
        splitLine: { show: false },
        scale: true,
        alignTicks: false,
      };
      const valueAxis = valueAxisLeft;

      // Left padding grows with label size so Y labels stay visible (Task 15)
      // Horizontal bar: category labels on LEFT (Y axis) — need real space
      // Tight padding — containLabel sizes for axis text; chart fills widget
      const leftPad = horizontal ? 4 : 4;
      const rightPad = horizontal
        ? (showLabels ? 36 : 8)
        : multiY
          ? 8
          : 6;

      // Multi value fields → each series keeps its own color + legend entry
      // (already separate series from valueKeys map)

      return {
        backgroundColor: 'transparent',
        color: palette,
        grid: {
          left: horizontal ? 8 : leftPad,
          right: rightPad,
          top: horizontal
            ? (showLegend || series.length > 1 ? 36 : 16)
            : showLegend && series.length > 1
              ? 28
              : multiY
                ? 44
                : 28,
          // Room for dataZoom slider; legend is top when horizontal
          bottom: horizontal ? 44 : showLegend && series.length > 1 ? 72 : 40,
          containLabel: true,
        },
        dataZoom: [
          { type: 'inside', zoomOnMouseWheel: true, moveOnMouseMove: true },
          {
            type: 'slider',
            height: 28,
            bottom: 6,
            borderColor: '#475569',
            fillerColor: 'rgba(99,102,241,0.35)',
            handleSize: '110%',
            handleStyle: { color: '#818cf8', borderColor: '#a5b4fc' },
            textStyle: { color: axisLabelColor, fontSize: baseLabelFs },
            dataBackground: { lineStyle: { color: '#64748b' }, areaStyle: { color: '#334155' } },
          },
        ],
        tooltip: { trigger: 'axis' },
        legend:
          series.length > 1 || showLegend
            ? {
                // Horizontal bars: legend ABOVE chart so it never sits under dataZoom slider
                ...(horizontal
                  ? { top: 4, left: 'center' }
                  : { bottom: series.length > 1 ? 36 : 8 }),
                type: 'scroll',
                orient: 'horizontal',
                textStyle: { color: labelColor, fontSize: baseLabelFs },
                pageTextStyle: { color: '#94a3b8' },
              }
            : undefined,
        xAxis: horizontal ? valueAxis : categoryAxis,
        yAxis: horizontal ? categoryAxis : multiY ? [valueAxis, valueAxisRight] : valueAxis,
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
      const valueKeys: string[] =
        widget.dataSource?.valueFields?.length
          ? widget.dataSource.valueFields
          : widget.dataSource?.valueField
            ? [widget.dataSource.valueField]
            : ['value'];
      const valKey = valueKeys[0] || 'value';
      const palette = widget.config?.colors?.length
        ? widget.config.colors
        : [color, '#22d3ee', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#fb7185', '#60a5fa'];
      const showLabels = widget.config?.showDataLabels !== false;
      const showPercent = widget.config?.showPercent !== false;
      const showValueInLabel = !!widget.config?.showValueInLabel;
      const labelInside = widget.config?.labelInside !== false;
      const centerAgg = widget.config?.pieCenterAgg || 'sum';
      // Task 13: which column to aggregate in donut center (default = pie value field)
      const centerField = widget.config?.pieCenterField || valKey;
      const pieSourceField =
        widget.dataSource?.drillDown?.sourceField ||
        widget.dataSource?.categoryField ||
        catKey;
      const pieData = rows.map((r, i) => {
        const value =
          valueKeys.length > 1
            ? valueKeys.reduce((sum, k) => sum + Number(r[k] ?? 0), 0)
            : Number(r[valKey] ?? 0);
        // Keep hierarchy id even if column is hidden in table UI
        const drillId =
          r[pieSourceField] != null && r[pieSourceField] !== ''
            ? r[pieSourceField]
            : r['fich_id'] ?? r['fish_id'] ?? r['id'] ?? r['Id'];
        return {
          name: String(r[catKey] ?? ''),
          value,
          _drillId: drillId,
          _row: r,
          itemStyle: { color: palette[i % palette.length] },
        };
      });
      // Center metric can use a different column than slice value
      const centerNums = rows
        .map((r) => Number(r[centerField] ?? r[valKey] ?? 0))
        .filter((n) => Number.isFinite(n));
      const total =
        centerField && centerField !== valKey
          ? centerNums.reduce((s, n) => s + n, 0)
          : pieData.reduce((s, d) => s + (Number.isFinite(d.value) ? d.value : 0), 0);
      const centerCount = centerField && centerField !== valKey ? centerNums.length : pieData.length;
      const centerText =
        centerAgg === 'none' || pieData.length === 0
          ? ''
          : centerAgg === 'count'
            ? String(centerCount)
            : centerAgg === 'avg'
              ? centerCount
                ? (total / centerCount).toLocaleString(undefined, { maximumFractionDigits: 2 })
                : '0'
              : total.toLocaleString(undefined, { maximumFractionDigits: 2 });
      const centerLabel =
        centerAgg === 'count' ? 'Sany' : centerAgg === 'avg' ? 'Orta' : centerAgg === 'sum' ? 'Jemi' : '';

      const labelParts: string[] = ['{b}'];
      if (showValueInLabel) labelParts.push('{c}');
      if (showPercent) labelParts.push('{d}%');
      const labelFmt = labelParts.join('\n');

      const pieCenterY = showLegend ? '48%' : '50%';
      const graphics: any[] = [];
      if (rows.length === 0) {
        graphics.push({
          type: 'text',
          left: 'center',
          top: 'middle',
          style: { text: 'Maglumat tapylmady', fill: '#64748b', fontSize: 13 },
        });
      } else if (centerText && centerAgg !== 'none') {
        graphics.push(
          {
            type: 'text',
            left: 'center',
            top: showLegend ? '40%' : '44%',
            style: {
              text: centerText,
              fill: '#e2e8f0',
              fontSize: 15,
              fontWeight: 600,
              textAlign: 'center',
            },
            z: 10,
          },
          {
            type: 'text',
            left: 'center',
            top: showLegend ? '48%' : '52%',
            style: {
              text: centerLabel,
              fill: '#94a3b8',
              fontSize: 11,
              textAlign: 'center',
            },
            z: 10,
          }
        );
      }

      return {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          formatter: (p: any) => {
            const pct = p.percent != null ? ` (${p.percent}%)` : '';
            return `${p.name}: ${p.value}${showPercent ? pct : ''}`;
          },
        },
        legend: showLegend
          ? {
              bottom: 4,
              type: 'scroll',
              itemGap: 8,
              itemHeight: 10,
              itemWidth: 12,
              padding: [2, 4],
              textStyle: { color: '#94a3b8', fontSize: 11 },
              pageTextStyle: { color: '#94a3b8' },
            }
          : undefined,
        series: [
          {
            type: 'pie',
            // Fill more of the widget — only small edge margin for labels
            radius: labelInside
              ? (showLegend ? ['38%', '64%'] : ['42%', '72%'])
              : (showLegend ? ['36%', '60%'] : ['40%', '68%']),
            center: ['50%', pieCenterY],
            data: pieData,
            avoidLabelOverlap: true,
            minShowLabelAngle: 0,
            label: {
              color: widget.config?.labelColor || (labelInside ? '#f1f5f9' : '#e2e8f0'),
              fontSize: widget.config?.labelFontSize || 10,
              show: showLabels,
              position: labelInside ? 'inside' : 'outside',
              // Word-aware wrap. Auto-size ON → tighter wrap; OFF → wider single-line prefer.
              formatter: (p: any) => {
                const name = String(p.name ?? '');
                const auto = !!widget.config?.enableAutoTextSize;
                const max = auto ? 14 : 28;
                const wrapName = (s: string, maxChars: number) => {
                  if (s.length <= maxChars) return s;
                  const words = s.split(/\s+/);
                  if (words.length === 1) {
                    // long token: soft-break only when auto (else keep one line, chart may truncate)
                    if (!auto) return s;
                    const parts: string[] = [];
                    for (let i = 0; i < s.length; i += maxChars) parts.push(s.slice(i, i + maxChars));
                    return parts.slice(0, 2).join('\n');
                  }
                  const lines: string[] = [];
                  let cur = '';
                  for (const w of words) {
                    if (!cur) cur = w;
                    else if ((cur + ' ' + w).length <= maxChars) cur = cur + ' ' + w;
                    else {
                      lines.push(cur);
                      cur = w;
                    }
                  }
                  if (cur) lines.push(cur);
                  return lines.slice(0, auto ? 3 : 2).join('\n');
                };
                const lines = [wrapName(name, max)];
                if (showValueInLabel && p.value != null) lines.push(String(p.value));
                if (showPercent && p.percent != null) lines.push(p.percent + '%');
                return lines.join('\n');
              },
              overflow: 'break',
              lineHeight: 14,
              alignTo: labelInside ? undefined : 'none',
              edgeDistance: 6,
              bleedMargin: 2,
              distanceToLabelLine: 4,
              // Fix: let a pie label click show the full name in a popup —
              // useful when a long name got wrapped/cut inside the chart itself.
              triggerEvent: true,
            },
            labelLayout: {
              // Keep labels inside widget bounds; hide if still overlapping heavily
              hideOverlap: true,
              moveOverlap: 'shiftY',
              draggable: false,
            },
            labelLine: {
              show: showLabels && !labelInside,
              length: 8,
              length2: 6,
              smooth: false,
              lineStyle: { width: 1 },
            },
            itemStyle: { borderRadius: 4, borderColor: '#0f172a', borderWidth: 2 },
            emphasis: {
              scale: true,
              scaleSize: 8,
              itemStyle: { shadowBlur: 16, shadowColor: 'rgba(0,0,0,0.35)' },
              label: { show: true, fontWeight: 'bold', fontSize: 12 },
            },
            selectedMode: 'single',
            select: {
              itemStyle: { shadowBlur: 12, borderWidth: 3, borderColor: '#fff' },
            },
          },
        ],
        graphic: graphics.length ? graphics : undefined,
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
    // Unit/suffix on SAME line as value — no second row (avoids empty space above/below)
    const unit = widget.config?.unit || '';
    const suffix = widget.config?.suffix || '';
    const kpiColor = widget.config?.color || '#ffffff';
    const enableAutoTextSize = widget.config?.enableAutoTextSize !== false;
    const textAlign = (widget.config?.textAlign || 'center') as 'center' | 'left' | 'right';

    return (
      <div
        className={cn('h-full w-full flex items-center overflow-hidden px-1', className)}
        style={{
          containerType: 'size',
          justifyContent:
            textAlign === 'center' ? 'center' : textAlign === 'left' ? 'flex-start' : 'flex-end',
        }}
      >
        <p
          className="font-bold tracking-tight leading-none break-words max-w-full"
          style={{
            color: kpiColor,
            fontSize: enableAutoTextSize
              ? 'clamp(1rem, 38cqmin, 4.25rem)'
              : '2rem',
            lineHeight: 1,
            textAlign: textAlign,
            margin: 0,
            padding: 0,
          }}
        >
          {prefix}
          {display}
          {suffix}
          {!suffix && unit ? (
            <span
              style={{
                fontSize: enableAutoTextSize
                  ? 'clamp(0.55rem, 14cqmin, 1.25rem)'
                  : '0.85rem',
                fontWeight: 500,
                color: 'rgb(148 163 184)',
                marginLeft: '0.25em',
              }}
            >
              {unit}
            </span>
          ) : null}
        </p>
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

  // Pivot / сводная таблица (Excel / DataLens style)
  if (widget.type === 'pivot') {
    const rows = data || [];
    const rowFields = widget.config?.pivotRows?.length
      ? widget.config.pivotRows
      : [];
    const colFields = widget.config?.pivotCols?.length
      ? widget.config.pivotCols
      : [];
    const valueField =
      widget.config?.pivotValue ||
      widget.dataSource?.valueField ||
      (widget.dataSource?.valueFields && widget.dataSource.valueFields[0]) ||
      '';
    const agg = widget.config?.pivotAgg || 'sum';
    const showRowTotals = widget.config?.pivotRowTotals !== false;
    const showColTotals = widget.config?.pivotColTotals !== false;

    function aggValues(nums: number[]): number {
      if (!nums.length) return 0;
      if (agg === 'count') return nums.length;
      if (agg === 'avg') return nums.reduce((a, b) => a + b, 0) / nums.length;
      if (agg === 'min') return Math.min(...nums);
      if (agg === 'max') return Math.max(...nums);
      return nums.reduce((a, b) => a + b, 0);
    }
    function fmt(n: number) {
      if (!Number.isFinite(n)) return '—';
      return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    // Build pivot matrix
    const rowKeyFn = (r: Record<string, unknown>) =>
      rowFields.length
        ? rowFields.map((f) => String(r[f] ?? '')).join(' / ')
        : '(Ähli)';
    const colKeyFn = (r: Record<string, unknown>) =>
      colFields.length
        ? colFields.map((f) => String(r[f] ?? '')).join(' / ')
        : 'Jemi';

    const rowKeys: string[] = [];
    const colKeys: string[] = [];
    const matrix = new Map<string, Map<string, number[]>>();
    const rowTotals = new Map<string, number[]>();
    const colTotals = new Map<string, number[]>();
    const grand: number[] = [];

    for (const r of rows) {
      const rk = rowKeyFn(r);
      const ck = colKeyFn(r);
      const v = valueField ? Number(r[valueField] ?? 0) : 1;
      const num = Number.isFinite(v) ? v : 0;
      if (!rowKeys.includes(rk)) rowKeys.push(rk);
      if (!colKeys.includes(ck)) colKeys.push(ck);
      if (!matrix.has(rk)) matrix.set(rk, new Map());
      const m = matrix.get(rk)!;
      if (!m.has(ck)) m.set(ck, []);
      m.get(ck)!.push(num);
      if (!rowTotals.has(rk)) rowTotals.set(rk, []);
      rowTotals.get(rk)!.push(num);
      if (!colTotals.has(ck)) colTotals.set(ck, []);
      colTotals.get(ck)!.push(num);
      grand.push(num);
    }

    if (!rowFields.length && !colFields.length && !valueField) {
      return (
        <div className={cn('h-full flex items-center justify-center text-slate-500 text-sm p-4', className)}>
          Svodny: Row / Column / Value field saýlaň (widget sazlamasy)
        </div>
      );
    }

    return (
      <div className={cn('h-full w-full overflow-auto', className)}>
        <table className="w-full border-collapse text-[11px] sm:text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-900/95">
              <th className="sticky left-0 z-20 bg-slate-900/95 border border-slate-800 px-2 py-1.5 text-left text-slate-400 font-medium min-w-[100px]">
                {rowFields.length ? rowFields.join(' / ') : '—'}
              </th>
              {colKeys.map((ck) => (
                <th
                  key={ck}
                  className="border border-slate-800 px-2 py-1.5 text-right text-slate-300 font-medium whitespace-nowrap bg-slate-900/95"
                >
                  {ck}
                </th>
              ))}
              {showRowTotals && (
                <th className="border border-slate-800 px-2 py-1.5 text-right text-indigo-300 font-semibold whitespace-nowrap bg-slate-900/95">
                  Jemi
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((rk, ri) => (
              <tr key={rk} className={ri % 2 ? 'bg-slate-950/40' : 'bg-slate-900/20'}>
                <td className="sticky left-0 z-[5] border border-slate-800 px-2 py-1 text-slate-200 font-medium whitespace-nowrap bg-slate-950/90">
                  {rk}
                </td>
                {colKeys.map((ck) => {
                  const nums = matrix.get(rk)?.get(ck) || [];
                  return (
                    <td
                      key={ck}
                      className="border border-slate-800 px-2 py-1 text-right text-slate-300 tabular-nums"
                    >
                      {nums.length ? fmt(aggValues(nums)) : ''}
                    </td>
                  );
                })}
                {showRowTotals && (
                  <td className="border border-slate-800 px-2 py-1 text-right text-indigo-300 font-semibold tabular-nums bg-indigo-500/5">
                    {fmt(aggValues(rowTotals.get(rk) || []))}
                  </td>
                )}
              </tr>
            ))}
            {showColTotals && (
              <tr className="bg-indigo-500/10">
                <td className="sticky left-0 z-[5] border border-slate-800 px-2 py-1.5 text-indigo-300 font-semibold bg-slate-950">
                  Jemi
                </td>
                {colKeys.map((ck) => (
                  <td
                    key={ck}
                    className="border border-slate-800 px-2 py-1.5 text-right text-indigo-300 font-semibold tabular-nums"
                  >
                    {fmt(aggValues(colTotals.get(ck) || []))}
                  </td>
                ))}
                {showRowTotals && (
                  <td className="border border-slate-800 px-2 py-1.5 text-right text-indigo-200 font-bold tabular-nums">
                    {fmt(aggValues(grand))}
                  </td>
                )}
              </tr>
            )}
          </tbody>
        </table>
        {!rows.length && (
          <div className="text-center text-slate-500 text-sm py-8">Maglumat ýok</div>
        )}
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
    <ChartCanvas
      option={option}
      className={className}
      chartKind={widget.type}
      widgetId={widget.id}
      widget={widget}
      data={data}
      globalFilters={globalFilters}
    />
  );
}

/** Chart canvas — listens for header toolbar events (reset / PNG) + Task 10 pie drill */
function ChartCanvas({
  option,
  className,
  chartKind,
  widgetId,
  widget,
  data,
  globalFilters = {},
}: {
  option: any;
  className?: string;
  chartKind: string;
  widgetId: string;
  widget: DashboardWidget;
  data?: Record<string, unknown>[];
  globalFilters?: GlobalFilterValues;
}) {
  const chartRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [boxMin, setBoxMin] = useState(200);
  const dd = widget.dataSource?.drillDown;

  // Fix: pie/line/area/bar labels can be truncated (long names) with no way
  // to read them. Clicking a (possibly truncated) axis or pie label shows the
  // full text in a small popup near the click, for 3 seconds — re-clicking
  // (the same or another label) resets the timer instead of stacking popups.
  const [labelPopup, setLabelPopup] = useState<{ text: string; x: number; y: number } | null>(
    null
  );
  const labelPopupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showLabelPopup(text: string, evt: any) {
    if (!text) return;
    const zrEvt = evt?.event || evt;
    const box = wrapRef.current?.getBoundingClientRect();
    let x = typeof zrEvt?.offsetX === 'number' ? zrEvt.offsetX : (box ? box.width / 2 : 0);
    let y = typeof zrEvt?.offsetY === 'number' ? zrEvt.offsetY : (box ? box.height / 2 : 0);
    if (box) {
      x = Math.max(8, Math.min(box.width - 8, x));
      y = Math.max(8, Math.min(box.height - 8, y));
    }
    if (labelPopupTimer.current) clearTimeout(labelPopupTimer.current);
    setLabelPopup({ text, x, y });
    labelPopupTimer.current = setTimeout(() => setLabelPopup(null), 3000);
  }
  useEffect(
    () => () => {
      if (labelPopupTimer.current) clearTimeout(labelPopupTimer.current);
    },
    []
  );

  // Task 15: auto text scale with widget box size (and after zoom/resize)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth || 0;
      const h = el.clientHeight || 0;
      setBoxMin(Math.max(80, Math.min(w, h) || 200));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scaledOption = useMemo(() => {
    if (!option) return option;
    if (!widget.config?.enableAutoTextSize) return option;
    // Task 15: gentle scale only — avoid labels overflowing chart (was up to 1.85x)
    // 1.0 at ~240px box; clamp 0.9 … 1.2
    const factor = Math.max(0.9, Math.min(1.2, boxMin / 240));
    const scaleFs = (n: number | undefined, fallback = 11) => {
      const base = n ?? fallback;
      // hard cap so axis labels always fit
      return Math.min(14, Math.max(9, Math.round(base * factor)));
    };

    const opt = JSON.parse(JSON.stringify(option));
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (node.axisLabel && typeof node.axisLabel === 'object') {
        node.axisLabel.fontSize = scaleFs(node.axisLabel.fontSize, 11);
        node.axisLabel.hideOverlap = true;
      }
      if (node.label && typeof node.label === 'object' && node.label.fontSize != null) {
        node.label.fontSize = scaleFs(node.label.fontSize, 10);
      }
      if (node.textStyle && typeof node.textStyle === 'object' && node.textStyle.fontSize != null) {
        node.textStyle.fontSize = scaleFs(node.textStyle.fontSize, 11);
      }
      if (node.style && typeof node.style === 'object' && node.style.fontSize != null) {
        node.style.fontSize = scaleFs(node.style.fontSize, 13);
      }
      // keep grid.containLabel so Y values stay visible after scale
      if (node.grid) {
        const g = Array.isArray(node.grid) ? node.grid : [node.grid];
        g.forEach((gr: any) => {
          if (gr && typeof gr === 'object') {
            gr.containLabel = true;
            if (typeof gr.left === 'number') gr.left = Math.max(gr.left, 8);
            if (typeof gr.right === 'number') gr.right = Math.max(gr.right, 8);
          }
        });
      }
      for (const k of Object.keys(node)) {
        if (k === 'grid') continue;
        walk(node[k]);
      }
    };
    walk(opt);
    return opt;
  }, [option, boxMin, widget.config?.enableAutoTextSize]);

  // Task 10: multi-level pie hierarchy (nested pie + breadcrumb)
  type PathCrumb = {
    label: string;
    /** params accumulated up to this level (sent to next API) */
    params: Record<string, string | number | boolean>;
  };
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState('');
  const [pathStack, setPathStack] = useState<PathCrumb[]>([]);
  const [levelRows, setLevelRows] = useState<Record<string, unknown>[]>([]);
  const [levelMeta, setLevelMeta] = useState<{
    categoryField: string;
    valueField: string;
    sourceField: string;
  }>({ categoryField: 'name', valueField: 'value', sourceField: 'name' });

  function getChart() {
    return chartRef.current?.getEchartsInstance?.() || null;
  }

  function onReset() {
    const inst = getChart();
    if (!inst) return;
    try {
      inst.dispatchAction({ type: 'restore' });
      inst.setOption(option, true);
    } catch {
      /* */
    }
  }

  function onPng() {
    const inst = getChart();
    if (!inst) return;
    try {
      const url = inst.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#0f172a',
      });
      const a = document.createElement('a');
      a.href = url;
      a.download = `${chartKind || 'chart'}.png`;
      a.click();
    } catch {
      /* */
    }
  }

  function resolveLevelConfig(depth: number) {
    // depth 0 = first child (dd itself); depth 1+ = dd.levels[depth-1]
    if (depth <= 0 || !dd?.levels?.length) {
      return {
        path: dd?.path || '',
        tenantSlug: dd?.tenantSlug || widget.dataSource?.tenantSlug || '',
        method: (dd?.method || 'GET') as 'GET' | 'POST',
        sourceField: dd?.sourceField || widget.dataSource?.categoryField || 'name',
        targetParam: dd?.targetParam || dd?.sourceField || 'id',
        categoryField:
          dd?.categoryField || widget.dataSource?.categoryField || 'name',
        valueField:
          dd?.valueField ||
          widget.dataSource?.valueField ||
          (widget.dataSource?.valueFields && widget.dataSource.valueFields[0]) ||
          'value',
      };
    }
    const L = dd!.levels![Math.min(depth - 1, dd!.levels!.length - 1)];
    return {
      path: L.path || dd?.path || '',
      tenantSlug: L.tenantSlug || dd?.tenantSlug || widget.dataSource?.tenantSlug || '',
      method: (L.method || dd?.method || 'GET') as 'GET' | 'POST',
      sourceField: L.sourceField || dd?.sourceField || 'name',
      targetParam: L.targetParam || L.sourceField || dd?.targetParam || 'id',
      categoryField: L.categoryField || dd?.categoryField || widget.dataSource?.categoryField || 'name',
      valueField:
        L.valueField ||
        dd?.valueField ||
        widget.dataSource?.valueField ||
        'value',
    };
  }

  async function fetchHierarchyLevel(
    depth: number,
    params: Record<string, string | number | boolean>
  ) {
    const cfg = resolveLevelConfig(depth);
    if (!cfg.path || !cfg.tenantSlug) {
      setDrillError('Hierarchy API path/tenant ýok');
      return;
    }
    setDrillLoading(true);
    setDrillError('');
    try {
      const allParams = { ...params };
      if (dd?.passGlobalFilters !== false) {
        for (const [k, v] of Object.entries(globalFilters)) {
          if (v != null && v !== '') allParams[k] = v as string | number | boolean;
        }
      }
      const res = await fetch('/api/gateway/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: cfg.tenantSlug,
          path: cfg.path,
          method: cfg.method,
          dbKey: dd?.dbKey || widget.dataSource?.dbKey || 'primary',
          params: allParams,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setDrillError(body.error || 'API säwlik');
        setLevelRows([]);
      } else {
        const rows = Array.isArray(body.rows) ? body.rows : [];
        setLevelRows(rows);
        setLevelMeta({
          categoryField: cfg.categoryField,
          valueField: cfg.valueField,
          sourceField: cfg.sourceField,
        });
      }
    } catch (e) {
      setDrillError(String(e));
      setLevelRows([]);
    } finally {
      setDrillLoading(false);
    }
  }

  /** Click on root pie segment → open hierarchy at level 0 */
  async function openPieDrill(categoryName: string, row?: Record<string, unknown>) {
    if (!dd?.enabled || !dd.path || !dd.tenantSlug) return;
    const cfg = resolveLevelConfig(0);
    const sourceField = cfg.sourceField;
    // Prefer id-like field from row; fallback to category name
    let paramVal: string | number | boolean = categoryName;
    if (row) {
      const keys = Object.keys(row);
      const lower = String(sourceField || '').toLowerCase();
      const hit =
        (row[sourceField] != null && row[sourceField] !== '' ? sourceField : null) ||
        keys.find((k) => k.toLowerCase() === lower && row[k] != null && row[k] !== '') ||
        keys.find((k) => /fich_id|fish_id/i.test(k) && row[k] != null && row[k] !== '') ||
        keys.find((k) => /^(id|.*_id)$/i.test(k) && row[k] != null && row[k] !== '');
      if (hit) paramVal = row[hit] as string | number | boolean;
    }
    const targetParam = cfg.targetParam;
    const params: Record<string, string | number | boolean> = {
      [targetParam]: paramVal,
    };
    const rootLabel = dd.rootLabel || widget.title || 'Root';
    const stack: PathCrumb[] = [
      { label: rootLabel, params: {} },
      { label: categoryName, params },
    ];
    setPathStack(stack);
    setDrillOpen(true);
    await fetchHierarchyLevel(0, params);
  }

  /** Click segment inside hierarchy pie → go deeper */
  async function drillDeeper(categoryName: string, row?: Record<string, unknown>) {
    const depth = Math.max(0, pathStack.length - 1); // current child depth
    const nextDepth = depth; // levels index for NEXT fetch uses depth as next level index
    // pathStack: [root, level0, level1, ...] → current data is level (pathStack.length-2)
    const currentLevelIndex = pathStack.length - 2; // 0-based child level currently shown
    const cfg = resolveLevelConfig(currentLevelIndex + 1);
    let paramVal: string | number | boolean = categoryName;
    if (row) {
      if (row[cfg.sourceField] != null && row[cfg.sourceField] !== '') {
        paramVal = row[cfg.sourceField] as string | number | boolean;
      } else if (row['id'] != null) {
        paramVal = row['id'] as string | number | boolean;
      }
    }
    const prevParams = pathStack[pathStack.length - 1]?.params || {};
    const params = {
      ...prevParams,
      [cfg.targetParam]: paramVal,
    };
    const nextStack = [...pathStack, { label: categoryName, params }];
    setPathStack(nextStack);
    await fetchHierarchyLevel(currentLevelIndex + 1, params);
  }

  function goToCrumb(index: number) {
    // index 0 = root → close modal
    if (index <= 0) {
      setDrillOpen(false);
      setPathStack([]);
      setLevelRows([]);
      return;
    }
    const crumb = pathStack[index];
    if (!crumb) return;
    const nextStack = pathStack.slice(0, index + 1);
    setPathStack(nextStack);
    // child level shown after this crumb is index-1
    void fetchHierarchyLevel(index - 1, crumb.params);
  }

  function undoOne() {
    if (pathStack.length <= 2) {
      // back to root pie
      setDrillOpen(false);
      setPathStack([]);
      setLevelRows([]);
      return;
    }
    goToCrumb(pathStack.length - 2);
  }

  function onChartClick(params: any) {
    // Fix: axis label click (line/area/bar category axis) → show full text.
    // These never had a click behavior before, regardless of drill-down.
    if (
      (params?.componentType === 'xAxis' || params?.componentType === 'yAxis') &&
      params?.value != null &&
      String(params.value).length > 0
    ) {
      showLabelPopup(String(params.value), params.event);
      return;
    }
    // Fix: pie/donut label click → show full name (+ value), but only when
    // drill-down isn't wired up for this widget (drill-down already has its
    // own, more useful, click behavior below).
    if (
      params?.componentType === 'series' &&
      (chartKind === 'pie' || chartKind === 'donut') &&
      !dd?.enabled &&
      params?.name
    ) {
      const text = params.value != null ? `${params.name}: ${params.value}` : String(params.name);
      showLabelPopup(text, params.event);
      return;
    }
    if (chartKind !== 'pie' && chartKind !== 'donut') return;
    if (!params?.data?.name) return;
    if (!dd?.enabled) return;
    const name = String(params.data.name);
    const catKey = widget.dataSource?.categoryField || 'name';
    // Prefer embedded row from pie data (keeps hidden hierarchy id columns)
    let row: Record<string, unknown> | undefined = params.data._row;
    if (!row) {
      row = (data || []).find((r) => String(r[catKey] ?? '') === name);
    }
    if (row && params.data._drillId != null && dd.sourceField) {
      row = { ...row, [dd.sourceField]: params.data._drillId };
    }
    void openPieDrill(name, row);
  }

  useEffect(() => {
    const onCmd = (e: Event) => {
      const ce = e as CustomEvent<{ id: string; action: string }>;
      if (!ce.detail || ce.detail.id !== widgetId) return;
      if (ce.detail.action === 'reset') onReset();
      if (ce.detail.action === 'png') onPng();
    };
    window.addEventListener('bi-chart-cmd', onCmd as EventListener);
    return () => window.removeEventListener('bi-chart-cmd', onCmd as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetId, option, chartKind]);

  useEffect(() => {
    const inst = getChart();
    if (!inst) return;
    const handleClick = (params: any) => onChartClick(params);
    inst.off('click');
    inst.on('click', handleClick);
    return () => {
      inst.off('click', handleClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetId, chartKind, dd?.enabled, dd?.path, dd?.tenantSlug, dd?.sourceField, option, data]);

  // Hierarchy pie option
  const hierarchyPieOption = useMemo(() => {
    const catKey = levelMeta.categoryField;
    const valKey = levelMeta.valueField;
    const palette = widget.config?.colors?.length
      ? widget.config.colors
      : ['#6366f1', '#22d3ee', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#fb7185', '#60a5fa'];
    const pieData = levelRows.map((r, i) => ({
      name: String(r[catKey] ?? ''),
      value: Number(r[valKey] ?? 0),
      itemStyle: { color: palette[i % palette.length] },
      _row: r,
    }));
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [
        {
          type: 'pie',
          radius: ['36%', '62%'],
          center: ['50%', '52%'],
          data: pieData,
          label: {
            color: '#cbd5e1',
            fontSize: 11,
            formatter: '{b}\n{d}%',
          },
          emphasis: { scale: true, scaleSize: 8 },
        },
      ],
    };
  }, [levelRows, levelMeta, widget.config?.colors]);

  const hierarchyChartRef = useRef<any>(null);

  // Click handler on hierarchy pie
  useEffect(() => {
    if (!drillOpen) return;
    const inst = hierarchyChartRef.current?.getEchartsInstance?.();
    if (!inst) return;
    const handler = (params: any) => {
      if (!params?.data?.name) return;
      const name = String(params.data.name);
      const row =
        params.data._row ||
        levelRows.find((r) => String(r[levelMeta.categoryField] ?? '') === name);
      void drillDeeper(name, row);
    };
    inst.off('click');
    inst.on('click', handler);
    return () => {
      inst.off('click', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillOpen, levelRows, levelMeta, pathStack, hierarchyPieOption]);

  return (
    <div ref={wrapRef} className={cn('relative h-full w-full', className)}>
      <ReactECharts
        ref={chartRef}
        option={scaledOption || option}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge
      />

      {/* Fix: full-text popup for a clicked (possibly truncated) label —
          bigger, wraps to a 2nd line if needed, auto-hides after 3s. */}
      {labelPopup && (
        <div
          className="absolute z-30 pointer-events-none max-w-[75%] sm:max-w-[220px] rounded-lg border border-slate-600 bg-slate-900/95 px-2.5 py-1.5 text-[13px] leading-snug text-white shadow-xl break-words line-clamp-2"
          style={{
            left: labelPopup.x,
            top: Math.max(0, labelPopup.y - 34),
            transform: 'translate(-50%, -100%)',
          }}
        >
          {labelPopup.text}
        </div>
      )}

      {/* Task 10: nested pie hierarchy modal with breadcrumb */}
      {drillOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[2147482800] flex items-center justify-center p-3 sm:p-4">
            <div
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
              onClick={() => {
                setDrillOpen(false);
                setPathStack([]);
                setLevelRows([]);
              }}
            />
            <div className="relative w-full max-w-3xl h-[min(88dvh,720px)] rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl flex flex-col overflow-hidden z-10">
              {/* Breadcrumb path + undo */}
              <div className="flex items-center gap-1 px-3 sm:px-4 py-2.5 border-b border-slate-800 shrink-0">
                <div className="flex-1 min-w-0 flex items-center gap-0.5 overflow-x-auto text-xs sm:text-sm">
                  {pathStack.map((c, i) => (
                    <span key={i} className="inline-flex items-center shrink-0">
                      {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-600 mx-0.5" />}
                      <button
                        type="button"
                        onClick={() => goToCrumb(i)}
                        className={
                          i === pathStack.length - 1
                            ? 'text-indigo-300 font-semibold px-1 py-0.5 rounded'
                            : 'text-slate-400 hover:text-white px-1 py-0.5 rounded hover:bg-slate-800'
                        }
                        title={c.label}
                      >
                        {c.label}
                      </button>
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => undoOne()}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 shrink-0"
                  title="Yza (undo)"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDrillOpen(false);
                    setPathStack([]);
                    setLevelRows([]);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
                  title="Ýap"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 min-h-0 relative">
                {drillLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-slate-950/60 text-slate-400 text-sm">
                    <Loader2 className="h-5 w-5 animate-spin" /> Ýüklenýär…
                  </div>
                )}
                {drillError && (
                  <div className="p-4 text-rose-400 text-sm bg-rose-500/10 m-3 rounded-lg">
                    {drillError}
                  </div>
                )}
                {!drillLoading && !drillError && levelRows.length === 0 && (
                  <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                    Maglumat ýok
                  </div>
                )}
                {!drillError && levelRows.length > 0 && (
                  <ReactECharts
                    ref={hierarchyChartRef}
                    option={hierarchyPieOption}
                    style={{ height: '100%', width: '100%' }}
                    opts={{ renderer: 'canvas' }}
                    notMerge
                  />
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
