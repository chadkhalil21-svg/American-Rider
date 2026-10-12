'use strict';
// Offline production-module test: no Expo account, Firestore bill or actual phone.
const assert=require('node:assert/strict');
const adminPath=require.resolve('./firebase-admin');
const oldAdmin=require.cache[adminPath];
const minutes=n=>n*60_000;
let failWrites=false;
const mem={users:new Map([['traveler',{pushToken:'ExpoPushToken[synthetic-old]'}],
  ['operator',{pushToken:'ExpoPushToken[synthetic-second]'}]]),
  push_receipts:new Map()};
function read(ref){
 const v=mem[ref.col]?.get(ref.id);
 return {exists:v!==undefined,id:ref.id,data:()=>structuredClone(v)};
}
function ref(col,id){
 return {
  col,id:String(id),
  get:async()=>read({col,id:String(id)}),
  async create(doc){
   if(failWrites)throw Error('synthetic quota exhausted');
   const map=mem[col];if(map.has(String(id))){const e=Error('already exists');e.code=6;throw e;}
   map.set(String(id),structuredClone(doc));
  },
  async set(doc,{merge=false}={}){
   if(failWrites)throw Error('synthetic quota exhausted');
   const map=mem[col];map.set(String(id),merge?{...map.get(String(id)),...structuredClone(doc)}:structuredClone(doc));
  },
  async delete(){mem[col].delete(String(id))},
 };
}
const db={
 collection(col){
  if(!mem[col])throw Error('unknown synthetic collection '+col);
  return {
   doc:id=>ref(col,id),
   where(field,cmp,value){
    assert.equal(cmp,'<=','bounded due-time and purge-time query only');
    const q={n:Infinity,field,value,
      orderBy(order){assert.equal(order,field);return q;},
      limit(n){q.n=n;return q;},
      async get(){
       const docs=[...mem[col].entries()].filter(([,d])=>
        Number.isFinite(d[field]) && d[field]<=value)
         .sort((a,b)=>a[1][field]-b[1][field]||a[0].localeCompare(b[0]))
         .slice(0,q.n).map(([id])=>({...ref(col,id),data:()=>structuredClone(mem[col].get(id))}));
       return {docs,size:docs.length};
      }};
    return q;
   },
  };
 },
 batch(){
  const work=[];
  return {set(doc,value,opts){work.push(()=>doc.set(value,opts));},
   delete(doc){work.push(()=>doc.delete());},
   async commit(){for(const fn of work)await fn();}};
 },
 async runTransaction(fn){
  const writes=[];
  const tx={
   get:ref=>ref.get(),
   set:(ref,value,opts)=>writes.push(()=>ref.set(value,opts)),
  };
  const result=await fn(tx);for(const write of writes)await write();return result;
 },
};
require.cache[adminPath]={id:adminPath,filename:adminPath,loaded:true,exports:{
 adminDb:()=>db,adminStatus:()=>({ok:true}),
}};
const {recordAcceptedTicket,sweepPushReceipts,FIRST_CHECK_MS,
 RECEIPT_EXPIRY_MS,MAX_PER_SWEEP}=require('./pushreceipts');
