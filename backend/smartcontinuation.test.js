const assert = require('node:assert/strict');
const { smartQuote, revalidateTransit } = require('./smart');
const { quote } = require('./payments');
const origin = { lat: 25.7683, lng: -80.183 };
const board = { name: 'Brickell', lat: 25.7656, lng: -80.1936, stopId: 'MDT:BRICKELL' };
const otherBoard = { name: 'Government Center', lat: 25.7753, lng: -80.1947, stopId: 'MDT:GOVT' };
const alight = { name: 'Miami International Airport', lat: 25.7959, lng: -80.2606, stopId: 'MDT:MIA' };
const destination = { lat: 25.7959, lng: -80.287 };
const route = (id) => ({ gtfsId: id, shortName: id.split(':')[1], longName: 'Transit service', agency: 'Miami-Dade Transit', agencyId: 'MDT:MDT' });
const time = (m) => new Date(Date.UTC(2026, 8, 26, 17, m)).toISOString();
const leg = (kind, from, to, start, end, meters, id) => ({
  kind, mode: kind === 'transit' ? 'bus' : kind, from, to, startTime: time(start), endTime: time(end),
  durationSec: (end - start) * 60, distanceMeters: meters, ...(id ? { route: route(id) } : {}),
});
const itinerary = (legs) => ({ startTime: legs[0].startTime, endTime: legs.at(-1).endTime, legs, durationSec: 2600 });
const current = itinerary([
  leg('car', origin, board, 0, 7, 1500),
  leg('transit', board, alight, 8, 32, 10000, 'MDT:OLD'),
  leg('car', alight, destination, 33, 42, 2900),
]);
const changed = (boarding = board) => itinerary([
  leg('transit', boarding, alight, 10, 35, 11000, 'MDT:NEW'),
]);
const updated = (boarding = board) => itinerary([
  leg('walk', board, boarding, 7, 10, boarding === board ? 25 : 1500),
  leg('transit', boarding, alight, 10, 35, 11000, 'MDT:NEW'),
  leg('car', alight, destination, 36, 45, 2900),
]);
(async () => {
  const original = await smartQuote(origin, destination, { planTransit: async () => ({ status: 'ok', itineraries: [current] }) });
  assert.equal(original.status, 'ok');
  assert.equal(original.plan.legs[0].kind, 'car');
  const continuation = await revalidateTransit(original.plan, {
    destination,
    planTransit: async ({ to }) => ({ status: 'ok', itineraries: [to.lng === original.plan.to.lng ? changed() : updated()] }),
  });
  assert.equal(continuation.status, 'ok');
  assert.equal(continuation.changed, true);
  assert.ok(continuation.replacementPlan, 'same boarding stop should be offered a preview of the current route');
  const plan = continuation.replacementPlan;
  assert.equal(plan.revision, true);
  assert.deepEqual(plan.legs[0], original.plan.legs[0], 'the already paid car is never rewritten');
  assert.equal(plan.legs[1].route.gtfsId, 'MDT:NEW');
  assert.equal(plan.directCents, 0, 'the original direct comparison must not be reused');
  const first = plan.legs[0], last = plan.legs.at(-1);
  const q1 = quote(first.cents, null, first.feeLines || [], null, 0);
  const q2 = quote(last.cents, {
    journeyNo: 'preview', leg1FareCents: first.cents,
    leg1GovernmentFeeCents: first.governmentFeeCents || 0, leg1TollCents: 0,
  }, last.feeLines || [], null, 0);
  assert.equal(plan.smartCents, q1.travelerPays + q2.travelerPays);
  const elsewhere = await revalidateTransit(original.plan, {
    destination,
    planTransit: async ({ to }) => ({ status: 'ok', itineraries: [to.lng === original.plan.to.lng ? changed(otherBoard) : updated(otherBoard)] }),
  });
  assert.equal(elsewhere.changed, true);
  assert.equal(elsewhere.replacementPlan, undefined, 'a new boarding stop cannot strand the first paid car');
  const outage = await revalidateTransit(original.plan, { destination, planTransit: async () => ({ status: 'unavailable' }) });
  assert.equal(outage.status, 'unavailable');
  assert.equal(outage.replacementPlan, undefined);
  console.log('PASS safe Smart changed-route continuation and fallback gates');
})().catch((error) => { console.error(error); process.exitCode = 1; });
