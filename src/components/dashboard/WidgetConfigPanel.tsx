'use client';

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
  const ds = widget.dataSource;

  useEffect(() => {
    fetch('/api/catalog')
      .then((r) => r.json())
      .then((d) => setEndpoints(d.endpoints || []))
      .catch(() => {});
  }, []);

  // Probe API once to list available fields for Category/Value/Series dropdowns
  useEffect(() => {
    if (!ds?.tenantSlug || !ds?.path) {
      setSampleColumns([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/gateway/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantSlug: ds.tenantSlug,
            path: ds.path,
            method: ds.method || 'GET',
            dbKey: ds.dbKey || 'primary',
            params: { ...(ds.params || {}), beginDate: null, endDate: null },
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
          setSampleColumns(Object.keys(rows[0]));
        } else if (ds.columns?.length) {
          setSampleColumns([...ds.columns]);
        } else {
          setSampleColumns([]);
        }
      } catch {
        if (!cancelled) setSampleColumns(ds.columns || []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ds?.tenantSlug, ds?.path, ds?.method, ds?.dbKey, ds?.endpointId]);
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
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-3 shadow-xl max-h-[calc(100vh-8rem)] overflow-y-auto">
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

      {schemaParams.length === 0 && ds?.endpointId && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500">
            Bu API-da paramsSchema ýok. El bilen parametr goşuň (mysal: beginDate).
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="beginDate"
              type="date"
              value={String(ds?.params?.beginDate ?? '')}
              onChange={(e) =>
                patchDs({
                  params: { ...ds?.params, beginDate: e.target.value },
                })
              }
            />
            <Input
              label="endDate"
              type="date"
              value={String(ds?.params?.endDate ?? '')}
              onChange={(e) =>
                patchDs({
                  params: { ...ds?.params, endDate: e.target.value },
                })
              }
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
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
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-400">Value field</label>
          <select
            className="w-full h-9 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            value={ds?.valueField || ''}
            onChange={(e) => patchDs({ valueField: e.target.value || undefined })}
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
              value={ds?.valueField || ''}
              onChange={(e) => patchDs({ valueField: e.target.value })}
              placeholder="total / value (el bilen)"
            />
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-slate-400">Series field (optional)</label>
        <select
          className="w-full h-9 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
          value={ds?.seriesField || ''}
          onChange={(e) => patchDs({ seriesField: e.target.value || undefined })}
        >
          <option value="">— ýok —</option>
          {sampleColumns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
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
          <Input
            label="Goşmaça reňkler (csv hex)"
            value={(widget.config?.colors || []).join(', ')}
            onChange={(e) => {
              const colors = e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
              onChange({
                ...widget,
                config: { ...widget.config, colors: colors.length ? colors : undefined },
              });
            }}
            placeholder="#6366f1, #22d3ee, #a78bfa"
          />
          {(widget.type === 'bar' || widget.type === 'line' || widget.type === 'area') && (
            <>
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
              <div className="flex flex-wrap gap-3 text-xs text-slate-300">
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
            </>
          )}
          {widget.type === 'kpi' && (
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
          )}
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

      {widget.type === 'table' && (
        <div className="space-y-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
          <p className="text-xs font-semibold text-indigo-300">Hierarhiýa / Drill-down</p>
          <p className="text-[11px] text-slate-500">
            Setire basylanda saýlanan sütündäki bahany başga API-a iberip detal tablisasyny açýar
            (meselem faktura → harytlar).
          </p>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={!!ds?.drillDown?.enabled}
              onChange={(e) =>
                patchDs({
                  drillDown: {
                    enabled: e.target.checked,
                    sourceField: ds?.drillDown?.sourceField || '',
                    tenantSlug: ds?.drillDown?.tenantSlug || ds?.tenantSlug || '',
                    path: ds?.drillDown?.path || '',
                    method: ds?.drillDown?.method || 'GET',
                    passGlobalFilters: ds?.drillDown?.passGlobalFilters !== false,
                  },
                })
              }
              className="rounded border-slate-600"
            />
            Drill-down açyk
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

      <Button size="sm" variant="secondary" className="w-full" onClick={onClose}>
        Ýap
      </Button>
    </div>
  );
}