const {notify}=require('./push');
const oldFetch=global.fetch;
const NOW=Date.parse('2026-10-12T17:00:00Z');
const entries=()=>[...mem.push_receipts.values()];
function clear(){mem.push_receipts.clear();failWrites=false;
 mem.users.get('traveler').pushToken='ExpoPushToken[synthetic-old]';
 mem.users.get('operator').pushToken='ExpoPushToken[synthetic-second]';
}
async function accepted(ticketId,uid='traveler',token=null,now=NOW){
 const t=token||mem.users.get(uid).pushToken;
 return recordAcceptedTicket({db,uid,kind:'check_in',token:t,ticketId,now});
}
function providerResponse(data,status=200){
 let calls=0;
 const fn=async(url,opts)=>{
  calls++;
  assert.equal(url,'https://exp.host/--/api/v2/push/getReceipts');
  assert.ok(opts.signal instanceof AbortSignal);
  const ids=JSON.parse(opts.body).ids;
  assert.ok(ids.length>0 && ids.length<=MAX_PER_SWEEP,'bounded Expo request');
  return {ok:status===200,status,json:async()=>({data:typeof data==='function'?data(ids):data})};
 };
 fn.calls=()=>calls;return fn;
}
async function run(){
 clear();
 // Real notify sends to a fictional Expo endpoint and records a safety receipt.
 global.fetch=async(url,opts)=>{
  assert.ok(url.endsWith('/push/send'));
  assert.equal(JSON.parse(opts.body).to,'ExpoPushToken[synthetic-old]');
  return {ok:true,status:200,json:async()=>({data:{status:'ok',id:'expo-ticket-1'}})};
 };
 let result=await notify({uid:'traveler',kind:'check_in',title:'Help',
  body:'Open American Rider',data:{screen:'/emergency'}});
 assert.deepEqual(result,{ok:true,id:'expo-ticket-1'});
 assert.equal(entries().length,1);
 assert.equal(entries()[0].status,'pending');
 assert.equal(entries()[0].tokenHash.length,64);
 assert.ok(!JSON.stringify(entries()[0]).includes('ExpoPushToken['),'raw push token must not persist');
 assert.equal(entries()[0].nextAttemptAt>=NOW,true); // present clock is >= fixed scenario.
 const checkNow=entries()[0].createdAt;
 let fetchFn=providerResponse({'expo-ticket-1':{status:'ok'}});
 let sweep=await sweepPushReceipts({db,now:checkNow+FIRST_CHECK_MS-1,fetchFn});
 assert.equal(sweep.scanned,0);
 assert.equal(fetchFn.calls(),0,'do not poll before Expo 15min guidance');
 sweep=await sweepPushReceipts({db,now:checkNow+FIRST_CHECK_MS,fetchFn});
 assert.equal(sweep.providerAccepted,1);
 assert.equal(sweep.ok,true);
 assert.equal(entries()[0].status,'provider_accepted');
 assert.equal(entries()[0].providerStatus,'accepted_by_APNs_or_FCM');
 assert.ok(!JSON.stringify(entries()[0]).includes('handset_delivered'));
 sweep=await sweepPushReceipts({db,now:checkNow+FIRST_CHECK_MS+1,fetchFn});
 assert.equal(sweep.scanned,0,'terminal status no longer scanned');

 clear();
 await accepted('stale-ticket','traveler','ExpoPushToken[synthetic-old]');
 mem.users.get('traveler').pushToken='ExpoPushToken[rotated]';
 fetchFn=providerResponse({'stale-ticket':{status:'error',details:{error:'DeviceNotRegistered'}}});
 sweep=await sweepPushReceipts({db,now:NOW+FIRST_CHECK_MS,fetchFn});
 assert.equal(sweep.providerRejected,1);
 assert.equal(sweep.ok,false);
 assert.equal(mem.users.get('traveler').pushToken,'ExpoPushToken[rotated]',
  'late invalid-token receipt never erases fresh registration');

 clear();
 await accepted('current-ticket');
 fetchFn=providerResponse({'current-ticket':{status:'error',details:{error:'DeviceNotRegistered'}}});
 sweep=await sweepPushReceipts({db,now:NOW+FIRST_CHECK_MS,fetchFn});
 assert.equal(mem.users.get('traveler').pushToken,null,'invalid current token cleared');
 assert.equal(sweep.providerRejected,1);
 assert.equal(entries()[0].status,'provider_rejected');

 clear();
 await accepted('timeout-ticket');
 fetchFn=providerResponse({},503);
 sweep=await sweepPushReceipts({db,now:NOW+FIRST_CHECK_MS,fetchFn});
 assert.equal(sweep.ok,false);
 assert.equal(sweep.unverified,1);
 let row=entries()[0];
 assert.equal(row.status,'pending');
 assert.equal(row.attempts,1);
 assert.ok(row.nextAttemptAt>NOW+FIRST_CHECK_MS);
 sweep=await sweepPushReceipts({db,now:row.nextAttemptAt,fetchFn:providerResponse({})});
 assert.equal(sweep.unverified,1,'missing provider receipt cannot count as success');
 assert.equal(entries()[0].status,'pending');
 sweep=await sweepPushReceipts({db,now:NOW+RECEIPT_EXPIRY_MS+1,fetchFn:()=>{
  throw Error('expired record must not contact provider');
 }});
 assert.equal(sweep.unverified,1);
 assert.equal(entries()[0].status,'unverified_expired');
 assert.equal(entries()[0].nextAttemptAt,null);

 clear();
 // Many due records across two sweeps must not starve later receipts.
 for(let i=0;i<147;i++)await accepted('bulk-'+String(i).padStart(4,'0'));
 const one=providerResponse(ids=>Object.fromEntries(ids.map(id=>[id,{status:'ok'}])));
 sweep=await sweepPushReceipts({db,now:NOW+FIRST_CHECK_MS,fetchFn:one});
 assert.equal(sweep.providerAccepted,MAX_PER_SWEEP);
 assert.equal(entries().filter(x=>x.status==='pending').length,47);
 sweep=await sweepPushReceipts({db,now:NOW+FIRST_CHECK_MS,fetchFn:one});
 assert.equal(sweep.providerAccepted,47);
 assert.equal(entries().filter(x=>x.status==='pending').length,0);
 assert.equal(one.calls(),2);

 clear();
 await accepted('quota-ticket');
 assert.equal((await accepted('quota-ticket')).duplicate,true);
 failWrites=true;
 const failed=await accepted('quota-unpersisted');
 assert.equal(failed.ok,false,'no false tracking success on quota exhaustion');
 failWrites=false;
 // Expired audit entries removed by bounded cleanup query.
 await db.collection('push_receipts').doc(
  require('node:crypto').createHash('sha256').update('expo-receipt:quota-ticket').digest('hex')
 ).set({purgeAt:NOW-1,nextAttemptAt:null,status:'provider_accepted'},{merge:true});
 const purged=await sweepPushReceipts({db,now:NOW,fetchFn:()=>{
  throw Error('must not send no-due queries to Expo');
 }});
 assert.equal(purged.purged,1);
 console.log('PASS safety push tickets, provider receipts, quota fail-closed, token-rotation, 147-ticket bounded backlog, 24h expiry and 7-day purge; NO device receipt claimed');
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{
 global.fetch=oldFetch;
 if(oldAdmin)require.cache[adminPath]=oldAdmin;else delete require.cache[adminPath];
});
