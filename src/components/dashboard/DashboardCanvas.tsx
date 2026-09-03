'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { Dashboard, DashboardWidget, GlobalFilterValues } from '@/lib/types';
import { LiveWidget } from './LiveWidget';
import { cn } from '@/lib/utils';
import { GripVertical, Trash2, Settings2, RefreshCw, Maximize2, X, ChevronUp, ChevronDown, RotateCcw, Download } from 'lucide-react';

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

  const [width, setWidth] = useState(1200);
  // Per-widget manual refresh — bumping the token forces LiveWidget to re-fetch immediately.
  const [refreshTokens, setRefreshTokens] = useState<Record<string, number>>({});
  const bumpRefresh = (id: string) =>
    setRefreshTokens((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  // Fullscreen view — essential on mobile where grid cells are too small to
  // read a busy table/chart comfortably.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const expandedWidget = dashboard.widgets.find((w) => w.id === expandedId) || null;
  
  // Task 8: Track unsaved widget arrange changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  
  // Task 7: Widget transfer between dashboards
  const [transferWidgetId, setTransferWidgetId] = useState<string | null>(null);
  const [targetDashboards, setTargetDashboards] = useState<Dashboard[]>([]);
  const [selectedDbKey, setSelectedDbKey] = useState<string | null>(null);

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
  }, []);

  useEffect(() => {
    const node = containerElRef.current;
    if (!node) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        const w = rect.width;
        // Task 11: Mobile fix - ensure full width, no left shift
        // Account for padding/margin: use offsetWidth for true layout width
        const layoutWidth = node.offsetWidth || w;
        if (layoutWidth) {
          setWidth(Math.floor(layoutWidth));
          // Ensure parent container is also full width
          if (node.parentElement) {
            node.parentElement.style.width = '100%';
            node.parentElement.style.overflow = 'hidden';
          }
        }
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      cancelAnimationFrame(raf);
    };
  }, []);

  const layout: Layout[] = dashboard.widgets.map((w) => ({
    i: w.id,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
    minW: 2,
    minH: 2,
  }));

  // Mobile: KPI-style widgets default to half-width so two of them can sit
  // side by side in one row; everything else stays full width unless the
  // user overrides it (mobileW, toggled from the per-widget "Ini" button).
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
      const h = Math.max(w.mobileH ?? w.h, 3);
      const defaultW = w.type === 'kpi' ? 1 : MOBILE_COLS;
      const width = Math.min(Math.max(w.mobileW ?? defaultW, 1), MOBILE_COLS);
      if (width >= MOBILE_COLS) {
        const y = Math.max(colY[0], colY[1]);
        colY[0] = y + h;
        colY[1] = y + h;
        return { i: w.id, x: 0, y, w: MOBILE_COLS, h, minW: 1, minH: 3 };
      }
      const col = colY[0] <= colY[1] ? 0 : 1;
      const y = colY[col];
      colY[col] = y + h;
      return { i: w.id, x: col, y, w: 1, h, minW: 1, minH: 3 };
    });
  })();

  const effectiveCols = isMobile ? MOBILE_COLS : cols;
  const effectiveLayout = isMobile ? mobileLayout : layout;

  function onLayoutChange(next: Layout[]) {
    if (!editable || !onChange) return;
    // Task 8: Mark changes as unsaved
    setHasUnsavedChanges(true);
    
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
          mobileH: Math.max(l.h, 3),
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
      <GridLayout
        className="layout"
        layout={effectiveLayout}
        cols={effectiveCols}
        rowHeight={isMobile ? 40 : 48}
        width={width}
        margin={isMobile ? [0, 10] : [12, 12]}
        containerPadding={[0, 0]}
        isDraggable={editable}
        isResizable={editable}
        resizeHandles={editable ? ['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne'] : []}
        compactType="vertical"
        onLayoutChange={onLayoutChange}
        draggableHandle=".drag-handle"
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
              <h4 className="text-[11px] sm:text-sm font-medium text-slate-200 flex-1 truncate">{widget.title}</h4>
              
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

            {/* Fullscreen via portal — avoids transform/overflow parents breaking fixed positioning */}
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
              <div className="flex-1 min-h-0 p-2 sm:p-4 overflow-auto">
                <LiveWidget
                  widget={expandedWidget}
                  editable={false}
                  globalFilters={globalFilters}
                  refreshToken={refreshTokens[expandedWidget.id]}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
      
      {/* Task 8: Unsaved changes warning dialog */}
      {showUnsavedDialog &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[2147481600] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setShowUnsavedDialog(false)} />
            <div className="relative bg-slate-900 border border-emerald-600/30 rounded-xl shadow-2xl p-6 max-w-sm animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-8 bg-emerald-500 rounded-full"></div>
                <h3 className="text-lg font-bold text-white">Saklanmadyk üýtgetmeler</h3>
              </div>
              <p className="text-slate-300 mb-6 text-sm">
                Widget tertiplemelerinde üýtgetmeler boldy. Ýokarda "<strong>↶ Undo</strong>" iconuna basyp undo edip bilärsiňiz ýa-da aşakdaky dülkemelerden saýlanyp bilärsiňiz:
              </p>
              
              <div className="space-y-3">
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnsavedDialog(false);
                      setPendingAction(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition text-sm"
                  >
                    ✕ Ýap
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnsavedDialog(false);
                      setHasUnsavedChanges(false);
                      setPendingAction(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium transition text-sm"
                  >
                    ↻ Üýtget
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnsavedDialog(false);
                      setHasUnsavedChanges(false);
                      if (pendingAction) pendingAction();
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition text-sm flex items-center gap-1"
                  >
                    💾 Sakla
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
