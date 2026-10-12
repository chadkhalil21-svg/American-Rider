'use strict';
// Offline Stripe contract test. ALL calls are in-memory; no Stripe or real-money APIs.
const assert=require('node:assert/strict');
const Module=require('node:module');
const path=require('node:path');
const originalLoad=Module._load;
const intents=new Map();
const refunds=new Map();
const sent=[];
let failNext=false;
const paymentId='pi_ar_synthetic';
intents.set(paymentId,{
  id:paymentId,status:'succeeded',amount:1000,amount_received:1000,
  amount_refunded:0, // Deliberate bait: PaymentIntent does not own this field.
  metadata:{uid:'traveler_1',platformTake:'150'},
  latest_charge:{id:'ch_ar_synthetic',payment_intent:paymentId,amount_refunded:400},
});
const fakeStripe={
  paymentIntents:{async retrieve(id,opts){
    assert.deepEqual(opts,{expand:['latest_charge']});
    const item=intents.get(id);
    if(!item)throw Error('not found');
    return structuredClone(item);
  }},
  refunds:{async create(payload,options){
    if(failNext){failNext=false;throw Error('simulated network timeout')}
    const pi=intents.get(payload.payment_intent);
    const key=options?.idempotencyKey||null;
    if(key&&refunds.has(key))return structuredClone(refunds.get(key));
    const remaining=pi.amount_received-pi.latest_charge.amount_refunded;
    if(payload.amount>remaining)throw Error('over-refund refused by Stripe');
    const result={id:'re_ar_synthetic_'+(sent.length+1),status:'succeeded',
      amount:payload.amount};
    pi.latest_charge.amount_refunded+=payload.amount;
    sent.push({amount:payload.amount,key,metadata:payload.metadata});
    if(key)refunds.set(key,structuredClone(result));
    return result;
  }},
};
Module._load=function(request,parent,isMain){
  if(request==='stripe')return()=>fakeStripe;
  return originalLoad.apply(this,arguments);
};
process.env.STRIPE_SECRET_KEY='sk_test_only_an_offline_fixture';
let money;
try{money=require('./payments')}finally{Module._load=originalLoad}
const {refundableFor,refundTravel,__refundBalanceFromVerifiedIntent:balance}=money;
(async()=>{
  for(let pass=0;pass<2;pass++){
    const prior=intents.get(paymentId);
    prior.latest_charge.amount_refunded=400;
    prior.amount_refunded=0;
    sent.length=0;refunds.clear();
    assert.equal(balance(structuredClone(prior)).cents,600);
    assert.equal((await refundableFor({paymentIntentId:paymentId,expectUid:'traveler_1'})).cents,600);
    assert.equal((await refundableFor({paymentIntentId:paymentId,expectUid:'intruder'})).cents,0);
    assert.equal((await refundTravel({paymentIntentId:paymentId,amountCents:700,expectUid:'traveler_1'})).ok,false);
    const first=await refundTravel({paymentIntentId:paymentId,amountCents:200,
      expectUid:'traveler_1',idempotencyKey:'ar-synthetic-refund-1'});
    assert.equal(first.ok,true);assert.equal(first.outOfPocketCents,200);
    assert.equal(sent.length,1);
    const duplicate=await refundTravel({paymentIntentId:paymentId,amountCents:200,
      expectUid:'traveler_1',idempotencyKey:'ar-synthetic-refund-1'});
    assert.equal(duplicate.refundId,first.refundId);
    assert.equal(sent.length,1,'duplicate provider submission should not charge twice');
    assert.equal((await refundableFor({paymentIntentId:paymentId,expectUid:'traveler_1'})).cents,400);
    assert.equal((await refundTravel({paymentIntentId:paymentId,amountCents:401,
      expectUid:'traveler_1'})).ok,false);
    failNext=true;
    assert.equal((await refundTravel({paymentIntentId:paymentId,amountCents:100,
      expectUid:'traveler_1'})).ok,false);
    assert.equal(sent.length,1);
    prior.latest_charge={id:'ch_ar_synthetic',payment_intent:'pi_wrong',amount_refunded:400};
    assert.equal((await refundableFor({paymentIntentId:paymentId,expectUid:'traveler_1'})).cents,0);
    assert.equal((await refundTravel({paymentIntentId:paymentId,amountCents:100,
      expectUid:'traveler_1'})).ok,false);
    prior.latest_charge='ch_ar_synthetic';
    assert.equal((await refundableFor({paymentIntentId:paymentId,expectUid:'traveler_1'})).cents,0);
    prior.latest_charge={id:'ch_ar_synthetic',payment_intent:paymentId,amount_refunded:400};
  }
  for(const v of [NaN,-1,1001,undefined]){
    const pi=structuredClone(intents.get(paymentId));pi.latest_charge.amount_refunded=v;
    assert.equal(balance(pi).ok,false,'invalid refund history fails closed');
  }
  console.log('PASS TWICE: Stripe Charge refund tracking, partial/duplicate/oversized/wrong-owner/failed-provider/missing-history protections; zero external calls');
})().catch(e=>{console.error(e);process.exitCode=1});
