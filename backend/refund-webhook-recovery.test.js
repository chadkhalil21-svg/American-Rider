'use strict';
// Offline signed-webhook handler *logic* tests. Authentic signature/queue tests
// are separately in providerqueue tests; this script never calls Stripe.
const assert=require('node:assert/strict');
const Module=require('node:module');
const original=Module._load;
const tickets=new Map(),calls=[];
const rides=new Map();
let supportUnavailable=false;
const fakeDb={
  collection(name){
    assert.equal(name,'rides');
    return {
      where(field,op,value){
        assert.equal(field,'paymentIntentId');assert.equal(op,'==');
        return {limit(n){return {async get(){
          const rows=[...rides].filter(([id,r])=>r.paymentIntentId===value).slice(0,n);
          return {docs:rows.map(([id,r])=>({id,data:()=>structuredClone(r)}))};
        }}}};
      },
      doc(id){return {async set(fields,{merge}={}){
        assert.equal(merge,true);
        if(!rides.has(id))throw Error('cannot create a missing Travel');
        rides.set(id,{...rides.get(id),...fields});
      }}},
    };
  },
};
const fakes={
  './firebase-admin':{adminDb:()=>fakeDb,adminStatus:()=>({ok:true})},
  './tickets':{async fileTicket(args){
    if(supportUnavailable)throw Error('synthetic support provider outage');
    calls.push(args);
    const key=args.idempotencyKey;
    if(!tickets.has(key))tickets.set(key,{...args,caseNo:'AR-SYN-'+(tickets.size+1)});
    return {ok:true,stored:true,emailed:true,caseNo:tickets.get(key).caseNo};
  }},
  './env':{readKey:()=>''},
  './email':{money:n=>'$'+(Number(n||0)/100).toFixed(2)},
  './operatorfees':{recordPayoutActivity:async()=>({ok:true})},
  './disputeevidence':{saveDisputeEvidence:async()=>({ref:'fixture'})},
};
Module._load=function(req,parent,isMain){
  if(Object.prototype.hasOwnProperty.call(fakes,req))return fakes[req];
  return original.apply(this,arguments);
};
let service;try{service=require('./webhook')}finally{Module._load=original}
const ev=(id,type,status,pi='pi_ar_refund_fixture')=>({
  id,created:1791800000,type,
  data:{object:{id:'re_case_fixture',payment_intent:pi,amount:1750,
    status,failure_reason:'refund_account_closed'}},
});
async function test(){
  for(let pass=0;pass<2;pass++){
    tickets.clear();calls.length=0;rides.clear();supportUnavailable=false;
    rides.set('ride-123',{paymentIntentId:'pi_ar_refund_fixture',tripNo:'AR-FIXTURE-123',
      travelerUid:'traveler',travelerEmail:'fixture@example.invalid',
      dep:'Brickell',dest:'Coral Gables'});
    const event=ev('evt_100','refund.failed','failed');
    const result=await service.handleEvent(event);
    assert.equal(result.ok,true);
    assert.equal(result.action,'refund failure flagged for review');
    assert.equal(tickets.size,1);
    assert.equal(rides.get('ride-123').refundFailureReviewRequired,true);
    assert.equal(rides.get('ride-123').refundFailureId,'re_case_fixture');
    const firstTicket=[...tickets.values()][0];
    assert.equal(firstTicket.trip.no,'AR-FIXTURE-123');
    assert.equal(firstTicket.trip.dep,'Brickell');
    assert.equal(firstTicket.trip.arr,'Coral Gables');
    assert.equal(firstTicket.kind,'support');
    await service.handleEvent(event); // duplicate delivery
    await service.handleEvent(ev('evt_101','refund.updated','failed'));
    assert.equal(tickets.size,1,'same refund from different event types makes one case');
    assert.equal(rides.get('ride-123').refundFailureCaseNo,result.caseNo);
    const before=tickets.size;
    assert.equal((await service.handleEvent(ev('evt_102','refund.updated','pending'))).ok,true);
    assert.equal((await service.handleEvent(ev('evt_103','refund.updated','succeeded'))).ok,true);
    assert.equal(tickets.size,before,'healthy refund status is not a new exception');
    assert.equal(rides.get('ride-123').refundFailureReviewRequired,true,
      'out-of-order success must not silently erase a failed-refund alert');
    const next=ev('evt_104','refund.failed','failed');
    next.data.object.id='re_a_second_refund';
    await service.handleEvent(next);
    assert.equal(tickets.size,2,'genuinely separate failed refunds get separate cases');
    const unmatched=ev('evt_105','refund.failed','failed','pi_not_ours');
    unmatched.data.object.id='re_not_ours';
    await service.handleEvent(unmatched);
    assert.equal(tickets.size,3,'unmatched failed refund still alerts for reconciliation');
    assert.equal([...tickets.values()].at(-1).uid,'stripe-system');
    const fail=ev('evt_106','refund.failed','failed');
    fail.data.object.id='re_queue_retry';
    supportUnavailable=true;
    await assert.rejects(()=>service.handleEvent(fail),/synthetic support provider outage/);
    supportUnavailable=false;
    await service.handleEvent(fail);
    assert.equal(tickets.size,4,'provider replay creates exactly one durable issue');
    const malformed=ev('evt_missing','refund.failed','failed');
    delete malformed.data.object.id;
    await assert.rejects(()=>service.handleEvent(malformed),/missing provider refund ID/);
    assert.equal(tickets.size,4);
  }
  console.log('PASS TWICE: failed/refund.updated alerts, event replay dedupe, distinct failures, unmatched provider refund, malformed and outage retry; no Stripe calls');
}
test().catch(e=>{console.error(e);process.exitCode=1});
