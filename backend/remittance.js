// The government-fee ledger: what is owed to each public body for a period, from the rides.
//
// A government fee (fees.js) is collected from the traveler with the fare and held. It is
// owed for a pickup that HAPPENED — the airport's directive charges per pickup, not per
// booking — so the ledger counts completed rides by the time they completed, and a cancelled
// reservation owes nothing. Each ride carries the fee lines the server stamped on it at
// payment (server.js /create-payment-intent); a ride written before that stamp existed is
// re-fenced from its pickup coordinates, so the ledger is never short a ride for want of a
// field.
//
// A period is a calendar month IN THE REGION'S TIME ZONE: the airport's month ends at
// midnight in Miami, not at midnight UTC. monthRange() does that arithmetic with Intl alone.
//
// This module takes the database as an argument and never opens one, so it can be proven
// with a stub and run from a script, a route or a test alike.
const { GOVERNMENT_FEES, governmentFeesFor } = require('./fees');
const { REGIONS, regionById } = require('./regions');

const feeRegion = new Map(GOVERNMENT_FEES.map((f) => [f.id, f.region]));

// --- Calendar ---------------------------------------------------------------------------------
function offsetMinutes(ms, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return Math.round((wall - ms) / 60000);
}

// The instant at which the wall clock in `timeZone` reads 00:00 on the calendar date of the
// UTC instant given. Two passes, because the offset can change on that very day.
function zonedMidnight(utcMidnightMs, timeZone) {
  let t = utcMidnightMs - offsetMinutes(utcMidnightMs, timeZone) * 60000;
  const again = utcMidnightMs - offsetMinutes(t, timeZone) * 60000;
  if (again !== t) t = again;
  return t;
}

/** The half-open range [from, to) in epoch milliseconds of a calendar month (1–12) in a time zone. */
function monthRange(year, month, timeZone) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('monthRange needs a whole year and a month from 1 to 12');
  }
  return {
    from: zonedMidnight(Date.UTC(year, month - 1, 1), timeZone),
    to: zonedMidnight(Date.UTC(year, month, 1), timeZone),
  };
}

// --- The ledger --------------------------------------------------------------------------------
const toMs = (v) => (v instanceof Date ? v.getTime() : Number(v));
const coord = (lat, lng) => {
  if (lat == null || lng == null || lat === '' || lng === '') return null; // Number(null) is 0, and 0,0 is a place
  const a = Number(lat);
  const b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) ? { lat: a, lng: b } : null;
};
const validLine = (l) =>
  l && typeof l.id === 'string' && typeof l.payee === 'string' && Number.isInteger(l.cents) && l.cents > 0;

/** The fee lines a ride carries, or — for a ride paid before lines were stamped — the lines its coordinates earn. */
function linesForRide(ride) {
  if (Array.isArray(ride.feeLines)) return ride.feeLines.filter(validLine);
  const pickup = coord(ride.pickupLat, ride.pickupLng) || (ride.pickup && coord(ride.pickup.lat, ride.pickup.lng));
  const dest = coord(ride.destLat, ride.destLng) || (ride.destCoords && coord(ride.destCoords.lat, ride.destCoords.lng));
  return governmentFeesFor(pickup, dest);
}

/**
 * Sums government fees by payee for rides completed in [from, to).
 *   db          Firestore (or a stub): db.collection('rides').where(...).where(...).get() → { docs }
 *   regionId    keep only fees levied in that region (null: every region)
 * Returns { from, to, rides, feeRides, totalCents, payees: [{ payee, cents, count, fees: [...] }] }.
 * Never rounds: cents in, cents out.
 */
async function remittanceLedger({ db, from, to, regionId = null, timestampField = 'completedAt' }) {
  const fromMs = toMs(from);
  const toMsValue = toMs(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMsValue) || toMsValue <= fromMs) {
    throw new Error('remittanceLedger needs a range whose end is after its start');
  }
  const snap = await db
    .collection('rides')
    .where(timestampField, '>=', fromMs)
    .where(timestampField, '<', toMsValue)
    .get();
  const docs = Array.isArray(snap.docs) ? snap.docs : [];

  const payees = new Map();
  let rides = 0;
  let feeRides = 0;
  let totalCents = 0;
  for (const d of docs) {
    const ride = (typeof d.data === 'function' ? d.data() : d.data) || {};
    if (ride.status !== 'completed') continue;
    rides += 1;
    const lines = linesForRide(ride).filter((l) => !regionId || feeRegion.get(l.id) === regionId);
    if (!lines.length) continue;
    feeRides += 1;
    for (const l of lines) {
      totalCents += l.cents;
      const p = payees.get(l.payee) || { payee: l.payee, cents: 0, count: 0, fees: new Map() };
      p.cents += l.cents;
      p.count += 1;
      const f = p.fees.get(l.id) || { id: l.id, name: l.name || l.id, cents: 0, count: 0 };
      f.cents += l.cents;
      f.count += 1;
      p.fees.set(l.id, f);
      payees.set(l.payee, p);
    }
  }
  const out = [...payees.values()]
    .map((p) => ({ ...p, fees: [...p.fees.values()].sort((a, b) => a.id.localeCompare(b.id)) }))
    .sort((a, b) => a.payee.localeCompare(b.payee));
  return { from: fromMs, to: toMsValue, rides, feeRides, totalCents, payees: out };
}

/**
 * The monthly ledger, one per region, each over that region's own calendar month.
 * month is 1–12. Returns { year, month, regions: [{ region, timezone, ...ledger }] }.
 */
async function monthlyRemittance({ db, year, month, regionIds = null }) {
  const regions = regionIds ? regionIds.map((id) => regionById(id)).filter(Boolean) : REGIONS;
  const out = [];
  for (const r of regions) {
    const { from, to } = monthRange(year, month, r.timezone);
    const ledger = await remittanceLedger({ db, from, to, regionId: r.id });
    out.push({ region: r.id, timezone: r.timezone, ...ledger });
  }
  return { year, month, regions: out };
}

module.exports = { remittanceLedger, monthlyRemittance, monthRange, linesForRide };
