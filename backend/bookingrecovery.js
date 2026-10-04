const { cancelTravel } = require('./travelmoney');
const { paymentMatches } = require('./booking');

const PREPARED_TTL_MS = 15 * 60 * 1000;
const PAID_UNMATCHED_TTL_MS = 2 * 60 * 1000;
const BATCH_LIMIT = 100;

/**
 * Every confirmed charge without a served Travel needs either an Operator or an owed refund.
 * Operates only on server-held owner ids; no phone or caller may choose the payment to refund.
 * A failed provider action remains refundPending and is retried on a later leased sweep.
 */
async function sweepBookingRecovery({ db, deps, stripeConfigured, now = Date.now() }) {
  if (!db) return { ok: false, reason: 'Firestore unavailable' };
  const out = { ok: true, scanned: 0, closed: [], pending: [], errors: [], overCapacity: false };
  const groups = [
    { field: 'status', value: 'awaiting_payment', ttl: PREPARED_TTL_MS },
    { field: 'status', value: 'awaiting_assignment', ttl: PAID_UNMATCHED_TTL_MS },
    { field: 'refundPending', value: true, ttl: 0 },
  ];
  for (const group of groups) {
    let snap;
    try { snap = await db.collection('rides').where(group.field, '==', group.value).limit(BATCH_LIMIT).get(); }
    catch (e) { out.ok = false; out.errors.push(String(e.message || e)); continue; }
    if (snap.docs.length >= BATCH_LIMIT) out.overCapacity = true;
    out.scanned += snap.docs.length;
    for (const doc of snap.docs) {
      let ride = doc.data() || {};
      if (group.field === 'refundPending' && ride.status !== 'cancelled') continue;
      if (ride.reservationId && !ride.paymentIntentId) {
        try {
          const reservation = await db.collection('scheduled_rides').doc(String(ride.reservationId)).get();
          const piId = reservation.exists ? reservation.data().paymentIntentId : null;
          if (piId) {
            const pi = await deps.verifiedTravelPayment(piId);
            if (!paymentMatches({ ...ride, paymentIntentId: piId }, pi, ride.travelerUid, doc.id)) {
              out.ok = false; out.pending.push(doc.id);
              out.errors.push(`${doc.id}: scheduled payment ownership/amount unavailable`);
              continue;
            }
            await db.collection('rides').doc(doc.id).set({ paymentIntentId: piId, paidAt: now }, { merge: true });
            ride = { ...ride, paymentIntentId: piId, paidAt: now };
          }
        } catch (e) {
          out.ok = false; out.pending.push(doc.id);
          out.errors.push(`${doc.id}: scheduled payment reconciliation: ${String(e.message || e)}`);
          continue;
        }
      }
      const ttl = group.value === 'awaiting_payment' && ride.paidAt ? PAID_UNMATCHED_TTL_MS : group.ttl;
      if (ttl && now - Number(ride.paidAt || ride.createdAt || now) < ttl) continue;
      try {
        const result = await cancelTravel({ db, uid: ride.travelerUid, rideId: doc.id,
          deps, stripeConfigured, now });
        if (result.status === 200 && !result.body.pending) out.closed.push(doc.id);
        else if (result.status === 202 || result.body.pending) out.pending.push(doc.id);
        else { out.ok = false; out.errors.push(`${doc.id}: ${result.body.code || result.body.error}`); }
      } catch (e) { out.ok = false; out.errors.push(`${doc.id}: ${String(e.message || e)}`); }
    }
  }
  return out;
}

module.exports = { sweepBookingRecovery, PREPARED_TTL_MS, PAID_UNMATCHED_TTL_MS, BATCH_LIMIT };
