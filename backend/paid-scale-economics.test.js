'use strict';
// Research-backed, **illustrative** unit-cost sensitivity for existing platform pricing.
// Official regional example: https://firebase.google.com/docs/firestore/standard-edition
// These are synthetic arithmetic envelopes, NOT live billed operations, workload
// performance, full-company profitability, or proof of million concurrent users.
const assert = require('node:assert/strict');
const { economicsFor, MIN_PLATFORM_CONTRIBUTION_CENTS,
  OPERATING_OVERHEAD_ALLOWANCE_CENTS } = require('./economics');
const { pricingForRegion, pricingProblems } = require('./market-pricing');
const { targetTotalCents } = require('./pricing-policy');
const { promotionDecision } = require('./market-reference-monitor');

const RATES = Object.freeze({
  usdPer100kReads:0.03, usdPer100kWrites:0.09,
  freeReadsPerDay:50000, freeWritesPerDay:20000,
});
function scenario(travels, {readsPerTravel=100,writesPerTravel=40,
  idleReads=0,idleWrites=0}={}) {
  assert(Number.isSafeInteger(travels)&&travels>=0);
  const reads=travels*readsPerTravel+idleReads;
  const writes=travels*writesPerTravel+idleWrites;
  const cost=Math.max(0,reads-RATES.freeReadsPerDay)*RATES.usdPer100kReads/100000+
    Math.max(0,writes-RATES.freeWritesPerDay)*RATES.usdPer100kWrites/100000;
  return {reads,writes,firestoreDocumentsUsdDaily:cost};
}
const domestic=economicsFor({
  travelCostCents:1750,platformFeeCents:250,cardCountry:'US',
});
const international=economicsFor({
  travelCostCents:1750,platformFeeCents:250,cardCountry:'GB',
});
assert.equal(domestic.travelerPays,2000);
assert.equal(domestic.operatorGets,1733);
assert.equal(domestic.platformContributionCents,114);
assert.equal(international.platformContributionCents,84);
assert.equal(MIN_PLATFORM_CONTRIBUTION_CENTS,75);
assert.equal(OPERATING_OVERHEAD_ALLOWANCE_CENTS,25);
assert(domestic.platformContributionCents>=MIN_PLATFORM_CONTRIBUTION_CENTS);
assert(international.platformContributionCents>=MIN_PLATFORM_CONTRIBUTION_CENTS);
// The operating-overhead allowance is already deducted above. Do not treat
// the modeled contribution as full business profit or free insurer coverage.
assert.equal(pricingForRegion('fl-southeast').baseCents,100);
assert.equal(pricingForRegion('fl-southeast').perMileCents,85);
assert.equal(pricingForRegion('fl-southeast').perMinuteCents,15);
assert.equal(pricingProblems({id:'fl-southeast'}).length,0);
assert.equal(pricingForRegion('ny-nyc'),null,
  'a new city must never inherit South Florida pricing');
assert.equal(pricingForRegion('fl-orlando'),null);
assert.equal(targetTotalCents(2000),1800);
assert.equal(promotionDecision({
  currentCents:2000,nextCents:1800,independentEvidenceFamilies:1,
  holdoutPassed:true,economicsPassed:true,routerPassed:true,
}).promote,false,'90% target cannot override inadequate evidence');
assert.equal(promotionDecision({
  currentCents:2000,nextCents:1800,independentEvidenceFamilies:2,
  holdoutPassed:false,economicsPassed:true,routerPassed:true,
}).promote,false,'unproven promotion cannot become live automatically');
const cases=[1000,10000,100000,1000000].map(t=>scenario(t));
assert.equal(cases.length,4);
assert(cases.every(x=>Number.isFinite(x.firestoreDocumentsUsdDaily)));
const forecast10k=scenario(10000);
assert(Math.abs(forecast10k.firestoreDocumentsUsdDaily-0.627)<1e-8);
const forecast100k=scenario(100000);
assert(Math.abs(forecast100k.firestoreDocumentsUsdDaily-6.567)<1e-8);
const forecast1m=scenario(1000000);
assert(Math.abs(forecast1m.firestoreDocumentsUsdDaily-65.967)<1e-8);
assert.equal(scenario(0,{idleWrites:21000}).firestoreDocumentsUsdDaily,0.0009,
  'quota breach is a capacity problem, not a large marginal bill by itself');
console.log('PASS illustrative Blaze regional document-operation sensitivity, domestic/international $20 Travel economics, no foreign-market price inheritance, and evidence-gated promotions');
