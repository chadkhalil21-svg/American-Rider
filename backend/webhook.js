// Stripe's side of the conversation.
//
// WHAT WAS MISSING, AND WHY IT MATTERS MORE THAN IT SOUNDS. Everything the platform knew about
// money, it knew because a phone told it. Stripe had no way to tell us anything. So:
//
//   - A DISPUTE arrived at Stripe and we never heard. The first we would know is the money
//     gone from the balance, weeks later, with the evidence window closed.
//   - AN ACH PAYMENT THAT FAILED days after the travel left an operator paid out of a charge
//     that never cleared. `source_transaction` protects the transfer at settlement; it cannot
//     protect against a debit reversed afterwards.
//   - AN OPERATOR'S CONNECT ACCOUNT being restricted by Stripe — a failed identity check, an
//     expired document — left them in the dispatchable fleet, taking travel they could not be
//     paid for.
//
// SIGNATURE VERIFICATION IS NOT OPTIONAL. This endpoint acts on what it is told: it can strike
// an operator off the fleet and open emergency-grade cases. Unverified, it would be an
// unauthenticated way for anyone on the internet to do both. The route is mounted with the RAW
// body before express.json(), because a parsed body cannot be verified.
const { adminDb, adminStatus } = require('./firebase-admin');
const { fileTicket } = require('./tickets');
const { readKey } = require('./env');
const { money } = require('./email');
const { recordPayoutActivity } = require('./operatorfees');

/**
 * Handle one verified event. Returns a short report; never throws — Stripe reads a non-2xx as
 * "retry", and retrying a crash forever is worse than recording it once.
 */
