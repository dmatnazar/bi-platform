# Firebase Web Push — BI Platform

## Local vendor (CDN däl)

```
public/vendor/firebase/firebase-app-compat.js
public/vendor/firebase/firebase-messaging-compat.js
public/firebase-messaging-sw.js
```

SW:
```js
importScripts('/vendor/firebase/firebase-app-compat.js');
importScripts('/vendor/firebase/firebase-messaging-compat.js');
```

Täze wersiýa:
```bash
curl -o public/vendor/firebase/firebase-app-compat.js \
  https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js
curl -o public/vendor/firebase/firebase-messaging-compat.js \
  https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js
```

## Setup

1. `npm install`
2. Firebase Console → Cloud Messaging → Web Push certificates → Generate key pair
3. `.env.local`:
   ```
   NEXT_PUBLIC_FIREBASE_VAPID_KEY=BNxxxx...
   ```
4. `npm run dev` → giriş → **Rugsat ber**
