// The traveler's saved cabin environment: climate, atmosphere, music, a charging cable and
// luggage assistance. Chosen on Cabin Environment, shown on the Travel Confirmation sheet and
// on the profile, and applied to every travel — startBooking seeds each travel's own copy from
// here (RideContext.tripPrefs is the copy the operator actually receives).
//
// ONE STORE, so a change is visible the moment the traveler returns to the sheet, and one
// storage key (the one Cabin Environment has always used), so nothing a traveler saved before
// 14 September 2026 is lost — the three new fields simply start at their old defaults.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const STORE_KEY = 'ar:travel-prefs:v1';

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

let state: CabinPrefs = { climate: 'Moderate', music: 'None', quiet: true, charging: false, luggage: true };
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const isClimate = (v: unknown): v is Climate => (CLIMATES as readonly string[]).includes(String(v));
const isMusic = (v: unknown): v is Music => (MUSIC as readonly string[]).includes(String(v));
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(STORE_KEY)
    .then((raw) => {
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Record<keyof CabinPrefs, unknown>>;
      state = {
        climate: isClimate(saved.climate) ? saved.climate : state.climate,
        music: isMusic(saved.music) ? saved.music : state.music,
        quiet: bool(saved.quiet, state.quiet),
        charging: bool(saved.charging, state.charging),
        luggage: bool(saved.luggage, state.luggage),
      };
      emit();
    })
    .catch(() => {});
}

/** The saved environment as of now — for code outside React (startBooking). */
export function getCabinPrefs(): CabinPrefs {
  load();
  return state;
}

export function setCabinPrefs(patch: Partial<CabinPrefs>) {
  state = { ...state, ...patch };
  emit();
  AsyncStorage.setItem(STORE_KEY, JSON.stringify(state)).catch(() => {});
}

export function useCabinPrefs(): CabinPrefs {
  load();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => state,
    () => state,
  );
}