async function handleEvent(event) {
  const db = adminDb();
  if (!db) return { ok: false, reason: adminStatus().reason };
  const obj = event.data?.object || {};

  switch (event.type) {
    // ---- The traveler's bank took the money back. -----------------------------------
    case 'charge.dispute.created': {
      const ride = await rideByPaymentIntent(db, obj.payment_intent);
      const caseNo = await open(db, ride, {
        kind: 'emergency', // not a safety emergency — a deadline. Evidence windows close.
        reason: 'Payment disputed',
        description:
          `A dispute was opened for ${money(obj.amount)} on travel ` +
          `${ride?.tripNo || '(unknown)'}.\nReason given: ${obj.reason || '—'}\n` +
          `Evidence is due ${dueDate(obj.evidence_details?.due_by)}.\n` +
          `PaymentIntent ${obj.payment_intent}. Dispute ${obj.id}.\n` +
          (ride ? `Route: ${ride.dep} to ${ride.dest}. Operator: ${ride.operatorName}.\n` : ''),
      });
      if (ride) await mark(db, ride.id, { disputed: true, disputeId: obj.id, disputeAt: Date.now(), caseNo });
      return { ok: true, action: 'dispute opened', caseNo };
    }

    case 'charge.dispute.closed': {
      const ride = await rideByPaymentIntent(db, obj.payment_intent);
      if (ride) await mark(db, ride.id, { disputeStatus: obj.status, disputeClosedAt: Date.now() });
      return { ok: true, action: `dispute ${obj.status}` };
    }

    // ---- The charge failed, or was pulled back after it settled. ---------------------
    case 'payment_intent.payment_failed': {
      const ride = await rideByPaymentIntent(db, obj.id);
      if (ride) await mark(db, ride.id, { paymentFailed: true, paymentFailedAt: Date.now() });
      return { ok: true, action: 'payment failed recorded' };
    }

    case 'charge.failed': {
      const ride = await rideByPaymentIntent(db, obj.payment_intent);
      // AN ACH DEBIT THAT FAILS AFTER SETTLEMENT is the case we cannot fix automatically: the
      // operator has already been paid from funds that did not arrive. A person has to decide
      // whether to recover it, so a person is told, with everything they need on the case.
      const alreadyPaid = !!ride?.transferId;
      const caseNo = await open(db, ride, {
        kind: alreadyPaid ? 'emergency' : 'support',
        reason: alreadyPaid ? 'Charge failed AFTER the operator was paid' : 'Charge failed',
        description:
          `A charge of ${money(obj.amount)} failed on travel ${ride?.tripNo || '(unknown)'}.\n` +
          `Reason: ${obj.failure_message || obj.failure_code || '—'}\n` +
          (alreadyPaid
            ? `THE OPERATOR HAS ALREADY BEEN PAID — transfer ${ride.transferId}. Funds are owed back.\n`
            : 'No transfer had been made.\n') +
          `PaymentIntent ${obj.payment_intent}.\n`,
      });
      if (ride) await mark(db, ride.id, { chargeFailed: true, chargeFailedAt: Date.now(), caseNo });
      return { ok: true, action: 'charge failure recorded', caseNo };
    }

    // ---- Money to an operator did not arrive. ---------------------------------------
    case 'payout.paid': {
      // Stripe's $2 monthly active-account charge is incurred in a month a payout reaches an
      // Operator's bank/debit card. Record that month from Stripe's own event; do not infer it
      // merely because American Rider transferred fare into the connected balance.
      const accountId = event.account || obj.destination || null;
      const activity = await recordPayoutActivity({
        accountId,
        createdAt: Number(event.created || 0) > 0 ? Number(event.created) * 1000 : Date.now(),
      });
      return { ok: activity.ok !== false, action: activity.ignored ? 'payout account not ours' : 'operator active month recorded', reason: activity.reason };
    }

    case 'transfer.reversed':
    case 'payout.failed': {
      const caseNo = await open(db, null, {
        kind: 'support',
        reason: event.type === 'payout.failed' ? 'Operator payout failed' : 'Transfer reversed',
        description:
          `${event.type} for ${money(obj.amount)} on account ${event.account || obj.destination || '—'}.\n` +
          `Reason: ${obj.failure_message || obj.failure_code || '—'}\nObject ${obj.id}.\n` +
          `An operator has not received money they earned.`,
      });
      return { ok: true, action: 'payout failure recorded', caseNo };
    }

    // ---- Stripe changed its mind about an operator. ---------------------------------
    case 'account.updated': {
      const enabled = !!obj.payouts_enabled && !!obj.charges_enabled;
      const uid = obj.metadata?.uid || (await uidByStripeAccount(db, obj.id));
      if (!uid) return { ok: true, action: 'account not ours' };

      // AN OPERATOR STRIPE HAS RESTRICTED MUST NOT KEEP TAKING TRAVEL. They would be driving
      // for money that cannot reach them, which is the one thing the 99% promise cannot
      // survive. Removed from the dispatchable fleet, not deleted — the record stays.
      try {
        await db.collection('operators').doc(String(uid)).set(
          {
            payoutsEnabled: enabled,
            ...(enabled ? {} : { available: false }),
            stripeCheckedAt: Date.now(),
            stripeDisabledReason: obj.requirements?.disabled_reason || null,
          },
          { merge: true },
        );
      } catch {
        /* reported below by the return value, not raised */
      }
      return { ok: true, action: enabled ? 'operator payable' : 'operator taken off duty' };
    }

    default:
      return { ok: true, action: 'ignored' };
  }
}

const dueDate = (secs) =>
  secs ? new Date(secs * 1000).toISOString().slice(0, 10) : 'not stated';

async function rideByPaymentIntent(db, pi) {
  if (!pi) return null;
  try {
    const snap = await db.collection('rides').where('paymentIntentId', '==', String(pi)).get();
    const d = snap.docs[0];
    return d ? { id: d.id, ...d.data() } : null;
  } catch {
    return null;
  }
}

async function uidByStripeAccount(db, accountId) {
  if (!accountId) return null;
  try {
    const snap = await db.collection('users').where('stripeAccountId', '==', String(accountId)).get();
    return snap.docs[0]?.id || null;
  } catch {
    return null;
  }
}

async function open(db, ride, { kind, reason, description }) {
  try {
    const filed = await fileTicket({
      uid: ride?.travelerUid || null,
      email: ride?.travelerEmail || '',
      kind,
      reason,
      trip: ride?.tripNo || '',
      description,
    });
    return filed?.caseNo || null;
  } catch {
    return null;
  }
}

async function mark(db, rideId, fields) {
  try {
    await db.collection('rides').doc(rideId).set(fields, { merge: true });
  } catch {
    /* the case carries the story either way */
  }
}

/** Is the webhook configured? `/health` reports it, so a silent outage is impossible. */
const webhookReady = () => !!readKey('STRIPE_WEBHOOK_SECRET');

module.exports = { handleEvent, webhookReady };
