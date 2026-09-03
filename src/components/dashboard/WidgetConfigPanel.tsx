'use client';

// Task 12: Parameter persistence — cache required param values across widgets
// Task 13: Column selection for aggregate functions (Sum, Count, etc.)

import { useEffect, useMemo, useState } from 'react';
import type {
  DashboardWidget,
  WidgetDataSource,
  ParamsSchema,
  ParamDef,
  ParamBinding,
  GlobalFilterDef,
} from '@/lib/types';
import { flattenParamsSchema, suggestFiltersFromSchema } from '@/lib/types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Link2, X, Sparkles } from 'lucide-react';

interface EndpointOpt {
  id: string;
  name: string;
  tenantSlug: string;
  pathTemplate: string;
  method: string;
  dbKey?: string;
  paramsSchema?: ParamsSchema;
}

interface Props {
  widget: DashboardWidget;
  onChange: (w: DashboardWidget) => void;
  onClose: () => void;
  globalFilters?: GlobalFilterDef[];
  onSuggestGlobalFilters?: (filters: GlobalFilterDef[]) => void;
}

export function WidgetConfigPanel({
  widget,
  onChange,
  onClose,
  globalFilters = [],
  onSuggestGlobalFilters,
}: Props) {
  const [endpoints, setEndpoints] = useState<EndpointOpt[]>([]);
  const [sampleColumns, setSampleColumns] = useState<string[]>([]);
  const [drillSampleColumns, setDrillSampleColumns] = useState<string[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [columnsError, setColumnsError] = useState('');
  const [columnsTick, setColumnsTick] = useState(0);

  // Task 12: Cache required param values in localStorage so same params don't need re-entry
  const [paramCache, setParamCache] = useState<Record<string, string>>(() => {
    try {
      const cached = localStorage.getItem('bi-param-cache');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Task 12: Track required params that need filling
  const [requiredParamValues, setRequiredParamValues] = useState<Record<string, string>>({});
  const [showRequiredParamsForm, setShowRequiredParamsForm] = useState(false);

  // Task 13: Column selection for aggregate functions
  const [aggregateColumn, setAggregateColumn] = useState<string>(
    widget.dataSource?.aggregateColumn || ''
  );

  // MUST be before any effect that reads ds (avoid TDZ ReferenceError)
  const ds = widget.dataSource;

  // Task 12: hydrate saved API params into widget when opening config
  useEffect(() => {
    if (!ds?.tenantSlug || !ds?.path) return;
    try {
      const key = `bi-api-params:${ds.tenantSlug}:${ds.path}`;
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, string | number | boolean>;
      if (!saved || !Object.keys(saved).length) return;
      const cur = ds.params || {};
      const missing = Object.keys(saved).filter(
        (k) => cur[k] === undefined || cur[k] === null || cur[k] === ''
      );
      if (!missing.length) return;
      const merged = { ...saved, ...cur };
      onChange({
        ...widget,
        dataSource: {
          tenantSlug: ds.tenantSlug || '',
          path: ds.path || '',
          method: ds.method || 'GET',
          ...ds,
          params: merged,
        },
      });
    } catch {
      /* */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds?.tenantSlug, ds?.path, ds?.endpointId]);

  useEffect(() => {
    fetch('/api/catalog')
      .then((r) => r.json())
      .then((d) => setEndpoints(d.endpoints || []))
      .catch(() => {});
  }, []);

  function extractRows(data: any): Record<string, unknown>[] {
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data.rows)) return data.rows;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.result)) return data.result;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data)) return data;
    if (data.data && Array.isArray(data.data.rows)) return data.data.rows;
    if (data.data && Array.isArray(data.data.data)) return data.data.data;
    // Single object payload
    if (data.row && typeof data.row === 'object') return [data.row];
    return [];
  }

  // Probe API to list available fields for Category/Value/Series
  useEffect(() => {
    if (!ds?.tenantSlug || !ds?.path) {
      setSampleColumns([]);
      setColumnsError('');
      return;
    }
    let cancelled = false;
    (async () => {
      setColumnsLoading(true);
      setColumnsError('');
      try {
        const path = ds.path.startsWith('/') ? ds.path : `/${ds.path}`;
        // Probe params: date → today range; other required → null / empty
        // Task 12: restore last-used probe params for this API (cross-widget)
        const storageKey = `bi-api-params:${ds.tenantSlug}:${ds.path}`;
        let savedParams: Record<string, string | number | boolean> = {};
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) savedParams = JSON.parse(raw) || {};
        } catch { /* */ }
        const probeParams: Record<string, string | number | boolean | null> = {
          ...savedParams,
          ...(ds.params || {}),
        };
        const schema = ds.paramsSchema || endpoints.find((e) => e.id === ds.endpointId)?.paramsSchema;
        const allDefs = schema
          ? [
              ...(schema.urlParams || []),
              ...(schema.queryParams || []),
              ...(schema.bodyParams || []),
            ]
          : [];
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const today = `${yyyy}-${mm}-${dd}`;
        const beginDefault = `${today} 00:00:00`;
        const endDefault = `${today} 23:59:59`;

        for (const def of allDefs) {
          const name = def.name;
          if (!name) continue;
          if (probeParams[name] !== undefined && probeParams[name] !== null && probeParams[name] !== '') {
            continue;
          }
          const n = name.toLowerCase();
          const isDate =
            def.type === 'date' ||
            def.type === 'datetime' ||
            /date|time|begin|start|from|end|until|gutar/i.test(n);
          if (isDate) {
            if (/end|gutar|until|dateto|to$/i.test(n)) probeParams[name] = endDefault;
            else probeParams[name] = beginDefault;
          } else {
            // optional filters → NULL so SQL handles ISNULL
            probeParams[name] = null;
          }
        }
        // Common names even without schema
        if (probeParams.beginDate === undefined && probeParams.BeginDate === undefined) {
          probeParams.beginDate = beginDefault;
        }
        if (probeParams.endDate === undefined && probeParams.EndDate === undefined) {
          probeParams.endDate = endDefault;
        }

        const res = await fetch('/api/gateway/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantSlug: ds.tenantSlug,
            path,
            method: ds.method || 'GET',
            dbKey: ds.dbKey || 'primary',
            params: probeParams,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setColumnsError(data.error || data.detail || `HTTP ${res.status}`);
          if (ds.columns?.length) setSampleColumns([...ds.columns]);
          else setSampleColumns([]);
          return;
        }
        const rows = extractRows(data);
        if (rows[0] && typeof rows[0] === 'object' && !Array.isArray(rows[0])) {
          const keys = Object.keys(rows[0] as object);
          setSampleColumns(keys);
          // Task 12: remember working params for this API
          try {
            const toSave: Record<string, string | number | boolean> = {};
            for (const [k, v] of Object.entries(probeParams)) {
              if (v != null && v !== '') toSave[k] = v as string | number | boolean;
            }
            if (Object.keys(toSave).length) {
              localStorage.setItem(
                `bi-api-params:${ds.tenantSlug}:${ds.path}`,
                JSON.stringify(toSave)
              );
            }
          } catch { /* */ }
        } else if (ds.columns?.length) {
          setSampleColumns([...ds.columns]);
        } else {
          setSampleColumns([]);
          setColumnsError(
            'Jogapda setir ýok — aşakdaky required parametrleri dolduryp «Täzele» basyň'
          );
        }
      } catch (e: any) {
        if (!cancelled) {
          setSampleColumns(ds.columns || []);
          setColumnsError(e?.message || 'Sütünler alynmady');
        }
      } finally {
        if (!cancelled) setColumnsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds?.tenantSlug, ds?.path, ds?.method, ds?.dbKey, ds?.endpointId, columnsTick]);
  // Probe drill-down (child) API for aggregate column list
  useEffect(() => {
    const dd = ds?.drillDown;
    if (!dd?.enabled || !dd.path || !dd.tenantSlug) {
      setDrillSampleColumns([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/gateway/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantSlug: dd.tenantSlug,
            path: dd.path,
            method: dd.method || 'GET',
            dbKey: dd.dbKey || ds?.dbKey || 'primary',
            params: {},
          }),
        });
        const data = await res.json().catch(() => ({}));
        const rows: Record<string, unknown>[] = Array.isArray(data.rows)
          ? data.rows
          : Array.isArray(data.data)
            ? data.data
            : [];
        if (cancelled) return;
        if (rows[0] && typeof rows[0] === 'object') {
          setDrillSampleColumns(Object.keys(rows[0]));
        } else {
          setDrillSampleColumns([]);
        }
      } catch {
        if (!cancelled) setDrillSampleColumns([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ds?.drillDown?.enabled, ds?.drillDown?.path, ds?.drillDown?.tenantSlug, ds?.drillDown?.method, ds?.dbKey]);


  const selectedEp = useMemo(
    () => endpoints.find((e) => e.id === ds?.endpointId),
    [endpoints, ds?.endpointId]
  );

  const schemaParams: ParamDef[] = useMemo(() => {
    const schema = ds?.paramsSchema || selectedEp?.paramsSchema;
    return flattenParamsSchema(schema);
  }, [ds?.paramsSchema, selectedEp]);

  function patchDs(patch: Partial<WidgetDataSource>) {
    onChange({
      ...widget,
      dataSource: {
        tenantSlug: ds?.tenantSlug || '',
        path: ds?.path || '',
        method: ds?.method || 'GET',
        ...ds,
        ...patch,
      },
    });
  }

  function selectEndpoint(id: string) {
    const ep = endpoints.find((e) => e.id === id);
    if (!ep) return;

    const schema = ep.paramsSchema;
    const flat = flattenParamsSchema(schema);
    const bindings: ParamBinding[] = flat.map((p) => {
      const isDateLike =
        /date|begin|end|from|to/i.test(p.name) || p.type === 'date' || p.type === 'datetime';
      const globalMatch = globalFilters.find(
        (g) =>
          g.key === p.name ||
          g.endKey === p.name ||
          (g.type === 'daterange' && (g.key === p.name || g.endKey === p.name))
      );
      if (globalMatch || isDateLike) {
        return {
          paramName: p.name,
          source: 'global' as const,
          globalKey:
            globalMatch?.key === p.name
              ? globalMatch.key
              : globalMatch?.endKey === p.name
                ? globalMatch.endKey!
                : p.name,
        };
      }
      return {
        paramName: p.name,
        source: 'fixed' as const,
        value: p.default != null ? String(p.default) : '',
      };
    });

    patchDs({
      endpointId: ep.id,
      tenantSlug: ep.tenantSlug,
      path: ep.pathTemplate,
      method: (ep.method as 'GET' | 'POST') || 'GET',
      dbKey: ep.dbKey || 'primary',
      paramsSchema: schema,
      paramBindings: bindings,
    });
  }

  function updateBinding(paramName: string, patch: Partial<ParamBinding>) {
    const current = ds?.paramBindings || [];
    const exists = current.find((b) => b.paramName === paramName);
    let next: ParamBinding[];
    if (exists) {
      next = current.map((b) => (b.paramName === paramName ? { ...b, ...patch } : b));
    } else {
      next = [...current, { paramName, source: 'fixed', ...patch }];
    }
    const params = { ...(ds?.params || {}) };
    const b = next.find((x) => x.paramName === paramName);
    if (b?.source === 'fixed' && b.value !== undefined && b.value !== null && b.value !== '') {
      params[paramName] = b.value as string | number | boolean;
    }
    // Task 12: remember fixed params for this API across widgets
    if (ds?.tenantSlug && ds?.path) {
      try {
        const key = `bi-api-params:${ds.tenantSlug}:${ds.path}`;
        const prev = JSON.parse(localStorage.getItem(key) || '{}');
        const merged = { ...prev, ...params };
        localStorage.setItem(key, JSON.stringify(merged));
      } catch { /* */ }
    }
    patchDs({ paramBindings: next, params });
  }

  function suggestAndAddGlobal() {
    const schema = ds?.paramsSchema || selectedEp?.paramsSchema;
    const suggested = suggestFiltersFromSchema(schema);
    if (suggested.length && onSuggestGlobalFilters) {
      const map = new Map<string, GlobalFilterDef>();
      for (const f of globalFilters) map.set(f.key, f);
      for (const f of suggested) if (!map.has(f.key)) map.set(f.key, f);
      onSuggestGlobalFilters([...map.values()]);
    }
  }

  const globalKeys = useMemo(() => {
    const keys: { value: string; label: string }[] = [];
    for (const g of globalFilters) {
      keys.push({ value: g.key, label: `${g.label} (${g.key})` });
      if (g.endKey) keys.push({ value: g.endKey, label: `${g.label} gutar (${g.endKey})` });
    }
    return keys;
  }, [globalFilters]);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between sticky top-0 bg-slate-900 z-10 pb-1">
        <h4 className="text-sm font-semibold text-white">Widget sazlama</h4>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <Input
        label="Ady"
        value={widget.title}
        onChange={(e) => onChange({ ...widget, title: e.target.value })}
      />

      {(widget.type === 'kpi' || widget.type === 'text') && (
        <Input
          label="Statik baha / tekst"
          value={String(widget.staticValue ?? '')}
          onChange={(e) => onChange({ ...widget, staticValue: e.target.value })}
        />
      )}

      <Select
        label="API (data source)"
        value={ds?.endpointId || ''}
        onChange={(e) => selectEndpoint(e.target.value)}
        options={[
          { value: '', label: '— saýlaň —' },
          ...endpoints.map((e) => ({
            value: e.id,
            label: `${e.method} ${e.name} (${e.tenantSlug})`,
          })),
        ]}
      />

      {ds?.path && (
        <p className="text-[10px] font-mono text-slate-500 break-all">
          /api/v1/{ds.tenantSlug}/{ds.dbKey || 'primary'}
          {ds.path.startsWith('/') ? ds.path : `/${ds.path}`}
        </p>
      )}

      {schemaParams.length > 0 && (
        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5 text-indigo-400" />
              API parametrleri
            </p>
            {onSuggestGlobalFilters && (
              <button
                type="button"
                onClick={suggestAndAddGlobal}
                className="flex items-center gap-1 text-[10px] text-indigo-300 hover:text-indigo-200"
                title="paramsSchema-dan global filter hökmünde goş"
              >
                <Sparkles className="h-3 w-3" />
                Global filter et
              </button>
            )}
          </div>

          {schemaParams.map((p) => {
            const binding =
              ds?.paramBindings?.find((b) => b.paramName === p.name) ||
              ({
                paramName: p.name,
                source: 'fixed' as const,
                value: ds?.params?.[p.name] ?? '',
              } satisfies ParamBinding);

            return (
              <div
                key={p.name}
                className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-indigo-300">
                    {p.name}
                    {p.required && <span className="text-rose-400 ml-0.5">*</span>}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase">{p.type}</span>
                </div>

                <Select
                  label="Çeşme"
                  value={binding.source}
                  onChange={(e) =>
                    updateBinding(p.name, {
                      source: e.target.value as ParamBinding['source'],
                      globalKey:
                        e.target.value === 'global' ? binding.globalKey || p.name : undefined,
                    })
                  }
                  options={[
                    { value: 'global', label: 'Global filter' },
                    { value: 'fixed', label: 'Sabit baha' },
                    { value: 'widget', label: 'Widget-içi' },
                  ]}
                />

                {binding.source === 'global' ? (
                  <Select
                    label="Global key"
                    value={binding.globalKey || p.name}
                    onChange={(e) => updateBinding(p.name, { globalKey: e.target.value })}
                    options={
                      globalKeys.length
                        ? globalKeys
                        : [
                            { value: p.name, label: p.name },
                            { value: 'beginDate', label: 'beginDate' },
                            { value: 'endDate', label: 'endDate' },
                          ]
                    }
                  />
                ) : (
                  <Input
                    label="Baha"
                    type={
                      p.type === 'int' ||
                      p.type === 'bigint' ||
                      p.type === 'float' ||
                      p.type === 'number'
                        ? 'number'
                        : p.type === 'date'
                          ? 'date'
                          : p.type === 'datetime'
                            ? 'datetime-local'
                            : 'text'
                    }
                    value={String(binding.value ?? '')}
                    onChange={(e) => {
                      const raw = e.target.value;
                      let val: string | number | boolean = raw;
                      if (
                        p.type === 'int' ||
                        p.type === 'bigint' ||
                        p.type === 'float' ||
                        p.type === 'number'
                      ) {
                        val = raw === '' ? '' : Number(raw);
                      }
                      updateBinding(p.name, { value: val });
                    }}
                    placeholder={p.default != null ? String(p.default) : p.name}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Task 12: when schema missing OR columns failed — required param inputs */}
      {(schemaParams.length === 0 || sampleColumns.length === 0) && ds?.path && (
        <div className="space-y-2 rounded-xl border border-amber-700/40 bg-amber-500/5 p-3">
          <p className="text-[11px] text-amber-200/90">
            Sütünler gelmedik bolsa, required parametrleri dolduryp «Täzele» basyň.
            Ýazylan parametrler indiki widget-lerde ýatda saklanýar.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="beginDate *"
              type="date"
              value={String(ds?.params?.beginDate ?? '')}
              onChange={(e) => {
                const params = { ...ds?.params, beginDate: e.target.value };
                patchDs({ params });
                if (ds?.tenantSlug && ds?.path) {
                  try {
                    const key = `bi-api-params:${ds.tenantSlug}:${ds.path}`;
                    const prev = JSON.parse(localStorage.getItem(key) || '{}');
                    localStorage.setItem(key, JSON.stringify({ ...prev, ...params }));
                  } catch { /* */ }
                }
              }}
            />
            <Input
              label="endDate *"
              type="date"
              value={String(ds?.params?.endDate ?? '')}
              onChange={(e) => {
                const params = { ...ds?.params, endDate: e.target.value };
                patchDs({ params });
                if (ds?.tenantSlug && ds?.path) {
                  try {
                    const key = `bi-api-params:${ds.tenantSlug}:${ds.path}`;
                    const prev = JSON.parse(localStorage.getItem(key) || '{}');
                    localStorage.setItem(key, JSON.stringify({ ...prev, ...params }));
                  } catch { /* */ }
                }
              }}
            />
          </div>
          <button
            type="button"
            className="text-[11px] text-indigo-300 hover:text-indigo-200"
            disabled={columnsLoading}
            onClick={() => setColumnsTick((n) => n + 1)}
          >
            Parametr bilen täzele
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">
          {columnsLoading
            ? 'Sütünler ýüklenýär…'
            : sampleColumns.length
              ? `${sampleColumns.length} sütün`
              : 'Sütün ýok'}
        </p>
        <button
          type="button"
          className="text-[11px] text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
          disabled={!ds?.path || columnsLoading}
          onClick={() => setColumnsTick((n) => n + 1)}
        >
          Täzele
        </button>
      </div>
      {columnsError && (
        <p className="text-[11px] text-amber-400/90">{columnsError}</p>
      )}

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-slate-400">Category field</label>
        <select
          className="w-full h-9 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
          value={ds?.categoryField || ''}
          onChange={(e) => patchDs({ categoryField: e.target.value || undefined })}
        >
          <option value="">— saýla —</option>
          {sampleColumns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {sampleColumns.length === 0 && (
          <Input
            label=""
            value={ds?.categoryField || ''}
            onChange={(e) => patchDs({ categoryField: e.target.value })}
            placeholder="name / month (el bilen)"
          />
        )}
      </div>

      {/* Multi-select Value fields */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-slate-400">
          Value field (birnäçe saýlap bolýar)
        </label>
        {sampleColumns.length > 0 ? (
          <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-2 space-y-1">
            {sampleColumns.map((c) => {
              const selected = (ds?.valueFields?.length
                ? ds.valueFields
                : ds?.valueField
                  ? [ds.valueField]
                  : []
              ).includes(c);
              return (
                <label
                  key={`vf-${c}`}
                  className="flex items-center gap-2 text-sm text-slate-200 py-0.5 cursor-pointer hover:bg-slate-900/80 rounded px-1"
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-600 accent-indigo-500"
                    checked={selected}
                    onChange={() => {
                      const prev = ds?.valueFields?.length
                        ? [...ds.valueFields]
                        : ds?.valueField
                          ? [ds.valueField]
                          : [];
                      const next = selected ? prev.filter((x) => x !== c) : [...prev, c];
                      patchDs({
                        valueFields: next.length ? next : undefined,
                        valueField: next[0] || undefined,
                      });
                    }}
                  />
                  <span className="truncate">{c}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <Input
            label=""
            value={(ds?.valueFields || (ds?.valueField ? [ds.valueField] : [])).join(', ')}
            onChange={(e) => {
              const next = e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
              patchDs({
                valueFields: next.length ? next : undefined,
                valueField: next[0] || undefined,
              });
            }}
            placeholder="total, amount (el bilen, comma)"
          />
        )}
      </div>

      {/* Multi-select Series fields */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-slate-400">
          Series field (optional, birnäçe)
        </label>
        {sampleColumns.length > 0 ? (
          <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-2 space-y-1">
            {sampleColumns.map((c) => {
              const selected = (ds?.seriesFields?.length
                ? ds.seriesFields
                : ds?.seriesField
                  ? [ds.seriesField]
                  : []
              ).includes(c);
              return (
                <label
                  key={`sf-${c}`}
                  className="flex items-center gap-2 text-sm text-slate-200 py-0.5 cursor-pointer hover:bg-slate-900/80 rounded px-1"
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-600 accent-indigo-500"
                    checked={selected}
                    onChange={() => {
                      const prev = ds?.seriesFields?.length
                        ? [...ds.seriesFields]
                        : ds?.seriesField
                          ? [ds.seriesField]
                          : [];
                      const next = selected ? prev.filter((x) => x !== c) : [...prev, c];
                      patchDs({
                        seriesFields: next.length ? next : undefined,
                        seriesField: next[0] || undefined,
                      });
                    }}
                  />
                  <span className="truncate">{c}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <Input
            label=""
            value={(ds?.seriesFields || (ds?.seriesField ? [ds.seriesField] : [])).join(', ')}
            onChange={(e) => {
              const next = e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
              patchDs({
                seriesFields: next.length ? next : undefined,
                seriesField: next[0] || undefined,
              });
            }}
            placeholder="region, type (el bilen)"
          />
        )}
      </div>

      <Input
        label="Auto-refresh (sekunt, 0=öçür)"
        type="number"
        value={String(ds?.refreshSec ?? 0)}
        onChange={(e) => patchDs({ refreshSec: Number(e.target.value) || 0 })}
      />

      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Esasy reňk"
          type="color"
          value={widget.config?.color || '#6366f1'}
          onChange={(e) =>
            onChange({
              ...widget,
              config: { ...widget.config, color: e.target.value },
            })
          }
        />
        <Input
          label="Birlik (unit)"
          value={widget.config?.unit || ''}
          onChange={(e) =>
            onChange({
              ...widget,
              config: { ...widget.config, unit: e.target.value },
            })
          }
          placeholder="TMT, %, sany"
        />
      </div>

      {(widget.type === 'bar' ||
        widget.type === 'line' ||
        widget.type === 'area' ||
        widget.type === 'pie' ||
        widget.type === 'kpi') && (
        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <p className="text-xs font-semibold text-slate-300">Diagramma / KPI sazlamalary</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-slate-400">Goşmaça reňkler</label>
              <button
                type="button"
                className="text-[11px] text-indigo-400 hover:text-indigo-300"
                onClick={() => {
                  const prev = widget.config?.colors || [];
                  if (prev.length >= 12) return;
                  onChange({
                    ...widget,
                    config: {
                      ...widget.config,
                      colors: [...prev, '#22d3ee'],
                    },
                  });
                }}
              >
                + Goş
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(widget.config?.colors || []).map((c, i) => (
                <div key={`c-${i}`} className="flex items-center gap-1">
                  <input
                    type="color"
                    value={c || '#6366f1'}
                    onChange={(e) => {
                      const next = [...(widget.config?.colors || [])];
                      next[i] = e.target.value;
                      onChange({
                        ...widget,
                        config: { ...widget.config, colors: next },
                      });
                    }}
                    className="h-9 w-12 cursor-pointer rounded-lg border border-slate-700 bg-slate-950 p-0.5"
                  />
                  <button
                    type="button"
                    className="text-[10px] text-rose-400 hover:text-rose-300 px-1"
                    title="Poz"
                    onClick={() => {
                      const next = (widget.config?.colors || []).filter((_, j) => j !== i);
                      onChange({
                        ...widget,
                        config: {
                          ...widget.config,
                          colors: next.length ? next : undefined,
                        },
                      });
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {(widget.config?.colors || []).length === 0 && (
                <p className="text-[11px] text-slate-500">Esasy reňk ulanylýar — goşmaça üçin «+ Goş»</p>
              )}
            </div>
          </div>
          {(widget.type === 'bar' ||
            widget.type === 'line' ||
            widget.type === 'area' ||
            widget.type === 'pie') && (
            <>
              {(widget.type === 'bar' || widget.type === 'line' || widget.type === 'area') && (
                <Input
                  label="Goşmaça value sütünler (csv) — köp series"
                  value={(ds?.columns || []).join(', ')}
                  onChange={(e) => {
                    const cols = e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    patchDs({ columns: cols.length ? cols : undefined });
                  }}
                  placeholder="sales, profit, qty"
                />
              )}
              <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                {(widget.type === 'bar' || widget.type === 'line' || widget.type === 'area') && (
                  <>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!widget.config?.stacked}
                        onChange={(e) =>
                          onChange({
                            ...widget,
                            config: { ...widget.config, stacked: e.target.checked },
                          })
                        }
                      />
                      Stacked
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={widget.config?.smooth !== false}
                        onChange={(e) =>
                          onChange({
                            ...widget,
                            config: { ...widget.config, smooth: e.target.checked },
                          })
                        }
                      />
                      Smooth
                    </label>
                  </>
                )}
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!widget.config?.showDataLabels}
                    onChange={(e) =>
                      onChange({
                        ...widget,
                        config: { ...widget.config, showDataLabels: e.target.checked },
                      })
                    }
                  />
                  Data labels
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={widget.config?.showLegend !== false}
                    onChange={(e) =>
                      onChange({
                        ...widget,
                        config: { ...widget.config, showLegend: e.target.checked },
                      })
                    }
                  />
                  Legend
                </label>
                {widget.type === 'pie' && (
                  <>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={widget.config?.showPercent !== false}
                        onChange={(e) =>
                          onChange({
                            ...widget,
                            config: { ...widget.config, showPercent: e.target.checked },
                          })
                        }
                      />
                      Prosent (%)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!widget.config?.showValueInLabel}
                        onChange={(e) =>
                          onChange({
                            ...widget,
                            config: { ...widget.config, showValueInLabel: e.target.checked },
                          })
                        }
                      />
                      Value label
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={widget.config?.labelInside !== false}
                        onChange={(e) =>
                          onChange({
                            ...widget,
                            config: { ...widget.config, labelInside: e.target.checked },
                          })
                        }
                      />
                      Label içerde
                    </label>
                  </>
                )}
                {widget.type === 'bar' && (
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!widget.config?.horizontal}
                      onChange={(e) =>
                        onChange({
                          ...widget,
                          config: { ...widget.config, horizontal: e.target.checked },
                        })
                      }
                    />
                    Horizontal
                  </label>
                )}
              </div>
              {widget.type === 'pie' && (
                <div className="pt-1 space-y-2">
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    Merkez (donut) jem
                  </label>
                  <select
                    className="w-full h-9 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                    value={widget.config?.pieCenterAgg || 'sum'}
                    onChange={(e) =>
                      onChange({
                        ...widget,
                        config: {
                          ...widget.config,
                          pieCenterAgg: e.target.value as 'sum' | 'count' | 'avg' | 'none',
                        },
                      })
                    }
                  >
                    <option value="sum">Sum (jemi)</option>
                    <option value="count">Count (sany)</option>
                    <option value="avg">Avg (orta)</option>
                    <option value="none">Ýok</option>
                  </select>
                  {/* Task 13: which column to sum/count/avg in center */}
                  <label className="text-[11px] font-medium text-slate-400 block">
                    Merkez sütün (column)
                  </label>
                  <select
                    className="w-full h-9 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                    value={
                      widget.config?.pieCenterField ||
                      ds?.valueField ||
                      (ds?.valueFields && ds.valueFields[0]) ||
                      ''
                    }
                    onChange={(e) =>
                      onChange({
                        ...widget,
                        config: {
                          ...widget.config,
                          pieCenterField: e.target.value || undefined,
                        },
                      })
                    }
                  >
                    <option value="">— value field —</option>
                    {Array.from(
                      new Set(
                        sampleColumns.length
                          ? sampleColumns
                          : ([
                              ...(ds?.valueFields || []),
                              ds?.valueField,
                              ds?.categoryField,
                            ].filter(Boolean) as string[])
                      )
                    ).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
          {/* Task 15: chart label color / size / auto-scale for all chart widgets */}
          {['bar', 'line', 'area', 'pie'].includes(widget.type) && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <p className="text-xs font-semibold text-slate-300">Tekst / label sazlamalary</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Label reňki</label>
                  <input
                    type="color"
                    value={widget.config?.labelColor || '#94a3b8'}
                    onChange={(e) =>
                      onChange({
                        ...widget,
                        config: { ...widget.config, labelColor: e.target.value },
                      })
                    }
                    className="w-full h-9 rounded-lg cursor-pointer bg-slate-950 border border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Oks label reňki</label>
                  <input
                    type="color"
                    value={widget.config?.axisLabelColor || '#94a3b8'}
                    onChange={(e) =>
                      onChange({
                        ...widget,
                        config: { ...widget.config, axisLabelColor: e.target.value },
                      })
                    }
                    className="w-full h-9 rounded-lg cursor-pointer bg-slate-950 border border-slate-700"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Font size ({widget.config?.labelFontSize || 11}px)
                </label>
                <input
                  type="range"
                  min={8}
                  max={22}
                  value={widget.config?.labelFontSize || 11}
                  onChange={(e) =>
                    onChange({
                      ...widget,
                      config: {
                        ...widget.config,
                        labelFontSize: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!widget.config?.enableAutoTextSize}
                  onChange={(e) =>
                    onChange({
                      ...widget,
                      config: {
                        ...widget.config,
                        enableAutoTextSize: e.target.checked,
                      },
                    })
                  }
                  className="rounded"
                />
                <span className="text-xs text-slate-300">
                  Auto text: widget / zoom boyuna görä font ulalsyn/kiçelsin
                </span>
              </label>
            </div>
          )}

          {widget.type === 'kpi' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <Input
                  label="Decimals"
                  type="number"
                  value={String(widget.config?.decimals ?? '')}
                  onChange={(e) =>
                    onChange({
                      ...widget,
                      config: {
                        ...widget.config,
                        decimals: e.target.value === '' ? undefined : Number(e.target.value),
                      },
                    })
                  }
                />
                <Input
                  label="Prefix"
                  value={widget.config?.prefix || ''}
                  onChange={(e) =>
                    onChange({
                      ...widget,
                      config: { ...widget.config, prefix: e.target.value || undefined },
                    })
                  }
                  placeholder="$"
                />
                <Input
                  label="Suffix"
                  value={widget.config?.suffix || ''}
                  onChange={(e) =>
                    onChange({
                      ...widget,
                      config: { ...widget.config, suffix: e.target.value || undefined },
                    })
                  }
                  placeholder="%"
                />
              </div>

              {/* Task 5: Text Alignment Options */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-300">
                  Text Alignment
                </label>
                <div className="flex gap-2">
                  {(['center', 'left', 'right'] as const).map((align) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...widget,
                          config: { ...widget.config, textAlign: align },
                        })
                      }
                      className={`px-3 py-1 rounded text-xs font-medium transition ${
                        (widget.config?.textAlign || 'center') === align
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {align === 'center'
                        ? '⊙ Merkez'
                        : align === 'left'
                        ? '⊣ Çep'
                        : '⊢ Sag'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Task 5: Text Color */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-300">
                  Teksti Tüsy
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={widget.config?.color || '#ffffff'}
                    onChange={(e) =>
                      onChange({
                        ...widget,
                        config: { ...widget.config, color: e.target.value },
                      })
                    }
                    className="w-12 h-8 rounded cursor-pointer"
                  />
                  <Input
                    label="Hex"
                    value={widget.config?.color || '#ffffff'}
                    onChange={(e) =>
                      onChange({
                        ...widget,
                        config: { ...widget.config, color: e.target.value },
                      })
                    }
                    placeholder="#ffffff"
                  />
                </div>
              </div>

              {/* Task 5: Auto Text Size */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-300">
                  Responsive Font
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={widget.config?.enableAutoTextSize !== false}
                    onChange={(e) =>
                      onChange({
                        ...widget,
                        config: {
                          ...widget.config,
                          enableAutoTextSize: e.target.checked,
                        },
                      })
                    }
                    className="rounded"
                  />
                  <span className="text-xs text-slate-300">
                    Enable: widget size'yna göre font scaling
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {widget.type === 'pivot' && (
        <div className="space-y-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
          <p className="text-xs font-semibold text-cyan-300">Svodny tablo (Pivot)</p>
          <p className="text-[11px] text-slate-500">
            Excel / DataLens ýaly: setir we sütün ölçegleri + bahany jemle (Sum/Count/…).
          </p>
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Setir (Rows)</label>
            {sampleColumns.length > 0 ? (
              <div className="max-h-28 overflow-y-auto space-y-1 rounded-lg border border-slate-800 p-2">
                {sampleColumns.map((c) => {
                  const selected = (widget.config?.pivotRows || []).includes(c);
                  return (
                    <label key={c} className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          const prev = widget.config?.pivotRows || [];
                          const next = e.target.checked
                            ? [...prev, c]
                            : prev.filter((x) => x !== c);
                          onChange({
                            ...widget,
                            config: { ...widget.config, pivotRows: next },
                          });
                        }}
                      />
                      <span className="font-mono">{c}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <Input
                value={(widget.config?.pivotRows || []).join(', ')}
                onChange={(e) => {
                  const next = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                  onChange({
                    ...widget,
                    config: { ...widget.config, pivotRows: next },
                  });
                }}
                placeholder="region, category"
              />
            )}
          </div>
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Sütün (Columns)</label>
            {sampleColumns.length > 0 ? (
              <div className="max-h-28 overflow-y-auto space-y-1 rounded-lg border border-slate-800 p-2">
                {sampleColumns.map((c) => {
                  const selected = (widget.config?.pivotCols || []).includes(c);
                  return (
                    <label key={c} className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          const prev = widget.config?.pivotCols || [];
                          const next = e.target.checked
                            ? [...prev, c]
                            : prev.filter((x) => x !== c);
                          onChange({
                            ...widget,
                            config: { ...widget.config, pivotCols: next },
                          });
                        }}
                      />
                      <span className="font-mono">{c}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <Input
                value={(widget.config?.pivotCols || []).join(', ')}
                onChange={(e) => {
                  const next = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                  onChange({
                    ...widget,
                    config: { ...widget.config, pivotCols: next },
                  });
                }}
                placeholder="year, month"
              />
            )}
          </div>
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Baha (Value)</label>
            <select
              className="w-full h-9 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              value={widget.config?.pivotValue || ''}
              onChange={(e) =>
                onChange({
                  ...widget,
                  config: { ...widget.config, pivotValue: e.target.value || undefined },
                })
              }
            >
              <option value="">— saýla —</option>
              {(sampleColumns.length ? sampleColumns : []).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Aggregasiýa</label>
            <select
              className="w-full h-9 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              value={widget.config?.pivotAgg || 'sum'}
              onChange={(e) =>
                onChange({
                  ...widget,
                  config: {
                    ...widget.config,
                    pivotAgg: e.target.value as 'sum' | 'count' | 'avg' | 'min' | 'max',
                  },
                })
              }
            >
              <option value="sum">Sum</option>
              <option value="count">Count</option>
              <option value="avg">Avg</option>
              <option value="min">Min</option>
              <option value="max">Max</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-300">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={widget.config?.pivotRowTotals !== false}
                onChange={(e) =>
                  onChange({
                    ...widget,
                    config: { ...widget.config, pivotRowTotals: e.target.checked },
                  })
                }
              />
              Setir jemi
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={widget.config?.pivotColTotals !== false}
                onChange={(e) =>
                  onChange({
                    ...widget,
                    config: { ...widget.config, pivotColTotals: e.target.checked },
                  })
                }
              />
              Sütün jemi
            </label>
          </div>
        </div>
      )}

      {widget.type === 'table' && (
        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <p className="text-xs font-semibold text-slate-300">Tablo sazlamalary</p>

          <Input
            label="Sütünler (csv)"
            value={(ds?.columns || []).join(', ')}
            onChange={(e) => {
              const cols = e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
              patchDs({ columns: cols.length ? cols : undefined });
            }}
            placeholder="id, name, total"
          />

          {sampleColumns.length > 0 && (
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-slate-400">
                Görünýän columnlar (filter-only id-leri öçüriň)
              </label>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-2 space-y-1">
                {sampleColumns.map((col) => {
                  const hidden = (ds?.hiddenColumns || []).includes(col);
                  return (
                    <label
                      key={col}
                      className="flex items-center gap-2 text-xs text-slate-300 px-1 py-0.5 hover:bg-slate-800/50 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={!hidden}
                        onChange={(e) => {
                          const cur = new Set(ds?.hiddenColumns || []);
                          if (e.target.checked) cur.delete(col);
                          else cur.add(col);
                          patchDs({ hiddenColumns: [...cur] });
                        }}
                      />
                      <span className={hidden ? 'text-slate-600 line-through' : 'font-mono'}>{col}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <Input
            label="Order by (field:asc, field2:desc)"
            value={(ds?.orderBy || []).map((o) => `${o.field}:${o.dir}`).join(', ')}
            onChange={(e) => {
              const parts = e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
              const orderBy = parts
                .map((p) => {
                  const [field, dirRaw] = p.split(':').map((x) => x.trim());
                  if (!field) return null;
                  const dir = dirRaw === 'desc' ? 'desc' : 'asc';
                  return { field, dir: dir as 'asc' | 'desc' };
                })
                .filter(Boolean) as { field: string; dir: 'asc' | 'desc' }[];
              patchDs({ orderBy: orderBy.length ? orderBy : undefined });
            }}
            placeholder="total:desc, name:asc"
          />

          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={ds?.enableSearch !== false}
              onChange={(e) => patchDs({ enableSearch: e.target.checked })}
              className="rounded border-slate-600"
            />
            Gözleg gutusyny görkez
          </label>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-slate-400">Aşaky jemi (Sum / Count / Max)</p>
              <button
                type="button"
                className="text-[11px] text-indigo-400 hover:text-indigo-300"
                onClick={() => {
                  const cols = sampleColumns.length ? sampleColumns : (ds?.columns || []);
                  const col = cols[0] || '';
                  patchDs({
                    tableAggregates: [
                      ...(ds?.tableAggregates || []),
                      { column: col, fn: 'sum', label: col || 'Jemi', suffix: '' },
                    ],
                  });
                }}
              >
                + Aggregate
              </button>
            </div>
            {(ds?.tableAggregates || []).map((a, i) => (
              <div key={i} className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-800 p-2">
                <select
                  className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[11px] text-white col-span-2"
                  value={a.column}
                  onChange={(e) => {
                    const next = [...(ds?.tableAggregates || [])];
                    next[i] = { ...next[i], column: e.target.value };
                    patchDs({ tableAggregates: next });
                  }}
                >
                  <option value="">— column saýla —</option>
                  {(sampleColumns.length ? sampleColumns : [a.column].filter(Boolean)).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[11px] text-white col-span-2 font-mono"
                  placeholder="Ýa-da column adyny ýazyň (Jemi bahasy)"
                  value={a.column}
                  onChange={(e) => {
                    const next = [...(ds?.tableAggregates || [])];
                    next[i] = { ...next[i], column: e.target.value };
                    patchDs({ tableAggregates: next });
                  }}
                />
                <select
                  className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[11px] text-white"
                  value={a.fn}
                  onChange={(e) => {
                    const next = [...(ds?.tableAggregates || [])];
                    next[i] = { ...next[i], fn: e.target.value as 'sum' | 'count' | 'max' | 'min' };
                    patchDs({ tableAggregates: next });
                  }}
                >
                  <option value="sum">Sum</option>
                  <option value="count">Count</option>
                  <option value="max">Max</option>
                  <option value="min">Min</option>
                </select>
                <input
                  className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[11px] text-white"
                  placeholder="Suffix (TMT)"
                  value={a.suffix || ''}
                  onChange={(e) => {
                    const next = [...(ds?.tableAggregates || [])];
                    next[i] = { ...next[i], suffix: e.target.value };
                    patchDs({ tableAggregates: next });
                  }}
                />
                <input
                  className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[11px] text-white col-span-2"
                  placeholder="Label (Jemi bahasy)"
                  value={a.label || ''}
                  onChange={(e) => {
                    const next = [...(ds?.tableAggregates || [])];
                    next[i] = { ...next[i], label: e.target.value };
                    patchDs({ tableAggregates: next });
                  }}
                />
                <div className="col-span-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="text-[10px] text-slate-400"
                    disabled={i === 0}
                    onClick={() => {
                      const next = [...(ds?.tableAggregates || [])];
                      if (i <= 0) return;
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      patchDs({ tableAggregates: next });
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="text-[10px] text-slate-400"
                    disabled={i >= (ds?.tableAggregates || []).length - 1}
                    onClick={() => {
                      const next = [...(ds?.tableAggregates || [])];
                      if (i >= next.length - 1) return;
                      [next[i], next[i + 1]] = [next[i + 1], next[i]];
                      patchDs({ tableAggregates: next });
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="text-[10px] text-rose-400"
                    onClick={() => {
                      const next = (ds?.tableAggregates || []).filter((_, j) => j !== i);
                      patchDs({ tableAggregates: next.length ? next : undefined });
                    }}
                  >
                    Poz
                  </button>
                </div>
              </div>
            ))}
            <p className="text-[10px] text-slate-500">
              Mysal: <span className="text-slate-400">Jemi bahasy : 14225.33 TMT</span>
            </p>
          </div>
        </div>
      )}

      {(widget.type === 'table' || widget.type === 'pie') && (
        <div className="space-y-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
          <p className="text-xs font-semibold text-indigo-300">Hierarhiýa / Drill-down</p>
          <p className="text-[11px] text-slate-500">
            {widget.type === 'pie'
              ? 'Tegelek bölegine basylanda child API-a parametr iberilýär we täze tegelek açylýar (Telefonlar → Samsung → A12…). Path we Undo bilen yza gaýdyp bolýar.'
              : 'Setire basylanda saýlanan sütündäki bahany başga API-a iberip detal tablisasyny açýar (meselem faktura → harytlar).'}
          </p>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={!!ds?.drillDown?.enabled}
              onChange={(e) =>
                patchDs({
                  drillDown: {
                    enabled: e.target.checked,
                    sourceField: ds?.drillDown?.sourceField || ds?.categoryField || '',
                    tenantSlug: ds?.drillDown?.tenantSlug || ds?.tenantSlug || '',
                    path: ds?.drillDown?.path || '',
                    method: ds?.drillDown?.method || 'GET',
                    passGlobalFilters: ds?.drillDown?.passGlobalFilters !== false,
                    childChartType: widget.type === 'pie' ? 'pie' : 'table',
                    categoryField: ds?.drillDown?.categoryField || ds?.categoryField || '',
                    valueField:
                      ds?.drillDown?.valueField ||
                      ds?.valueField ||
                      (ds?.valueFields && ds.valueFields[0]) ||
                      '',
                    rootLabel: ds?.drillDown?.rootLabel || widget.title || 'Root',
                  },
                })
              }
              className="rounded border-slate-600"
            />
            Hierarhiýa / Drill-down açyk
          </label>
          {ds?.drillDown?.enabled && (
            <>
              <Input
                label="Çeşme sütün (mes: fich_id)"
                value={ds.drillDown.sourceField || ''}
                onChange={(e) =>
                  patchDs({
                    drillDown: { ...ds.drillDown!, sourceField: e.target.value },
                  })
                }
                placeholder="fich_id"
              />
              <Input
                label="Child API param ady (boş bolsa çeşme bilen birmeňzeş)"
                value={ds.drillDown.targetParam || ''}
                onChange={(e) =>
                  patchDs({
                    drillDown: { ...ds.drillDown!, targetParam: e.target.value || undefined },
                  })
                }
                placeholder="fich_id"
              />
              {widget.type === 'pie' && (
                <>
                  <Input
                    label="Root path ady (breadcrumb: /Harytlar/...)"
                    value={ds.drillDown.rootLabel || ''}
                    onChange={(e) =>
                      patchDs({
                        drillDown: {
                          ...ds.drillDown!,
                          rootLabel: e.target.value || undefined,
                        },
                      })
                    }
                    placeholder="Harytlar"
                  />
                  <Input
                    label="Child category field"
                    value={ds.drillDown.categoryField || ''}
                    onChange={(e) =>
                      patchDs({
                        drillDown: {
                          ...ds.drillDown!,
                          categoryField: e.target.value || undefined,
                        },
                      })
                    }
                    placeholder="name"
                  />
                  <Input
                    label="Child value field"
                    value={ds.drillDown.valueField || ''}
                    onChange={(e) =>
                      patchDs({
                        drillDown: {
                          ...ds.drillDown!,
                          valueField: e.target.value || undefined,
                        },
                      })
                    }
                    placeholder="value"
                  />
                  <p className="text-[10px] text-slate-500">
                    2-nji / 3-nji dereje: aşakda levels goşuň (birmeňzeş API bolsa boş goýup
                    bolýar — şol path gaýtalanýar, parametrler ýygnalýar).
                  </p>
                  {(ds.drillDown.levels || []).map((lv, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-slate-700/80 bg-slate-900/50 p-2 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-indigo-300 font-medium">
                          Dereje {i + 2}
                        </span>
                        <button
                          type="button"
                          className="text-[10px] text-rose-400"
                          onClick={() => {
                            const next = [...(ds.drillDown?.levels || [])];
                            next.splice(i, 1);
                            patchDs({
                              drillDown: {
                                ...ds.drillDown!,
                                levels: next.length ? next : undefined,
                              },
                            });
                          }}
                        >
                          Poz
                        </button>
                      </div>
                      <Input
                        label="sourceField"
                        value={lv.sourceField || ''}
                        onChange={(e) => {
                          const next = [...(ds.drillDown?.levels || [])];
                          next[i] = { ...next[i], sourceField: e.target.value };
                          patchDs({ drillDown: { ...ds.drillDown!, levels: next } });
                        }}
                        placeholder="brand_id"
                      />
                      <Input
                        label="targetParam"
                        value={lv.targetParam || ''}
                        onChange={(e) => {
                          const next = [...(ds.drillDown?.levels || [])];
                          next[i] = {
                            ...next[i],
                            targetParam: e.target.value || undefined,
                          };
                          patchDs({ drillDown: { ...ds.drillDown!, levels: next } });
                        }}
                        placeholder="brand_id"
                      />
                      <Input
                        label="path (boş = birinji child path)"
                        value={lv.path || ''}
                        onChange={(e) => {
                          const next = [...(ds.drillDown?.levels || [])];
                          next[i] = { ...next[i], path: e.target.value || undefined };
                          patchDs({ drillDown: { ...ds.drillDown!, levels: next } });
                        }}
                        placeholder="/api/products-by-brand"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-[11px] text-indigo-400 hover:text-indigo-300"
                    onClick={() => {
                      const next = [
                        ...(ds.drillDown?.levels || []),
                        {
                          sourceField: ds.drillDown?.sourceField || 'id',
                          targetParam: ds.drillDown?.targetParam,
                        },
                      ];
                      patchDs({ drillDown: { ...ds.drillDown!, levels: next } });
                    }}
                  >
                    + Indiki dereje goş
                  </button>
                </>
              )}
              <Select
                label="Child endpoint"
                value={
                  endpoints.find(
                    (e) =>
                      e.tenantSlug === ds.drillDown?.tenantSlug &&
                      e.pathTemplate === ds.drillDown?.path
                  )?.id || ''
                }
                onChange={(e) => {
                  const ep = endpoints.find((x) => x.id === e.target.value);
                  if (!ep) return;
                  patchDs({
                    drillDown: {
                      ...ds.drillDown!,
                      tenantSlug: ep.tenantSlug,
                      path: ep.pathTemplate,
                      method: (ep.method as 'GET' | 'POST') || 'GET',
                      endpointId: ep.id,
                      dbKey: ep.dbKey || 'primary',
                    },
                  });
                }}
                options={[
                  { value: '', label: '— Saýla —' },
                  ...endpoints.map((ep) => ({
                    value: ep.id,
                    label: `${ep.name} (${ep.tenantSlug}${ep.pathTemplate})`,
                  })),
                ]}
              />
              <Input
                label="Child path (el bilen)"
                value={ds.drillDown.path || ''}
                onChange={(e) =>
                  patchDs({
                    drillDown: { ...ds.drillDown!, path: e.target.value },
                  })
                }
                placeholder="/invoice-items"
              />
              <Input
                label="Tenant slug"
                value={ds.drillDown.tenantSlug || ''}
                onChange={(e) =>
                  patchDs({
                    drillDown: { ...ds.drillDown!, tenantSlug: e.target.value },
                  })
                }
              />
              <Input
                label="Modal title şablony"
                value={ds.drillDown.titleTemplate || ''}
                onChange={(e) =>
                  patchDs({
                    drillDown: {
                      ...ds.drillDown!,
                      titleTemplate: e.target.value || undefined,
                    },
                  })
                }
                list="drill-title-columns"
                placeholder="Faktura #{value} — {customer_name}"
              />
              {/* Any {columnName} typed here (from the list below or hand-typed —
                  even a column not shown yet) is replaced live with that column's
                  value from the clicked row. {field}/{value} = source column/value. */}
              <datalist id="drill-title-columns">
                <option value="{field}" />
                <option value="{value}" />
                {(sampleColumns.length ? sampleColumns : ds.columns || []).map((col) => (
                  <option key={col} value={`{${col}}`} />
                ))}
              </datalist>
              {(sampleColumns.length > 0 || (ds.columns || []).length > 0) && (
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500">
                    Title-e column goş (basylan setirden) — ýa-da islendik {'{column}'} adyny ýazyň, öz maglumaty gelýär:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(sampleColumns.length ? sampleColumns : ds.columns || []).map((col) => (
                      <button
                        key={col}
                        type="button"
                        className="px-1.5 py-0.5 rounded-md border border-slate-700 text-[10px] font-mono text-slate-300 hover:border-indigo-500/50"
                        onClick={() => {
                          const cur = ds.drillDown?.titleTemplate || '';
                          const token = `{${col}}`;
                          patchDs({
                            drillDown: {
                              ...ds.drillDown!,
                              titleTemplate: cur.includes(token)
                                ? cur
                                : (cur ? `${cur} ${token}` : token).trim(),
                            },
                          });
                        }}
                      >
                        {`{${col}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-slate-400">Drill-down jemi (Sum/Count)</p>
                  <button
                    type="button"
                    className="text-[11px] text-indigo-400"
                    onClick={() => {
                      const cols = sampleColumns.length ? sampleColumns : [];
                      patchDs({
                        drillDown: {
                          ...ds.drillDown!,
                          aggregates: [
                            ...(ds.drillDown?.aggregates || []),
                            { column: cols[0] || '', fn: 'sum', label: cols[0] || 'Jemi', suffix: '' },
                          ],
                        },
                      });
                    }}
                  >
                    + Aggregate
                  </button>
                </div>
                {(ds.drillDown?.aggregates || []).map((a, i) => (
                  <div key={i} className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-800 p-2">
                    <select
                      className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[11px] text-white col-span-2"
                      value={a.column}
                      onChange={(e) => {
                        const next = [...(ds.drillDown?.aggregates || [])];
                        next[i] = { ...next[i], column: e.target.value };
                        patchDs({ drillDown: { ...ds.drillDown!, aggregates: next } });
                      }}
                    >
                      <option value="">— column saýla —</option>
                      {(drillSampleColumns.length
                        ? drillSampleColumns
                        : sampleColumns.length
                          ? sampleColumns
                          : [a.column].filter(Boolean)
                      ).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <input
                      className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[11px] text-white col-span-2 font-mono"
                      placeholder="Ýa-da column adyny ýazyň"
                      value={a.column}
                      onChange={(e) => {
                        const next = [...(ds.drillDown?.aggregates || [])];
                        next[i] = { ...next[i], column: e.target.value };
                        patchDs({ drillDown: { ...ds.drillDown!, aggregates: next } });
                      }}
                    />
                    <select
                      className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[11px] text-white"
                      value={a.fn}
                      onChange={(e) => {
                        const next = [...(ds.drillDown?.aggregates || [])];
                        next[i] = { ...next[i], fn: e.target.value as 'sum' | 'count' | 'max' | 'min' };
                        patchDs({ drillDown: { ...ds.drillDown!, aggregates: next } });
                      }}
                    >
                      <option value="sum">Sum</option>
                      <option value="count">Count</option>
                      <option value="max">Max</option>
                      <option value="min">Min</option>
                    </select>
                    <input
                      className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[11px] text-white"
                      placeholder="Suffix"
                      value={a.suffix || ''}
                      onChange={(e) => {
                        const next = [...(ds.drillDown?.aggregates || [])];
                        next[i] = { ...next[i], suffix: e.target.value };
                        patchDs({ drillDown: { ...ds.drillDown!, aggregates: next } });
                      }}
                    />
                    <input
                      className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[11px] text-white col-span-2"
                      placeholder="Label"
                      value={a.label || ''}
                      onChange={(e) => {
                        const next = [...(ds.drillDown?.aggregates || [])];
                        next[i] = { ...next[i], label: e.target.value };
                        patchDs({ drillDown: { ...ds.drillDown!, aggregates: next } });
                      }}
                    />
                    <div className="col-span-2 flex items-center gap-2">
                      <button
                        type="button"
                        className="text-[10px] text-slate-400"
                        disabled={i === 0}
                        onClick={() => {
                          const next = [...(ds.drillDown?.aggregates || [])];
                          if (i <= 0) return;
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          patchDs({ drillDown: { ...ds.drillDown!, aggregates: next } });
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="text-[10px] text-slate-400"
                        disabled={i >= (ds.drillDown?.aggregates || []).length - 1}
                        onClick={() => {
                          const next = [...(ds.drillDown?.aggregates || [])];
                          if (i >= next.length - 1) return;
                          [next[i], next[i + 1]] = [next[i + 1], next[i]];
                          patchDs({ drillDown: { ...ds.drillDown!, aggregates: next } });
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="text-[10px] text-rose-400"
                        onClick={() => {
                          const next = (ds.drillDown?.aggregates || []).filter((_, j) => j !== i);
                          patchDs({
                            drillDown: {
                              ...ds.drillDown!,
                              aggregates: next.length ? next : undefined,
                            },
                          });
                        }}
                      >
                        Poz
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {(drillSampleColumns.length > 0 || sampleColumns.length > 0) && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <p className="text-[11px] font-medium text-slate-400">
                    Drill-down görünýän columnlar
                  </p>
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-2 space-y-1">
                    {(drillSampleColumns.length ? drillSampleColumns : sampleColumns).map((col) => {
                      const hidden = (ds.drillDown?.hiddenColumns || []).includes(col);
                      return (
                        <label
                          key={col}
                          className="flex items-center gap-2 text-xs text-slate-300 px-1 py-0.5 hover:bg-slate-800/50 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={!hidden}
                            onChange={(e) => {
                              const cur = new Set(ds.drillDown?.hiddenColumns || []);
                              if (e.target.checked) cur.delete(col);
                              else cur.add(col);
                              patchDs({
                                drillDown: {
                                  ...ds.drillDown!,
                                  hiddenColumns: [...cur],
                                },
                              });
                            }}
                          />
                          <span className={hidden ? 'text-slate-600 line-through' : 'font-mono'}>{col}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={ds.drillDown.passGlobalFilters !== false}
                  onChange={(e) =>
                    patchDs({
                      drillDown: {
                        ...ds.drillDown!,
                        passGlobalFilters: e.target.checked,
                      },
                    })
                  }
                  className="rounded border-slate-600"
                />
                Global filtrleri hem iber (beginDate, endDate…)
              </label>
            </>
          )}
        </div>
      )}

      {/* Task 12: Required Parameters Form - shows when API needs additional params */}
      {showRequiredParamsForm && (
        <div className="space-y-3 rounded-xl border border-amber-600/30 bg-amber-950/20 p-4 mt-4">
          <p className="text-xs font-semibold text-amber-300 flex items-center gap-2">
            ⚠️ Gere Parametrler - Doldurmaly
          </p>
          <p className="text-xs text-slate-300">
            API maglumat bermek üçin aşakdaky parametrleri doldurmalysy:
          </p>
          
          <div className="space-y-2">
            {Object.entries(requiredParamValues).map(([key, value]) => (
              <div key={key}>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  {key}
                </label>
                <Input
                  value={value}
                  onChange={(e) => {
                    const newValues = { ...requiredParamValues, [key]: e.target.value };
                    setRequiredParamValues(newValues);
                    // Task 12: Auto-cache required param values
                    const newCache = { ...paramCache, [key]: e.target.value };
                    setParamCache(newCache);
                    try {
                      localStorage.setItem('bi-param-cache', JSON.stringify(newCache));
                    } catch {}
                  }}
                  placeholder={`${key} gir`}
                  className="h-8 text-xs"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              onClick={() => setShowRequiredParamsForm(false)}
            >
              Ýap
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                // Retry API fetch with new params
                setColumnsTick((t) => t + 1);
                setShowRequiredParamsForm(false);
              }}
            >
              ✓ Täzele
            </Button>
          </div>
        </div>
      )}

      <Button size="sm" variant="secondary" className="w-full" onClick={onClose}>
        Ýap
      </Button>
    </div>
  );
}
