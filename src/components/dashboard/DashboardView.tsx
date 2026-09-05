'use client';

// Task 11: Mobile layout Flex/Grid width fix - ensure proper responsive container sizing
// Prevents layout shifts and gaps on mobile browsers
// Hydration fix: defer container width calculation until client-side
// Task 8: Unsaved changes warning (Save / Cancel save / Close) when leaving edit mode

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import { ArrowLeft, Save, Pencil, Eye, ChevronDown, ChevronRight, RefreshCw, GripHorizontal, X } from 'lucide-react';
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
  // Floating widget-settings modal (draggable; remembers last place across widgets)
  // null until first place — avoids flash at left (16,96) before jumping right
  const [configPos, setConfigPos] = useState<{ x: number; y: number } | null>(null);
  const configPosUserSet = useRef(false);
  const configDragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const configPanelRef = useRef<HTMLDivElement | null>(null);
  // Fix: widget settings panel UX — see asideRef/isDesktop/mobilePanelVh below.
  const asideRef = useRef<HTMLElement | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [mobilePanelVh, setMobilePanelVh] = useState(70);
  const [refreshAllToken, setRefreshAllToken] = useState(0);
  const [refreshingAll, setRefreshingAll] = useState(false);

  // Collapsible edit side panels
  const [panelOpen, setPanelOpen] = useState({ palette: true, filters: true, config: true });

  // Task 11: Hydration fix - track if component has mounted on client
  const [isHydrated, setIsHydrated] = useState(false);

  // Fix: widget settings panel — know when we're below the `lg` breakpoint
  // (panel stacks under the canvas instead of sitting sticky beside it).
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  // Place floating panel in the VIEWPORT (never page bottom).
  // Mobile: aside sits under the canvas → its getBoundingClientRect is often below the fold
  // which used to pin the panel to the bottom of the screen or hide it.
  useEffect(() => {
    if (!configId) return;
    if (configPosUserSet.current && configPos) {
      // If remembered pos is off-screen (e.g. after rotate), re-clamp
      const margin = 8;
      const pw = 360;
      const x = Math.max(margin, Math.min(configPos.x, window.innerWidth - Math.min(pw, window.innerWidth - 16) - margin));
      const y = Math.max(margin, Math.min(configPos.y, window.innerHeight - 100));
      if (x !== configPos.x || y !== configPos.y) setConfigPos({ x, y });
      return;
    }

    const place = () => {
      const panelW = Math.min(360, window.innerWidth - 16);
      const margin = 12;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const desktop = vw >= 1024;

      let x: number;
      let y: number;

      if (desktop) {
        // Prefer under Global filters on the right aside — only if aside is on-screen
        x = Math.max(margin, vw - panelW - margin);
        y = 88;
        const aside = asideRef.current;
        if (aside) {
          const ar = aside.getBoundingClientRect();
          const visible = ar.top < vh - 60 && ar.bottom > 40;
          if (visible) {
            x = Math.max(margin, Math.min(ar.left, vw - panelW - margin));
            const filtersEl = aside.querySelector('[data-global-filters-block]') as HTMLElement | null;
            if (filtersEl) {
              const fr = filtersEl.getBoundingClientRect();
              if (fr.bottom > 40 && fr.bottom < vh - 80) {
                y = fr.bottom + 8;
              } else {
                y = Math.max(margin, Math.min(ar.top + 8, vh - 120));
              }
            }
          }
        }
      } else {
        // Mobile: center horizontally, near top of viewport (not page bottom)
        x = Math.max(margin, (vw - panelW) / 2);
        y = 56;
      }

      y = Math.max(margin, Math.min(y, vh - 120));
      x = Math.max(margin, Math.min(x, vw - panelW - margin));
      setConfigPos({ x, y });
      configPosUserSet.current = true;
    };

    place();
  }, [configId]); // eslint-disable-line react-hooks/exhaustive-deps

  function closeConfigPanel() {
    setConfigId(null);
  }

  function onConfigDragStart(e: React.PointerEvent) {
    if (e.button != null && e.button !== 0) return;
    const tgt = e.target as HTMLElement | null;
    if (tgt?.closest?.('[data-config-no-drag]')) return;
    if (!configPos) return;
    // Drag panel without locking body overflow (that hid the page scrollbar
    // and made the dashboard jump wider). Only block default on the gesture.
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    configDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: configPos.x,
      origY: configPos.y,
    };
    // Prevent page scroll only while finger is on the drag handle — do NOT
    // set body overflow:hidden (scrollbar must stay).
    const onTouchMove = (ev: TouchEvent) => {
      if (configDragRef.current) ev.preventDefault();
    };
    function onMove(ev: PointerEvent) {
      const d = configDragRef.current;
      if (!d) return;
      if (ev.cancelable) ev.preventDefault();
      const panelW = configPanelRef.current?.offsetWidth || 360;
      const margin = 8;
      let nx = d.origX + (ev.clientX - d.startX);
      let ny = d.origY + (ev.clientY - d.startY);
      nx = Math.max(margin, Math.min(nx, window.innerWidth - panelW - margin));
      ny = Math.max(margin, Math.min(ny, window.innerHeight - 80 - margin));
      configPosUserSet.current = true;
      setConfigPos({ x: nx, y: ny });
    }
    function onUp() {
      configDragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.removeEventListener('touchmove', onTouchMove);
    }
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
  }

  // Fix: on mobile the panel had a fixed viewport-relative height with no
  // way to adjust it. Let the user grab a handle at the top and drag it
  // taller/shorter, like a bottom sheet, clamped to a comfortable range.
  function onPanelResizeStart(e: React.PointerEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startVh = mobilePanelVh;
    const vh1 = Math.max(1, window.innerHeight / 100);
    function onMove(ev: PointerEvent) {
      const draggedUpPx = startY - ev.clientY; // dragging up → taller panel
      const next = Math.max(40, Math.min(92, startVh + draggedUpPx / vh1));
      setMobilePanelVh(next);
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

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
        setConfigId(null); // close widget settings when dashboard is saved
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
      <div className="flex items-center gap-2 sm:gap-3 justify-between">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
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
              <h1 className="text-base sm:text-xl font-bold text-white truncate">{dashboard.name}</h1>
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
                  <span className="text-sm text-slate-400 truncate hidden sm:inline">{dashboard.description}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Same row as title on mobile — compact buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {editMode && editable ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => void handleExitEdit()}>
                <Eye className="h-4 w-4" />
                <span className="hidden xs:inline sm:inline">Görüş</span>
              </Button>
              <Button
                size="sm"
                onClick={() => void save()}
                loading={saving}
                disabled={!dirty && name === initial.name}
              >
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">Ýatda sakla</span>
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
                className="px-2 sm:px-3"
              >
                {!refreshingAll && <RefreshCw className="h-4 w-4" />}
                <span className="text-xs sm:text-sm">Täzele</span>
              </Button>
              {editable && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={editOpening}
                  loading={editOpening}
                  onClick={() => {
                    setEditOpening(true);
                    requestAnimationFrame(() => {
                      setEditMode(true);
                      setTimeout(() => setEditOpening(false), 120);
                    });
                  }}
                  className="px-2 sm:px-3"
                >
                  {!editOpening && <Pencil className="h-4 w-4" />}
                  <span className="text-xs sm:text-sm">{editOpening ? '…' : 'Üýtget'}</span>
                </Button>
              )}
            </>
          )}
        </div>
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
          className={editMode ? 'flex flex-col lg:flex-row lg:items-stretch gap-4 w-full max-w-full min-h-[calc(100dvh-6rem)]' : 'w-full max-w-full'}
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
              onConfigureWidget={(id) => {
                // Mobile: always re-anchor near top of viewport (aside is below canvas)
                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                  configPosUserSet.current = false;
                  setConfigPos(null);
                }
                setConfigId(id);
                setPanelOpen((p) => ({ ...p, config: true }));
              }}
              globalFilters={effectiveFilterValues}
            />
          </div>
        {editMode && (
          <aside
            ref={(node) => {
              asideRef.current = node;
              if (!node) return;
              const el = node as HTMLElement & { __wheelBound?: boolean };
              if (el.__wheelBound) return;
              el.__wheelBound = true;
              // Keep wheel scrolling inside the panel's own scrollable
              // content when there is any — but only then. Previously this
              // always called preventDefault(), so hovering the panel while
              // its content was short (nothing to scroll) silently ate every
              // wheel tick and blocked the page from scrolling at all.
              el.addEventListener(
                'wheel',
                (e: WheelEvent) => {
                  // Prefer the deepest scrollable child under the pointer
                  let target: HTMLElement | null = e.target as HTMLElement;
                  let scrollEl: HTMLElement | null = null;
                  while (target && target !== el) {
                    const st = getComputedStyle(target);
                    const oy = st.overflowY;
                    if (
                      (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
                      target.scrollHeight > target.clientHeight + 1
                    ) {
                      scrollEl = target;
                      break;
                    }
                    target = target.parentElement;
                  }
                  if (!scrollEl) {
                    const fallback = el.querySelector('[data-widget-config-scroll]') as HTMLElement | null;
                    if (fallback && fallback.scrollHeight > fallback.clientHeight + 1) {
                      scrollEl = fallback;
                    }
                  }
                  // Nothing scrollable under the panel → let the wheel event
                  // through so the page itself can scroll instead of getting stuck.
                  if (!scrollEl) return;
                  e.preventDefault();
                  e.stopPropagation();
                  scrollEl.scrollTop += e.deltaY;
                },
                { passive: false, capture: true }
              );
            }}
            className="lg:w-[22rem] xl:w-96 w-full shrink-0 flex flex-col gap-2 lg:sticky lg:top-[4.75rem] lg:self-start lg:h-[calc(100dvh-5.25rem)] lg:max-h-[calc(100dvh-5.25rem)] overflow-hidden pr-0.5 lg:z-10"
            style={{
              WebkitOverflowScrolling: 'touch',
              ...(isDesktop ? {} : { height: `${mobilePanelVh}dvh`, maxHeight: '92dvh' }),
            }}
          >
            {/* Fix: draggable handle so the settings panel can be resized
                taller (down to the end of a long dashboard) or shorter,
                instead of being stuck at one fixed height on mobile. */}
            <div
              className="lg:hidden flex items-center justify-center py-1.5 -mt-1 cursor-row-resize touch-none select-none shrink-0"
              onPointerDown={onPanelResizeStart}
              title="Ini üýtgetmek üçin ýokary/aşak süýrüň"
            >
              <span className="h-1.5 w-12 rounded-full bg-slate-700" />
            </div>

            {/* Collapsible: Widget goş */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden shrink-0">
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
            <div data-global-filters-block className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden shrink-0">
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
          </aside>
        )}
        </div>
      )}

      {/* Floating widget settings — portal to body so fixed = viewport (not page bottom) */}
      {configId &&
        configPos &&
        typeof document !== 'undefined' &&
        dashboard.widgets.find((w) => w.id === configId) &&
        createPortal(
        <div
          ref={configPanelRef}
          role="dialog"
          aria-label="Widget sazlamasy"
          className="fixed z-[2147483000] flex flex-col w-[min(22rem,calc(100vw-1rem))] max-h-[min(85dvh,720px)] rounded-2xl border border-indigo-500/40 bg-slate-950 shadow-2xl shadow-black/50 ring-1 ring-white/5 overscroll-none"
          style={{
            left: configPos.x,
            top: configPos.y,
          }}
        >
          <div
            className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800 cursor-grab active:cursor-grabbing select-none touch-none shrink-0 rounded-t-2xl bg-slate-900/90"
            style={{ touchAction: 'none' }}
            onPointerDown={onConfigDragStart}
            title="Süýşürmek üçin tutuň"
          >
            <GripHorizontal className="h-4 w-4 text-slate-500 shrink-0 pointer-events-none" />
            <div className="min-w-0 flex-1 pointer-events-none">
              <p className="text-sm font-semibold text-white truncate">
                {dashboard.widgets.find((w) => w.id === configId)?.title || 'Widget sazlamasy'}
              </p>
              <p className="text-[10px] text-slate-500">Süýşürmek üçin tutuň</p>
            </div>
            <button
              type="button"
              data-config-no-drag
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 relative z-10"
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                closeConfigPanel();
              }}
              title="Ýap"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div
            data-widget-config-scroll
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 pb-4 pt-1"
          >
            <WidgetConfigPanel
              widget={dashboard.widgets.find((w) => w.id === configId)!}
              onChange={(w) => {
                updateWidgets(dashboard.widgets.map((x) => (x.id === w.id ? w : x)));
              }}
              onClose={closeConfigPanel}
              globalFilters={filterDefs}
              onSuggestGlobalFilters={updateGlobalFilters}
              preferredTenantSlug={companySlug}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
