// Where the traveler can go FROM WHERE THEY ARE — asked of the server, never assumed.
//
// WHAT THIS REPLACES. The home screen's list of bookable destinations was hardcoded in
// src/data.ts: Brickell, Wynwood, Kaseya Center, PortMiami. Every first-time traveler saw it,
// wherever they stood. Fort Lauderdale is INSIDE our service region — a traveler there was
// served, offered five Miami-Dade places twenty-five miles away, and shown an estimated
// journey time for each, computed from Brickell because the times were baked in beside the
// names. They were reading times for a journey starting somewhere they were not.
//
// A LIST IN THE APP ALSO MEANS A NEW CITY NEEDS APP REVIEW. Destinations now come from
// backend/places.js, keyed to the region containing the traveler's own coordinates, so opening
// a market is a server change and appears in every installed copy of the app at once.
//
// AN EMPTY LIST IS A CORRECT ANSWER and the important one: outside every region the traveler
// is told we do not operate there yet, rather than being offered another city's places.
import { PAYMENT_SERVER_URL } from '../config';
import type { Coords } from './fares';

export type Destination = { name: string; short: string; lat: number; lng: number; minutes: number };

export type DestinationsResult = {
  /** The region the traveler is standing in, or null when they are outside every market. */
  region: string | null;
  destinations: Destination[];
};

const NONE: DestinationsResult = { region: null, destinations: [] };

/**
 * Never throws. An unreachable server reads as "no destinations", which shows the traveler the
 * same honest empty state as standing outside a market — rather than falling back to a list of
 * somewhere else, which is the fault this whole path exists to remove.
 */
export async function destinationsNear(from: Coords | null, limit = 5): Promise<DestinationsResult> {
  if (!from || !Number.isFinite(from.lat) || !Number.isFinite(from.lng)) return NONE;
  try {
    const url = `${PAYMENT_SERVER_URL}/destinations?lat=${encodeURIComponent(from.lat)}&lng=${encodeURIComponent(from.lng)}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return NONE;
    const d = await res.json().catch(() => null);
    if (!d || !Array.isArray(d.destinations)) return NONE;
    return {
      region: typeof d.region === 'string' ? d.region : null,
      destinations: d.destinations.filter(
        (x: unknown): x is Destination =>
          !!x && typeof (x as Destination).name === 'string' &&
          typeof (x as Destination).lat === 'number' && typeof (x as Destination).lng === 'number' &&
          typeof (x as Destination).minutes === 'number',
      ),
    };
  } catch {
    return NONE;
  }
}
