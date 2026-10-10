'use strict';
const assert = require('node:assert/strict');
const { recordScreeningHandoff } = require('./screening-handoff');
const { recordExternalReview } = require('./external-screening');
const NOW = Date.parse('2026-10-10T17:00:00Z');
const CASE = 'AR-C-ABC123456789', NAME = 'Qualified Reporting Agency';
const actor = {name:'reviewer1',session:'some-session',ip:'127.0.0.1'};
const core = {uid:'op1',caseNo:CASE,note:'Verified agency business registry and case status with the source.'};
const deepMerge = (a,b) => {
  const o={...(a||{})};
  for(const [k,v] of Object.entries(b))
    o[k]=v&&typeof v==='object'&&!Array.isArray(v)&&o[k]&&typeof o[k]==='object'
      ? deepMerge(o[k],v):v;
  return o;
};
function makeDb(overrides={}) {
 const state={
  users:{op1:{screening:{decision:'awaiting_agency',provider:NAME,consentAt:NOW-3000,transferCaseNo:CASE}}},
  support_tickets:{[CASE]:{uid:'op1',kind:'support',status:'open',reason:'Operator screening — review new provider report'}},
  operators:{op1:{available:false,screeningBlocked:true}},
  audit_log:{},...overrides,
 };
 let seq=0,writes=0;
 const db={state,get writes(){return writes;},
  collection(name){return {doc(id){return {name,id:id||'audit-'+(++seq)};}};},
  async runTransaction(fn){
   const pending=[];
   const tx={
     get:async ref=>({exists:!!state[ref.name]?.[ref.id],data:()=>structuredClone(state[ref.name][ref.id])}),
     set:(ref,value,opts)=>pending.push(()=>{
      state[ref.name]||={};
      state[ref.name][ref.id]=opts?.merge?deepMerge(state[ref.name][ref.id],value):value;
     })
   };
   const out=await fn(tx);pending.forEach(p=>p());writes+=pending.length;return out;
  }
 };
 return db;
}
(async()=>{
 const db=makeDb();
 const contact={...core,action:'agency_contacted',contactChannel:'verified_business_phone',
   contactReference:'CRA-CONTACT-1',agencyIdentityVerified:'yes'};
 const report={...core,action:'report_authenticated',reportChannel:'authenticated_provider_portal',
   providerReference:'CRA-REPORT-123',sourceAuthenticated:'yes',reportOwnerMatched:'yes',
   permissiblePurposeVerified:'yes'};
 assert.equal((await recordScreeningHandoff({db,input:contact,actor,now:NOW})).ok,false,
   'contact action before claim must be blocked');
 assert.equal(db.writes,0);
 assert.equal((await recordScreeningHandoff({db,input:{...core,action:'claim'},actor,now:NOW})).ok,true);
 assert.equal(db.state.support_tickets[CASE].screeningHandoff.stage,'claimed');
 assert.equal((await recordScreeningHandoff({db,input:contact,actor:{...actor,name:'other'},now:NOW})).ok,false,
   'another reviewer cannot silently hijack the screening case');
 assert.equal((await recordScreeningHandoff({db,input:contact,actor,now:NOW})).ok,true);
 assert.equal(db.state.support_tickets[CASE].screeningHandoff.agencyContact.channel,'verified_business_phone');
 assert.equal((await recordScreeningHandoff({db,input:{...report,sourceAuthenticated:'no'},actor,now:NOW})).ok,false);
 assert.equal((await recordScreeningHandoff({db,input:report,actor,now:NOW})).ok,true);
 const receipt=db.state.support_tickets[CASE].screeningHandoff;
 assert.equal(receipt.stage,'report_authenticated');
 assert.equal(receipt.authenticatedReport.reference,'CRA-REPORT-123');
 assert.equal(receipt.authenticatedReport.by,'reviewer1');
 assert.equal((await recordScreeningHandoff({db,input:{...core,action:'dispute_open'},actor,now:NOW})).ok,true);
 assert.equal(db.state.users.op1.screening.decision,'review','dispute never authorizes Travel');
 assert.equal(db.state.support_tickets[CASE].screeningHandoff.authenticatedReport,null);
 const good={
  ...core,action:'clear',provider:NAME,providerReference:'CRA-REPORT-123',
  channel:'authenticated_provider_portal',issuedOn:'2026-09-01',
  sourceAuthenticated:'yes',reportOwnerMatched:'yes',permissiblePurposeVerified:'yes',
  nationwideChecked:'yes',primarySourceValidated:'yes',sexOffenderChecked:'yes',
  drivingHistoryChecked:'yes',noDisqualifyingCriminalRecords:'yes',sexOffenderClear:'yes',
  licenseValid:'yes',registrationVerified:'yes',movingViolations3y:'0'
 };
 assert.equal((await recordExternalReview({db,input:good,actor,now:NOW})).ok,false,
   'disputed report cannot be reused for clearance');
 assert.equal((await recordScreeningHandoff({db,input:contact,actor,now:NOW+1000})).ok,true);
 assert.equal((await recordScreeningHandoff({db,input:report,actor,now:NOW+2000})).ok,true);
 assert.equal((await recordExternalReview({db,input:good,actor,now:NOW+3000})).ok,true,
   'newly verified agency evidence may be adjudicated after dispute recheck');
 assert.equal(db.state.users.op1.screening.decision,'pass');
 assert.equal(db.state.operators.op1.available,false,'screening clearance cannot put Operator on duty');
 assert.equal(db.state.support_tickets[CASE].status,'closed');
 assert.equal((await recordScreeningHandoff({db,input:{...core,action:'claim'},actor,now:NOW+4000})).ok,false,
   'closed case cannot be re-opened by retry');
 assert(Object.values(db.state.audit_log).length>=7, 'every stage and decision is audited');
 assert(!JSON.stringify(db.state).includes('socialSecurityNumber'));
 const invalid=makeDb();
 assert.equal((await recordScreeningHandoff({db:invalid,input:{...core,action:'claim',note:'123-45-6789'},actor,now:NOW})).ok,false);
 assert.equal(invalid.writes,0);
 const malicious=makeDb({support_tickets:{[CASE]:{uid:'another-operator',kind:'support',status:'open',
  reason:'Operator screening — review new provider report'}}});
 assert.equal((await recordScreeningHandoff({db:malicious,input:{...core,action:'claim'},actor,now:NOW})).ok,false);
 assert.equal(malicious.writes,0);
 console.log('PASS external CRA handoff owner, provenance, strict ordering, dispute recheck and no self-clearance');
})().catch(e=>{console.error(e);process.exitCode=1;});
