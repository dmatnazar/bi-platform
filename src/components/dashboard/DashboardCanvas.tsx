'use client';

import { useCallback, useState, useEffect } from 'react';
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

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.floor(w));
    });
    ro.observe(node);
    setWidth(node.clientWidth);
    return () => ro.disconnect();
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

  // Mobile: single column with stable sequential y (order = mobileOrder or desktop y).
  // Desktop x/y/w/h never overwritten by the forced 1-col view.
  const mobileLayout: Layout[] = (() => {
    const ordered = [...dashboard.widgets].sort((a, b) => {
      const ao = a.mobileOrder ?? a.y;
      const bo = b.mobileOrder ?? b.y;
      if (ao !== bo) return ao - bo;
      return a.x - b.x;
    });
    let y = 0;
    return ordered.map((w) => {
      const h = Math.max(w.mobileH ?? w.h, 4);
      const item: Layout = {
        i: w.id,
        x: 0,
        y,
        w: 1,
        h,
        minW: 1,
        minH: 3,
      };
      y += h;
      return item;
    });
  })();

  const effectiveCols = isMobile ? 1 : cols;
  const effectiveLayout = isMobile ? mobileLayout : layout;

  function onLayoutChange(next: Layout[]) {
    if (!editable || !onChange) return;
    if (isMobile) {
      // Persist only mobileOrder + mobileH — keep desktop grid intact
      const sorted = [...next].sort((a, b) => a.y - b.y || a.x - b.x);
      const widgets = dashboard.widgets.map((w) => {
        const idx = sorted.findIndex((l) => l.i === w.id);
        const l = sorted[idx];
        if (!l) return w;
        return {
          ...w,
          mobileOrder: idx,
          mobileH: Math.max(l.h, 3),
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
    <div ref={containerRef} className="w-full">
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
              <div className="flex items-center gap-0.5 shrink-0">
                {editable && isMobile && (
                  <>
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
                  </>
                )}
                <button
                  type="button"
                  onClick={() => bumpRefresh(widget.id)}
                  className="p-1 rounded-lg text-slate-500 hover:text-sky-300 hover:bg-sky-500/10"
                  title="Täzele"
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
                      className="p-1 rounded-lg text-slate-500 hover:text-sky-300 hover:bg-sky-500/10"
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
                      className="p-1 rounded-lg text-slate-500 hover:text-emerald-300 hover:bg-emerald-500/10"
                      title="PNG ýükle"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setExpandedId(widget.id)}
                  className="p-1 rounded-lg text-slate-500 hover:text-indigo-300 hover:bg-indigo-500/10"
                  title="Doly ekran"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                {editable && (
                  <>
                    <button
                      type="button"
                      onClick={() => onConfigureWidget?.(widget.id)}
                      className="p-1 rounded-lg text-slate-500 hover:text-indigo-300 hover:bg-indigo-500/10"
                      title="Sazla"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeWidget(widget.id)}
                      className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                      title="Poz"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
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
    </div>
  );
}
