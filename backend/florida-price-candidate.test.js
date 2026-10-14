'use strict';
// Verify the exact release CANDIDATE on this PR; merging would affect live Fare.
// Physical-device and signed market admission remain separate required gates.
// External citations, assumptions and launch gates are in:
// docs/audits/SOUTH-FLORIDA-CONCRETE-PRICE-CANDIDATE-2026-10-13.md
const assert=require('node:assert/strict');
const {quote}=require('./payments');
const {pricingForRegion}=require('./market-pricing');
const {commissionCents,MIN_PLATFORM_FEE_CENTS}=require('./economics');

const current=pricingForRegion('fl-southeast');
const previous=Object.freeze({baseCents:100,perMileCents:85,perMinuteCents:15,minimumFareCents:300});
assert.ok(current);
assert.deepEqual(
  [current.baseCents,current.perMileCents,current.perMinuteCents,current.minimumFareCents],
  [100,95,32,300],
  'Florida release candidate must use the exact independently evaluated coefficients'
);
assert.equal(pricingForRegion('tx-dallas'),null,'no other state can inherit Florida fares');
const proposed=Object.freeze({baseCents:100,perMileCents:95,perMinuteCents:32,minimumFareCents:300});
function fare(p,miles,minutes){
  const money=p.baseCents+Math.round(miles*p.perMileCents)+Math.round(minutes*p.perMinuteCents);
  return Math.max(p.minimumFareCents,money);
}
function total(p,miles,minutes,country='US',toll=0,governmentFees=[]){
  const f=fare(p,miles,minutes);
  const q=quote(f,null,governmentFees,country,toll);
  assert.equal(q.operatorGets,f-commissionCents(f)+toll);
  assert.equal(q.travelerPays,f+q.appFee+q.passThroughCents);
  assert.ok(q.appFee>=MIN_PLATFORM_FEE_CENTS);
  assert.ok(q._economics.platformContributionCents>=q._economics.requiredContributionCents);
  return q;
}
for (const [miles,minutes,actual,proposedTotal,operatorFareProceeds] of [
  [3,10,755,955,698],
  [5,15,1000,1305,1045],
  [8,21,1345,1782,1517],
  [10,25,1575,2100,1832]
]){
  const old=total(previous,miles,minutes);
  const next=total(proposed,miles,minutes);
  assert.equal(old.travelerPays,actual);
  assert.equal(next.travelerPays,proposedTotal);
  assert.equal(next.operatorGets,operatorFareProceeds);
  assert.ok(next.travelerPays>old.travelerPays);
}
const ten=total(proposed,10,25);
const assumedVehicleCost=10*1.2*.76; // published IRS 76c used as tax proxy ONLY
const perPaidHour=(ten.operatorGets/100-assumedVehicleCost)/(25/60);
assert.ok(Math.abs(perPaidHour-22.08)<1e-8);
assert.ok(Math.abs(perPaidHour*.65-14.352)<1e-8);
assert.ok(perPaidHour*.65<20.24,'do not claim that a trip wage equals full-shift wage');
let checked=0;
for(let pass=0;pass<2;pass++){
  for(let i=0;i<12000;i++){
    const miles=.2+(i%601)/10;
    const minutes=1+((i*7)%160);
    const country=i%3===0?'US':i%3===1?'GB':null;
    const toll=i%17===0?550:0;
    const governmentFees=i%19===0?[{id:'test-pass-through',name:'Public body fee',payee:'public-body',cents:250}]:[];
    const old=total(previous,miles,minutes,country,toll,governmentFees);
    const next=total(proposed,miles,minutes,country,toll,governmentFees);
    assert.ok(next.travelerPays>=old.travelerPays);
    assert.equal(next.tollCents,toll);
    assert.equal(next.governmentFeeCents,old.governmentFeeCents);
    assert.ok(next.operatorGets>=old.operatorGets);
    checked++;
  }
}
assert.equal(checked,24000);
console.log('PASS 2x 12k proposed Florida price/economics and pass-through cases; 3/5/8/10-mile full Totals and Operator sensitivity. No money or live rate changed.');
