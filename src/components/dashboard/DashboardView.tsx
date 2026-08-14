'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  Dashboard,
  DashboardWidget,
  WidgetType,
  GlobalFilterDef,
  GlobalFilterValues,
} from '@/lib/types';
import { DashboardCanvas } from './DashboardCanvas';
import { WidgetPalette } from './WidgetPalette';
import { WidgetConfigPanel } from './WidgetConfigPanel';
import { DashboardFilterBar, GlobalFiltersEditor } from './DashboardFilterBar';
import { Button } from '@/components/ui/Button';
import { generateId } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { ArrowLeft, Save, Pencil, Eye } from 'lucide-react';
import Link from 'next/link';

interface Props {
  initial: Dashboard;
  editable: boolean;
}

function localDateISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function defaultFilterValues(defs: GlobalFilterDef[]): GlobalFilterValues {
  const v: GlobalFilterValues = {};
  const today = localDateISO();

  for (const f of defs) {
    if (f.defaultValue !== undefined && f.defaultValue !== null) {
      // Strip accidental time portion from defaults
      const raw = f.defaultValue;
      v[f.key] =
        typeof raw === 'string' && /\d{4}-\d{2}-\d{2}/.test(raw)
          ? (raw.match(/(\d{4}-\d{2}-\d{2})/)?.[1] as string) || raw
          : raw;
      continue;
    }
    if (f.type === 'daterange') {
      v[f.key] = today;
      if (f.endKey) v[f.endKey] = today;
    } else if (f.type === 'date' || f.type === 'datetime') {
      v[f.key] = today;
    }
  }
  return v;
}

function getStoredFilterValues(dashboardId: string, defs: GlobalFilterDef[]): GlobalFilterValues {
  const defaults = defaultFilterValues(defs);
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(`bi_filter_${dashboardId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { ...defaults, ...parsed };
      }
    }
  } catch {
    /* ignore */
  }
  return defaults;
}

export function DashboardView({ initial, editable }: Props) {
  const router = useRouter();
  const [dashboard, setDashboard] = useState(initial);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initial.name);
  const [dirty, setDirty] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  const filterDefs = dashboard.globalFilters || [];
  const [filterValues, setFilterValues] = useState<GlobalFilterValues>(() =>
    getStoredFilterValues(initial.id, initial.globalFilters || [])
  );

  function handleFilterValuesChange(nextValues: GlobalFilterValues) {
    setFilterValues(nextValues);
    try {
      localStorage.setItem(`bi_filter_${dashboard.id}`, JSON.stringify(nextValues));
    } catch {
      /* ignore */
    }
  }

  // when filter defs change (e.g. suggested), seed missing defaults
  const effectiveFilterValues = useMemo(() => {
    const base = { ...filterValues };
    for (const f of filterDefs) {
      if (f.type === 'daterange') {
        if (base[f.key] === undefined) {
          const d = defaultFilterValues([f]);
          Object.assign(base, d);
        }
      } else if (base[f.key] === undefined && f.defaultValue !== undefined) {
        base[f.key] = f.defaultValue;
      }
    }
    return base;
  }, [filterDefs, filterValues]);

  function updateWidgets(widgets: DashboardWidget[]) {
    setDashboard((d) => ({ ...d, widgets }));
    setDirty(true);
  }

  function updateGlobalFilters(globalFilters: GlobalFilterDef[]) {
    setDashboard((d) => ({ ...d, globalFilters }));
    setDirty(true);
  }

  function addWidget(type: WidgetType) {
    const maxY = dashboard.widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0);
    const titles: Record<WidgetType, string> = {
      bar: 'Sütün diagramma',
      line: 'Çyzyk diagramma',
      area: 'Meýdança diagramma',
      pie: 'Tegelek diagramma',
      table: 'Tablo',
      kpi: 'KPI',
      text: 'Tekst',
    };
    const widget: DashboardWidget = {
      id: generateId(),
      type,
      title: titles[type],
      x: 0,
      y: maxY,
      w: type === 'kpi' ? 3 : type === 'pie' ? 4 : 6,
      h: type === 'kpi' ? 2 : 4,
      staticValue: type === 'kpi' ? '0' : type === 'text' ? 'Tekst ýazyň...' : undefined,
      config: { color: '#6366f1', showLegend: true },
    };
    updateWidgets([...dashboard.widgets, widget]);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboards/${dashboard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          widgets: dashboard.widgets,
          globalFilters: dashboard.globalFilters || [],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDashboard(data.dashboard);
        setDirty(false);
        setEditMode(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboards"
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {editMode ? (
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
              className="max-w-xs h-10"
            />
          ) : (
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">{dashboard.name}</h1>
              {dashboard.description && (
                <p className="text-sm text-slate-400 truncate">{dashboard.description}</p>
              )}
            </div>
          )}
        </div>

        {editable && (
          <div className="flex items-center gap-2 shrink-0">
            {editMode ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setEditMode(false)}>
                  <Eye className="h-4 w-4" />
                  Görüş
                </Button>
                <Button
                  size="sm"
                  onClick={save}
                  loading={saving}
                  disabled={!dirty && name === initial.name}
                >
                  <Save className="h-4 w-4" />
                  Ýatda sakla
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setEditMode(true)}>
                <Pencil className="h-4 w-4" />
                Üýtget
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Global filter bar — always visible when filters exist or in edit mode */}
      {(filterDefs.length > 0 || editMode) && (
        <DashboardFilterBar
          filters={
            filterDefs.length
              ? filterDefs
              : editMode
                ? []
                : []
          }
          values={effectiveFilterValues}
          onChange={handleFilterValuesChange}
        />
      )}

      <div className={editMode ? 'flex flex-col lg:flex-row gap-4' : ''}>
        <div className="flex-1 min-w-0">
          <DashboardCanvas
            dashboard={{ ...dashboard, name }}
            editable={editMode}
            onChange={updateWidgets}
            onConfigureWidget={(id) => setConfigId(id)}
            globalFilters={effectiveFilterValues}
          />
        </div>
        {editMode && (
          <aside className="lg:w-80 shrink-0 space-y-4 h-fit sticky top-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <WidgetPalette onAdd={addWidget} />
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <GlobalFiltersEditor
                filters={filterDefs}
                onChange={updateGlobalFilters}
              />
            </div>

            {configId && dashboard.widgets.find((w) => w.id === configId) && (
              <WidgetConfigPanel
                widget={dashboard.widgets.find((w) => w.id === configId)!}
                onChange={(w) => {
                  updateWidgets(dashboard.widgets.map((x) => (x.id === w.id ? w : x)));
                }}
                onClose={() => setConfigId(null)}
                globalFilters={filterDefs}
                onSuggestGlobalFilters={updateGlobalFilters}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
