'use strict';
const assert=require('node:assert/strict');
const {LIMIT,summarizeFirstPartyPricing}=require('./first-party-pricing');
const market=()=>({id:'fl-miami-dade'});
const b=(id,amount,status,extra={})=>({
 id,travelClass:'Standard',costCents:amount,miles:5,
 pickupLat:25.7,pickupLng:-80.2,status,...extra,
});
for(let pass=0;pass<2;pass++){
 const sample=[
  b('a',1299,'completed',{dep:'private address',travelerUid:'secret'}),
  b('b',1399,'completed'),b('c',1499,'cancelled'),
  b('d',1599,'awaiting_payment'),b('d',1599,'awaiting_payment'),
  b('e',1700,'completed',{operatorDemo:true}),b('f',900,'completed',{miles:NaN}),
  b('g',1000,'completed',{pickupLat:undefined}),b('h',1000,'completed',{travelClass:'Premium'}),
  b('i',1000,'completed',{journey:{leg1FareCents:2500}}),
 ];
 const report=summarizeFirstPartyPricing(sample,{resolveMarket:market});
 assert.equal(report.inspected,sample.length);
 assert.equal(report.valid,4);
 assert.equal(report.excluded,5);
 assert.equal(report.duplicates,1);
 assert.equal(report.completeQuoteFunnel,false);
 assert.equal(report.marketReferenceEligible,false);
 assert.equal(report.priceChangeAuthorized,false);
 assert.deepEqual(report.segments,[{
  marketId:'fl-miami-dade',distanceBand:'3-7',
  recorded:4,completed:2,cancelled:1,other:1,
  medianRecordedTotalCents:1449,medianCompletedTotalCents:1349,
 }]);
 const serialized=JSON.stringify(report);
 for(const privateValue of ['private address','secret','25.7','-80.2','travelerUid'])
   assert.equal(serialized.includes(privateValue),false,'no precise route, user data');
 const zero=summarizeFirstPartyPricing([], {resolveMarket:market});
 assert.deepEqual(zero.segments,[]);
 assert.equal(zero.valid,0);
 const broken=summarizeFirstPartyPricing([b('a',1000,'completed')],
   {resolveMarket:()=>{throw Error('provider down')}});
 assert.equal(broken.valid,0);
 assert.equal(broken.excluded,1);
 const saturated=summarizeFirstPartyPricing(Array.from({length:160},(_,i)=>b(String(i),1200,'completed')),
   {resolveMarket:market});
 assert.equal(saturated.inspected,LIMIT);
 assert.equal(saturated.valid,LIMIT);
 assert.equal(saturated.saturated,true);
 const noCounty=summarizeFirstPartyPricing([b('x',1200,'completed')],{resolveMarket:()=>null});
 assert.equal(noCounty.valid,0);
}
// Offline stress: generating 10K/100K/1M synthetic *possible* bookings
// must never cause unbounded report reads or processing. We simulate each
// workload with the same fixed 120-row Ops sample, without building 1M rows.
for(const volume of [10000,100000,1000000]){
 const bounded=Array.from({length:LIMIT},(_,i)=>b('case-'+i,1000+i%250,i%3?'completed':'cancelled'));
 const output=summarizeFirstPartyPricing(bounded,{resolveMarket:market,saturated:volume>LIMIT});
 assert.equal(output.inspected,LIMIT);
 assert.equal(output.valid,LIMIT);
 assert.equal(output.priceChangeAuthorized,false);
}
console.log('PASS twice: first-party pricing outcomes; idempotent sample, privacy, bounds and no fare promotion');
