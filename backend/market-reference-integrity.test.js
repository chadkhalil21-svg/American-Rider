'use strict';
const assert=require('node:assert/strict');
const {runMarketReferenceSweep,recomputeMarket}=require('./market-reference-service');
const DAY=86400000,now=Date.parse('2026-10-12T00:00:00Z');
function mockDB(){
 const items=new Map(),writes=[];
 function getRef(name,id){const key=name+'|'+id;return {
  async get(){return {exists:items.has(key),data:()=>items.get(key)};},
  async set(data,{merge}={}){items.set(key,merge?{...items.get(key),...data}:data);writes.push({name,id});},
  async create(data){if(items.has(key)){const e=new Error('already exists');e.code=6;throw e;}
    items.set(key,data);writes.push({name,id});},
 };}
 return {items,writes,collection(name){return {
  doc(id){return getRef(name,id);},
  where(){return {where(){return {limit(){return {async get(){
    return {size:0,forEach(){}};
  }}}}}};},
 };}};
}
(async()=>{
 const db=mockDB(),snap={promotion:{status:'promoted'},asOf:'2026-10-01'};
 db.items.set('market_reference_snapshots|il-chicago',snap);
 let calls=0;
 const collectors={'chicago-tnp-open-data':async()=>{calls++;return [];}};
 const sweep=(time,store=db,source=collectors)=>runMarketReferenceSweep({
  testDb:store,now:time,enabledMarketIds:['il-chicago'],collectors:source});
 await sweep(now);
 assert.equal(calls,1);assert.equal(db.writes.length,1);
 assert.equal(db.writes[0].name,'market_reference_state');
 for(let d=1;d<7;d++)await sweep(now+d*DAY);
 assert.equal(calls,1,'unchanged monthly data must not trigger daily upstream fetch');
 assert.equal(db.writes.length,1,'skipped intervals must not write state');
 await sweep(now+7*DAY);assert.equal(calls,2);assert.equal(db.writes.length,2);
 assert.deepEqual(db.items.get('market_reference_snapshots|il-chicago'),snap);
 for(let d=8;d<21;d++)await sweep(now+d*DAY);
 assert.equal(calls,3,'release-aware Chicago checks only on days 0,7,14');
 await sweep(now+21*DAY);assert.equal(calls,4);
 const poison=mockDB();
 const bad={marketId:'fl-miami-dade',sourceId:'chicago-tnp-open-data',sourceType:'government-trips',
   observedAt:'2026-10-11T12:00:00Z',serviceClass:'standard',
   routedMiles:6,routedMinutes:16,travelerTotalCents:2450};
 const rejected=await sweep(now,poison,{'chicago-tnp-open-data':async()=>[bad]});
 assert.equal(rejected.markets['il-chicago'].collectors[0].ok,false);
 assert.match(rejected.markets['il-chicago'].collectors[0].reason,/mismatch/);
 assert.equal(poison.writes.length,0,'cross-market data may never be persisted');
 const badType={...bad,marketId:'il-chicago',sourceType:'licensed-market-data'};
 const rejectedType=await sweep(now,poison,{'chicago-tnp-open-data':async()=>[badType]});
 assert.equal(rejectedType.markets['il-chicago'].collectors[0].ok,false);
 assert.equal(poison.writes.length,0);
 const future={...bad,marketId:'il-chicago',observedAt:'2099-01-01T00:00:00Z'};
 const rejectedFuture=await sweep(now,poison,{'chicago-tnp-open-data':async()=>[future]});
 assert.equal(rejectedFuture.markets['il-chicago'].collectors[0].ok,false);
 assert.equal(poison.writes.length,0);
 const research=await recomputeMarket(db,'il-chicago',{now});
 assert.equal(research.promotion.status,'candidate');
 assert.deepEqual(db.items.get('market_reference_snapshots|il-chicago'),snap,
   'new research cannot destroy an existing promoted live reference');
 assert.equal(db.items.get('market_reference_candidates|il-chicago').promotion.status,'candidate');
 const failure=mockDB(),originalCollection=failure.collection;
 failure.collection=function(name){const c=originalCollection.call(this,name);if(name==='market_reference_observations')
   return {...c,doc(){return {async create(){throw Error('quota exceeded');}}}};
   return c;};
 const good={...bad,marketId:'il-chicago'};
 let count=0;
 const failed=await sweep(now,failure,{'chicago-tnp-open-data':async()=>{count++;return[good];}});
 assert.equal(failed.markets['il-chicago'].collectors[0].ok,false);
 assert.equal(failure.writes.length,0,'failed import must not advance next-check time');
 const recovered=await sweep(now+DAY,poison,{'chicago-tnp-open-data':async()=>[good]});
 assert.equal(recovered.markets['il-chicago'].collectors[0].ok,true);
 assert.ok(poison.writes.some(w=>w.name==='market_reference_observations'));
 console.log('PASS Chicago 22-day retry budget, candidate isolation, source/multiple-region pollution and failed-import recovery');
})().catch(e=>{console.error(e);process.exitCode=1;});
