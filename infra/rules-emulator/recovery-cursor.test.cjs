'use strict';
// REAL Firestore emulator + backend Admin SDK; no real Firebase, Stripe,
// customers, payouts or paid travel. Runs after existing Firestore rule suite.
const assert=require('node:assert/strict');
const admin=require('../../backend/node_modules/firebase-admin');
// The Admin SDK loaded below exposes Firestore through admin.firestore().
const {sweepBookingRecovery,PREPARED_TTL_MS,BATCH_LIMIT}=
  require('../../backend/bookingrecovery');
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Firestore emulator is required');
if(!admin.apps.length)admin.initializeApp({projectId:'demo-american-rider'});
const db=admin.firestore();
const now=Date.now();
async function main(){
  const batch=db.batch();
  for(let i=0;i<250;i++){
    batch.set(db.collection('rides').doc('cursor_recent_'+String(i).padStart(4,'0')),{
      travelerUid:'synthetic',status:'awaiting_payment',createdAt:now-60_000,
    });
  }
  batch.set(db.collection('rides').doc('zz_cursor_due'),{
    travelerUid:'synthetic',status:'awaiting_payment',createdAt:now-PREPARED_TTL_MS-1,
  });
  await batch.commit();
  const deps={
    verifiedTravelPayment:async()=>{throw Error('No provider charge expected')},
    refundableFor:async()=>{throw Error('No provider refund expected')},
    refundTravel:async()=>{throw Error('No provider refund expected')},
    operatorPayoutAccount:async()=>({accountId:null}),
  };
  for(let tick=0;tick<3;tick++){
    const out=await sweepBookingRecovery({db,deps,stripeConfigured:false,now:now+tick*1000});
    assert.equal(out.ok,true,JSON.stringify(out.errors));
    assert.ok(out.scanned<=BATCH_LIMIT*3);
  }
  const due=await db.collection('rides').doc('zz_cursor_due').get();
  assert.equal(due.data().status,'cancelled','later Travel must be reached');
  const check=await db.collection('recovery_cursors').doc('booking_recovery').get();
  assert.equal(check.exists,true);
  assert.equal(check.data().preparedAfterId,null);
  // Validate the second equality+documentId query shape against the emulator,
  // not a permissive in-memory fake or an assumed index.
  const refundQuery=await db.collection('rides').where('refundPending','==',true)
    .where('status','==','cancelled').orderBy('__name__').limit(1).get();
  assert.equal(refundQuery.empty,true);
  console.log('PASS Firestore REAL EMULATOR: 251-doc paginated recovery, durable checkpoint, wrap and refund query; zero provider calls');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.terminate());
