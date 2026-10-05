const assert=require('node:assert/strict');
const path=require('node:path');
const rows={
 g1:{party:{teen:true,guardianUid:'guardian',teenUid:'teen'},travelerUid:'guardian',status:'assigned',createdAt:200,tripNo:'AR-G'},
 t1:{party:{teen:true,guardianUid:'guardian',teenUid:'teen'},travelerUid:'teen',status:'arrived',createdAt:100,tripNo:'AR-T'},
 old:{party:{teen:true,guardianUid:'guardian',teenUid:'teen'},travelerUid:'teen',status:'completed',createdAt:300},
 other:{party:{teen:true,guardianUid:'stranger',teenUid:'teen'},travelerUid:'teen',status:'assigned',createdAt:400},
};
const db={collection:(name)=>({where:(field,op,val)=>{
 const tests=[[field,op,val]];
 const chain={where:(f,o,v)=>{tests.push([f,o,v]);return chain;},limit:(n)=>({get:async()=>({docs:Object.entries(rows).filter(([,r])=>tests.every(([f,operator,value])=>{
  const got=f.split('.').reduce((a,k)=>a?.[k],r);return operator==='in'?value.includes(got):got===value;
 })).slice(0,n).map(([id,r])=>({id,data:()=>r}))})})};
 return chain;
}})};
const p=require.resolve(path.join(__dirname,'firebase-admin.js'));
require.cache[p]={id:p,filename:p,loaded:true,exports:{adminDb:()=>db,adminStatus:()=>({reason:'unavailable'})},children:[],paths:[]};
const {listGuardianActiveTravels}=require('./family');
(async()=>{
 const out=await listGuardianActiveTravels({guardianUid:'guardian'});
 assert.equal(out.ok,true);assert.deepEqual(out.travels.map((r)=>r.tripNo),['AR-G','AR-T']);
 assert.equal(out.travels[0].travelerUid,'guardian');
 console.log('PASS Guardian sees both Guardian-booked and Teen-booked active Travel, never other families or completed rides');
})().catch(e=>{console.error(e);process.exitCode=1;});
