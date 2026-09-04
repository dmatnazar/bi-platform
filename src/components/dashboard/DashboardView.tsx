'use client';

// Task 11: Mobile layout Flex/Grid width fix - ensure proper responsive container sizing
// Prevents layout shifts and gaps on mobile browsers
// Hydration fix: defer container width calculation until client-side
// Task 8: Unsaved changes warning (Save / Cancel save / Close) when leaving edit mode

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
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
import { ArrowLeft, Save, Pencil, Eye, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

interface Props {
  initial: Dashboard;
  editable: boolean;
  companyName?: string;
  companySlug?: string;
}

function localDateISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function defaultFilterValues(defs: GlobalFilterDef[]): GlobalFilterValues {
  const v: GlobalFilterValues = {};
  const today = localDateISO();
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 29);
  const monthAgoStr = localDateISO(monthAgo);

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
      v[f.key] = monthAgoStr;
      if (f.endKey) v[f.endKey] = today;
    }
  }
  return v;
}

export function DashboardView({ initial, editable, companyName, companySlug }: Props) {
  const router = useRouter();
  const [dashboard, setDashboard] = useState(initial);
  const [editMode, setEditMode] = useState(false);
  const [editOpening, setEditOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initial.name);
  const [dirty, setDirty] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [refreshAllToken, setRefreshAllToken] = useState(0);
  const [refreshingAll, setRefreshingAll] = useState(false);

  // Collapsible edit side panels
  const [panelOpen, setPanelOpen] = useState({ palette: true, filters: true, config: true });

  // Task 11: Hydration fix - track if component has mounted on client
  const [isHydrated, setIsHydrated] = useState(false);

  const filterDefs = dashboard.globalFilters || [];
  const [filterValues, setFilterValues] = useState<GlobalFilterValues>(() =>
    defaultFilterValues(initial.globalFilters || [])
  );
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  // Task 8: keep latest dirty/editMode for event handlers
  const dirtyRef = useRef(dirty);
  const editModeRef = useRef(editMode);
  const nameRef = useRef(name);
  const dashboardRef = useRef(dashboard);
  const initialRef = useRef(initial);
  useEffect(() => {
    dirtyRef.current = dirty;
    editModeRef.current = editMode;
    nameRef.current = name;
    dashboardRef.current = dashboard;
    initialRef.current = initial;
  }, [dirty, editMode, name, dashboard, initial]);

  // Task 11: Set hydration flag on mount (client-side only)
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Load saved filters AFTER mount (avoid SSR hydration mismatch on "N aktif")
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`bi-dash-filters:${initial.id}`);
      if (raw) {
        const saved = JSON.parse(raw) as GlobalFilterValues;
        setFilterValues((prev) => ({ ...prev, ...saved }));
      }
    } catch {
      /* */
    }
    setFiltersHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id]);

  // Remember last-used filters for this dashboard (only after hydrate)
  useEffect(() => {
    if (!filtersHydrated) return;
    try {
      localStorage.setItem(`bi-dash-filters:${dashboard.id}`, JSON.stringify(filterValues));
      sessionStorage.setItem('bi-last-dashboard-id', dashboard.id);
      sessionStorage.setItem('bi-last-dashboard-path', `/dashboards/${dashboard.id}`);
    } catch {
      /* */
    }
  }, [dashboard.id, filterValues, filtersHydrated]);

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
      pivot: 'Svodny tablo',
      kpi: 'KPI',
      text: 'Tekst',
    };
    const widget: DashboardWidget = {
      id: generateId(),
      type,
      title: titles[type],
      x: 0,
      y: maxY,
      w: type === 'kpi' ? 3 : type === 'pie' ? 4 : type === 'pivot' ? 8 : 6,
      h: type === 'kpi' ? 2 : type === 'pivot' ? 5 : 4,
      staticValue: type === 'kpi' ? '0' : type === 'text' ? 'Tekst ýazyň...' : undefined,
      config: { color: '#6366f1', showLegend: true },
    };
    updateWidgets([...dashboard.widgets, widget]);
  }

  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboards/${dashboardRef.current.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameRef.current,
          widgets: dashboardRef.current.widgets,
          globalFilters: dashboardRef.current.globalFilters || [],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDashboard(data.dashboard);
        setDirty(false);
        setEditMode(false);
        router.refresh();
        return true;
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, [router]);

  // Task 8: show Save / Cancel save / Close when there are unsaved changes
  const promptUnsaved = useCallback(async (): Promise<'save' | 'discard' | 'stay'> => {
    const result = await confirmDialog({
      title: 'Saklanmadyk üýtgetmeler',
      message:
        'Dashboardda üýtgetmeler bar. Çykmazdan öň ýatda saklamak isleýärsiňizmi?',
      confirmLabel: 'Ýatda sakla',
      cancelLabel: 'Saklama',
      stayLabel: 'Ýap',
      danger: false,
    });
    if (result === true) return 'save';
    if (result === false) return 'discard';
    return 'stay';
  }, []);

  /** Returns true if navigation/leave is allowed */
  const confirmLeave = useCallback(async (): Promise<boolean> => {
    if (!dirtyRef.current || !editModeRef.current) return true;
    const action = await promptUnsaved();
    if (action === 'stay') return false;
    if (action === 'discard') {
      // restore initial state and exit edit
      setDashboard(initialRef.current);
      setName(initialRef.current.name);
      setDirty(false);
      setEditMode(false);
      setConfigId(null);
      return true;
    }
    // save
    const ok = await save();
    return ok;
  }, [promptUnsaved, save]);

  // Task 8: browser refresh / close / tab close
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current && editModeRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Task 8: intercept internal link clicks (sidebar, back link, etc.)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || !editModeRef.current) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      // same-page or external with target=_blank — skip
      if (anchor.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      // allow same path
      try {
        const url = new URL(href, window.location.origin);
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      } catch {
        /* */
      }
      e.preventDefault();
      e.stopPropagation();
      void (async () => {
        const allow = await confirmLeave();
        if (allow) {
          // use full navigation so Next router state is clean
          window.location.href = href;
        }
      })();
    };
    // capture phase so we run before Next Link
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [confirmLeave]);

  // Task 8: browser back/forward
  useEffect(() => {
    const onPopState = () => {
      if (!dirtyRef.current || !editModeRef.current) return;
      // push current URL back so we stay, then ask
      history.pushState(null, '', window.location.href);
      void (async () => {
        const allow = await confirmLeave();
        if (allow) {
          history.back();
        }
      })();
    };
    // ensure we have a history entry to intercept
    history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [confirmLeave]);

  function refreshAllWidgets() {
    setRefreshingAll(true);
    setRefreshAllToken((n) => n + 1);
    // Broadcast so every LiveWidget / chart bumps its fetch
    window.dispatchEvent(new CustomEvent('bi-dashboard-refresh-all'));
    window.setTimeout(() => setRefreshingAll(false), 800);
  }

  async function handleExitEdit() {
    if (!dirty) {
      setEditMode(false);
      return;
    }
    const action = await promptUnsaved();
    if (action === 'stay') return;
    if (action === 'discard') {
      setDashboard(initial);
      setName(initial.name);
      setDirty(false);
      setEditMode(false);
      setConfigId(null);
      return;
    }
    await save();
  }

  async function handleBack() {
    const allow = await confirmLeave();
    if (!allow) return;
    // Return to this company's dashboard list (not the firm picker)
    const cid = initial.companyId || '';
    if (cid) {
      try {
        sessionStorage.setItem('bi-dash-selected-company', cid);
      } catch {
        /* */
      }
      router.push(`/dashboards?companyId=${encodeURIComponent(cid)}`);
    } else {
      router.push('/dashboards');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => void handleBack()}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors shrink-0"
            aria-label="Yza"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          {editMode ? (
            <div className="min-w-0 flex-1 space-y-1">
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setDirty(true);
                }}
                className="max-w-md h-10"
              />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                {(companyName || companySlug) && (
                  <span className="text-indigo-300/90">
                    <span className="text-slate-500">Firma:</span>{' '}
                    {companyName || companySlug}
                    {companySlug && companyName ? (
                      <span className="text-slate-600 font-mono"> ({companySlug})</span>
                    ) : null}
                  </span>
                )}
                {dashboard.description ? (
                  <span className="text-slate-400 truncate max-w-md">{dashboard.description}</span>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">{dashboard.name}</h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                {(companyName || companySlug) && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-indigo-300/90">
                    <span className="text-slate-500">Firma:</span>
                    <span className="font-medium">{companyName || companySlug}</span>
                    {companySlug && companyName ? (
                      <span className="text-slate-600 font-mono">({companySlug})</span>
                    ) : null}
                  </span>
                )}
                {dashboard.description && (
                  <span className="text-sm text-slate-400 truncate">{dashboard.description}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {editable && (
          <div className="flex items-center gap-2 shrink-0">
            {editMode ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => void handleExitEdit()}>
                  <Eye className="h-4 w-4" />
                  Görüş
                </Button>
                <Button
                  size="sm"
                  onClick={() => void save()}
                  loading={saving}
                  disabled={!dirty && name === initial.name}
                >
                  <Save className="h-4 w-4" />
                  Ýatda sakla
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refreshAllWidgets()}
                  loading={refreshingAll}
                  title="Ähli widget-leri täzele"
                >
                  {/* loading prop already shows spinner — no second spinning icon */}
                  {!refreshingAll && <RefreshCw className="h-4 w-4" />}
                  Täzele
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={editOpening}
                  loading={editOpening}
                  onClick={() => {
                    setEditOpening(true);
                    // Allow React to paint loading state before heavy edit chrome mounts
                    requestAnimationFrame(() => {
                      setEditMode(true);
                      setTimeout(() => setEditOpening(false), 120);
                    });
                  }}
                >
                  {!editOpening && <Pencil className="h-4 w-4" />}
                  {editOpening ? 'Garaşyň…' : 'Üýtget'}
                </Button>
              </>
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
          onChange={setFilterValues}
        />
      )}

      {/* Task 11: Hydration fix - ensure container is fully ready before rendering grid */}
      {isHydrated && (
        <div
          className={editMode ? 'flex flex-col lg:flex-row gap-4 w-full max-w-full' : 'w-full max-w-full'}
          style={{ width: '100%', maxWidth: '100%', minWidth: 0 }}
        >
          {/* Task 11: host must be full content width on mobile (no half-width flex shrink) */}
          <div
            className="flex-1 min-w-0 w-full max-w-full overflow-x-hidden"
            style={{ width: '100%', maxWidth: '100%', minWidth: 0 }}
          >
            <DashboardCanvas
              dashboard={{ ...dashboard, name }}
              editable={editMode}
              onChange={updateWidgets}
              onConfigureWidget={(id) => setConfigId(id)}
              globalFilters={effectiveFilterValues}
            />
          </div>
        {editMode && (
          <aside
            ref={(node) => {
              if (!node) return;
              const el = node as HTMLElement & { __wheelBound?: boolean };
              if (el.__wheelBound) return;
              el.__wheelBound = true;
              // Manual scroll so page/dashboard never moves while over panel
              el.addEventListener(
                'wheel',
                (e: WheelEvent) => {
                  const { scrollTop, scrollHeight, clientHeight } = el;
                  const maxScroll = Math.max(0, scrollHeight - clientHeight);
                  const atTop = scrollTop <= 0;
                  const atBottom = scrollTop >= maxScroll - 1;
                  const goingUp = e.deltaY < 0;
                  const goingDown = e.deltaY > 0;

                  // Panel still has room to scroll → keep scroll inside panel
                  if (maxScroll > 0 && !((atTop && goingUp) || (atBottom && goingDown))) {
                    e.preventDefault();
                    e.stopPropagation();
                    el.scrollTop += e.deltaY;
                    return;
                  }

                  // At edge: scroll nearest page scroll parent (not only window)
                  e.preventDefault();
                  e.stopPropagation();
                  let node: HTMLElement | null = el.parentElement;
                  while (node && node !== document.body) {
                    const st = getComputedStyle(node);
                    const oy = st.overflowY;
                    if (
                      (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
                      node.scrollHeight > node.clientHeight + 1
                    ) {
                      node.scrollTop += e.deltaY;
                      return;
                    }
                    node = node.parentElement;
                  }
                  window.scrollBy(0, e.deltaY);
                },
                { passive: false }
              );
            }}
            className="lg:w-80 w-full shrink-0 flex flex-col gap-3 sticky top-4 max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain pr-1"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {/* Collapsible: Widget goş */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                onClick={() => setPanelOpen((p) => ({ ...p, palette: !p.palette }))}
              >
                {panelOpen.palette ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                Täze widget
              </button>
              {panelOpen.palette && (
                <div className="px-4 pb-4">
                  <WidgetPalette onAdd={addWidget} />
                </div>
              )}
            </div>

            {/* Collapsible: Global filters */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                onClick={() => setPanelOpen((p) => ({ ...p, filters: !p.filters }))}
              >
                {panelOpen.filters ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                Global filterler
              </button>
              {panelOpen.filters && (
                <div className="px-4 pb-4">
                  <GlobalFiltersEditor
                    filters={filterDefs}
                    onChange={updateGlobalFilters}
                  />
                </div>
              )}
            </div>

            {/* Collapsible: Widget config */}
            {configId && dashboard.widgets.find((w) => w.id === configId) && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  onClick={() => setPanelOpen((p) => ({ ...p, config: !p.config }))}
                >
                  {panelOpen.config ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  Widget sazlamasy
                </button>
                {panelOpen.config && (
                  <WidgetConfigPanel
                    widget={dashboard.widgets.find((w) => w.id === configId)!}
                    onChange={(w) => {
                      updateWidgets(dashboard.widgets.map((x) => (x.id === w.id ? w : x)));
                    }}
                    onClose={() => setConfigId(null)}
                    globalFilters={filterDefs}
                    onSuggestGlobalFilters={updateGlobalFilters}
                    preferredTenantSlug={companySlug}
                  />
                )}
              </div>
            )}
          </aside>
        )}
        </div>
      )}
    </div>
  );
}
