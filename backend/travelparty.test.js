const assert = require('node:assert/strict');
const { normalizeParty, operatorPartyView } = require('./travelparty');

let n=0; const t=async(name,fn)=>{try{await fn();console.log('✓',name);n++;}catch(e){console.error('✗',name,e.message);process.exitCode=1;}};

(async()=>{

await t('self Travel binds Traveler to Booker identity',async()=>{
  const r=await normalizeParty({partyMode:'self'},{uid:'u1',name:'Alex Booker'});
  assert.equal(r.ok,true); assert.equal(r.party.travelerName,'Alex Booker'); assert.equal(r.party.bookedForAnother,false);
});
await t('adult Travel for another requires a Traveler name',async()=>{
  assert.equal((await normalizeParty({partyMode:'other_adult'},{uid:'u1',name:'Alex'})).ok,false);
  assert.equal((await normalizeParty({partyMode:'other_adult',travelerName:'Jordan'},{uid:'u1',name:'Alex'})).party.travelerName,'Jordan');
});
console.log(`\n${n} travel-party tests passed`);
})();
