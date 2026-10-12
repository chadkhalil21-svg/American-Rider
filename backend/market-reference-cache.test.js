'use strict';
const assert=require('node:assert/strict');
const {createMarketReferenceCache}=require('./market-reference-cache');
(async()=>{
 let reads=0,t=10000;
 const c=createMarketReferenceCache({load:async id=>{reads++;return {id};},now:()=>t,ttlMs:30000,maxEntries:3});
 const a=await Promise.all(Array.from({length:1000},()=>c.read('fl-miami-dade')));
 assert.equal(reads,1,'one read for 1000 concurrent bookings');
 assert.ok(a.every(x=>x.id==='fl-miami-dade'));
 t+=29999;await c.read('fl-miami-dade');assert.equal(reads,1);
 t++;await c.read('fl-miami-dade');assert.equal(reads,2);
 c.invalidate('fl-miami-dade');await c.read('fl-miami-dade');assert.equal(reads,3);
 await c.read('fl-broward');await c.read('fl-palm-beach');await c.read('il-chicago');
 assert.ok(c.size()<=3,'bounded memory independent of number of national markets');
 let attempts=0;
 const quota=createMarketReferenceCache({load:async()=>{if(++attempts===1)throw Error('quota');return null;}});
 await assert.rejects(quota.read('fl-miami-dade'),/quota/);
 assert.equal(await quota.read('fl-miami-dade'),null);
 assert.equal(attempts,2,'quota failure may not be cached as absent reference');
 let emptyLoads=0;
 const idle=createMarketReferenceCache({load:async()=>{emptyLoads++;return null;}});
 assert.equal(idle.size(),0);assert.equal(emptyLoads,0,'no background checks for zero bookings');
 for(let pass=0;pass<2;pass++){
  let loadCount=0;
  const n=createMarketReferenceCache({maxEntries:128,load:async id=>{loadCount++;return{id};}});
  for(let m=0;m<50;m++){
   const key='synthetic-market-'+m;
   const rows=await Promise.all(Array.from({length:1000},()=>n.read(key)));
   assert.ok(rows.every(x=>x.id===key));
  }
  assert.equal(loadCount,50,'50,000 quotes imply 50 snapshot reads in this ideal single-instance test');
 }
 console.log('PASS twice: 100,000 synthetic quote lookups, 100 underlying reads, negative cache, expiry and quota recovery');
})().catch(e=>{console.error(e);process.exitCode=1;});
