const assert = require('node:assert/strict');
const { normalizeParty, operatorPartyView } = require('./travelparty');

let n=0; const t=(name,fn)=>{try{fn();console.log('✓',name);n++;}catch(e){console.error('✗',name,e.message);process.exitCode=1;}};

t('self Travel binds Traveler to Booker identity',()=>{
  const r=normalizeParty({partyMode:'self'},{uid:'u1',name:'Alex Booker'});
  assert.equal(r.ok,true); assert.equal(r.party.travelerName,'Alex Booker'); assert.equal(r.party.bookedForAnother,false);
});
t('adult Travel for another requires a Traveler name',()=>{
  assert.equal(normalizeParty({partyMode:'other_adult'},{uid:'u1',name:'Alex'}).ok,false);
  assert.equal(normalizeParty({partyMode:'other_adult',travelerName:'Jordan'},{uid:'u1',name:'Alex'}).party.travelerName,'Jordan');
});
t('unaccompanied minor Travel fails closed even with a guardian declaration',()=>{
  const r=normalizeParty({partyMode:'minor',travelerName:'Sam',travelerAge:15,guardianAttestation:true},{uid:'parent',name:'Alex'});
  assert.equal(r.ok,false); assert.equal(r.code,'unaccompanied_minor_not_supported');
});
console.log(`\n${n} travel-party tests passed`);
