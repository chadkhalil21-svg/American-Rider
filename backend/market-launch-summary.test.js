'use strict';
const assert=require('node:assert/strict');
const {GROUPS,conciseMarketIssues}=require('./market-launch-summary');
const M=require('./market-readiness');
const {markets}=require('./markets');
const {regionById}=require('./regions');
const {marketChecklistPage}=require('./market-readiness-ui');
const ids=GROUPS.flatMap(g=>g.issues);
assert.equal(GROUPS.length,4);
assert.equal(ids.length,new Set(ids).size,'a check appears in exactly one group');
assert.deepEqual(M.REQUIRED_EVIDENCE.slice().sort(),
  ids.filter(id=>!id.startsWith('provider:')).sort(),'every real launch evidence gate remains counted');
for(let campaign=0;campaign<2;campaign++){
 const sameCounty=markets().filter(m=>m.regionId==='fl-southeast');
 const all=sameCounty.flatMap(m=>M.readinessFor({market:m,region:regionById(m.regionId)}).missing);
 const result=conciseMarketIssues([...all,{id:'provider:screening_provider',code:'production_verification_missing'}]);
 assert.deepEqual(result.map(x=>x.id),['insurance','operators','travel','safety']);
 assert.equal(result.reduce((n,x)=>n+x.items,0),12);
 assert.equal(result.reduce((n,x)=>n+x.unrecorded,0),11);
 assert.equal(result.find(x=>x.id==='operators').unverifiedProvider,1);
 assert.ok(result.every(x=>!x.message.includes('failed')&&!x.message.includes('not completed')));
 const html=marketChecklistPage(sameCounty.map(m=>({
   market:m,state:M.readinessFor({market:m,region:regionById(m.regionId),
   providerMissing:['screening_provider']}),
 })),{production:true});
 assert.equal((html.match(/id="founder-launch-issues"/g)||[]).length,1,'one founder summary');
 assert.match(html,/these are groups of existing checks, not new permits/);
 for(const group of result)assert.match(html,new RegExp(group.label));
 assert.match(html,/Record independently reviewed evidence/,'actual source workflows remain');
 assert.match(html,/id="open-south-florida"/,'atomic founder action stays wired');
 assert.match(html,/data-market="fl-miami-dade"/);
 assert.match(html,/data-market="fl-broward"/);
 assert.match(html,/data-market="fl-palm-beach"/);
 const one=conciseMarketIssues([
   {id:'company_insurance_bound',code:'record_absent'},
   {id:'company_insurance_bound',code:'record_expired'},
   {id:'provider:screening_provider',code:'production_verification_missing'},
 ]);
 assert.equal(one[0].needsReview,1,'specific expired record supersedes generic absent record');
 assert.equal(one[1].unverifiedProvider,1);
 assert.deepEqual(conciseMarketIssues([]),[]);
 assert.equal(conciseMarketIssues([{id:'unknown_protection',code:'unverified'}])[0].id,'other',
   'unknown future admission condition stays visible rather than being dropped');
}
console.log('PASS TWICE: 11 independently required FL records, four concise explanations, no permission or UI bypass');
