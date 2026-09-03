'use client';

import { useEffect, useState } from 'react';

/**
 * Reads the "appAnimations" setting (cached in localStorage, refreshed from
 * /api/settings/public). Same flag AppShellBackground already uses — this
 * hook lets any other in-app component (dashboard list particles, etc.)
 * respect the same toggle instead of always rendering.
 */
export function useAppAnimations(): boolean {
  const [on, setOn] = useState(true);

  useEffect(() => {
    let cancelled = false;
    try {
      const cached = localStorage.getItem('bi-app-animations');
      if (cached === '0') setOn(false);
    } catch {
      /* */
    }
    (async () => {
      try {
        const res = await fetch('/api/settings/public', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && typeof data.appAnimations === 'boolean') {
          setOn(data.appAnimations);
          localStorage.setItem('bi-app-animations', data.appAnimations ? '1' : '0');
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
