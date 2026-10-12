'use strict';
// Two full deterministic synthetic audit campaigns. These simulate market-price
// scenarios, not real third-party prices, and do not create Firestore/API traffic.
const assert = require('node:assert/strict');
const { auditMarket, evaluateQuote } = require('./market-price-assurance');
const { keyForQuote } = require('./market-reference-authority');
const region = { id: 'synthetic-region', timezone: 'America/New_York' };
const now = new Date('2026-10-11T15:00:00.000Z');
const key = keyForQuote({ serviceClass: 'standard', routedMiles: 7, routedMinutes: 19, region, now });
const observed = '2026-10-10T14:00:00.000Z';
const plan = { minimumIndependentFamilies: 2, maxObservationAgeDays: 90 };
const originalQuote = {
  travelCostCents: 1500, cardCountry: 'US', routedMiles: 7, routedMinutes: 19,
  serviceClass: 'standard', routerVerified: true, comparableChargesVerified: true,
};
function snapshotFor(marketId) {
  return {
    marketId, asOf: observed,
    promotion: {
      status: 'promoted', snapshotAsOf: observed,
      holdoutPassed: true, economicsPassed: true, routerPassed: true,
    },
    cells: {
      [key]: {
        travelerTotalComparable: true, observations: 40,
        referenceTotalCents: 2000, targetTotalCents: 1800,
        latestObservedAt: observed,
        evidenceFamilies: ['government-trips','independent-audit'],
        sources: ['market-source-a','market-source-b'],
        providers: ['provider-a','provider-b'], maxProviderShare: 0.5,
      },
    },
  };
}
// 50 hypothetical market IDs x 100 scenarios x two runs = 10,000 controlled quote
// evaluations with known labels, no expense, no dynamic production changes.
function campaign() {
  let count=0;
  for(let marketIndex=0;marketIndex<50;marketIndex++) {
    const marketId=`synthetic-market-${marketIndex}`;
    const quotes=[];
    for(let i=0;i<100;i++) {
      const base={...originalQuote,marketId};
      if(i<40)quotes.push(base);
      else if(i<60)quotes.push({...base,travelCostCents:1600});
      else if(i<80)quotes.push({...base,travelCostCents:1000});
      else if(i<90)quotes.push({...base,routerVerified:false});
      else quotes.push({...base,marketId:'wrong-market'});
    }
    const snap=snapshotFor(marketId);
    const r=auditMarket({marketId,region,quotes,snapshot:snap,plan,now});
    assert.deepEqual(r.counts,{
      within_target_band:40,above_target_review:20,
      material_underpricing_review:20,unverified:20,
    });
    assert.equal(r.productionFareChanged,false);
    assert.ok(r.rows.every(x=>x.productionFareChanged===false || x.status==='unverified'),
      'audit cannot alter actual fares');
    // A supposedly valid reference with all observations sourced from one
    // provider cannot satisfy our independent-source criterion.
    const cell=snap.cells[key];
    const oneProvider={...snap,cells:{[key]:{...cell,maxProviderShare:1}}};
    assert.equal(evaluateQuote({marketId,region,quote:quotes[0],snapshot:oneProvider,plan,now}).status,'unverified');
    // An old reference cannot be made fresh by re-running a cheap audit.
    const old={...snap,cells:{[key]:{...cell,latestObservedAt:'2025-10-10T14:00:00.000Z'}}};
    assert.equal(evaluateQuote({marketId,region,quote:quotes[0],snapshot:old,plan,now}).status,'unverified');
    count+=r.cases;
  }
  return count;
}
assert.equal(campaign(),5000);
assert.equal(campaign(),5000);
console.log('PASS twice: 10,000 synthetic audits across 50 isolated market identifiers; all counts correct, no provider calls, no live rate change');
