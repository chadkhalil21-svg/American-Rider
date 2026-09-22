// A TRAVELER'S OWN PLACES — home, work and their favourite destinations, set by them and
// nobody else.
//
// WHY THIS EXISTS. Profile used to state, as fact, that the reader's home was Brickell City
// Centre and their work was Coral Gables. Invented personal information about the person
// reading it, on the one screen that is supposed to be about them — and nothing anywhere
// could set either, so it was not a stale value, it was somebody else's. It was removed on
// sight with a note saying to restore it WITH the screen that lets a traveler save a place.
// This is that, and Profile shows these only once the traveler has actually set them.
// Favourites were added 14 September 2026 at Adrian's request: any number of destinations
// (up to eight) a traveler wants one tap away on Home.
//
// STORED ON THE DEVICE. A home address is the most sensitive thing a rideshare app holds; it
// is the one piece of data that says where somebody sleeps. It is not needed on the server —
// nothing dispatches from it, and a booking sends coordinates like any other pickup — so it
// does not go there. Deleting the app deletes it.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ar:saved-places:v1';
export const MAX_FAVORITES = 8;

export type SavedPlace = { label: string; lat: number; lng: number };
export type SavedPlaces = { home?: SavedPlace; work?: SavedPlace; favorites: SavedPlace[] };

// A place with no coordinates cannot be travelled to, so it is not a place. Dropped rather
// than shown as a row that fails when tapped.
const ok = (p?: SavedPlace | null): SavedPlace | undefined =>
  p && typeof p.label === 'string' && p.label.trim() && Number.isFinite(p.lat) && Number.isFinite(p.lng)
    ? { label: p.label.trim(), lat: p.lat, lng: p.lng }
    : undefined;

export async function loadSavedPlaces(): Promise<SavedPlaces> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { favorites: [] };
    const v = JSON.parse(raw) as Partial<SavedPlaces>;
    const favorites = (Array.isArray(v.favorites) ? v.favorites : [])
      .map((p) => ok(p))
      .filter((p): p is SavedPlace => !!p)
      .slice(0, MAX_FAVORITES);
    return { home: ok(v.home), work: ok(v.work), favorites };
  } catch {
    return { favorites: [] };
  }
}

async function persist(next: SavedPlaces): Promise<SavedPlaces> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* a device that cannot store it still returns the value for this session */
  }
  return next;
}

export async function saveSavedPlace(
  which: 'home' | 'work',
  place: SavedPlace | null,
): Promise<SavedPlaces> {
  const current = await loadSavedPlaces();
  return persist({ ...current, [which]: ok(place) });
}

/** Add a favourite, or replace the one with the same label. Refused past MAX_FAVORITES. */
export async function saveFavorite(place: SavedPlace): Promise<SavedPlaces> {
  const current = await loadSavedPlaces();
  const clean = ok(place);
  if (!clean) return current;
  const rest = current.favorites.filter((f) => f.label.toLowerCase() !== clean.label.toLowerCase());
  if (rest.length >= MAX_FAVORITES) return current;
  return persist({ ...current, favorites: [...rest, clean] });
}

export async function removeFavorite(label: string): Promise<SavedPlaces> {
  const current = await loadSavedPlaces();
  return persist({
    ...current,
    favorites: current.favorites.filter((f) => f.label.toLowerCase() !== label.trim().toLowerCase()),
  });
}
