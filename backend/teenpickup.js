// Mandatory pickup verification for Family / Teen Travel.
const crypto=require('node:crypto');
const {adminDb,adminStatus}=require('./firebase-admin');
const digest=(rideId,pin)=>crypto.createHash('sha256').update(String(rideId)+':'+String(pin)).digest('hex');
const makePin=()=>String(crypto.randomInt(0,10000)).padStart(4,'0');
const sealKey=()=>{
 const raw=String(process.env.TEEN_PIN_SEAL_KEY||'');
 if(!raw)return null;
 return crypto.createHash('sha256').update(raw).digest();
};
const seal=(rideId,pin)=>{
 const key=sealKey(); if(!key)return null;
 const iv=crypto.randomBytes(12), cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from(String(rideId)));
 const ciphertext=Buffer.concat([cipher.update(String(pin),'utf8'),cipher.final()]);
 return {v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};
};
const unseal=(rideId,box)=>{
 try{
  const key=sealKey(); if(!key||box?.v!==1)return null;
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(box.iv,'base64'));
  decipher.setAAD(Buffer.from(String(rideId))); decipher.setAuthTag(Buffer.from(box.tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(box.ciphertext,'base64')),decipher.final()]).toString('utf8');
 }catch{return null;}
};
async function provisionTeenPin({rideRef,rideId,party,now=Date.now()}){
 if(party?.teen!==true)return {ok:true,required:false};
 const existing=await rideRef.get();
 const current=existing.exists?(existing.data()?.teenPickup||null):null;
 if(current?.sealedPin){
  const recovered=unseal(rideId,current.sealedPin);
  if(recovered&&/^\d{4}$/.test(recovered))return {ok:true,required:true,pin:recovered,recovered:true};
 }
 const pin=makePin(),sealedPin=seal(rideId,pin);
 if(!sealedPin)return {ok:false,required:true,error:'Teen pickup code recovery is not configured'};
 await rideRef.set({teenPickup:{required:true,hash:digest(rideId,pin),sealedPin,verifiedAt:null,failedAttempts:0,createdAt:now}},{merge:true});
 return {ok:true,required:true,pin,recovered:false};
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
