// Smart Travel — car → transit → car, planned by OpenTripPlanner and priced here.
//
// UNTIL 9 SEPT 2026 this file carried its own Metrorail: 23 stations typed by hand, a typed
// line order, 2.5 minutes a stop and 6 for the transfer. It was the app's private opinion of
// a railway, and it could not know about Metromover, a bus lane, a closed station or a train
// that was not running. Chad ordered the list deleted and the planning done by a real OTP
// server on Miami-Dade GTFS (backend/transit.js, infra/otp/). What remains here is what only
// American Rider can decide: which ends of the journey we drive, what those legs cost, and
// what the traveler saves against driving the whole way.
//
// MONEY, THE RULES (founders, 9 Sept 2026):
//   - We charge for the car legs we operate, with coordinated platform pricing across the journey. Each real car Travel is charged\n//     separately, and the combined fee funds the actual transaction count. The formula lives in\n//     payments.js and is imported, not copied.
//   - Transit fares are paid by the traveler to the agency. They are never charged by us and
//     never inside smartCents; they are REPORTED (transitFareCents) so the traveler sees what
//     the journey actually costs, and the saving is journey against journey.
//   - Smart Travel is shown whenever a transit route exists, with its numbers, whether or not
//     it wins. The old "rail must save $3 and 8 minutes" gate is withdrawn: the client decides
//     emphasis; the server does not decide what a traveler may see.
//
// THE ANSWER is one of { status: 'ok', plan }, { status: 'none' } (no transit route exists),
// { status: 'unavailable' } (the planner is not answering). Never a throw.
const { fareCentsForCoords, straightLineMiles } = require('./fares');
const { quote } = require('./payments');
const { governmentFeesFor } = require('./fees');
const { REGIONS, regionForTrip } = require('./regions');
const transit = require('./transit');

