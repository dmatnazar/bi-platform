'use client';

import { useEffect, useState } from 'react';
import { ParticlesBackground } from '@/components/ParticlesBackground';

export function AppShellBackground() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = localStorage.getItem('bi-app-animations');
        if (cached === '0') setOn(false);
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
  if (!on) return <div className="absolute inset-0 bg-slate-950" aria-hidden />;
  return (
    <>
      <div className="login-orb login-orb-a" />
      <div className="login-orb login-orb-b" />
      <div className="login-orb login-orb-c" />
      <ParticlesBackground theme="subtle" className="absolute inset-0 z-[1]" />
      <div className="absolute inset-0 z-[2] bg-[radial-gradient(ellipse_at_center,transparent_10%,rgb(2_6_23)_88%)]" />
    </>
  );
}

export function AppPageMotion({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    try {
      const cached = localStorage.getItem('bi-app-animations');
      if (cached === '0') setOn(false);
    } catch {
      /* */
    }
  }, []);
  return <div className={on ? 'animate-fade-in' : undefined}>{children}</div>;
}
