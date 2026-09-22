// Real street routing for the live map.
//
// WHY THIS LIVES ON THE SERVER: same reason as pricing. The phone asks "how do I get from A
// to B?" and the server answers. When the routing provider changes, only the server changes
// and every installed app keeps working. No rebuild, no app update.
//
// PROVIDERS are streets.js's business: the region's own OSRM when one is configured, else the
// region's OpenTripPlanner street graph, else null. The public OSRM demo server this file
// called until 9 Sept 2026 is gone — its usage policy forbids production use. A failure here
// must never break a ride: the app falls back to the straight line it drew before routing
// existed.
//
// Bounded to a served region — the same record market.js and fares.js read (regions.js).
// Refusing far-away points keeps this endpoint from being abused as a free worldwide routing
// proxy (it is unauthenticated, like /quote).
const { regionForTrip } = require('./regions');
const { routeCar } = require('./streets');

// The full geometry of a cross-town trip can be 500+ points; the phone doesn't need that many
// to draw a smooth line. Thin evenly, always keeping the first and last point.
function thin(coords, maxPoints = 160) {
  if (coords.length <= maxPoints) return coords;
  const step = (coords.length - 1) / (maxPoints - 1);
  const out = [];
  for (let i = 0; i < maxPoints; i++) out.push(coords[Math.round(i * step)]);
  return out;
}

// Returns { coords: [{lat,lng}...], durationSec, distanceMeters, provider } or null if the
// trip can't be routed (out of market, no provider answering, nonsense coordinates). Null is
// always safe: the map falls back to the straight line.
async function fetchRoute(from, to) {
  const region = regionForTrip(from, to);
  if (!region) return null;
  const route = await routeCar(from, to, { region });
  if (!route || !Array.isArray(route.coords) || route.coords.length < 2) return null;
  return { ...route, coords: thin(route.coords) };
}

module.exports = { fetchRoute, thin };
