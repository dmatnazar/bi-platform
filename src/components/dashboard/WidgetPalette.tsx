'use client';

import type { WidgetType } from '@/lib/types';
import { useLocale } from '@/components/LocaleProvider';
import {
  BarChart3,
  LineChart,
  PieChart,
  AreaChart,
  Table2,
  Hash,
  Type,
  Sheet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEM_DEFS: { type: WidgetType; labelKey: string; fallback: string; icon: typeof BarChart3 }[] = [
  { type: 'kpi', labelKey: 'kpi', fallback: 'KPI', icon: Hash },
  { type: 'bar', labelKey: 'barChart', fallback: 'Sütün diagramma', icon: BarChart3 },
  { type: 'line', labelKey: 'lineChart', fallback: 'Çyzyk', icon: LineChart },
  { type: 'area', labelKey: 'areaChart', fallback: 'Meýdança', icon: AreaChart },
  { type: 'pie', labelKey: 'pieChart', fallback: 'Tegelek', icon: PieChart },
  { type: 'table', labelKey: 'table', fallback: 'Tablo', icon: Table2 },
  { type: 'pivot', labelKey: 'pivotTable', fallback: 'Svodny tablo', icon: Sheet },
  { type: 'text', labelKey: 'text', fallback: 'Tekst', icon: Type },
];

interface Props {
  onAdd: (type: WidgetType) => void;
}

export function WidgetPalette({ onAdd }: Props) {
  const { t } = useLocale();
  const ITEMS = ITEM_DEFS.map((i) => ({ ...i, label: t(i.labelKey) || i.fallback }));

  return (
    <div className="bi-widget-palette space-y-2">
      <p className="bi-widget-palette-title text-xs font-medium uppercase tracking-wider text-slate-500 px-1">
        {t('addWidget')}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => onAdd(item.type)}
              className={cn(
                'bi-widget-palette-item flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-xs',
                'border-slate-800 bg-slate-900/50 text-slate-300',
                'hover:border-indigo-500/40 hover:bg-indigo-500/5 hover:text-white'
              )}
            >
              <Icon className="bi-widget-palette-icon h-5 w-5 text-indigo-400" />
              <span className="bi-widget-palette-label text-center leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
