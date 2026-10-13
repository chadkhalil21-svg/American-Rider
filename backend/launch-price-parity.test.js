'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {quote}=require('./payments');
const {fareForMarketTarget,controlledTargetFromAllIn}=require('./market-reference-fare');
const {pricingForRegion,pricingForTrip}=require('./market-pricing');
const txt=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
// The price rendered on the booking sheet is the SAME all-in cent amount the
// backend returns; neither a vehicle-class multiplier nor a second platform
// fee calculation may occur on the phone.
const ctx=txt('src/state/RideContext.tsx'),reserve=txt('app/reserve.tsx');
const fareClient=txt('src/backend/fares.ts'),server=txt('backend/server.js');
const dispatch=txt('src/backend/dispatch.ts');
assert.match(ctx,/quotedForClass===travelClass&&quotedTotalCents!==null/);
assert.match(ctx,/quotedTotalCents\/100/);
// Named pickup and mapped pin must never keep an earlier route's displayed Total.
assert.match(reserve,/const pickupChanged = !oldCoords/);
assert.match(reserve,/ride\.setTripCoords\(oldCoords/);
assert.match(ctx,/const seq = \+\+repriceSeq\.current/);
assert.match(ctx,/if \(!live \|\| seq !== repriceSeq\.current\) return/);
assert.match(ctx,/const costN=quotedFareCents\/100/);
assert.doesNotMatch(ctx,/const fare = applyClassCents\(baseCents, travelClass\)/);
assert.match(reserve,/ride\.quotedForClass===ride\.travelClass/);
assert.match(reserve,/ride\.quotedTotalCents\/100/);
assert.doesNotMatch(reserve,/platformFee\(fare\)/);
assert.match(fareClient,/travelerPays: d\.travelerPays/);
assert.match(fareClient,/Number\.isSafeInteger\(d\?\.travelerPays\)/);
assert.match(dispatch,/agreedTotalCents\?: number/);
assert.match(ctx,/agreedTotalCents:quotedTotalRef\.current/);
assert.match(server,/b\.agreedTotalCents!==priced\.travelerPays/);
assert.match(server,/code:'travel_total_changed'/);
assert.match(ctx,/code==='travel_total_changed'/);
assert.match(txt('app/ride.tsx'),/ride\.dispatchState==='price_changed'/);
assert.equal(pricingForTrip(null,null),null,'no nationwide default');
const p=pricingForRegion('fl-southeast');
assert.ok(p&&p.baseCents===100&&p.perMileCents===85&&p.perMinuteCents===15);
const examples=[
 {name:'Miami ordinary directional',miles:8,minutes:21,estimate:2773},
 {name:'Cutler Bay directional',miles:8.5,minutes:22,estimate:3074},
 {name:'FLL directional, ignoring facility surcharges',miles:16,minutes:33,estimate:4084},
 {name:'PBI directional, ignoring facility surcharges',miles:13,minutes:22,estimate:3235},
];
for(const e of examples){
 const fare=Math.max(p.minimumFareCents,p.baseCents+
  Math.round(e.miles*p.perMileCents)+Math.round(e.minutes*p.perMinuteCents));
 const observed=quote(fare,null,[],'US',0);
 assert.equal(observed.travelerPays,fare+observed.appFee);
 assert.equal(observed.operatorGets,fare-Math.floor(fare/100));
 assert.equal(observed.platformTake,observed.appFee+observed.commission);
 assert.equal(observed._economics.platformContributionCents>=observed._economics.requiredContributionCents,true);
 assert.ok(observed.travelerPays<e.estimate,'directional publication warns of possible material underpricing');
 for(const country of ['US','GB',null]){
  for(const surcharge of [{toll:0,gvt:0},{toll:500,gvt:200}]){
   const government=surcharge.gvt?[{id:'synthetic',name:'Synthetic government fee',payee:'local authority',cents:surcharge.gvt}]:[];
   const q=f=>quote(f,null,government,country,surcharge.toll);
   const baseline=q(fare);
   const targetAllIn=Math.round(e.estimate*.95)+surcharge.toll+surcharge.gvt;
   const target=controlledTargetFromAllIn({
    targetTravelerTotalCents:targetAllIn,passThroughCents:baseline.passThroughCents,
   });
   const solved=fareForMarketTarget({floorFareCents:fare,targetControlledTotalCents:target,quoteForFare:q});
   const proposed=q(solved.fareCents);
   assert.ok(proposed.travelerPays<=targetAllIn,'no double addition of government fees or tolls');
   assert.ok(proposed.travelerPays>=baseline.travelerPays,'do not undercut cost-plus floor');
   assert.ok(proposed._economics.platformContributionCents>=proposed._economics.requiredContributionCents);
   assert.equal(proposed.operatorGets,solved.fareCents-Math.floor(solved.fareCents/100)+surcharge.toll);
   assert.equal(proposed.travelerPays,
     solved.fareCents+proposed.appFee+surcharge.gvt+surcharge.toll);
  }
 }
 console.log('DIRECTIONAL ONLY '+e.name+': formula $'+(observed.travelerPays/100).toFixed(2)+
  ' vs February 2026 third-party ESTIMATE $'+(e.estimate/100).toFixed(2)+
  '; not an actual matched fare, no price promotion');
}
// Large numbers of bookings must not create market-price certainty; this test
// exercises one quote and many repeat-safe settlement invariants, not mock
// external competitors or falsely claim to have load-tested a million charges.
for(let pass=0;pass<2;pass++){
 for(let i=0;i<10000;i++){
  const miles=1+i%180/10,mins=3+i%65;
  const fare=Math.max(p.minimumFareCents,p.baseCents+Math.round(miles*p.perMileCents)+Math.round(mins*p.perMinuteCents));
  const q=quote(fare,null,[],i%2?'GB':'US',i%5===0?125:0);
  assert.equal(q.travelerPays,q._economics.travelerPays);
  assert.equal(q.operatorGets,q._economics.operatorGets);
  assert.ok(q._economics.platformContributionCents>=q._economics.requiredContributionCents);
 }
}
console.log('PASS: 2 x 10,000 synthetic exact-cent Traveler fare, Operator split and fee floor checks');
