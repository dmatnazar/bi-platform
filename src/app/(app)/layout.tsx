import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Providers } from '@/components/Providers';
import { SupportFab } from '@/components/support/SupportFab';
import { ConnectionStatusBar } from '@/components/layout/ConnectionStatusBar';
import { ParticlesBackground } from '@/components/ParticlesBackground';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect('/login');

  const superAdmin = isSuperAdmin(user);

  return (
    <div className="flex min-h-dvh relative">
      <div className="app-particles-wrap" aria-hidden>
        <div className="login-orb login-orb-a" />
        <div className="login-orb login-orb-b" />
        <div className="login-orb login-orb-c" />
        <ParticlesBackground theme="subtle" className="absolute inset-0 z-[1]" />
        <div className="absolute inset-0 z-[2] bg-[radial-gradient(ellipse_at_center,transparent_10%,rgb(2_6_23)_88%)]" />
      </div>
      <div className="relative z-10 flex min-h-dvh w-full">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0 pt-14 lg:pt-0">
        <div className="border-b border-slate-800/80 bg-slate-950/80 px-4 sm:px-6 lg:px-8 sticky top-0 z-20 backdrop-blur">
          <div className="max-w-[1600px] mx-auto">
            <ConnectionStatusBar
              isSuperAdmin={superAdmin}
              companyName={user.companyName || user.companySlug}
            />
          </div>
        </div>
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in">
          <Providers>{children}</Providers>
        </div>
      </main>
      <SupportFab />
      </div>
    </div>
  );
}
