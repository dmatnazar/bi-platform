/**
 * Firebase Messaging SW — local vendor scripts.
 * Chrome ýapyk / background-da hem push kabul edýär.
 */
/* eslint-disable no-undef */
importScripts('/vendor/firebase/firebase-app-compat.js');
importScripts('/vendor/firebase/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyA4DH7J53ViVxPNw1ZA1EPj5Up3OgI-raA',
  authDomain: 'bi-platform-1cbe1.firebaseapp.com',
  projectId: 'bi-platform-1cbe1',
  storageBucket: 'bi-platform-1cbe1.firebasestorage.app',
  messagingSenderId: '1071984794627',
  appId: '1:1071984794627:web:414917d12611a7369b8236',
  measurementId: 'G-7DKJLS5ZLE',
});

const messaging = firebase.messaging();

function showFromPayload(payload) {
  const title =
    (payload.notification && payload.notification.title) ||
    (payload.data && (payload.data.title || payload.data.Title)) ||
    'BI Platform';
  const body =
    (payload.notification && payload.notification.body) ||
    (payload.data && (payload.data.body || payload.data.Body || payload.data.message)) ||
    '';
  const link =
    (payload.data && (payload.data.link || payload.data.url || payload.data.click_action)) ||
    '/news';
  const icon =
    (payload.notification && payload.notification.icon) ||
    '/icons/icon-192.png';

  return self.registration.showNotification(title, {
    body: body,
    icon: icon,
    badge: '/icons/icon-192.png',
    tag: (payload.data && payload.data.tag) || 'bi-platform',
    renotify: true,
    requireInteraction: false,
    data: { link: link, ...(payload.data || {}) },
  });
}

// Background / Chrome ýapyk (OS oýarýar)
messaging.onBackgroundMessage(function (payload) {
  return showFromPayload(payload || {});
});

// Käbir brauzerlerde push event hem gerek
self.addEventListener('push', function (event) {
  if (!event.data) return;
  var payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { data: { body: event.data.text() } };
  }
  event.waitUntil(showFromPayload(payload));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var link =
    (event.notification.data && event.notification.data.link) || '/news';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var c = clientList[i];
        if (c.url && 'focus' in c) {
          if (c.navigate) c.navigate(link);
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(link);
    })
  );
});
