// Account-scoped cabin preferences.
//
// These are service preferences, not device-demo state. Each signed-in account has its own
// local cache and a Firestore copy so one person's cabin choices never bleed into another
// person's session on a shared device. The local cache keeps the interface immediate; the
// account record lets the preference follow the Traveler across devices.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useSyncExternalStore } from 'react';
import { auth, db } from '../firebase';

const STORE_PREFIX = 'ar:travel-prefs:v2:';

export const CLIMATES = ['Cool', 'Moderate', 'Warm'] as const;
export const MUSIC = ['None', 'Traveler Choice'] as const;
export type Climate = (typeof CLIMATES)[number];
export type Music = (typeof MUSIC)[number];
export type CabinPrefs = {
  climate: Climate;
  music: Music;
  quiet: boolean;
  charging: boolean;
  luggage: boolean;
};

const DEFAULT_PREFS: CabinPrefs = {
  climate: 'Moderate',
  music: 'None',
  quiet: true,
  charging: false,
  luggage: false,
};

const states = new Map<string, CabinPrefs>();
const loaded = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const isClimate = (v: unknown): v is Climate => (CLIMATES as readonly string[]).includes(String(v));
const isMusic = (v: unknown): v is Music => (MUSIC as readonly string[]).includes(String(v));
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const keyNow = () => STORE_PREFIX + (auth.currentUser?.uid || 'preview');

function normalize(saved: unknown, fallback: CabinPrefs): CabinPrefs {
  const x = (saved && typeof saved === 'object' ? saved : {}) as Partial<Record<keyof CabinPrefs, unknown>>;
  return {
    climate: isClimate(x.climate) ? x.climate : fallback.climate,
    music: isMusic(x.music) ? x.music : fallback.music,
    quiet: bool(x.quiet, fallback.quiet),
    charging: bool(x.charging, fallback.charging),
    luggage: bool(x.luggage, fallback.luggage),
  };
}

function ensure(key = keyNow()) {
  if (!states.has(key)) states.set(key, { ...DEFAULT_PREFS });
  if (loaded.has(key)) return;
  loaded.add(key);

  // Local cache first for immediate rendering.
  AsyncStorage.getItem(key)
    .then((raw) => {
      if (!raw) return;
      states.set(key, normalize(JSON.parse(raw), states.get(key) ?? DEFAULT_PREFS));
      emit();
    })
    .catch(() => {});

  // The signed-in account record is authoritative when available.
  const uid = auth.currentUser?.uid;
  if (uid && key === STORE_PREFIX + uid) {
    getDoc(doc(db, 'users', uid))
      .then((snap) => {
        if (!snap.exists()) return;
        const remote = snap.data()?.cabinPreferences;
        if (!remote) return;
        const next = normalize(remote, states.get(key) ?? DEFAULT_PREFS);
        states.set(key, next);
        AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
        emit();
      })
      .catch(() => {});
  }
}

/** The saved environment as of now — for booking/dispatch code outside React. */
export function getCabinPrefs(): CabinPrefs {
  const key = keyNow();
  ensure(key);
  return states.get(key) ?? DEFAULT_PREFS;
}

export function setCabinPrefs(patch: Partial<CabinPrefs>) {
  const key = keyNow();
  ensure(key);
  const next = { ...(states.get(key) ?? DEFAULT_PREFS), ...patch };
  states.set(key, next);
  emit();
  AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});

  const uid = auth.currentUser?.uid;
  if (uid) {
    setDoc(doc(db, 'users', uid), { cabinPreferences: next }, { merge: true }).catch(() => {});
  }
}

// Account changes switch the snapshot immediately; the AccountScope remount in _layout keeps
// the rest of the app's transient state separate too.
onAuthStateChanged(auth, () => {
  ensure(keyNow());
  emit();
});

export function useCabinPrefs(): CabinPrefs {
  ensure(keyNow());
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => getCabinPrefs(),
    () => getCabinPrefs(),
  );
}
