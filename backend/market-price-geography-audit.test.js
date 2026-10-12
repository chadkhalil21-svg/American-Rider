'use strict';
// OFFLINE geographical diagnostic test. The historical single-provider route
// averages below are MANUALLY TRANSCRIBED RESEARCH ONLY, NOT API INTEGRATIONS,
// not current offers, not independent market distributions, and not permission
// for automated use. Never treat these as live production price authority.
const assert=require('node:assert/strict');
const {pricingForTrip,pricingForRegion}=require('./market-pricing');
const {fareCentsForCoords}=require('./fares');
const {minimumPlatformFeeCents}=require('./economics');
const {regionForTrip}=require('./regions');
const historical=[
  // Routes, published route distance/duration, USD historical price, source.
  {market:'South Florida',name:'Fort Lauderdale -> Miami',
    pickup:{lat:26.1224,lng:-80.1373},dest:{lat:25.7617,lng:-80.1918},
    mi:27,min:49,referenceUsd:50,
    url:'https://www.uber.com/global/en/r/routes/fort-lauderdale-fl-to-miami-fl/'},
  {market:'Orlando',name:'Winter Park -> Orlando',
    pickup:{lat:28.6000,lng:-81.3392},dest:{lat:28.5384,lng:-81.3789},
    mi:13,min:31,referenceUsd:30,
    url:'https://www.uber.com/global/en/r/routes/winter-park-fl-to-orlando-fl/'},
  {market:'Orlando',name:'Kissimmee -> Orlando',
    pickup:{lat:28.29196,lng:-81.40757},dest:{lat:28.5384,lng:-81.3789},
    mi:13,min:25,referenceUsd:26,
    url:'https://www.uber.com/global/en/r/routes/kissimmee-fl-to-orlando-fl/'},
  {market:'Delaware',name:'Newark -> Wilmington',
    pickup:{lat:39.6837,lng:-75.7497},dest:{lat:39.7447,lng:-75.5484},
    mi:14,min:26,referenceUsd:45,
    url:'https://www.uber.com/global/en/r/routes/newark-de-to-wilmington-de/'},
  {market:'Delaware',name:'Dover -> Wilmington',
    pickup:{lat:39.15817,lng:-75.52437},dest:{lat:39.7447,lng:-75.5484},
    mi:49,min:55,referenceUsd:81,
    url:'https://www.uber.com/global/en/r/routes/dover-de-to-wilmington-de/'},
];
const fl=pricingForRegion('fl-southeast');
assert.ok(fl);
assert.equal(pricingForRegion('fl-orlando'),null);
assert.equal(pricingForRegion('de-wilmington'),null);
let out=[];
for(const row of historical){
  // This is a WHAT-IF sensitivity using Florida's curve, not a real quote in
  // Orlando/Delaware. Those regions must remain unpriced and unadmitted.
  const hypotheticalFare=Math.max(fl.minimumFareCents,
    fl.baseCents+Math.round(row.mi*fl.perMileCents)+Math.round(row.min*fl.perMinuteCents));
  const fee=minimumPlatformFeeCents({travelCostCents:hypotheticalFare,cardCountry:'US'});
  const total=hypotheticalFare+fee;
  const discountPct=(1-total/(100*row.referenceUsd))*100;
  assert.ok(Number.isFinite(discountPct));
  if(row.market!=='South Florida'){
    assert.equal(regionForTrip(row.pickup,row.dest),null,'unknown region may never silently inherit Miami pricing');
    assert.equal(pricingForTrip(row.pickup,row.dest),null);
    assert.equal(fareCentsForCoords(row.pickup,row.dest),null);
  } else {
    assert.equal(pricingForTrip(row.pickup,row.dest)?.regionId,'fl-southeast');
  }
  out.push({market:row.market,route:row.name,historicalReferenceUsd:row.referenceUsd,
    hypotheticalFloridaTotalUsd:Math.round(total)/100,
    hypotheticalDiscountPct:Math.round(discountPct*10)/10,
    evidenceStatus:'one-provider retrospective; non-authoritative',
    productionQuoteStatus:row.market==='South Florida'?'requires live route/toll/admission':'blocked: market not configured'});
}
assert.equal(out.length,5);
assert.ok(out.every(row=>row.evidenceStatus.includes('non-authoritative')));
console.log(JSON.stringify(out));
console.log('PASS: five real named geographic research examples and safe regional configuration isolation; NO vendor calls');
