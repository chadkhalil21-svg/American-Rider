// Markets: which places American Rider operates in, decided on the server, county by county.
//
// A MARKET IS A COUNTY. Each has a status: ACTIVE (travel is sold and operators are onboarded
// there) or WAITLIST (the app installs and people may register interest, and nothing costly or
// regulated starts). The three counties of the South Florida operating region are ACTIVE:
// Miami-Dade, Broward and Palm Beach. Every other county — and anywhere with no county record —
// is WAITLIST unless explicitly activated.
//
// WHY COUNTIES AND NOT THE REGION'S BOX. regions.js bounds South Florida with a rectangle, which
// also takes in Key Largo (Monroe County), parts of Collier and Hendry, and Martin County's
// southern edge. A county is the unit a person means when they say where American Rider runs,
// and it is the unit each one can be switched on or off in, independently.
//
// THE PICKUP DECIDES. Authorization reads the requested pickup location, never the device's
// position: somebody in Chicago may reserve a pickup at Miami International Airport for next
// week. An active market is where travel ORIGINATES, not where it must end: the destination may
// be in any county of the pickup's operating region, active or not — Key Largo, Martin County
// below the region's northern edge, the western Everglades.
//
// THE DESTINATION RULE IS THE ONE THAT SHIPPED, UNCHANGED. Before 22 Sept 2026 both ends had to
// fall inside the region's rectangle (regions.js bbox, 25.05–26.98 N, 80.95–79.95 W), because
// "a travel between regions is not sold" (market.js) — pinned by market.test.js ("Miami to New
// York is refused"). That is an existing, tested product rule, so it stands: a destination
// outside the pickup's region is refused. For one day on this branch destinations were narrowed
// to the three counties; that narrowing is withdrawn. Lifting the regional limit is one line in
// tripOutsideMarkets and is the founders' decision.
//
// NOT HERE: airport, seaport and other restricted places. Those are fees.js (permitRequired),
// checked separately and independently of whether the county is active.
//
// BOUNDARIES. backend/markets/fl-counties.json, built by infra/markets/build-counties.mjs from
// the Census Bureau's 1:500,000 cartographic county boundaries (cb_2021_us_county_500k). A point
// is in the county whose land polygon contains it. Nothing else decides it, with one narrow
// exception for the shoreline, below.
//
// THE SHORELINE ALLOWANCE (SHORE_M). Cartographic boundaries follow a generalized shoreline, so
// a pickup pinned on beach sand can fall a few tens of metres "in the water" (measured on
// 22 Sept 2026: Haulover Beach 14 m, Fort Lauderdale beach 65 m, Pompano pier base 93 m). A
// point is given a county by this allowance ONLY when it lies inside NO county at all, and
// exactly ONE county lies within SHORE_M. It never moves a point out of the county it is in,
// and near a county line it refuses rather than chooses. The Card Sound bridge (224 m from
// Monroe) and the Deerfield pier (139 m) stay outside, as does open water.
//
// CONFIGURATION. MARKET_STATUS overrides a status without a code change:
//   MARKET_STATUS=fl-broward:waitlist            take Broward out of service
//   MARKET_STATUS=fl-monroe:active               — refused: Monroe belongs to no region with
//                                                  routing, fares and a jurisdiction record
// A market can be ACTIVE only if it belongs to a configured region (regions.js). A refused
// override is logged and the market stays WAITLIST.
const { regionById, regionFor } = require('./regions');
const { readKey } = require('./env');
const FL = require('./markets/fl-counties.json');

const SHORE_M = 100;

