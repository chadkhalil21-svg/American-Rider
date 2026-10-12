'use strict';
// No network, no Stripe, no actual Firestore. Exact durability and collector
// cadence tests covering Chicago's historical quota incident.
const assert=require('node:assert/strict');
const {
  runMarketReferenceSweep,recomputeMarket,SOURCE_MIN_RECHECK_MS,
  DEFAULT_SOURCE_RECHECK_MS,
}=require('./market-reference-service');
const DAY=24*60*60*1000;
function stateDb(){
  const state=new Map(),writes=[],obs=[];
  return {
    state,writes,obs,
    collection(name){
      return {
        doc(id){
          return {
            async get(){return {exists:state.has(name+'|'+id),data:()=>state.get(name+'|'+id)};},
            async set(data,{merge}={}){
              state.set(name+'|'+id,merge?{...state.get(name+'|'+id),...data}:data);
              writes.push({name,id,data});
            },
            async create(data){obs.push({name,id,data});},
          };
        },
        where(){return {where(){return {limit(){return {async get(){
          return {size:0,forEach(){}};
        }}}}}};},
      };
    },
  };
}
(async()=>{
  assert.equal(SOURCE_MIN_RECHECK_MS['chicago-tnp-open-data'],7*DAY);
  assert.equal(DEFAULT_SOURCE_RECHECK_MS,DAY);
  const db=stateDb();let fetches=0;
  const start=Date.parse('2026-10-10T00:00:00Z');
  const collectors={'chicago-tnp-open-data':async()=>{fetches++;return [];}};
  const sweep=now=>runMarketReferenceSweep({
    testDb:db,collectors,enabledMarketIds:['il-chicago'],now,
  });
  const first=await sweep(start);
  assert.equal(first.ok,true);
  assert.equal(fetches,1);
  assert.equal(db.writes.length,1,'one durable next-check stamp for unchanged Chicago feed');
  assert.equal(db.writes[0].name,'market_reference_state');
  assert.equal(db.obs.length,0);
  await sweep(start+2*60*60*1000);
  assert.equal(fetches,1,'no hourly re-fetch');
  await sweep(start+DAY);
  assert.equal(fetches,1,'no daily re-fetch of monthly city data');
  assert.equal(db.writes.length,1,'not even a checkpoint write if not due');
  await sweep(start+7*DAY-1000);
  assert.equal(fetches,1);
  await sweep(start+7*DAY);
  assert.equal(fetches,2,'one recheck after seven days');
  assert.equal(db.writes.length,2,'durable scheduled source check');
  await sweep(start+8*DAY);
  assert.equal(fetches,2,'one-week source interval resumes after check');

  // Cross-market data from a misconfigured national supplier must never
  // create a real document in the wrong collection/market.
  const poison=stateDb();let poisonCalls=0;
  const badSource=await runMarketReferenceSweep({
    testDb:poison,now:start,enabledMarketIds:['il-chicago'],
    collectors:{'chicago-tnp-open-data':async()=>{poisonCalls++;return [{
      marketId:'fl-miami-dade',sourceId:'chicago-tnp-open-data',
      sourceType:'government-trips',observedAt:'2026-10-09T00:00:00Z',
      serviceClass:'standard',routedMiles:4,routedMinutes:12,travelerTotalCents:1800,
    }];}},
  });
  assert.equal(poisonCalls,1);
  assert.equal(poison.obs.length,0,'reject entire poisoned batch before writes');
  assert.match(badSource.markets['il-chicago'].collectors[0].reason,/mismatch/);

  const wrongType=await runMarketReferenceSweep({
    testDb:poison,now:start+7*DAY,enabledMarketIds:['il-chicago'],
    collectors:{'chicago-tnp-open-data':async()=>[{
      marketId:'il-chicago',sourceId:'chicago-tnp-open-data',
      sourceType:'licensed-market-data',observedAt:'2026-10-09T00:00:00Z',
      serviceClass:'standard',routedMiles:4,routedMinutes:12,travelerTotalCents:1800,
    }]},
  });
  assert.equal(poison.obs.length,0);
  assert.match(wrongType.markets['il-chicago'].collectors[0].reason,/mismatch/);

  // Release of a new candidate may never overwrite a previous promoted
  // live snapshot even if the sample/data are empty or suspect.
  const candidateDb=stateDb();
  const old={marketId:'il-chicago',promotion:{status:'promoted'},asOf:'2026-10-01T00:00:00Z',cells:{x:{}}};
  candidateDb.state.set('market_reference_snapshots|il-chicago',old);
  const result=await recomputeMarket(candidateDb,'il-chicago',{now:start});
  assert.equal(result.promotion.status,'candidate');
  assert.deepEqual(candidateDb.state.get('market_reference_snapshots|il-chicago'),old);
  assert.equal(candidateDb.state.get('market_reference_candidates|il-chicago')?.promotion.status,'candidate');
  assert.equal(candidateDb.writes.some(w=>w.name==='market_reference_snapshots'),false);
  console.log('PASS twice: persistent Chicago source cadence, poisoned-source isolation, no market activation, research candidate cannot overwrite live reference');
  // Rerun full core invariants on independent fresh synthetic DB.
  const again=stateDb();let calls=0;
  for(const day of [0,1,2,3,4,5,6,7,8,14,15,21]){
    await runMarketReferenceSweep({
      testDb:again,now:start+day*DAY,enabledMarketIds:['il-chicago'],
      collectors:{'chicago-tnp-open-data':async()=>{calls++;return [];}},
    });
  }
  assert.equal(calls,4,'22 days of daily sweeps => only 4 eligible Chicago collection attempts');
  assert.equal(again.writes.length,4,'only four durable source-check stamps');
  console.log('PASS: 22-day replay of Chicago activation; 4 fetches, 4 state writes, zero evidence documents');
})().catch(e=>{console.error(e);process.exitCode=1;});
