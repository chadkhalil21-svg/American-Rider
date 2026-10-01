// Operational shutdown for an account before its Firebase login is deleted.
//
// This does not decide how long statutory, payment, safety, or qualification records remain.
// It stops future work: an Operator leaves the fleet and scheduled Travel is cancelled. A
// current Travel blocks closure because removing either party during Travel would break the
// safety, communication, payment, and settlement paths.

const ACTIVE_STATUSES = new Set(['assigned', 'accepted', 'arrived', 'onboard']);

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

  const fenceRef = db.collection('account_operation_fences').doc(uid);
  await fenceRef.set({ closing:true, startedAt:now }, { merge:true });
  try {
  const scheduled = await recordsFor(db, 'scheduled_rides', 'travelerUid', uid);
  let cancelledScheduled = 0;
  for (const d of scheduled) {
    const outcome = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(d.ref);
      if (!fresh.exists) return 'gone';
      const r = fresh.data() || {};
      if (r.status === 'cancelled') return 'already_cancelled';
      if (r.status !== 'reserved' || Number(r.claimedAt) > 0) return 'in_flight';
      tx.update(d.ref, { status:'cancelled', cancelledAt:now, closedReason:'Account closed.', claimedAt:null });
      return 'cancelled';
    });
    if (outcome === 'in_flight') return { ok:false, code:'scheduled_travel_in_progress' };
    if (outcome === 'cancelled') cancelledScheduled++;
  }
  await db.collection('operators').doc(uid).set(
    { available: false, offlineAt: now, lat: null, lng: null },
    { merge: true },
  );
  // Durable server-side closure state makes retries/crash recovery observable. Client-local
  // markers can disappear on reinstall or storage cleanup; this record survives both and is
  // written only after future operational work has been shut down.
  await db.collection('account_closures').doc(uid).set(
    { operationallyClosed: true, closedAt: now, cancelledScheduled },
    { merge: true },
  );
  return { ok: true, operationallyClosed: true, cancelledScheduled };
  } finally {
    await fenceRef.delete().catch(() => {});
  }
}

module.exports = { ACTIVE_STATUSES, closeOperationalAccount };