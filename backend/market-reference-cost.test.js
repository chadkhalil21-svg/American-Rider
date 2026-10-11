'use strict';
const assert=require('node:assert/strict');
const {runMarketReferenceSweep,persistObservations,MAX_OBSERVATIONS_PER_MARKET_SWEEP,eligibleEvidenceMarkets}=require('./market-reference-service');
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
  assert.equal(MAX_OBSERVATIONS_PER_MARKET_SWEEP,100);
  const rows=Array.from({length:1000},(_,i)=>({
    marketId:'il-chicago',sourceId:'chicago-tnp-open-data',
    sourceType:'government-trips',observedAt:new Date(1760000000000+i*1000).toISOString(),
    serviceClass:'standard',routedMiles:3,routedMinutes:12,travelerTotalCents:1800,
  }));
  let writes=0;
  const db={collection:()=>({doc:()=>({set:async()=>{writes++;}})})};
  const n=await persistObservations(db,rows);
  assert.equal(n,100,'each source write path must be bounded');
  assert.equal(writes,100,'no more than 100 Firestore document writes per source call');
  console.log('PASS research-only Chicago disabled; candidate ingestion bounded and no-op skip');
})().catch(e=>{console.error(e);process.exitCode=1;});
