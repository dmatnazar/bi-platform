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
  ChevronLeft,
  BarChart3,
  Network,
  Settings,
  UserCircle,
  Server,
  Database,
  Wallet,
  AppWindow,
  Loader2,
  Newspaper,
  Headphones,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ProfilePanel } from '@/components/profile/ProfilePanel';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/types';
import {
  canManageStaff,
  isSuperAdmin,
  isViewerOnly,
  isEditor,
  isAdmin,
  canManageDevices,
  canManageApis,
  canManageConnections,
  canManageApps,
  canManageSettings,
  canManageBilling,
  canManageCompanies,
} from '@/lib/auth-client';
import { BalanceBadge } from '@/components/billing/BalanceBadge';
import { useLocale } from '@/components/LocaleProvider';

interface Props {
  user: SessionUser;
}

type NavBadges = {
  devicesPending?: number;
  staffPending?: number;
  billingEmpty?: number;
  newsUnread?: number;
};

export function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const [navPending, setNavPending] = useState<string | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);

  // Clear pending when route changes
  useEffect(() => {
    setNavPending(null);
  }, [pathname]);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  
  useEffect(() => {
    function onAv(e: Event) {
      const d = (e as CustomEvent).detail || {};
      setAvatarOverride(d.avatarUrl ?? (d.avatarId ? `/avatars/${encodeURIComponent(d.avatarId)}` : null));
    }
    window.addEventListener('bi-avatar-changed', onAv as EventListener);
    const u = user as any;
    if (u?.avatarUrl) setAvatarOverride(u.avatarUrl);
    else if (u?.avatar) setAvatarOverride(`/avatars/${encodeURIComponent(String(u.avatar))}`);
    return () => window.removeEventListener('bi-avatar-changed', onAv as EventListener);
  }, [user]);
  const [badges, setBadges] = useState<NavBadges>({});
  /** Effective permission flags from server matrix (overrides static role defaults) */
  const [permFlags, setPermFlags] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('bi-sidebar-collapsed') === '1');
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/permissions');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.self) {
          setPermFlags(data.self);
        } else if (data.matrix && user.role) {
          setPermFlags(data.matrix[user.role] || null);
        }
      } catch {
        /* keep static fallbacks */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.role]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('bi-sidebar-collapsed', next ? '1' : '0');
      } catch {
        /* */
      }
      return next;
    });
  }, []);

  const loadBadges = useCallback(async () => {
    try {
      const res = await fetch('/api/nav-badges');
      if (res.status === 401) return;
      if (!res.ok) return;
      const data = await res.json();
      setBadges({
        devicesPending: Number(data.devicesPending) || 0,
        staffPending: Number(data.staffPending) || 0,
        billingEmpty: Number(data.billingEmpty) || 0,
        newsUnread: Number(data.newsUnread) || 0,
      });
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    const tick = () => {
      if (!stopped) void loadBadges();
    };
    tick();
    const t = setInterval(tick, 20000);
    const onOut = () => {
      stopped = true;
      clearInterval(t);
    };
    window.addEventListener('bi-logged-out', onOut);
    return () => {
      stopped = true;
      clearInterval(t);
      window.removeEventListener('bi-logged-out', onOut);
    };
  }, [loadBadges]);

  const superA = isSuperAdmin(user);
  // Prefer live matrix flags; fall back to static role helpers
  const p = (key: string, fallback: boolean) =>
    permFlags && typeof permFlags[key] === 'boolean' ? Boolean(permFlags[key]) : fallback;

  const staffOk = p('manage_staff', canManageStaff(user.role));
  const firmsOk = p('manage_companies', canManageCompanies(user) || isEditor(user.role) || isAdmin(user));
  const billingOk = p('manage_billing', canManageBilling(user) || isEditor(user.role) || isAdmin(user));
  const devicesOk = p('manage_devices', canManageDevices(user));
  const apisOk = p('manage_apis', canManageApis(user));
  const connOk = p('manage_connections', canManageConnections(user));
  const appsOk = p('manage_apps', canManageApps(user));
  const settingsOk = p('manage_settings', canManageSettings(user));
  const permissionsOk = p('manage_permissions', superA);
  const demoPageOk = p('manage_demo_page', superA || isAdmin(user));

  const nav: {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number;
  }[] = [
    { href: '/dashboards', label: t('navDashboard'), icon: LayoutDashboard },
    {
      href: '/news',
      label: t('navNews'),
      icon: Newspaper,
      badge: badges.newsUnread,
    },
    { href: '/tech-support', label: t('navSupport'), icon: Headphones },
    ...(staffOk
      ? [
          {
            href: '/admin/staff',
            label: t('navStaff'),
            icon: Users,
            badge: badges.staffPending,
          },
        ]
      : []),
    ...(firmsOk
      ? [{ href: '/admin/companies', label: t('navCompanies'), icon: Building2 }]
      : []),
    ...(billingOk
      ? [
          {
            href: '/admin/billing',
            label: t('navBilling'),
            icon: Wallet,
            badge: badges.billingEmpty,
          },
        ]
      : []),
    ...(devicesOk
      ? [
          {
            href: '/admin/devices',
            label: t('navDevices'),
            icon: Server,
            badge: badges.devicesPending,
          },
        ]
      : []),
    ...(apisOk ? [{ href: '/admin/apis', label: t('navApis'), icon: Network }] : []),
    ...(connOk
      ? [{ href: '/admin/connections', label: t('navConnections'), icon: Database }]
      : []),
    ...(appsOk ? [{ href: '/admin/apps', label: t('navApps'), icon: AppWindow }] : []),
    ...(settingsOk ? [{ href: '/admin/settings', label: t('navSettings'), icon: Settings }] : []),
    ...(demoPageOk
      ? [{ href: '/admin/demo-page', label: t('navDemoPage') || 'Demo Page', icon: Sparkles }]
      : []),
    // Rugsatlar — diňe super admin (matrix + hard lock)
    ...(permissionsOk || superA
      ? [{ href: '/admin/permissions', label: t('navPermissions'), icon: Shield }]
      : []),
  ];

  async function logout() {
    if (logoutPending || navPending) return;
    setLogoutPending(true);
    // Poller-leri derrew togtat (401 tufany ýok)
    try {
      window.dispatchEvent(new Event('bi-logged-out'));
    } catch {
      /* */
    }
    try {
      // timeout bilen — uzun garaşma
      const ac = new AbortController();
      const t = window.setTimeout(() => ac.abort(), 2500);
      await fetch('/api/auth/me', { method: 'DELETE', signal: ac.signal }).catch(() => {});
      window.clearTimeout(t);
    } catch {
      /* */
    }
    // Full navigation — router.push köplenç haýal / component poll dowam edýär
    window.location.replace('/login');
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
      <div className="flex items-center gap-3 px-4 py-5 pr-10 border-b border-slate-800">
        <div className="bi-brand-icon h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
          <BarChart3 className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-white truncate">
            BI Platform <span className="text-[10px] font-normal text-slate-500">v1.0.0</span>
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {nav.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/dashboards' && pathname.startsWith(item.href));
          const Icon = item.icon;
          const pending = navPending === item.href;
          const busy = !!navPending || logoutPending;
          return (
            <Link
              key={item.href}
              href={busy && !pending ? '#' : item.href}
              onClick={(e) => {
                if (busy && !pending) {
                  e.preventDefault();
                  return;
                }
                if (active) {
                  e.preventDefault();
                  return;
                }
                setNavPending(item.href);
                setOpen(false);
              }}
              aria-disabled={busy && !pending}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-500/15 text-indigo-300'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white',
                busy && !pending && 'opacity-50 pointer-events-none',
                pending && 'opacity-80'
              )}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-300" />
              ) : (
                <Icon className="h-4 w-4 shrink-0 opacity-90" />
              )}
              <span className="truncate flex-1">
                {pending ? t('waitEllipsis') : item.label}
              </span>
              {!pending && <Badge n={item.badge} />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3 space-y-2">
        <button
          type="button"
          onClick={() => {
            if (logoutPending || navPending) return;
            setProfileOpen(true);
            setOpen(false);
          }}
          className={cn(
            'flex items-center gap-2 px-1 py-1.5 rounded-xl transition-colors',
            pathname === '/profile' || pathname.startsWith('/profile/')
              ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30'
              : 'hover:bg-slate-800/60'
          )}
          title={t('profile')}
        >
          <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden border border-slate-700">
            {avatarOverride || (user as any).avatarUrl || (user as any).avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  avatarOverride ||
                  (user as any).avatarUrl ||
                  `/avatars/${encodeURIComponent(String((user as any).avatar))}`
                }
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <UserCircle className="h-5 w-5 text-slate-400" />
            )}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-xs font-medium text-slate-200 truncate">
              {user.fullName || user.username}
            </p>
            <p className="text-[10px] text-slate-500 truncate">Profil · {user.role}</p>
          </div>
          <span
            className="shrink-0"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <BalanceBadge
              compact
              companySlug={user.companySlug}
              tenantSlugs={user.tenantSlugs}
              username={user.username}
              role={user.role}
            />
          </span>
        </button>
<button
          type="button"
          disabled={logoutPending || !!navPending}
          onClick={() => void logout()}
          className="bi-logout-btn w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 border border-transparent hover:border-rose-500/30 disabled:opacity-50 disabled:pointer-events-none"
        >
          {logoutPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          {logoutPending ? t('loading') : t('logout')}
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

      {/* Desktop collapse toggle — floats outside only while collapsed */}
      {collapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          title={t('showMenu')}
          className="hidden lg:flex fixed top-3 left-3 z-50 p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      <aside
        className={cn(
          'hidden lg:flex shrink-0 flex-col border-r border-slate-800 bg-slate-950/90 backdrop-blur-xl overflow-hidden transition-[width] duration-200 ease-in-out relative h-full max-h-dvh',
          collapsed ? 'w-0 border-r-0' : 'w-60'
        )}
      >
        {/* Collapse toggle — docked inside the sidebar itself while it's open */}
        <button
          type="button"
          onClick={toggleCollapsed}
          title={t('hideMenu')}
          className="absolute top-4 right-2.5 z-10 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="w-60 h-full max-h-dvh flex flex-col min-h-0">{NavContent}</div>
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
      <ProfilePanel open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
