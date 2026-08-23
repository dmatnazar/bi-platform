'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GlobalFilterDef, GlobalFilterValues } from '@/lib/types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Calendar, Filter, RotateCcw, Search, X, Network, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  filters: GlobalFilterDef[];
  values: GlobalFilterValues;
  onChange: (values: GlobalFilterValues) => void;
  onApply?: () => void;
  className?: string;
  /** compact mode for tight headers */
  compact?: boolean;
}

/** Local calendar date YYYY-MM-DD (not UTC — avoids timezone day shift) */
function localDateISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISO() {
  return localDateISO();
}

function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateISO(d);
}

/** For display in <input type="date"> strip time portion */
function toDateInputValue(v: unknown): string {
  if (v == null || v === '') return '';
  const s = String(v);
  const m = s.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s;
}

const PRESETS: { label: string; begin: () => string; end: () => string }[] = [
  { label: 'Bugün', begin: () => todayISO(), end: () => todayISO() },
  { label: '7 gün', begin: () => daysAgoISO(6), end: () => todayISO() },
  { label: '30 gün', begin: () => daysAgoISO(29), end: () => todayISO() },
  { label: 'Bu aý', begin: () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, end: () => todayISO() },
  { label: 'Bu ýyl', begin: () => `${new Date().getFullYear()}-01-01`, end: () => todayISO() },
];


