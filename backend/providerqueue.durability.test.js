const assert=require('node:assert/strict');
const Module=require('node:module');

function memoryDb(seed={}){
  const data=JSON.parse(JSON.stringify(seed));
  const ref=(c,id)=>({
    id,
    async get(){return {exists:!!data[c]?.[id],data:()=>data[c]?.[id]};},
    async create(v){data[c]=data[c]||{};if(data[c][id]){const e=new Error('exists');e.code=6;throw e;}data[c][id]={...v};},
    async set(v,o){data[c]=data[c]||{};data[c][id]=o?.merge?{...(data[c][id]||{}),...v}:{...v};},
  });
  const db={
    data,
    collection(c){return {doc:id=>ref(c,id),where(){return {limit(){return {async get(){return {docs:Object.entries(data[c]||{}).map(([id,x])=>({id,data:()=>x}))};}};}};}};},
    async runTransaction(fn){return fn({get:r=>r.get(),set:(r,v,o)=>r.set(v,o)});}
  };
  return db;
}

const db=memoryDb();
const original=Module._load;
Module._load=function(request,parent,isMain){
  if(request==='./firebase-admin' && parent?.filename?.endsWith('/providerqueue.js')) return {adminDb:()=>db,adminStatus:()=>({ok:true})};
  return original.apply(this,arguments);
};
delete require.cache[require.resolve('./providerqueue')];
const q=require('./providerqueue');
Module._load=original;

(async()=>{
  const event={id:'evt_1',type:'x'};
  let out=await q.enqueueProviderEvent({provider:'stripe',event});
  assert.equal(out.ok,true);assert.equal(out.duplicate,false);
  out=await q.enqueueProviderEvent({provider:'stripe',event});
  assert.equal(out.ok,true);assert.equal(out.duplicate,true,'provider retry must not create a second durable event');

  // Amazon idempotency contract: same provider event id must mean same event.
  out=await q.enqueueProviderEvent({provider:'stripe',event:{id:'evt_1',type:'different'}});
  assert.equal(out.ok,false,'same ID with changed event type cannot be ACKed');
  assert.match(out.reason,/conflicting/);
  assert.equal(db.data.provider_events[q.eventDocId('stripe','evt_1')].event.type,'x',
    'existing durable event never overwritten by conflict');

  const originalEvent={id:'evt_immutable',type:'payment_intent.succeeded',
    data:{object:{id:'pi_original',amount_received:1900,currency:'usd'}}};
  out=await q.enqueueProviderEvent({provider:'stripe',event:originalEvent});
  assert.equal(out.ok,true);
  const reordered={data:{object:{currency:'usd',amount_received:1900,id:'pi_original'}},
    type:'payment_intent.succeeded',id:'evt_immutable'};
  out=await q.enqueueProviderEvent({provider:'stripe',event:reordered});
  assert.equal(out.ok,true,'reordering JSON fields preserves semantic equality');
  assert.equal(out.duplicate,true);
  out=await q.enqueueProviderEvent({provider:'stripe',event:{
    ...originalEvent,data:{object:{...originalEvent.data.object,amount_received:2900}},
  }});
  assert.equal(out.ok,false,'same ID with changed monetary amount must fail closed');

  const sanitized={id:'evt/a',type:'refund.failed'};
  assert.equal((await q.enqueueProviderEvent({provider:'stripe',event:sanitized})).ok,true);
  out=await q.enqueueProviderEvent({provider:'stripe',event:{id:'evt_a',type:'refund.failed'}});
  assert.equal(out.ok,false,'different provider IDs must not collide after replacing / with _');
  assert.equal((await q.enqueueProviderEvent({provider:'stripe',event:sanitized})).duplicate,true);
  const longId='evt_'+'x'.repeat(240);
  assert.equal((await q.enqueueProviderEvent({provider:'stripe',event:{id:longId,type:'safe'}})).ok,true);
  out=await q.enqueueProviderEvent({provider:'stripe',event:{id:longId+'-different',type:'safe'}});
  assert.equal(out.ok,false,'IDs identical before Firestore 220-char truncation cannot be conflated');
  assert.equal((await q.enqueueProviderEvent({provider:'stripe',event:{
    id:'evt_'+'x'.repeat(1300),type:'too-long',
  }})).ok,false,'unbounded provider IDs must not be accepted');


  const id=q.eventDocId('stripe','evt_1');
  let calls=0;
  out=await q.processProviderEvent({id,workerId:'w1',handlers:{stripe:async()=>{calls++;throw new Error('temporary');}}});
  assert.equal(out.ok,false);
  assert.equal(db.data.provider_events[id].status,'pending');
  assert.equal(db.data.provider_events[id].attempts,1);
  assert.ok(db.data.provider_events[id].nextAttemptAt>Date.now(),'failed handler must back off');

  db.data.provider_events[id].nextAttemptAt=0;
  db.data.provider_events[id].status='processing';
  db.data.provider_events[id].leaseUntil=Date.now()-1;
  out=await q.processProviderEvent({id,workerId:'w2',handlers:{stripe:async()=>{calls++;return {ok:true,action:'recovered'};}}});
  assert.equal(out.ok,true,'expired lease must be reclaimable after a process crash');
  assert.equal(db.data.provider_events[id].status,'done');
  assert.equal(db.data.provider_events[id].attempts,2);
  assert.equal(calls,2);

  out=await q.processProviderEvent({id,workerId:'w3',handlers:{stripe:async()=>{calls++;return {ok:true};}}});
  assert.equal(out.skipped,true,'completed event must never be processed twice');
  assert.equal(calls,2);

  console.log('all provider queue durability tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
