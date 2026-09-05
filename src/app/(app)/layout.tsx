import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Providers } from '@/components/Providers';
import { SupportFab } from '@/components/support/SupportFab';
import { ConnectionStatusBar } from '@/components/layout/ConnectionStatusBar';
import { AppShellBackground, AppPageMotion } from '@/components/layout/AppShellBackground';
import { FullscreenController } from '@/components/layout/FullscreenController';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect('/login');

  const superAdmin = isSuperAdmin(user);

  return (
    <div className="flex min-h-dvh relative overflow-x-hidden">
      <div className="app-particles-wrap" aria-hidden>
        <AppShellBackground />
      </div>
      <div className="relative z-10 flex min-h-0 min-h-dvh w-full">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0 pt-14 lg:pt-0">
        <div className="border-b border-slate-800/80 bg-slate-950/80 px-2 sm:px-6 lg:px-8 sticky top-0 z-20 backdrop-blur">
          <div className="max-w-[1600px] mx-auto w-full">
            <ConnectionStatusBar
              isSuperAdmin={superAdmin}
              companyName={user.companyName || user.companySlug}
            />
          </div>
        </div>
        <div className="p-4 sm:p-6 lg:p-8 pb-4 max-w-[1600px] mx-auto">
          <AppPageMotion>
            <Providers>{children}</Providers>
          </AppPageMotion>
        </div>
      </main>
      <SupportFab />
      <FullscreenController />
      </div>
    </div>
  );
}
