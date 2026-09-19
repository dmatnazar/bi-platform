'use client';
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Maximize2, Minimize2, Moon, Sun, Activity } from 'lucide-react';
import {
  isFullscreenSupported,
  isFullscreenActive,
  requestFullscreenSafe,
  exitFullscreenSafe,
  fullscreenPrefDisabled,
  setFullscreenPref,
} from '@/lib/fullscreen';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { cn, formatDate } from '@/lib/utils';

const HIDE_MS = 5000;

type TenantClientStatus = {
  slug: string;
  name: string;
  online: boolean;
  live: boolean;
};

type Status = {
  gatewayOnline: boolean;
  biClientDataAvailable: boolean;
  fromCache: boolean;
  catalogSyncedAt: string | null;
  cachedAt: string | null;
  catalogSyncIntervalSec: number;
  checkedAt: string;
  counts: { tenants: number; endpoints: number; staff: number };
  tenantStatuses?: TenantClientStatus[];
};

export function FullscreenController() {
  const [supported, setSupported] = useState(true);
  const [active, setActive] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [visible, setVisible] = useState(true);
  const [statusOpen, setStatusOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { locale, toggleLocale, t } = useLocale();

  const bumpVisible = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      setStatusOpen(false);
    }, HIDE_MS);
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (res.ok) setStatus(data);
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    setSupported(isFullscreenSupported());
    setIsIOS(
      /iPhone|iPad|iPod/.test(navigator.userAgent) &&
        !(window as unknown as { MSStream?: unknown }).MSStream
    );
    setActive(isFullscreenActive());
    const onChange = () => setActive(isFullscreenActive());
    document.addEventListener('fullscreenchange', onChange);

    let auto = false;
    try {
      auto = localStorage.getItem('bi-fullscreen-auto') === '1';
    } catch {
      /* */
    }
    if (auto && !fullscreenPrefDisabled()) {
      const onFirst = () => {
        if (!fullscreenPrefDisabled() && !isFullscreenActive()) requestFullscreenSafe();
        window.removeEventListener('pointerdown', onFirst);
      };
      window.addEventListener('pointerdown', onFirst, { once: true });
      return () => {
        document.removeEventListener('fullscreenchange', onChange);
        window.removeEventListener('pointerdown', onFirst);
      };
    }
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    bumpVisible();
    const onScroll = () => bumpVisible();
    const onMove = (e: PointerEvent) => {
      if (e.clientX > window.innerWidth - 88 && e.clientY < 140) bumpVisible();
    };
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('wheel', onScroll, { passive: true });
    window.addEventListener('touchmove', onScroll, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('wheel', onScroll);
      window.removeEventListener('touchmove', onScroll);
      window.removeEventListener('pointermove', onMove);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (statusTimer.current) clearTimeout(statusTimer.current);
    };
  }, [bumpVisible]);

  function handleToggleFs() {
    bumpVisible();
    if (isIOS && !isFullscreenSupported()) {
      setShowHint((v) => !v);
      return;
    }
    if (active) {
      exitFullscreenSafe();
      setFullscreenPref(false);
    } else {
      setFullscreenPref(true);
      requestFullscreenSafe();
    }
  }

  function handleTheme(e: MouseEvent<HTMLButtonElement>) {
    bumpVisible();
    const r = e.currentTarget.getBoundingClientRect();
    toggleTheme({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }

  function toggleStatus() {
    bumpVisible();
    setStatusOpen((open) => {
      const next = !open;
      if (next) {
        void loadStatus();
        if (statusTimer.current) clearTimeout(statusTimer.current);
        statusTimer.current = setTimeout(() => setStatusOpen(false), HIDE_MS);
      } else if (statusTimer.current) {
        clearTimeout(statusTimer.current);
      }
      return next;
    });
  }

  const btnClass =
    'p-2 rounded-full bg-slate-900/80 border border-slate-700 text-slate-400 hover:text-slate-100 hover:border-slate-500 shadow-lg backdrop-blur transition-opacity duration-300';

  const syncLabel =
    status?.cachedAt || status?.catalogSyncedAt
      ? formatDate(status.cachedAt || status.catalogSyncedAt || '')
      : '—';
  const intervalLabel =
    !status || status.catalogSyncIntervalSec <= 0
      ? 'el bilen'
      : `her ${status.catalogSyncIntervalSec}s`;

  let live = 0;
  let offline = 0;
  for (const t of status?.tenantStatuses || []) {
    if (t.online || t.live) live += 1;
    else offline += 1;
  }

  return (
    <div
      className={cn(
        'fixed top-3 right-3 sm:top-4 sm:right-4 z-40 flex flex-col items-end gap-2 transition-opacity duration-300',
        visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      )}
      onPointerEnter={bumpVisible}
    >
      {showHint && (
        <div className="max-w-[220px] rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-[11px] text-slate-300 shadow-xl">
          iPhone-da doly ekran diňe &quot;Baş ekrana goş&quot; (Add to Home Screen) arkaly işleýär.
        </div>
      )}

      {statusOpen && (
        <div className="lg:hidden mb-1 w-[min(18rem,calc(100vw-4rem))] rounded-xl border border-slate-700 bg-slate-900/95 shadow-xl px-3 py-2.5 text-[11px] space-y-1.5 text-left">
          <p className={status?.gatewayOnline ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
            VPS {status?.gatewayOnline ? 'connected' : 'offline'}
          </p>
          <p className="text-slate-300">
            BI Client (
            {live > 0 && <span className="text-emerald-400">live({live})</span>}
            {live > 0 && offline > 0 && ', '}
            {offline > 0 && <span className="text-amber-400">offline({offline})</span>}
            {!live && !offline && '—'})
          </p>
          <p className="text-slate-400">
            Sync: <span className="text-slate-200">{syncLabel}</span>
            <span className="mx-1">·</span>
            {intervalLabel}
          </p>
          {status && (
            <p className="text-slate-400">
              {status.counts.tenants}firma · {status.counts.endpoints}API · {status.counts.staff}işgär
            </p>
          )}
        </div>
      )}

      {(supported || isIOS) && (
        <button
          type="button"
          onClick={handleToggleFs}
          title={active ? t('fullscreenExit') : t('fullscreenEnter')}
          className={btnClass}
        >
          {active ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      )}
      <button
        type="button"
        onClick={toggleStatus}
        title={t('connectionStatus')}
        className={cn(btnClass, 'lg:hidden', statusOpen && 'text-indigo-300 border-indigo-500/50')}
      >
        <Activity className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={handleTheme}
        title={theme === 'light' ? t('themeDark') : t('themeLight')}
        aria-label={theme === 'light' ? t('themeDark') : t('themeLight')}
        className={btnClass}
      >
        {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>

      <button
        type="button"
        onClick={() => {
          toggleLocale();
          bumpVisible();
        }}
        title={t('langSwitch')}
        aria-label={t('langSwitch')}
        className={cn(btnClass, 'font-bold text-[11px] tracking-wide')}
      >
        {locale === 'tm' ? 'RU' : 'TM'}
      </button>
    </div>
  );
}
