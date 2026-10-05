const assert=require('node:assert/strict');
const path=require('node:path');
const rows=new Map();
const clone=(v)=>structuredClone(v);
const ref=(collection,id)=>({id,path:`${collection}/${id}`,data:()=>clone(rows.get(`${collection}/${id}`)),get:async()=>({exists:rows.has(`${collection}/${id}`),data:()=>clone(rows.get(`${collection}/${id}`))}),
  async create(v){assert(!rows.has(this.path));rows.set(this.path,clone(v));},
  async set(v,opts){rows.set(this.path,opts?.merge?{...rows.get(this.path),...clone(v)}:clone(v));}});
let auto=0;
const db={collection(name){return {doc:(id)=>ref(name,id||`auto-${++auto}`),where(field,operator,val){
 const filters=[[field,operator,val]];let sort=null,max=Infinity;
 const query={where(f,o,v){filters.push([f,o,v]);return query;},orderBy(f,dir='asc'){sort=[f,dir];return query;},limit(n){max=n;return query;},async get(){
  let docs=[...rows].filter(([key,v])=>key.startsWith(name+'/')&&filters.every(([f,o,x])=>{
   const value=v[f];return o==='=='?value===x:o==='<='?value<=x:false;
  })).map(([key])=>ref(name,key.slice(name.length+1)));
  if(sort)docs.sort((a,b)=>{const aVal=rows.get(a.path)[sort[0]],bVal=rows.get(b.path)[sort[0]];
   return (aVal>bVal?1:aVal<bVal?-1:0)*(sort[1]==='desc'?-1:1);
  });return {docs:docs.slice(0,max)};
 }};return query;
}};},runTransaction:async(fn)=>{
 const pending=[];const tx={get:(r)=>r.get(),set:(r,v,o)=>pending.push(()=>r.set(v,o)),create:(r,v)=>pending.push(()=>r.create(v))};
 const result=await fn(tx);for(const operation of pending)await operation();return result;
}};
const p=require.resolve(path.join(__dirname,'firebase-admin.js'));
require.cache[p]={id:p,filename:p,loaded:true,exports:{adminDb:()=>db,adminStatus:()=>({reason:'unavailable'})},children:[],paths:[]};
const {sweepProviderEvents,processProviderEvent,replayDeadEvent,MAX_ATTEMPTS}=require('./providerqueue');
(async()=>{
 const now=Date.now();
 for(let i=0;i<80;i++)rows.set(`provider_events/future${i}`,{provider:'stripe',event:{id:`f${i}`},status:'pending',attempts:0,nextAttemptAt:now+60_000,leaseUntil:0});
 rows.set('provider_events/due',{provider:'stripe',event:{id:'due'},status:'pending',attempts:0,nextAttemptAt:0,leaseUntil:0});
 rows.set('provider_events/expired',{provider:'stripe',event:{id:'expired'},status:'processing',attempts:1,nextAttemptAt:now-100,leaseUntil:now-100});
 rows.set('provider_events/inflight',{provider:'stripe',event:{id:'inflight'},status:'processing',attempts:1,nextAttemptAt:now-100,leaseUntil:now+60_000});
 const seen=[];
 const sweep=await sweepProviderEvents({handlers:{stripe:async(e)=>{seen.push(e.id);return {ok:true};}},workerId:'test'});
 assert.deepEqual(seen.sort(),['due','expired']);assert.equal(sweep.processed,2);
 assert.equal(rows.get('provider_events/inflight').status,'processing');
 rows.set('provider_events/poison',{provider:'stripe',event:{id:'poison'},status:'pending',attempts:MAX_ATTEMPTS-1,nextAttemptAt:0,leaseUntil:0});
 const poisoned=await processProviderEvent({id:'poison',handlers:{stripe:async()=>({ok:false,reason:'provider outage'})},workerId:'test'});
 assert.equal(poisoned.dead,true);assert.equal(rows.get('provider_events/poison').status,'dead');
 const replayed=await replayDeadEvent({id:'poison',actor:'named-ops'});
 assert.equal(replayed.ok,true);assert.equal(rows.get('provider_events/poison').status,'pending');
 assert.equal([...rows].filter(([key])=>key.startsWith('audit_log/')).length,1);
 assert.equal((await processProviderEvent({id:'poison',handlers:{stripe:async()=>({ok:true})},workerId:'test'})).ok,true);
 assert.equal(rows.get('provider_events/poison').status,'done');
 for(let i=0;i<330;i++)rows.set(`provider_events/backlog${i}`,{
  provider:'stripe',event:{id:`backlog${i}`},status:'pending',attempts:0,
  receivedAt:now-120_000,nextAttemptAt:0,leaseUntil:0,
 });
 const backlog=[];
 const drained=await sweepProviderEvents({handlers:{stripe:async(e)=>{backlog.push(e.id);return {ok:true};}},workerId:'bulk-test'});
 assert.equal(drained.processed,330,'an indexed multi-page tick drains more than the old 40-event ceiling');
 assert.ok(drained.duePages>=2);assert.ok(drained.oldestDueAgeMs>=120_000);
 rows.set('provider_events/leaseRace',{provider:'stripe',event:{id:'leaseRace'},status:'pending',attempts:0,nextAttemptAt:0,leaseUntil:0});
 let releaseOld,oldStarted;
 const started=new Promise((resolve)=>{oldStarted=resolve;});
 const old=processProviderEvent({id:'leaseRace',handlers:{stripe:async()=>{
  oldStarted();await new Promise((resolve)=>{releaseOld=resolve;});return {ok:true,owner:'old'};
 }},workerId:'old'});
 await started;
 rows.get('provider_events/leaseRace').leaseUntil=Date.now()-1;
 rows.get('provider_events/leaseRace').nextAttemptAt=Date.now()-1;
 assert.equal((await processProviderEvent({id:'leaseRace',handlers:{stripe:async()=>({ok:true,owner:'new'})},workerId:'new'})).ok,true);
 releaseOld();assert.equal((await old).superseded,true);
 assert.equal(rows.get('provider_events/leaseRace').result.owner,'new',
  'an expired old worker cannot overwrite a newer claim');
 console.log('PASS due queue avoids 80 future events, recovers expired lease, dead-letters poison and audits named replay');
})().catch(e=>{console.error(e);process.exitCode=1;});
