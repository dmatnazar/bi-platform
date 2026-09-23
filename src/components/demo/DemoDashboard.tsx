'use client';

import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Filter, TrendingUp, Users, ShoppingCart, Wallet, LineChart, Table2, X,
  BarChart3, PieChart, Activity, Package, Percent, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/components/LocaleProvider';
import { useTheme } from '@/components/ThemeProvider';

type Period = '7d' | '30d' | '90d' | 'year';

const MONTHS_TM = ['Ýan', 'Few', 'Mar', 'Apr', 'Maý', 'Iýun', 'Iýul', 'Awg', 'Sen', 'Okt', 'Noý', 'Dek'];
const MONTHS_RU = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const FIRMS = [
  { id: 'ashgabat', tm: 'Aşgabat ofis', ru: 'Офис Ашхабад', weight: 0.42 },
  { id: 'balkan', tm: 'Balkan', ru: 'Балкан', weight: 0.18 },
  { id: 'mary', tm: 'Mary', ru: 'Мары', weight: 0.16 },
  { id: 'lebap', tm: 'Lebap', ru: 'Лебап', weight: 0.14 },
  { id: 'dashoguz', tm: 'Daşoguz', ru: 'Дашогуз', weight: 0.1 },
];

function periodMul(period: Period) {
  return period === '7d' ? 0.35 : period === '30d' ? 1 : period === '90d' ? 2.4 : 8;
}
function monthsForPeriod(period: Period) {
  return period === '7d' ? 1 : period === '30d' ? 1 : period === '90d' ? 3 : 12;
}
function fmt(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n));
}

function WidgetShell({
  title,
  icon: Icon,
  children,
  filterSlot,
  className,
}: {
  title: string;
  icon: typeof LineChart;
  children: React.ReactNode;
  filterSlot?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bi-demo-widget bi-chart-in w-full rounded-2xl border border-slate-200 dark:border-slate-700/80',
        'bg-white dark:bg-slate-900/70 shadow-sm dark:shadow-none',
        'p-3 sm:p-4 transition-all duration-300',
        'hover:border-indigo-400/60 dark:hover:border-indigo-500/50 hover:shadow-md',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white truncate">{title}</h3>
        </div>
        {filterSlot}
      </div>
      {children}
    </div>
  );
}

function LocalSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bi-tap h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-[11px] text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function DemoDashboard() {
  const { locale } = useLocale();
  const { theme } = useTheme();
  const isRu = locale === 'ru';
  const isLight = theme === 'light';
  const months = isRu ? MONTHS_RU : MONTHS_TM;

  const [period, setPeriod] = useState<Period>('30d');
  const [selectedFirms, setSelectedFirms] = useState<string[]>([]);
  const [category, setCategory] = useState<'all' | 'retail' | 'wholesale' | 'online'>('all');
  const [firmMenuOpen, setFirmMenuOpen] = useState(false);

  // Per-widget local filters (override global when not "inherit")
  const [linePeriod, setLinePeriod] = useState<Period | 'inherit'>('inherit');
  const [barFirm, setBarFirm] = useState<string>('inherit');
  const [pieCat, setPieCat] = useState<'all' | 'retail' | 'wholesale' | 'online' | 'inherit'>('inherit');
  const [tablePeriod, setTablePeriod] = useState<Period | 'inherit'>('inherit');

  const axisColor = isLight ? '#334155' : '#94a3b8';
  const splitColor = isLight ? '#e2e8f0' : '#1e293b';
  const axisLine = isLight ? '#94a3b8' : '#334155';
  const labelColor = isLight ? '#0f172a' : '#e2e8f0';
  const mutedLabel = isLight ? '#475569' : '#94a3b8';

  const firmMul = useMemo(() => {
    if (!selectedFirms.length) return 1;
    return selectedFirms.reduce((s, id) => s + (FIRMS.find((x) => x.id === id)?.weight || 0), 0);
  }, [selectedFirms]);

  function mulFor(p: Period, firms: string[], cat: typeof category) {
    const pm = periodMul(p);
    const fm = !firms.length
      ? 1
      : firms.reduce((s, id) => s + (FIRMS.find((x) => x.id === id)?.weight || 0), 0);
    const cm = cat === 'all' ? 1 : cat === 'retail' ? 0.45 : cat === 'wholesale' ? 0.35 : 0.2;
    return { pm, fm, cm };
  }

  const globalP = period;
  const effectiveLineP = linePeriod === 'inherit' ? globalP : linePeriod;
  const effectiveTableP = tablePeriod === 'inherit' ? globalP : tablePeriod;
  const effectivePieCat = pieCat === 'inherit' ? category : pieCat;
  const effectiveBarFirms = barFirm === 'inherit' ? selectedFirms : barFirm === 'all' ? [] : [barFirm];

  const { pm: gPm, fm: gFm, cm: gCm } = mulFor(globalP, selectedFirms, category);

  const kpis = useMemo(() => {
    const revenue = 1_240_000 * gPm * gFm * gCm;
    const orders = 18_400 * gPm * gFm * gCm;
    const clients = 3_200 * Math.sqrt(gPm) * gFm * (category === 'online' ? 1.2 : 1);
    const avgCheck = revenue / Math.max(orders, 1);
    return [
      { label: isRu ? 'Выручка' : 'Girdeji', value: fmt(revenue) + ' TMT', delta: '+12.4%', icon: Wallet },
      { label: isRu ? 'Заказы' : 'Sargytlar', value: fmt(orders), delta: '+8.1%', icon: ShoppingCart },
      { label: isRu ? 'Клиенты' : 'Müşderiler', value: fmt(clients), delta: '+5.6%', icon: Users },
      { label: isRu ? 'Средний чек' : 'Ortaça çek', value: fmt(avgCheck) + ' TMT', delta: '+3.2%', icon: TrendingUp },
      { label: isRu ? 'Склад' : 'Ammar', value: fmt(8400 * gFm), delta: '-2.1%', icon: Package },
      { label: isRu ? 'Маржа %' : 'Marja %', value: (18.4 + gFm * 2).toFixed(1) + '%', delta: '+0.8%', icon: Percent },
    ];
  }, [gPm, gFm, gCm, category, isRu]);

  function seriesFor(p: Period, firms: string[], cat: typeof category) {
    const { pm, fm, cm } = mulFor(p, firms, cat);
    const mc = monthsForPeriod(p);
    const base = [420, 380, 510, 460, 590, 640, 610, 720, 680, 750, 810, 890];
    const slice = base.slice(-mc);
    const labels = months.slice(-mc);
    return slice.map((v, i) => ({
      name: labels[i] || String(i + 1),
      value: Math.round(v * pm * fm * cm * (0.85 + (i % 5) * 0.04)),
      value2: Math.round(v * pm * fm * cm * 0.55),
    }));
  }

  const salesLine = useMemo(() => seriesFor(effectiveLineP, selectedFirms, category), [effectiveLineP, selectedFirms, category, months]);
  const salesTable = useMemo(() => seriesFor(effectiveTableP, selectedFirms, category), [effectiveTableP, selectedFirms, category, months]);

  const regionBars = useMemo(() => {
    const { pm, cm } = mulFor(globalP, effectiveBarFirms, category);
    return FIRMS.filter((f) => !effectiveBarFirms.length || effectiveBarFirms.includes(f.id)).map((f) => ({
      name: isRu ? f.ru : f.tm,
      value: Math.round(420 * f.weight * pm * cm * 10),
      orders: Math.round(80 * f.weight * pm * cm * 10),
    }));
  }, [effectiveBarFirms, globalP, category, isRu]);

  const categoryPie = useMemo(() => {
    const items = [
      { name: isRu ? 'Розница' : 'Bölek', v: 42, id: 'retail' },
      { name: isRu ? 'Опт' : 'Topdan', v: 33, id: 'wholesale' },
      { name: isRu ? 'Онлайн' : 'Online', v: 25, id: 'online' },
    ];
    if (effectivePieCat !== 'all') return items.filter((x) => x.id === effectivePieCat).map((x) => ({ name: x.name, v: 100 }));
    return items.map((x) => ({ name: x.name, v: Math.round(x.v * gFm * 10) / 10 }));
  }, [effectivePieCat, gFm, isRu]);

  const tableRows = useMemo(
    () =>
      regionBars.map((r, i) => ({
        firm: r.name,
        sales: r.value,
        orders: r.orders,
        avg: Math.round(r.value / Math.max(r.orders, 1)),
        share: ((r.value / Math.max(1, regionBars.reduce((s, x) => s + x.value, 0))) * 100).toFixed(1) + '%',
        status: i % 3 === 0 ? (isRu ? 'Рост' : 'Ösüş') : i % 3 === 1 ? (isRu ? 'Стабильно' : 'Durnukly') : isRu ? 'Спад' : 'Peseliş',
      })),
    [regionBars, isRu]
  );

  const hierarchyRows = useMemo(() => {
    const cats = [
      { cat: isRu ? 'Розница' : 'Bölek', kids: isRu ? ['Продукты', 'Одежда', 'Электроника'] : ['Azyk', 'Egin-eşik', 'Elektronika'] },
      { cat: isRu ? 'Опт' : 'Topdan', kids: isRu ? ['Склад A', 'Склад B'] : ['Ammar A', 'Ammar B'] },
      { cat: isRu ? 'Онлайн' : 'Online', kids: isRu ? ['Мобильное', 'Веб'] : ['Mobil', 'Web'] },
    ];
    const out: { level: number; name: string; value: number }[] = [];
    cats.forEach((c, ci) => {
      const parentV = Math.round(300 * gPm * gFm * (0.4 + ci * 0.15));
      out.push({ level: 0, name: c.cat, value: parentV });
      c.kids.forEach((k, ki) => out.push({ level: 1, name: k, value: Math.round(parentV * (0.25 + ki * 0.15)) }));
    });
    return out;
  }, [gPm, gFm, isRu]);

  const baseChart = useMemo(
    () => ({
      backgroundColor: 'transparent',
      textStyle: { color: labelColor },
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: isLight ? 'rgba(255,255,255,0.98)' : 'rgba(15,23,42,0.95)',
        borderColor: isLight ? '#cbd5e1' : '#334155',
        textStyle: { color: labelColor, fontSize: 12 },
      },
    }),
    [isLight, labelColor]
  );

  function lineOpt(data: { name: string; value: number; value2?: number }[], dual = false) {
    return {
      ...baseChart,
      grid: { left: 48, right: 20, top: dual ? 40 : 28, bottom: 32 },
      legend: dual
        ? { data: [isRu ? 'Продажи' : 'Satuw', isRu ? 'Возврат' : 'Yzyna'], textStyle: { color: mutedLabel, fontSize: 11 } }
        : undefined,
      xAxis: {
        type: 'category',
        data: data.map((x) => x.name),
        axisLabel: { color: axisColor, fontSize: 11 },
        axisLine: { lineStyle: { color: axisLine } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: axisColor, fontSize: 11 },
        splitLine: { lineStyle: { color: splitColor } },
      },
      series: dual
        ? [
            { name: isRu ? 'Продажи' : 'Satuw', type: 'line', smooth: true, data: data.map((x) => x.value), lineStyle: { color: '#6366f1', width: 2.5 }, itemStyle: { color: '#6366f1' }, areaStyle: { color: isLight ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.15)' } },
            { name: isRu ? 'Возврат' : 'Yzyna', type: 'line', smooth: true, data: data.map((x) => x.value2 || 0), lineStyle: { color: '#f43f5e', width: 2 }, itemStyle: { color: '#f43f5e' } },
          ]
        : [
            {
              type: 'line',
              smooth: true,
              data: data.map((x) => x.value),
              areaStyle: { color: isLight ? 'rgba(79,70,229,0.12)' : 'rgba(99,102,241,0.18)' },
              lineStyle: { color: '#6366f1', width: 2.5 },
              itemStyle: { color: '#6366f1' },
            },
          ],
    };
  }

  const pieOpt = useMemo(
    () => ({
      ...baseChart,
      tooltip: { trigger: 'item', textStyle: { color: labelColor } },
      series: [
        {
          type: 'pie',
          radius: ['40%', '68%'],
          center: ['50%', '52%'],
          label: { color: labelColor, fontSize: 12, fontWeight: 600 },
          labelLine: { lineStyle: { color: axisColor } },
          data: categoryPie.map((x) => ({ name: x.name, value: x.v })),
          color: ['#6366f1', '#22d3ee', '#f59e0b'],
        },
      ],
    }),
    [categoryPie, baseChart, labelColor, axisColor]
  );

  const pieDonutOpt = useMemo(
    () => ({
      ...baseChart,
      tooltip: { trigger: 'item', textStyle: { color: labelColor } },
      series: [
        {
          type: 'pie',
          radius: ['48%', '72%'],
          center: ['50%', '52%'],
          label: { color: labelColor, fontSize: 11, fontWeight: 600 },
          data: FIRMS.filter((f) => !selectedFirms.length || selectedFirms.includes(f.id)).map((f) => ({
            name: isRu ? f.ru : f.tm,
            value: Math.round(f.weight * 1000 * gPm * gCm),
          })),
          color: ['#6366f1', '#06b6d4', '#a855f7', '#f59e0b', '#22c55e'],
        },
      ],
    }),
    [selectedFirms, gPm, gCm, isRu, baseChart, labelColor]
  );

  const pieRoseOpt = useMemo(
    () => ({
      ...baseChart,
      tooltip: { trigger: 'item', textStyle: { color: labelColor } },
      series: [
        {
          type: 'pie',
          roseType: 'area',
          radius: ['18%', '70%'],
          center: ['50%', '52%'],
          label: { color: labelColor, fontSize: 11, fontWeight: 600 },
          data: [
            { name: isRu ? 'Новые' : 'Täze', value: Math.round(40 * gPm * gFm) },
            { name: isRu ? 'Повтор' : 'Gaýtalanan', value: Math.round(28 * gPm * gFm) },
            { name: isRu ? 'VIP' : 'VIP', value: Math.round(18 * gPm * gFm) },
            { name: isRu ? 'Спящие' : 'Ukuda', value: Math.round(14 * gPm * gFm) },
          ],
          color: ['#6366f1', '#22d3ee', '#f59e0b', '#94a3b8'],
        },
      ],
    }),
    [gPm, gFm, isRu, baseChart, labelColor]
  );

  const barOpt = useMemo(
    () => ({
      ...baseChart,
      grid: { left: 52, right: 16, top: 24, bottom: 48 },
      xAxis: {
        type: 'category',
        data: regionBars.map((x) => x.name),
        axisLabel: { color: axisColor, fontSize: 11, rotate: regionBars.length > 3 ? 15 : 0 },
        axisLine: { lineStyle: { color: axisLine } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: axisColor, fontSize: 11 },
        splitLine: { lineStyle: { color: splitColor } },
      },
      series: [
        {
          type: 'bar',
          data: regionBars.map((x) => x.value),
          itemStyle: { color: '#22d3ee', borderRadius: [8, 8, 0, 0] },
          barMaxWidth: 48,
          label: { show: true, position: 'top', color: mutedLabel, fontSize: 11, fontWeight: 600 },
        },
      ],
    }),
    [regionBars, baseChart, axisColor, axisLine, splitColor, mutedLabel]
  );

  const barHorizOpt = useMemo(
    () => ({
      ...baseChart,
      grid: { left: 100, right: 36, top: 16, bottom: 28 },
      xAxis: {
        type: 'value',
        axisLabel: { color: axisColor, fontSize: 11 },
        splitLine: { lineStyle: { color: splitColor } },
      },
      yAxis: {
        type: 'category',
        data: regionBars.map((x) => x.name),
        axisLabel: { color: labelColor, fontSize: 12, fontWeight: 600 },
        axisLine: { lineStyle: { color: axisLine } },
      },
      series: [
        {
          type: 'bar',
          data: regionBars.map((x) => x.value),
          itemStyle: { color: '#a855f7', borderRadius: [0, 8, 8, 0] },
          barMaxWidth: 28,
          label: { show: true, position: 'right', color: mutedLabel, fontSize: 11, fontWeight: 600 },
        },
      ],
    }),
    [regionBars, baseChart, axisColor, axisLine, splitColor, labelColor, mutedLabel]
  );

  const barStackOpt = useMemo(() => {
    const data = salesLine;
    return {
      ...baseChart,
      grid: { left: 48, right: 16, top: 40, bottom: 32 },
      legend: {
        data: [isRu ? 'Розница' : 'Bölek', isRu ? 'Опт' : 'Topdan', isRu ? 'Онлайн' : 'Online'],
        textStyle: { color: mutedLabel, fontSize: 11 },
      },
      xAxis: {
        type: 'category',
        data: data.map((x) => x.name),
        axisLabel: { color: axisColor, fontSize: 11 },
        axisLine: { lineStyle: { color: axisLine } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: axisColor, fontSize: 11 },
        splitLine: { lineStyle: { color: splitColor } },
      },
      series: [
        { name: isRu ? 'Розница' : 'Bölek', type: 'bar', stack: 't', data: data.map((x) => Math.round(x.value * 0.45)), itemStyle: { color: '#6366f1' } },
        { name: isRu ? 'Опт' : 'Topdan', type: 'bar', stack: 't', data: data.map((x) => Math.round(x.value * 0.35)), itemStyle: { color: '#22d3ee' } },
        { name: isRu ? 'Онлайн' : 'Online', type: 'bar', stack: 't', data: data.map((x) => Math.round(x.value * 0.2)), itemStyle: { color: '#f59e0b' } },
      ],
    };
  }, [salesLine, baseChart, axisColor, axisLine, splitColor, mutedLabel, isRu]);

  const periods: { id: Period; tm: string; ru: string }[] = [
    { id: '7d', tm: '7 gün', ru: '7 дней' },
    { id: '30d', tm: '30 gün', ru: '30 дней' },
    { id: '90d', tm: '90 gün', ru: '90 дней' },
    { id: 'year', tm: 'Ýyl', ru: 'Год' },
  ];
  const categories: { id: typeof category; tm: string; ru: string }[] = [
    { id: 'all', tm: 'Ähli kategoriýa', ru: 'Все категории' },
    { id: 'retail', tm: 'Bölek', ru: 'Розница' },
    { id: 'wholesale', tm: 'Topdan', ru: 'Опт' },
    { id: 'online', tm: 'Online', ru: 'Онлайн' },
  ];

  function toggleFirm(id: string) {
    setSelectedFirms((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  const firmLabel = !selectedFirms.length
    ? isRu
      ? 'Все компании'
      : 'Ähli firmalar'
    : selectedFirms.length === 1
      ? isRu
        ? FIRMS.find((f) => f.id === selectedFirms[0])?.ru
        : FIRMS.find((f) => f.id === selectedFirms[0])?.tm
      : isRu
        ? `${selectedFirms.length} компании`
        : `${selectedFirms.length} firma`;

  const periodOpts = [
    { id: 'inherit', label: isRu ? 'Глобальный' : 'Global' },
    ...periods.map((x) => ({ id: x.id, label: isRu ? x.ru : x.tm })),
  ];
  const firmOpts = [
    { id: 'inherit', label: isRu ? 'Глобальный' : 'Global' },
    { id: 'all', label: isRu ? 'Все' : 'Ählisi' },
    ...FIRMS.map((f) => ({ id: f.id, label: isRu ? f.ru : f.tm })),
  ];
  const catOpts = [
    { id: 'inherit', label: isRu ? 'Глобальный' : 'Global' },
    ...categories.map((c) => ({ id: c.id, label: isRu ? c.ru : c.tm })),
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Global filters */}
      <div className="bi-filter-bar bi-demo-widget rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/80 backdrop-blur p-3 sm:p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 text-sm font-semibold">
          <Filter className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          {isRu ? 'Глобальные фильтры' : 'Global filtrler'}
        </div>
        <div className="flex flex-wrap gap-2 items-start">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="bi-tap h-9 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            {periods.map((x) => (
              <option key={x.id} value={x.id}>
                {isRu ? x.ru : x.tm}
              </option>
            ))}
          </select>
          <div className="relative">
            <button
              type="button"
              onClick={() => setFirmMenuOpen((v) => !v)}
              className="bi-tap h-9 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200 min-w-[9rem] text-left"
            >
              {firmLabel}
            </button>
            {firmMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFirmMenuOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1 max-h-64 overflow-y-auto">
                  <button
                    type="button"
                    className="bi-tap w-full text-left px-3 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => {
                      setSelectedFirms([]);
                      setFirmMenuOpen(false);
                    }}
                  >
                    {isRu ? 'Все компании' : 'Ähli firmalar'}
                  </button>
                  {FIRMS.map((f) => (
                    <label
                      key={f.id}
                      className="bi-tap flex items-center gap-2 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <input type="checkbox" checked={selectedFirms.includes(f.id)} onChange={() => toggleFirm(f.id)} className="rounded border-slate-400" />
                      {isRu ? f.ru : f.tm}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          {selectedFirms.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedFirms([])}
              className="bi-tap h-9 px-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs inline-flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" />
              {isRu ? 'Сбросить' : 'Arassala'}
            </button>
          )}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="h-9 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            {categories.map((x) => (
              <option key={x.id} value={x.id}>
                {isRu ? x.ru : x.tm}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI row — full width strip */}
      <div className="bi-kpi-scroll sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:gap-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="bi-kpi-card bi-tap bi-demo-widget rounded-2xl border border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-900/60 p-3 sm:p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-400/50"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-400">{k.label}</span>
              <k.icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="mt-1.5 text-lg sm:text-xl font-bold text-slate-900 dark:text-white tabular-nums">{k.value}</p>
            <p className="text-[10px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">{k.delta}</p>
          </div>
        ))}
      </div>

      {/* Each chart = full row (dashboard-like) */}
      <WidgetShell
        title={isRu ? 'Динамика продаж' : 'Satuw dinamikasy'}
        icon={LineChart}
        filterSlot={
          <LocalSelect value={linePeriod} onChange={(v) => setLinePeriod(v as Period | 'inherit')} options={periodOpts} />
        }
      >
        <div className="bi-chart-in"><ReactECharts option={lineOpt(salesLine)} style={{ height: 320 }} opts={{ renderer: 'canvas' }} className="bi-chart-mobile" /></div>
      </WidgetShell>

      <WidgetShell title={isRu ? 'Продажи и возвраты' : 'Satuw we yzyna'} icon={TrendingUp}>
        <div className="bi-chart-in"><ReactECharts option={lineOpt(salesLine, true)} style={{ height: 320 }} opts={{ renderer: 'canvas' }} className="bi-chart-mobile" /></div>
      </WidgetShell>

      <WidgetShell
        title={isRu ? 'По категориям' : 'Kategoriýa boýunça'}
        icon={PieChart}
        filterSlot={<LocalSelect value={pieCat} onChange={(v) => setPieCat(v as typeof pieCat)} options={catOpts} />}
      >
        <div className="bi-chart-in"><ReactECharts option={pieOpt} style={{ height: 340 }} opts={{ renderer: 'canvas' }} className="bi-chart-mobile" /></div>
      </WidgetShell>

      <WidgetShell title={isRu ? 'Доля компаний' : 'Firma paýy'} icon={PieChart}>
        <div className="bi-chart-in"><ReactECharts option={pieDonutOpt} style={{ height: 340 }} opts={{ renderer: 'canvas' }} className="bi-chart-mobile" /></div>
      </WidgetShell>

      <WidgetShell title={isRu ? 'Сегменты клиентов' : 'Müşderi segmentleri'} icon={Users}>
        <div className="bi-chart-in"><ReactECharts option={pieRoseOpt} style={{ height: 340 }} opts={{ renderer: 'canvas' }} className="bi-chart-mobile" /></div>
      </WidgetShell>

      <WidgetShell
        title={isRu ? 'По компаниям' : 'Firma boýunça'}
        icon={BarChart3}
        filterSlot={<LocalSelect value={barFirm} onChange={setBarFirm} options={firmOpts} />}
      >
        <div className="bi-chart-in"><ReactECharts option={barOpt} style={{ height: 340 }} opts={{ renderer: 'canvas' }} className="bi-chart-mobile" /></div>
      </WidgetShell>

      <WidgetShell title={isRu ? 'Горизонтальный рейтинг' : 'Gorizontal reýting'} icon={BarChart3}>
        <div className="bi-chart-in"><ReactECharts option={barHorizOpt} style={{ height: 340 }} opts={{ renderer: 'canvas' }} className="bi-chart-mobile" /></div>
      </WidgetShell>

      <WidgetShell title={isRu ? 'Стек по каналам' : 'Kanal steki'} icon={Layers}>
        <div className="bi-chart-in"><ReactECharts option={barStackOpt} style={{ height: 340 }} opts={{ renderer: 'canvas' }} className="bi-chart-mobile" /></div>
      </WidgetShell>

      <WidgetShell
        title={isRu ? 'Таблица продаж' : 'Satuw tablosy'}
        icon={Table2}
        filterSlot={
          <LocalSelect value={tablePeriod} onChange={(v) => setTablePeriod(v as Period | 'inherit')} options={periodOpts} />
        }
      >
        <div className="bi-table-wrap overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 dark:border-slate-700">
                <th className="py-2.5 pr-3 font-semibold text-slate-700 dark:text-slate-300">{isRu ? 'Компания' : 'Firma'}</th>
                <th className="py-2.5 pr-3 font-semibold text-slate-700 dark:text-slate-300">{isRu ? 'Продажи' : 'Satuw'}</th>
                <th className="py-2.5 pr-3 font-semibold text-slate-700 dark:text-slate-300">{isRu ? 'Заказы' : 'Sargyt'}</th>
                <th className="py-2.5 pr-3 font-semibold text-slate-700 dark:text-slate-300">{isRu ? 'Ср. чек' : 'Ortaça'}</th>
                <th className="py-2.5 font-semibold text-slate-700 dark:text-slate-300">%</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.firm} className="border-b border-slate-100 dark:border-slate-800/80">
                  <td className="py-2.5 pr-3 font-semibold text-slate-900 dark:text-slate-100">{r.firm}</td>
                  <td className="py-2.5 pr-3 tabular-nums font-bold text-slate-900 dark:text-white">{fmt(r.sales)}</td>
                  <td className="py-2.5 pr-3 tabular-nums font-semibold text-slate-800 dark:text-slate-200">{r.orders}</td>
                  <td className="py-2.5 pr-3 tabular-nums font-semibold text-slate-800 dark:text-slate-200">{fmt(r.avg)}</td>
                  <td className="py-2.5 tabular-nums font-semibold text-indigo-700 dark:text-indigo-300">{r.share}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WidgetShell>

      <WidgetShell title={isRu ? 'Иерархия категорий' : 'Kategoriýa heirarhiýasy'} icon={Layers}>
        <div className="space-y-1.5">
          {hierarchyRows.map((r, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center justify-between rounded-xl px-3 py-2 text-sm',
                r.level === 0 ? 'bg-indigo-50 dark:bg-indigo-500/10 font-semibold' : 'bg-slate-50 dark:bg-slate-800/40 ml-5'
              )}
            >
              <span className="text-slate-900 dark:text-slate-100">{r.name}</span>
              <span className="tabular-nums font-bold text-slate-900 dark:text-white">{fmt(r.value)}</span>
            </div>
          ))}
        </div>
      </WidgetShell>

      <WidgetShell title={isRu ? 'Карточки статуса' : 'Status kartlary'} icon={Activity}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {tableRows.map((r) => (
            <div
              key={r.firm}
              className="rounded-xl border border-slate-200 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-950/40 px-3 py-2.5 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{r.firm}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {isRu ? 'Ср. чек' : 'Ortaça'}: <span className="font-bold text-slate-800 dark:text-slate-200">{fmt(r.avg)}</span>
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md',
                  r.status.includes('Рост') || r.status.includes('Ösüş')
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : r.status.includes('Спад') || r.status.includes('Pes')
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300'
                )}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
      </WidgetShell>
    </div>
  );
}
