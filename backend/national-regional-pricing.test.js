'use strict';
const assert=require('node:assert/strict');
const {countyPriceCandidate}=require('./national-regional-pricing');
const NOW=Date.parse('2026-10-12T20:00:00Z');
const POLICY=Object.freeze({
  asOf:'2026-10-01',operatorNetFloorCentsPerHour:2000,
  wageToNetTargetMultiplierBps:12000,vehicleCostCentsPerMile:76,
  vehicleCostSource:'IRS 2026 H2 TAX benchmark (not real Operator vehicle cost)',
  paidMinutesPer100DutyMinutes:45,deadheadMilesPer100PaidMiles:35,
  perTravelFixedCents:85,
});
function profile(fips,category='metro',area='33100'){
 return {countyFips:fips,countyName:'Fictional County',category,
  cbsaCode:category==='nonmetro'?null:'33100',
  economicAreaId:'bls-'+area,blsAreaCode:area,
  blsComparisonOccupation:'53-3054',blsEmployeeMedianHourlyUSD:18.5};
}
function snapshot(profiles){
 return {status:'research-only',bookable:false,liveFareModified:false,
   sourceVerifiedByChecksum:true,sourceVintage:{cbsa:'2023',blsOews:'2025-05'},
   profiles,unresolved:{},sourceSha256:{censusCbsa:'synthetic-not-real-source'}};
}
const EXAMPLE=snapshot({'12086':profile('12086')});
const quote=countyPriceCandidate({countyFips:'12086',geographySnapshot:EXAMPLE,policy:POLICY,now:NOW});
assert.equal(quote.status,'research-candidate');
assert.equal(quote.bookable,false);
assert.equal(quote.marketTargetVerified,false);
assert.equal(quote.pricingAuthority,'NONE - RESEARCH ONLY');
assert.equal(quote.evidence.blsEmployeeMedianHourlyUSD,18.5);
assert.equal(quote.geography.economicAreaId,'bls-33100');
assert.ok(quote.coefficients.perMileCents>76);
assert.ok(quote.coefficients.perMinuteCents>0);
// Cost-floor formula pays 99% of fare and includes unpaid duty + empty miles.
const travel=(miles,minutes)=>{
 const c=quote.coefficients;
 const fare=Math.max(c.minimumFareCents,c.baseCents+c.perMileCents*miles+c.perMinuteCents*minutes);
 const actualCost=85 + 76*1.35*miles + 2220/(60*.45)*minutes;
 assert.ok(fare*.99>=actualCost-0.01,'Operator 99% fare covers THESE study assumptions');
};
for(const [mi,min] of [[1,5],[5,15],[25,50],[120,200]])travel(mi,min);
const hold=(county,geo=EXAMPLE,policy=POLICY)=>{
 const x=countyPriceCandidate({countyFips:county,geographySnapshot:geo,policy,now:NOW});
 assert.equal(x.status,'research-hold');assert.equal(x.bookable,false);return x;
};
assert.match(hold('12029').reason,/unverified/);
assert.match(hold('12086',EXAMPLE,null).reason,/cost assumptions/);
assert.match(hold('12X86').reason,/invalid/);
assert.match(hold('12086',{...EXAMPLE,sourceVerifiedByChecksum:false}).reason,/absent/);
const other=snapshot({'12029':profile('12029','nonmetro','12440')});
assert.equal(countyPriceCandidate({countyFips:'12029',geographySnapshot:other,policy:POLICY,now:NOW}).geography.category,'nonmetro');
for(const change of [
 {wageToNetTargetMultiplierBps:9999},{paidMinutesPer100DutyMinutes:0},
 {vehicleCostCentsPerMile:0},{operatorNetFloorCentsPerHour:NaN},
 {perTravelFixedCents:-1},
])assert.throws(()=>countyPriceCandidate({
 countyFips:'12086',geographySnapshot:EXAMPLE,policy:{...POLICY,...change},now:NOW
}));
const STATES='01 02 04 05 06 08 09 10 11 12 13 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 44 45 46 47 48 49 50 51 53 54 55 56'.split(' ');
assert.equal(STATES.length,51);
const all={};
for(const s of STATES)for(let i=1;i<=61;i++){
 const f=s+String(i).padStart(3,'0');
 all[f]=profile(f,i%3===0?'nonmetro':i%3===1?'metro':'micro',
   i%3===0?'12440':'33100');
}
for(let pass=1;pass<=2;pass++){
 let count=0;
 const verified=snapshot(all);
 for(const code of Object.keys(all)){
  const x=countyPriceCandidate({countyFips:code,geographySnapshot:verified,policy:POLICY,now:NOW});
  assert.equal(x.bookable,false);
  assert.equal(x.status,'research-candidate');
  assert.equal(x.marketTargetVerified,false);
  assert.ok(x.coefficients.minimumFareCents>=300);
  count++;
 }
 assert.equal(count,51*61);
 console.log('PASS synthetic 51-jurisdiction nationwide candidate pass '+pass+' with '+count+' county studies; ZERO approved price changes');
}
console.log('PASS operator-share economic study, invalid/missing publisher data, nonmetro separation, source integrity HOLD');
