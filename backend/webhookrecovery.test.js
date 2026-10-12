const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = __dirname;
const state = { r1: { travelerUid:'u1', costCents:2720, status:'awaiting_payment', tripNo:'AR-1' } };
const cases=new Map();
const doc = (id) => ({ id, get:async()=>({exists:!!state[id], data:()=>({...state[id]})}),
  update:async(fields)=>{ state[id]={...state[id],...fields}; } });
const db={collection:(name)=>({doc:(id)=>name==='rides'?doc(id):doc('absent')}),
  runTransaction:(fn)=>fn({get:(r)=>r.get(),update:(r,f)=>r.update(f)})};
const firebase=require.resolve(path.join(ROOT,'firebase-admin.js'));
require.cache[firebase]={id:firebase,filename:firebase,loaded:true,exports:{adminDb:()=>db,adminStatus:()=>({ok:true})},children:[],paths:[]};
// A missing/foreign paid Travel is now an actionable exception, not a
// retried dead letter. Stub actual support sending so CI never mails anyone.
const tickets=require.resolve(path.join(ROOT,'tickets.js'));
require.cache[tickets]={id:tickets,filename:tickets,loaded:true,
  exports:{fileTicket:async(args)=>{
    if(!cases.has(args.idempotencyKey))
      cases.set(args.idempotencyKey,{caseNo:'AR-TEST-'+(cases.size+1),...args});
    return {ok:true,stored:true,emailed:true,caseNo:cases.get(args.idempotencyKey).caseNo};
  }},children:[],paths:[]};
const {handleEvent}=require('./webhook');
const event=(uid='u1',cents=2720,id='pi_valid',rideId='r1')=>({type:'payment_intent.succeeded',data:{object:{
  id,status:'succeeded',currency:'usd',amount_received:cents,metadata:{uid,rideId},
}}});
(async()=>{
  for(let pass=0;pass<2;pass++){
    state.r1={travelerUid:'u1',costCents:2720,status:'awaiting_payment',tripNo:'AR-1'};
    cases.clear();
    let out=await handleEvent(event('other',2720,'pi_wrong_owner'));
    assert.equal(out.ok,true);assert.equal(out.action,'successful payment flagged for reconciliation');
    assert.equal(state.r1.paymentIntentId,undefined);
    out=await handleEvent(event('u1',999,'pi_wrong_amount'));
    assert.equal(out.ok,true);assert.equal(state.r1.paymentIntentId,undefined);
    out=await handleEvent(event('u1',2720,'pi_missing_ride','not_found'));
    assert.equal(out.ok,true);assert.equal(state.r1.paymentIntentId,undefined);
    assert.equal(cases.size,3,'each unmatched PI needs a durable case');
    const repeated=await handleEvent(event('other',2720,'pi_wrong_owner'));
    assert.equal(repeated.ok,true);assert.equal(cases.size,3,'repeated PI has one case');
    out=await handleEvent(event());
    assert.equal(out.ok,true);assert.equal(state.r1.paymentIntentId,'pi_valid');assert(state.r1.paidAt);
    out=await handleEvent(event());assert.equal(out.ok,true);
    state.r1.status='cancelled';state.r1.refundPending=false;
    out=await handleEvent(event());assert.equal(out.ok,true);assert.equal(state.r1.refundPending,true);
    assert.equal(cases.size,3,'valid and cancelled Travels do not manufacture cases');
  }
  console.log('PASS TWICE: Stripe paid owner/amount/Travel checks, unmatched support recovery, idempotent cases, and cancelled refund obligation; no provider calls');
})().catch((e)=>{console.error(e);process.exitCode=1;});
