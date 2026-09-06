'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';
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

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS = /iPhone|iPad|iPod/i.test(ua);
  const webkit = /WebKit/i.test(ua);
  const criOS = /CriOS/i.test(ua);
  const fxIOS = /FxiOS/i.test(ua);
  return iOS && webkit && !criOS && !fxIOS;
}

/**
 * PWA install offer for login.
 * - Native beforeinstallprompt when available
 * - Fallback hint on mobile (iOS Add to Home Screen / Android menu) when event never fires
 * - After uninstall, Chrome may need a fresh visit; dismiss window is 7 days
 */
export function InstallAppBanner({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (wasDismissed()) return;

    setIos(isIosSafari());

    const onBip = (e: Event) => {
      e.preventDefault();
      if (isStandalone() || wasDismissed()) return;
      setDeferred(e as BeforeInstallPromptEvent);
      setShowFallback(false);
    };
    const onInstalled = () => {
      setDeferred(null);
      setShowFallback(false);
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* */
      }
    };

    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);

    // If browser never fires beforeinstallprompt (common after uninstall or on iOS),
    // still offer a lightweight install hint on mobile after a short wait.
    const t = window.setTimeout(() => {
      if (isStandalone() || wasDismissed()) return;
      setDeferred((d) => {
        if (d) return d;
        const mobile =
          /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') ||
          (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches);
        if (mobile) setShowFallback(true);
        return null;
      });
    }, 1800);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
      window.clearTimeout(t);
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
        setShowFallback(false);
      }
    } catch {
      /* user closed sheet */
    } finally {
      setInstalling(false);
      setDeferred(null);
    }
  }, [deferred]);

  if (!deferred && !showFallback) return null;

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
      <div className="min-w-0 flex-1">
        <p className="text-xs sm:text-[13px] text-slate-200 leading-snug">
          BI Platform-y programma hökmünde gurnaň — çalt giriş.
        </p>
        {showFallback && !deferred && (
          <p className="mt-0.5 text-[10px] text-slate-400 leading-snug">
            {ios
              ? 'Safari: Share → “Baş ekrana goş” (Add to Home Screen)'
              : 'Brauzer menýusyndan “Install app” / “Baş ekrana goş” saýlaň'}
          </p>
        )}
      </div>
      {deferred ? (
        <button
          type="button"
          onClick={() => void onInstall()}
          disabled={installing}
          className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" />
          {installing ? '…' : 'Install'}
        </button>
      ) : (
        <span className="shrink-0 inline-flex items-center gap-1 h-8 px-2 text-indigo-300">
          <Share className="h-3.5 w-3.5" />
        </span>
      )}
      <button
        type="button"
        onClick={() => {
          dismiss();
          setDeferred(null);
          setShowFallback(false);
        }}
        className="shrink-0 p-1 rounded-md text-slate-400 hover:text-white"
        aria-label="Ýap"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
