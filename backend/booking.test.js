const assert = require('node:assert/strict');
const { bookingId, prepareBooking, paymentMatches, assignPaidTravel } = require('./booking');
const { matchOperator } = require('./matching');
const { DISCLOSURE_VERSION } = require('./disclosure');

function store() {
  const data = new Map(); let tail = Promise.resolve();
  const db = {
    data,
    collection(name) { return { doc(id) { return { id, path: `${name}/${id}` }; } }; },
    runTransaction(fn) {
      const run = tail.then(() => fn({
        async get(ref) { return { exists: data.has(ref.path), data: () => structuredClone(data.get(ref.path)) }; },
        create(ref, value) { assert(!data.has(ref.path)); data.set(ref.path, structuredClone(value)); },
        update(ref, fields) { assert(data.has(ref.path)); data.set(ref.path, { ...data.get(ref.path), ...structuredClone(fields) }); },
      }));
      tail = run.catch(() => {});
      return run;
    },
  };
  return db;
}
const now = 2_000_000_000_000;
const quote = {
  tripNo: 'AR-1-MIA', pickupLat: 25.77, pickupLng: -80.19,
  travelClass: 'Standard', travelCostCents: 2000, costCents: 2350,
};
const operator = {
  id: 'operator-1', name: 'Operator One', available: true,
  lat: 25.77, lng: -80.19, onlineAt: now, commissioned: true,
  disclosureVersion: DISCLOSURE_VERSION, screeningCheckedAt: now,
  classes: ['Standard'], car: 'Car', plate: 'Plate',
};
function provider(rideId, uid, amount = 2350) {
  return { id: `pi_${rideId}`, status: 'succeeded', currency: 'usd', amount_received: amount,
    metadata: { uid, rideId } };
}
async function main() {
  const db = store(); const key = 'booking-uuid-00000001';
  const first = await prepareBooking({ db, uid: 'traveler-1', key, fingerprint: 'route-a', record: quote, now });
  assert.equal(first.status, 201);
  const same = await prepareBooking({ db, uid: 'traveler-1', key, fingerprint: 'route-a', record: { ...quote, costCents: 999 }, now });
  assert.equal(same.status, 200); assert.equal(same.body.rideId, first.body.rideId);
  assert.equal(db.data.get(`rides/${first.body.rideId}`).costCents, 2350, 'retry must not reprice or overwrite');
  assert.equal((await prepareBooking({ db, uid: 'traveler-1', key, fingerprint: 'route-b', record: quote, now })).status, 409);
  assert.notEqual(bookingId('traveler-1', key), bookingId('traveler-2', key));
  const id = first.body.rideId;
  db.data.set(`rides/${id}`, { ...db.data.get(`rides/${id}`), paymentIntentId: `pi_${id}` });
  assert(!paymentMatches(db.data.get(`rides/${id}`), provider(id, 'attacker'), 'traveler-1', id));
  assert(!paymentMatches(db.data.get(`rides/${id}`), provider(id, 'traveler-1', 999), 'traveler-1', id));
  assert(!paymentMatches(db.data.get(`rides/${id}`), { ...provider(id, 'traveler-1'), status: 'processing' }, 'traveler-1', id));
  assert.equal((await assignPaidTravel({ db, uid: 'traveler-2', rideId: id, payment: provider(id, 'traveler-1'), candidate: null, now })).status, 403);
  assert.equal((await assignPaidTravel({ db, uid: 'traveler-1', rideId: id, payment: provider(id, 'attacker'), candidate: null, now })).status, 409);
  const noSupply = await assignPaidTravel({ db, uid: 'traveler-1', rideId: id, payment: provider(id, 'traveler-1'), candidate: null, now });
  assert.equal(noSupply.body.matched, null);
  assert.equal(db.data.get(`rides/${id}`).status, 'awaiting_assignment');
  db.data.set('operators/operator-1', operator);
  const second = await prepareBooking({ db, uid: 'traveler-2', key: 'booking-uuid-00000002', fingerprint: 'route-b', record: { ...quote, tripNo: 'AR-2-MIA' }, now });
  const secondId = second.body.rideId;
  db.data.set(`rides/${secondId}`, { ...db.data.get(`rides/${secondId}`), paymentIntentId: `pi_${secondId}` });
  const candidate = { operator, miles: 0, etaMin: 1 };
  const [a, b] = await Promise.all([
    assignPaidTravel({ db, uid: 'traveler-1', rideId: id, payment: provider(id, 'traveler-1'), candidate, now }),
    assignPaidTravel({ db, uid: 'traveler-2', rideId: secondId, payment: provider(secondId, 'traveler-2'), candidate, now }),
  ]);
  assert.equal(a.status, 200); assert.equal(a.body.matched.id, operator.id);
  assert.equal(b.status, 409); assert.equal(b.body.code, 'operator_unavailable');
  assert.equal(db.data.get('operators/operator-1').currentRideId, id);
  assert.equal(matchOperator([{ ...db.data.get('operators/operator-1'), id: operator.id }],
    { lat: quote.pickupLat, lng: quote.pickupLng }, 'Standard', { now }), null);
  assert.equal(db.data.get(`rides/${secondId}`).status, 'awaiting_payment');
  const retry = await assignPaidTravel({ db, uid: 'traveler-1', rideId: id, payment: provider(id, 'traveler-1'), candidate, now });
  assert.equal(retry.status, 200); assert.equal(retry.body.reused, true);
  const secondOperator = { ...operator, id: 'operator-2', name: 'Operator Two' };
  db.data.set('operators/operator-2', secondOperator);
  db.data.set(`rides/${id}`, { ...db.data.get(`rides/${id}`), releasedAt: now + 1 });
  const reoffered = await assignPaidTravel({ db, uid: 'traveler-1', rideId: id,
    payment: provider(id, 'traveler-1'), candidate: { operator: secondOperator }, now: now + 2 });
  assert.equal(reoffered.status, 200);
  assert.equal(reoffered.body.rideId, id, 'same paid Travel on reoffer');
  assert.equal(reoffered.body.matched.id, secondOperator.id);
  assert.equal(db.data.get('operators/operator-1').currentRideId, null);
  assert.equal(db.data.get('operators/operator-2').currentRideId, id);
  assert.deepEqual(db.data.get(`rides/${id}`).declinedBy, [operator.id]);
  console.log('PASS canonical paid booking, ownership, amount, idempotency and one-Operator capacity');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
