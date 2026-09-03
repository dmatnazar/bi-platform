'use client';

import { ParticlesBackground } from '@/components/ParticlesBackground';
import { useAppAnimations } from '@/lib/use-app-animations';

export function AppShellBackground() {
  const on = useAppAnimations();
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
  const on = useAppAnimations();
  return <div className={on ? 'animate-fade-in' : undefined}>{children}</div>;
}
