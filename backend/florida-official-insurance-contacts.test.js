'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  SOURCE,csvRows,parseOfficialBusinessCsv,createOfficialContactRecognizer,
} = require('./florida-official-insurance-contacts');
const { policyFingerprint } = require('./insurance-contact-trust');

assert.equal(SOURCE,'https://www.myfloridacfo.com/downloads/AAS/LicenseeSearch/AllValidLicensesBusiness.csv');
const HEADER='License Number,Business Name,Email Address,License Type,License Status\r\n';
const data=HEADER+
  '"A100","Known, Insurance Agency","agency@example.com","AGENCY LICENSE","VALID"\r\n'+
  'A200,"Example Broker","support@example.org","GENERAL LINES","ACTIVE"\r\n'+
  'B300,"Adjuster Services","adjuster@example.com","ADJUSTER LICENSE","VALID"\r\n'+
  'C400,"Health Only Agency","health@example.com","HEALTH ONLY","VALID"\r\n'+
  'D500,"Expired Broker","expired@example.com","AGENCY LICENSE","EXPIRED"\r\n';
assert.equal([...csvRows(HEADER+'A1,"Foo, Bar",mail@example.com,"AGENCY LICENSE",VALID\r\n')].length,2);
assert.deepEqual([...csvRows('Name,Note\r\n"Name A","Line 1\nLine 2"\r\n')][1],
  ['Name A','Line 1\nLine 2']);
assert.deepEqual([...csvRows('Name,Email'+String.fromCharCode(10)+
  'Company \"Insurance\" Agency,contact@example.com'+String.fromCharCode(10))][1],
  ['Company "Insurance" Agency','contact@example.com']);
assert.throws(()=>[...csvRows('x,y\n"unterminated,z')],/unclosed_csv_quote/);
assert.throws(()=>parseOfficialBusinessCsv('not,csv', {minimumContacts:1}),
  /header|schema/);
// Official Florida DFS schema was verified by live GitHub Actions 2026-10-10.
const officialHeader=['License Number','Full Name','NPN Number','Residency Type',
  'License TYCL','License TYCL Desc','License Status','License Issue Date',
  'Email Address','Business Phone','Business Address1','Business Address2',
  'Business City','Business State','Business Zip','Business County',
  'Mailing Address','Mailing Address2','Mailing City','Mailing State','Mailing Zip'];
const official=(record)=> officialHeader.map(h=>record[h]||'').join(',')+String.fromCharCode(10);
const officialCsv=officialHeader.join(',')+String.fromCharCode(10)+
  official({'License Number':'A123','Full Name':'Official Agency',
    'License TYCL Desc':'AGENCY LICENSE','License Status':'VALID',
    'Email Address':'official@example.com'})+
  official({'License Number':'A124','Full Name':'Second Agency',
    'License TYCL Desc':'GENERAL LINES','License Status':'VALID',
    'Email Address':'second@example.com'});
assert.equal(parseOfficialBusinessCsv(officialCsv,{minimumContacts:2}).matchedCount,2);
const parsed=parseOfficialBusinessCsv(data,{minimumContacts:2});
assert.equal(parsed.matchedCount,2,'only active qualifying agency/general-lines contacts');
assert.equal(parsed.validRows,2);
const withMalformed=data+'BAD,ROW'+String.fromCharCode(10);
const parsedWithBad=parseOfficialBusinessCsv(withMalformed,{minimumContacts:2});
assert.equal(parsedWithBad.matchedCount,2);
assert.equal(parsedWithBad.malformedRows,1);
assert.throws(()=>parseOfficialBusinessCsv(data+
  Array.from({length:150},()=> 'BAD,ROW').join(String.fromCharCode(10)),
  {minimumContacts:2}),/official_registry_corrupt_ratio/);
assert.throws(()=>parseOfficialBusinessCsv(data,{minimumContacts:500}),/insufficient/);
assert.throws(()=>parseOfficialBusinessCsv(data.replace('Email Address','Never An Email')),
  /schema_unrecognized/);

let now=10_000_000,fetches=0,body=data;
const recognition=createOfficialContactRecognizer({
  now:()=>now,minContacts:2,load:async()=>{fetches++;return body;},
});
(async()=>{
  const [a,b]=await Promise.all([
    recognition.lookup(' Agency@Example.Com '),recognition.lookup('support@example.org'),
  ]);
  assert.equal(fetches,1,'concurrent lookups share one free state download');
  assert.equal(a.recognized,true);
  assert.equal(a.email,'agency@example.com');
  assert.equal(a.licence,'A100');
  assert.equal(b.recognized,true);
  assert.equal((await recognition.lookup('adjuster@example.com')).recognized,false);
  assert.equal((await recognition.lookup('expired@example.com')).recognized,false);
  assert.equal((await recognition.lookup('nonexistent@example.com')).recognized,false);
  assert.equal((await recognition.lookup('invalid@')).recognized,false);
  assert.equal(fetches,1,'24h cache prevents downloading 25 MB per Operator');
  const old=recognition.stats().fetchedAt;
  now+=24*3600_000 + 1;
  body='corrupt,source\n';
  assert.equal((await recognition.lookup('agency@example.com')).recognized,false,
    'old source must not silently renew policies after failed refresh');
  assert.equal(fetches,2);
  assert.equal(recognition.stats().active,false);
  body=data;
  assert.equal((await recognition.lookup('agency@example.com')).recognized,false,
    'failure backoff prevents rapid retries or DoS');
  now+=30*60_000 + 1;
  assert.equal((await recognition.lookup('agency@example.com')).recognized,true,
    'valid official source restores automatic recognition');
  assert.equal(fetches,3);
  assert.ok(recognition.stats().fetchedAt>old);

  const first={ insurer:'Known Insurance',policyNumber:'FL-1234567',
    effectiveDate:'2026-01-01',expirationDate:'2027-01-01' };
  const same={...first};
  assert.equal(policyFingerprint(first),policyFingerprint(same));
  assert.notEqual(policyFingerprint(first),policyFingerprint({...first,policyNumber:'FL-7654321'}));
  assert.notEqual(policyFingerprint(first),policyFingerprint({...first,expirationDate:'2028-01-01'}));
  assert.equal(policyFingerprint({...first,policyNumber:''}),null);

  const server=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
  assert.match(server,/official = await lookupOfficialAgencyEmail/);
  assert.match(server,/row\.policyFingerprint === policyFingerprint\(u\.insuranceMonitoring\)/);
  assert.match(server,/official\.recognized === true/);
  assert.match(server,/officialSourceHash/);
  assert.match(server,/matchedPolicy/);
  assert.match(server,/result\.untrusted && Number\(result\.row\?\.attempt\) >= 3/);
  assert.match(server,/policyFingerprint: policyFingerprint\(m\)/);
  console.log('PASS FL official source: exact email matching, agency types, licence/source freshness, coalesced 25 MB fetch, policy-bound confirmation');
})().catch(e=>{console.error(e);process.exitCode=1;});
