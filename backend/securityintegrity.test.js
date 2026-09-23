const { authoritativeFare } = require('./fareauthority');
const { payForTravel } = require('./travelmoney');
const { authorizeVoiceTravel, lostItemTravel, authorizeAnnouncement, claimAnnouncement } = require('./trustboundaries');
const results = [];
const check = (label, ok) => results.push({ label, ok: !!ok });
const copy = (x) => JSON.parse(JSON.stringify(x));

function fakeDb(seed) {
  const data = copy(seed);
  const docsFor = (c) => Object.entries(data[c] || {}).map(([id, value]) => ({ id, data: () => copy(value) }));
  return { data, collection: (c) => ({
    doc: (id) => ({
      get: async () => ({ exists: !!data[c]?.[id], data: () => copy(data[c]?.[id]) }),
      update: async (fields) => { data[c][id] = { ...data[c][id], ...copy(fields) }; },
    }),
    where(field, _op, value) {
      const filters = [[field, value]];
      const q = {
        where(f, _ignored, v) { filters.push([f, v]); return q; }, limit() { return q; },
        async get() { return { docs: docsFor(c).filter((d) => filters.every(([f, v]) => String(d.data()[f]) === String(v))) }; },
      };
      return q;
    },
  }) };
}

(async () => {
  const route = { pickup: { lat: 25.7617, lng: -80.1918 }, dest: { lat: 25.783, lng: -80.205 }, destination: 'Wynwood', travelClass: 'Standard' };
  const baseline = await authoritativeFare({ body: route });
  for (const attack of [
    { costCents: 0, miles: 0, feeLines: [] }, { costCents: 1, travelCostCents: 1, miles: 0.01 },
    { costCents: -100, travelCostCents: -100, miles: -8 },
    { costCents: 999999999, travelCostCents: 999999999, miles: 999999 },
    { feeLines: [{ id: 'fake', payee: 'attacker', cents: 999999 }] },
  ]) {
    const got = await authoritativeFare({ body: { ...route, ...attack } });
    check(`computed fare fields cannot change the authoritative fare: ${JSON.stringify(attack)}`,
      got.travelerPays === baseline.travelerPays && got.travelCostCents === baseline.travelCostCents &&
      got.miles === baseline.miles && JSON.stringify(got.feeLines) === JSON.stringify(baseline.feeLines));
  }

  const db = fakeDb({ rides: { r1: { travelerUid: 'alice', operatorId: 'op1', tripNo: 'AR-SERVER-MIA', status: 'assigned', travelCostCents: baseline.travelCostCents, costCents: baseline.travelerPays, feeLines: baseline.feeLines } } });
  let charged;
  const paid = await payForTravel({ db, uid: 'alice', rideId: 'r1', create: async (binding) => {
    charged = binding; return { paymentIntentId: 'pi_1', breakdown: { feeLines: [] } };
  } });
  check('payment receives the authoritative Travel record', paid.status === 200 && charged.ride.costCents === baseline.travelerPays && charged.tripNo === 'AR-SERVER-MIA');

  const authDb = fakeDb({ rides: {
    live: { travelerUid: 'alice', operatorId: 'op1', tripNo: 'AR-100-MIA', status: 'arrived' },
    done: { travelerUid: 'alice', operatorId: 'op1', tripNo: 'AR-101-MIA', status: 'completed' },
    cancelled: { travelerUid: 'alice', operatorId: 'op1', tripNo: 'AR-102-MIA', status: 'cancelled' },
  }, lost_items: {
    itemA: { travelerUid: 'alice', tripNo: 'AR-100-MIA', notifiedOperatorIds: ['substitute'] },
    itemB: { travelerUid: 'bob', tripNo: 'AR-100-MIA' },
  } });
  check('a live Traveler is authorized for voice', (await authorizeVoiceTravel({ db: authDb, uid: 'alice', rideId: 'live' })).side === 'traveler');
  check('the assigned Operator is authorized for voice', (await authorizeVoiceTravel({ db: authDb, uid: 'op1', rideId: 'live' })).side === 'operator');
  check('an unrelated account is refused voice', !(await authorizeVoiceTravel({ db: authDb, uid: 'mallory', rideId: 'live' })).ok);
  check('completed Travel is refused voice', !(await authorizeVoiceTravel({ db: authDb, uid: 'alice', rideId: 'done' })).ok);
  check('cancelled Travel is refused voice', !(await authorizeVoiceTravel({ db: authDb, uid: 'alice', rideId: 'cancelled' })).ok);
  check('a Travel Number used as a document id cannot authorize voice', !(await authorizeVoiceTravel({ db: authDb, uid: 'alice', rideId: 'AR-100-MIA' })).ok);

  const own = await lostItemTravel({ db: authDb, uid: 'alice', lostItemId: 'itemA' });
  check('a legitimate return derives its Operator from the Travel', own.ok && own.ride.operatorId === 'op1');
  check('a substituted Operator id has no authority', own.ok && own.ride.operatorId !== own.item.notifiedOperatorIds[0]);
  check("Traveler A cannot use Traveler B's report", !(await lostItemTravel({ db: authDb, uid: 'alice', lostItemId: 'itemB' })).ok);

  const live = authDb.data.rides.live;
  check('false assigned announcement is refused', !authorizeAnnouncement({ ride: live, uid: 'alice', event: 'assigned' }).ok);
  check('arrived state permits the assigned Operator', authorizeAnnouncement({ ride: live, uid: 'op1', event: 'arrived' }).ok);
  check('the Traveler cannot announce arrival', !authorizeAnnouncement({ ride: live, uid: 'alice', event: 'arrived' }).ok);
  check('false completion is refused', !authorizeAnnouncement({ ride: live, uid: 'op1', event: 'completed' }).ok);
  check('completed state permits the assigned Operator', authorizeAnnouncement({ ride: authDb.data.rides.done, uid: 'op1', event: 'completed' }).ok);

  const claims = new Set();
  const rideRef = { collection: () => ({ doc: (event) => ({
    create: async () => { if (claims.has(event)) { const e = new Error('already exists'); e.code = 6; throw e; } claims.add(event); },
  }) }) };
  check('the first operational announcement claims its event', (await claimAnnouncement({ rideRef, uid: 'op1', event: 'arrived' })).ok);
  check('a repeated operational announcement is idempotent', (await claimAnnouncement({ rideRef, uid: 'op1', event: 'arrived' })).duplicate);

  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}`);
  const serverSource = require('fs').readFileSync(require('path').join(__dirname, 'server.js'), 'utf8');
  check('committed Travel requires coordinate-derived pricing', /route_geometry_required/.test(serverSource));
  check('Travel Number is derived from authoritative pickup market', /travelNumberFor\(ref\.id, pickup\)/.test(serverSource));
  check('scheduled Travel rejects a past timestamp', /atMs <= Date\.now\(\)/.test(serverSource) && /scheduled_time_required/.test(serverSource));
  const fareSource = require('fs').readFileSync(require('path').join(__dirname, 'fareauthority.js'), 'utf8');
  check('Smart Travel requires the first leg to be completed', /leg\.status !== 'completed'/.test(fareSource));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
