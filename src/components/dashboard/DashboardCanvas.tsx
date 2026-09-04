'use client';

import { useCallback, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { Dashboard, DashboardWidget, GlobalFilterValues } from '@/lib/types';
import { LiveWidget } from './LiveWidget';
import { cn } from '@/lib/utils';
import { GripVertical, Trash2, Settings2, RefreshCw, Maximize2, X, ChevronUp, ChevronDown, RotateCcw, Download, ArrowLeftRight } from 'lucide-react';
import { generateId } from '@/lib/utils';

interface Props {
  dashboard: Dashboard;
  editable?: boolean;
  onChange?: (widgets: DashboardWidget[]) => void;
  onConfigureWidget?: (id: string) => void;
  cols?: number;
  globalFilters?: GlobalFilterValues;
}

export function DashboardCanvas({
  dashboard,
  editable = false,
  onChange,
  onConfigureWidget,
  cols = 12,
  globalFilters = {},
}: Props) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  const [width, setWidth] = useState(0); // Task 11: 0 until measured — avoid wrong RGL layout
  // Per-widget manual refresh — bumping the token forces LiveWidget to re-fetch immediately.
  const [refreshTokens, setRefreshTokens] = useState<Record<string, number>>({});
  const bumpRefresh = (id: string) =>
    setRefreshTokens((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));

  // Dashboard "Täzele" — refresh every widget
  useEffect(() => {
    const onAll = () => {
      setRefreshTokens((prev) => {
        const next = { ...prev };
        for (const w of dashboard.widgets) {
          next[w.id] = (next[w.id] || 0) + 1;
        }
        return next;
      });
    };
    window.addEventListener('bi-dashboard-refresh-all', onAll);
    return () => window.removeEventListener('bi-dashboard-refresh-all', onAll);
  }, [dashboard.widgets]);
  // Fullscreen view — essential on mobile where grid cells are too small to
  // read a busy table/chart comfortably.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const expandedWidget = dashboard.widgets.find((w) => w.id === expandedId) || null;
  
  // Task 7: Widget transfer between dashboards (+ API + dbKey select)
  const [transferWidgetId, setTransferWidgetId] = useState<string | null>(null);
  const [targetDashboards, setTargetDashboards] = useState<Dashboard[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [selectedDbKey, setSelectedDbKey] = useState<string>('primary');
  const [dbOptions, setDbOptions] = useState<{ dbKey: string; label: string }[]>([
    { dbKey: 'primary', label: 'primary' },
  ]);
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferMsg, setTransferMsg] = useState('');

  // Lock page scroll + support Escape while the fullscreen widget view is open
  useEffect(() => {
    if (!expandedId) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [expandedId]);

  // Mobile table card / hierarchy → open same fullscreen as Maximize button
  useEffect(() => {
    const onExpand = (ev: Event) => {
      const e = ev as CustomEvent<{ id?: string; row?: Record<string, unknown> }>;
      const id = e.detail?.id;
      if (!id) return;
      setExpandedId(id);
      if (e.detail?.row) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('bi-widget-drill', {
              detail: { id, row: e.detail!.row },
            })
          );
        }, 250);
      }
    };
    window.addEventListener('bi-widget-expand', onExpand as EventListener);
    return () => window.removeEventListener('bi-widget-expand', onExpand as EventListener);
  }, []);

  // Mobile browsers fire ResizeObserver's contentRect a beat before the
  // layout has actually settled (address-bar show/hide, orientation change,
  // pull-to-refresh elastic scroll) which used to leave the grid holding a
  // stale width — some widgets then rendered full-width, others squashed to
  // the left with a big empty gap on the right. getBoundingClientRect() on a
  // rAF-throttled re-measure, plus explicit orientation/visualViewport
  // listeners, keeps `width` accurate on real devices, not just in the
  // desktop simulator.
  const containerElRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    containerElRef.current = node;
    // measure immediately when node mounts (before paint settles)
    if (node) {
      const w = node.getBoundingClientRect().width || node.clientWidth;
      if (w > 0) setWidth(Math.floor(w));
    }
  }, []);

  // Task 11: robust mobile width — wrong first paint left-empty / right-shift;
  // only trust DOM after layout; re-measure on visualViewport & orientation.
  useLayoutEffect(() => {
    const node = containerElRef.current;
    if (!node) return;

    const readWidth = () => {
      const parent = node.parentElement;
      // Prefer the content box of the canvas host itself
      const rect = node.getBoundingClientRect();
      let w =
        node.clientWidth ||
        node.offsetWidth ||
        rect.width ||
        parent?.clientWidth ||
        0;
      // On mobile, if host is still 0 (flex not settled), fall back to viewport
      // minus typical horizontal page padding (px-3 / px-4 ≈ 24–32)
      if (w < 80 && typeof window !== 'undefined') {
        const vw = window.visualViewport?.width || window.innerWidth;
        w = Math.max(0, vw - 24);
      }
      // Never exceed viewport
      if (typeof window !== 'undefined') {
        const vw = window.visualViewport?.width || window.innerWidth;
        if (vw > 0 && w > vw) w = vw;
      }
      return Math.floor(w);
    };

    const apply = () => {
      const next = readWidth();
      if (next > 0) {
        setWidth((prev) => (Math.abs(prev - next) > 0.5 ? next : prev));
      }
      // Keep ancestors from clipping / shrinking the grid host
      node.style.width = '100%';
      node.style.maxWidth = '100%';
      node.style.minWidth = '0';
      node.style.boxSizing = 'border-box';
      if (node.parentElement) {
        node.parentElement.style.width = '100%';
        node.parentElement.style.maxWidth = '100%';
        node.parentElement.style.minWidth = '0';
        node.parentElement.style.overflowX = 'hidden';
      }
    };

    apply();
    // Double rAF: after browser applies flex/grid for this frame
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(apply);
    });

    const t1 = window.setTimeout(apply, 50);
    const t2 = window.setTimeout(apply, 200);
    const t3 = window.setTimeout(apply, 600);
    const t4 = window.setTimeout(apply, 1200);

    const ro = new ResizeObserver(() => apply());
    ro.observe(node);
    if (node.parentElement) ro.observe(node.parentElement);

    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    window.visualViewport?.addEventListener('resize', apply);
    window.visualViewport?.addEventListener('scroll', apply);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      ro.disconnect();
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
      window.visualViewport?.removeEventListener('resize', apply);
      window.visualViewport?.removeEventListener('scroll', apply);
    };
  }, [isMobile, dashboard.widgets.length, editable]);

  // Task 5: KPI can be smaller — desktop minH 1, mobile minH 2 (was forced 3 → too tall)
  const layout: Layout[] = dashboard.widgets.map((w) => ({
    i: w.id,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
    minW: w.type === 'kpi' ? 1 : 2,
    minH: w.type === 'kpi' ? 1 : 2,
  }));

  // Mobile: KPI-style widgets default to half-width so two of them can sit
  // side by side in one row; everything else stays full width unless the
  // user overrides it (mobileW, toggled from the per-widget "Ini" button).
  // Task 5: KPI default height 2 (not forced to 3), minH 2 so user can shrink.
  const MOBILE_COLS = 2;
  const mobileLayout: Layout[] = (() => {
    const ordered = [...dashboard.widgets].sort((a, b) => {
      const ao = a.mobileOrder ?? a.y;
      const bo = b.mobileOrder ?? b.y;
      if (ao !== bo) return ao - bo;
      return a.x - b.x;
    });
    const colY = [0, 0]; // running height cursor per mobile column
    return ordered.map((w) => {
      const isKpi = w.type === 'kpi';
      const minH = isKpi ? 2 : 3;
      const defaultH = isKpi ? 2 : Math.max(w.h, 3);
      const h = Math.max(w.mobileH ?? defaultH, minH);
      const defaultW = isKpi ? 1 : MOBILE_COLS;
      const width = Math.min(Math.max(w.mobileW ?? defaultW, 1), MOBILE_COLS);
      if (width >= MOBILE_COLS) {
        const y = Math.max(colY[0], colY[1]);
        colY[0] = y + h;
        colY[1] = y + h;
        return { i: w.id, x: 0, y, w: MOBILE_COLS, h, minW: 1, minH };
      }
      const col = colY[0] <= colY[1] ? 0 : 1;
      const y = colY[col];
      colY[col] = y + h;
      return { i: w.id, x: col, y, w: 1, h, minW: 1, minH };
    });
  })();

  const effectiveCols = isMobile ? MOBILE_COLS : cols;
  const effectiveLayout = isMobile ? mobileLayout : layout;

  function onLayoutChange(next: Layout[]) {
    if (!editable || !onChange) return;
    if (isMobile) {
      // Persist mobileOrder + mobileH + mobileW — keep desktop grid intact
      const sorted = [...next].sort((a, b) => a.y - b.y || a.x - b.x);
      const widgets = dashboard.widgets.map((w) => {
        const idx = sorted.findIndex((l) => l.i === w.id);
        const l = sorted[idx];
        if (!l) return w;
        return {
          ...w,
          mobileOrder: idx,
          mobileH: Math.max(l.h, w.type === 'kpi' ? 2 : 3),
          mobileW: Math.min(Math.max(l.w, 1), MOBILE_COLS),
        };
      });
      onChange(widgets);
      return;
    }
    const widgets = dashboard.widgets.map((w) => {
      const l = next.find((x) => x.i === w.id);
      if (!l) return w;
      return { ...w, x: l.x, y: l.y, w: l.w, h: l.h };
    });
    onChange(widgets);
  }

  function removeWidget(id: string) {
    if (!onChange) return;
    onChange(dashboard.widgets.filter((w) => w.id !== id));
  }

  // Task 7: open transfer dialog for a widget
  async function openTransfer(widgetId: string) {
    setTransferWidgetId(widgetId);
    setSelectedTargetId('');
    setSelectedDbKey('primary');
    setTransferMsg('');
    setTransferBusy(true);
    try {
      const res = await fetch('/api/dashboards');
      const data = await res.json();
      let list: Dashboard[] = (data.dashboards || data || []).filter(
        (d: Dashboard) => d.id !== dashboard.id
      );
      // Attach company name/slug for picker UI
      try {
        const cres = await fetch('/api/catalog');
        const cat = await cres.json();
        const byId = new Map<string, { name: string; slug: string }>();
        for (const t of cat.tenants || []) {
          if (t.id) byId.set(String(t.id), { name: t.name || t.slug, slug: t.slug });
          if (t.slug) byId.set(String(t.slug), { name: t.name || t.slug, slug: t.slug });
        }
        list = list.map((d) => {
          const co = byId.get(String(d.companyId)) || byId.get(String((d as any).companySlug || ''));
          return {
            ...d,
            companyName: (d as any).companyName || co?.name,
            companySlug: (d as any).companySlug || co?.slug,
          } as Dashboard;
        });
      } catch {
        /* */
      }
      setTargetDashboards(list);
    } catch (e) {
      setTransferMsg(String(e));
      setTargetDashboards([]);
    } finally {
      setTransferBusy(false);
    }
  }

  async function loadDbOptionsForTarget(target: Dashboard) {
    try {
      const res = await fetch('/api/catalog');
      const cat = await res.json();
      const slug =
        (target as any).tenantSlug ||
        (target as any).companySlug ||
        '';
      // Prefer company connections from catalog tenants
      const tenants = cat.tenants || [];
      let opts: { dbKey: string; label: string }[] = [];
      // try match by companyId / slug on target
      const coId = (target as any).companyId;
      for (const t of tenants) {
        if (
          (coId && (t.id === coId || t.companyId === coId)) ||
          (slug && t.slug === slug)
        ) {
          opts = (t.connections || []).map((c: any) => ({
            dbKey: c.dbKey || 'primary',
            label: c.label || c.database || c.dbKey || 'primary',
          }));
          break;
        }
      }
      // fallback: any connections from endpoints used by target widgets
      if (!opts.length) {
        const keys = new Set<string>();
        for (const w of target.widgets || []) {
          const k = w.dataSource?.dbKey || 'primary';
          keys.add(k);
        }
        opts = [...keys].map((k) => ({ dbKey: k, label: k }));
      }
      if (!opts.length) opts = [{ dbKey: 'primary', label: 'primary' }];
      setDbOptions(opts);
      setSelectedDbKey(opts[0].dbKey);
    } catch {
      setDbOptions([{ dbKey: 'primary', label: 'primary' }]);
      setSelectedDbKey('primary');
    }
  }

  async function confirmTransfer() {
    if (!transferWidgetId || !selectedTargetId) {
      setTransferMsg('Maksat dashboard saýlaň');
      return;
    }
    const src = dashboard.widgets.find((w) => w.id === transferWidgetId);
    if (!src) return;
    const target = targetDashboards.find((d) => d.id === selectedTargetId);
    if (!target) return;

    setTransferBusy(true);
    setTransferMsg('Geçirilýär…');
    try {
      // Clone widget with new id; remap dbKey / tenant if needed
      const cloned: DashboardWidget = {
        ...JSON.parse(JSON.stringify(src)),
        id: generateId(),
      };
      // place below existing widgets
      const maxY = (target.widgets || []).reduce(
        (m, w) => Math.max(m, (w.y || 0) + (w.h || 2)),
        0
      );
      cloned.x = 0;
      cloned.y = maxY;
      if (cloned.dataSource) {
        cloned.dataSource = {
          ...cloned.dataSource,
          dbKey: selectedDbKey || cloned.dataSource.dbKey || 'primary',
        };
        // keep path; tenantSlug stays if same company, else use target company slug when available
        const targetSlug =
          (target as any).tenantSlug ||
          (target as any).companySlug ||
          cloned.dataSource.tenantSlug;
        if (targetSlug) cloned.dataSource.tenantSlug = targetSlug;
        if (cloned.dataSource.drillDown) {
          cloned.dataSource.drillDown = {
            ...cloned.dataSource.drillDown,
            dbKey: selectedDbKey || cloned.dataSource.drillDown.dbKey || 'primary',
            tenantSlug: targetSlug || cloned.dataSource.drillDown.tenantSlug,
          };
        }
      }

      // Task 7: also ensure related API endpoint exists on target tenant (best-effort)
      if (cloned.dataSource?.path && cloned.dataSource?.tenantSlug) {
        try {
          const catRes = await fetch('/api/catalog');
          const cat = await catRes.json();
          const eps: any[] = cat.endpoints || [];
          const path = cloned.dataSource.path.startsWith('/')
            ? cloned.dataSource.path
            : `/${cloned.dataSource.path}`;
          const exists = eps.some(
            (e) =>
              e.tenantSlug === cloned.dataSource!.tenantSlug &&
              (e.pathTemplate === path || e.path === path)
          );
          if (!exists && src.dataSource?.path) {
            // copy endpoint definition from source tenant if found
            const srcEp = eps.find(
              (e) =>
                e.tenantSlug === src.dataSource?.tenantSlug &&
                (e.pathTemplate === path ||
                  e.path === path ||
                  e.pathTemplate === src.dataSource?.path ||
                  e.path === src.dataSource?.path)
            );
            if (srcEp) {
              await fetch('/api/endpoints', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...srcEp,
                  id: undefined,
                  tenantSlug: cloned.dataSource.tenantSlug,
                  dbKey: selectedDbKey,
                }),
              });
            }
          }
        } catch {
          /* API copy best-effort */
        }
      }

      const nextWidgets = [...(target.widgets || []), cloned];
      const res = await fetch(`/api/dashboards/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: target.name,
          widgets: nextWidgets,
          globalFilters: target.globalFilters || [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Geçirmek şowsuz');
      setTransferMsg('Üstünlikli geçirildi');
      setTimeout(() => {
        setTransferWidgetId(null);
        setTransferMsg('');
      }, 900);
    } catch (e) {
      setTransferMsg(String(e));
    } finally {
      setTransferBusy(false);
    }
  }


  /** Toggle a widget between half-width and full-width in the mobile grid. */
  function toggleMobileWidth(id: string) {
    if (!onChange) return;
    const widgets = dashboard.widgets.map((w) => {
      if (w.id !== id) return w;
      const current = Math.min(Math.max(w.mobileW ?? (w.type === 'kpi' ? 1 : MOBILE_COLS), 1), MOBILE_COLS);
      return { ...w, mobileW: current >= MOBILE_COLS ? 1 : MOBILE_COLS };
    });
    onChange(widgets);
  }

  function moveWidgetMobile(id: string, dir: -1 | 1) {
    if (!onChange) return;
    const ordered = [...dashboard.widgets].sort((a, b) => {
      const ao = a.mobileOrder ?? a.y;
      const bo = b.mobileOrder ?? b.y;
      if (ao !== bo) return ao - bo;
      return a.x - b.x;
    });
    const idx = ordered.findIndex((w) => w.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;
    const a = ordered[idx];
    const b = ordered[swapIdx];
    const widgets = dashboard.widgets.map((w) => {
      if (w.id === a.id) return { ...w, mobileOrder: swapIdx };
      if (w.id === b.id) return { ...w, mobileOrder: idx };
      return w;
    });
    // Normalize orders 0..n-1
    const reOrdered = [...widgets].sort(
      (x, y) => (x.mobileOrder ?? x.y) - (y.mobileOrder ?? y.y)
    );
    onChange(
      widgets.map((w) => {
        const i = reOrdered.findIndex((x) => x.id === w.id);
        return { ...w, mobileOrder: i };
      })
    );
  }

  if (dashboard.widgets.length === 0) {
    return (
      <div
        ref={containerRef}
        className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 px-6 py-20 text-center text-slate-500"
      >
        Widget ýok. {editable ? 'Saga panelden goşuň.' : ''}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full overflow-hidden"
      style={{ width: '100%', maxWidth: '100%' }}
    >
      {width < 40 ? (
        <div className="w-full min-h-[120px] flex items-center justify-center text-slate-500 text-xs">
          …
        </div>
      ) : (
      <GridLayout
        key={`gl-${effectiveCols}-${Math.round(width)}`}
        className="layout w-full"
        layout={effectiveLayout}
        cols={effectiveCols}
        rowHeight={isMobile ? 40 : 48}
        width={width}
        margin={isMobile ? [8, 10] : [12, 12]}
        containerPadding={[0, 0]}
        isDraggable={editable}
        isResizable={editable}
        resizeHandles={editable ? ['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne'] : []}
        compactType="vertical"
        onLayoutChange={onLayoutChange}
        draggableHandle=".drag-handle"
        style={{ width: '100%' }}
      >
        {dashboard.widgets.map((widget) => (
          <div
            key={widget.id}
            className={cn(
              'rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden flex flex-col shadow-sm',
              editable && 'hover:border-slate-700'
            )}
          >
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 border-b border-slate-800/80 shrink-0">
              {editable && (
                <button
                  type="button"
                  className="drag-handle cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 p-0.5 touch-none"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              )}
              <h4 className="text-[11px] sm:text-sm font-medium text-slate-200 flex-1 truncate">{widget.mobileTitle ? (<><span className="hidden sm:inline">{widget.title}</span><span className="sm:hidden">{widget.mobileTitle || widget.title}</span></>) : widget.title}</h4>
              
              {/* Task 16: Buttons positioned right - Maximize first, then others */}
              <div className="flex items-center gap-0.5 shrink-0 ml-auto">
                {/* Task 17: Full-page Refresh button - completely reload widget data */}
                <button
                  type="button"
                  onClick={() => {
                    bumpRefresh(widget.id);
                    // Trigger full page refresh-like behavior
                    window.dispatchEvent(new CustomEvent('bi-widget-fullrefresh', { detail: { id: widget.id } }));
                  }}
                  className="p-1 rounded-lg text-slate-500 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
                  title="Doly täzele (page refresh)"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>

                {['bar', 'line', 'pie', 'area'].includes(widget.type) && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent('bi-chart-cmd', {
                            detail: { id: widget.id, action: 'reset' },
                          })
                        )
                      }
                      className="p-1 rounded-lg text-slate-500 hover:text-sky-300 hover:bg-sky-500/10 transition-colors"
                      title="Reset zoom"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent('bi-chart-cmd', {
                            detail: { id: widget.id, action: 'png' },
                          })
                        )
                      }
                      className="p-1 rounded-lg text-slate-500 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                      title="PNG ýükle"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}

                {/* Task 16: Maximize button positioned far right */}
                <button
                  type="button"
                  onClick={() => setExpandedId(widget.id)}
                  className="p-2 rounded-full bg-slate-900/80 border border-slate-700 text-slate-400 hover:text-slate-100 hover:border-slate-500 shadow-lg backdrop-blur transition-colors"
                  title="Doly ekran"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>

                {editable && (
                  <>
                    <button
                      type="button"
                      onClick={() => void openTransfer(widget.id)}
                      className="p-1 rounded-lg text-slate-500 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                      title="Başga dashboarda geçir"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onConfigureWidget?.(widget.id)}
                      className="p-1 rounded-lg text-slate-500 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                      title="Sazla"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeWidget(widget.id)}
                      className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Poz"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>

              {/* Task 16: Mobile buttons (width, move up/down) - below main header on mobile */}
              {editable && isMobile && (
                <div className="flex items-center gap-0.5 absolute top-10 left-2 z-10">
                  <button
                    type="button"
                    onClick={() => toggleMobileWidth(widget.id)}
                    className="px-1 py-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 text-[10px] font-semibold leading-none w-[22px] text-center"
                    title="Ini: ýarym / doly"
                  >
                    {Math.min(Math.max(widget.mobileW ?? (widget.type === 'kpi' ? 1 : MOBILE_COLS), 1), MOBILE_COLS) >= MOBILE_COLS
                      ? '½'
                      : '1/1'}
                  </button>
                  <button
                    type="button"
                    onClick={() => moveWidgetMobile(widget.id, -1)}
                    className="p-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800"
                    title="Ýokary süýş"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveWidgetMobile(widget.id, 1)}
                    className="p-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800"
                    title="Aşak süýş"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 min-h-0 p-1.5 sm:p-3">
              <LiveWidget
                widget={widget}
                editable={editable}
                onConfigure={() => onConfigureWidget?.(widget.id)}
                globalFilters={globalFilters}
                refreshToken={refreshTokens[widget.id]}
              />
            </div>
          </div>
        ))}
      </GridLayout>
      )}

            {/* Fullscreen via portal — avoids transform/overflow parents breaking fixed positioning */}
      {/* Task 7: Widget transfer dialog */}
      {transferWidgetId &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[2147482700] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
              onClick={() => !transferBusy && setTransferWidgetId(null)}
            />
            <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl space-y-4 z-10">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-emerald-400" />
                <h3 className="text-base font-semibold text-white flex-1">Widget geçir</h3>
                <button
                  type="button"
                  className="p-1 text-slate-400 hover:text-white"
                  onClick={() => !transferBusy && setTransferWidgetId(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Saýlanan widget + baglanan API başga dashboarda göçüriler. Maksat dashboardda 2+ DB
                bolsa, haýsy DB-de işlemelidigini saýlaň.
              </p>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Maksat dashboard</label>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-700 divide-y divide-slate-800">
                  {targetDashboards.length === 0 ? (
                    <p className="text-xs text-slate-500 p-3">Başga dashboard ýok</p>
                  ) : (
                    targetDashboards.map((d) => {
                      const selected = selectedTargetId === d.id;
                      const firm =
                        (d as any).companyName ||
                        (d as any).companySlug ||
                        d.companyId ||
                        '';
                      return (
                        <button
                          key={d.id}
                          type="button"
                          disabled={transferBusy}
                          onClick={() => {
                            setSelectedTargetId(d.id);
                            void loadDbOptionsForTarget(d);
                          }}
                          className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                            selected
                              ? 'bg-indigo-500/15 text-white'
                              : 'hover:bg-slate-800/70 text-slate-200'
                          }`}
                        >
                          <span className="font-medium block truncate">{d.name}</span>
                          <span className="text-[10px] text-slate-500">
                            {(d.widgets || []).length} widget
                            {firm ? ` · ${firm}` : ''}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              {selectedTargetId && (
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Database (dbKey)</label>
                  <select
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    value={selectedDbKey}
                    disabled={transferBusy}
                    onChange={(e) => setSelectedDbKey(e.target.value)}
                  >
                    {dbOptions.map((o) => (
                      <option key={o.dbKey} value={o.dbKey}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {transferMsg && (
                <p className="text-xs text-amber-300 bg-amber-500/10 rounded-lg px-3 py-2">{transferMsg}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={transferBusy}
                  onClick={() => setTransferWidgetId(null)}
                  className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 text-slate-200 hover:bg-slate-700"
                >
                  Ýatyr
                </button>
                <button
                  type="button"
                  disabled={transferBusy || !selectedTargetId}
                  onClick={() => void confirmTransfer()}
                  className="px-3 py-1.5 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {transferBusy ? '…' : 'Geçir'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {expandedWidget &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[2147481500] flex items-stretch sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setExpandedId(null)} />
            <div className="relative w-full h-[100dvh] sm:h-[min(92dvh,900px)] sm:max-w-6xl rounded-none sm:rounded-2xl border-0 sm:border border-slate-700 bg-slate-950 shadow-2xl flex flex-col overflow-hidden z-10">
              <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-3 border-b border-slate-800 shrink-0">
                <h3 className="text-sm sm:text-base font-semibold text-white flex-1 truncate min-w-0">
                  {expandedWidget.title}
                </h3>
                <button
                  type="button"
                  onClick={() => bumpRefresh(expandedWidget.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-800"
                  title="Täzele"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                {['bar', 'line', 'pie', 'area'].includes(expandedWidget.type) && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent('bi-chart-cmd', {
                            detail: { id: expandedWidget.id, action: 'reset' },
                          })
                        )
                      }
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-800"
                      title="Reset zoom"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent('bi-chart-cmd', {
                            detail: { id: expandedWidget.id, action: 'png' },
                          })
                        )
                      }
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800"
                      title="PNG"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setExpandedId(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  title="Ýap"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0 p-2 sm:p-4 overflow-hidden flex flex-col">
                <div className="flex-1 min-h-0 h-full w-full">
                  <LiveWidget
                    widget={expandedWidget}
                    editable={false}
                    globalFilters={globalFilters}
                    refreshToken={refreshTokens[expandedWidget.id]}
                    className="h-full min-h-[50dvh]"
                  />
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      
    </div>
  );
}