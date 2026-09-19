'use client';

import {
  resolveThemeColor,
  setThemeColorSlot,
  themeColorInputValue,
  type ThemeColor,
  type ThemeMode,
} from '@/lib/theme-color';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';
import { useLocale } from '@/components/LocaleProvider';

type Props = {
  label: string;
  value: ThemeColor | undefined;
  onChange: (next: ThemeColor) => void;
  /** Fallbacks per theme when value empty */
  fallbackDark?: string;
  fallbackLight?: string;
  className?: string;
  /** Show only active theme picker (compact) */
  compact?: boolean;
};

export function ThemeColorField({
  label,
  value,
  onChange,
  fallbackDark = '#6366f1',
  fallbackLight = '#4f46e5',
  className,
  compact,
}: Props) {
  const { t } = useLocale();

  const { theme } = useTheme();

  const renderSlot = (mode: ThemeMode, slotLabel: string) => {
    const fb = mode === 'dark' ? fallbackDark : fallbackLight;
    const hex = themeColorInputValue(value, mode, fb);
    const active = theme === mode;
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-2 py-1.5 flex-1 min-w-0',
          active ? 'border-indigo-500/50 bg-slate-900/40' : 'border-slate-800 bg-slate-950/30'
        )}
      >
        <span className="text-[10px] text-slate-500 shrink-0 w-8">{slotLabel}</span>
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(setThemeColorSlot(value, mode, e.target.value))}
          className="h-7 w-9 cursor-pointer rounded border border-slate-700 bg-transparent p-0"
          title={`${label} (${mode})`}
        />
        <input
          type="text"
          value={hex}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (/^#[0-9a-fA-F]{3,8}$/.test(v) || v === '') {
              onChange(setThemeColorSlot(value, mode, v || fb));
            }
          }}
          className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-[11px] font-mono text-slate-200"
          spellCheck={false}
        />
      </div>
    );
  };

  if (compact) {
    const fb = theme === 'dark' ? fallbackDark : fallbackLight;
    const hex = themeColorInputValue(value, theme, fb);
    return (
      <div className={cn('space-y-1', className)}>
        <label className="text-[11px] font-medium text-slate-400">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={hex}
            onChange={(e) => onChange(setThemeColorSlot(value, theme, e.target.value))}
            className="h-8 w-10 cursor-pointer rounded border border-slate-700"
          />
          <input
            type="text"
            value={hex}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (/^#[0-9a-fA-F]{3,8}$/.test(v)) {
                onChange(setThemeColorSlot(value, theme, v));
              }
            }}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs font-mono text-white"
          />
          <span className="text-[10px] text-slate-500 uppercase">{theme}</span>
        </div>
        <p className="text-[10px] text-slate-500">
          Häzirki tema: {theme === 'light' ? t('lightShort') : t('darkShort')} — diňe şu tema üçin saklanýar
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] font-medium text-slate-400">{label}</label>
        <span className="text-[10px] text-slate-500">
          preview:{' '}
          <span
            className="inline-block h-2.5 w-2.5 rounded-full align-middle border border-slate-600"
            style={{
              background: resolveThemeColor(
                value,
                theme,
                theme === 'dark' ? fallbackDark : fallbackLight
              ),
            }}
          />
        </span>
      </div>
      <div className="flex flex-col sm:flex-row gap-1.5">
        {renderSlot('dark', 'Dark')}
        {renderSlot('light', 'Light')}
      </div>
    </div>
  );
}
