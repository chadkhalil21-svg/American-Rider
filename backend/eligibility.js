// May this operator take travel NOW? One answer, read from server records only.
//
// WHY THIS FILE EXISTS. Every gate was checked when an operator went on duty
// (POST /operator/online) and again, from the fleet record, when dispatch chose them
// (matching.js). Nothing checked anything when they ACCEPTED: the phone wrote
// `status: 'accepted'` straight to Firestore. An offer made at 10:00 could be accepted at
// 10:01 by an operator whose disclosure version, approval, documents, insurance or screening
// had stopped standing at 10:00:30. POST /travel/accept now calls this inside the same
// transaction that commits the acceptance.
//
// READS ONLY WHAT THE SERVER WROTE. `user` is users/{uid} (Firestore rules let the app write
// only its profile and push fields there); `fleet` is operators/{uid} (no client writes at
// all). Nothing the phone says about itself is consulted.
//
// Two checks need a network call and live in the route instead: the Firebase account is not
// disabled, and Stripe still says payouts are enabled.
const { disclosureCurrent } = require('./disclosure');
const { commissionCurrent, documentsStatus } = require('./commissioning');
const { coverageLapsed } = require('./matching');
const { screeningCurrent } = require('./screening');

/**
 * @param fleet       operators/{uid}, or null
 * @param user        users/{uid}, or null
 * @param liveMoney   true when the Stripe key is live — the same line /operator/online draws
 *                    for screening: required once a stranger can get into the car
 * @returns { ok: true } | { ok: false, code, reason }
 */
function operatorEligibility({ fleet, user, liveMoney = false, now = Date.now() }) {
  const no = (code, reason) => ({ ok: false, code, reason });
  if (!user) return no('no_account', 'This account has no operator record.');
  if (!fleet || fleet.available !== true) {
    return no('not_on_duty', 'You are not in service. Commence operations to accept travel.');
  }
  if (!disclosureCurrent(user.insuranceDisclosure)) {
    return no('disclosure_required', 'The insurance disclosure has changed. Read the current one before accepting travel.');
  }
  if (!commissionCurrent(user.commission)) {
    return no('not_commissioned', 'Your qualification is not approved.');
  }
  if (fleet.documentBlocked || !documentsStatus(user.documents, now).accepted) {
    return no('documents_required', 'A document on file is not accepted or has expired.');
  }
  if (coverageLapsed(fleet)) {
    return no('coverage_expired', 'Your commercial coverage has expired.');
  }
  if (fleet.screeningBlocked) {
    return no('screening_blocked', fleet.screeningReason || 'Your background screening does not permit travel.');
  }
  if (liveMoney && !screeningCurrent(user.screening, now)) {
    return no('not_screened', 'A current background screening is required before you can accept travel.');
  }
  // Written by the Stripe webhook (account.updated). Only an explicit false blocks here; the
  // route asks Stripe directly as well.
  if (fleet.payoutsEnabled === false) {
    return no('payouts_not_ready', 'Stripe has restricted payouts on this account.');
  }
  return { ok: true };
}

/**
 * The acceptance itself: one transaction that re-reads the travel, the fleet record and the
 * account record, decides, and writes. `refusal` carries the result of the network checks the
 * route ran first (account disabled, Stripe payouts), or null.
 *
 * Returns { status, body } for the route to send.
 */
async function acceptOffer({ db, uid, rideId, refusal = null, liveMoney = false, now = () => Date.now() }) {
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
    const verdict = refusal
      ? { ok: false, ...refusal }
      : operatorEligibility({
          fleet: opSnap.exists ? opSnap.data() : null,
          user: userSnap.exists ? userSnap.data() : null,
          liveMoney,
          now: at,
        });
    if (!verdict.ok) {
      // Released for somebody else (monitor.js sweepAssignments reads releasedAt), and the
      // operator is out of service until /operator/online lets them back.
      tx.update(rideRef, { releasedAt: at, releasedReason: verdict.code, statusAt: at });
      if (opSnap.exists) tx.set(opRef, { available: false, offDutyReason: verdict.code, offDutyAt: at }, { merge: true });
      return { status: 409, body: { error: verdict.reason, code: verdict.code, released: true } };
    }
    tx.update(rideRef, { status: 'accepted', acceptedAt: at, statusAt: at });
    return { status: 200, body: { ok: true, acceptedAt: at } };
  });
}

module.exports = { operatorEligibility, acceptOffer };
