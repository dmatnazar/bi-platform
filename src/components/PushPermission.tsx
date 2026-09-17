'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { requestPushToken, listenForegroundPush, ensurePushServiceWorker } from '@/lib/firebase-client';
import { toastInfo, toastSuccess, toastError } from '@/components/ui/Toast';

const LS_DISMISS = 'bi-push-dismiss-v2';
const LS_SECURE_HINT = 'bi-push-http-hint-v1';

/**
 * Login soň push rugsady.
 * - granted → diňe token täzele, panel ýok
 * - HTTP (isSecureContext=false) → FCM işlemez; bir gezek gysga düşündiriş, soň soramaz
 * - default → Allow (brauzer dialog)
 */
export function PushPermission() {
  const [show, setShow] = useState(false);
  const [httpHint, setHttpHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;

    let cancelled = false;

    async function boot() {
      const secure = window.isSecureContext === true;
      // localhost HTTP käwagt secure hasaplanýar; LAN IP http://192.x — däl
      const perm = Notification.permission;

      if (perm === 'granted') {
        void ensurePushServiceWorker();
        if (secure) await enable(true);
        return;
      }

      // HTTP + rugsat ýok → FCM/token işlemeýär; hemişe sorama
      if (!secure) {
        try {
          if (localStorage.getItem(LS_SECURE_HINT) === '1') return;
        } catch {
          /* */
        }
        if (!cancelled) {
          setHttpHint(true);
          setShow(true);
        }
        return;
      }

      try {
        if (localStorage.getItem(LS_DISMISS) === '1' && perm === 'denied') return;
      } catch {
        /* */
      }

      void ensurePushServiceWorker();
      await new Promise((r) => setTimeout(r, 500));
      if (cancelled) return;
      if (Notification.permission === 'granted') {
        await enable(true);
        return;
      }
      if (!cancelled) setShow(true);
    }

    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let unsub = () => {};
    if (typeof window !== 'undefined' && window.isSecureContext) {
      void listenForegroundPush((p) => {
        toastInfo(p.title || 'Habar', p.body || '');
      }).then((u) => {
        unsub = u;
      });
    }
    return () => unsub();
  }, []);

  async function enable(silent = false) {
    if (started.current && !silent) return;
    started.current = true;
    setBusy(true);
    try {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        if (!silent) {
          toastError(
            'HTTPS gerek',
            'Push diňe HTTPS ýa-da localhost-da işleýär. LAN IP (http://192…) goldanmaýar.'
          );
        }
        started.current = false;
        return;
      }

      const res = await requestPushToken();

      if (res.permission === 'granted') {
        if (res.token) {
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: res.token }),
          });
          if (!silent) toastSuccess('Bildirişler açyk', 'Rugsat berildi');
        } else if (!silent) {
          toastError('Bildiriş', res.error || 'Token alynmady (VAPID)');
        }
        setShow(false);
        try {
          localStorage.removeItem(LS_DISMISS);
        } catch {
          /* */
        }
        return;
      }

      if (res.permission === 'denied') {
        try {
          localStorage.setItem(LS_DISMISS, '1');
        } catch {
          /* */
        }
        if (!silent) {
          toastError('Rugsat ýapyk', 'Site settings → Notifications → Allow, soň täzeläň.');
        }
        started.current = false;
        setShow(false);
        return;
      }

      if (!silent) toastError('Bildiriş', res.error || 'Rugsat berilmedi');
      started.current = false;
    } catch (e) {
      if (!silent) toastError('Bildiriş', e instanceof Error ? e.message : String(e));
      started.current = false;
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    setShow(false);
    if (httpHint) {
      try {
        localStorage.setItem(LS_SECURE_HINT, '1');
      } catch {
        /* */
      }
    }
  }

  if (!show) return null;
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-[400] rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur shadow-2xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
          <Bell className="h-5 w-5 text-indigo-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            {httpHint ? 'Bildiriş — HTTPS gerek' : 'Bildirişlere rugsat'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {httpHint ? (
              <>
                Siz <span className="text-amber-300">http://</span> bilen girýärsiňiz (mysal: 192.168…).
                Brauzer push rugsadyny durnukly saklamaýar / FCM işlemeýär. Çözgüt:{' '}
                <span className="text-emerald-300">HTTPS</span> ýa-da kompýuterde{' '}
                <span className="text-emerald-300">localhost</span>.
              </>
            ) : (
              <>«Allow» → brauzeriň öz tassyklamasy. Bir gezek berseňiz indiki login-de soramaz.</>
            )}
          </p>
        </div>
        <button type="button" className="p-1 text-slate-500 hover:text-white" onClick={dismiss}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-2">
        {!httpHint && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              started.current = false;
              void enable(false);
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-2.5 disabled:opacity-60"
          >
            <Bell className="h-4 w-4" />
            {busy ? 'Garaşyň…' : 'Allow'}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className={`inline-flex items-center justify-center gap-1 rounded-lg border border-slate-700 px-3 text-xs text-slate-400 hover:text-white ${httpHint ? 'flex-1 py-2.5 text-sm' : ''}`}
        >
          <BellOff className="h-3.5 w-3.5" />
          {httpHint ? 'Düşündim' : 'Soň'}
        </button>
      </div>
    </div>
  );
}
