// Acceptance re-checks eligibility at the moment of acceptance, not only at the offer.
// Run: node backend/acceptance.test.js
//
// The race this pins: a travel is offered while everything stands; then the disclosure
// version moves (or approval, a document, insurance, screening, payouts…); then the operator
// taps Accept. Before 22 Sept 2026 the phone wrote 'accepted' itself and nothing re-checked.
const fs = require('fs');
const path = require('path');
const { operatorEligibility, acceptOffer } = require('./eligibility');
const { DISCLOSURE_VERSION } = require('./disclosure');

const R = [];
const check = (l, c, d) => R.push({ l, ok: !!c, d });

// ——— a Firestore stand-in with transaction semantics: reads first, writes applied at the end ——
function fakeDb(seed) {
  const data = JSON.parse(JSON.stringify(seed));
  const ref = (col, id) => ({ col, id });
  const snap = (r) => {
    const v = data[r.col]?.[r.id];
    return { exists: !!v, data: () => (v ? JSON.parse(JSON.stringify(v)) : undefined) };
  };
  return {
    data,
    collection: (col) => ({ doc: (id) => ref(col, id) }),
    async runTransaction(fn) {
      const writes = [];
      const tx = {
        get: async (r) => snap(r),
        update: (r, f) => writes.push(() => { Object.assign(data[r.col][r.id], f); }),
        set: (r, f) => writes.push(() => { data[r.col] = data[r.col] || {}; data[r.col][r.id] = { ...(data[r.col][r.id] || {}), ...f }; }),
      };
      const out = await fn(tx);
      writes.forEach((w) => w());
      return out;
    },
  };
}

const NOW = Date.parse('2026-09-22T15:00:00Z');
const ok = { verdict: 'accept', expiry: '2099-01-01' };
const goodUser = () => ({
  insuranceDisclosure: { version: DISCLOSURE_VERSION, at: NOW - 1000 },
  commission: { status: 'approved' },
  documents: { license: ok, registration: ok, inspection: ok, insurance: ok },
  screening: { decision: 'pass', recheckDue: NOW + 1e10 },
});
const goodFleet = () => ({
  available: true, onlineAt: NOW, commissioned: true, disclosureVersion: DISCLOSURE_VERSION,
  insuranceExpiry: '2099-01-01', lat: 25.76, lng: -80.19,
});
const seed = (userOver = {}, fleetOver = {}, rideOver = {}) => ({
  rides: { r1: { operatorId: 'op', status: 'assigned', createdAt: NOW - 5000, ...rideOver } },
  operators: { op: { ...goodFleet(), ...fleetOver } },
  users: { op: { ...goodUser(), ...userOver } },
});
const accept = (db, extra = {}) => acceptOffer({ db, uid: 'op', rideId: 'r1', now: () => NOW, ...extra });

