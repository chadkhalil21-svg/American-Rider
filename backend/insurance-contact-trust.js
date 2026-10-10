'use strict';
// Independently verified insurance contacts. Cheap, carrier-neutral reuse of a
// single reviewed broker mailbox across multiple Operators. Email possession is
// NOT proof of insurer identity: an Operator can enter any mailbox.
// An affirmative status reply may renew eligibility only from a previously
// vetted, unexpired source. This registry never creates insurance coverage.
const crypto = require('node:crypto');
const COLLECTION = 'insurance_verified_contacts';
const TRUST_MS = 365 * 24 * 60 * 60 * 1000;
const METHODS = new Set([
  'verified_carrier_website_and_callback',
  'verified_broker_website_and_callback',
  'regulator_licence_lookup_and_callback',
  'authenticated_provider_contract',
]);
const normalizeEmail = (v) => String(v || '').trim().toLowerCase();
const contactId = email => crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex');
const validEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

function validateIndependentContact(input, actor, now=Date.now()) {
  const email=normalizeEmail(input?.email), stateCode=String(input?.stateCode||'FL');
  const method=String(input?.method||'');
  const sourceReference=String(input?.sourceReference||'').trim();
  const note=String(input?.note||'').trim();
  const reviewer=String(actor?.name||'');
  if(!validEmail(email)) return {ok:false, code:'invalid_email', error:'Enter the independently verified provider mailbox.'};
  if(stateCode!=='FL') return {ok:false, code:'uncommissioned_jurisdiction',error:'The contact-trust process is currently commissioned only for Florida.'};
  if(!METHODS.has(method)) return {ok:false, code:'independent_verification_required',error:'Verify the agency from an independent official source and an outbound callback.'};
  if(sourceReference.length<8 || sourceReference.length>180 || note.length<12 || note.length>500)
    return {ok:false,code:'evidence_required',error:'Record a nonsensitive official source reference and the independent callback evidence.'};
  if(!/^[A-Za-z0-9_-]{1,40}$/.test(reviewer))
    return {ok:false,code:'named_ops_required',error:'A named, MFA-backed Operations reviewer is required.'};
  if(!Number.isSafeInteger(now)||now<=0) return {ok:false,code:'time_unavailable'};
  return {ok:true, record:{
    email,stateCode,method,sourceReference,note,verifiedBy:reviewer,
    verifiedAt:now,expiresAt:now+TRUST_MS,
  }};
}
function currentContactTrust(record, email, stateCode='FL', now=Date.now()) {
  return !!record && record.email===normalizeEmail(email) && record.stateCode===stateCode &&
    METHODS.has(record.method) && /^[A-Za-z0-9_-]{1,40}$/.test(String(record.verifiedBy||'')) &&
    String(record.sourceReference||'').length>=8 &&
    Number.isFinite(record.verifiedAt) && Number(record.verifiedAt)>0 &&
    Number.isFinite(record.expiresAt) && Number(record.expiresAt)>now &&
    Number(record.expiresAt)<=Number(record.verifiedAt)+TRUST_MS &&
    record.revokedAt==null;
}
async function trustForEmail(db,email,stateCode='FL',now=Date.now()) {
  if(!db || !validEmail(normalizeEmail(email)) || stateCode!=='FL') return false;
  const snap=await db.collection(COLLECTION).doc(contactId(email)).get();
  return snap.exists && currentContactTrust(snap.data(),email,stateCode,now);
}
async function recordIndependentContact({db,actor,input,now=Date.now()}) {
  const validation=validateIndependentContact(input,actor,now);
  if(!validation.ok)return validation;
  if(!db)return {ok:false,code:'database_unavailable'};
  const record=validation.record;
  const ref=db.collection(COLLECTION).doc(contactId(record.email));
  const audit=db.collection('audit_log').doc();
  await db.runTransaction(async tx=>{
    tx.set(ref,record,{merge:false});
    tx.create(audit,{at:now, action:'insurance_provider_contact_independently_vetted',
      providerContactHash:contactId(record.email), stateCode:record.stateCode,
      method:record.method, sourceReference:record.sourceReference,
      actor:{name:record.verifiedBy,method:'named_ops_mfa'}, expiresAt:record.expiresAt});
  });
  return {ok:true,expiresAt:record.expiresAt};
}
// Bind responses to the EXACT issued policy. A contact reply for an old policy
// cannot renew the status clock after a new document or policy is uploaded.
function policyFingerprint(m) {
  const p=[m?.insurer,m?.policyNumber,m?.effectiveDate,m?.expirationDate]
    .map(x=>String(x||'').trim().toUpperCase());
  if(!p[1] || !p[2] || !p[3])return null;
  return crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex');
}
module.exports={COLLECTION,TRUST_MS,METHODS,contactId,normalizeEmail,
  validateIndependentContact,currentContactTrust,trustForEmail,recordIndependentContact,policyFingerprint};
