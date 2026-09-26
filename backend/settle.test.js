// Settlement must not depend on any app being alive at the end of a journey.
//
// AR-2109-MIA: traveler charged $19.44, operator drove it to completion, no transfer and no
// receipt — because the only record of the payment lived in the traveler app's memory and
// that app had lost the thread by the time the journey ended.
const path = require('path');
const assert = require('assert');
const ROOT = __dirname;

const rides = new Map();
const users = new Map();
const transfers = [];
let transferResult = { ok: true, transferId: 'tr_test', amountCents: 1777 };

const docFor = (map, id) => ({
  get: async () => ({ exists: map.has(id), data: () => map.get(id), id }),
  set: async (patch) => { map.set(id, { ...(map.get(id) || {}), ...patch }); },
});
const fakeDb = {
  collection: (name) => {
    const map = name === 'rides' ? rides : users;
    return {
      doc: (id) => docFor(map, id),
      where: (field, _op, value) => {
        // Chainable, like the real thing: the sweep bounds its scan with orderBy().limit(),
        // and a fake that ignored those would let an unbounded query pass its own test.
        const q = {
          _order: null,
          _limit: Infinity,
          orderBy(f, dir) { q._order = { f, dir }; return q; },
          limit(n) { q._limit = n; return q; },
          get: async () => {
            let hits = [...map.entries()].filter(([, v]) => v[field] === value);
            if (q._order) {
              const { f, dir } = q._order;
              hits.sort((a, b) => ((a[1][f] ?? 0) - (b[1][f] ?? 0)) * (dir === 'desc' ? -1 : 1));
            }
            hits = hits.slice(0, q._limit);
            return { forEach: (fn) => hits.forEach(([id, v]) => fn({ id, data: () => v })) };
          },
        };
        return q;
      },
    };
  },
};

