'use client';

import { useEffect, useState } from 'react';

/**
 * Reads the "modalAnimations" setting (cached in localStorage, refreshed from
 * /api/settings/public) so any modal/drawer can decide whether to play its
 * open/close transition. Mirrors the pattern used for appAnimations in
 * AppShellBackground.tsx.
 */
export function useModalAnimations(): boolean {
  const [on, setOn] = useState(true);

  useEffect(() => {
    let cancelled = false;
    try {
      const cached = localStorage.getItem('bi-modal-animations');
      if (cached === '0') setOn(false);
    } catch {
      /* */
    }
    (async () => {
      try {
        const res = await fetch('/api/settings/public', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && typeof data.modalAnimations === 'boolean') {
          setOn(data.modalAnimations);
          localStorage.setItem('bi-modal-animations', data.modalAnimations ? '1' : '0');
        }
      } catch {
        /* */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return on;
}

/** className helper: returns the given animation classes only if modal animations are on */
export function modalAnimClass(on: boolean, classes: string): string {
  return on ? classes : '';
}