// --- Agency fares ---------------------------------------------------------------------------
// WHAT THE TRAVELER PAYS THE AGENCY, per boarding, in cents — read from the travel's region
// (regions.js transit.feeds), which is the only place a transit fare is written. It is
// reported and added to journeyCents; it is NEVER part of what American Rider charges (see
// the rules above).
//
// A leg is matched to a feed by the prefix OTP puts on its route id ('MDT:31009' → MDT)
// first, and by agency name only when a leg carries no prefixed id. A feed's freeModes ride at
// $0 — Metromover and the MIA Mover are 'tram' on MDT. A fare the table does not know is
// `null`: the leg carries fareUnknown: true and counts as $0 in the totals, and the plan
// carries transitFareUnknown: true so the client can say so.
const normalise = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sameAgency = (a, b) => {
  const x = normalise(a);
  const y = normalise(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

/** A region's fare table: one row per feed, { feedId, name, cents, freeModes }. */
function fareGroupsFor(region) {
  const feeds = region && region.transit && Array.isArray(region.transit.feeds) ? region.transit.feeds : [];
  return feeds.map((f) => ({ feedId: f.feedId, name: f.agency, cents: f.fareCents == null ? null : f.fareCents, freeModes: f.freeModes || [], transferIncluded: f.transferIncluded === true }));
}

/** The fare table row a leg falls under, or null when its feed is not known here. */
function transitFareGroup(leg, region) {
  const route = (leg && leg.route) || {};
  const id = typeof route.gtfsId === 'string' ? route.gtfsId : '';
  const rows = (region ? [region] : REGIONS).flatMap(fareGroupsFor);
  const row = rows.find((r) => id.startsWith(`${r.feedId}:`)) || rows.find((r) => sameAgency(route.agency, r.name)) || null;
  if (!row) return null;
  return row.freeModes.includes(leg.mode) ? { ...row, cents: 0, free: true } : row;
}
/** The agency's fare for one boarding, in cents, or null when it is not known here. */
function transitFareFor(leg, region) {
  const g = transitFareGroup(leg, region);
  return g ? g.cents : null;
}

// --- Time and distance ----------------------------------------------------------------------
const WALK_MILES = 0.4; // an access or egress shorter than this is walked, not driven
const WALK_MPH = 3; // used only when OTP planned that end by car and we turn it into a walk
const LEG_MPH = 22; // a car leg's minutes when OTP planned no car leg (it walked instead)
const DIRECT_MPH = 20; // driving the whole way, through traffic
const DIRECT_EXTRA_MIN = 4;
const METERS_PER_MILE = 1609.344;
const PLATFORM_CHANGE_METERS = 80; // a transfer walk shorter than this is a platform change, not a leg

const isCoord = (c) =>
  !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180;
const round1 = (n) => Math.round(n * 10) / 10;
const sum = (xs, f) => xs.reduce((s, x) => s + (f(x) || 0), 0);
const minutesOf = (sec) => Math.max(1, Math.round(sec / 60));
const isoPlus = (iso, minutes) => new Date(Date.parse(iso) + minutes * 60000).toISOString();

// --- Names ----------------------------------------------------------------------------------
// The feed's platform names are operational: "EARLINGTON HTS.STAT.RAIL NORTHBOUND". A traveler
// is told what the place is called: "Earlington Heights". Only shouted (all-upper-case) names
// are rewritten; a feed that already writes "Boca Raton Station" is left alone. A leg's
// `route` keeps the feed's raw names, untouched, for the client's own catalogue.
const KEEP_CAPS = new Set(['MIA', 'FIU', 'FL', 'US', 'NW', 'NE', 'SW', 'SE', 'N', 'S', 'E', 'W', 'MDC', 'UM']);
const SMALL_WORDS = new Set(['of', 'and', 'at', 'the', 'via', 'to', 'de', 'del', 'la']);
const SPELLINGS = { UHEALTH: 'UHealth', PORTMIAMI: 'PortMiami', MIABEACH: 'Miami Beach' };
const titleWord = (w, i) => {
  const up = w.toUpperCase();
  if (SPELLINGS[up]) return SPELLINGS[up];
  if (KEEP_CAPS.has(up)) return up;
  const low = w.toLowerCase();
  if (i > 0 && SMALL_WORDS.has(low)) return low;
  return low.replace(/(^|[-'’/(@.])([a-z])/g, (_, pre, c) => pre + c.toUpperCase());
};
function tidyName(raw) {
  const name = (raw || '').trim();
  if (!name || name !== name.toUpperCase() || !/[A-Z]/.test(name)) return name; // not shouted
  return name
    .replace(/\s*(?:RAIL\s+)?(?:NORTH|SOUTH|EAST|WEST)BOUND\s*$/, '') // the platform's direction
    .replace(/\bSTAT\b\.?/g, 'STATION ')
    .replace(/\bHTS\b\.?/g, 'HEIGHTS ')
    .replace(/\bCTR\b\.?/g, 'CENTER ')
    .replace(/\bINTL\b\.?/g, 'INTERNATIONAL ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(titleWord)
    .join(' ');
}
/** The place a stop is at: "Brickell", "Government Center", "Brickell Metromover". */
const bareName = (stop) => tidyName(stop && stop.name).replace(/\s+Station$/i, '');
/** The place as a traveler is sent to it: "Brickell Station", "Brickell Metromover Station". */
const RAIL_LIKE = new Set(['subway', 'rail']);
const stationName = (stop, mode) => {
  const name = tidyName(stop && stop.name) || 'the station';
  return RAIL_LIKE.has(mode) && !/\bstation\b/i.test(name) ? `${name} Station` : name;
};
const milesText = (miles) => `${round1(miles)} miles`;

/** The Metrorail line a leg rides, when its headsign says: 'Orange Line' | 'Green Line' | null. */
const lineOf = (leg) => {
  const r = leg.route || {};
  // Only Metrorail has lines. The MIA Mover's headsign also says "airport", and it is not one.
  if (!/metrorail/i.test(r.longName || '')) return null;
  const text = `${leg.headsign || ''} ${r.longName || ''} ${r.shortName || ''}`;
  if (/\borange\b/i.test(text)) return 'Orange Line';
  if (/\bgreen\b/i.test(text)) return 'Green Line';
  // The feed names neither line; the headsign names the terminus. Only the Orange Line
  // runs to the airport and only the Green Line to Palmetto; the shared trunk stays unnamed.
  if (/airport/i.test(leg.headsign || '')) return 'Orange Line';
  if (/palmetto/i.test(leg.headsign || '')) return 'Green Line';
  return null;
};

// Plain factual English. The client localises from `mode`, `route` and `line`; nothing here
// reassures. The one system named by hand is Metrorail, whose route the feed calls
// "REGULAR METRORAIL SERVICE" for both lines and tells the line only in the headsign.
function transitLabel(leg) {
  const r = leg.route || {};
  const short = tidyName(r.shortName);
  const long = tidyName(r.longName);
  if (leg.mode === 'bus') {
    if (/^\d/.test(short)) return long ? `Route ${short} · ${long}` : `Route ${short}`;
    return long || (short ? `Route ${short}` : 'Bus');
  }
  if (/metrorail/i.test(r.longName || '')) {
    const line = lineOf(leg);
    return line ? `Metrorail ${line}` : 'Metrorail';
  }
  const name = long || short || leg.mode;
  const agency = (r.agency || '').trim();
  // Miami-Dade Transit's routes name their own system ("Metromover Inner Loop"); other
  // agencies' do not ("Mainline"), so the agency is put in front.
  if (agency && !/miami-?dade/i.test(agency) && !name.toLowerCase().includes(agency.toLowerCase())) return `${agency} ${name}`;
  return name;
}

// --- Choosing the itinerary -----------------------------------------------------------------
// The earliest arrival among those with a transit leg; a tie goes to the shorter journey.
function pickItinerary(itineraries) {
  let best = null;
  for (const it of itineraries || []) {
    if (!it || !Array.isArray(it.legs) || !it.legs.some((l) => l.kind === 'transit')) continue;
    if (!best) {
      best = it;
      continue;
    }
    const a = Date.parse(it.endTime);
    const b = Date.parse(best.endTime);
    if (a < b || (a === b && it.durationSec < best.durationSec)) best = it;
  }
  return best;
}

// --- Building our legs ----------------------------------------------------------------------
const placeOf = (p) => {
  const out = { name: bareName(p), lat: p.lat, lng: p.lng };
  if (p.stopId) out.stopId = p.stopId;
  return out;
};

// One end of the journey: everything OTP planned before the first boarding (or after the last
// alighting). Under WALK_MILES it is a walk at $0. Otherwise it is a car leg we operate,
// priced by the same distance model as any other travel, from the traveler's point to the
// stop — minutes from OTP's own car leg when it planned one, else at LEG_MPH.
function endLeg(which, a, b, otpLegs, mode) {
  // WHETHER TO WALK IS DECIDED AS THE CROW FLIES. OTP's car leg to Brickell Station drives
  // 0.4 miles of one-way streets to cover a quarter-mile walk; judged by the driven distance
  // that was a $9.00 car leg for two blocks. A person on foot is not bound by one-way streets.
  const crowMiles = straightLineMiles(a, b);
  const travelledMiles = otpLegs.length ? sum(otpLegs, (l) => l.distanceMeters) / METERS_PER_MILE : crowMiles;
  const from = which === 'access' ? { name: 'Pickup', lat: a.lat, lng: a.lng } : placeOf(a);
  const to = which === 'access' ? placeOf(b) : { name: 'Destination', lat: b.lat, lng: b.lng };
  const station = stationName(which === 'access' ? b : a, mode);

  if (crowMiles < WALK_MILES) {
    const allWalk = otpLegs.length > 0 && otpLegs.every((l) => l.kind === 'walk');
    const walkMiles = allWalk ? travelledMiles : crowMiles * 1.2; // streets, not a straight line
    const sec = allWalk ? sum(otpLegs, (l) => l.durationSec) : (walkMiles / WALK_MPH) * 3600;
    return {
      kind: 'walk',
      mode: 'walk',
      label: which === 'access' ? `Walk to ${station}` : `Walk from ${station}`,
      detail: milesText(walkMiles),
      from,
      to,
      minutes: minutesOf(sec),
      cents: 0,
      miles: round1(walkMiles),
    };
  }

  const fare = fareCentsForCoords(a, b);
  if (!fare) return null;
  const carPlanned = otpLegs.some((l) => l.kind === 'car');
  const sec = carPlanned ? sum(otpLegs, (l) => l.durationSec) : (fare.miles / LEG_MPH) * 3600;
  return {
    kind: 'car',
    mode: 'car',
    label: which === 'access' ? `Car to ${station}` : `Car from ${station}`,
    detail: `${milesText(fare.miles)} · American Rider`,
    from,
    to,
    minutes: minutesOf(sec),
    cents: fare.travelCostCents,
    miles: fare.miles,
    // A car leg that begins at an airport or a port carries that authority's pickup fee,
    // fenced from the same coordinates the reservation will be priced from.
    feeLines: governmentFeesFor(a, b),
    governmentFeeCents: governmentFeesFor(a, b).reduce((sum, l) => sum + l.cents, 0),
  };
}

function transitLeg(leg, region) {
  const group = transitFareGroup(leg, region);
  const cents = group ? group.cents : null;
  const line = lineOf(leg);
  const out = {
    kind: 'transit',
    mode: leg.mode,
    route: leg.route,
    label: transitLabel(leg),
    detail: `${stationName(leg.from, leg.mode)} → ${stationName(leg.to, leg.mode)}`,
    from: placeOf(leg.from),
    to: placeOf(leg.to),
    minutes: minutesOf(leg.durationSec),
    cents: cents == null ? 0 : cents,
    miles: round1(leg.distanceMeters / METERS_PER_MILE),
    stops: leg.stops || 0,
  };
  if (leg.headsign) out.headsign = leg.headsign;
  if (line) out.line = line;
  if (group) out.fareGroup = group.name;
  if (cents == null) out.fareUnknown = true;
  return out;
}

function transferLeg(leg) {
  const miles = leg.distanceMeters / METERS_PER_MILE;
  return {
    kind: 'walk',
    mode: 'walk',
    label: `Walk to ${tidyName(leg.to.name) || 'the next stop'}`,
    detail: milesText(miles),
    from: placeOf(leg.from),
    to: placeOf(leg.to),
    minutes: minutesOf(leg.durationSec),
    cents: 0,
    miles: round1(miles),
  };
}

function buildPlan(pickup, dest, itinerary, direct) {
  const legs = itinerary.legs;
  const firstT = legs.findIndex((l) => l.kind === 'transit');
  let lastT = -1;
  for (let i = legs.length - 1; i >= 0; i--) {
    if (legs[i].kind === 'transit') {
      lastT = i;
      break;
    }
  }
  if (firstT < 0) return null;
  const middle = legs.slice(firstT, lastT + 1);
  const board = middle[0].from;
  const alight = middle[middle.length - 1].to;

  const region = regionForTrip(pickup, dest);
  const access = endLeg('access', pickup, board, legs.slice(0, firstT), middle[0].mode);
  const egress = endLeg('egress', alight, dest, legs.slice(lastT + 1), middle[middle.length - 1].mode);
  if (!access || !egress) return null;

  const ours = [access];
  for (const leg of middle) {
    // A platform change (Metrorail to the MIA Mover is 13 metres) is not a leg a traveler
    // takes; its minutes are still inside departAt → arriveAt.
    if (leg.kind === 'walk' && leg.distanceMeters < PLATFORM_CHANGE_METERS) continue;
    ours.push(leg.kind === 'transit' ? transitLeg(leg, region) : transferLeg(leg));
  }
  ours.push(egress);

  // Transfer policy is agency/feed data, never a universal transit assumption. Only a feed
  // explicitly configured with transferIncluded=true may collapse later paid boardings into
  // the first fare. Unknown policy therefore errs toward not understating the Traveler's cost.
  const paid = new Set();
  for (const l of ours) {
    if (l.kind !== 'transit' || !l.fareGroup || !(l.cents > 0)) continue;
    const group = transitFareGroup(l, region);
    if (group?.transferIncluded && paid.has(l.fareGroup)) {
      l.cents = 0;
      l.transfer = true;
    } else if (group?.transferIncluded) {
      paid.add(l.fareGroup);
    }
  }

  // Money. Each car leg is a real, separately charged Travel. Quote the first leg normally,
  // then quote the second as the continuation of that paid journey. This keeps the screen's
  // preview on the SAME two-transaction economics that payment uses, instead of the historical
  // one-fee-on-combined-fare shortcut.
  const carLegs = ours.filter((l) => l.kind === 'car');
  const carCents = sum(carLegs, (l) => l.cents);
  const governmentFeeCents = sum(carLegs, (l) => l.governmentFeeCents || 0);
  let feeCents = 0;
  let smartCents = 0;
  if (carLegs.length === 1) {
    const q = quote(carLegs[0].cents, null, carLegs[0].feeLines || [], null, 0);
    feeCents = q.appFee;
    smartCents = q.travelerPays;
  } else if (carLegs.length >= 2) {
    const first = carLegs[0];
    const second = carLegs[carLegs.length - 1];
    const q1 = quote(first.cents, null, first.feeLines || [], null, 0);
    const q2 = quote(second.cents, {
      journeyNo: 'smart-preview',
      leg1FareCents: first.cents,
      leg1GovernmentFeeCents: first.governmentFeeCents || 0,
      leg1TollCents: 0,
    }, second.feeLines || [], null, 0);
    feeCents = q1.appFee + q2.appFee;
    smartCents = q1.travelerPays + q2.travelerPays;
  }
  const transitFareCents = sum(ours, (l) => (l.kind === 'transit' ? l.cents : 0));
  const transitFareUnknown = ours.some((l) => l.fareUnknown);
  const journeyCents = smartCents + transitFareCents;
  const directCents = quote(direct.travelCostCents, null, governmentFeesFor(pickup, dest), null, 0).travelerPays;
  const saveCents = directCents - journeyCents;

  // Time. The transit part is OTP's timetable; our ends are added on either side of it.
  const departAt = isoPlus(middle[0].startTime, -access.minutes);
  const arriveAt = isoPlus(middle[middle.length - 1].endTime, egress.minutes);
  const smartMin = Math.round((Date.parse(arriveAt) - Date.parse(departAt)) / 60000);
  const directMin = Math.round((direct.miles / DIRECT_MPH) * 60 + DIRECT_EXTRA_MIN);
  const saveMin = directMin - smartMin;

  const plan = {
    status: 'ok',
    from: { id: board.stopId || '', name: bareName(board), lat: board.lat, lng: board.lng },
    to: { id: alight.stopId || '', name: bareName(alight), lat: alight.lat, lng: alight.lng },
    legs: ours,
    smartCents, // what American Rider charges across the real car Travels and any government fee
    feeCents,
    governmentFeeCents, // an airport or port pickup fee on a car leg, passed through
    carCents,
    transitFareCents, // paid by the traveler to the agency, never to us
    railFareCents: transitFareCents, // older clients read the fare under this name
    journeyCents, // smartCents + transitFareCents — what the trip costs the traveler
    directCents,
    saveCents,
    smartMin,
    directMin,
    saveMin,
    departAt,
    arriveAt,
  };
  if (transitFareUnknown) plan.transitFareUnknown = true;
  return plan;
}

/**
 * Plans and prices a Smart Travel journey. opts.planTransit substitutes the planner (tests);
 * opts.when is the earliest departure (default now).
 */
async function smartQuote(pickup, dest, opts = {}) {
  if (!isCoord(pickup) || !isCoord(dest)) return { status: 'none', reason: 'bad_coords' };
  const direct = fareCentsForCoords(pickup, dest);
  if (!direct) return { status: 'none', reason: 'outside_market' };

  const plan = typeof opts.planTransit === 'function' ? opts.planTransit : transit.planTransit;
  const when = opts.when instanceof Date ? opts.when : new Date();
  const ask = (access, egress) => plan({ from: pickup, to: dest, when, access, egress });

  let res;
  try {
    res = await ask('CAR_DROP_OFF', 'CAR_PICKUP');
    // A server whose schema predates car access/egress: plan on foot and let endLeg() turn a
    // long walk into the car leg it would have been.
    if (res && res.status === 'unavailable' && res.code === 'unsupported_mode') res = await ask('WALK', 'WALK');
  } catch (e) {
    return { status: 'unavailable', reason: (e && e.message) || String(e) };
  }
  if (!res || res.status === 'unavailable') return { status: 'unavailable', reason: (res && res.reason) || 'no answer' };
  if (res.status !== 'ok') return { status: 'none' };

  const itinerary = pickItinerary(res.itineraries);
  if (!itinerary) return { status: 'none' };
  const built = buildPlan(pickup, dest, itinerary, direct);
  if (!built) return { status: 'none' };
  return { status: 'ok', plan: built };
}

/**
 * Re-checks the transit middle of an already selected Smart Travel against the region's current
 * OTP state. This is intentionally geography-agnostic: OTP decides which configured GTFS /
 * realtime feeds apply. It never silently blesses an old itinerary when the planner is down.
 */
async function revalidateTransit(currentPlan, opts = {}) {
  if (!currentPlan || !isCoord(currentPlan.from) || !isCoord(currentPlan.to)) return { status: 'none', reason: 'bad_plan' };
  const plan = typeof opts.planTransit === 'function' ? opts.planTransit : transit.planTransit;
  const when = opts.when instanceof Date ? opts.when : new Date();
  let res;
  try { res = await plan({ from: currentPlan.from, to: currentPlan.to, when, access: 'WALK', egress: 'WALK', first: 4 }); }
  catch (e) { return { status: 'unavailable', reason: (e && e.message) || String(e) }; }
  if (!res || res.status === 'unavailable') return { status: 'unavailable', reason: (res && res.reason) || 'no answer' };
  if (res.status !== 'ok') return { status: 'none', reason: res.reason || 'no_current_transit' };
  const itinerary = pickItinerary(res.itineraries);
  if (!itinerary) return { status: 'none', reason: 'no_current_transit' };
  const oldTransit = (currentPlan.legs || []).filter((l) => l.kind === 'transit');
  const newTransit = (itinerary.legs || []).filter((l) => l.kind === 'transit');
  const sig = (legs) => legs.map((l) => [l.route?.gtfsId || '', l.from?.stopId || '', l.to?.stopId || ''].join('|')).join('>');
  const changed = sig(oldTransit) !== sig(newTransit);
  return {
    status: 'ok',
    changed,
    checkedAt: when.toISOString(),
    departAt: newTransit[0]?.startTime || itinerary.startTime || null,
    arriveAt: newTransit[newTransit.length - 1]?.endTime || itinerary.endTime || null,
    routeSignature: sig(newTransit),
  };
}

module.exports = { smartQuote, revalidateTransit, transitFareFor, transitFareGroup, fareGroupsFor, pickItinerary, tidyName, WALK_MILES };
