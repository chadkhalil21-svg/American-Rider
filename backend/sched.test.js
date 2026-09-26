// Exercise backend/scheduler.js against a fake Firestore and a fake Stripe.
// Proves the DECISIONS, which is what the file is: when to dispatch, when to wait, what
// happens when nobody is available, when the card fails, and when we charge and then cannot
// create the travel.
const path = require('path');
const ROOT = __dirname;

// ---- fake Firestore -----------------------------------------------------------------
function makeDb(seed) {
  const data = JSON.parse(JSON.stringify(seed));
  let addCount = 0;
  let addShouldThrow = false;
  const docRef = (col, id) => ({
    __col: col, __id: id,
    async get() {
      const d = data[col]?.[id];
      return { exists: !!d, id, data: () => JSON.parse(JSON.stringify(d)) };
    },
    async set(fields, opts) {
      data[col] = data[col] || {};
      data[col][id] = opts?.merge ? { ...(data[col][id] || {}), ...fields } : { ...fields };
    },
    async update(fields) { Object.assign(data[col][id], fields); },
  });
  const db = {
    collection: (col) => ({
      doc: (id) => docRef(col, id),
      where: (field, op, val) => {
        const rowsFor = () => Object.entries(data[col] || {}).filter(([, r]) => r[field] === val);
        const snap = (rows) => ({
          docs: rows.map(([id, r]) => ({ id, data: () => JSON.parse(JSON.stringify(r)) })),
        });
        // Honours the bound — see the note in monitor.test.js. A double that swallowed
        // .limit(n) would let an unbounded per-tick scan pass its own test.
        return {
          async get() { return snap(rowsFor()); },
          limit: (n) => ({ async get() { return snap(rowsFor().slice(0, n)); } }),
        };
      },
      async get() {
        const rows = Object.entries(data[col] || {});
        return { docs: rows.map(([id, r]) => ({ id, data: () => JSON.parse(JSON.stringify(r)) })) };
      },
      async add(obj) {
        if (addShouldThrow) throw new Error('permission denied (simulated)');
        const id = `ride${++addCount}`;
        data[col] = data[col] || {};
        data[col][id] = obj;
        return { id };
      },
    }),
    async runTransaction(fn) {
      return fn({
        get: (ref) => ref.get(),
        update: (ref, fields) => { Object.assign(data[ref.__col][ref.__id], fields); },
      });
    },
  };
  return { db, data, failAdds: () => { addShouldThrow = true; } };
}

// ---- inject stubs BEFORE scheduler.js is required ------------------------------------
let charge = async () => ({ ok: true, paymentIntentId: 'pi_fake', chargedCents: 2600 });
const tickets = [];
function inject(dbHandle) {
  for (const [rel, exports] of [
    ['./firebase-admin.js', { adminDb: () => dbHandle, adminStatus: () => ({ ok: true, reason: null }) }],
    ['./payments.js', { chargeScheduledTravel: (...a) => charge(...a), connectAccountStatus: async () => ({ payoutsEnabled:true }) }],
    ['./tickets.js', { fileTicket: async (t) => { tickets.push(t); return { caseNo: 'AR-CASE-1' }; } }],
  ]) {
    const p = require.resolve(path.join(ROOT, rel));
    require.cache[p] = { id: p, filename: p, loaded: true, exports, children: [], paths: [] };
  }
  delete require.cache[require.resolve(path.join(ROOT, 'scheduler.js'))];
  return require(path.join(ROOT, 'scheduler.js'));
}

