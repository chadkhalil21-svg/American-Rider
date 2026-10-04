const assert=require('node:assert/strict');
const path=require('node:path');
const seed={family_links:{link1:{guardianUid:'guardian',teenUid:'teen',status:'active'}},
 scheduled_rides:{reserved:{status:'reserved',party:{familyLinkId:'link1'}},
 dispatching:{status:'dispatching',claimedAt:100,claimNonce:'ongoing',party:{familyLinkId:'link1'}},
 dispatched:{status:'dispatched',party:{familyLinkId:'link1'}}}};
const ref=(col,id)=>({__col:col,__id:id,id,
 async get(){return {exists:!!seed[col]?.[id],data:()=>structuredClone(seed[col][id])};},
 async set(fields,{merge}={}){seed[col][id]=merge?{...seed[col][id],...fields}:fields;},
 async update(fields){Object.assign(seed[col][id],fields);}});
const db={collection(col){return {doc(id){return ref(col,id);},
 where(field,op,value){const filters=[[field,value]];
  const q={where(f,_o,v){filters.push([f,v]);return q;},
   limit(n){return {get:async()=>({docs:Object.entries(seed[col]||{}).filter(([,r])=>
    filters.every(([f,v])=>f.split('.').reduce((x,k)=>x?.[k],r)===v)).slice(0,n)
    .map(([id])=>({id,ref:ref(col,id),data:()=>structuredClone(seed[col][id])}))})};}};
  return q;}};},
 async runTransaction(fn){return fn({get:r=>r.get(),update:(r,fields)=>r.update(fields),
  set:(r,fields,opts)=>r.set(fields,opts)});}};
const adminPath=require.resolve(path.join(__dirname,'firebase-admin.js'));
const old=require.cache[adminPath];
require.cache[adminPath]={id:adminPath,filename:adminPath,loaded:true,
 exports:{adminDb:()=>db,adminStatus:()=>({reason:null})}};
const familyPath=require.resolve(path.join(__dirname,'family.js'));
delete require.cache[familyPath];
(async()=>{
 try{
  const {revokeFamilyLink}=require('./family');
  const out=await revokeFamilyLink({id:'link1',guardianUid:'guardian',now:200});
  assert.equal(out.ok,true);
  assert.equal(out.cancelledScheduledTravels,1);
  assert.equal(out.pendingScheduledTravels,1);
  assert.equal(seed.family_links.link1.status,'revoked');
  assert.equal(seed.scheduled_rides.reserved.status,'cancelled');
  assert.equal(seed.scheduled_rides.dispatching.status,'dispatching');
  assert.equal(seed.scheduled_rides.dispatching.cancelRequestedAt,200);
  assert.equal(seed.scheduled_rides.dispatched.status,'dispatched');
  console.log('PASS Guardian revocation cancels reserved and flags in-progress Teen payment; already assigned requires separate safety handling');
 }finally{
  if(old)require.cache[adminPath]=old;else delete require.cache[adminPath];
  delete require.cache[familyPath];
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
