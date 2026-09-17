'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { requestPushToken, listenForegroundPush, ensurePushServiceWorker } from '@/lib/firebase-client';
import { toastInfo, toastSuccess, toastError } from '@/components/ui/Toast';

/**
 * Login soň: Notification.permission !== 'granted' bolsa panel.
 * Eýýäm Allow bolsa — panel açylmaýar, diňe token täzelenýär.
 */
export function PushPermission() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;

    void ensurePushServiceWorker();

    let cancelled = false;

    async function boot() {
      // Käbir mobile brauzerlerde permission bir az gijä galýar — 2 gezek barla
      const read = () =>
        typeof Notification !== 'undefined' ? Notification.permission : 'denied';

      let perm = read();
      if (perm === 'granted') {
        if (!cancelled) await enable(true);
        return;
      }

      // Gysa garaşyp ýene barla (Android Chrome käwagt)
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;
      perm = read();
      if (perm === 'granted') {
        await enable(true);
        return;
      }

      // Diňe granted däl bolsa panel
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
    void listenForegroundPush((p) => {
      toastInfo(p.title || 'Habar', p.body || '');
    }).then((u) => {
      unsub = u;
    });
    return () => unsub();
  }, []);

  async function enable(silent = false) {
    if (started.current && !silent) return;
    started.current = true;
    setBusy(true);
    try {
      const res = await requestPushToken();

      // Rugsat eýýäm bar (ýa-da täze berildi)
      if (res.permission === 'granted') {
        if (res.token) {
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: res.token }),
          });
          if (!silent) toastSuccess('Bildirişler açyk', 'Rugsat berildi');
        } else if (!silent) {
          // Allow bar, token ýok (VAPID we ş.m.) — panel ýap, diňe ýalňyşlyk
          toastError('Bildiriş', res.error || 'Token alynmady (VAPID key barlaň)');
        }
        setShow(false);
        return;
      }

      if (res.permission === 'denied') {
        if (!silent) {
          toastError(
            'Rugsat ýapyk',
            'Brauzer Block. Site notifications Allow ediň, soň sahypany täzeläň.'
          );
        }
        started.current = false;
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
  }

  if (!show) return null;

  // Panel açyk wagty permission granted boldy bolsa gizle
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
          <p className="text-sm font-semibold text-white">Bildirişlere rugsat</p>
          <p className="text-xs text-slate-400 mt-0.5">
            «Allow» basanyňyzda brauzeriň öz tassyklamasy açylar. Eýýäm Allow bolsa bu panel
            görünmeli däl — sahypany täzeläň.
          </p>
        </div>
        <button type="button" className="p-1 text-slate-500 hover:text-white" onClick={dismiss} aria-label="Ýap">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-2">
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
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 text-xs text-slate-400 hover:text-white"
        >
          <BellOff className="h-3.5 w-3.5" />
          Soň
        </button>
      </div>
    </div>
  );
}
