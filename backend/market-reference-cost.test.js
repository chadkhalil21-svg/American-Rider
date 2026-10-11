'use strict';
const assert=require('node:assert/strict');
const {runMarketReferenceSweep,persistObservations,MAX_OBSERVATIONS_PER_MARKET_SWEEP,eligibleEvidenceMarkets,sourceFingerprint}=require('./market-reference-service');
(async()=>{
  let collectorCalled=false;
  const configured=eligibleEvidenceMarkets(['fl-miami-dade','fl-broward','fl-palm-beach']);
  assert.deepEqual(configured,['fl-miami-dade','fl-broward','fl-palm-beach']);
  assert.ok(!configured.includes('il-chicago'));
  const empty=await runMarketReferenceSweep({
    collectors:{'chicago-tnp-open-data':async()=>{collectorCalled=true;return[];}},
    enabledMarketIds:[],
  });
  assert.equal(empty.ok,true);
  assert.equal(empty.skipped,'no_enabled_service_markets');
  assert.deepEqual(empty.markets,{});
  assert.equal(collectorCalled,false,'no configured market may never fetch');
  // Florida may be configured, but it has no licensed / live evidence collectors.
  // The prelaunch process must return without even looking up a Firestore client.
  const noSource=await runMarketReferenceSweep({
    collectors:{'chicago-tnp-open-data':async()=>{collectorCalled=true;return[];}},
    enabledMarketIds:['fl-miami-dade','fl-broward','fl-palm-beach'],
  });
  assert.equal(noSource.skipped,'no_active_market_collectors');
  assert.deepEqual(noSource.markets,{});
  assert.equal(collectorCalled,false);
  // National expansion must not multiply database work for research-only cities.
  const thousandFutureMarkets=Array.from({length:1000},(_,i)=>'research-city-'+i);
  const idleNation=await runMarketReferenceSweep({
    collectors:{'chicago-tnp-open-data':async()=>{collectorCalled=true;throw Error('research collector unexpectedly invoked');}},
    enabledMarketIds:thousandFutureMarkets,
  });
  assert.equal(idleNation.skipped,'no_enabled_service_markets');
  assert.deepEqual(idleNation.markets,{});
  assert.equal(collectorCalled,false,'1000 uncommissioned markets cause zero source fetches');
  const sample={marketId:'fl-miami-dade',sourceId:'independent',observedAt:'2026-10-10T12:00:00Z'};
  assert.equal(sourceFingerprint([sample]),sourceFingerprint([{...sample}]));
  assert.notEqual(sourceFingerprint([sample]),sourceFingerprint([{...sample,observedAt:'2026-10-11T12:00:00Z'}]));

  // A public dataset often changes ordering while its released facts stay the
  // same. Such reorderings must not force an hourly checkpoint write or repeat
  // document-create attempts for up to 100 unchanged records per market.
  const two=[sample,{marketId:'fl-broward',sourceId:'independent',observedAt:'2026-10-10T14:00:00Z',attributes:{a:1,b:2}}];
  const reordered=[{attributes:{b:2,a:1},observedAt:'2026-10-10T14:00:00Z',sourceId:'independent',marketId:'fl-broward'},sample];
  assert.equal(sourceFingerprint(two),sourceFingerprint(reordered),
    'row and JSON-key order changes are not new evidence');
  assert.notEqual(sourceFingerprint(two),sourceFingerprint([...two,sample]),
    'real evidence multiplicity must not silently disappear');
  assert.notEqual(sourceFingerprint(two),sourceFingerprint([sample,{...two[1],attributes:{a:1,b:3}}]),
    'changed source values must remain observable');
  const nationalSample=Array.from({length:100},(_,i)=>({...sample,observation:i,attrs:{class:'standard',value:i}}));
  assert.equal(sourceFingerprint(nationalSample),sourceFingerprint([...nationalSample].reverse().map(x=>({
    attrs:{value:x.attrs.value,class:x.attrs.class},observation:x.observation,
    observedAt:x.observedAt,sourceId:x.sourceId,marketId:x.marketId
  }))), 'a reordered nationwide bounded source sample must not create 100 new work units');


  assert.equal(MAX_OBSERVATIONS_PER_MARKET_SWEEP,100);
  const rows=Array.from({length:1000},(_,i)=>({
    marketId:'il-chicago',sourceId:'chicago-tnp-open-data',
    sourceType:'government-trips',observedAt:new Date(1760000000000+i*1000).toISOString(),
    serviceClass:'standard',routedMiles:3,routedMinutes:12,travelerTotalCents:1800,
  }));
  let writes=0;
  const known=new Set();
  const db={collection:()=>({doc:id=>({create:async()=>{if(known.has(id)){const e=new Error('already exists');e.code=6;throw e;}known.add(id);writes++;}})})};
  const n=await persistObservations(db,rows);
  assert.equal(n,100,'each source write path must be bounded');
  assert.equal(writes,100,'no more than 100 Firestore document writes per source call');
  const repeated=await persistObservations(db,rows);
  assert.equal(repeated,0,'identical evidence must not be overwritten');
  assert.equal(writes,100,'repeated evidence must not consume additional successful writes');
  const failedDB={collection:()=>({doc:()=>({create:async()=>{throw new Error('quota exceeded');}})})};
  await assert.rejects(persistObservations(failedDB,rows),/quota exceeded/);
  console.log('PASS research-only Chicago disabled; candidate ingestion bounded and no-op skip');
})().catch(e=>{console.error(e);process.exitCode=1;});
