'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {recordOperatorInsuranceRisk,mayClearOperatorInsuranceRisk} = require('./insurance-adverse-report');
const {continuingStatus,applyIndependentConfirmation}=require('./insurance-monitoring');
const t=Date.UTC(2026,9,14,12);
const original=applyIndependentConfirmation({
  insurer:'Synthetic Carrier',policyNumber:'SYNTH-001',effectiveDate:'2026-01-01',expirationDate:'2027-01-01',
}, {status:'verified_active',source:'verified_broker',now:t-2*86400000});
const order= [
  ['unpaid premium: operator receives advance notice', 'pending_cancellation'],
  ['policy already cancelled early', 'cancelled'],
];
for(let pass=1;pass<=2;pass++){
 for(const [_,kind] of order){
   const risk=recordOperatorInsuranceRisk(original,kind,t);
   assert.equal(risk.status,kind);
   assert.equal(risk.operatorAdverseReportedAt,t);
   assert.equal(continuingStatus({insuranceMonitoring:risk},t).ok,false,
     'valid printed expiry does not override nonpayment notice');
   assert.equal(mayClearOperatorInsuranceRisk(risk,t-10),false,
     'previously issued insurer confirmation link cannot override later notice');
   assert.equal(mayClearOperatorInsuranceRisk(risk,t),false,
     'same-time link is not independent confirmation after the warning');
   assert.equal(mayClearOperatorInsuranceRisk(risk,t+1),true,
     'a NEW source-verified policy-bound request may validate paid-up coverage');
   assert.equal(recordOperatorInsuranceRisk(risk,'verified_active',t),null,
     'Operator cannot self-certify reinstatement');
   assert.equal(continuingStatus({insuranceMonitoring:recordOperatorInsuranceRisk(risk,'pending_cancellation',t+1)},t+1).ok,false,
     'duplicate report may not restore service');
   const cancelled=recordOperatorInsuranceRisk(risk,'cancelled',t+2);
   assert.equal(cancelled.status,'cancelled');
   assert.equal(recordOperatorInsuranceRisk(cancelled,'pending_cancellation',t+3).status,'cancelled',
     'cancelled report never downgraded to a lesser warning');
 }
 assert.equal(mayClearOperatorInsuranceRisk(original,t-100),true,
   'ordinary independently verified policy without a self-report continues unchanged');
 assert.equal(recordOperatorInsuranceRisk(original,'unknown',t),null);
 assert.equal(recordOperatorInsuranceRisk(original,'cancelled',-1),null);
}
const server=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
const route=(server.match(/app\.post\('\/operator\/insurance\/report-risk'[\s\S]*?\n\}\);/)||[])[0]||'';
assert.ok(route.includes('requireAuth')&&route.includes('db.runTransaction'));
assert.ok(route.includes('tx.get(userRef)')&&route.includes('tx.get(opRef)'));
assert.ok(route.includes('available:false') && route.includes("action:'operator_reported_insurance_risk'"));
assert.ok(!route.includes('verified_active'),'Operator may only report an adverse event');
const provider=(server.match(/app\.post\('\/insurance\/status-confirmation'[\s\S]*?\n\}\);/)||[])[0]||'';
assert.ok(provider.includes('mayClearOperatorInsuranceRisk'));
assert.ok(provider.includes('row.createdAt'));
assert.ok(provider.includes('currentContactTrust'));
assert.ok(provider.includes('matchedPolicy'));
assert.ok(server.includes("const saveRequestMetadata = async (deliveryIssue = null) => db.runTransaction("),
  'outbound confirmations must update against latest monitoring in a transaction');
assert.ok(server.includes('const current=latestUser.insuranceMonitoring||{}'),
  'a delayed email must not overwrite a newer self-reported adverse status');
assert.ok(!server.includes('insuranceMonitoring: nextMonitoring'),
  'no old request snapshot is allowed to reset the cancellation lockout');
console.log('PASS twice: nonpayment notice, early cancellation, already-outstanding token, provider-only release, no new offer');