function MultiselectFilter({
  filter,
  value,
  onChange,
}: {
  filter: GlobalFilterDef;
  value: string | number | boolean | null | undefined;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<{ value: string; label: string }[]>(filter.options || []);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  const isAll = value === '__ALL__';
  const selected = useMemo(() => {
    if (value == null || value === '' || value === '__ALL__') return [] as string[];
    return String(value)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [value]);
  const allChecked = isAll || (opts.length > 0 && selected.length === opts.length && selected.length > 0);

  useEffect(() => {
    if (filter.options?.length) {
      setOpts(filter.options);
      return;
    }
    const src = filter.optionsSource;
    if (!src?.path) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/gateway/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantSlug: src.tenantSlug,
            path: src.path,
            method: src.method || 'GET',
            dbKey: src.dbKey || 'primary',
            params: src.params || {},
          }),
        });
        const data = await res.json().catch(() => ({}));
        const rows: Record<string, unknown>[] = Array.isArray(data.rows)
          ? data.rows
          : Array.isArray(data.data)
            ? data.data
            : Array.isArray(data)
              ? data
              : [];
        if (cancelled) return;
        const vf = src.valueField;
        const lf = src.labelField || src.valueField;
        const seen = new Set<string>();
        const next: { value: string; label: string }[] = [];
        for (const r of rows) {
          // If no valueField, take first column
          const keys = Object.keys(r);
          const v = String((vf ? r[vf] : r[keys[0]]) ?? '');
          if (!v || seen.has(v)) continue;
          seen.add(v);
          const label = String((lf ? r[lf] : r[keys[1] || keys[0]]) ?? v);
          next.push({ value: v, label });
        }
        setOpts(next);
      } catch {
        if (!cancelled) setOpts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter.key, filter.options, filter.optionsSource]);

  function commit(ids: string[]) {
    if (opts.length > 0 && ids.length >= opts.length) {
      onChange('__ALL__');
      return;
    }
    if (ids.length === 0) {
      onChange('');
      return;
    }
    onChange(ids.join(','));
  }

  function toggle(v: string) {
    // When currently "all", unchecking one means all others selected
    const base = isAll ? opts.map((o) => o.value) : selected;
    const set = new Set(base);
    if (set.has(v)) set.delete(v);
    else set.add(v);
    commit([...set]);
  }

  function toggleAll() {
    if (allChecked) onChange('');
    else onChange('__ALL__');
  }

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return opts;
    return opts.filter(
      (o) => o.label.toLowerCase().includes(qq) || o.value.toLowerCase().includes(qq)
    );
  }, [opts, q]);

  const label =
    isAll || allChecked
      ? `Hemmesi (${opts.length})`
      : selected.length === 0
        ? filter.placeholder || 'Sayla…'
        : selected.length <= 2
          ? selected
              .map((v) => opts.find((o) => o.value === v)?.label || v)
              .join(', ')
          : `${selected.length} / ${opts.length}`;

  return (
    <div className="relative min-w-[160px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          'w-full h-9 px-3 rounded-xl border border-slate-700 bg-slate-950 text-left text-xs text-slate-200 truncate ' +
          ((selected.length > 0 || isAll) ? 'border-indigo-500/40 text-indigo-200' : '')
        }
      >
        {loading ? 'Yuklenyar…' : label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full mt-1 left-0 min-w-full w-64 max-h-72 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl flex flex-col">
            <div className="p-2 border-b border-slate-800">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Gozle…"
                className="w-full h-8 px-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>
            <div className="overflow-y-auto p-2 space-y-0.5 max-h-52">
              {opts.length === 0 ? (
                <p className="text-[11px] text-slate-500 px-2 py-1.5">
                  {loading ? 'Yuklenyar…' : 'Maglumat yok'}
                </p>
              ) : (
                <>
                  <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer text-xs text-slate-300 border-b border-slate-800 mb-0.5">
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                    <span className="font-medium">Hemmesini sayla</span>
                  </label>
                  {filtered.map((o) => (
                    <label
                      key={o.value}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer text-xs text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={isAll || selected.includes(o.value)}
                        onChange={() => toggle(o.value)}
                      />
                      <span className="truncate">{o.label}</span>
                    </label>
                  ))}
                </>
              )}
            </div>
            {(selected.length > 0 || isAll) && (
              <button
                type="button"
                className="w-full text-[11px] text-slate-400 hover:text-rose-300 py-1.5 border-t border-slate-800"
                onClick={() => onChange('')}
              >
                Arassala
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function DashboardFilterBar({
  filters,
  values,
  onChange,
  onApply,
  className,
  compact,
}: Props) {
  const [filtersOpen, setFiltersOpen] = useState(true);

  const hasFilters = filters.length > 0;

  const activeCount = useMemo(() => {
    let n = 0;
    for (const f of filters) {
      if (f.type === 'daterange') {
        if (values[f.key] || (f.endKey && values[f.endKey])) n++;
      } else if (values[f.key] !== undefined && values[f.key] !== null && values[f.key] !== '') {
        n++;
      }
    }
    return n;
  }, [filters, values]);

  function setKey(key: string, val: string | number | boolean | null | undefined) {
    onChange({ ...values, [key]: val });
  }

  function reset() {
    const next: GlobalFilterValues = {};
    for (const f of filters) {
      if (f.defaultValue !== undefined) next[f.key] = f.defaultValue;
      if (f.type === 'daterange' && f.endKey && f.defaultValue === undefined) {
        // leave empty
      }
    }
    onChange(next);
  }

  function applyPreset(p: (typeof PRESETS)[0]) {
    const rangeFilter = filters.find((f) => f.type === 'daterange');
    if (!rangeFilter) return;
    const next = { ...values };
    next[rangeFilter.key] = p.begin();
    if (rangeFilter.endKey) next[rangeFilter.endKey] = p.end();
    onChange(next);
  }

  if (!hasFilters) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/40 px-4 py-3 text-sm text-slate-500 flex items-center gap-2',
          className
        )}
      >
        <Filter className="h-4 w-4 shrink-0" />
        <span>Filter ýok. Widget sazlamasynda API parametrlerini global filter hökmünde goşuň.</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/90 to-slate-900/60 shadow-md shadow-black/15',
        compact ? 'p-2' : 'p-2.5',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors min-w-0"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400 shrink-0">
            <Filter className="h-3.5 w-3.5" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs font-semibold text-white leading-tight flex items-center gap-1.5">
              Filterler
              {filtersOpen ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
            </p>
            <p className="text-[10px] text-slate-500 truncate">
              {activeCount > 0 ? `${activeCount} aktif` : 'Ähli widget-lere täsir edýär'}
            </p>
          </div>
        </button>

        {filtersOpen && filters.some((f) => f.type === 'daterange') && (
          <div className="flex flex-wrap gap-1 ml-auto">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800/80 text-slate-300 hover:bg-indigo-500/20 hover:text-indigo-300 border border-slate-700/80 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        {!filtersOpen && (
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="ml-auto text-[10px] text-indigo-400 hover:text-indigo-300 px-2 py-1"
          >
            Aç
          </button>
        )}
      </div>

      {filtersOpen && (
      <div className="flex flex-wrap items-end gap-2 mt-2.5 pt-2.5 border-t border-slate-800/80">
        {filters.map((f) => {
          if (f.type === 'daterange') {
            return (
              <div key={f.key} className="flex flex-wrap items-end gap-2">
                <div className="min-w-[140px]">
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    {f.label} — başla
                    {f.required && <span className="text-rose-400 ml-0.5">*</span>}
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                    <input
                      type="date"
                      value={toDateInputValue(values[f.key])}
                      onChange={(e) => setKey(f.key, e.target.value || null)}
                      className="w-full h-9 rounded-xl border border-slate-700 bg-slate-950/80 pl-8 pr-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                    />
                  </div>
                </div>
                <div className="min-w-[140px]">
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    gutar
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                    <input
                      type="date"
                      value={toDateInputValue(values[f.endKey || 'endDate'])}
                      onChange={(e) => setKey(f.endKey || 'endDate', e.target.value || null)}
                      className="w-full h-9 rounded-xl border border-slate-700 bg-slate-950/80 pl-8 pr-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                    />
                  </div>
                </div>
              </div>
            );
          }

          if (f.type === 'date' || f.type === 'datetime') {
            // begin/end-like keys always use date-only so wall-clock time is never sent
            const forceDateOnly =
              f.type === 'date' ||
              /begin|start|from|end|gutar|to$|dateFrom|dateTo/i.test(f.key);
            return (
              <div key={f.key} className="min-w-[150px]">
                <label className="mb-1 block text-[11px] font-medium text-slate-400">
                  {f.label}
                  {f.required && <span className="text-rose-400 ml-0.5">*</span>}
                </label>
                <input
                  type={forceDateOnly ? 'date' : 'datetime-local'}
                  value={
                    forceDateOnly
                      ? toDateInputValue(values[f.key])
                      : String(values[f.key] ?? '').replace(' ', 'T').slice(0, 16)
                  }
                  onChange={(e) => {
                    const raw = e.target.value || null;
                    if (!raw) {
                      setKey(f.key, null);
                      return;
                    }
                    // Always store date-only for range bounds — API layer expands to 00:00:00 / 23:59:59
                    if (forceDateOnly) {
                      const d = raw.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || raw;
                      setKey(f.key, d);
                    } else {
                      setKey(f.key, raw);
                    }
                  }}
                  className="w-full h-9 rounded-xl border border-slate-700 bg-slate-950/80 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
            );
          }

          if (f.type === 'text') {
            return (
              <div key={f.key} className="min-w-[180px] flex-1 max-w-xs">
                <label className="mb-1 block text-[11px] font-medium text-slate-400">
                  {f.label}
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    value={String(values[f.key] ?? '')}
                    onChange={(e) => setKey(f.key, e.target.value)}
                    placeholder={f.placeholder || f.label}
                    className="w-full h-9 rounded-xl border border-slate-700 bg-slate-950/80 pl-8 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              </div>
            );
          }

          if (f.type === 'number') {
            return (
              <div key={f.key} className="min-w-[120px]">
                <label className="mb-1 block text-[11px] font-medium text-slate-400">
                  {f.label}
                </label>
                <input
                  type="number"
                  value={values[f.key] === undefined || values[f.key] === null ? '' : String(values[f.key])}
                  onChange={(e) =>
                    setKey(f.key, e.target.value === '' ? null : Number(e.target.value))
                  }
                  className="w-full h-9 rounded-xl border border-slate-700 bg-slate-950/80 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
            );
          }

          if (f.type === 'multiselect') {
            return (
              <div key={f.key} className="min-w-[160px] space-y-1">
                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{f.label}</label>
                <MultiselectFilter
                  filter={f}
                  value={values[f.key]}
                  onChange={(v) => setKey(f.key, v || null)}
                />
              </div>
            );
          }
          if (f.type === 'select' && f.options) {
            return (
              <div key={f.key} className="min-w-[140px]">
                <Select
                  label={f.label}
                  value={String(values[f.key] ?? '')}
                  onChange={(e) => setKey(f.key, e.target.value || null)}
                  options={[
                    { value: '', label: '— ählisi —' },
                    ...f.options,
                  ]}
                />
              </div>
            );
          }

          if (f.type === 'boolean') {
            return (
              <div key={f.key} className="flex items-center gap-2 h-9 mt-5">
                <input
                  id={`gf-${f.key}`}
                  type="checkbox"
                  checked={!!values[f.key]}
                  onChange={(e) => setKey(f.key, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                />
                <label htmlFor={`gf-${f.key}`} className="text-sm text-slate-300">
                  {f.label}
                </label>
              </div>
            );
          }

          return null;
        })}

        <div className="flex items-center gap-2 ml-auto">
          {activeCount > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={reset} className="text-slate-400">
              <RotateCcw className="h-3.5 w-3.5" />
              Arassala
            </Button>
          )}
          {onApply && (
            <Button type="button" size="sm" onClick={onApply}>
              Ulan
            </Button>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

/** Editor to add/remove global filter definitions on a dashboard */
interface EditorProps {
  filters: GlobalFilterDef[];
  onChange: (filters: GlobalFilterDef[]) => void;
}

interface EndpointOpt {
  id: string;
  name: string;
  tenantSlug: string;
  pathTemplate: string;
  method: string;
  dbKey?: string;
}

export function GlobalFiltersEditor({ filters, onChange }: EditorProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointOpt[]>([]);
  const [epId, setEpId] = useState('');
  const [label, setLabel] = useState('');
  const [paramKey, setParamKey] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [labelCol, setLabelCol] = useState('');
  const [valueCol, setValueCol] = useState('');
  const [preview, setPreview] = useState<{ label: string; value: string }[]>([]);
  const [loadingCols, setLoadingCols] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!customOpen) return;
    fetch('/api/catalog')
      .then((r) => r.json())
      .then((d) => setEndpoints(d.endpoints || []))
      .catch(() => setEndpoints([]));
  }, [customOpen]);

  const selectedEp = useMemo(() => endpoints.find((e) => e.id === epId), [endpoints, epId]);

  async function loadColumns(id: string, opts?: { preserve?: boolean }): Promise<void> {
    const ep = endpoints.find((e) => e.id === id);
    if (!ep) return;
    setEpId(id);
    setLoadingCols(true);
    setError('');
    setColumns([]);
    if (!opts?.preserve) {
      setLabelCol('');
      setValueCol('');
      setPreview([]);
      setParamKey('');
    }
    // Diňe label boş bolsa API adyny teklip et
    setLabel((prev) => prev.trim() || ep.name || '');
    try {
      // pathTemplate like /salesmans or /api/v1/... — gateway expects path relative to tenant
      let path = ep.pathTemplate || '';
      path = path.replace(/\{[^}]+\}/g, '');
      if (!path.startsWith('/')) path = '/' + path;
      const res = await fetch('/api/gateway/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: ep.tenantSlug,
          path,
          method: ep.method || 'GET',
          dbKey: ep.dbKey || 'primary',
          params: {},
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `API ýalňyşlyk (${res.status})`);
        return;
      }
      const rows: Record<string, unknown>[] = Array.isArray(data.rows)
        ? data.rows
        : Array.isArray(data.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];
      if (rows.length === 0) {
        setError('API boş netije gaýtardy — column tapylmady');
        return;
      }
      const cols = Object.keys(rows[0] || {});
      setColumns(cols);
      // Heuristic: *name* / *title* for label, *id* for value
      const guessLabel =
        cols.find((c) => /name|title|ady|label/i.test(c)) || cols[0] || '';
      const guessValue =
        cols.find((c) => /_id$|Id$|^id$/i.test(c) && c !== guessLabel) ||
        cols.find((c) => /id/i.test(c)) ||
        cols[1] ||
        cols[0] ||
        '';
      if (!opts?.preserve) {
        setLabelCol(guessLabel);
        setValueCol(guessValue);
        setParamKey(guessValue);
      }
      // preview unique pairs
      const seen = new Set<string>();
      const prev: { label: string; value: string }[] = [];
      for (const r of rows.slice(0, 50)) {
        const v = String(r[guessValue] ?? '');
        if (!v || seen.has(v)) continue;
        seen.add(v);
        prev.push({ value: v, label: String(r[guessLabel] ?? v) });
      }
      setPreview(prev);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingCols(false);
    }
  }

  function refreshPreview(lCol: string, vCol: string) {
    setLabelCol(lCol);
    setValueCol(vCol);
    if (!vCol) return;
    setParamKey((k) => k || vCol);
    // re-query not needed if we stored rows — for simplicity keep preview from last load
    // user can re-select API to refresh
  }

  function addDateRange() {
    if (filters.some((f) => f.type === 'daterange')) return;
    onChange([
      ...filters,
      {
        key: 'beginDate',
        endKey: 'endDate',
        label: 'Sene aralygy',
        type: 'daterange',
        required: true,
      },
    ]);
  }

  function addText(key = 'search') {
    if (filters.some((f) => f.key === key)) return;
    onChange([
      ...filters,
      { key, label: key === 'search' ? 'Gözleg' : key, type: 'text', placeholder: 'Gözle...' },
    ]);
  }

  function remove(key: string) {
    onChange(filters.filter((f) => f.key !== key));
  }

  function moveFilter(key: string, dir: -1 | 1) {
    const i = filters.findIndex((f) => f.key === key);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= filters.length) return;
    const next = [...filters];
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
    onChange(next);
  }

  function openEdit(f: GlobalFilterDef) {
    setEditingKey(f.key);
    setCustomOpen(true);
    setError('');
    setLabel(f.label || f.key);
    setParamKey(f.key);
    setLabelCol(f.optionsSource?.labelField || '');
    setValueCol(f.optionsSource?.valueField || '');
    setPreview([]);
    setColumns([]);
    // match endpoint by path
    setEpId('');
    // load catalog then pick ep
    fetch('/api/catalog')
      .then((r) => r.json())
      .then((d) => {
        const eps: EndpointOpt[] = d.endpoints || [];
        setEndpoints(eps);
        const src = f.optionsSource;
        if (!src) return;
        const match = eps.find(
          (e) =>
            (e.pathTemplate || '').includes(src.path.replace(/^\//, '')) ||
            src.path.includes((e.pathTemplate || '').replace(/^\//, ''))
        );
        if (match) {
          setEpId(match.id);
          void loadColumns(match.id, { preserve: true }).then(() => {
            setLabelCol(src.labelField || '');
            setValueCol(src.valueField || '');
            setParamKey(f.key);
            setLabel(f.label || f.key);
          });
        } else {
          setError('API match tapylmady — el bilen saýlaň');
        }
      })
      .catch(() => {});
  }

  function resetModal() {
    setCustomOpen(false);
    setEditingKey(null);
    setEpId('');
    setColumns([]);
    setLabel('');
    setParamKey('');
    setLabelCol('');
    setValueCol('');
    setPreview([]);
    setError('');
  }

  function saveCustom() {
    if (!selectedEp || !labelCol || !valueCol || !paramKey.trim()) {
      setError('API, UI column, key column we filtr adyny dolduryň');
      return;
    }
    const key = paramKey.trim();
    if (filters.some((f) => f.key === key && f.key !== editingKey)) {
      setError(`«${key}» eýýäm bar`);
      return;
    }
    if (!label.trim()) {
      setError('Filter adyny ýazyň (UI-da görkezilýän at)');
      return;
    }
    setSaving(true);
    let path = selectedEp.pathTemplate || '';
    path = path.replace(/\{[^}]+\}/g, '');
    if (!path.startsWith('/')) path = '/' + path;

    const def: GlobalFilterDef = {
      key,
      label: label.trim(),
      type: 'multiselect',
      placeholder: 'Saýla…',
      optionsSource: {
        tenantSlug: selectedEp.tenantSlug,
        path,
        method: (selectedEp.method as 'GET' | 'POST') || 'GET',
        dbKey: selectedEp.dbKey || 'primary',
        valueField: valueCol,
        labelField: labelCol,
      },
    };
    if (editingKey) {
      onChange(filters.map((f) => (f.key === editingKey ? def : f)));
    } else {
      onChange([...filters, def]);
    }
    setSaving(false);
    resetModal();
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-400">Global filterler</p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={addDateRange}
          className="px-2.5 py-1 rounded-lg text-[11px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25"
        >
          + Sene aralygy
        </button>
        <button
          type="button"
          onClick={() => addText('search')}
          className="px-2.5 py-1 rounded-lg text-[11px] bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
        >
          + Gözleg
        </button>
        <button
          type="button"
          onClick={() => {
            setEditingKey(null);
            setLabel('');
            setParamKey('');
            setEpId('');
            setColumns([]);
            setCustomOpen(true);
            setError('');
          }}
          className="px-2.5 py-1 rounded-lg text-[11px] bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25"
        >
          + Custom (API)
        </button>
      </div>

      {filters.length > 0 && (
        <ul className="space-y-1 mt-2">
          {filters.map((f, idx) => (
            <li
              key={f.key}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', String(idx));
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = Number(e.dataTransfer.getData('text/plain'));
                const to = idx;
                if (Number.isNaN(from) || from === to) return;
                const next = [...filters];
                const [item] = next.splice(from, 1);
                next.splice(to, 0, item);
                onChange(next);
              }}
              className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/60 px-2.5 py-1.5 text-xs text-slate-300 cursor-grab active:cursor-grabbing"
            >
              <span className="min-w-0 truncate">
                <span className="font-mono text-indigo-300">{f.key}</span>
                {f.endKey && (
                  <>
                    {' '}
                    → <span className="font-mono text-indigo-300">{f.endKey}</span>
                  </>
                )}
                <span className="text-slate-500 ml-2">({f.type})</span>
                {f.optionsSource && (
                  <span className="text-violet-400/80 ml-2 truncate">
                    · {f.optionsSource.path} · {f.optionsSource.labelField}→{f.optionsSource.valueField}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => moveFilter(f.key, -1)}
                  className="px-1 py-0.5 text-[10px] rounded-md text-slate-500 hover:text-white hover:bg-slate-800"
                  title="Ýokary"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveFilter(f.key, 1)}
                  className="px-1 py-0.5 text-[10px] rounded-md text-slate-500 hover:text-white hover:bg-slate-800"
                  title="Aşak"
                >
                  ↓
                </button>
                {(f.type === 'multiselect' || f.optionsSource) && (
                  <button
                    type="button"
                    onClick={() => openEdit(f)}
                    className="px-1.5 py-0.5 text-[10px] rounded-md text-violet-300 hover:bg-violet-500/15"
                    title="Üýtget"
                  >
                    Üýtget
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(f.key)}
                  className="p-0.5 text-slate-500 hover:text-rose-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Custom filter modal */}
      {customOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => resetModal()}
          />
          <div className="relative w-full max-w-lg max-h-[min(90vh,720px)] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
            <div className="shrink-0 px-5 pt-5 pb-3 border-b border-slate-800">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
                  <Network className="h-5 w-5 text-violet-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-white">
                    {editingKey ? 'Filter üýtget' : 'Custom filter (API)'}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Filter ady UI-da görünýär · API columnlar · key beýleki API-lara iberilýär
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => resetModal()}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {error && (
                <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-violet-300">Filter ady (UI-da görkezilýän)</label>
                <input
                  className="w-full h-10 rounded-xl bg-slate-950 border border-violet-500/30 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/40"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Mysal: Satyjy, Sebit, Kategoriýa"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-400">1. API saýla</label>
                <select
                  className="w-full h-10 rounded-xl bg-slate-950 border border-slate-700 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/40"
                  value={epId}
                  onChange={(e) => void loadColumns(e.target.value)}
                >
                  <option value="">— API —</option>
                  {endpoints.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.method} {ep.name} ({ep.tenantSlug}
                      {ep.pathTemplate})
                    </option>
                  ))}
                </select>
              </div>

              {loadingCols && (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Columnlar ýüklenýär…
                </div>
              )}

              {columns.length > 0 && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-400">
                      2. UI-da görkezilýän column (mysal: salesman_name)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto rounded-xl border border-slate-800 p-2 bg-slate-950/50">
                      {columns.map((c) => (
                        <label
                          key={`l-${c}`}
                          className={cn(
                            'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] cursor-pointer border',
                            labelCol === c
                              ? 'border-violet-500/50 bg-violet-500/15 text-violet-200'
                              : 'border-transparent text-slate-300 hover:bg-slate-800'
                          )}
                        >
                          <input
                            type="radio"
                            name="labelCol"
                            checked={labelCol === c}
                            onChange={() => {
                              setLabelCol(c);
                              refreshPreview(c, valueCol);
                            }}
                            className="accent-violet-500"
                          />
                          <span className="font-mono truncate">{c}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-400">
                      3. Key column — beýleki API-lara iberilýän (mysal: salesman_id)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto rounded-xl border border-slate-800 p-2 bg-slate-950/50">
                      {columns.map((c) => (
                        <label
                          key={`v-${c}`}
                          className={cn(
                            'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] cursor-pointer border',
                            valueCol === c
                              ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-200'
                              : 'border-transparent text-slate-300 hover:bg-slate-800'
                          )}
                        >
                          <input
                            type="radio"
                            name="valueCol"
                            checked={valueCol === c}
                            onChange={() => {
                              setValueCol(c);
                              setParamKey(c);
                              refreshPreview(labelCol, c);
                            }}
                            className="accent-indigo-500"
                          />
                          <span className="font-mono truncate">{c}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Parametr key (beýleki API-lara iberilýär)</label>
                    <input
                      className="w-full h-9 rounded-xl bg-slate-950 border border-slate-700 px-3 text-sm text-white font-mono outline-none focus:ring-2 focus:ring-violet-500/40"
                      value={paramKey}
                      onChange={(e) => setParamKey(e.target.value)}
                      placeholder="salesman_id"
                    />
                    <p className="text-[10px] text-slate-500">Filter ýokardaky ady UI-da; bu key API parametr ady</p>
                  </div>

                  {preview.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-slate-400">
                        Synag (filterde şeýle görünér)
                      </label>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2 max-h-28 overflow-y-auto space-y-0.5">
                        {preview.slice(0, 8).map((p) => (
                          <div
                            key={p.value}
                            className="flex items-center justify-between gap-2 px-2 py-1 text-[11px]"
                          >
                            <span className="text-slate-200 truncate flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-slate-600" />
                              {p.label}
                            </span>
                            <span className="font-mono text-slate-500 shrink-0">→ {p.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-800 px-5 py-3 flex gap-2 bg-slate-900">
              <button
                type="button"
                disabled={!valueCol || !labelCol || !paramKey.trim() || saving}
                onClick={saveCustom}
                className="flex-1 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-sm font-medium text-white"
              >
                Ýatda sakla
              </button>
              <button
                type="button"
                onClick={() => resetModal()}
                className="h-10 px-4 rounded-xl border border-slate-700 text-sm text-slate-300 hover:bg-slate-800"
              >
                Ýatyr
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
