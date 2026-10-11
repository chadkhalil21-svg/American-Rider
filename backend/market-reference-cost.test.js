'use strict';
const assert=require('node:assert/strict');
const {runMarketReferenceSweep,persistObservations,MAX_OBSERVATIONS_PER_MARKET_SWEEP}=require('./market-reference-service');
(async()=>{
  let collectorCalled=false;
  const noop=await runMarketReferenceSweep({
    collectors:{'chicago-tnp-open-data':async()=>{collectorCalled=true;return[];}},
    now:Date.parse('2026-10-10T12:00:00Z'),
    enabledMarketIds:['fl-miami-dade','fl-broward','fl-palm-beach'],
  });
  // Without Admin DB, Florida configured market sweeps cannot run. Critical:
  // Chicago still cannot be chosen just because its public research plan exists.
  assert.equal(collectorCalled,false,'uncommissioned Chicago must not fetch external data');
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
