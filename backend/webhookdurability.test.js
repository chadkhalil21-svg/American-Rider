const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = __dirname;
const ride = { travelerUid: 'u1', travelerEmail: 'a@example.com', paymentIntentId: 'pi_one',
  status: 'completed', tripNo: 'AR-1', dep: 'A', dest: 'B', operatorName: 'Operator' };
const fleet = { available: true };
let failRead = false, failRideWrite = false, failFleetWrite = false, stored = false, emailed = false;
const caseKeys = [];
const db = { collection(name) {
  return {
    where(field,op,value) {
      return { limit(size) { assert.equal(size,2); return { async get() {
        if (failRead) throw new Error('database query unavailable');
        if (name === 'rides' && field === 'paymentIntentId' && value === 'pi_one')
          return { docs: [{ id: 'r1', data: () => ({ ...ride }) }] };
        return { docs: [] };
      } }; } };
    },
    doc(id) { return { async set(patch) {
      if (name === 'rides') { if (failRideWrite) throw new Error('ride write unavailable'); Object.assign(ride,patch); }
      if (name === 'operators') { assert.equal(id,'op1'); if (failFleetWrite) throw new Error('fleet write unavailable'); Object.assign(fleet,patch); }
    } }; },
  };
} };
for (const [name,stub] of [
  ['firebase-admin.js',{adminDb:()=>db,adminStatus:()=>({ok:true})}],
  ['tickets.js',{fileTicket:async(opts)=>{caseKeys.push(opts.idempotencyKey);return {stored,emailed,caseNo:'AR-C-STABLE'};}}],
]) {
  const file=require.resolve(path.join(ROOT,name));
  require.cache[file]={id:file,filename:file,loaded:true,exports:stub,children:[],paths:[]};
}
const { handleEvent } = require('./webhook');
const dispute = { id:'evt_dispute_1', type:'charge.dispute.created', data:{object:{
  id:'dp_1', payment_intent:'pi_one', amount:2720, reason:'fraudulent',evidence_details:{due_by:2000000000},
}}};
(async()=>{
  await assert.rejects(()=>handleEvent(dispute),/not stored and alerted/);
  assert.equal(ride.disputed,undefined,'a failed case never pretends to secure the dispute');
  stored=true;
  await assert.rejects(()=>handleEvent(dispute),/not stored and alerted/);
  emailed=true;
  failRideWrite=true;
  await assert.rejects(()=>handleEvent(dispute),/ride write unavailable/);
  failRideWrite=false;
  const result=await handleEvent(dispute);
  assert.equal(result.ok,true);assert.equal(ride.disputed,true);assert.equal(ride.caseNo,'AR-C-STABLE');
  assert.equal(new Set(caseKeys).size,1,'the case key is stable across provider retries');
  failRead=true;
  await assert.rejects(()=>handleEvent(dispute),/database query unavailable/);
  failRead=false;
  const restricted={id:'evt_account_1',type:'account.updated',data:{object:{id:'acct_1',metadata:{uid:'op1'},payouts_enabled:false,charges_enabled:false}}};
  failFleetWrite=true;
  await assert.rejects(()=>handleEvent(restricted),/fleet write unavailable/);
  failFleetWrite=false;
  assert.equal((await handleEvent(restricted)).ok,true);
  assert.equal(fleet.available,false,'a restriction is not acknowledged before Operator availability is revoked');
  console.log('PASS Stripe dispute alerts and account restriction retry until durable state; no duplicate case key');
})().catch((e)=>{console.error(e);process.exitCode=1;});
