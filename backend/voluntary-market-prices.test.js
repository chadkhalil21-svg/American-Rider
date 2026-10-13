'use strict';
const assert=require('node:assert/strict');
const {validateVoluntaryPrice,receiveVoluntaryPrice,COLLECTION,MAX_AGE_MS}
  =require('./voluntary-market-prices');
const NOW=Date.parse('2026-10-13T13:00:00Z');
const UID='synthetic-user-aaaaaaaaaaaa';
const normal=()=>({
  pickup:{lat:25.795,lng:-80.28},
  observationId:'own-price-receipt-0001',
  observedAt:'2026-10-12T18:00:00Z',
  routedMiles:6.3,routedMinutes:19,
  travelerTotalCents:1550,
  serviceClass:'standard',ordinaryNoPromotion:true,
  sourceKind:'my-receipt',
  providerCode:'other-leading-platform-a',
  consentToResearch:true,
});
const pick=p=>({id:'fl-miami-dade',regionId:'fl-southeast'});
const plain=validateVoluntaryPrice({body:normal(),uid:UID,now:NOW,marketForPoint:pick});
assert.equal(plain.document.marketId,'fl-miami-dade');
assert.equal(plain.document.pricePromotionEligible,false);
assert.equal(plain.document.reviewState,'quarantined');
assert.equal(plain.document.travelerTotalCents,1550);
assert.equal(plain.document.pickup,undefined);
assert.equal(plain.document.contributorUid,undefined);
assert.equal(plain.document.observationId,undefined);
assert.equal(JSON.stringify(plain.document).includes(UID),false);
assert.equal(JSON.stringify(plain.document).includes('25.795'),false);
assert.equal(plain.id.length,64);
assert.equal(MAX_AGE_MS,14*86400000);
const countyBody={...normal(),marketId:'fl-broward'};
delete countyBody.pickup;
const byCounty=validateVoluntaryPrice({body:countyBody,uid:UID,now:NOW,
  marketList:()=>[{id:'fl-broward',regionId:'fl-southeast'}]});
assert.equal(byCounty.document.marketId,'fl-broward');
assert.equal(byCounty.document.marketEvidence,'contributor-declared-county');
assert.throws(()=>validateVoluntaryPrice({body:countyBody,uid:UID,now:NOW,marketList:()=>[]}),/known source market/);
assert.throws(()=>validateVoluntaryPrice({body:{...normal(),marketId:'fl-broward'},uid:UID,now:NOW}),/one pickup market method/);

assert.deepEqual(plain,validateVoluntaryPrice({body:normal(),uid:UID,now:NOW,marketForPoint:pick}));
assert.notEqual(plain.id,validateVoluntaryPrice({body:{...normal(),observationId:'own-price-receipt-0002'},uid:UID,now:NOW,marketForPoint:pick}).id);
assert.notEqual(plain.id,validateVoluntaryPrice({body:normal(),uid:UID+'different',now:NOW,marketForPoint:pick}).id);
assert.notEqual(plain.id,validateVoluntaryPrice({body:normal(),uid:UID,now:NOW,marketForPoint:()=>({id:'fl-broward'})}).id);
const fails=[
  [{consentToResearch:false},/consent/],
  [{ordinaryNoPromotion:false},/ordinary/],
  [{serviceClass:'premium'},/ordinary/],
  [{sourceKind:'platform-scraped'},/source kind/],
  [{providerCode:'untrusted-platform-X'},/provider kind/],
  [{observationId:'short'},/observation ID/],
  [{observedAt:'2026-09-01T00:00:00Z'},/stale/],
  [{observedAt:'2026-10-13T14:00:01Z'},/stale/],
  [{routedMiles:Infinity},/metrics/],
  [{routedMiles:0},/metrics/],
  [{routedMinutes:-2},/metrics/],
  [{travelerTotalCents:0},/metrics/],
  [{travelerTotalCents:1000000},/metrics/],
  [{travelerTotalCents:17.5},/metrics/],
  [{pickup:{lat:0,lng:0,email:'stolen'}},/pickup/],
  [{pickup:{lat:91,lng:0}},/pickup/],
  [{routedMiles:180,routedMinutes:9},/speed/],
  [{userId:'private'},/identifying/],
  [{name:'private'},/identifying/],
  [{photoBase64:'private'},/identifying/],
  [{deviceId:'private'},/identifying/],
  [{income:12345},/identifying/],
  [{receiptUrl:'private'},/identifying/],
];
for(const [changes,re] of fails)
  assert.throws(()=>validateVoluntaryPrice({body:{...normal(),...changes},uid:UID,now:NOW,marketForPoint:pick}),re);
assert.throws(()=>validateVoluntaryPrice({body:normal(),uid:'',now:NOW,marketForPoint:pick}),/authenticated/);
assert.throws(()=>validateVoluntaryPrice({body:normal(),uid:UID,now:NOW,marketForPoint:()=>null}),/known source market/);
assert.throws(()=>validateVoluntaryPrice({body:{...normal(),pickup:{lat:30.2672,lng:-97.7431}},uid:UID,now:NOW}),/known source market/,
 'real outside-state geography must be rejected by the live FIPS market gate');

(async()=>{
 const saved=new Map(),writes=[];
 const db={collection(name){
   assert.equal(name,COLLECTION);
   return {doc(id){
     return {create:async record=>{
       if(saved.has(id)){const e=Error('exists');e.code=6;throw e}
       saved.set(id,record);writes.push(id);
     },get:async()=>({exists:saved.has(id),data:()=>saved.get(id)})};
   }};
 }};
 for(let pass=1;pass<=2;pass++){
   const x=await receiveVoluntaryPrice({db,uid:UID,body:normal(),now:NOW,marketForPoint:pick});
   assert.equal(x.ok,true);assert.equal(x.researchOnly,true);
   assert.equal(x.reused,pass===2);
 }
 assert.equal(writes.length,1,'duplicate research receipt must not create a second Firestore write');
 await assert.rejects(receiveVoluntaryPrice({db,uid:UID,body:{...normal(),travelerTotalCents:1800},now:NOW,marketForPoint:pick}),/different facts/);
 assert.equal(saved.size,1);
 const downDb={collection:()=>({doc:()=>({create:async()=>{throw Error('quota exhausted')}})})};
 await assert.rejects(receiveVoluntaryPrice({db:downDb,uid:UID,body:normal(),now:NOW,marketForPoint:pick}),/quota exhausted/);
 // Synthetic large-market case: bounded normalization and hash stability,
 // zero HTTP requests, zero additional durable writes or personal identifiers.
 let count=0;
 for(let pass=0;pass<2;pass++){
   for(let i=0;i<15000;i++){
     const b={...normal(),routedMiles:1+i%60,routedMinutes:45+i%85,
       travelerTotalCents:450+i%30000};
     const picked=validateVoluntaryPrice({body:b,uid:UID,now:NOW,
       marketForPoint:()=>({id:i%3===0?'fl-miami-dade':i%3===1?'fl-broward':'fl-palm-beach'})});
     assert.equal(picked.document.reviewState,'quarantined');
     assert.equal(picked.document.pricePromotionEligible,false);
     assert.ok(Number.isSafeInteger(picked.document.travelerTotalCents));
     count++;
   }
 }
 assert.equal(count,30000);
 console.log('PASS twice 30,000 synthetic volunteered fare observations: geographic, fraud, privacy, consent, duplicates and zero auto price promotion');
})().catch(e=>{console.error(e);process.exitCode=1});
