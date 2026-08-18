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
import { ArrowLeft, Save, Pencil, Eye, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

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
        setMobilePanelOpen(false);
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
          <>
            <aside className="hidden lg:block lg:w-80 shrink-0 space-y-4 h-fit sticky top-4">
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

            <MobileEditPanel
              open={mobilePanelOpen}
              onClose={() => setMobilePanelOpen(false)}
              onAddWidget={addWidget}
              filters={filterDefs}
              onUpdateGlobalFilters={updateGlobalFilters}
              configId={configId}
              widget={dashboard.widgets.find((w) => w.id === configId) || null}
              onUpdateWidgets={updateWidgets}
              onCloseConfig={() => setConfigId(null)}
              globalFilters={filterDefs}
              onSuggestGlobalFilters={updateGlobalFilters}
            />
          </>
        )}
      </div>

      {editMode && (
        <button
          type="button"
          onClick={() => setMobilePanelOpen((v) => !v)}
          className={cn(
            'lg:hidden fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center touch-manipulation',
            'bg-indigo-600 hover:bg-indigo-500 text-white transition-all duration-200',
            mobilePanelOpen && 'rotate-45 bg-slate-700 hover:bg-slate-600'
          )}
          aria-label={mobilePanelOpen ? 'Paneli ýap' : 'Paneli aç'}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {mobilePanelOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={() => setMobilePanelOpen(false)}
        />
      )}
    </div>
  );
}

function MobileEditPanel({
  open,
  onClose,
  onAddWidget,
  filters,
  onUpdateGlobalFilters,
  configId,
  widget,
  onUpdateWidgets,
  onCloseConfig,
  globalFilters,
  onSuggestGlobalFilters,
}: {
  open: boolean;
  onClose: () => void;
  onAddWidget: (type: WidgetType) => void;
  filters: GlobalFilterDef[];
  onUpdateGlobalFilters: (filters: GlobalFilterDef[]) => void;
  configId: string | null;
  widget: DashboardWidget | null;
  onUpdateWidgets: (widgets: DashboardWidget[]) => void;
  onCloseConfig: () => void;
  globalFilters: GlobalFilterDef[];
  onSuggestGlobalFilters: (filters: GlobalFilterDef[]) => void;
}) {
  return (
    <div
      className={cn(
        'lg:hidden fixed inset-x-0 bottom-0 z-50 transform transition-transform duration-300 ease-out',
        open ? 'translate-y-0' : 'translate-y-full'
      )}
    >
      <div className="mx-4 mb-4 max-h-[75dvh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col">
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <span className="text-sm font-semibold text-white">Redaktor</span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 touch-manipulation"
            style={{ minWidth: '44px', minHeight: '44px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">Widget goş</p>
            <WidgetPalette onAdd={onAddWidget} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">Global filterler</p>
            <GlobalFiltersEditor filters={filters} onChange={onUpdateGlobalFilters} />
          </div>
          {configId && widget && (
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Widget sazlamalary</p>
              <WidgetConfigPanel
                widget={widget}
                onChange={(w) => {
                  onUpdateWidgets([w]);
                }}
                onClose={onCloseConfig}
                globalFilters={globalFilters}
                onSuggestGlobalFilters={onSuggestGlobalFilters}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
