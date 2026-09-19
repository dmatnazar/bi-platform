'use client';

import { useLocale } from '@/components/LocaleProvider';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  compact?: boolean;
};

export function LanguageToggle({ className, compact }: Props) {
  const { locale, toggleLocale, t } = useLocale();

  return (
    <button
      type="button"
      onClick={() => toggleLocale()}
      title={t('langSwitch')}
      aria-label={t('langSwitch')}
      className={cn(
        'inline-flex items-center justify-center rounded-full border transition-colors font-bold tracking-wide',
        compact
          ? 'h-9 w-9 border-slate-700 bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white text-[11px] p-2'
          : 'gap-2 px-3 py-2 text-sm rounded-xl border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-white',
        className
      )}
    >
      {locale === 'tm' ? 'RU' : 'TM'}
    </button>
  );
}
