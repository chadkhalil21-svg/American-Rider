const assert = require('node:assert/strict');
const { marketChecklistPage } = require('./market-readiness-ui');
const market = { id: 'fl-miami-dade', name: '<County & others>', state: 'FL' };
const state = { status: 'waitlist', manifestVersion: 'abc123', readyToActivate: false,
  missing: [{ id: 'company_insurance_bound', reason: 'Signed carrier binder absent' }] };
const waiting = marketChecklistPage([{ market, state }], { production: true });
assert.ok(waiting.includes('&lt;County &amp; others&gt;'));
assert.equal(waiting.includes('<County & others>'), false);
assert.match(waiting, /class="activate"[^>]*disabled/);
assert.ok(waiting.includes('role="status" aria-live="polite"'));
assert.ok(waiting.includes('Record independently reviewed evidence'));
assert.ok(waiting.includes('x-ar-ops-action'));
const intake = marketChecklistPage([{ market, state: { ...state, readyToOnboard: true } }], { production: true });
assert.match(intake, /class="onboard"[^>]*data-version="abc123"[^>]*>Authorize prelaunch/);
assert.match(intake, /class="activate"[^>]*disabled/);
const duringIntake = marketChecklistPage([{ market, state: { ...state, status: 'onboarding', readyToOnboard: true } }], { production: true });
assert.match(duringIntake, /Only approved Operator intake is allowed/);
assert.match(duringIntake, /Pause intake and new offers/);
const pendingFleet = marketChecklistPage([{ market, state: { ...state, fleetCleanupPending: true } }], { production: true });
assert.match(pendingFleet, /role="alert".*Fleet shutdown pending/);
assert.match(pendingFleet, /class="activate"[^>]*disabled/);
const green = marketChecklistPage([{ market, state: { ...state, readyToActivate: true, missing: [] } }], { production: true });
assert.match(green, /class="activate"[^>]*data-version="abc123"[^>]*>Activate/);
const testOnly = marketChecklistPage([{ market, state: { ...state, readyToActivate: true, missing: [] } }], { production: false });
assert.match(testOnly, /class="activate"[^>]*disabled/);
// Three counties share the same platform-level blocker; it is not three purchases.
const triCounty = ['Miami-Dade','Broward','Palm Beach'].map((name, i) => ({
  market: { id: ['fl-miami-dade','fl-broward','fl-palm-beach'][i], name, state:'FL' },
  state: { ...state,
    missing: [
      { id:'provider:screening_provider', reason:'No commissioned provider handoff' },
      { id:'company_insurance_bound', reason:'Actual coverage evidence required' },
    ],
  },
}));
const grouped = marketChecklistPage(triCounty, { production: true });
assert.match(grouped, /Commission markets here, not in Operator screening/);
assert.match(grouped, /two separate controls/i);
assert.equal((grouped.match(/Screening Provider/g)||[]).length, 1,
  'one platform dependency must not be repeated per county');
assert.equal((grouped.match(/Company Insurance Bound/g)||[]).length, 3,
  'legally scoped county proof remains required per county');
assert.match(grouped, /may be referenced only where their actual coverage and validity apply/);
assert.equal((grouped.match(/class="activate"[^>]*disabled/g)||[]).length, 3,
  'shared missing dependency may never enable activation');
const unblockedLocally = marketChecklistPage([{market,state:{
  ...state, missing:[{id:'provider:screening_provider',reason:'Provider not commissioned'}],
  readyToActivate:false,
}}], {production:true});
assert.match(unblockedLocally,/No remaining county-specific evidence/);
assert.match(unblockedLocally,/class="activate"[^>]*disabled/);

console.log('PASS market Operations checklist: escape, accessible feedback and production-only one-action activation');
