'use strict';
const assert = require('node:assert/strict');
const { ADVANCE_MARGIN_MS, policyExpiryAt, requiredWindowMs, coverageUnsafeForNewTravel } = require('./insurance-horizon');
const { matchOperator } = require('./matching');
const { DISCLOSURE_VERSION } = require('./disclosure');

const expiry = '2026-10-16';
const end = Date.parse('2026-10-16T23:59:59.999Z');
assert.equal(policyExpiryAt(expiry), end);
assert.equal(policyExpiryAt('2026-02-30'), null, 'reject normalized invalid calendar dates');
assert.equal(policyExpiryAt('nonsense'), null);
assert.equal(requiredWindowMs(), ADVANCE_MARGIN_MS, '24-hour advance lockout');
assert.equal(requiredWindowMs(25*60), 26*60*60*1000, 'long journeys require completion plus one hour');
assert.equal(coverageUnsafeForNewTravel(expiry, end - ADVANCE_MARGIN_MS - 1), false);
assert.equal(coverageUnsafeForNewTravel(expiry, end - ADVANCE_MARGIN_MS), true, 'inclusive cutoff');
assert.equal(coverageUnsafeForNewTravel(expiry, end - 36*60*60*1000, 36*60), true);
assert.equal(coverageUnsafeForNewTravel(expiry, end - 40*60*60*1000, 36*60), false);
assert.equal(coverageUnsafeForNewTravel(expiry, end - 40*60*60*1000, Infinity), true);
assert.equal(coverageUnsafeForNewTravel(expiry, end - 40*60*60*1000, -1), true);
assert.equal(coverageUnsafeForNewTravel('', end - 40*60*60*1000), true);
assert.equal(coverageUnsafeForNewTravel('2026-10-15', end - 40*60*60*1000), true);

for (let pass=0; pass<2; pass++) {
  const now = Date.parse('2026-10-15T23:59:59.999Z');
  const fleet = {
    id:'operator', lat:25.7,lng:-80.2,available:true,commissioned:true,
    onlineAt:now,insuranceExpiry:'2026-10-18',
    disclosureVersion:DISCLOSURE_VERSION,screeningCheckedAt:now,
  };
  const options = { now,requireScreening:true };
  assert.ok(matchOperator([fleet], {lat:25.7,lng:-80.2},'Standard',options));
  assert.equal(matchOperator([{...fleet,insuranceExpiry:expiry}], {lat:25.7,lng:-80.2},'Standard',options),null,
    'do not offer a Travel to an operator who will enter the 24h cutoff');
  assert.equal(matchOperator([{...fleet,insuranceExpiry:''}], {lat:25.7,lng:-80.2},'Standard',options),null,
    'an unknown fleet expiry is not evidence');
  assert.equal(matchOperator([{...fleet,insuranceExpiry:expiry}], {lat:25.7,lng:-80.2},'Standard',
    {now:end-36*60*60*1000, requireScreening:true,travelMinutes:36*60}),null,
  'even before the general cutoff, a long route must be inside the coverage horizon');
  assert.ok(matchOperator([{...fleet,insuranceExpiry:'2026-10-20'}], {lat:25.7,lng:-80.2},'Standard',options),
    'an authenticated renewal with adequate coverage restores eligibility');
}
console.log('advance insurance horizon and dispatch tests passed twice');
