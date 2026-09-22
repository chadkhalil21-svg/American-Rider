// Money on a travel: paying for it, cancelling it, settling it — each decided from the travel
// RECORD, never from what a client names.
//
// WHY THIS FILE EXISTS (independent audit of e26adcb, 22 Sept 2026). Three routes let the
// request choose the authoritative object:
//   /travel/cancel         refunded req.body.paymentIntentId. A traveler owning travels A and B
//                          could cancel A and refund B's payment — refundableFor proved the
//                          payment was theirs, not that it was A's.
//   /create-payment-intent wrote paymentIntentId, paidAt and fees onto req.body.rideId with
//                          admin rights, after creating the charge — onto any traveler's ride,
//                          or onto a ride id that did not exist (set with merge creates one).
//                          Stripe's tripNo came from the body too.
//   /travel/settle         paid out of req.body.paymentIntentId ahead of the travel's own, and
//                          whatever the travel's status — an assigned or cancelled travel could
//                          be settled to its operator.
// The handlers' logic lives here with Firestore and Stripe passed in, so the tests exercise the
// real decisions (travelmoney.test.js).

/** The statuses in which a travel may be paid for: it exists, is this traveler's, and is live. */
const PAYABLE = ['assigned', 'accepted', 'arrived', 'onboard'];

const fail = (status, error, code) => ({ status, body: { error, ...(code ? { code } : {}) } });

/**
 * Prove a ride may carry this traveler's payment, BEFORE any charge is created.
 * Returns { ok: true, ride, rideRef } or a { status, body } refusal.
 */
async function authorizePaymentRide({ db, uid, rideId }) {
  const id = String(rideId || '');
  if (!id) return fail(400, 'rideId is required', 'ride_required');
  const rideRef = db.collection('rides').doc(id);
  const snap = await rideRef.get();
  if (!snap.exists) return fail(404, 'No such travel', 'no_travel');
  const ride = snap.data();
  if (String(ride.travelerUid) !== String(uid)) return fail(403, 'That travel belongs to another traveler', 'not_yours');
  if (!PAYABLE.includes(String(ride.status))) return fail(409, 'That travel can no longer be paid for', 'not_payable');
  return { ok: true, ride, rideRef };
}

/**
 * Create the charge for a travel the caller owns, and record it on that travel.
 *
 * `create` is payments.js createPaymentIntent with the price already bound in; it is called with
 * the travel's OWN Travel Number and id, never the request's. Refused before Stripe is asked
 * anything when the ride is not the caller's, or already has a payment. The record is an update,
 * which fails rather than creating a ride that does not exist.
 *
 * `resume(paymentIntentId)` (optional) returns the body for continuing an EXISTING, still
 * unpaid intent — a retrieve, never a create — or null when it cannot be resumed.
 */
async function payForTravel({ db, uid, rideId, create, resume = null, now = Date.now() }) {
  const auth = await authorizePaymentRide({ db, uid, rideId });
  if (!auth.ok) return auth;
  const { ride, rideRef } = auth;
  // A TRAVEL THAT ALREADY HAS A PAYMENT GETS NO SECOND ONE — decided from the record, BEFORE
  // Stripe is asked for anything (audit of f6ef88d). This used to create the intent first and
  // compare afterwards, so every repeat request made a Stripe call only to learn the travel was
  // paid. A retry of the same payment (the sheet closed, a card declined) is answered from
  // `resume`: the existing intent's details, looked up rather than created. With no `resume`
  // the travel is simply reported as paid.
  if (ride.paymentIntentId) {
    if (resume) {
      const again = await resume(ride.paymentIntentId);
      if (again) return { status: 200, body: again };
    }
    return fail(409, 'This travel already has a payment', 'already_paid');
  }
  const result = await create({ tripNo: ride.tripNo || null, rideId: String(rideId) });
  await rideRef.update({
    paymentIntentId: result.paymentIntentId,
    paidAt: now,
    governmentFeeCents: result.breakdown?.governmentFeeCents ?? 0,
    feeLines: result.breakdown?.feeLines ?? [],
  });
  return { status: 200, body: result };
}

/**
 * Cancel a travel and refund it — from the travel's OWN payment, whatever the request says.
 *
 * deps: { refundableFor, refundTravel, transferFixed, operatorPayoutAccount }
 */
