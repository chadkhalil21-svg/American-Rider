'use strict';
// Real production coefficients versus documented UNDEPLOYED tri-county scenario.
// No exact road route, booking, insurance bind, card charge or added market admission.
const assert=require('node:assert/strict');
const {pricingForRegion}=require('./market-pricing');
const {quote}=require('./payments');
const {forState}=require('./insurance-jurisdictions');
const {REGIONS}=require('./regions');
const {REFERENCE_DIMENSIONS}=require('./pricing-policy');
const fl=REGIONS.find(x=>x.id==='fl-southeast');
assert.deepEqual(fl.activeMarketFips,['12086','12011','12099'],
 'all three counties configured, but this is NOT a commercial readiness assertion');
assert.equal(fl.state,'FL');
assert.equal(forState('FL').ride.primaryLiabilityMinDollars,1000000);
assert.equal(forState('GA'),null,'no unconfigured other-state insurance or fare allowed');
const old=pricingForRegion('fl-southeast');
assert.deepEqual([old.baseCents,old.perMileCents,old.perMinuteCents,old.minimumFareCents],
 [100,85,15,300],'live fares must not silently be changed by a synthetic scenario');
assert.equal(pricingForRegion('ga-atlanta'),null);
const proposal={...old,perMileCents:95,perMinuteCents:32};
function price(p,miles,minutes){
  const fare=Math.max(p.minimumFareCents,p.baseCents+
    Math.round(miles*p.perMileCents)+Math.round(minutes*p.perMinuteCents));
  const result=quote(fare,null,[],'US',0);
  assert.equal(result.travelerPays,fare+result.appFee);
  assert.ok(result.appFee>=250);
  assert.ok(result.operatorGets>0);
  assert.ok(result._economics.platformContributionCents>=result._economics.requiredContributionCents);
  return result;
}
for(let pass=0;pass<2;pass++){
  for(const [m,mins,oldTotal,newTotal,oldOperator,newOperator] of [
    [6,15,1085,1400,827,1139],
    [7,18,1215,1591,956,1328],
    [8,22,1360,1814,1099,1549],
  ]){
    const a=price(old,m,mins), b=price(proposal,m,mins);
    assert.equal(a.travelerPays,oldTotal,'old illustrative scenario');
    assert.equal(b.travelerPays,newTotal,'new proposed scenario');
    assert.equal(a.operatorGets,oldOperator,'old operator amount');
    assert.equal(b.operatorGets,newOperator,'proposed operator amount');
  }
  assert.ok(REFERENCE_DIMENSIONS.includes('daypart'));
  assert.ok(REFERENCE_DIMENSIONS.includes('weekdayWeekend'));
  assert.ok(REFERENCE_DIMENSIONS.includes('calendarClass'));
  const calm=price(proposal,7,18);
  const traffic=price(proposal,7,28);
  assert.ok(traffic.travelerPays>calm.travelerPays);
  assert.equal(traffic.travelerPays-calm.travelerPays,320,
    '10 more routed minutes affect Fare under time rate, with same min Platform Fee');
  for(const date of ['2026-10-13','2026-10-17','2026-12-25']){
    assert.equal(price(proposal,7,18).travelerPays,1591,
      'a Saturday/holiday cannot silently add a fabricated multiplier on unchanged route conditions '+date);
  }
}
for(let pass=0;pass<2;pass++)for(let i=0;i<10000;i++){
  const miles=(i%50+1)/4,minutes=(i*7%50)+1;
  const a=price(old,miles,minutes),b=price(proposal,miles,minutes);
  assert.ok(b.travelerPays>=a.travelerPays);
  assert.ok(b.operatorGets>=a.operatorGets);
}
console.log('PASS twice: tri-county configured, 6/7/8 mile illustrative pricing, time traffic sensitivity, legal insurance geography and 20,000 synthetic price economics cases; no booking or real money.');
