'use client';

import { useCallback, useState } from 'react';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { Dashboard, DashboardWidget, GlobalFilterValues } from '@/lib/types';
import { LiveWidget } from './LiveWidget';
import { cn } from '@/lib/utils';
import { GripVertical, Trash2, Settings2 } from 'lucide-react';

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
  const [width, setWidth] = useState(1200);

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

  function onLayoutChange(next: Layout[]) {
    if (!editable || !onChange) return;
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

  const isMobile = width < 768;

  if (isMobile && !editable) {
    return (
      <div ref={containerRef} className="w-full space-y-4">
        {dashboard.widgets.map((widget) => {
          const minHeight =
            widget.type === 'kpi'
              ? '140px'
              : widget.type === 'table'
                ? '380px'
                : '300px';

          return (
            <div
              key={widget.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden flex flex-col shadow-sm w-full"
              style={{ minHeight }}
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800/80 shrink-0 bg-slate-950/40">
                <h4 className="text-sm font-medium text-slate-200 flex-1 truncate">
                  {widget.title}
                </h4>
              </div>
              <div className="flex-1 min-h-0 p-3 sm:p-4">
                <LiveWidget
                  widget={widget}
                  editable={false}
                  globalFilters={globalFilters}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <GridLayout
        className="layout"
        layout={layout}
        cols={cols}
        rowHeight={48}
        width={width}
        margin={[12, 12]}
        containerPadding={[0, 0]}
        isDraggable={editable}
        isResizable={editable}
        onLayoutChange={onLayoutChange}
        draggableHandle=".drag-handle"
      >
        {dashboard.widgets.map((widget) => (
          <div
            key={widget.id}
            className={cn(
              'rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden flex flex-col shadow-sm',
              editable && 'hover:border-slate-700'
            )}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/80 shrink-0">
              {editable && (
                <button
                  type="button"
                  className="drag-handle cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 p-0.5"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              )}
              <h4 className="text-sm font-medium text-slate-200 flex-1 truncate">{widget.title}</h4>
              {editable && (
                <div className="flex items-center gap-0.5 shrink-0">
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
                </div>
              )}
            </div>
            <div className="flex-1 min-h-0 p-3">
              <LiveWidget
                widget={widget}
                editable={editable}
                onConfigure={() => onConfigureWidget?.(widget.id)}
                globalFilters={globalFilters}
              />
            </div>
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
