'use strict';
// Synthetic contractual onboarding checks only: never declare an insurance policy bound.
const assert = require('node:assert/strict');
const {forState, publicConfig} = require('./insurance-jurisdictions');
for(let pass=0;pass<2;pass++){
 const fl=forState('FL');
 assert.ok(fl,'Florida has an explicit state configuration');
 assert.equal(forState('GA'),null,'unconfigured jurisdictions fail closed');
 assert.equal(fl.loggedOn.perPerson,50000);
 assert.equal(fl.loggedOn.perIncident,100000);
 assert.equal(fl.loggedOn.propertyDamage,25000);
 assert.equal(fl.ride.primaryLiabilityMinDollars,1000000);
 assert.match(fl.policyUse,/commercial livery.*for-hire/i);
 assert.match(fl.script,/commercial livery.*for-hire passenger policy/i);
 assert.match(fl.script,/cancellation, nonrenewal and coverage changes/i);
 assert.match(fl.script,/declarations page/i);
 assert.match(fl.script,/immediately prevents me from commencing operations or accepting new Travel/i);
 assert.match(fl.script,/must promptly report coverage changes/i);
 assert.equal(publicConfig(fl).limits.ridePrimaryLiability,1000000);
}
console.log('PASS twice: state-specific Operator commercial livery onboarding and unconfigured-state refusal');
