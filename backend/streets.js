// Street routing: how a car actually gets from A to B, for the live map and — once the
// founders have compared it with the straight-line model — for pricing by time and distance.
//
// THE PUBLIC DEMO ROUTER IS GONE FROM HERE. routes.js called router.project-osrm.org, whose
// usage policy forbids production use. A map that depends on a server we were asked not to
// depend on is a map that stops one day without notice. The order now, per region:
//   1. the region's own OSRM (OSRM_URL_<REGION> or OSRM_URL), same API, when one is set;
//   2. the region's OpenTripPlanner, whose graph already holds the region's streets, asked
//      for a car-only itinerary (transit.js planCar) — when no OSRM is set, or when the one
//      that is set does not answer;
//   3. null, and the app draws the straight line it drew before routing existed.
// Every provider answers in one shape: { coords: [{lat,lng}], durationSec, distanceMeters,
// provider: 'osrm' | 'otp' }. A null is always safe; a ride must never fail because a route
// lookup did.
const { regionForTrip, isCoord } = require('./regions');
const transit = require('./transit');

const OSRM_TIMEOUT_MS = 6000;
const TRAFFIC_TIMEOUT_MS = 6000;

// Optional traffic intelligence. MAPBOX_ACCESS_TOKEN enables Mapbox's driving-traffic profile.
// It is deliberately server-side: the mobile app never receives the token and never becomes
// coupled to a routing vendor. When it is absent or unavailable, the existing OSRM/OTP chain
// remains authoritative. This makes traffic an enhancement, never a prerequisite for Travel.
async function routeMapboxTraffic(from, to) {
  const token = (process.env.MAPBOX_ACCESS_TOKEN || '').trim();
  if (!token) return null;
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}` +
    `?alternatives=true&overview=full&geometries=geojson&steps=false&access_token=${encodeURIComponent(token)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TRAFFIC_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const routes = Array.isArray(data?.routes) ? data.routes : [];
    const candidates = routes
      .filter((r) => Array.isArray(r?.geometry?.coordinates) && r.geometry.coordinates.length >= 2)
      .map((r) => ({
        coords: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
        durationSec: Math.round(r.duration),
        typicalDurationSec: Number.isFinite(r.duration_typical) ? Math.round(r.duration_typical) : null,
        distanceMeters: Math.round(r.distance),
        provider: 'mapbox-traffic',
      }))
      .sort((a, b) => a.durationSec - b.durationSec);
    return candidates[0] || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function routeOsrm(base, from, to) {
  const url =
    `${base.replace(/\/+$/, '')}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson&alternatives=false&steps=false`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OSRM_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const route = data && Array.isArray(data.routes) ? data.routes[0] : null;
    const line = route && route.geometry && route.geometry.coordinates;
    if (!Array.isArray(line) || line.length < 2) return null;
    return {
      coords: line.map(([lng, lat]) => ({ lat, lng })),
      durationSec: Math.round(route.duration),
      distanceMeters: Math.round(route.distance),
      provider: 'osrm',
    };
  } catch {
    return null; // down or too slow — the next provider takes over
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The driven route between two coordinates in one served region, or null.
 * opts.region skips the lookup when the caller already knows it.
 */
async function routeCar(from, to, opts = {}) {
  if (!isCoord(from) || !isCoord(to)) return null;
  const region = opts.region || regionForTrip(from, to);
  if (!region) return null;
  // Traffic-aware routing is preferred when configured. The provider already ranks its
  // alternatives; American Rider consumes the recommended result rather than asking the
  // Traveler to operate a routing engine.
  const traffic = await routeMapboxTraffic(from, to);
  if (traffic) return traffic;

  const osrm = region.osrmUrl;
  if (osrm) {
    const viaOsrm = await routeOsrm(osrm, from, to);
    if (viaOsrm) return viaOsrm;
  }
  try {
    return await transit.planCar(from, to, { region });
  } catch {
    return null;
  }
}

module.exports = { routeCar, routeOsrm, routeMapboxTraffic, OSRM_TIMEOUT_MS, TRAFFIC_TIMEOUT_MS };
