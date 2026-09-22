// Where the traveler actually is.
//
// THE BUG THIS FIXES: departure defaulted to DEP_PLACES[0], which is labelled "Current
// location — Brickell" and carries fixed Brickell coordinates. The app told every traveler
// in Miami that it knew where they were standing, and named the same street to all of them.
// Chad, 16 Aug: "the app needs to know the travelers location". An institution that states
// a location it has not established is doing the opposite of authority through precision.
//
// It also priced wrongly: the fare is quoted from the departure coordinates, so anyone not
// in Brickell was quoted for a journey that started somewhere they were not.
import * as Location from 'expo-location';
import { DEP_PLACES, type DepPlace } from './data';

/** The honest fallback: a named pickup the traveler can change, never a guess. */
export const DEFAULT_DEPARTURE: DepPlace = DEP_PLACES[1]; // "Home — Brickell City Centre"

/**
 * Resolve the device's real position into a departure.
 *
 * Returns null when we cannot establish it — permission refused, location off, a timeout,
 * or the simulator with no position set. Null means "say nothing", NOT "assume Brickell":
 * the caller keeps the named fallback, which is honest because the traveler chose it.
 *
 * Never throws. A pickup that cannot be resolved must degrade to a name the traveler can
 * correct, never to a crash or an invented street.
 */
export async function resolveCurrentDeparture(): Promise<DepPlace | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced, // street-level is enough to price a pickup
    });
    const { latitude: lat, longitude: lng } = pos.coords;

    // Turn coordinates into something a person recognises. If this fails we still have a
    // usable pickup — the coordinates are what actually price and dispatch the trip.
    let label = 'Current location';
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (place) {
        // Prefer the neighbourhood or city over a street number: "Current location —
        // Wynwood" reads as a place a person knows, where "1200 NW 42nd" reads as a
        // coordinate that happens to have been formatted.
        //
        // THE COUNTY COMES LAST, and it used to come second (4 Sept 2026, first run on a real
        // phone). `subregion` is the COUNTY — so a traveler standing in Kendall was told
        // "Current location — Miami-Dade County", which is true of two and a half million
        // people and useful to none of them. It only surfaced on a device: the simulator was
        // pinned to a point that resolves to a district, so the fallback never ran.
        //
        // Order is now narrowest-first, which is the order a person would answer the question
        // in: neighbourhood, then city, then county, then state. The county still beats
        // nothing — "Current location" alone tells a traveler less than the county does — but
        // it is what we say when we have nothing better.
        // NARROWEST FIRST, AND THE STREET NOW COMES BEFORE THE NEIGHBOURHOOD (Chad,
        // 13 Sept 2026: a county is a region, not a pickup point, and precision is what
        // makes a traveler trust where the car is coming to). This file used to prefer the
        // neighbourhood over the street number on the reasoning that "Wynwood" reads better
        // than "1200 NW 42nd" — true of a label, wrong for a pickup. A person waiting on a
        // kerb wants to see the kerb. The county survives only as the last thing we say
        // before saying nothing at all.
        const street = [place.streetNumber, place.street].filter(Boolean).join(' ').trim();
        const area =
          street || place.name || place.district || place.city || place.subregion || place.region;
        if (area) label = `Current location — ${area}`;
      }
    } catch {
      // Keep the bare label; coordinates still do the real work.
    }

    return {
      name: label,
      short: label.replace(/^Current location — /, '') || 'Current location',
      lat,
      lng,
      resolved: true,
    };
  } catch {
    return null;
  }
}