async function cancelTravel({ db, uid, rideId, deps, stripeConfigured = true, now = Date.now() }) {
  const id = String(rideId || '');
  if (!id) return fail(400, 'rideId is required');
  const rideRef = db.collection('rides').doc(id);
  const snap = await rideRef.get();
  if (!snap.exists) return fail(404, 'No such travel');
  const ride = snap.data();
  if (String(ride.travelerUid) !== String(uid)) return fail(403, 'That travel belongs to another traveler');
  // Already refunded — say so rather than refunding twice.
  if (ride.refundId) {
    return { status: 200, body: { ok: true, alreadyRefunded: true, refundId: ride.refundId, amountCents: ride.refundedCents || 0 } };
  }
  // Settled travels are finished journeys; cancelling one is a support matter, not this route.
  if (ride.transferId) return fail(409, 'That travel has already been completed and paid out', 'already_settled');

  // Before arrival: full refund. After arrival: less a $3 arrival fee paid to the operator.
  // Onboard or completed: refused, and directed to Patron Support. (Unchanged.)
  const stage = String(ride.status || '');
  if (stage === 'onboard' || stage === 'completed') {
    return fail(409, 'This travel is already underway and cannot be cancelled. Patron Support can settle anything that went wrong with it.', 'travel_underway');
  }
  const ARRIVAL_FEE_CENTS = 300;
  const arrivalFee = stage === 'arrived' ? ARRIVAL_FEE_CENTS : 0;

  await rideRef.set({ status: 'cancelled', statusAt: now }, { merge: true });

  // THE PAYMENT IS THE TRAVEL'S OWN. Never the request's: see the header.
  const paymentIntentId = String(ride.paymentIntentId || '');
  if (!paymentIntentId) return { status: 200, body: { ok: true, refunded: false, reason: 'no payment was taken' } };
  if (!stripeConfigured) return fail(500, 'No Stripe key configured');

  const { cents: refundable, reason } = await deps.refundableFor({ paymentIntentId, expectUid: String(uid) });
  if (refundable <= 0) return { status: 200, body: { ok: true, refunded: false, reason } };

  // The arrival fee is withheld from the refund, never charged separately.
  const withheld = Math.min(arrivalFee, refundable);
  const out = await deps.refundTravel({ paymentIntentId, amountCents: refundable - withheld, expectUid: String(uid) });
  if (!out.ok) {
    await rideRef.set({ refundPending: true, refundBlockedReason: out.error }, { merge: true });
    return { status: 502, body: { ok: false, error: out.error } };
  }
  await rideRef.set(
    { refundId: out.refundId, refundedCents: out.amountCents, arrivalFeeCents: withheld, refundPending: false, refundedAt: now },
    { merge: true },
  );

  // Pay the arrival fee to the operator who was standing there. Best effort, recorded if owed.
  if (withheld > 0) {
    const { accountId } = await deps.operatorPayoutAccount(db, ride.operatorId);
    if (accountId) {
      const paid = await deps.transferFixed({
        paymentIntentId,
        operatorStripeAccount: accountId,
        amountCents: withheld,
        reference: `arrival fee ${ride.tripNo || id}`,
      });
      await rideRef.set(
        paid.ok
          ? { arrivalFeeTransferId: paid.transferId, arrivalFeePaidAt: now }
          : { arrivalFeePending: true, arrivalFeeBlockedReason: paid.error },
        { merge: true },
      );
    } else {
      await rideRef.set({ arrivalFeePending: true, arrivalFeeBlockedReason: 'no payout account' }, { merge: true });
    }
  }
  return { status: 200, body: { ok: true, refunded: true, amountCents: out.amountCents, arrivalFeeCents: withheld, status: out.status } };
}

/**
 * Send the operator their share — only for the caller's own travel, only once it is COMPLETED,
 * and only out of the travel's OWN payment.
 *
 * deps: { operatorPayoutAccount, transferToOperator, sendReceipt(ride) -> { ok, reason } }
 */
async function settleTravel({ db, uid, rideId, deps, now = Date.now() }) {
  const id = String(rideId || '');
  if (!id) return fail(400, 'rideId is required');
  const rideRef = db.collection('rides').doc(id);
  const snap = await rideRef.get();
  if (!snap.exists) return fail(404, 'No such travel');
  const ride = snap.data();
  if (String(ride.travelerUid) !== String(uid)) return fail(403, 'That travel belongs to another traveler');
  if (ride.transferId) return { status: 200, body: { ok: true, alreadySettled: true, transferId: ride.transferId } };
  // SETTLEMENT FOLLOWS COMPLETION. Only the operator's app or the server writes 'completed'
  // (firestore.rules); an assigned, accepted, arrived, onboard or cancelled travel owes nobody
  // its fare yet.
  if (ride.status !== 'completed') return fail(409, 'That travel is not completed', 'not_completed');
  const paymentIntentId = String(ride.paymentIntentId || '');
  if (!paymentIntentId) return fail(400, 'No payment is recorded for this travel', 'no_payment');

  const { accountId, reason } = await deps.operatorPayoutAccount(db, ride.operatorId);
  if (!accountId) {
    await rideRef.set({ payoutPending: true, payoutBlockedReason: reason, payoutCheckedAt: now }, { merge: true });
    return { status: 200, body: { ok: false, code: 'operator_not_payable', owed: true, reason } };
  }

  const out = await deps.transferToOperator({
    paymentIntentId,
    operatorStripeAccount: accountId,
    expectedUid: uid,
    expectedTripNo: ride.tripNo || null,
    rideId: id,
  });
  if (!out.ok) {
    await rideRef.set(
      { payoutPending: true, payoutBlockedReason: out.error || out.code, payoutCheckedAt: now, ...(out.paidWith ? { paidWith: out.paidWith } : {}) },
      { merge: true },
    );
    return { status: out.retryable ? 202 : 502, body: out };
  }
  await rideRef.set(
    {
      transferId: out.transferId,
      operatorPaidCents: out.amountCents,
      platformTakeCents: out.platformTake,
      payoutPending: false,
      payoutBlockedReason: null,
      settledAt: now,
      ...(out.paidWith ? { paidWith: out.paidWith } : {}),
    },
    { merge: true },
  );
  // The receipt, once.
  if (!ride.receiptSentAt && deps.sendReceipt) {
    const sent = await deps.sendReceipt({ ...ride, completedAt: now });
    await rideRef.set(sent.ok ? { receiptSentAt: now } : { receiptFailed: sent.reason || 'unknown', receiptFailedAt: now }, { merge: true });
  }
  return { status: 200, body: out };
}

module.exports = { PAYABLE, authorizePaymentRide, payForTravel, cancelTravel, settleTravel };
