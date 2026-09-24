// American Rider — Firebase connection for the real app.
//
// This web config is NOT secret — Firebase config is designed to live in the app.
// Security comes from Firebase Auth + Firestore Security Rules, not from hiding these.
import { initializeApp } from 'firebase/app';
import * as fbAuth from 'firebase/auth';
import { getAuth, initializeAuth, type Auth, type Persistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
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
// getReactNativePersistence only exists in the React Native build of @firebase/auth
// (firebase/auth re-exports it, but the shipped browser types don't declare it), hence
// the lookup off the namespace rather than a named import.
const getRNPersistence = (
  fbAuth as unknown as { getReactNativePersistence?: (store: unknown) => Persistence }
).getReactNativePersistence;

function createAuth(): Auth {
  if (Platform.OS === 'web' || !getRNPersistence) return getAuth(app);
  try {
    return initializeAuth(app, { persistence: getRNPersistence(AsyncStorage) });
  } catch {
    // Already initialized (Fast Refresh re-runs this module) — reuse that instance.
    return getAuth(app);
  }
}

export const auth = createAuth();

// The live Firestore database — operators, rides, etc.
export const db = getFirestore(app);

// File storage. Used for one thing so far: the photo attached to a lost item report, so the
// operator searching a car sees the bag rather than the word "bag". A local file:// URI in a
// Firestore document would be a picture only the traveler's own phone could open.
export const storage = getStorage(app);
