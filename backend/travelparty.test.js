const assert = require('node:assert/strict');
const { normalizeParty, operatorPartyView, guardianCanFollow } = require('./travelparty');

let n=0; const t=(name,fn)=>{try{fn();console.log('✓',name);n++;}catch(e){console.error('✗',name,e.message);process.exitCode=1;}};

t('self Travel binds Traveler to Booker identity',()=>{
  const r=normalizeParty({partyMode:'self'},{uid:'u1',name:'Alex Booker'});
  assert.equal(r.ok,true); assert.equal(r.party.travelerName,'Alex Booker'); assert.equal(r.party.bookedForAnother,false);
});
t('adult Travel for another requires a Traveler name',()=>{
  assert.equal(normalizeParty({partyMode:'other_adult'},{uid:'u1',name:'Alex'}).ok,false);
  assert.equal(normalizeParty({partyMode:'other_adult',travelerName:'Jordan'},{uid:'u1',name:'Alex'}).party.travelerName,'Jordan');
});
t('minor Travel fails closed without guardian attestation',()=>{
  const r=normalizeParty({partyMode:'minor',travelerName:'Sam'},{uid:'parent',name:'Alex'});
  assert.equal(r.ok,false); assert.equal(r.code,'guardian_attestation_required');
});
t('minor Travel records guardian and minimizes Operator view',()=>{
  const r=normalizeParty({partyMode:'minor',travelerName:'Sam',guardianAttestation:true},{uid:'parent',name:'Alex'});
  const v=operatorPartyView(r.party);
  assert.deepEqual(v,{travelerName:'Sam',bookedForAnother:true,minor:true,guardianName:'Alex'});
  assert.equal(guardianCanFollow({ride:{travelerUid:'parent',party:r.party},uid:'parent'}),true);
  assert.equal(guardianCanFollow({ride:{travelerUid:'parent',party:r.party},uid:'stranger'}),false);
});
console.log(`\n${n} travel-party tests passed`);
