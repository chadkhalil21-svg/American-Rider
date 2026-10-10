'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const { TRUST_MS,contactId,normalizeEmail,validateIndependentContact,
  currentContactTrust, trustForEmail, recordIndependentContact, COLLECTION }=require('./insurance-contact-trust');

const now=Date.parse('2026-10-10T16:00:00Z');
const input={email:'Verified.Broker@Example.org',stateCode:'FL',
  method:'verified_broker_website_and_callback',sourceReference:'official-site-callback-001',
  note:'Verified official agency phone listing and called independently.'};
const actor={name:'founder'};
const valid=validateIndependentContact(input,actor,now);
assert.equal(valid.ok,true);
assert.equal(valid.record.email,'verified.broker@example.org');
assert.equal(valid.record.expiresAt,now+TRUST_MS);
assert.equal(contactId(' Verified.Broker@Example.org '),contactId('verified.broker@example.org'));
assert.equal(normalizeEmail(input.email),'verified.broker@example.org');
assert.equal(currentContactTrust(valid.record,input.email,'FL',now),true);
assert.equal(currentContactTrust(valid.record,'attacker@example.org','FL',now),false);
assert.equal(currentContactTrust(valid.record,input.email,'GA',now),false);
assert.equal(currentContactTrust(valid.record,input.email,'FL',now+TRUST_MS),false);
assert.equal(currentContactTrust({...valid.record,revokedAt:now},input.email,'FL',now),false);
assert.equal(currentContactTrust({...valid.record,verifiedBy:null},input.email,'FL',now),false);
assert.equal(validateIndependentContact({...input,email:'fake'},actor,now).ok,false);
assert.equal(validateIndependentContact({...input,stateCode:'GA'},actor,now).ok,false);
assert.equal(validateIndependentContact({...input,method:'operator_uploaded_email'},actor,now).ok,false);
assert.equal(validateIndependentContact({...input,sourceReference:'short'},actor,now).ok,false);
assert.equal(validateIndependentContact({...input,note:'OK'},actor,now).ok,false);
assert.equal(validateIndependentContact(input,{name:''},now).ok,false);

const records=new Map(), audits=[];
const db={
 collection(name){return {
  doc(id){return {collection:name,id:id||'new-audit'};},
 };},
 async runTransaction(fn){const changes=[];
  const tx={
   set:(ref,v)=>changes.push(()=>records.set(ref.collection+'/'+ref.id,v)),
   create:(ref,v)=>changes.push(()=>audits.push(v)),
  };
  const result=await fn(tx);
  changes.forEach(x=>x());
  return result;
 },
};
const readDb={collection(name){return {doc(id){return {get:async()=>({
 exists:records.has(name+'/'+id),data:()=>records.get(name+'/'+id),
})};}};}};
(async()=>{
 assert.equal(await trustForEmail(readDb,input.email,'FL',now),false);
 assert.equal((await recordIndependentContact({db,actor,input,now})).ok,true);
 assert.equal(records.size,1);
 assert.equal(records.get(COLLECTION+'/'+contactId(input.email)).verifiedBy,'founder');
 assert.equal(audits.length,1);
 assert.equal(await trustForEmail(readDb,input.email,'FL',now),true);
 assert.equal(await trustForEmail(readDb,'fake@example.org','FL',now),false);
 assert.equal(await trustForEmail(readDb,input.email,'GA',now),false);
 assert.equal((await recordIndependentContact({db,actor:{name:''},input,now})).ok,false);
 assert.equal(audits.length,1);
 const server=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
 const ops=fs.readFileSync(path.join(__dirname,'ops.js'),'utf8');
 assert.match(server,/if \(status === 'verified_active'\) \{/);
 assert.match(server,/currentContactTrust\(vetted\.data\(\), row\.email, 'FL', now\)/);
 assert.match(server,/result: 'unverified_provider_contact'/);
 assert.match(server,/untrustedConfirmationAt: now/);
 assert.match(server,/Do not refresh lastVerifiedAt or clear a previous adverse status/);
 assert.match(server,/contact\?\.email\) ===/);
 assert.match(ops,/opsAuthMode\(\) !== 'named'/);
 assert.match(ops,/recordIndependentContact\(\{db,actor,input:req\.body\}\)/);
 assert.match(ops,/action="\/ops\/insurance\/trust-contact"/);
 console.log('PASS carrier/broker contact trust: independent source, name/MFA, provider-neutral reuse, untrusted active status held');
})().catch(e=>{console.error(e);process.exitCode=1;});
