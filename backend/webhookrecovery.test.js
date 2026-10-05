const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = __dirname;
const state = { r1: { travelerUid:'u1', costCents:2720, status:'awaiting_payment', tripNo:'AR-1' } };
const doc = (id) => ({ id, get:async()=>({exists:!!state[id], data:()=>({...state[id]})}),
  update:async(fields)=>{ state[id]={...state[id],...fields}; } });
const db={collection:(name)=>({doc:(id)=>name==='rides'?doc(id):doc('absent')}),
  runTransaction:(fn)=>fn({get:(r)=>r.get(),update:(r,f)=>r.update(f)})};
const p=require.resolve(path.join(ROOT,'firebase-admin.js'));
require.cache[p]={id:p,filename:p,loaded:true,exports:{adminDb:()=>db,adminStatus:()=>({ok:true})},children:[],paths:[]};
const {handleEvent}=require('./webhook');
const event=(uid='u1',cents=2720,id='pi_valid',rideId='r1')=>({type:'payment_intent.succeeded',data:{object:{
  id,status:'succeeded',currency:'usd',amount_received:cents,metadata:{uid,rideId},
}}});
(async()=>{
  let out=await handleEvent(event('other'));
  assert.equal(out.ok,false);assert.equal(state.r1.paymentIntentId,undefined);
  out=await handleEvent(event('u1',999));
  assert.equal(out.ok,false);assert.equal(state.r1.paymentIntentId,undefined);
  out=await handleEvent(event('u1',2720,'pi_valid','not_found'));
  assert.equal(out.ok,false);
  out=await handleEvent(event());
  assert.equal(out.ok,true);assert.equal(state.r1.paymentIntentId,'pi_valid');assert(state.r1.paidAt);
  out=await handleEvent(event());assert.equal(out.ok,true);
  state.r1.status='cancelled';state.r1.refundPending=false;
  out=await handleEvent(event());assert.equal(out.ok,true);assert.equal(state.r1.refundPending,true);
  console.log('PASS Stripe success binds to a prepared owner/amount-matched ride and restores cancelled refund obligations');
})().catch((e)=>{console.error(e);process.exitCode=1;});
