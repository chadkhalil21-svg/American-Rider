// American Rider — Firebase connection for the real app.
//
// This web config is NOT secret — Firebase config is designed to live in the app.
// Security comes from Firebase Auth + Firestore Security Rules, not from hiding these.
import { initializeApp } from 'firebase/app';
import * as fbAuth from 'firebase/auth';
import { getAuth, initializeAuth, type Auth, type Persistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyAQMJ1ikGvhrmCZY9D00jM6EM2r2m0V4OY',
  authDomain: 'american-rider-35688.firebaseapp.com',
  projectId: 'american-rider-35688',
  storageBucket: 'american-rider-35688.firebasestorage.app',
  messagingSenderId: '623854974930',
  appId: '1:623854974930:web:d73e4dec7949c3756efa0b',
};

export const app = initializeApp(firebaseConfig);

// STAYING SIGNED IN — the thing every rideshare app gets right and we didn't.
//
// On a phone, plain getAuth() keeps the session in MEMORY ONLY: force-quit the app and
// the traveler is thrown back to the front door with their trips, saved places, and
// operator status apparently gone. Firebase's own warning says so — "Auth state will
// default to memory persistence and will not persist between sessions."
//
// initializeAuth() with AsyncStorage (the phone's own on-device storage) writes the
// session to disk, so it survives force-quits, reboots, and app updates — you sign in
// once, like Uber. On web, getAuth() already persists in the browser.
//
// Metro resolves Firebase's React Native bundle at runtime. TypeScript currently resolves the
// browser declaration surface for firebase/auth under Expo and therefore omits this RN-only
// export. Keep the cast isolated here; the native export is also verified by the iOS export gate.
const getReactNativePersistence = (fbAuth as unknown as {
  getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
}).getReactNativePersistence;

function createAuth(): Auth {
  if (Platform.OS === 'web') return getAuth(app);
  if (typeof getReactNativePersistence !== 'function') {
    throw Object.assign(new Error('firebase/native-persistence-unavailable'), {
      code: 'firebase/native-persistence-unavailable',
    });
  }
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch (e: unknown) {
    // Reuse only a genuinely pre-initialized Auth instance. Do not silently downgrade a
    // native persistence/configuration failure to memory-only authentication.
    if ((e as { code?: string })?.code === 'auth/already-initialized') return getAuth(app);
    throw e;
  }
}

export const auth = createAuth();

// The live Firestore database — operators, rides, etc.
export const db = getFirestore(app);
