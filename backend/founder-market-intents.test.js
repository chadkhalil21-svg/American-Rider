'use strict';
const assert=require('node:assert/strict');
const {validateIntents,sweepFounderMarketIntents,ACTOR,METHOD}=require('./founder-market-intents');
const {markets}=require('./markets');
const {REGIONS}=require('./regions');
const {manifestFor}=require('./market-readiness');
const raw=require('./founder-market-intents.json');
const now=Date.parse('2026-10-14T04:00:00.000Z');
const three=['fl-miami-dade','fl-broward','fl-palm-beach'];
const command=raw.commands[0];
assert.equal(validateIntents(raw,now).ok,true);
assert.equal(command.regionId,'fl-southeast');
assert.equal(command.requestedBy,'chadkhalil21-svg');
assert.deepEqual([...three].sort(),markets().filter(m=>m.regionId==='fl-southeast').map(m=>m.id).sort());
const bad=x=>assert.equal(validateIntents({...raw,commands:[{...command,...x}]},now).ok,false);
bad({requestedBy:'not-founder'});
bad({action:'bypass'});
bad({expiresAt:'9999-01-01T00:00:00.000Z'});
bad({requestedAt:'2027-01-01T00:00:00.000Z'});
bad({regionId:'../../unknown'});
assert.equal(validateIntents({...raw,commands:[command,command]},now).ok,false);
(async()=>{
 for(let campaign=0;campaign<2;campaign++){
   let activationCalls=0,invalidations=0;
   const call=(extras={})=>sweepFounderMarketIntents({
     db:{},markets:markets(),regions:REGIONS,production:true,now,
     providerMissing:['screening_provider'],
     activate:async a=>{
       activationCalls++;
       assert.equal(a.actor,ACTOR);
       assert.equal(a.auditMethod,METHOD);
       assert.equal(a.intentRequestedAt,Date.parse(command.requestedAt));
       assert.deepEqual(a.providerMissing,['screening_provider']);
       assert.deepEqual(a.entries.map(e=>e.market.id).sort(),[...three].sort());
       for(const row of a.entries) assert.equal(a.expectedVersions[row.market.id],
         manifestFor(row.market,row.region).version);
       return {ok:false,code:'region_not_ready',
         missing:[{id:'company_insurance_bound'},{id:'company_insurance_bound'}]};
     },
     onOpened:()=>{invalidations++;},...extras,
   });
   assert.equal((await call({production:false})).skipped,'nonproduction');
   assert.equal(activationCalls,0);
   const denied=await call();
   assert.equal(denied.ok,false);
   assert.equal(denied.results[0].code,'region_not_ready');
   assert.deepEqual(denied.results[0].missing,['company_insurance_bound']);
   assert.equal(invalidations,0);
   assert.equal(activationCalls,1);
   const opened=await call({
     activate:async()=>({ok:true,code:'region_activated',newlyOpened:three}),
   });
   assert.equal(opened.ok,true);
   assert.deepEqual(opened.results[0].newlyOpened,three);
   assert.equal(invalidations,1);
   const again=await call({
     activate:async()=>({ok:true,code:'already_active',newlyOpened:[]}),
   });
   assert.equal(again.results[0].code,'already_active');
   assert.equal(invalidations,1);
   const stale=await call({now:Date.parse('2026-12-01T00:00:00.000Z')});
   assert.equal(stale.results[0].code,'instruction_expired');
   const unknown=await call({markets:[]});
   assert.equal(unknown.results[0].code,'unconfigured_region');
   const invalid=await call({intents:{...raw,commands:[{...command,requestedBy:'hacker'}]}});
   assert.equal(invalid.ok,false);
   assert.equal(invalid.code,'invalid_founder_instruction');
   const broken=await call({db:null});
   assert.equal(broken.code,'missing_authoritative_services');
 }
 console.log('PASS two synthetic founder-GitHub market-command campaigns: no bypass, correct region, expiry, idempotent open, source gates');
})().catch(e=>{console.error(e);process.exitCode=1;});
