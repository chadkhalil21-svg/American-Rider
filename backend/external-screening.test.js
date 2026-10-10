'use strict';
const assert = require('node:assert/strict');
const { validateReview, recordExternalReview } = require('./external-screening');
const NOW = Date.parse('2026-10-10T17:00:00Z');
const CASE = 'AR-C-ABC123456789';
const good = {
  uid: 'op1', caseNo: CASE, provider: 'Qualified Reporting Agency',
  providerReference: 'CRA-TEST-345', channel: 'authenticated_provider_portal',
  issuedOn: '2026-09-01', note: 'Agency identity and report source confirmed using the authenticated portal.',
  sourceAuthenticated: 'yes', reportOwnerMatched: 'yes', permissiblePurposeVerified: 'yes',
  action: 'clear', nationwideChecked: 'yes', primarySourceValidated: 'yes',
  sexOffenderChecked: 'yes', drivingHistoryChecked: 'yes',
  noDisqualifyingCriminalRecords: 'yes', sexOffenderClear: 'yes',
  licenseValid: 'yes', registrationVerified: 'yes', movingViolations3y: '1',
};
assert.equal(validateReview(good, NOW).ok, true, 'complete authenticated evidence validates');
for (const prop of ['sourceAuthenticated','reportOwnerMatched','permissiblePurposeVerified',
  'nationwideChecked','primarySourceValidated','sexOffenderChecked','drivingHistoryChecked',
  'noDisqualifyingCriminalRecords','sexOffenderClear','licenseValid','registrationVerified']) {
  const x = { ...good }; delete x[prop];
  assert.equal(validateReview(x, NOW).ok, false, 'missing '+prop+' must fail closed');
}
for (const moving of ['4','-1','','unknown','1.5']) {
  assert.equal(validateReview({ ...good, movingViolations3y: moving }, NOW).ok, false, 'bad MVR count must fail');
}
assert.equal(validateReview({ ...good, issuedOn: '2021-01-01' }, NOW).ok, false, 'expired report refused');
assert.equal(validateReview({ ...good, issuedOn: '2026-10-20' }, NOW).ok, false, 'future report refused');
assert.equal(validateReview({ ...good, issuedOn: '2026-02-31' }, NOW).ok, false, 'invalid date refused');
assert.equal(validateReview({ ...good, providerReference: '!' }, NOW).ok, false, 'reference must be non-sensitive token');
assert.equal(validateReview({ ...good, action: 'hold', nationwideChecked: undefined }, NOW).ok, true, 'incomplete findings may be placed on hold');

