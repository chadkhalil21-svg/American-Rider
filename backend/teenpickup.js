// Mandatory pickup verification for Family / Teen Travel.
const crypto=require('node:crypto');
const {adminDb,adminStatus}=require('./firebase-admin');
const digest=(rideId,pin)=>crypto.createHash('sha256').update(String(rideId)+':'+String(pin)).digest('hex');
const makePin=()=>String(crypto.randomInt(0,10000)).padStart(4,'0');
async function provisionTeenPin({rideRef,rideId,party,now=Date.now()}){
 if(party?.teen!==true)return {ok:true,required:false};
 const pin=makePin(); await rideRef.set({teenPickup:{required:true,hash:digest(rideId,pin),verifiedAt:null,failedAttempts:0,createdAt:now}},{merge:true});
 return {ok:true,required:true,pin};
}
async function verifyTeenPin({rideId,operatorUid,pin,now=Date.now()}){
 const db=adminDb();if(!db)return {ok:false,status:503,error:adminStatus().reason};
 const ref=db.collection('rides').doc(String(rideId));
 return db.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists)return {ok:false,status:404,error:'No such Travel'};const r=s.data()||{};
  if(String(r.operatorId)!==String(operatorUid))return {ok:false,status:403,error:'That Travel is not assigned to this Operator'};
  if(r.party?.teen!==true)return {ok:true,status:200,required:false};
  if(!['accepted','arrived'].includes(String(r.status)))return {ok:false,status:409,error:'Pickup verification is not available in this Travel state'};
  if(r.teenPickup?.verifiedAt)return {ok:true,status:200,required:true,verified:true};
  if(!/^\d{4}$/.test(String(pin||''))||digest(rideId,pin)!==r.teenPickup?.hash){tx.set(ref,{teenPickup:{...r.teenPickup,failedAttempts:Number(r.teenPickup?.failedAttempts||0)+1,lastFailedAt:now}},{merge:true});return {ok:false,status:403,error:'The pickup code is not correct',code:'teen_pin_invalid'};}
  tx.set(ref,{teenPickup:{...r.teenPickup,verifiedAt:now,verifiedBy:String(operatorUid)}},{merge:true});return {ok:true,status:200,required:true,verified:true};
 });
}
function teenMayBoard(ride){return ride?.party?.teen!==true||!!ride?.teenPickup?.verifiedAt;}
module.exports={provisionTeenPin,verifyTeenPin,teenMayBoard};
