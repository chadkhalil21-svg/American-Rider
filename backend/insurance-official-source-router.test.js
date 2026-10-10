'use strict';
const assert = require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {jurisdictions}=require('./jurisdictions/us.json');
const {recognizeOfficialInsuranceContact,insuranceSourceState,STATES}=require('./insurance-official-source-router');
assert.equal(STATES.size,56,'national identity registry shared across all jurisdictions');
const code=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
assert.match(code,/sourceStateCode: insuranceSourceState\(user\)/);
assert.match(code,/sameJurisdiction = row.sourceStateCode/);
assert.match(code,/recognizeOfficialInsuranceContact\(\{ stateCode, email:contactEmail \}\)/);
assert.match(code,/row.sourceStateCode === insuranceSourceState\(u\)/);
assert.doesNotMatch(code,/lookupOfficialAgencyEmail\(contactEmail\)/,
 'server must route through state adapter, not directly hardcode Florida');

(async()=>{
  const lookup={
    FL: async email => ({recognized:true,email,source:'FL_DFS_VALID_BUSINESS_LICENSES',sourceHash:'state-fixture'}),
    TX: async()=>({recognized:true,email:'bad@example.com'}),
  };
  const good=await recognizeOfficialInsuranceContact({
    stateCode:'FL',email:'small.broker@example.org',lookup,
  });
  assert.equal(good.recognized,true);
  assert.equal(good.jurisdiction,'FL');
  assert.equal((await recognizeOfficialInsuranceContact({stateCode:'AA',email:'fake@example.org',lookup})).recognized,false);
  assert.equal((await recognizeOfficialInsuranceContact({stateCode:'GA',email:'fake@example.org',lookup})).reason,
    'insurance_jurisdiction_uncommissioned');
  assert.equal((await recognizeOfficialInsuranceContact({stateCode:'TX',email:'fake@example.org',lookup})).recognized,
    false,'other states must not run simulated adapters before policy commissioning');
  assert.equal((await recognizeOfficialInsuranceContact({stateCode:'FL',email:'other@example.org',lookup:{
    FL: async()=>{throw new Error('official source unavailable')},
  }})).recognized,false);
  assert.equal((await recognizeOfficialInsuranceContact({stateCode:'FL',email:'other@example.org',lookup:{
    FL:async()=>({recognized:false,reason:'not_found'}),
  }})).recognized,false);
  const markets = require('./markets').markets();
  const miami=markets.find(m=>m.id==='fl-miami-dade');
  assert.equal(insuranceSourceState({operatingMarket:{id:miami.id}}),'FL');
  assert.equal(insuranceSourceState({operatingMarket:{id:'fake-market'}}),null);
  assert.equal(insuranceSourceState({}),null);
  console.log('PASS national insurance-source routing: 56 states, policy-commissioned adapters only, no Florida scope leakage');
})().catch(e=>{console.error(e);process.exitCode=1});
