'use strict';
// Source-led competitiveness regression. ALL market references in this file are
// SYNTHETIC HYPOTHESES, never ingested or promoted as production evidence.
// Run via npm test --prefix backend. No network, real travelers, or money.
const assert = require('node:assert/strict');
const {quote}=require('./payments');
const {pricingForRegion}=require('./market-pricing');
const {targetTotalCents}=require('./pricing-policy');
const {fareForMarketTarget,controlledTargetFromAllIn}=require('./market-reference-fare');
const {MIN_PLATFORM_FEE_CENTS}=require('./economics');

const fl=pricingForRegion('fl-southeast');
assert.ok(fl);
assert.equal(pricingForRegion('tx-houston'),null,
  'national pricing must never silently inherit Florida coefficients');
assert.equal(MIN_PLATFORM_FEE_CENTS,250);
function baseFare(miles,minutes,p=fl) {
  return Math.max(p.minimumFareCents,
    Math.round(p.baseCents + p.perMileCents*miles + p.perMinuteCents*minutes));
}
function priced(fare,country='US',toll=0) {
  return quote(fare,null,[],country,toll);
}
// These are OUR server formulas, not observed competitor prices. All USD.
const examples=[[3,10,755],[5,20,1075],[8,21,1345],[10,25,1575]];
for(const [miles,minutes,expectedAllIn] of examples){
  const fare=baseFare(miles,minutes),result=priced(fare);
  assert.equal(result.travelerPays,expectedAllIn,
    'own baseline quoted TOTAL must include the platform fee');
  assert.ok(result._economics.platformContributionCents>=
    result._economics.requiredContributionCents);
}
const five=baseFare(5,20);
assert.equal(five,825);
// The separate publisher's Miami structural 5mi/20min model is ~$12.41-15.79.
// Do not import either bound as an independently verified live quote.
for(const hypotheticalMarketTotal of [1241,1400,1579]){
  const target=targetTotalCents(hypotheticalMarketTotal);
  const result=fareForMarketTarget({
    floorFareCents:five,targetControlledTotalCents:target,
    quoteForFare:f=>priced(f),
  });
  const after=priced(result.fareCents);
  assert.ok(after.travelerPays>=priced(five).travelerPays,
    'comparative evidence may stop needless underpricing, not cut below current floor');
  assert.ok(after.travelerPays<=target,
    'approved target would be followed only when above the production floor');
  assert.ok(target-after.travelerPays<=2,
    'simulated reference should closely meet target in whole cents');
  assert.ok(after._economics.platformContributionCents>=
    after._economics.requiredContributionCents);
  assert.equal(after.operatorGets,result.fareCents-
    Math.floor(result.fareCents*0.01),'operator receives 99 percent of Fare');
}
// A low-market-price hypothesis MUST NOT silently drive existing fares down.
const low=fareForMarketTarget({
  floorFareCents:five,targetControlledTotalCents:650,quoteForFare:f=>priced(f)
});
assert.equal(low.fareCents,five);
assert.equal(low.reason,'production/economic floor');
// Toll is a pass-through, not additional market-controlled fare.
const tollFare=baseFare(8,21),withToll=priced(tollFare,'US',500);
const marketTotal=2700,controlled=controlledTargetFromAllIn({
  targetTravelerTotalCents:targetTotalCents(marketTotal),
  passThroughCents:withToll.passThroughCents,
});
const tt=fareForMarketTarget({
  floorFareCents:tollFare,targetControlledTotalCents:controlled,
  quoteForFare:f=>priced(f,'US',500),
});
const paid=priced(tt.fareCents,'US',500);
assert.ok(paid.travelerPays<=targetTotalCents(marketTotal));
assert.equal(paid.operatorGets,tt.fareCents-
  Math.floor(tt.fareCents*.01)+500);
assert.ok(paid._economics.platformContributionCents>=
  paid._economics.requiredContributionCents);
// Two independent deterministic passes across route/foreign card/toll/
// too-low and too-high synthetic market benchmarks. Never touch any database.
let tested=0;
for(let pass=0;pass<2;pass++){
  for(let i=0;i<12000;i++){
    const miles=1+i%41,minutes=5+(i*7)%87;
    const fare=baseFare(miles,minutes);
    const country=i%3===0?'US':i%3===1?'GB':null;
    const toll=i%7===0?250+(i%3)*125:0;
    const q=f=>priced(f,country,toll);
    const baseline=q(fare);
    const market=baseline.travelerPays+(i%2===0?-(i%300):200+i%1700);
    if(market<=0)continue;
    const target=targetTotalCents(market);
    const controlled=controlledTargetFromAllIn({
      targetTravelerTotalCents:target,
      passThroughCents:baseline.passThroughCents,
    });
    const out=fareForMarketTarget({
      floorFareCents:fare,targetControlledTotalCents:controlled,
      quoteForFare:q,
    });
    const actual=q(out.fareCents);
    assert.ok(out.fareCents>=fare);
    assert.ok(actual.travelerPays>=baseline.travelerPays);
    if(controlled!==null && baseline.travelerPays<=target){
      assert.ok(actual.travelerPays<=target);
      assert.ok(target-actual.travelerPays<=3);
    } else assert.equal(out.fareCents,fare);
    assert.equal(actual.tollCents,toll);
    assert.ok(actual._economics.platformContributionCents>=
      actual._economics.requiredContributionCents);
    tested++;
  }
}
assert.ok(tested>=20000);
console.log('PASS competitive-market synthetic audit: '+tested+
  ' scenarios twice; nominal floor, full Total, no customer funds or API usage');
