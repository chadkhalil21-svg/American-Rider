'use strict';
const assert=require('node:assert/strict');
const {catalog, validateProposal, proposeMarket, listPlans, PLAN_COLLECTION}=require('./market-expansion');
const data=catalog();
assert.equal(data.jurisdictions.length,56);
assert.ok(data.jurisdictions.some(x=>x.code==='FL'));
assert.ok(data.jurisdictions.some(x=>x.code==='CA'));
const miami=data.counties.find(m=>m.id==='fl-miami-dade');
assert.ok(miami && miami.configured && miami.state==='FL');
const floridaCounties=data.counties.filter(m=>m.state==='FL');
assert.ok(floridaCounties.length>3, 'all imported counties appear, not just the 3 operational counties');
const another=floridaCounties.find(m=>!m.configured);
assert.ok(another, 'noncommissioned Florida county is selectable as expansion intention');
assert.equal(validateProposal({stateCode:'FL',marketId:another.id}).ok,true);
assert.equal(validateProposal({stateCode:'TX'}).ok,true,'other states may be proposed without inferred authority');
assert.equal(validateProposal({stateCode:'TX',marketId:another.id}).code,'county_not_in_catalog');
assert.equal(validateProposal({stateCode:'TX',city:'Austin'}).code,'county_required_for_city');
assert.equal(validateProposal({stateCode:'XX'}).code,'unknown_jurisdiction');
assert.equal(validateProposal({stateCode:'FL',marketId:'fake-county'}).ok,false);
assert.equal(validateProposal({stateCode:'FL',marketId:another.id,city:'<script>'}).ok,false);
const p=validateProposal({stateCode:'FL',marketId:another.id,city:'Tampa'}).plan;
assert.equal(p.status,'proposed');
assert.equal(p.commercialAuthority,false);
assert.equal(p.onboardingAuthority,false);
const records=new Map(),audits=[];
const db={
 collection(name){return {doc(id){return {name,id:id||'audit-'+(audits.length+1)};},
   async get(){return {docs:[...records.entries()].filter(([key])=>key.startsWith(name+'/')).map(([key,v])=>({id:key.split('/')[1],data:()=>v}))};},
   limit(n){return this;},
 };},
 async runTransaction(fn){const changes=[];
   const tx={
     get:async ref=>({exists:records.has(ref.name+'/'+ref.id),
       data:()=>records.get(ref.name+'/'+ref.id)}),
     set:(ref,v)=>changes.push(()=>records.set(ref.name+'/'+ref.id,v)),
     create:(ref,v)=>changes.push(()=>audits.push(v)),
   };
   const result=await fn(tx);
   changes.forEach(x=>x());
   return result;
 }
};
(async()=>{
 assert.equal((await proposeMarket({db,actor:'',input:{stateCode:'FL',marketId:another.id}})).ok,false);
 assert.equal((await proposeMarket({db,actor:'founder',input:{stateCode:'XX'}})).ok,false);
 assert.equal((await proposeMarket({db,actor:'founder',input:{stateCode:'FL',marketId:another.id},now:12345})).ok,true);
 assert.equal((await proposeMarket({db,actor:'founder',input:{stateCode:'FL',marketId:another.id,city:'Tampa'},now:12346})).ok,true);
 assert.equal(records.size,1,'a re-proposed county is the same stable planning record');
 assert.equal(records.get(PLAN_COLLECTION+'/'+another.id).status,'proposed');
 assert.equal(records.has('market_admission/'+another.id),false,'planning never touches commercial admission');
 assert.equal(audits.length,2);
 assert.equal((await listPlans(db)).plans.length,1);
 console.log('PASS national market planning: 56 jurisdictions, all imported counties, one proposal per region, no travel authority');
})().catch(e=>{console.error(e);process.exitCode=1;});
