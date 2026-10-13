'use strict';
// Protect the first commercial fare revision from silent legacy app charges.
// Synthetic-only; no Stripe, Firebase, live booking, or new market activation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pricingForRegion,pricingForTrip,requiresAgreedTotalOnBooking} = require('./market-pricing');
const {quote} = require('./payments');
const release = pricingForRegion('fl-southeast');
assert.deepEqual([release.baseCents,release.perMileCents,release.perMinuteCents,
  release.minimumFareCents],[100,85,15,300]);
assert.equal(requiresAgreedTotalOnBooking(release),false,
  'present released price must not immediately abandon existing TestFlight testers');
const proposal={...release,perMileCents:95,perMinuteCents:32,evidenceAsOf:'2026-10-13'};
assert.equal(requiresAgreedTotalOnBooking(proposal),true,
  'proposed Florida 95c/mi and 32c/min cannot book on an unconfirmed old app');
for(const k of ['baseCents','perMileCents','perMinuteCents','minimumFareCents']){
 const raised={...release,[k]:release[k]+1};
 assert.equal(requiresAgreedTotalOnBooking(raised),true,'all four changes require consent: '+k);
}
assert.equal(requiresAgreedTotalOnBooking(null),true,'unknown region fails closed');
assert.equal(requiresAgreedTotalOnBooking({...release,regionId:'tx-austin'}),true,
  'national expansion cannot inherit 2026 Florida app behavior');
assert.equal(pricingForRegion('ny-nyc'),null);
assert.equal(pricingForTrip({lat:30.2672,lng:-97.7431},{lat:30.1975,lng:-97.6664}),null);
const txt=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
const head=txt.indexOf("app.post('/travel/prepare'");
const until=txt.indexOf("app.post(",head+12);
const prepare=txt.slice(head,until<0?undefined:until);
const required=prepare.indexOf('requiresAgreedTotalOnBooking(pricingForTrip(pickup, destinationPoint))');
const changed=prepare.indexOf('b.agreedTotalCents!==priced.travelerPays');
const after=prepare.indexOf('const partyResult =');
assert.ok(required>=0 && changed>required && after>changed,
  'mandatory upgraded-client agreement precedes matching and payment');
assert.match(prepare,/res\.status\(428\)/);
assert.match(prepare,/code: 'travel_price_confirmation_required'/);
assert.match(prepare,/code:'travel_total_changed'/);
assert.match(prepare,/!Number\.isSafeInteger\(b\.agreedTotalCents\)/);
// Exercise identical cents for a current-app Traveler and refusal paths for a
// hypothetical old app. Compare domestic/foreign cards, tolls and fees.
// No provider service call, account data, or money can occur.
let scenarios=0;
for(let pass=0;pass<2;pass++)for(let i=0;i<12000;i++){
 const miles=1+(i%61),minutes=1+((i*7)%120);
 const travelFare=Math.max(300,100+Math.round(miles*95)+Math.round(minutes*32));
 const country=i%3===0?'US':i%3===1?'CA':null;
 const toll=i%17===0?500:0;
 const fees=i%19===0?[{id:'synthetic',name:'Official fee',payee:'public-body',cents:250}]:[];
 const priced=quote(travelFare,null,fees,country,toll);
 assert.ok(requiresAgreedTotalOnBooking(proposal));
 const acceptedTotal=priced.travelerPays;
 assert.ok(Number.isSafeInteger(acceptedTotal)&&acceptedTotal>0);
 assert.equal(acceptedTotal,travelFare+priced.appFee+priced.passThroughCents);
 assert.equal(priced.operatorGets,travelFare-Math.floor(travelFare*.01)+toll);
 assert.ok(priced._economics.platformContributionCents>=priced._economics.requiredContributionCents);
 assert.equal(acceptedTotal===priced.travelerPays,true,'current app exact Total');
 assert.equal(acceptedTotal+1===priced.travelerPays,false,'changed quote must be rejected');
 scenarios++;
}
assert.equal(scenarios,24000);
console.log('PASS 24,000 x2 synthetic fare agreement/economics cases and fail-closed future rate activation; current Florida legacy untouched.');
