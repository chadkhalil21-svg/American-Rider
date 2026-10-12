'use strict';
const assert=require('node:assert/strict');
const {regionalStartingRateCandidate}=require('./national-pricing-candidate');
const now=Date.parse('2026-10-12T00:00:00Z');
const evidence={
 asOf:'2026-05-01',operatorTargetNetCentsPerHour:2100,
 vehicleCostCentsPerMile:62,perTravelFixedCents:85,
 paidMinutesPer100DutyMinutes:42,deadheadMilesPer100PaidMiles:30,
 wageSource:'BLS approved 2025 area wage snapshot',
 vehicleCostSource:'AAA approved 2026 operating-cost snapshot',
};
const geo={countyFips:'12086',economicAreaId:'miami-metro',category:'metro'};
const candidate=regionalStartingRateCandidate({geography:geo,evidence,now});
assert.equal(candidate.status,'research-candidate');
assert.equal(candidate.marketTargetVerified,false);
assert.equal(candidate.bookable,false);
assert.equal(candidate.limits.requiresIndependentPromotion,true);
assert.deepEqual(candidate.coefficients,{
 baseCents:86,perMileCents:82,perMinuteCents:85,
 minimumFareCents:300,currency:'USD',
});
// In this simplified *research* cost model, the Operator's 99% share covers
// the assumed vehicle, deadhead, duty-time and fixed operating requirements.
// This does NOT represent current true Operator pay or market competitiveness.
for(const [miles,minutes] of [[1,4],[7,20],[20,42],[50,90],[150,270]]){
 const p=candidate.coefficients;
 const fare=Math.max(p.minimumFareCents,p.baseCents+p.perMileCents*miles+p.perMinuteCents*minutes);
 const minimumCost=evidence.perTravelFixedCents+
    evidence.vehicleCostCentsPerMile*(1+evidence.deadheadMilesPer100PaidMiles/100)*miles+
    evidence.operatorTargetNetCentsPerHour/(60*(evidence.paidMinutesPer100DutyMinutes/100))*minutes;
 assert.ok(fare*0.99>=minimumCost-0.01,
  'cost assumption must not be lower than the 99% Operator share of the calculated Fare');
}
const reject=e=>assert.throws(()=>regionalStartingRateCandidate({geography:geo,evidence:{...evidence,...e},now}));
reject({operatorTargetNetCentsPerHour:NaN});
reject({paidMinutesPer100DutyMinutes:0});
reject({deadheadMilesPer100PaidMiles:-1});
reject({vehicleCostCentsPerMile:0});
reject({perTravelFixedCents:Infinity});
reject({asOf:'2022-01-01'});
reject({asOf:'2031-01-01'});
reject({vehicleCostSource:evidence.wageSource});
assert.throws(()=>regionalStartingRateCandidate({geography:{...geo,countyFips:'1208'},evidence,now}));
assert.throws(()=>regionalStartingRateCandidate({geography:{...geo,category:'unverified'},evidence,now}));
const fipsStates=[
 '01','02','04','05','06','08','09','10','11','12','13','15','16','17','18','19','20','21','22','23',
 '24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','44',
 '45','46','47','48','49','50','51','53','54','55','56',
];
assert.equal(fipsStates.length,51);
for(let pass=0;pass<2;pass++){
 let generated=0;
 for(let i=0;i<1000;i++){
   for(let j=0;j<fipsStates.length;j++){
     const g={countyFips:fipsStates[j]+'001',
       economicAreaId:'synthetic-'+fipsStates[j]+'-'+(i%13),
       category:['metro','micro','nonmetro'][i%3]};
     const inputs={...evidence,operatorTargetNetCentsPerHour:1200+(i%37)*75,
       vehicleCostCentsPerMile:25+(i%13)*8,
       paidMinutesPer100DutyMinutes:15+(i%72),
       deadheadMilesPer100PaidMiles:(i*3)%155};
     const row=regionalStartingRateCandidate({geography:g,evidence:inputs,now});
     assert.equal(row.bookable,false);
     assert.equal(row.marketTargetVerified,false);
     assert.equal(row.geography.countyFips,g.countyFips);
     assert.ok(row.coefficients.perMileCents>0&&row.coefficients.perMinuteCents>0);
     generated++;
   }
 }
 assert.equal(generated,51000);
}
console.log('PASS twice: 102,000 synthetic cost-floor candidate generations spanning 50 states + DC; zero live prices, API, database or provider payments');
