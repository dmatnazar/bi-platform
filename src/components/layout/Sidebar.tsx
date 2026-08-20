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
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/types';
import { canManageStaff, canManageCompany, isSuperAdmin, isViewerOnly } from '@/lib/auth-client';

interface Props {
  user: SessionUser;
}

export function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const nav = [
    { href: '/dashboards', label: 'Dashboardlar', icon: LayoutDashboard },
    ...(!isViewerOnly(user.role)
      ? [
          ...(canManageStaff(user.role)
            ? [{ href: '/admin/staff', label: 'Işgärler', icon: Users }]
            : []),
          ...(isSuperAdmin(user)
            ? [{ href: '/admin/companies', label: 'Ähli firmalar', icon: Building2 }]
            : []),
          ...(isSuperAdmin(user) || canManageCompany(user.role)
            ? [{ href: '/admin/devices', label: 'Enjamlar', icon: Server }]
            : []),
          ...(canManageCompany(user.role)
            ? [{ href: '/admin/apis', label: 'API-lar', icon: Network }]
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
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3 space-y-1">
        <Link
          href="/profile"
          onClick={() => setOpen(false)}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
            pathname === '/profile'
              ? 'bg-indigo-500/15 text-indigo-300'
              : 'text-slate-300 hover:bg-slate-800/60'
          )}
        >
          <UserCircle className="h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate text-sm">{user.fullName}</p>
            <p className="text-[11px] text-slate-500 truncate">
              @{user.username} · {user.role}
            </p>
          </div>
        </Link>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 hover:bg-slate-800/60 hover:text-rose-300 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Çykmak
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 bg-slate-950/90 backdrop-blur border-b border-slate-800 flex items-center px-4 gap-3">
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg text-slate-300 hover:bg-slate-800"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-semibold text-sm">BI Platform <span className="text-[10px] font-normal text-slate-500">v1.0.0</span></span>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] h-full bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-3 p-1.5 rounded-lg text-slate-400 hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
            {NavContent}
          </aside>
        </div>
      )}

      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900/50 h-dvh sticky top-0">
        {NavContent}
      </aside>
    </>
  );
}
