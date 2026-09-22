// Accepting a travel: the eligibility check and the commit, in one transaction.
//
// WHY THIS FILE EXISTS. Acceptance was a Firestore write from the phone, checked against
// nothing but who the travel was offered to. An offer made at 10:00 could be accepted at 10:01
// by an operator whose disclosure, documents, insurance, screening, account or payouts had
// stopped standing at 10:00:30. POST /travel/accept calls acceptOffer, which re-reads the travel
// and both operator records and runs the SAME assessment every other gate runs
// (backend/qualification.js assessOperator, context 'accept') before it writes 'accepted'.
const { assessOperator } = require('./qualification');

/**
 * @param externals { account: { disabled }, payouts: { enabled } } — the network half, checked by
 *                  the route immediately before (Firebase Auth, Stripe).
 * Returns { status, body } for the route to send.
 */
async function acceptOffer({ db, uid, rideId, externals, liveMoney = false, now = () => Date.now() }) {
  const rideRef = db.collection('rides').doc(String(rideId));
  const opRef = db.collection('operators').doc(String(uid));
  const userRef = db.collection('users').doc(String(uid));
  return db.runTransaction(async (tx) => {
    const [rideSnap, opSnap, userSnap] = await Promise.all([tx.get(rideRef), tx.get(opRef), tx.get(userRef)]);
    if (!rideSnap.exists) return { status: 404, body: { error: 'No such travel', code: 'no_travel' } };
    const ride = rideSnap.data();
    if (String(ride.operatorId || '') !== String(uid)) {
      return { status: 409, body: { error: 'This travel is no longer offered to you.', code: 'not_offered' } };
    }
    if (ride.status !== 'assigned') {
      return { status: 409, body: { error: 'This travel is no longer open.', code: 'not_open' } };
    }
    const at = now();
    const a = assessOperator({
      user: userSnap.exists ? userSnap.data() : null,
      fleet: opSnap.exists ? opSnap.data() : null,
      context: 'accept',
      liveMoney,
      account: externals?.account,
      payouts: externals?.payouts,
      now: at,
    });
    if (!a.eligible) {
      const first = a.blockers[0];
      // Released for somebody else (monitor.js sweepAssignments reads releasedAt), and the
      // operator is out of service until /operator/online lets them back.
      tx.update(rideRef, { releasedAt: at, releasedReason: first.code, statusAt: at });
      if (opSnap.exists) tx.set(opRef, { available: false, offDutyReason: first.code, offDutyAt: at }, { merge: true });
      return { status: 409, body: { error: first.reason, code: first.code, released: true } };
    }
    tx.update(rideRef, { status: 'accepted', acceptedAt: at, statusAt: at });
    return { status: 200, body: { ok: true, acceptedAt: at } };
  });
}

module.exports = { acceptOffer };
