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

  const scheduled = await recordsFor(db, 'scheduled_rides', 'travelerUid', uid);
  // Do not use one Firestore batch: an account can accumulate more than the 500-operation
  // batch limit over time. If any delete fails, the endpoint fails and the login remains.
  await Promise.all(scheduled.map((d) => d.ref.delete()));
  await db.collection('operators').doc(uid).set(
    { available: false, offlineAt: now, lat: null, lng: null },
    { merge: true },
  );
  return { ok: true, cancelledScheduled: scheduled.length };
}

module.exports = { ACTIVE_STATUSES, closeOperationalAccount };