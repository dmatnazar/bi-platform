'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'dark' | 'light';

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode, opts?: { x?: number; y?: number }) => void;
  toggleTheme: (opts?: { x?: number; y?: number }) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'bi-theme';

function applyThemeClass(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(mode);
  root.style.colorScheme = mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', mode === 'light' ? '#f8fafc' : '#020617');
  }
}

function readStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* */
  }
  return 'dark';
}

function isMobileUi(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(max-width: 768px)').matches ||
    window.matchMedia('(pointer: coarse)').matches
  );
}

function runCircleTransition(next: ThemeMode, x: number, y: number) {
  const root = document.documentElement;
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  const cx = Math.max(0, Math.min(w, x));
  const cy = Math.max(0, Math.min(h, y));
  root.style.setProperty('--theme-x', `${cx}px`);
  root.style.setProperty('--theme-y', `${cy}px`);

  const apply = () => applyThemeClass(next);

  // Mobile: derrew tema (gara ekran galmaz). Animasiýa ýok — diňe class.
  if (isMobileUi()) {
    apply();
    return;
  }

  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };
  if (typeof doc.startViewTransition === 'function') {
    try {
      root.classList.add('theme-transitioning');
      const t = doc.startViewTransition(apply);
      t.finished.finally(() => root.classList.remove('theme-transitioning'));
      return;
    } catch {
      /* fall through */
    }
  }

  // Desktop fallback: circle overlay — theme mid-way, then fade out overlay
  const overlay = document.createElement('div');
  overlay.className = 'theme-circle-overlay';
  overlay.style.setProperty('--theme-x', `${cx}px`);
  overlay.style.setProperty('--theme-y', `${cy}px`);
  overlay.style.background = next === 'light' ? '#f8fafc' : '#020617';
  root.classList.add('theme-transitioning');
  document.body.appendChild(overlay);
  void overlay.offsetWidth;
  requestAnimationFrame(() => {
    overlay.classList.add('theme-circle-overlay--expand');
  });
  window.setTimeout(apply, 50);
  // Expand ~1.2s, then fade 0.25s so black lag ýok
  window.setTimeout(() => {
    overlay.classList.add('theme-circle-overlay--fade');
  }, 1100);
  window.setTimeout(() => {
    overlay.remove();
    root.classList.remove('theme-transitioning');
  }, 1400);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    const initial = readStoredTheme();
    setThemeState(initial);
    applyThemeClass(initial);
  }, []);

  const setTheme = useCallback((mode: ThemeMode, opts?: { x?: number; y?: number }) => {
    setThemeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* */
    }
    const x = opts?.x ?? (typeof window !== 'undefined' ? window.innerWidth - 40 : 0);
    const y = opts?.y ?? 40;
    if (typeof document !== 'undefined') {
      runCircleTransition(mode, x, y);
    } else {
      applyThemeClass(mode);
    }
  }, []);

  const toggleTheme = useCallback(
    (opts?: { x?: number; y?: number }) => {
      setTheme(theme === 'dark' ? 'light' : 'dark', opts);
    },
    [setTheme, theme]
  );

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: 'dark' as ThemeMode,
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}
