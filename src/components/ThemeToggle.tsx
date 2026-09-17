'use client';

import { type MouseEvent } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  compact?: boolean;
};

export function ThemeToggle({ className, compact }: Props) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  function onClick(e: MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    toggleTheme({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={isLight ? 'Garaňky tema' : 'Ýagty tema'}
      aria-label={isLight ? 'Garaňky tema' : 'Ýagty tema'}
      className={cn(
        'inline-flex items-center justify-center rounded-full border transition-colors',
        compact
          ? 'h-9 w-9 border-slate-700 bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white p-2'
          : 'gap-2 px-3 py-2 text-sm rounded-xl border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-white',
        className
      )}
    >
      {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      {!compact && <span>{isLight ? 'Garaňky' : 'Ýagty'}</span>}
    </button>
  );
}
