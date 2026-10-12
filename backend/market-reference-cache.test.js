'use strict';
const assert=require('node:assert/strict');
const {createReferenceCache}=require('./market-reference-cache');
(async()=>{
  let time=0,reads=0;
  let release=()=>{};
  let gate=Promise.resolve();
  let state={ok:true};
  const cache=createReferenceCache({
    load:async id=>{reads++;await gate;return state===null?null:{marketId:id,...state};},
    now:()=>time,ttlMs:30_000,maxEntries:3,
  });
  let batch=await Promise.all(Array.from({length:1000},()=>cache.read('fl-miami-dade')));
  assert.equal(reads,1,'1000 simultaneous requests must use just one Firestore read');
  assert.equal(batch.length,1000);
  time=29_999;await cache.read('fl-miami-dade');assert.equal(reads,1);
  time=30_000;await cache.read('fl-miami-dade');assert.equal(reads,2);
  cache.invalidate('fl-miami-dade');await cache.read('fl-miami-dade');assert.equal(reads,3);
  state=null;time=60_000;await cache.read('fl-miami-dade');assert.equal(reads,4);
  await cache.read('fl-miami-dade');assert.equal(reads,4,'empty market result must be negative-cached');
  const ids=['fl-broward','fl-palm-beach','ny-nyc','de-wilmington'];
  for(const id of ids)await cache.read(id);
  assert.ok(cache.size()<=3,'small max entries must never grow with national market catalog');
  let attempts=0;
  const outage=createReferenceCache({now:()=>time,load:async()=>{attempts++;if(attempts===1)throw new Error('quota');return null;}});
  await assert.rejects(outage.read('fl-miami-dade'),/quota/);
  assert.equal(await outage.read('fl-miami-dade'),null);
  assert.equal(attempts,2,'database outage must not poison the missing-evidence cache');
  // Idle markets produce NO read at all.
  const idle=createReferenceCache({load:async()=>{throw Error('should never load');}});
  assert.equal(idle.size(),0);
  assert.equal(await idle.read(''),null);
  assert.equal(idle.size(),0);
  // Double simulation under high load: 50 isolated active markets x 1000
  // simultaneous quotations per market; 50 reads instead of 50,000.
  for(let pass=0;pass<2;pass++){
    let backendReads=0;
    const national=createReferenceCache({load:async id=>{backendReads++;return {marketId:id};},maxEntries:128});
    for(let i=0;i<50;i++){
      const id='synthetic-market-'+i;
      const results=await Promise.all(Array.from({length:1000},()=>national.read(id)));
      assert.equal(results.length,1000);
      assert.ok(results.every(x=>x.marketId===id));
    }
    assert.equal(backendReads,50);
  }
  console.log('PASS: two 50,000-quote national cache campaigns; no idle reads, bounded cache, negative caching, quota error recovery');
})().catch(e=>{console.error(e);process.exitCode=1;});
