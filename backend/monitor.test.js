const path = require('path');
const { DISCLOSURE_VERSION } = require('./disclosure');
const ROOT = __dirname;
const MIN = 60 * 1000;

function makeDb(seed) {
  const data = JSON.parse(JSON.stringify(seed));
  const db = {
    collection: (col) => ({
      doc: (id) => ({
        async get() { const d = data[col]?.[id]; return { exists: !!d, id, data: () => JSON.parse(JSON.stringify(d)) }; },
        async set(f, o) { data[col] = data[col] || {}; data[col][id] = o?.merge ? { ...(data[col][id] || {}), ...f } : { ...f }; },
      }),
      where: (field, op, val) => {
        const rowsFor = () =>
          Object.entries(data[col] || {}).filter(([, r]) =>
            op === 'in' ? val.includes(r[field]) : r[field] === val);
        const snap = (rows) => ({
          docs: rows.map(([id, r]) => ({ id, data: () => JSON.parse(JSON.stringify(r)) })),
        });
        // `limit` HONOURS THE BOUND rather than ignoring it. A double that accepts .limit(n)
        // and returns everything anyway would let an unbounded scan pass its own test — which
        // is exactly the read bill that exhausted the quota on 30 Aug 2026.
        return {
          async get() { return snap(rowsFor()); },
          limit: (n) => ({ async get() { return snap(rowsFor().slice(0, n)); } }),
        };
      },
      // sweepAssignments lists the whole operator collection to find a replacement.
      async get() {
        return { docs: Object.entries(data[col] || {})
          .map(([id, r]) => ({ id, data: () => JSON.parse(JSON.stringify(r)) })) };
      },
    }),
  };
  return { db, data };
}

const tickets = [];
function inject(dbHandle, { aiKey = false } = {}) {
  for (const [rel, exports] of [
    ['./firebase-admin.js', { adminDb: () => dbHandle, adminStatus: () => ({ ok: true, reason: null }) }],
    ['./tickets.js', { fileTicket: async (t) => { tickets.push(t); return { caseNo: `AR-C${tickets.length}` }; } }],
    ['./env.js', { readKey: (k) => (k === 'ANTHROPIC_API_KEY' && aiKey ? 'fake' : '') }],
    ['./push.js', { notify: async () => ({ ok: true }) }],
  ]) {
    const p = require.resolve(path.join(ROOT, rel));
    require.cache[p] = { id: p, filename: p, loaded: true, exports, children: [], paths: [] };
  }
  delete require.cache[require.resolve(path.join(ROOT, 'monitor.js'))];
  return require(path.join(ROOT, 'monitor.js'));
}

const now = Date.now();
// Two points ~0.2 mi apart, and one ~2 mi away.
const P = { lat: 25.7617, lng: -80.1918 };
const NEAR = { lat: 25.7645, lng: -80.1918 };
const NEAR2 = { lat: 25.7590, lng: -80.1918 };
const FAR = { lat: 25.80, lng: -80.25 };

const ride = (o = {}) => ({
  travelerUid: 'u1', travelerName: 'A. Smith', tripNo: 'AR-2048-MIA',
  operatorId: 'op1', operatorName: 'N. Operator', dep: 'Brickell', dest: 'South Beach',
  status: 'onboard', opLat: P.lat, opLng: P.lng, opAt: now - 20 * 1000,
  // The anchor the monitor last watched it move at — same place = it has not moved.
  monitorSeen: { lat: P.lat, lng: P.lng, at: now - 12 * MIN },
  stillSince: now - 12 * MIN, ...o,
});

const results = [];
const check = (l, c, d) => results.push({ l, ok: !!c, d });

