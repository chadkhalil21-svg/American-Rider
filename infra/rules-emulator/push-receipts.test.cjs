'use strict';
// Genuine local Firestore emulator query/transaction test for Expo receipt state.
// Does not send actual notifications or access customer data/provider credentials.
const assert=require('node:assert/strict');
const path=require('node:path');
const {createRequire}=require('node:module');
const backendRequire=createRequire(path.join(__dirname,'../../backend/package.json'));
const {initializeApp,getApps}=backendRequire('firebase-admin/app');
const {getFirestore}=backendRequire('firebase-admin/firestore');
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Firestore emulator is mandatory');
if(!getApps().length)initializeApp({projectId:'demo-american-rider'});
const db=getFirestore();
const {recordAcceptedTicket,sweepPushReceipts,FIRST_CHECK_MS}=backendRequire('./pushreceipts');
const NOW=Date.parse('2026-10-12T18:00:00Z');
function accepted(id,uid,now=NOW){return recordAcceptedTicket({
 db,uid,kind:'check_in',ticketId:id,token:'ExpoPushToken[emulator-'+uid+']',now,
});}
async function main(){
 const ids=Array.from({length:205},(_,i)=>'receipt-emulator-'+String(i).padStart(5,'0'));
 for(let i=0;i<ids.length;i++){
  const r=await accepted(ids[i],'synthetic-user-'+i);
  assert.equal(r.ok,true);
 }
 const results={calls:0,requested:[]};
 const fetchFn=async(_url,request)=>{
  const requested=JSON.parse(request.body).ids;
  assert.ok(requested.length<=100);
  results.calls++;
  results.requested.push(...requested);
  return {ok:true,status:200,json:async()=>({data:Object.fromEntries(
   requested.map(id=>[id,{status:'ok'}]))})};
 };
 for(let i=0;i<4;i++){
  const r=await sweepPushReceipts({db,now:NOW+FIRST_CHECK_MS,fetchFn});
  assert.equal(r.ok,true,JSON.stringify(r));
  if(i===0||i===1)assert.equal(r.providerAccepted,100);
  if(i===2)assert.equal(r.providerAccepted,5);
  if(i===3)assert.equal(r.providerAccepted,0);
 }
 assert.equal(results.calls,3,'bounded single POST per due batch');
 assert.equal(new Set(results.requested).size,205,'all 205 unique tickets reconciled');
 const later=await sweepPushReceipts({db,now:NOW+FIRST_CHECK_MS+60_000,fetchFn});
 assert.equal(later.scanned,0,'terminal documents cannot starve newer due items');
 // Verify a real Firestore transaction refuses late destruction of rotated token.
 const user=db.collection('users').doc('synthetic-token-rotation-emulator');
 await user.set({pushToken:'ExpoPushToken[emulator-old]'}, {merge:true});
 const test=await recordAcceptedTicket({db,uid:user.id,kind:'check_in',
  token:'ExpoPushToken[emulator-old]',ticketId:'receipt-emulator-rotation',now:NOW});
 assert.equal(test.ok,true);
 await user.set({pushToken:'ExpoPushToken[emulator-new]'},{merge:true});
 const out=await sweepPushReceipts({db,now:NOW+FIRST_CHECK_MS,fetchFn:async()=>({
  ok:true,status:200,json:async()=>({data:{
   'receipt-emulator-rotation':{status:'error',details:{error:'DeviceNotRegistered'}}
  }})
 })});
 assert.equal(out.providerRejected,1);
 const fresh=await user.get();
 assert.equal(fresh.data().pushToken,'ExpoPushToken[emulator-new]');
 console.log('PASS REAL Firestore emulator: 205 due receipt docs in 100+100+5 batches, no starvation, 1 rotated token protected, zero provider calls with empty queue');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.terminate());