const MIN = 60 * 1000;
const base = (atMinFromNow, extra = {}) => ({
  travelerUid: 'u1', travelerName: 'A. Smith', travelerEmail: 'a@example.com',
  atMs: Date.now() + atMinFromNow * MIN,
  dep: 'Brickell', dest: 'Miami International Airport',
  pickupLat: 25.7617, pickupLng: -80.1918,
  travelClass: 'Standard', travelCostCents: 2450, costCents: 2600,
  tripNo: 'AR-2048-MIA', status: 'reserved', ...extra,
});
// THE FIXTURES CARRY A CURRENT DISCLOSURE. Dispatch has filtered on disclosureVersion since
// 08c0d89, and a record without one is deliberately not dispatchable (dispatchgate.test.js:
// absence is not agreement). These fixtures predate that gate, so every case below failed for
// a reason unrelated to what it asserts. Repaired, not loosened — the gate is statutory.
const { DISCLOSURE_VERSION } = require('./disclosure');
const NOW = Date.now();
const DOC = (kind) => ({ status:'accepted', kind, expiry:'2030-12-31', readAt:NOW, evidence:{ fields: kind==='registration' ? { plate:'ABC123' } : {} } });
const QUALIFIED_USER = (id) => ({ name:id==='opA'?'Nearby N.':'Far F.', stripeAccountId:`acct_${id}`, documents:{ license:DOC('license'), registration:DOC('registration'), insurance:{...DOC('insurance'), evidence:{ fields:{}, insurance:{ namedInsureds:[id==='opA'?'Nearby N.':'Far F.'], vehicles:[{plate:'ABC123'}], effectiveDate:'2025-01-01', expirationDate:'2030-12-31', tncEndorsement:'yes', rideLimits:{combinedSingleLimit:'$1,000,000'}, loggedOnLimits:{bodilyInjuryPerPerson:'$50,000',bodilyInjuryPerIncident:'$100,000',propertyDamage:'$25,000'}, pip:{shown:'yes',amount:'$10,000'}, uninsuredMotorist:{shown:'yes'} } } } }, screening:{ status:'clear', completedAt:NOW } });
const FLEET = {
  opA: { name: 'Nearby N.', lat: 25.7625, lng: -80.1925, available: true, onlineAt: NOW, classes: ['Standard'], disclosureVersion: DISCLOSURE_VERSION, insuranceExpiry:'2030-12-31' },
  opB: { name: 'Far F.', lat: 25.90, lng: -80.30, available: true, onlineAt: NOW, classes: ['Standard'], disclosureVersion: DISCLOSURE_VERSION, insuranceExpiry:'2030-12-31' },
};

const results = [];
const check = (label, cond, detail) => { results.push({ label, ok: !!cond, detail }); };

