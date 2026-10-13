'use strict';
const assert=require('node:assert/strict');
const {normalizeObservation}=require('./market-evidence-ingest');
const {buildReferenceCell,comparableObservation}=require('./market-reference-service');
const {qualification}=require('./market-reference-authority');
const now=Date.parse('2026-10-13T16:00:00Z');
const stamp='2026-10-13T15:30:00Z';
const base={marketId:'fl-miami-dade',serviceClass:'standard',
  observedAt:stamp,routedMiles:8,routedMinutes:21,
  travelerTotalCents:2720,daypart:'midday',weekdayWeekend:'weekday',
  calendarClass:'ordinary',regulatedLocationClass:'ordinary'};
function record(sourceId,sourceType,i,comparable=true) {
  return normalizeObservation({...base,sourceId,sourceType,
    providerKey:sourceId==='controlled-public-price-panel'?'supplier-panel':'auditor-independent',
    sourceObservationId:'obs-test-'+String(i).padStart(6,'0'),
    travelerTotalCents:2700+(i%5)*10,
    hasAllInTotalComparable:comparable});
}
const official=record('chicago-tnp-open-data','government-trips',1,true);
const estimates=record('taxifare-public-observed','platform-publication',2,true);
assert.equal(comparableObservation(official),false,'Chicago tip-inclusive history cannot be live quotes');
assert.equal(comparableObservation(estimates),false,'estimated market aggregates cannot authorize a route price');
const researchOnly=buildReferenceCell([official,estimates],now);
assert.equal(researchOnly.travelerTotalComparable,false);
assert.equal(researchOnly.referenceTotalCents,null);
assert.equal(researchOnly.targetTotalCents,null);
assert.equal(researchOnly.observations,0);
assert.equal(researchOnly.researchObservations,2);
assert.deepEqual(researchOnly.sources,[]);

const panel=Array.from({length:10},(_,i)=>record('controlled-public-price-panel','field-panel',i));
const audit=Array.from({length:10},(_,i)=>record('independent-controlled-audit','independent-audit',i+10));
const mixed=buildReferenceCell([...panel,...audit,...Array(100).fill(estimates)],now);
assert.equal(mixed.researchObservations,120);
assert.equal(mixed.observations,20,'100 public estimates may not inflate the eligible sample');
assert.equal(mixed.sources.length,2);
assert.equal(mixed.evidenceFamilies.length,2);
assert.equal(mixed.travelerTotalComparable,true);
assert.equal(mixed.maxProviderShare,0.5);
assert.ok(mixed.referenceTotalCents>0);
assert.equal(mixed.targetTotalCents,Math.round(mixed.referenceTotalCents*0.90));

const plan={minimumIndependentFamilies:2,maxObservationAgeDays:30};
const asOf=new Date(now).toISOString();
const candidate={asOf,promotion:{status:'candidate'},cells:{key:mixed}};
assert.equal(qualification(candidate,plan,mixed,now).ok,false,'self-declared feed never promotes itself');
const reviewed={...candidate,promotion:{status:'promoted',snapshotAsOf:asOf,
  holdoutPassed:true,economicsPassed:true,routerPassed:true}};
assert.equal(qualification(reviewed,plan,mixed,now).ok,true,
  'independently checked comparable source families can become eligible only after signed promotion');
for(const invalid of [
 buildReferenceCell([...panel,...Array(200).fill(estimates)],now),
 buildReferenceCell([...panel,...audit.map(r=>({...r,hasAllInTotalComparable:false}))],now),
 buildReferenceCell([...panel.slice(0,4),...audit.slice(0,5)],now),
]){
 assert.equal(qualification(reviewed,plan,invalid,now).ok,false,
   'noncomparable, one-family or too-few verified prices must be denied');
}
for(let pass=0;pass<2;pass++){
 for(const volume of [10000,100000,1000000]){
  const scope=buildReferenceCell([...panel,...audit,estimates],now);
  assert.equal(scope.observations,20,
    volume+' Travelers cannot manufacture external market observations');
  assert.equal(scope.researchObservations,21);
 }
}
console.log('PASS: market evidence lineage, source rights gate, unpromoted holdout, 2-pass 10k/100k/1m scale-invariance; no money/DB/network');
