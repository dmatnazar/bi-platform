'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { requestPushToken, listenForegroundPush, ensurePushServiceWorker } from '@/lib/firebase-client';
import { toastInfo, toastSuccess, toastError } from '@/components/ui/Toast';
import { useLocale } from '@/components/LocaleProvider';

const LS_ASKED = 'bi-push-prompt-done-v3';

/**
 * Wagtlaýyn push: bir gezek soráýar (Allow ýa-da Soň).
 * Her login-de gaýtalamaýar. granted bolsa diňe token täzelenýär.
 */
export function PushPermission() {
  const { t } = useLocale();

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
      const perm = Notification.permission;

      if (perm === 'granted') {
        void ensurePushServiceWorker();
        if (secure) await enable(true);
        return;
      }

      // Eýýäm sorapdyk / Soň basypdyk — indiki login-de sorama
      try {
        if (localStorage.getItem(LS_ASKED) === '1') return;
      } catch {
        /* */
      }

      if (!secure) {
        if (!cancelled) {
          setHttpHint(true);
          setShow(true);
        }
        return;
      }

      void ensurePushServiceWorker();
      await new Promise((r) => setTimeout(r, 1000));
      if (cancelled) return;
      if (Notification.permission === 'granted') {
        await enable(true);
        return;
      }
      if (!cancelled) {
        setHttpHint(false);
        setShow(true);
      }
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
        toastInfo(p.title || t('newsOne'), p.body || '');
      }).then((u) => {
        unsub = u;
      });
    }
    return () => unsub();
  }, []);

  function markAsked() {
    try {
      localStorage.setItem(LS_ASKED, '1');
    } catch {
      /* */
    }
  }

  async function enable(silent = false) {
    if (started.current && !silent) return;
    started.current = true;
    setBusy(true);
    try {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        if (!silent) {
          toastError('HTTPS gerek', t('pushHttpsOnly'));
        }
        started.current = false;
        markAsked();
        setShow(false);
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
          if (!silent) toastSuccess(t('notificationsOn'), 'Rugsat berildi');
        } else if (!silent) {
          toastError(t('notification'), res.error || 'Token alynmady (VAPID)');
        }
        markAsked();
        setShow(false);
        return;
      }

      markAsked();
      if (res.permission === 'denied' && !silent) {
        toastError(t('permClosed'), 'Site settings → Notifications → Allow.');
      } else if (!silent) {
        toastError(t('notification'), res.error || 'Rugsat berilmedi');
      }
      started.current = false;
      setShow(false);
    } catch (e) {
      if (!silent) toastError(t('notification'), e instanceof Error ? e.message : String(e));
      started.current = false;
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    markAsked();
    setShow(false);
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
            {httpHint ? t('pushHttpsRequired') : t('notificationsPermission')}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {httpHint
              ? t('pushHttpsOnce')
              : t('pushOnceHint')}
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
            {busy ? t('waitEllipsis') : 'Allow'}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className={`inline-flex items-center justify-center gap-1 rounded-lg border border-slate-700 px-3 text-xs text-slate-400 hover:text-white ${httpHint ? 'flex-1 py-2.5 text-sm' : ''}`}
        >
          <BellOff className="h-3.5 w-3.5" />
          {httpHint ? t('gotIt') : t('later')}
        </button>
      </div>
    </div>
  );
}