/** The counties of each operating region, and their status as shipped. */
const REGION_COUNTIES = {
  'fl-southeast': { '12086': 'active', '12011': 'active', '12099': 'active' },
};

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function buildMarkets() {
  const overrides = {};
  for (const pair of String(readKey('MARKET_STATUS') || '').split(',')) {
    const [id, st] = pair.split(':');
    if (id && (st === 'active' || st === 'waitlist')) overrides[id] = st;
  }
  return FL.counties.map((c) => {
    const regionId = Object.keys(REGION_COUNTIES).find((r) => REGION_COUNTIES[r][c.fips]) || null;
    const id = `fl-${slug(c.name)}`;
    let status = regionId ? REGION_COUNTIES[regionId][c.fips] : 'waitlist';
    if (overrides[id]) {
      if (overrides[id] === 'active' && !(regionId && regionById(regionId))) {
        console.error(`[markets] MARKET_STATUS refused: ${id} belongs to no configured region`);
      } else {
        status = overrides[id];
      }
    }
    return Object.freeze({
      id,
      name: `${c.name} County`,
      county: c.name,
      state: 'FL',
      fips: c.fips,
      regionId,
      status,
      geometry: c.geometry,
    });
  });
}

// READ WHEN ASKED, like regions.js server addresses, so a status set after start-up (or by a
// test) counts. Rebuilding is cheap: 67 records.
let _cache = null;
let _key = null;
function markets() {
  const key = readKey('MARKET_STATUS') || '';
  if (!_cache || key !== _key) {
    _cache = buildMarkets();
    _key = key;
  }
  return _cache;
}

const isCoord = (p) =>
  !!p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

function inRing(x, y, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const polygons = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
function contains(g, x, y) {
  return polygons(g).some((poly) => inRing(x, y, poly[0]) && !poly.slice(1).some((h) => inRing(x, y, h)));
}
function distanceKm(g, x, y) {
  const k = Math.cos((y * Math.PI) / 180);
  let best = Infinity;
  for (const poly of polygons(g)) {
    for (const ring of poly) {
      for (let i = 1; i < ring.length; i++) {
        const ax = (ring[i - 1][0] - x) * k;
        const ay = ring[i - 1][1] - y;
        const bx = (ring[i][0] - x) * k;
        const by = ring[i][1] - y;
        const dx = bx - ax;
        const dy = by - ay;
        const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy) * 111.32);
      }
    }
  }
  return best;
}

/** The market (county) a point is in, or null when it is in none we hold a boundary for. */
function marketFor(p) {
  if (!isCoord(p)) return null;
  const x = Number(p.lng);
  const y = Number(p.lat);
  const all = markets();
  const hit = all.find((m) => contains(m.geometry, x, y));
  if (hit) return hit;
  // In no county: the shoreline allowance, and only when exactly one county is that close.
  const near = all.filter((m) => distanceKm(m.geometry, x, y) * 1000 <= SHORE_M);
  return near.length === 1 ? near[0] : null;
}

/** 'active' or 'waitlist'. Anywhere without a market record is waitlist. */
function marketStatus(p) {
  return marketFor(p)?.status === 'active' ? 'active' : 'waitlist';
}

/** Is this point in an ACTIVE market? */
const servesPoint = (p) => marketStatus(p) === 'active';

/**
 * May a travel from `pickup` to `dest` be sold? null when yes, else which end is the problem.
 * The pickup must be in an ACTIVE market; the destination must be inside that market's
 * operating region (regions.js), in any county. Restricted places (airports, seaports) are
 * fees.js's permitRequired, applied separately to both ends.
 */
function tripOutsideMarkets(pickup, dest) {
  const m = marketFor(pickup);
  const pickupOk = m?.status === 'active';
  const destRegion = regionFor(dest);
  const destOk = !!destRegion && (!pickupOk || destRegion.id === m.regionId);
  if (!pickupOk && !destOk) return 'both';
  if (!pickupOk) return 'pickup';
  if (!destOk) return 'destination';
  return null;
}

/** Plain data for /health and /ops: every non-default market, and the active ones. */
function listMarkets() {
  return markets()
    .filter((m) => m.status === 'active' || m.regionId)
    .map(({ id, name, fips, regionId, status }) => ({ id, name, fips, regionId, status }));
}

module.exports = { marketFor, marketStatus, servesPoint, tripOutsideMarkets, listMarkets, markets, SHORE_M };
