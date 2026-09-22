// Ask OUR SERVER how the driver actually gets from A to B — the street path the live map
// draws and the car follows. Mirrors fares.ts: the phone only ever asks, the server answers,
// and swapping the routing provider later (Apple Maps Server API) touches zero app code.
//
// A null answer is always safe: the map keeps the straight pickup→destination line it drew
// before routing existed. A ride must never fail because a route lookup did.
import { PAYMENT_SERVER_URL } from '../config';
import type { Coords } from './fares';

export type Route = {
  coords: Coords[]; // the street path, pickup → destination
  durationSec: number;
  distanceMeters: number;
};

export async function fetchRoute(pickup: Coords, dest: Coords): Promise<Route | null> {
  try {
    const res = await fetch(`${PAYMENT_SERVER_URL}/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickup, dest }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Route;
    if (!Array.isArray(data.coords) || data.coords.length < 2) return null;
    return data;
  } catch {
    return null;
  }
}
