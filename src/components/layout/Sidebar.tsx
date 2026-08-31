'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  LogOut,
  Menu,
  X,
  BarChart3,
  Network,
  Settings,
  UserCircle,
  Server,
  Database,
  Wallet,
  AppWindow,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/types';
import { canManageStaff, canManageCompany, isSuperAdmin, isViewerOnly } from '@/lib/auth-client';
import { BalanceBadge } from '@/components/billing/BalanceBadge';

interface Props {
  user: SessionUser;
}

type NavBadges = {
  devicesPending?: number;
  staffPending?: number;
  billingEmpty?: number;
};

export function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [badges, setBadges] = useState<NavBadges>({});

  const loadBadges = useCallback(async () => {
    try {
      const res = await fetch('/api/nav-badges');
      if (!res.ok) return;
      const data = await res.json();
      setBadges({
        devicesPending: Number(data.devicesPending) || 0,
        staffPending: Number(data.staffPending) || 0,
        billingEmpty: Number(data.billingEmpty) || 0,
      });
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    void loadBadges();
    const t = setInterval(() => void loadBadges(), 20000);
    return () => clearInterval(t);
  }, [loadBadges]);

  const nav: {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number;
  }[] = [
    { href: '/dashboards', label: 'Dashboardlar', icon: LayoutDashboard },
    ...(!isViewerOnly(user.role)
      ? [
          ...(canManageStaff(user.role)
            ? [
                {
                  href: '/admin/staff',
                  label: 'Işgärler',
                  icon: Users,
                  badge: badges.staffPending,
                },
              ]
            : []),
          ...(isSuperAdmin(user)
            ? [{ href: '/admin/companies', label: 'Ähli firmalar', icon: Building2 }]
            : []),
          ...(isSuperAdmin(user)
            ? [
                {
                  href: '/admin/billing',
                  label: 'Tarif & Balans',
                  icon: Wallet,
                  badge: badges.billingEmpty,
                },
              ]
            : []),
          ...(isSuperAdmin(user) || canManageCompany(user.role)
            ? [
                {
                  href: '/admin/devices',
                  label: 'Enjamlar',
                  icon: Server,
                  badge: badges.devicesPending,
                },
              ]
            : []),
          ...(canManageCompany(user.role)
            ? [{ href: '/admin/apis', label: 'API-lar', icon: Network }]
            : []),
          ...(canManageCompany(user.role)
            ? [{ href: '/admin/connections', label: 'DB baglanyşyklar', icon: Database }]
            : []),
          ...(canManageCompany(user.role) || isSuperAdmin(user)
            ? [{ href: '/admin/apps', label: 'Programmalar', icon: AppWindow }]
            : []),
          ...(canManageCompany(user.role) || isSuperAdmin(user)
            ? [{ href: '/admin/settings', label: 'Sazlamalar', icon: Settings }]
            : []),
        ]
      : []),
  ];

  async function logout() {
    await fetch('/api/auth/me', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  }

  function Badge({ n }: { n?: number }) {
    if (!n || n <= 0) return null;
    return (
      <span className="ml-auto min-w-[1.15rem] h-5 px-1.5 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center shadow">
        {n > 99 ? '99+' : n}
      </span>
    );
  }

  const NavContent = (
    <>
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
          <BarChart3 className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-white truncate">
            BI Platform <span className="text-[10px] font-normal text-slate-500">v1.0.0</span>
          </p>
          <p className="text-xs text-slate-500 truncate">{user.companyName || 'Platform'}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {nav.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/dashboards' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-500/15 text-indigo-300'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" />
              <span className="truncate flex-1">{item.label}</span>
              <Badge n={item.badge} />
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3 space-y-2">
        <div className="flex items-center gap-2 px-1">
          <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
            <UserCircle className="h-5 w-5 text-slate-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-200 truncate">
              {user.fullName || user.username}
            </p>
            <p className="text-[10px] text-slate-500 truncate">{user.role}</p>
          </div>
          <BalanceBadge
            compact
            companySlug={user.companySlug}
            username={user.username}
            role={user.role}
          />
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 hover:bg-slate-800 hover:text-rose-300"
        >
          <LogOut className="h-4 w-4" />
          Çykyş
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </button>

      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-950/90 backdrop-blur-xl">
        {NavContent}
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col bg-slate-950 border-r border-slate-800 shadow-2xl">
            <div className="flex justify-end p-2">
              <button type="button" className="p-2 text-slate-400" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {NavContent}
          </aside>
        </div>
      )}
    </>
  );
}
