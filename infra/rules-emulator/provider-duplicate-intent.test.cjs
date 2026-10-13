'use strict';
// Genuine LOCAL Firestore emulator: collision-safe payment event idempotency.
// No production database, actual Stripe, people, money, or notifications.
const assert=require('node:assert/strict');
const path=require('node:path');
const {createRequire}=require('node:module');
const backendRequire=createRequire(path.join(__dirname,'../../backend/package.json'));
const {initializeApp,getApps}=backendRequire('firebase-admin/app');
const {getFirestore}=backendRequire('firebase-admin/firestore');
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('test requires local Firestore emulator');
if(!getApps().length)initializeApp({projectId:'demo-american-rider'});
const db=getFirestore();
const adminPath=backendRequire.resolve('./firebase-admin');
const previous=require.cache[adminPath];
require.cache[adminPath]={id:adminPath,filename:adminPath,loaded:true,exports:{
 adminDb:()=>db,adminStatus:()=>({ok:true}),
}};
const queue=backendRequire('./providerqueue');
const created=[];
async function deliver(event){
 created.push(queue.eventDocId('stripe',event.id));
 return queue.enqueueProviderEvent({provider:'stripe',event});
}
(async()=>{
 for(let pass=1;pass<=2;pass++){
  const prefix='evt_emulator_'+pass+'_';
  const base={id:prefix+'paid',type:'payment_intent.succeeded',
   data:{object:{id:prefix+'intent',currency:'usd',amount_received:1900}}};
  const first=await deliver(base);
  assert.equal(first.ok,true);assert.equal(first.duplicate,false);
  const reordered={data:{object:{amount_received:1900,currency:'usd',id:prefix+'intent'}},
   type:'payment_intent.succeeded',id:prefix+'paid'};
  let replay=await deliver(reordered);
  assert.equal(replay.ok,true);assert.equal(replay.duplicate,true);
  const changed={...base,data:{object:{...base.data.object,amount_received:9999}}};
  const rejected=await deliver(changed);
  assert.equal(rejected.ok,false);
  assert.match(rejected.reason,/conflicting/);
  const snapshot=await db.collection('provider_events').doc(first.id).get();
  assert.equal(snapshot.data().event.data.object.amount_received,1900);
  assert.equal(snapshot.data().eventHash.length,64);

  const originalId=prefix+'slash/id';
  assert.equal((await deliver({id:originalId,type:'refund.failed'})).ok,true);
  replay=await deliver({id:prefix+'slash_id',type:'refund.failed'});
  assert.equal(replay.ok,false,'two distinct provider IDs sanitize to one Firestore ID');

  const long=prefix+'z'.repeat(230);
  assert.equal((await deliver({id:long,type:'refund.updated'})).ok,true);
  assert.equal((await deliver({id:long+'changed',type:'refund.updated'})).ok,false,
   'two IDs differing beyond 220-char truncate must not be conflated');

  for(let i=0;i<60;i++){
   const evt={id:prefix+'batch_'+i,type:'charge.dispute.created',
    data:{object:{id:prefix+'dispute_'+i,amount:500+i}}};
   const firstResult=await deliver(evt);
   assert.equal(firstResult.ok,true);
   const secondResult=await deliver({...evt,data:{object:{amount:500+i,id:prefix+'dispute_'+i}}});
   assert.equal(secondResult.ok,true);
   assert.equal(secondResult.duplicate,true);
  }
  console.log('PASS REAL Firestore emulator provider duplicate-intent check pass '+pass+
   ': immutable payment and dispute, 60 duplicate events, semantic collision rejection');
 }
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
 for(const id of new Set(created))await db.collection('provider_events').doc(id).delete().catch(()=>{});
 if(previous)require.cache[adminPath]=previous;else delete require.cache[adminPath];
 await db.terminate();
});
