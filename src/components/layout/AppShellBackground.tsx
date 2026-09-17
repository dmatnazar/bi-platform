'use client';

import { ParticlesBackground } from '@/components/ParticlesBackground';
import { useAppAnimations } from '@/lib/use-app-animations';
import { useTheme } from '@/components/ThemeProvider';

export function AppShellBackground() {
  const on = useAppAnimations();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  if (!on) {
    return (
      <div
        className="absolute inset-0"
        style={{ background: isLight ? '#f1f5f9' : '#020617' }}
        aria-hidden
      />
    );
  }

  return (
    <>
      <div className="login-orb login-orb-a" />
      <div className="login-orb login-orb-b" />
      <div className="login-orb login-orb-c" />
      <ParticlesBackground theme="subtle" className="absolute inset-0 z-[1]" />
      <div
        className="absolute inset-0 z-[2]"
        style={{
          background: isLight
            ? 'radial-gradient(ellipse at center, transparent 10%, rgb(241 245 249) 88%)'
            : 'radial-gradient(ellipse at center, transparent 10%, rgb(2 6 23) 88%)',
        }}
      />
    </>
  );
}

export function AppPageMotion({ children }: { children: React.ReactNode }) {
  const on = useAppAnimations();
  return <div className={on ? 'animate-fade-in' : undefined}>{children}</div>;
}
