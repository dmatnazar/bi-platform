'use client';

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';
import { firebaseConfig, firebaseVapidKey } from '@/lib/firebase-config';

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  return app;
}

export async function ensurePushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.warn('[push] SW register failed', e);
    return null;
  }
}

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  const ok = await isSupported().catch(() => false);
  if (!ok) return null;
  if (messaging) return messaging;
  messaging = getMessaging(getFirebaseApp());
  return messaging;
}

/**
 * Request notification permission + FCM token.
 * Registers /firebase-messaging-sw.js
 */
export async function requestPushToken(): Promise<{
  ok: boolean;
  token?: string;
  permission?: NotificationPermission;
  error?: string;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { ok: false, error: 'Bu brauzer bildiriş goldamaýar' };
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return { ok: false, permission, error: 'Bildiriş rugsady berilmedi' };
  }

  if (!firebaseVapidKey) {
    return {
      ok: false,
      permission,
      error:
        'VAPID key ýok. Firebase Console → Cloud Messaging → Web Push certificates → Generate key pair. NEXT_PUBLIC_FIREBASE_VAPID_KEY .env.local-a ýazyň.',
    };
  }

  try {
    const reg = await ensurePushServiceWorker();
    const msg = await getFirebaseMessaging();
    if (!msg) return { ok: false, permission, error: 'Messaging goldanmaýar (HTTPS gerek)' };

    const token = await getToken(msg, {
      vapidKey: firebaseVapidKey,
      serviceWorkerRegistration: reg || (await navigator.serviceWorker.ready),
    });

    if (!token) return { ok: false, permission, error: 'Token alynmady' };
    return { ok: true, token, permission };
  } catch (e) {
    return { ok: false, permission, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Foreground messages (tab open) */
export async function listenForegroundPush(
  handler: (payload: { title?: string; body?: string; link?: string }) => void
): Promise<() => void> {
  const msg = await getFirebaseMessaging();
  if (!msg) return () => {};
  return onMessage(msg, (payload) => {
    handler({
      title: payload.notification?.title || payload.data?.title,
      body: payload.notification?.body || payload.data?.body,
      link: payload.data?.link,
    });
  });
}
