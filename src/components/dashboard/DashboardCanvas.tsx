'use client';

import { useCallback, useState, useEffect } from 'react';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { Dashboard, DashboardWidget, GlobalFilterValues } from '@/lib/types';
import { LiveWidget } from './LiveWidget';
import { cn } from '@/lib/utils';
import { GripVertical, Trash2, Settings2, RefreshCw, Maximize2, X, ChevronUp, ChevronDown } from 'lucide-react';

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

  // On small phones, a 12-col desktop grid squeezes every widget into an
  // unreadably thin sliver. Force a single full-width column instead —
  // widgets simply stack in their existing top-to-bottom order — while
  // keeping the original desktop x/y/w/h untouched in `dashboard.widgets`
  // so switching back to a bigger screen (or editing on desktop) is unaffected.
  const mobileLayout: Layout[] = [...dashboard.widgets]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((w) => ({
      i: w.id,
      x: 0,
      y: 0, // vertical compaction stacks these in array order automatically
      w: 1,
      h: Math.max(w.h, 5),
      minW: 1,
      minH: 3,
    }));

  const effectiveCols = isMobile ? 1 : cols;
  const effectiveLayout = isMobile ? mobileLayout : layout;

  function onLayoutChange(next: Layout[]) {
    // Never persist the forced single-column mobile layout back onto the
    // dashboard — only real (desktop) drag/resize edits should be saved.
    if (!editable || !onChange || isMobile) return;
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

  // Touch dragging on a forced single-column mobile grid is fiddly, so
  // reordering on mobile is done with simple up/down buttons instead —
  // swapping x/y with the neighbor keeps desktop layout consistent too.
  function moveWidgetMobile(id: string, dir: -1 | 1) {
    if (!onChange) return;
    const ordered = [...dashboard.widgets].sort((a, b) => a.y - b.y || a.x - b.x);
    const idx = ordered.findIndex((w) => w.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;
    const a = ordered[idx];
    const b = ordered[swapIdx];
    const widgets = dashboard.widgets.map((w) => {
      if (w.id === a.id) return { ...w, x: b.x, y: b.y };
      if (w.id === b.id) return { ...w, x: a.x, y: a.y };
      return w;
    });
    onChange(widgets);
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
        isDraggable={editable && !isMobile}
        isResizable={editable && !isMobile}
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
              {editable && !isMobile && (
                <button
                  type="button"
                  className="drag-handle cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 p-0.5"
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

      {/* Fullscreen widget view — full-height/width on mobile, large centered panel on desktop */}
      {expandedWidget && (
        <div className="fixed inset-0 z-[200] flex items-stretch sm:items-center justify-center sm:p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setExpandedId(null)} />
          <div className="relative w-full h-full sm:h-[85vh] sm:max-w-6xl rounded-none sm:rounded-2xl border-0 sm:border border-slate-700 bg-slate-950 shadow-2xl flex flex-col overflow-hidden z-10">
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-800 shrink-0">
              <h3 className="text-sm sm:text-base font-semibold text-white flex-1 truncate">
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
              <button
                type="button"
                onClick={() => setExpandedId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                title="Ýap"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 p-2 sm:p-4">
              <LiveWidget
                widget={expandedWidget}
                editable={false}
                globalFilters={globalFilters}
                refreshToken={refreshTokens[expandedWidget.id]}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
