'use client';

import type { WidgetType } from '@/lib/types';
import {
  BarChart3,
  LineChart,
  PieChart,
  AreaChart,
  Table2,
  Hash,
  Type,
} from 'lucide-react';

const ITEMS: { type: WidgetType; label: string; icon: typeof BarChart3 }[] = [
  { type: 'kpi', label: 'KPI', icon: Hash },
  { type: 'bar', label: 'Sütün diagramma', icon: BarChart3 },
  { type: 'line', label: 'Çyzyk', icon: LineChart },
  { type: 'area', label: 'Meýdança', icon: AreaChart },
  { type: 'pie', label: 'Tegelek', icon: PieChart },
  { type: 'table', label: 'Tablo', icon: Table2 },
  { type: 'text', label: 'Tekst', icon: Type },
];

interface Props {
  onAdd: (type: WidgetType) => void;
}

export function WidgetPalette({ onAdd }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500 px-1">
        Widget goş
      </p>
      <div className="grid grid-cols-2 gap-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => onAdd(item.type)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-indigo-500/40 hover:bg-indigo-500/5 text-slate-300 hover:text-white transition-all text-xs"
            >
              <Icon className="h-5 w-5 text-indigo-400" />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
