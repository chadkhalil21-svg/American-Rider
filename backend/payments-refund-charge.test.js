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

  // Exact founder-approved Florida prelaunch 10mi/25min example:
  // $1.00 + $0.95*10mi + $0.32*25min = $18.50 Travel Fare;
  // $2.50 minimum Platform Fee gives a $21.00 Traveler Total. Synthetic only.
  // Test full refunds, retained $3.00 arrival fee, wrong ownership and
  // replay, with one realistic PaymentIntent/Charge balance.
  for(let pass=0;pass<2;pass++){
    const id='pi_florida_21_synthetic_'+pass,uid='fl_traveler';
    const intent={id,status:'succeeded',amount:2100,amount_received:2100,
      metadata:{uid},latest_charge:{id:'ch_fl_'+pass,payment_intent:id,amount_refunded:0}};
    intents.set(id,intent);
    assert.equal((await refundableFor({paymentIntentId:id,expectUid:uid})).cents,2100);
    assert.equal((await refundableFor({paymentIntentId:id,expectUid:'other_user'})).cents,0);
    assert.equal((await refundTravel({paymentIntentId:id,amountCents:2101,expectUid:uid})).ok,false,
      'cannot refund more than the $21 collected');
    const sentBefore=sent.length;
    const whole=await refundTravel({paymentIntentId:id,amountCents:2100,
      expectUid:uid,idempotencyKey:'full_refund_'+pass});
    assert.equal(whole.ok,true);
    assert.equal(sent.length,sentBefore+1,'only one real-size synthetic full refund');
    assert.equal((await refundableFor({paymentIntentId:id,expectUid:uid})).cents,0);
    assert.equal((await refundTravel({paymentIntentId:id,amountCents:100,expectUid:uid})).ok,false,
      'no second unauthorized amount may be refunded');
    // Independent scenario: cancellation after arrival retains the $3 fee,
    // refunding the remaining $18 of the original $21 payment.
    const arrivalId='pi_fl_arrival_'+pass;
    intents.set(arrivalId,{id:arrivalId,status:'succeeded',amount:2100,amount_received:2100,
      metadata:{uid},latest_charge:{id:'ch_arrival_'+pass,payment_intent:arrivalId,amount_refunded:0}});
    const arrival=await refundTravel({paymentIntentId:arrivalId,amountCents:1800,
      expectUid:uid,idempotencyKey:'arrival_refund_'+pass});
    assert.equal(arrival.ok,true);
    assert.equal((await refundableFor({paymentIntentId:arrivalId,expectUid:uid})).cents,300);
  }
  for(const v of [NaN,-1,1001,undefined,null,'400']){
    const pi=structuredClone(intents.get(paymentId));pi.latest_charge.amount_refunded=v;
    assert.equal(balance(pi).ok,false,'invalid refund history fails closed');
  }
  console.log('PASS TWICE: Stripe Charge refund tracking, partial/duplicate/oversized/wrong-owner/failed-provider/missing-history protections; zero external calls');
})().catch(e=>{console.error(e);process.exitCode=1});