for (const [rel, exports] of [
  ['./firebase-admin.js', { adminDb: () => fakeDb, adminStatus: () => ({ ok: true }) }],
  ['./push.js', { notify: async () => {} }],
  ['./tickets.js', { fileTicket: async () => ({ caseNo: 'AR-C-1' }) }],
  ['./env.js', { readKey: () => '' }],
  ['./payments.js', {
    chargeScheduledTravel: async () => ({ ok: true }),
    operatorPayoutAccount: async (_db, opId) =>
      users.get(opId)?.stripeAccountId
        ? { accountId: users.get(opId).stripeAccountId }
        : { accountId: null, reason: 'that operator has no payout account' },
    transferToOperator: async (args) => { transfers.push(args); return transferResult; },
  }],
]) {
  const p = require.resolve(path.join(ROOT, rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports, children: [], paths: [] };
}

const { sweepSettlements } = require(path.join(ROOT, 'scheduler.js'));

const R = [];
const check = (l, ok, d) => R.push({ l, ok: !!ok, d });

(async () => {

  const reset = () => {
    rides.clear(); users.clear(); transfers.length = 0;
    transferResult = { ok: true, transferId: 'tr_test', amountCents: 1777 };
    users.set('marcus', { stripeAccountId: 'acct_marcus' });
  };

  // THE CASE THAT ACTUALLY HAPPENED.
  reset();
  rides.set('r1', {
    status: 'completed', needsPayout: true, paymentIntentId: 'pi_1', operatorId: 'marcus',
    travelerUid: 'adrian', tripNo: 'AR-2109-MIA',
  });
  let out = await sweepSettlements({ now: 1 });
  check('a completed, paid, unsettled travel is swept and paid', out.settled === 1, JSON.stringify(out));
  check('  and the transfer names the right payment', transfers[0]?.paymentIntentId === 'pi_1');
  check('  and the travel records its transfer', rides.get('r1').transferId === 'tr_test');
  check('  and is no longer marked pending', rides.get('r1').payoutPending === false);

  // IDEMPOTENT — this runs every minute forever.
  const before = transfers.length;
  out = await sweepSettlements({ now: 2 });
  check('a settled travel is never paid twice', transfers.length === before && out.settled === 0);

  // NOTHING WITHOUT EVIDENCE.
  reset();
  rides.set('r2', { status: 'onboard', paymentIntentId: 'pi_2', operatorId: 'marcus', travelerUid: 'a' });
  rides.set('r3', { status: 'completed', operatorId: 'marcus', travelerUid: 'a' }); // never paid, no flag
  rides.set('r4', { status: 'completed', paymentIntentId: 'pi_4', travelerUid: 'a' }); // no operator
  out = await sweepSettlements({ now: 3 });
  check('an unfinished travel is not settled', transfers.length === 0, JSON.stringify(out));
  check('a completed travel with no payment is not settled', out.considered === 0);

  // AN OPERATOR WITHOUT A PAYOUT ACCOUNT IS OWED, NEVER DROPPED.
  reset();
  users.clear();
  rides.set('r5', {
    status: 'completed', needsPayout: true, paymentIntentId: 'pi_5', operatorId: 'newbie',
    travelerUid: 'a', tripNo: 'AR-3000-MIA',
  });
  out = await sweepSettlements({ now: 4 });
  check('an operator with no payout account is recorded as owed', rides.get('r5').payoutPending === true);
  check('  and is named in the report rather than lost', out.blocked?.[0]?.tripNo === 'AR-3000-MIA', JSON.stringify(out));
  check('  and no transfer was attempted', transfers.length === 0);

  // A FAILED TRANSFER MUST NOT LOOK LIKE A PAID ONE.
  reset();
  transferResult = { ok: false, error: 'card dispute open' };
  rides.set('r6', { status: 'completed', needsPayout: true, paymentIntentId: 'pi_6', operatorId: 'marcus', travelerUid: 'a', tripNo: 'AR-3001-MIA' });
  out = await sweepSettlements({ now: 5 });
  check('a failed transfer leaves the travel unsettled', !rides.get('r6').transferId);
  check('  and records why', rides.get('r6').payoutBlockedReason === 'card dispute open');
  check('  and it is retried next sweep', (await sweepSettlements({ now: 6 })).considered === 1);

  // A FLAG NOBODY CAN ACT ON IS NOT LEFT COSTING A READ A MINUTE.
  reset();
  rides.set('r7', { status: 'completed', needsPayout: true, operatorId: 'marcus', travelerUid: 'a', tripNo: 'AR-3002-MIA' });
  out = await sweepSettlements({ now: 7 });
  check('a travel with no payment recorded stops being swept', rides.get('r7').needsPayout === false);
  check('  and is raised for a person rather than dropped', rides.get('r7').payoutPending === true);
  check('  and is named in the report', out.blocked?.some((b) => b.tripNo === 'AR-3002-MIA'), JSON.stringify(out));

  // THE WIRING ITSELF. Three defects this month were code that existed and was never called.
  const serverSrc = require('fs').readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  check('sweepSettlements is imported by server.js', /require\('\.\/scheduler'\)/.test(serverSrc)
    && /sweepSettlements/.test(serverSrc));
  check('sweepSettlements is actually CALLED in the sweep', /sweepSettlements\(\)/.test(serverSrc));
  // Moved into travelmoney.js payForTravel (audit of e26adcb): the ride is proved first, then
  // the payment is stamped onto it with an update.
  const moneySrc = require('fs').readFileSync(path.join(ROOT, 'travelmoney.js'), 'utf8');
  check('/create-payment-intent stamps the payment onto the travel transactionally',
    /payForTravel\(/.test(serverSrc) &&
    /paymentIntentId: result\.paymentIntentId/.test(moneySrc) &&
    /db\.runTransaction\(/.test(moneySrc) &&
    /tx\.update\(rideRef,\s*\{[\s\S]*paymentIntentId: result\.paymentIntentId/.test(moneySrc));


let bad = 0;

  for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  <-- ' + (r.d || '')}`); }
  console.log(`\n${R.length - bad}/${R.length} passed`);
  process.exit(bad ? 1 : 0);

})();