(async () => {
  // ——— the pure rule ——————————————————————————————————————————————————————————
  const E = (u, f, o = {}) => operatorEligibility({ user: { ...goodUser(), ...u }, fleet: { ...goodFleet(), ...f }, now: NOW, ...o });
  check('an operator in good standing is eligible', E({}, {}).ok);
  check('no account record → refused', operatorEligibility({ user: null, fleet: goodFleet(), now: NOW }).code === 'no_account');
  check('off duty → refused', E({}, { available: false }).code === 'not_on_duty');
  check('old disclosure version → refused', E({ insuranceDisclosure: { version: '2026-08-29.1', at: 1 } }, {}).code === 'disclosure_required');
  check('no disclosure → refused', E({ insuranceDisclosure: null }, {}).code === 'disclosure_required');
  check('the FLEET stamp does not count — the account record decides',
    E({ insuranceDisclosure: { version: 'old', at: 1 } }, { disclosureVersion: DISCLOSURE_VERSION }).code === 'disclosure_required');
  check('approval withdrawn → refused', E({ commission: { status: 'refused' } }, {}).code === 'not_commissioned');
  check('a document refused since → refused', E({ documents: { ...goodUser().documents, license: { verdict: 'refuse' } } }, {}).code === 'documents_required');
  check('a document expired since → refused', E({ documents: { ...goodUser().documents, registration: { verdict: 'accept', expiry: '2026-09-01' } } }, {}).code === 'documents_required');
  check('documentBlocked on the fleet record → refused', E({}, { documentBlocked: true }).code === 'documents_required');
  check('insurance expiry passed → refused', E({}, { insuranceExpiry: '2026-09-21' }).code === 'coverage_expired');
  check('screening blocked → refused', E({}, { screeningBlocked: true }).code === 'screening_blocked');
  check('live money and no current screening → refused', E({ screening: null }, {}, { liveMoney: true }).code === 'not_screened');
  check('live money and a lapsed screening → refused', E({ screening: { decision: 'pass', recheckDue: NOW - 1 } }, {}, { liveMoney: true }).code === 'not_screened');
  check('test money and no screening → allowed, as /operator/online allows it', E({ screening: null }, {}).ok);
  check('Stripe restricted payouts (webhook) → refused', E({}, { payoutsEnabled: false }).code === 'payouts_not_ready');

  // ——— the race, end to end through the transaction ——————————————————————————————
  {
    const db = fakeDb(seed());
    // The offer was made while everything stood. Now the disclosure version moves on.
    db.data.users.op.insuranceDisclosure = { version: '2026-08-29.1', at: NOW - 1e6 };
    const out = await accept(db);
    check('RACE: disclosure changed after the offer → acceptance refused', out.status === 409 && out.body.code === 'disclosure_required', JSON.stringify(out));
    check('RACE: the travel is NOT accepted', db.data.rides.r1.status === 'assigned');
    check('RACE: the travel is released for re-offer', db.data.rides.r1.releasedAt === NOW && db.data.rides.r1.releasedReason === 'disclosure_required');
    check('RACE: the operator is taken out of service', db.data.operators.op.available === false);
    const again = await accept(db);
    check('RACE: a second tap is refused as well', again.status === 409 && db.data.rides.r1.status === 'assigned');
  }
  {
    const db = fakeDb(seed());
    const out = await accept(db);
    check('an eligible operator accepts', out.status === 200 && db.data.rides.r1.status === 'accepted' && db.data.rides.r1.acceptedAt === NOW, JSON.stringify(out));
    const twice = await accept(db);
    check('an accepted travel cannot be accepted twice', twice.status === 409 && twice.body.code === 'not_open');
  }
  {
    const db = fakeDb(seed({}, {}, { operatorId: 'someone-else' }));
    const out = await accept(db);
    check('a travel offered to somebody else cannot be taken', out.body.code === 'not_offered' && db.data.rides.r1.status === 'assigned' && !db.data.rides.r1.releasedAt);
  }
  {
    const db = fakeDb(seed({}, {}, { status: 'cancelled' }));
    const out = await accept(db);
    check('a cancelled travel cannot be accepted', out.body.code === 'not_open' && db.data.rides.r1.status === 'cancelled');
  }
  {
    const db = fakeDb(seed());
    const out = await accept(db, { refusal: { code: 'payouts_not_ready', reason: 'x' } });
    check('a network-check refusal (Stripe / account) releases the travel too', out.body.code === 'payouts_not_ready' && db.data.rides.r1.status === 'assigned' && db.data.rides.r1.releasedAt === NOW);
  }
  {
    const db = fakeDb(seed({ commission: { status: 'pending' } }));
    const out = await accept(db);
    check('approval not in force at acceptance → refused', out.body.code === 'not_commissioned' && db.data.rides.r1.status === 'assigned');
  }

  // ——— the wiring ———————————————————————————————————————————————————————————————
  const root = path.join(__dirname, '..');
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  const opRule = (rules.match(/allow update: if drivesExisting\(\)[\s\S]*?;\n/) || [''])[0];
  check('rules: the operator update rule was found', opRule.length > 0);
  check("rules: a phone cannot write 'accepted'", opRule.length > 0 && !/'accepted', 'arrived'/.test(opRule.split('resource.data.status in')[0]) && !/request\.resource\.data\.status in\s*\[\s*'accepted'/.test(opRule));
  check('rules: a phone cannot write acceptedAt', !/'acceptedAt'/.test(opRule));
  check('rules: arrived/onboard/completed require a travel already under way',
    /resource\.data\.status in \['accepted', 'arrived', 'onboard'\]/.test(opRule));
  check("rules: 'declined' only answers an open offer", /status == 'declined'\s*&& resource\.data\.status == 'assigned'/.test(opRule));

  const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  const route = (server.match(/app\.post\('\/travel\/accept'[\s\S]*?\n\}\);/) || [''])[0];
  check('POST /travel/accept exists and requires sign-in', /app\.post\('\/travel\/accept', requireAuth/.test(server));
  check('it checks the Firebase account is not disabled', /accountDisabled\(uid\)/.test(route) && /disabled !== false/.test(route));
  check('it asks Stripe whether payouts are enabled', /connectAccountStatus\(/.test(route));
  check('it commits through acceptOffer', /acceptOffer\(/.test(route));

  const monitor = fs.readFileSync(path.join(__dirname, 'monitor.js'), 'utf8');
  check('the re-offer sweep does not wait out the window on a released travel',
    /since < ANSWER_WINDOW_SEC && !ride\.releasedAt/.test(monitor));
  check('a re-offer clears the release', /releasedAt: null/.test(monitor));

  const online = (server.match(/app\.post\('\/operator\/online'[\s\S]*?\n\}\);/) || [''])[0];
  check('/operator/online stamps screeningCheckedAt ONLY for a current screening',
    /screeningCheckedAt: screened \? Date\.now\(\) : null/.test(online) && !/screeningCheckedAt: Date\.now\(\)/.test(online));

  check('/operator/online: every eligibility refusal goes through refuse(), which takes the operator out of dispatch',
    /const refuse = async/.test(online) && /available: false, offDutyReason: body\.code/.test(online) &&
    (online.match(/return res\.status\(409\)/g) || []).length === 1);
  check('/operator/online: a disabled account is refused at go-on-duty and at every renewal',
    /accountDisabled\(req\.uid\)\) !== false/.test(online) && /code: 'account_disabled'/.test(online));

  const inbox = fs.readFileSync(path.join(root, 'src', 'backend', 'operatorInbox.ts'), 'utf8');
  check('the app accepts through the server, not a direct write',
    /\/travel\/accept/.test(inbox) && !/setStatus\(rideId, 'accepted'/.test(inbox));

  let bad = 0;
  for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  — ' + (r.d || '')}`); }
  console.log(`\n${R.length - bad}/${R.length} passed`);
  process.exit(bad ? 1 : 0);
})();