(async () => {
  // 1. A reservation 40 minutes out is NOT touched at all.
  {
    const h = makeDb({ scheduled_rides: { r1: base(40) }, operators: FLEET, users: { opA: QUALIFIED_USER('opA'), opB: QUALIFIED_USER('opB') } });
    const rep = await inject(h.db).sweepScheduled();
    check('40 min out: outside the window, untouched', rep.considered === 0, JSON.stringify(rep));
  }

  // 2. 20 minutes out with an operator ~1 min away: HELD, not dispatched.
  {
    const h = makeDb({ scheduled_rides: { r1: base(20) }, operators: FLEET, users: { opA: QUALIFIED_USER('opA'), opB: QUALIFIED_USER('opB') } });
    const rep = await inject(h.db).sweepScheduled();
    check('20 min out, operator 1 min away: held',
      rep.waiting === 1 && rep.dispatched.length === 0,
      h.data.scheduled_rides.r1.lastSweepResult);
  }

  // 3. 3 minutes out: dispatched, charged, travel created, operator recorded.
  {
    const h = makeDb({ scheduled_rides: { r1: base(3) }, operators: FLEET, users: { opA: QUALIFIED_USER('opA'), opB: QUALIFIED_USER('opB') } });
    const rep = await inject(h.db).sweepScheduled();
    const ride = h.data.rides && Object.values(h.data.rides)[0];
    check('3 min out: dispatched to the NEAREST operator',
      rep.dispatched.length === 1 && ride?.operatorId === 'opA' && ride?.status === 'assigned',
      JSON.stringify({ rep: rep.dispatched, op: ride?.operatorName }));
    check('  travel carries the payment for settlement', ride?.paymentIntentId === 'pi_fake', ride?.paymentIntentId);
    check('  travel carries the promised hour', typeof ride?.scheduledFor === 'number', ride?.scheduledFor);
    check('  reservation marked dispatched with an ETA',
      h.data.scheduled_rides.r1.status === 'dispatched' && h.data.scheduled_rides.r1.etaMin >= 1,
      JSON.stringify(h.data.scheduled_rides.r1.status));
    check('  claim released', h.data.scheduled_rides.r1.claimedAt === null, h.data.scheduled_rides.r1.claimedAt);
  }

  // 4. Two reservations at once do not both get the same operator.
  {
    const h = makeDb({ scheduled_rides: { r1: base(3), r2: base(3, { tripNo: 'AR-2049-MIA' }) }, operators: FLEET, users: { opA: QUALIFIED_USER('opA'), opB: QUALIFIED_USER('opB') } });
    const rep = await inject(h.db).sweepScheduled();
    const ops = Object.values(h.data.rides || {}).map((r) => r.operatorId);
    check('two due at once: two different operators',
      rep.dispatched.length === 2 && new Set(ops).size === 2, JSON.stringify(ops));
  }

  // 5. Nobody available, still early: waits. Past the grace: unmatched, and NOT charged.
  {
    let charged = 0;
    charge = async () => { charged++; return { ok: true, paymentIntentId: 'pi_x', chargedCents: 1 }; };
    const h = makeDb({ scheduled_rides: { r1: base(3) }, operators: {} });
    const rep = await inject(h.db).sweepScheduled();
    check('no operators, still early: waiting', rep.waiting === 1 && charged === 0, JSON.stringify(rep));

    const h2 = makeDb({ scheduled_rides: { r1: base(-15) }, operators: {} });
    const rep2 = await inject(h2.db).sweepScheduled();
    check('no operators, past grace: unmatched and never charged',
      h2.data.scheduled_rides.r1.status === 'unmatched' && charged === 0,
      h2.data.scheduled_rides.r1.closedReason);
    charge = async () => ({ ok: true, paymentIntentId: 'pi_fake', chargedCents: 2600 });
  }

  // 6. Card declined: NOBODY is sent, and the reservation is released to try again.
  {
    charge = async () => ({ ok: false, code: 'card_declined', error: 'Your card was declined.' });
    const h = makeDb({ scheduled_rides: { r1: base(3) }, operators: FLEET, users: { opA: QUALIFIED_USER('opA'), opB: QUALIFIED_USER('opB') } });
    await inject(h.db).sweepScheduled();
    const r = h.data.scheduled_rides.r1;
    check('card declined: no travel created',
      !h.data.rides && r.status === 'reserved' && r.claimedAt === null, JSON.stringify(r.status));
    check('  the reason is on the record for the traveler', r.paymentError === 'Your card was declined.', r.paymentError);

    // Past the grace it stops retrying and says so.
    const h2 = makeDb({ scheduled_rides: { r1: base(-15) }, operators: FLEET, users: { opA: QUALIFIED_USER('opA'), opB: QUALIFIED_USER('opB') } });
    await inject(h2.db).sweepScheduled();
    check('  past grace: payment_failed', h2.data.scheduled_rides.r1.status === 'payment_failed',
      h2.data.scheduled_rides.r1.status);
    charge = async () => ({ ok: true, paymentIntentId: 'pi_fake', chargedCents: 2600 });
  }

  // 7. Charged but the travel could not be written: flagged AND a case opened.
  {
    const h = makeDb({ scheduled_rides: { r1: base(3) }, operators: FLEET, users: { opA: QUALIFIED_USER('opA'), opB: QUALIFIED_USER('opB') } });
    h.failAdds();
    const rep = await inject(h.db).sweepScheduled();
    const r = h.data.scheduled_rides.r1;
    check('charged but not dispatched: needs_attention', r.status === 'needs_attention', r.status);
    check('  a support case was opened automatically',
      tickets.length === 1 && /REFUND IS OWED/.test(tickets[0].description), tickets[0]?.reason);
    check('  the case number is on the reservation', r.caseNo === 'AR-CASE-1', r.caseNo);
  }

  // 8. A legacy reservation with no pickup is closed, not retried forever.
  {
    const legacy = base(3); delete legacy.pickupLat; delete legacy.pickupLng;
    const h = makeDb({ scheduled_rides: { r1: legacy }, operators: FLEET, users: { opA: QUALIFIED_USER('opA'), opB: QUALIFIED_USER('opB') } });
    await inject(h.db).sweepScheduled();
    check('pre-dispatch reservation: closed with a reason',
      h.data.scheduled_rides.r1.status === 'unmatched', h.data.scheduled_rides.r1.closedReason);
  }

  // 9. A class nobody offers is not fobbed off on a Standard operator.
  {
    const h = makeDb({ scheduled_rides: { r1: base(-15, { travelClass: 'Pet Friendly' }) }, operators: FLEET, users: { opA: QUALIFIED_USER('opA'), opB: QUALIFIED_USER('opB') } });
    await inject(h.db).sweepScheduled();
    check('unserved class: unmatched, not substituted',
      h.data.scheduled_rides.r1.status === 'unmatched' && !h.data.rides,
      h.data.scheduled_rides.r1.closedReason);
  }

  // 10. Expired insurance is not dispatchable.
  {
    const h = makeDb({
      scheduled_rides: { r1: base(3) },
      operators: { opA: { ...FLEET.opA, insuranceExpiry: '2020-01-01' } },
      users: { opA: QUALIFIED_USER('opA') },
    });
    const rep = await inject(h.db).sweepScheduled();
    check('lapsed coverage: not dispatched', rep.dispatched.length === 0 && !h.data.rides, JSON.stringify(rep));
  }

  let bad = 0;
  for (const r of results) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.ok ? '' : '   <-- ' + r.detail}`); }
  console.log(`\n${results.length - bad}/${results.length} passed`);
  process.exit(bad ? 1 : 0);
})();
