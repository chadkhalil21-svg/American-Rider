'use strict';
const assert = require('node:assert/strict');
const { evaluateQuote, auditMarket } = require('./market-price-assurance');
const { keyForQuote } = require('./market-reference-authority');
const { minimumPlatformFeeCents } = require('./economics');
const region = { id: 'fl-southeast', timezone: 'America/New_York' };
const now = new Date('2026-10-11T15:00:00.000Z');
const marketId = 'fl-miami-dade';
const quote = {
  marketId, travelCostCents: 1500, cardCountry: 'US',
  routedMiles: 7, routedMinutes: 19, serviceClass: 'standard',
  routerVerified: true, comparableChargesVerified: true,
};
const key = keyForQuote({ serviceClass: 'standard', routedMiles: 7, routedMinutes: 19, region, now });
const stamp = '2026-10-10T14:00:00.000Z';
const cell = {
  referenceTotalCents: 2000, targetTotalCents: 1800,
  travelerTotalComparable: true,
  latestObservedAt: stamp,
  evidenceFamilies: ['government-trips', 'independent-audit'],
  sources: ['government-city', 'audit-independent'],
  providers: ['provider-one', 'provider-two'],
  maxProviderShare: 0.5,
};
const snapshot = {
  marketId, asOf: stamp,
  promotion: {
    status: 'promoted', snapshotAsOf: stamp,
    holdoutPassed: true, economicsPassed: true, routerPassed: true,
  },
  cells: { [key]: cell },
};
const plan = { minimumIndependentFamilies: 2, maxObservationAgeDays: 90 };
const audit = extra => evaluateQuote({ marketId, region, quote, snapshot, plan, now, ...extra });
const good = audit();
assert.equal(good.status, 'within_target_band');
assert.equal(good.travelerTotalCents, 1750);
assert.equal(good.platformFeeCents, 250);
assert.equal(good.referenceTotalCents, 2000);
assert.equal(good.targetTotalCents, 1800);
assert.equal(good.discountPct, 12.5);
assert.equal(good.productionFareChanged, false);
assert.equal(audit({ quote: { ...quote, travelCostCents: 1600 } }).status, 'above_target_review');
assert.equal(audit({ quote: { ...quote, travelCostCents: 1000 } }).status, 'material_underpricing_review');
assert.equal(audit({ snapshot: null }).status, 'unverified');
assert.equal(audit({ snapshot: { ...snapshot, promotion: { status: 'candidate' } } }).status, 'unverified');
assert.equal(audit({ snapshot: { ...snapshot, marketId: 'fl-broward' } }).status, 'unverified');
assert.equal(audit({ quote: { ...quote, marketId: 'fl-broward' } }).status, 'unverified');
assert.equal(audit({ quote: { ...quote, routerVerified: false } }).status, 'unverified');
assert.equal(audit({ quote: { ...quote, comparableChargesVerified: false } }).status, 'unverified');
assert.equal(audit({ snapshot: { ...snapshot, cells: {} } }).status, 'unverified');
assert.equal(audit({ snapshot: { ...snapshot, cells: { [key]: { ...cell, travelerTotalComparable: false } } } }).status, 'unverified');
assert.equal(audit({ snapshot: { ...snapshot, cells: { [key]: { ...cell, targetTotalCents: 1900 } } } }).status, 'unverified');
assert.equal(audit({ snapshot: { ...snapshot, cells: { [key]: { ...cell, evidenceFamilies: ['government-trips'] } } } }).status, 'unverified');
assert.equal(audit({ snapshot: { ...snapshot, cells: { [key]: { ...cell, sources: ['government-city'] } } } }).status, 'unverified');
assert.equal(audit({ snapshot: { ...snapshot, cells: { [key]: { ...cell, maxProviderShare: 0.9 } } } }).status, 'unverified');
assert.equal(audit({ snapshot: { ...snapshot, cells: { [key]: { ...cell, maxProviderShare: undefined } } } }).status, 'unverified');
assert.equal(audit({ snapshot: { ...snapshot, cells: { [key]: { ...cell, latestObservedAt: '2025-10-11T15:00:00Z' } } } }).status, 'unverified');
assert.equal(audit({ quote: { ...quote, routedMiles: NaN } }).status, 'unverified');
assert.equal(audit({ quote: { ...quote, travelCostCents: -1 } }).status, 'unverified');
assert.equal(audit({ quote: { ...quote, transactionCount: -1 } }).status, 'unverified');
assert.equal(audit({ quote: { ...quote, cardCountry: 'GB' } }).travelerTotalCents,
  quote.travelCostCents + minimumPlatformFeeCents({ travelCostCents: quote.travelCostCents, cardCountry: 'GB' }));
assert.equal(audit({ quote: { ...quote, tollCents: 500, governmentFeeCents: 200 } }).travelerTotalCents,
  1500 + 500 + 200 + minimumPlatformFeeCents({ travelCostCents: 1500, tollCents: 500, governmentFeeCents: 200, cardCountry: 'US' }));
const many = auditMarket({ marketId, region, quotes: [quote, { ...quote, travelCostCents: 1000 }, { ...quote, routedMiles: 70 }], snapshot, plan, now });
assert.equal(many.cases, 3);
assert.equal(many.counts.within_target_band, 1);
assert.equal(many.counts.material_underpricing_review, 1);
assert.equal(many.counts.unverified, 1);
assert.equal(many.productionFareChanged, false);
assert.throws(() => auditMarket({ marketId, region, quotes: Array(1001).fill(quote), snapshot, plan, now }), /at most/);
// Portability simulation across 50 distinct markets. This checks only the pure evaluator,
// NEVER suggests any of these hypothetical geographies are authorized or priced.
for(let i=0;i<50;i++) {
  const id='synthetic-market-'+i;
  const localQuote={...quote,marketId:id};
  const localSnap={...snapshot,marketId:id};
  assert.equal(evaluateQuote({marketId:id,region,quote:localQuote,snapshot:localSnap,plan,now}).status,'within_target_band');
}
console.log('national market-price assurance: all offline safety and 50-market portability tests passed');
