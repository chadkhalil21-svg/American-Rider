// Operational shutdown for an account before its Firebase login is deleted.
//
// This does not decide how long statutory, payment, safety, or qualification records remain.
// It stops future work: an Operator leaves the fleet and scheduled Travel is cancelled. A
// current Travel blocks closure because removing either party during Travel would break the
// safety, communication, payment, and settlement paths.

const ACTIVE_STATUSES = new Set(['awaiting_payment', 'awaiting_assignment', 'assigned', 'accepted', 'arrived', 'onboard']);

async function recordsFor(db, collection, field, uid) {
  const snap = await db.collection(collection).where(field, '==', uid).get();
  return snap.docs || [];
}

async function closeOperationalAccount({ db, uid, now = Date.now() }) {
  if (!db) return { ok: false, code: 'database_unavailable' };
  if (!uid) return { ok: false, code: 'account_required' };

  const [travelerRides, operatorRides] = await Promise.all([
    recordsFor(db, 'rides', 'travelerUid', uid),
    recordsFor(db, 'rides', 'operatorId', uid),
  ]);
  const active = [...travelerRides, ...operatorRides].filter((d) =>
    ACTIVE_STATUSES.has(String(d.data()?.status || '')),
  );
  if (active.length) return { ok: false, code: 'active_travel' };

  const scheduled = await recordsFor(db, 'scheduled_rides', 'travelerUid', uid);
  // A dispatching reservation can already have started an off-session Stripe charge. Do not
  // erase the only recovery pointer and then delete the owner's login.
  if(scheduled.some((d)=>!['reserved','cancelled','payment_failed','no_operator'].includes(String(d.data()?.status||''))))
    return {ok:false,code:'active_travel'};
  // Both paid-booking and scheduled-booking transactions read this server-only document.
  // A profile can be deleted by its owner; it must NOT be the authority for a closing fence.
  // An in-flight booking either commits before this write (caught by the rescan) or retries
  // after a conflict and sees closingAt. Operator assignment reads the offline fleet record.
  const fenced=await db.runTransaction(async(tx)=>{
    const fenceRef=db.collection('account_closures').doc(uid),opRef=db.collection('operators').doc(uid);
    const prior=await tx.get(fenceRef);
    if(prior.exists&&['deleting','auth_deleted'].includes(String(prior.data()?.state)))return false;
    const op=await tx.get(opRef);
    if(op.exists&&op.data()?.currentRideId)return false;
    tx.set(fenceRef,{closingAt:now,state:'closing',nextCheckAt:now+60_000},{merge:true});
    tx.set(opRef,{available:false,offlineAt:now,lat:null,lng:null},{merge:true});
    return true;
  });
  if(!fenced)return {ok:false,code:'active_travel'};
  const afterFence=await Promise.all([
    recordsFor(db,'rides','travelerUid',uid),recordsFor(db,'rides','operatorId',uid),
  ]);
  if(afterFence.flat().some((d)=>ACTIVE_STATUSES.has(String(d.data()?.status||''))))
    return {ok:false,code:'active_travel'};
  let cancelledScheduled=0;
  // Serialize cancellation with the scheduler's reserved→dispatching claim. Even if the
  // reservation advanced after the scan above, the transaction refuses to delete it.
  for(const d of scheduled){
    if(d.data()?.status!=='reserved')continue;
    const removed=await db.runTransaction(async(tx)=>{
      const snap=await tx.get(d.ref);
      if(!snap.exists)return false;
      if(snap.data()?.status!=='reserved')return 'advanced';
      tx.delete(d.ref);return true;
    });
    if(removed==='advanced')return {ok:false,code:'active_travel'};
    if(removed)cancelledScheduled++;
  }
  // Marketing interest has no trip or accounting retention purpose; closing the account
  // also withdraws the voluntary county/coarse-area waitlist record.
  await db.collection('waitlist').doc(uid).delete();
  return { ok: true, cancelledScheduled };
}

module.exports = { ACTIVE_STATUSES, closeOperationalAccount };