const deepMerge = (a,b) => {
  const out = { ...(a || {}) };
  for (const [k,v] of Object.entries(b)) out[k] =
    v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object'
      ? deepMerge(out[k],v) : v;
  return out;
};
function makeDb(overrideUser={}, overrideCase={}) {
  const state = {
    users: { op1: { screening: { decision:'awaiting_agency',provider:good.provider,transferCaseNo:CASE,consentAt:NOW-1000 },...overrideUser } },
    operators: { op1: { available:true, commissioned:true, screeningBlocked:true } },
    support_tickets: { [CASE]: { uid:'op1', kind:'support', status:'open',
      reason:'Operator screening — review existing provider report',
      screeningHandoff: {
        stage:'report_authenticated',owner:'reviewer1',
        agencyContact:{verifiedAt:NOW-2000,reference:'CRA-CONTACT-1'},
        authenticatedReport:{verifiedAt:NOW-1000,by:'reviewer1',agency:good.provider,
          reference:good.providerReference,channel:good.channel}},
      ...overrideCase } },
    audit_log: {},
  };
  let serial=0, committed=0;
  const db = {
    state, get committed(){ return committed; },
    collection(name) {
      return { doc(id) {
        const key=id || ('audit-'+(++serial));
        return {name,key};
      }};
    },
    async runTransaction(fn) {
      const changes=[];
      const tx={
        get:async(ref)=>({exists:!!state[ref.name]?.[ref.key],data:()=>state[ref.name][ref.key]}),
        set:(ref,value,opts)=>changes.push(()=> {
          state[ref.name] ||= {};
          state[ref.name][ref.key]=opts?.merge ? deepMerge(state[ref.name][ref.key],value) : value;
        }),
      };
      const result=await fn(tx);
      changes.forEach(fn=>fn());
      committed+=changes.length;
      return result;
    },
  };
  return db;
}
const actor = { name:'reviewer1', ip:'127.0.0.1', session:'testsession' };
(async()=>{
  const db=makeDb();
  const outcome=await recordExternalReview({db,input:good,actor,now:NOW});
  assert.equal(outcome.ok,true);
  assert.equal(db.state.users.op1.screening.decision,'pass');
  assert.equal(db.state.operators.op1.available,false,'clearance never puts Operator on duty');
  assert.equal(db.state.operators.op1.screeningBlocked,false);
  assert.equal(db.state.support_tickets[CASE].status,'closed');
  const audits=Object.values(db.state.audit_log);
  assert.equal(audits.length,1);
  assert.equal(audits[0].action,'screening_external_cleared');
  assert.equal(audits[0].actor.name,'reviewer1');
  assert(!JSON.stringify(db.state).includes('socialSecurityNumber'),'no raw PII');
  const replay=await recordExternalReview({db,input:good,actor,now:NOW});
  assert.equal(replay.ok,false,'closed case cannot be replayed');
  assert.equal(Object.keys(db.state.audit_log).length,1);

  const wrong=makeDb({screening:{ decision:'awaiting_agency',provider:'Another Agency',transferCaseNo:CASE,consentAt:NOW-1000 }});
  assert.equal((await recordExternalReview({db:wrong,input:good,actor,now:NOW})).ok,false);
  assert.equal(wrong.committed,0,'mismatched agency must not write anything');

  const self=makeDb({screening:{decision:'awaiting_agency',provider:good.provider,transferCaseNo:CASE}});
  assert.equal((await recordExternalReview({db:self,input:good,actor,now:NOW})).ok,false);
  assert.equal(self.committed,0,'no written release instruction means no clearance');

  const mismatch=makeDb({}, {uid:'another-operator'});
  assert.equal((await recordExternalReview({db:mismatch,input:good,actor,now:NOW})).ok,false);
  assert.equal(mismatch.committed,0,'case ownership required');

  const missingHandoff = makeDb({}, {screeningHandoff:null});
  assert.equal((await recordExternalReview({db:missingHandoff,input:good,actor,now:NOW})).ok,false,
    'manual clearance requires an independently verified case handoff');
  assert.equal(missingHandoff.committed,0);
  const wrongReportRef = makeDb({}, {screeningHandoff:{stage:'report_authenticated',owner:'reviewer1',
    authenticatedReport:{verifiedAt:NOW-1000,by:'reviewer1',agency:good.provider,
      channel:good.channel,reference:'WRONG-REPORT'}}});
  assert.equal((await recordExternalReview({db:wrongReportRef,input:good,actor,now:NOW})).ok,false,
    'the final review must match the authenticated original CRA report');
  const wrongReviewer = makeDb();
  assert.equal((await recordExternalReview({db:wrongReviewer,input:good,
    actor:{name:'other-reviewer'},now:NOW})).ok,false,
    'staff cannot silently take over a named CRA review');

  const hold=makeDb();
  const held=await recordExternalReview({db:hold,input:{...good,action:'hold',nationwideChecked:undefined},actor,now:NOW});
  assert.equal(held.ok,true);
  assert.equal(hold.state.users.op1.screening.decision,'review');
  assert.equal(hold.state.operators.op1.screeningBlocked,true);
  assert.equal(hold.state.support_tickets[CASE].status,'open','hold remains visible');
  assert.equal(hold.state.support_tickets[CASE].screeningHandoff.stage,'clarification_needed');
  assert.equal(hold.state.support_tickets[CASE].screeningHandoff.authenticatedReport,null);
  assert.equal((await recordExternalReview({db:hold,input:good,actor,now:NOW+1000})).ok,false,
    'holding an ambiguous report revokes clearance authority until fresh CRA evidence');
  assert.equal(Object.values(hold.state.audit_log)[0].action,'screening_external_held');

  const anon=makeDb();
  assert.equal((await recordExternalReview({db:anon,input:good,actor:{name:''},now:NOW})).ok,false);
  assert.equal(anon.committed,0,'no anonymous reviewer');
  console.log('PASS provider-neutral authenticated CRA review, hold, replays, authorizations and transactional audit');
})().catch(e=>{console.error(e);process.exitCode=1;});
