'use client';

import { useEffect, useId, useRef } from 'react';
import { useTheme } from '@/components/ThemeProvider';

type Theme = 'login' | 'dashboard' | 'subtle';

interface Props {
  theme?: Theme;
  className?: string;
}

declare global {
  interface Window {
    tsParticles?: {
      load: (id: string, options: unknown) => Promise<unknown>;
    };
  }
}

let loadPromise: Promise<void> | null = null;

function loadTsParticles(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.tsParticles) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-tsparticles]');
    if (existing) {
      const check = setInterval(() => {
        if (window.tsParticles) {
          clearInterval(check);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(check);
        if (window.tsParticles) resolve();
        else reject(new Error('tsParticles timeout'));
      }, 8000);
      return;
    }
    const s = document.createElement('script');
    s.src = '/vendor/tsparticles/tsparticles.slim.bundle.min.js';
    s.async = true;
    s.dataset.tsparticles = '1';
    s.onload = () => resolve();
    s.onerror = () => {
      const s2 = document.createElement('script');
      s2.src = 'https://cdn.jsdelivr.net/npm/tsparticles-slim@2.12.0/tsparticles.slim.bundle.min.js';
      s2.async = true;
      s2.dataset.tsparticles = '1';
      s2.onload = () => resolve();
      s2.onerror = () => reject(new Error('Failed to load tsparticles'));
      document.head.appendChild(s2);
    };
    document.head.appendChild(s);
  });
  return loadPromise;
}

function optionsFor(theme: Theme, mode: 'dark' | 'light') {
  const light = mode === 'light';
  const base = {
    fullScreen: { enable: false, zIndex: 0 },
    background: { color: { value: 'transparent' } },
    fpsLimit: 48,
    detectRetina: true,
    interactivity: {
      events: {
        onHover: { enable: true, mode: 'grab' },
        onClick: { enable: true, mode: 'push' },
        resize: true as const,
      },
      modes: {
        grab: { distance: 140, links: { opacity: light ? 0.45 : 0.35 } },
        push: { quantity: 2 },
      },
    },
  };

  if (theme === 'login') {
    const mobile =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
    return {
      ...base,
      particles: {
        number: { value: mobile ? 80 : 90, density: { enable: true, area: mobile ? 450 : 800 } },
        color: {
          value: light
            ? ['#4f46e5', '#7c3aed', '#0891b2', '#db2777', '#ea580c', '#16a34a', '#2563eb']
            : ['#818cf8', '#c084fc', '#22d3ee', '#f472b6', '#fb923c', '#4ade80', '#60a5fa'],
        },
        shape: { type: ['circle', 'triangle', 'edge'] },
        opacity: {
          value: light
            ? { min: mobile ? 0.35 : 0.25, max: mobile ? 0.75 : 0.55 }
            : { min: mobile ? 0.45 : 0.2, max: mobile ? 0.95 : 0.6 },
        },
        size: { value: { min: mobile ? 2 : 1, max: mobile ? 5.5 : 4 } },
        links: {
          enable: true,
          distance: mobile ? 95 : 140,
          color: light ? '#6366f1' : '#a5b4fc',
          opacity: light ? (mobile ? 0.4 : 0.28) : mobile ? 0.55 : 0.28,
          width: mobile ? 1.4 : 1,
        },
        move: {
          enable: true,
          speed: mobile ? 1.15 : 1.2,
          direction: 'none',
          random: true,
          straight: false,
          outModes: { default: 'out' },
        },
      },
    };
  }

  if (theme === 'dashboard') {
    return {
      ...base,
      particles: {
        number: { value: light ? 48 : 35, density: { enable: true, area: 900 } },
        color: {
          value: light
            ? ['#4f46e5', '#0891b2', '#7c3aed', '#db2777', '#16a34a']
            : ['#818cf8', '#22d3ee', '#c084fc', '#f472b6', '#4ade80'],
        },
        shape: { type: ['circle', 'edge'] },
        opacity: { value: { min: light ? 0.28 : 0.08, max: light ? 0.65 : 0.35 } },
        size: { value: { min: light ? 1.5 : 1, max: light ? 3.5 : 3 } },
        links: {
          enable: true,
          distance: 120,
          color: light ? '#6366f1' : '#475569',
          opacity: light ? 0.35 : 0.15,
          width: 1,
        },
        move: {
          enable: true,
          speed: light ? 0.75 : 0.6,
          direction: 'none',
          random: true,
          outModes: { default: 'out' },
        },
      },
      interactivity: {
        ...base.interactivity,
        events: {
          onHover: { enable: true, mode: 'grab' },
          onClick: { enable: false, mode: 'push' },
          resize: true as const,
        },
      },
    };
  }

  // subtle (app shell) — light: more visible particles
  return {
    ...base,
    particles: {
      number: { value: light ? 42 : 22, density: { enable: true, area: light ? 900 : 1100 } },
      color: {
        value: light
          ? ['#4f46e5', '#0891b2', '#7c3aed', '#db2777', '#16a34a', '#ea580c']
          : ['#818cf8', '#22d3ee', '#c084fc', '#fb7185', '#4ade80'],
      },
      shape: { type: 'circle' },
      opacity: { value: { min: light ? 0.35 : 0.12, max: light ? 0.7 : 0.35 } },
      size: { value: { min: light ? 1.5 : 1, max: light ? 3.5 : 2.5 } },
      links: {
        enable: true,
        distance: light ? 130 : 110,
        color: light ? '#6366f1' : '#64748b',
        opacity: light ? 0.4 : 0.18,
        width: light ? 1.2 : 1,
      },
      move: {
        enable: true,
        speed: light ? 0.55 : 0.4,
        outModes: { default: 'out' },
      },
    },
  };
}

export function ParticlesBackground({ theme = 'login', className }: Props) {
  const { theme: colorMode } = useTheme();
  const reactId = useId().replace(/:/g, '');
  const id = `tsp-${theme}-${colorMode}-${reactId}`;
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let container: { destroy?: () => void } | null = null;

    (async () => {
      try {
        await loadTsParticles();
        if (cancelled || !window.tsParticles) return;
        container = (await window.tsParticles.load(id, optionsFor(theme, colorMode))) as {
          destroy?: () => void;
        };
      } catch {
        /* silent */
      }
    })();

    return () => {
      cancelled = true;
      try {
        container?.destroy?.();
      } catch {
        /* */
      }
    };
  }, [id, theme, colorMode]);

  return (
    <div
      ref={hostRef}
      className={
        className ||
        'pointer-events-none absolute inset-0 -z-0 overflow-hidden'
      }
      style={{ contain: 'strict' }}
      aria-hidden
    >
      <div
        id={id}
        className="absolute inset-0 h-full w-full max-h-full max-w-full overflow-hidden [&_canvas]:!absolute [&_canvas]:!inset-0 [&_canvas]:!h-full [&_canvas]:!w-full [&_canvas]:!max-h-full"
      />
    </div>
  );
}