(async () => {
  // 1. Moving normally: nothing said.
  {
    const h = makeDb({ rides: { r1: ride({ stillSince: now - 30 * 1000, monitorSeen: { lat: FAR.lat, lng: FAR.lng, at: now - MIN } }) } });
    const rep = await inject(h.db).sweepMonitor({ now });
    check('moving: no question asked', rep.asked.length === 0 && rep.moving === 1, JSON.stringify(rep));
  }

  // 2. Waiting AT the pickup is not an anomaly.
  {
    const h = makeDb({ rides: { r1: ride({ status: 'arrived' }) } });
    const rep = await inject(h.db).sweepMonitor({ now });
    check('stationary at pickup: not watched', rep.watching === 0 && rep.asked.length === 0, JSON.stringify(rep));
  }

  // 3. Stale telemetry is not a stopped car.
  {
    const h = makeDb({ rides: { r1: ride({ opAt: now - 30 * MIN }) } });
    const rep = await inject(h.db).sweepMonitor({ now });
    check('lost signal: not reported as stopped', rep.watching === 0, JSON.stringify(rep));
  }

  // 4. Stopped alone: the OPERATOR is asked, not the traveler.
  {
    const h = makeDb({ rides: { r1: ride() } });
    const rep = await inject(h.db).sweepMonitor({ now });
    const m = h.data.rides.r1.monitor;
    check('stopped alone: the operator is asked first',
      m.state === 'asked_operator' && rep.asked[0].who === 'operator', m?.state);
    check('  the traveler is NOT asked yet', !m.askedTravelerAt, m?.askedTravelerAt);
  }

  // 5. Three vehicles stopped in the same area: traffic. Nobody is asked.
  {
    const h = makeDb({ rides: {
      r1: ride(),
      // Each one's anchor is at its OWN position — all three genuinely sitting still.
      r2: ride({ opLat: NEAR.lat, opLng: NEAR.lng, operatorId: 'op2', travelerUid: 'u2',
        monitorSeen: { lat: NEAR.lat, lng: NEAR.lng, at: now - 12 * MIN } }),
      r3: ride({ opLat: NEAR2.lat, opLng: NEAR2.lng, operatorId: 'op3', travelerUid: 'u3',
        monitorSeen: { lat: NEAR2.lat, lng: NEAR2.lng, at: now - 12 * MIN } }),
    } });
    const rep = await inject(h.db).sweepMonitor({ now });
    check('three stopped nearby: read as traffic, nobody asked',
      rep.congestion === 3 && rep.asked.length === 0, JSON.stringify({ c: rep.congestion, a: rep.asked }));
    check('  and both parties are TOLD what the delay is',
      /vehicles in this area/.test(h.data.rides.r1.monitor.note), h.data.rides.r1.monitor.note);
  }

  // 6. One stopped, two moving nearby: NOT traffic — this one is asked.
  {
    const h = makeDb({ rides: {
      r1: ride(),
      r2: ride({ opLat: NEAR.lat, opLng: NEAR.lng, operatorId: 'op2', travelerUid: 'u2', stillSince: now - 10 * 1000 }),
      r3: ride({ opLat: NEAR2.lat, opLng: NEAR2.lng, operatorId: 'op3', travelerUid: 'u3', stillSince: now - 10 * 1000 }),
    } });
    const rep = await inject(h.db).sweepMonitor({ now });
    check('one stopped while others move: asked, not excused as traffic',
      rep.congestion === 0 && h.data.rides.r1.monitor.state === 'asked_operator',
      h.data.rides.r1.monitor.state);
  }

  // 7. The operator explains it: settled, no case.
  {
    const h = makeDb({ rides: { r1: ride({ monitor: { state: 'asked_operator', askedOperatorAt: now - 2 * MIN, operatorReply: 'Drawbridge is up on Venetian.' } }) } });
    await inject(h.db).sweepMonitor({ now });
    check('operator explains a road cause: settled',
      h.data.rides.r1.monitor.state === 'explained' && tickets.length === 0,
      h.data.rides.r1.monitor.state);
  }

  // 8. The operator reports a problem: straight to a person, marked urgent.
  {
    tickets.length = 0;
    const h = makeDb({ rides: { r1: ride({ monitor: { state: 'asked_operator', askedOperatorAt: now - 2 * MIN, operatorReply: 'The passenger seems unwell and is not answering me.' } }) } });
    await inject(h.db).sweepMonitor({ now });
    const mon = h.data.rides.r1.monitor;
    check('operator reports a problem: straight to the emergency lane',
      mon.state === 'emergency' && tickets.length === 1, mon.state);
    check('  the case is an emergency, with the position on it',
      tickets[0].kind === 'emergency' && /Last known position/.test(tickets[0].description), tickets[0]?.kind);
    check('  the position is frozen on the record for a dispatcher',
      mon.position && mon.position.lat === P.lat, JSON.stringify(mon.position));
    check('  and it records who raised it', mon.raisedBy === 'operator', mon.raisedBy);
  }

  // 9. Operator silent for four minutes: NOW the traveler is asked.
  {
    tickets.length = 0;
    const h = makeDb({ rides: { r1: ride({ monitor: { state: 'asked_operator', askedOperatorAt: now - 5 * MIN } }) } });
    const rep = await inject(h.db).sweepMonitor({ now });
    check('operator silent: the traveler is asked',
      h.data.rides.r1.monitor.state === 'asked_traveler' && rep.asked[0].who === 'traveler',
      h.data.rides.r1.monitor.state);
  }

  // 10. The traveler says they are fine: it ends there.
  {
    tickets.length = 0;
    const h = makeDb({ rides: { r1: ride({ monitor: { state: 'asked_traveler', askedOperatorAt: now - 12 * MIN, askedTravelerAt: now - 6 * MIN, travelerReply: 'ok' } }) } });
    await inject(h.db).sweepMonitor({ now });
    check('traveler says all is well: no case opened',
      h.data.rides.r1.monitor.state === 'explained' && tickets.length === 0,
      h.data.rides.r1.monitor.state);
  }

  // 11. The traveler asks for help: emergency lane at once.
  {
    tickets.length = 0;
    const h = makeDb({ rides: { r1: ride({ monitor: { state: 'asked_traveler', askedOperatorAt: now - 5 * MIN, askedTravelerAt: now - 1 * MIN, travelerReply: 'help' } }) } });
    const rep = await inject(h.db).sweepMonitor({ now });
    check('traveler asks for help: emergency lane at once',
      tickets.length === 1 && tickets[0].kind === 'emergency'
      && h.data.rides.r1.monitor.state === 'emergency' && rep.emergencies.length === 1,
      JSON.stringify({ k: tickets[0]?.kind, s: h.data.rides.r1.monitor.state }));
  }

  // 11b. An ordinary road answer is settled by the fallback reader, NOT escalated.
  //      This is the triviality test: the vast majority must never reach a person.
  {
    tickets.length = 0;
    const ordinary = [
      'Traffic on the causeway',
      'Waiting on the passenger to come down',
      'Drawbridge',
      'Roadworks, one lane',
      'Stopped for fuel',
      'Accident up ahead, everyone is stopped',
      'Delivery truck blocking the lane',
    ];
    let settled = 0;
    for (const reply of ordinary) {
      const h = makeDb({ rides: { r1: ride({ monitor: { state: 'asked_operator', askedOperatorAt: now - 2 * MIN, operatorReply: reply } }) } });
      await inject(h.db).sweepMonitor({ now });
      if (h.data.rides.r1.monitor.state === 'explained') settled++;
    }
    check(`ordinary delays settle without a person: ${settled}/${ordinary.length}`,
      settled === ordinary.length && tickets.length === 0, `${settled} of ${ordinary.length}`);
  }

  // 11c. Real trouble is never settled, however casually it is worded.
  {
    tickets.length = 0;
    const bad = [
      'We were in a crash',
      'She is not well',
      'Someone hit us',
      'I need an ambulance',
      'The passenger is threatening me',
    ];
    let raised = 0;
    for (const reply of bad) {
      const h = makeDb({ rides: { r1: ride({ monitor: { state: 'asked_operator', askedOperatorAt: now - 2 * MIN, operatorReply: reply } }) } });
      await inject(h.db).sweepMonitor({ now });
      if (h.data.rides.r1.monitor.state === 'emergency') raised++;
    }
    check(`trouble always reaches the emergency lane: ${raised}/${bad.length}`,
      raised === bad.length, `${raised} of ${bad.length}`);
  }

  // 12. Nobody answers at all: a person is brought in.
  {
    tickets.length = 0;
    const h = makeDb({ rides: { r1: ride({ monitor: { state: 'asked_traveler', askedOperatorAt: now - 10 * MIN, askedTravelerAt: now - 6 * MIN } }) } });
    await inject(h.db).sweepMonitor({ now });
    check('nobody answers: case opened', tickets.length === 1 && h.data.rides.r1.monitor.state === 'escalated',
      h.data.rides.r1.monitor.state);
  }

  // 13. It moves again: the question is withdrawn.
  {
    const h = makeDb({ rides: { r1: ride({
      stillSince: now - 10 * 1000, opLat: FAR.lat, opLng: FAR.lng,
      monitor: { state: 'asked_operator', askedOperatorAt: now - 3 * MIN } }) } });
    await inject(h.db).sweepMonitor({ now });
    const m = h.data.rides.r1.monitor;
    check('moving again: the question is withdrawn', m.state === 'clear' && !m.askedOperatorAt, JSON.stringify(m));
  }

  // 14. A phone claiming to be stuck when the server saw it move is not believed.
  {
    const h = makeDb({ rides: { r1: ride({
      stillSince: now - 60 * MIN,                       // the phone says an hour
      monitorSeen: { lat: FAR.lat, lng: FAR.lng, at: now - MIN }, // the server saw it elsewhere
    }) } });
    const rep = await inject(h.db).sweepMonitor({ now });
    check('a phone cannot make itself look stuck', rep.moving === 1 && rep.asked.length === 0, JSON.stringify(rep));
  }

  // ---- sweepAssignments: the path that rescues a traveler nobody answered. ------------
  //
  // UNTESTED UNTIL 29 AUG 2026, which is how it shipped two separate faults at once: a
  // ReferenceError on coverageLapsed swallowed by `catch { continue }`, and a bare `continue`
  // for a ride with no pickup coordinates — which was EVERY ride, because dispatch.ts
  // received the pickup and never wrote it down. Both were invisible: the sweep reported
  // itself healthy while re-offering nothing, ever.
  const assigned = (o = {}) => ({
    travelerUid: 'u1', tripNo: 'AR-2098-MIA', operatorId: 'op1', operatorName: 'First',
    dep: 'Brickell', dest: 'Miami International Airport', status: 'assigned',
    travelClass: 'Standard', createdAt: now - 5 * MIN,
    notifiedOperatorAt: now - 5 * MIN,           // already asked, and did not answer
    pickupLat: P.lat, pickupLng: P.lng, ...o,
  });
  // THE FIXTURES CARRY A CURRENT DISCLOSURE. Dispatch has filtered on disclosureVersion since
  // 08c0d89, and a record without one is deliberately not dispatchable (dispatchgate.test.js:
  // absence is not agreement). These fixtures predate that gate, so every case below failed for
  // a reason unrelated to what it asserts. Repaired, not loosened — the gate is statutory.
  const freeOperator = {
    op2: { uid: 'op2', name: 'Second', available: true, lat: NEAR.lat, lng: NEAR.lng,
           onlineAt: now, classes: ['Standard'], insuranceExpiry: '2099-01-01',
           disclosureVersion: DISCLOSURE_VERSION },
  };

  // 15. Unanswered, and somebody else is free: it moves.
  {
    const h = makeDb({ rides: { r1: assigned() }, operators: freeOperator });
    const rep = await inject(h.db).sweepAssignments({ now });
    check('unanswered travel is re-offered to a free operator',
      rep.reoffered.some((r) => r.rideId === 'r1') && h.data.rides.r1.operatorId === 'op2',
      JSON.stringify(rep) + ' | ' + JSON.stringify(h.data.rides.r1));
  }

  // 14b. THE SAFETY SWEEP SAYS SO WHEN IT CANNOT COVER EVERYBODY. Route monitoring is bounded
  // like the others, because it reads every travel underway once a minute. Unlike the others,
  // a travel it skips is a vehicle nobody is watching — so exceeding the bound must reach
  // /health, not be absorbed. This fails if the overflow ever becomes silent.
  {
    const many = {};
    for (let i = 0; i < 600; i += 1) {
      many[`live${i}`] = {
        status: 'onboard', operatorId: 'op1', travelerUid: 'u1', tripNo: `AR-${i}-MIA`,
        opLat: 25.77, opLng: -80.19, opAt: now, createdAt: now,
      };
    }
    const h = makeDb({ rides: many, operators: freeOperator });
    const rep = await inject(h.db).sweepMonitor({ now });
    check('monitoring more travel than one tick can read is REPORTED, never silent',
      rep.unwatched === true && typeof rep.reason === 'string' && rep.reason.length > 0,
      JSON.stringify({ unwatched: rep.unwatched, watching: rep.watching }));
  }

  // 15b. THE READ BILL (30 Aug 2026). This query runs every 60 seconds — 1,440 times a day —
  // and Firestore bills per document RETURNED, so each travel it matches costs 1,440 reads a
  // day for as long as it sits there. Sixty-seven stale 'assigned' records were costing
  // ~96,000 reads a day against a 50,000/day allowance, on a database nobody was using. The
  // expiry is the cure; the bound is the guard, and this is what stops it being removed.
  {
    const many = {};
    for (let i = 0; i < 400; i += 1) many[`r${i}`] = assigned();
    const h = makeDb({ rides: many, operators: freeOperator });
    const rep = await inject(h.db).sweepAssignments({ now });
    // Counted on `pending` alone: one record can appear in both `notified` and `pending`, so
    // summing the buckets double-counts the same document rather than the reads it cost.
    check('a backlog of unanswered travel cannot spend a day\u2019s reads in one tick',
      rep.pending <= 50, `${rep.pending} records read out of 400 waiting`);
  }

  // 16. THE REGRESSION. No pickup on the record: it cannot be re-offered, and must SAY SO.
  {
    const h = makeDb({
      rides: { r1: assigned({ pickupLat: undefined, pickupLng: undefined }) },
      operators: freeOperator,
    });
    const rep = await inject(h.db).sweepAssignments({ now });
    check('a travel with no position is reported, not silently skipped',
      rep.positionless.includes('r1') && rep.reoffered.length === 0, JSON.stringify(rep));
  }

  // 17. An operator whose commercial cover has lapsed is never the replacement. This is the
  //     call that was throwing — the assertion is that it runs at all, and filters.
  {
    const h = makeDb({
      rides: { r1: assigned() },
      operators: { op2: { ...freeOperator.op2, insuranceExpiry: '2020-01-01' } },
    });
    const rep = await inject(h.db).sweepAssignments({ now });
    check('a lapsed policy is not re-offered travel',
      rep.reoffered.length === 0 && rep.stranded.includes('r1'), JSON.stringify(rep));
  }

  // 18a. THE PHANTOM. A record that has not checked in is not an operator, whatever its
  //      `available` flag says. This is what was dispatched instead of the operator actually
  //      on duty, and what a paid traveler was told was coming.
  {
    const h = makeDb({
      rides: { r1: assigned() },
      operators: { op2: { ...freeOperator.op2, onlineAt: now - 60 * MIN } },
    });
    const rep = await inject(h.db).sweepAssignments({ now });
    check('an operator who has not checked in is never re-offered travel',
      rep.reoffered.length === 0 && rep.stranded.includes('r1'), JSON.stringify(rep));
  }

  // 18. Nobody free at all: stranded and stamped, not cancelled from under a paid traveler.
  {
    const h = makeDb({ rides: { r1: assigned() }, operators: {} });
    const rep = await inject(h.db).sweepAssignments({ now });
    check('nobody available leaves the travel with its operator, recorded',
      rep.stranded.includes('r1') && h.data.rides.r1.unanswered === true, JSON.stringify(rep));
  }

  let bad = 0;
  for (const r of results) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '   <-- ' + r.d}`); }
  console.log(`\n${results.length - bad}/${results.length} passed`);
  process.exit(bad ? 1 : 0);
})();
