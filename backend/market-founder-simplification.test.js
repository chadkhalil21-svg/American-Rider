'use strict';
// Tests the simplification, NOT fabricated acceptance of insurance, CRA or finance records.
const assert=require('node:assert/strict');
const {REQUIRED_EVIDENCE,readinessFor}=require('./market-readiness');
const {founderResolutionPlan}=require('./market-launch-summary');
const {marketChecklistPage}=require('./market-readiness-ui');
const {markets}=require('./markets');
const {regionById}=require('./regions');
const ids=['fl-miami-dade','fl-broward','fl-palm-beach'];
for(let pass=0;pass<2;pass++){
 const absent=REQUIRED_EVIDENCE.map(id=>({id,code:'record_absent',reason:'Unrecorded; real work unknown'}));
 const missing=[...absent,{id:'provider:screening_provider',code:'production_verification_missing',reason:'Unverified'}];
 const copy=[...missing,...missing,...missing];
 const plan=founderResolutionPlan(copy);
 assert.equal(plan.length,3,'no fifteen-founder-approval presentation');
 assert.equal(plan.reduce((sum,x)=>sum+x.items,0),REQUIRED_EVIDENCE.length+1,
   'source issues are only counted once across counties');
 assert.equal(plan.reduce((sum,x)=>sum+x.unrecorded,0),REQUIRED_EVIDENCE.length);
 assert.ok(plan.find(x=>x.id==='external').needsIndependentCheck,
   'screening handoff still needs genuinely sourced confirmation');
 assert.ok(plan.find(x=>x.id==='realworld').next.includes('real-device'),
   'CI alone is not a physical-device test');
 assert.ok(plan.find(x=>x.id==='reconcile').next.includes('existing Florida'),
   'first reconcile what exists, not buy or build again');
 const records=ids.map(id=>{
   const market=markets().find(m=>m.id===id);
   const region=regionById(market.regionId);
   const state=readinessFor({market,region,providerMissing:['screening_provider']});
   assert.equal(state.readyToActivate,false,'no synthetic source approvals');
   return {market,state};
 });
 const page=marketChecklistPage(records,{production:true});
 assert.match(page,/id="founder-resolution"/);
 assert.match(page,/3 source workstreams/);
 assert.match(page,/statewide TNC law generally prohibits extra county and city TNC operating licenses/);
 assert.match(page,/Airport and seaport pickup locations and fees remain separately controlled/);
 assert.equal((page.match(/class="founder-source-group"/g)||[]).length,3,
   'one regional status, three source action categories; no per-county repeated founder decision');
 assert.match(page,/Our founder.s region-opening instruction is already recorded/);
 assert.match(page,/one-source\/three-county filing route/);
 assert.equal((page.match(/<button type="button" id="open-south-florida"/g)||[]).length,1);
 assert.equal((page.match(/class="activate"[^>]*disabled/g)||[]).length,3);
 assert.ok(!page.includes('14 government permits'));
 const other=founderResolutionPlan([{id:'source',code:'unspecified'}]);
 assert.equal(other.length,1);
 assert.equal(other[0].id,'other','unknown blockers are not hidden or falsely approved');
}
console.log('PASS twice: source-based founder status, 3-county dedup, FL licensing distinction, no false admission');
