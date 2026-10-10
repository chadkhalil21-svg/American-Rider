'use strict';
const assert=require('node:assert/strict');
const {HOLD_MS,validateTransition,recordAdverseReview}=require('./external-screening-adverse');
const NOW=Date.parse('2026-10-10T15:00:00Z');
const CASE='AR-C-123ABC456DEF',UID='verified-operator';
const actor={name:'reviewer1'};
const good={
 uid:UID,caseNo:CASE,action:'propose',reference:'CRA-REPORT-556',
 note:'Statutory review verified against an authenticated agency record.',
 reasonCode:'criminal_history',agencyAuthenticated:'yes',reportMatchesOperator:'yes',
 permittedPurpose:'yes',disqualifierConfirmed:'yes'
};
const copy=x=>JSON.parse(JSON.stringify(x));
function fakeDb(seed={}){
 let serial=0,updates=0;
 const state={
  users:{[UID]:{screening:{decision:'review',provider:'Sample Agency',consentAt:NOW-100,
     transferCaseNo:CASE,...seed.screening}}},
  support_tickets:{[CASE]:{uid:UID,kind:'support',status:'open',
    reason:'Operator screening — review new provider report',...seed.ticket}},
  operators:{[UID]:{available:true,commissioned:true,screeningBlocked:false}},
  audit_log:{}
 };
 function merge(a,b){
  let out={...a};
  for(let [k,v] of Object.entries(b))out[k]=v&&typeof v==='object'&&!Array.isArray(v)
    ? merge(out[k]||{},v):v;
  return out;
 }
 return {state,get updates(){return updates},collection(name){return{
    doc(id){return{name,id:id||'audit-'+(++serial)}}}},
    async runTransaction(fn){
      const ops=[],tx={
       get:async(ref)=>({exists:state[ref.name]?.[ref.id]!==undefined,
         data:()=>copy(state[ref.name][ref.id])}),
       set:(ref,obj,opts)=>ops.push(()=>{
         state[ref.name]||={};
         state[ref.name][ref.id]=opts?.merge?merge(state[ref.name][ref.id]||{},obj):obj;
       })
      };
      const out=await fn(tx);
      ops.forEach(op=>op());updates+=ops.length;
      return out;
    }
 };
}
async function execute(db,action,over={},at=NOW) {
 return recordAdverseReview({db,input:{...good,action,...over},actor,now:at});
}
(async()=>{
 assert.equal(validateTransition(good,NOW).ok,true);
 for(const k of ['agencyAuthenticated','reportMatchesOperator','permittedPurpose','disqualifierConfirmed']){
   const x={...good};delete x[k];
   assert.equal(validateTransition(x,NOW).ok,false,'missing verification '+k);
 }
 assert.equal(validateTransition({...good,reasonCode:'just_a_guess'},NOW).ok,false);
 let db=fakeDb();
 assert.equal((await execute(db,'finalize',{finalNoticeDelivered:'yes',
   providerFindingsRechecked:'yes',noOpenDispute:'yes'})).ok,false,'cannot finalize without notices');
 assert.equal((await execute(db,'propose')).ok,true);
 assert.equal(db.state.users[UID].screening.decision,'pre_adverse');
 assert.equal(db.state.operators[UID].screeningBlocked,true);
 assert.equal(db.state.operators[UID].available,false);
 assert.equal((await execute(db,'propose')).ok,false,'cannot repeat proposal');
 assert.equal((await execute(db,'record_pre_notice',{reference:'N-3311'})).ok,false,'rights and report required');
 assert.equal((await execute(db,'record_pre_notice',{
   reference:'PRE-DELIVERY-900',reportCopyProvided:'yes',rightsSummaryProvided:'yes',deliveryConfirmed:'yes'
 })).ok,true,'verify pre-adverse documents actually delivered');
 assert.equal(db.state.users[UID].screening.adverseAction.stage,'pre_notice_sent');
 const final={reference:'FINAL-DELIVERY-209',
  finalNoticeDelivered:'yes',providerFindingsRechecked:'yes',noOpenDispute:'yes'};
 assert.equal((await execute(db,'finalize',final,NOW+HOLD_MS-1)).ok,false,'cannot finalize before internal review interval');
 assert.equal((await execute(db,'finalize',final,NOW+HOLD_MS)).ok,true,'final only with full evidence and time');
 assert.equal(db.state.users[UID].screening.decision,'refuse');
 assert.equal(db.state.support_tickets[CASE].status,'closed');
 assert.equal(db.state.operators[UID].available,false);
 assert.equal((await execute(db,'finalize',final,NOW+HOLD_MS+1000)).ok,false,'closed case cannot repeat');
 assert.equal(Object.values(db.state.audit_log).length,3,'propose, pre-notice and final actions audit-logged');
 db=fakeDb();
 assert.equal((await execute(db,'propose')).ok,true);
 assert.equal((await execute(db,'dispute')).ok,true);
 assert.equal(db.state.users[UID].screening.adverseAction.stage,'disputed');
 assert.equal((await execute(db,'finalize',final,NOW+HOLD_MS*5)).ok,false,'any open dispute blocks final');
 assert.equal((await execute(db,'withdraw')).ok,true,'reviewer can withdraw proposed adverse decision');
 assert.equal(db.state.users[UID].screening.decision,'review','withdrawal never constitutes PASS');
 db=fakeDb({ticket:{uid:'different'}});
 assert.equal((await execute(db,'propose')).ok,false,'must own the support case');
 assert.equal(db.updates,0,'unverified owner produces zero writes');
 db=fakeDb({screening:{consentAt:null}});
 assert.equal((await execute(db,'propose')).ok,false,'must have Operator release instruction');
 assert.equal(db.updates,0);
 console.log('PASS external screening adverse proposal/pre-notice/rights/dispute/finalization holds and atomic audits');
})().catch(e=>{console.error(e);process.exitCode=1});
