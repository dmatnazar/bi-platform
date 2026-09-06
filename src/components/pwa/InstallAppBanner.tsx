'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'bi-pwa-install-dismissed';
const DISMISS_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
    if ((navigator as unknown as { standalone?: boolean }).standalone === true) return true;
  } catch {
    /* */
  }
  return false;
}

function wasDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* */
  }
}

/**
 * Login PWA install: short offer + Install button only.
 * Button calls the browser native prompt() — no how-to text.
 * Banner is shown only when beforeinstallprompt is available
 * (otherwise programmatic install is impossible).
 */
export function InstallAppBanner({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (wasDismissed()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      if (isStandalone() || wasDismissed()) return;
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* */
      }
    };

    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const onInstall = useCallback(async () => {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferred(null);
      }
    } catch {
      /* user closed sheet */
    } finally {
      setInstalling(false);
      setDeferred(null);
    }
  }, [deferred]);

  // Only when native install is actually available
  if (!deferred) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2.5',
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon-192.png"
        alt=""
        className="h-9 w-9 rounded-lg shrink-0 border border-white/10"
      />
      <p className="min-w-0 flex-1 text-xs sm:text-[13px] text-slate-200 leading-snug">
        Programma hökmünde gurnaň
      </p>
      <button
        type="button"
        onClick={() => void onInstall()}
        disabled={installing}
        className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold disabled:opacity-60"
      >
        <Download className="h-3.5 w-3.5" />
        {installing ? '…' : 'Install'}
      </button>
      <button
        type="button"
        onClick={() => {
          dismiss();
          setDeferred(null);
        }}
        className="shrink-0 p-1 rounded-md text-slate-400 hover:text-white"
        aria-label="Ýap"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
