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

/**
 * Manual fullscreen only (top-right icon).
 * Auto-enter on refresh / first click is OFF unless settings enable
 * localStorage bi-fullscreen-auto === '1'.
 */
export function FullscreenController() {
  const [supported, setSupported] = useState(true);
  const [active, setActive] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setSupported(isFullscreenSupported());
    setIsIOS(
      /iPhone|iPad|iPod/.test(navigator.userAgent) &&
        !(window as unknown as { MSStream?: unknown }).MSStream
    );
    setActive(isFullscreenActive());

    const onChange = () => setActive(isFullscreenActive());
    document.addEventListener('fullscreenchange', onChange);

    // Optional auto mode from Settings — default OFF
    let auto = false;
    try {
      auto = localStorage.getItem('bi-fullscreen-auto') === '1';
    } catch {
      /* */
    }
    if (auto && !fullscreenPrefDisabled()) {
      const tryFs = () => {
        if (fullscreenPrefDisabled()) return;
        if (isFullscreenActive()) return;
        requestFullscreenSafe();
      };
      // Still needs a gesture on most browsers — only try after explicit pref
      const onFirst = () => {
        tryFs();
        window.removeEventListener('pointerdown', onFirst);
      };
      window.addEventListener('pointerdown', onFirst, { once: true });
      return () => {
        document.removeEventListener('fullscreenchange', onChange);
        window.removeEventListener('pointerdown', onFirst);
      };
    }

    return () => {
      document.removeEventListener('fullscreenchange', onChange);
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
          iPhone-da doly ekran diňe &quot;Baş ekrana goş&quot; (Add to Home Screen) arkaly işleýär.
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
