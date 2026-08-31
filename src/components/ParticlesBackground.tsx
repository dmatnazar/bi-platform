'use client';

import { useEffect, useId, useRef } from 'react';

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
      // CDN fallback if local vendor missing
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

function optionsFor(theme: Theme) {
  const base = {
    fullScreen: { enable: false },
    background: { color: { value: 'transparent' } },
    fpsLimit: 60,
    detectRetina: true,
    interactivity: {
      events: {
        onHover: { enable: true, mode: 'grab' },
        onClick: { enable: true, mode: 'push' },
        resize: true as const,
      },
      modes: {
        grab: { distance: 140, links: { opacity: 0.35 } },
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
        number: { value: mobile ? 45 : 90, density: { enable: true, area: mobile ? 600 : 800 } },
        color: { value: ['#818cf8', '#a78bfa', '#38bdf8', '#c4b5fd', '#6366f1'] },
        shape: { type: ['circle', 'triangle', 'edge'] },
        opacity: { value: { min: mobile ? 0.25 : 0.2, max: mobile ? 0.75 : 0.6 } },
        size: { value: { min: mobile ? 1.5 : 1, max: mobile ? 4.5 : 4 } },
        links: {
          enable: true,
          distance: mobile ? 110 : 140,
          color: '#818cf8',
          opacity: mobile ? 0.35 : 0.28,
          width: mobile ? 1.2 : 1,
        },
        move: {
          enable: true,
          speed: mobile ? 0.9 : 1.2,
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
        number: { value: 35, density: { enable: true, area: 1000 } },
        color: { value: ['#6366f1', '#22d3ee', '#a78bfa'] },
        shape: { type: ['circle', 'edge'] },
        opacity: { value: { min: 0.08, max: 0.35 } },
        size: { value: { min: 1, max: 3 } },
        links: {
          enable: true,
          distance: 120,
          color: '#475569',
          opacity: 0.15,
          width: 1,
        },
        move: {
          enable: true,
          speed: 0.6,
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

  // subtle
  return {
    ...base,
    particles: {
      number: { value: 22, density: { enable: true, area: 1100 } },
      color: { value: '#64748b' },
      shape: { type: 'circle' },
      opacity: { value: { min: 0.05, max: 0.2 } },
      size: { value: { min: 1, max: 2.5 } },
      links: {
        enable: true,
        distance: 110,
        color: '#334155',
        opacity: 0.12,
        width: 1,
      },
      move: {
        enable: true,
        speed: 0.4,
        outModes: { default: 'out' },
      },
    },
  };
}

/**
 * Network / analytics style particle field (tsParticles slim via CDN).
 * Themes: login (vivid), dashboard (chart-like links), subtle.
 */
export function ParticlesBackground({ theme = 'login', className }: Props) {
  const reactId = useId().replace(/:/g, '');
  const id = `tsp-${theme}-${reactId}`;
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let container: { destroy?: () => void } | null = null;

    (async () => {
      try {
        await loadTsParticles();
        if (cancelled || !window.tsParticles) return;
        container = (await window.tsParticles.load(id, optionsFor(theme))) as {
          destroy?: () => void;
        };
      } catch {
        /* silent — page still works without particles */
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
  }, [id, theme]);

  return (
    <div
      ref={hostRef}
      className={
        className ||
        'pointer-events-none absolute inset-0 -z-0 overflow-hidden [&_canvas]:!h-full [&_canvas]:!w-full'
      }
      aria-hidden
    >
      <div id={id} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
