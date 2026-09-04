'use client';

import { useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import {
  isFullscreenSupported,
  isFullscreenActive,
  requestFullscreenSafe,
  exitFullscreenSafe,
  fullscreenPrefDisabled,
  setFullscreenPref,
} from '@/lib/fullscreen';

const SESSION_FLAG = 'bi-fullscreen-tried';

/**
 * Handles two cases the login-page trigger alone doesn't cover:
 *  1. A user who is already authenticated (cookie session) opens /dashboards
 *     directly, so the login form's click gesture never happened — we grab
 *     the very first tap/click inside the app shell instead.
 *  2. A small manual toggle for anyone whose browser blocked the automatic
 *     request, or who wants to leave fullscreen.
 * No-ops entirely on iOS Safari, which doesn't support the Fullscreen API —
 * the button there just explains "Add to Home Screen" instead.
 */
export function FullscreenController() {
  const [supported, setSupported] = useState(true);
  const [active, setActive] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setSupported(isFullscreenSupported());
    setIsIOS(/iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream);
    setActive(isFullscreenActive());

    const onChange = () => setActive(isFullscreenActive());
    document.addEventListener('fullscreenchange', onChange);

    if (fullscreenPrefDisabled() || isFullscreenActive()) {
      document.addEventListener('fullscreenchange', onChange);
      return () => document.removeEventListener('fullscreenchange', onChange);
    }

    let tried = false;
    try {
      tried = sessionStorage.getItem(SESSION_FLAG) === '1';
    } catch { /* ignore */ }

    const onFirstGesture = () => {
      if (tried) return;
      tried = true;
      try { sessionStorage.setItem(SESSION_FLAG, '1'); } catch { /* ignore */ }
      requestFullscreenSafe();
      window.removeEventListener('pointerdown', onFirstGesture);
    };
    if (!tried) window.addEventListener('pointerdown', onFirstGesture, { once: true });

    // Desktop refresh (F5) / back-forward: try fullscreen again if preferred
    const onPageShow = () => {
      if (fullscreenPrefDisabled()) return;
      if (isFullscreenActive()) return;
      // Need a user gesture on some browsers — try anyway after short delay
      setTimeout(() => {
        if (!isFullscreenActive() && !fullscreenPrefDisabled()) {
          requestFullscreenSafe();
        }
      }, 300);
    };
    window.addEventListener('pageshow', onPageShow);

    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  function handleToggle() {
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

  if (!supported && !isIOS) return null;

  return (
    <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-40 flex flex-col items-end gap-2">
      {showHint && (
        <div className="max-w-[220px] rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-[11px] text-slate-300 shadow-xl">
          iPhone-da doly ekran diňe &quot;Baş ekrana goş&quot; (Add to Home Screen) arkaly işleýär — Safari-de brauzer çäklendirmesi sebäpli başgaça mümkin däl.
        </div>
      )}
      <button
        type="button"
        onClick={handleToggle}
        title={active ? 'Doly ekrandan çyk' : 'Doly ekran'}
        className="p-2 rounded-full bg-slate-900/80 border border-slate-700 text-slate-400 hover:text-slate-100 hover:border-slate-500 shadow-lg backdrop-blur"
      >
        {active ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
