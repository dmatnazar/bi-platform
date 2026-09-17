/**
 * Firebase web config (public by design).
 * Override via NEXT_PUBLIC_FIREBASE_* env if needed.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyA4DH7J53ViVxPNw1ZA1EPj5Up3OgI-raA',
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'bi-platform-1cbe1.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'bi-platform-1cbe1',
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'bi-platform-1cbe1.firebasestorage.app',
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '1071984794627',
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:1071984794627:web:414917d12611a7369b8236',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-7DKJLS5ZLE',
};

/** Web Push certificates (Firebase Console → Cloud Messaging → Web Push certificates) */
export const firebaseVapidKey =
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';
