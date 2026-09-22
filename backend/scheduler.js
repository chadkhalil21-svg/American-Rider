// American Rider — the clock behind scheduled travel.
//
// WHAT WAS WRONG, FOR THREE WEEKS. A traveler could reserve travel for 6:30 AM. The
// reservation was written to `scheduled_rides`, read back on the next launch, and shown on
// the home screen. Nothing anywhere ever read that collection again. No operator was told, no
// travel was created, and at 6:30 AM precisely nothing happened. The reservation was a note
// to self with a receipt-like appearance — the app remembered the appointment and the company
// did not keep it.
//
// This file is the half that was missing. It wakes up, finds reservations that are nearly
// due, matches an operator, takes the money, and creates the travel — the same `rides`
// document the live booking path creates, so everything downstream (the operator's inbox, the
// traveler's live screen, settlement, the receipt) works with no further change.
//
// ORDER OF OPERATIONS, AND WHY IT IS THIS ORDER
//   1. claim   — mark the reservation as being worked on, so two sweeps cannot both take it
//   2. match   — find an operator BEFORE any money moves
//   3. charge  — off-session, against the card on file, keyed on the reservation id
//   4. write   — create the travel only once someone is coming AND it has been paid for
// Charging before matching would take money for a journey with nobody to drive it. Writing
// before charging would send an operator to a journey nobody has paid for. Neither is
// recoverable by an apology.
//
// WHERE IT RUNS. An in-process interval, plus POST /scheduled/sweep so an external pinger can
// drive it. On a free Render instance the process sleeps when idle and an interval sleeps with
// it, so the ping is not a nicety — it is what makes the free tier work at all. See
// docs/SCHEDULED-TRAVEL.md.
const { matchOperator, etaMinutes, coverageLapsed } = require('./matching');
const { screeningReady } = require('./screening');
const { adminDb, adminStatus } = require('./firebase-admin');
const { chargeScheduledTravel, operatorPayoutAccount } = require('./payments');
const { governmentFeesFor } = require('./fees');
const { fileTicket } = require('./tickets');
const { notify } = require('./push');

// How far ahead a reservation enters consideration. Inside this window it is looked at on
// every sweep; outside it, it is not read at all.
const WINDOW_MS = 25 * 60 * 1000;

// Padding on top of the matched operator's own ETA. An operator 4 minutes away and an
// operator 15 minutes away must not be dispatched at the same moment — the point of a
// scheduled travel is that the car is there AT the appointed time, not that it sets off then.
const ARRIVAL_BUFFER_MIN = 3;

// How long past the appointed time we keep trying before telling the traveler plainly that
// nobody could be found. A reservation that quietly stays "reserved" forever is the same
// defect as the one this file exists to fix.
const GRACE_MS = 10 * 60 * 1000;

// A claim that is never released — a crash between claim and write — must not strand the
// reservation. Anything claimed longer ago than this is treated as unclaimed again.
const CLAIM_STALE_MS = 3 * 60 * 1000;

// coverageLapsed used to be DEFINED here, under a comment saying it mirrored dispatch.ts.
// It now lives in matching.js beside the dispatch rules it belongs to — see the note there
// for what mirroring cost us in monitor.js.

/**
 * One pass over everything due.
 *
 * Returns a report rather than logging and forgetting, so /scheduled/sweep can answer with it
 * and the founders can see what the clock actually did.
 *
 * Never throws. A sweep that dies takes every later sweep with it when it runs on an interval.
 */
async function sweepScheduled({ now = Date.now() } = {}) {
  const db = adminDb();
  if (!db) return { ok: false, reason: adminStatus().reason, considered: 0 };

  const report = { ok: true, considered: 0, dispatched: [], waiting: 0, failed: [] };

  let due;
  try {
    // Queried on status alone, with the time filtered in memory. Two range/equality filters
    // would need a composite index, and a dispatcher that silently returns nothing because an
    // index was never created is precisely the failure this file exists to remove.
    // BOUNDED, for the same reason sweepAssignments is: every reservation this returns is
    // re-read once a minute until it is served, so ten standing reservations cost 14,400
    // reads a day whether or not anybody is using the app.
    const snap = await db
      .collection('scheduled_rides')
      .where('status', '==', 'reserved')
      .limit(RESERVED_SCAN_LIMIT)
      .get();
    due = snap.docs.filter((d) => {
      const r = d.data();
      return typeof r.atMs === 'number' && r.atMs - now <= WINDOW_MS;
    });
  } catch (e) {
    return { ok: false, reason: `could not read reservations: ${e.message}`, considered: 0 };
  }

  if (!due.length) return report;
  report.considered = due.length;

  // Read the fleet ONCE for the whole sweep rather than per reservation.
  let fleet = [];
  try {
    const ops = await db.collection('operators').get();
    fleet = ops.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((o) => !coverageLapsed(o));
  } catch (e) {
    return { ok: false, reason: `could not read the fleet: ${e.message}`, considered: due.length };
  }

  // Operators already given a travel in THIS sweep are not offered a second one. Without this
  // two reservations at the same minute both go to the nearest operator.
  const taken = new Set();

  for (const docSnap of due) {
    const r = docSnap.data();
    const id = docSnap.id;
    const late = now > r.atMs + GRACE_MS;

    const pickup = { lat: Number(r.pickupLat), lng: Number(r.pickupLng) };
    const havePickup = Number.isFinite(pickup.lat) && Number.isFinite(pickup.lng);

    // A reservation written before this file existed has no pickup on it and cannot be
    // dispatched. Said plainly on the record rather than retried forever.
    if (!havePickup) {
      await close(db, id, 'unmatched', 'This reservation was made before automatic dispatch and has no pickup on it.');
      report.failed.push({ id, reason: 'no pickup coordinates' });
      continue;
    }

    const match = matchOperator(
      fleet.filter((o) => !taken.has(o.id)),
      pickup,
      r.travelClass || 'Standard',
      // The screening gate: once a provider is live, only operators with a recorded pass.
      { requireScreening: screeningReady() },
    );

    if (!match) {
      if (late) {
        await close(db, id, 'unmatched', 'No operator was available at the time you reserved.');
        await notify({
          uid: r.travelerUid,
          kind: 'scheduled_failed',
          title: 'No operator was available',
          body: `Your ${r.time || ''} ${r.period || ''} travel could not be filled. Nothing was charged.`.replace(/\s+/g, ' ').trim(),
          data: { screen: '/', tripNo: r.tripNo || '' },
        });
        report.failed.push({ id, reason: 'nobody available' });
      } else {
        await touch(db, id, { lastSweepAt: now, lastSweepResult: 'no operator available' });
        report.waiting++;
      }
      continue;
    }

    // THE DISPATCH MOMENT. Not "when the travel is due" — when this operator has to leave in
    // order to be there when it is due.
    const leaveBy = r.atMs - (match.etaMin + ARRIVAL_BUFFER_MIN) * 60 * 1000;
    if (now < leaveBy && !late) {
      await touch(db, id, {
        lastSweepAt: now,
        lastSweepResult: `holding — nearest operator is ${match.etaMin} min away`,
      });
      report.waiting++;
      continue;
    }

    // ---- 1. Claim it. -----------------------------------------------------------------
    const claimed = await claim(db, id, now);
    if (!claimed) {
      report.waiting++;
      continue;
    }

    // ---- 2/3. Charge the card on file. ------------------------------------------------
    const fareCents = Number(r.travelCostCents);
    if (!Number.isFinite(fareCents) || fareCents <= 0) {
      await close(db, id, 'unmatched', 'This reservation has no price on it and cannot be dispatched.');
      report.failed.push({ id, reason: 'no fare on the reservation' });
      continue;
    }

    const paid = await chargeScheduledTravel({
      travelCostCents: fareCents,
      uid: r.travelerUid,
      email: r.travelerEmail || '',
      tripNo: r.tripNo || '',
      reservationId: id,
      dep: r.dep || '',
      dest: r.dest || '',
      // The traveler was quoted with the government fee for this pickup; the charge must be
      // the quote. A reservation carries its pickup coordinates and only the NAME of its
      // destination, so a drop-off fee — none exists today — would need destLat/destLng here.
      governmentFees: governmentFeesFor(pickup, null),
    });

    if (!paid.ok) {
      // The card failed, or the bank wants the traveler present. Either way NOBODY IS SENT.
      // The reservation is released so a traveler who fixes their card in the next few
      // minutes is still picked up, and it carries the reason so the app can say it.
      await touch(db, id, {
        status: late ? 'payment_failed' : 'reserved',
        claimedAt: null,
        lastSweepAt: now,
        paymentError: paid.error || 'Payment failed',
        paymentErrorCode: paid.code || 'charge_failed',
      });
      if (late) {
        await notify({
          uid: r.travelerUid,
          kind: 'scheduled_failed',
          title: 'Payment could not be taken',
          body: 'Your scheduled travel was not dispatched. Update your payment method to book again.',
          data: { screen: '/wallet', tripNo: r.tripNo || '' },
        });
      }
      report.failed.push({ id, reason: paid.code || 'charge failed' });
      continue;
    }

    // ---- 4. Create the travel. --------------------------------------------------------
    // Field for field the document dispatchRide() writes, so the operator app, the traveler's
    // live screen, settlement and the receipt all read it without knowing it was scheduled.
    try {
      const rideRef = await db.collection('rides').add({
        travelerUid: r.travelerUid,
        travelerName: r.travelerName || '',
        tripNo: r.tripNo || '',
        operatorId: match.operator.id,
        operatorName: match.operator.name || '',
        dep: r.dep || '',
        dest: r.dest || '',
        travelClass: r.travelClass || 'Standard',
        costCents: Number(r.costCents) || 0,
        status: 'assigned',
        createdAt: Date.now(),
        // What makes it legible as a scheduled travel afterwards, to us and to a reader of the
        // record: the hour it was promised for, and the reservation it came from.
        scheduledFor: r.atMs,
        reservationId: id,
        // Settlement reads this when the traveler's app has no intent to name — see
        // POST /travel/settle.
        paymentIntentId: paid.paymentIntentId,
      });

      taken.add(match.operator.id);

      // TELL BOTH OF THEM. A scheduled travel is dispatched while nobody is looking at a
      // phone — that is the entire point of it — so a reservation that becomes a travel in
      // silence is a car arriving at a door nobody is behind.
      await notify({
        uid: match.operator.id,
        kind: 'travel_assigned',
        title: 'Scheduled travel assigned',
        body: `${r.dep || 'Pickup'} to ${r.dest || 'destination'}. Open to accept.`,
        data: { screen: '/operator', rideId: rideRef.id, tripNo: r.tripNo || '' },
      });
      await notify({
        uid: r.travelerUid,
        kind: 'operator_assigned',
        title: 'Your operator is on the way',
        body:
          `${match.operator.name || 'An operator'} is ${match.etaMin} minutes from ` +
          `${r.dep || 'your pickup'}.`,
        data: { screen: '/ride', rideId: rideRef.id, tripNo: r.tripNo || '' },
      });

      await touch(db, id, {
        status: 'dispatched',
        claimedAt: null,
        rideId: rideRef.id,
        operatorId: match.operator.id,
        operatorName: match.operator.name || '',
        etaMin: match.etaMin,
        paymentIntentId: paid.paymentIntentId,
        chargedCents: paid.chargedCents,
        dispatchedAt: now,
        paymentError: null,
      });
      report.dispatched.push({
        id,
        rideId: rideRef.id,
        tripNo: r.tripNo || '',
        operator: match.operator.name,
        etaMin: match.etaMin,
      });
    } catch (e) {
      // MONEY HAS ALREADY LEFT THE TRAVELER'S CARD. This is the one branch that must never be
      // quiet: the charge stands and no travel exists to earn it. Recorded on the reservation
      // so it is visible and refundable rather than lost.
      await touch(db, id, {
        status: 'needs_attention',
        claimedAt: null,
        paymentIntentId: paid.paymentIntentId,
        chargedCents: paid.chargedCents,
        dispatchError: e.message,
        dispatchErrorAt: now,
      });
      // AND OPEN A CASE OURSELVES. The traveler has been charged for a journey that does not
      // exist; leaving it to them to notice and complain is not a refund process. The ticket
      // carries the payment so a person can refund it without going hunting.
      let caseNo = null;
      try {
        const filed = await fileTicket({
          uid: r.travelerUid,
          email: r.travelerEmail || '',
          kind: 'support',
          reason: 'Scheduled travel charged but not dispatched',
          trip: r.tripNo || '',
          description:
            `Scheduled travel ${r.tripNo || '(no travel number)'} was charged ` +
            `${paid.chargedCents} cents (${paid.paymentIntentId}) and the travel record could ` +
            `not be created: ${e.message}. Reservation ${id}. REFUND IS OWED.`,
        });
        caseNo = filed?.caseNo || null;
        if (caseNo) await touch(db, id, { caseNo });
      } catch {
        /* the reservation already carries the whole story; a failed ticket must not hide it */
      }
      report.failed.push({
        id,
        reason: `charged but not dispatched: ${e.message}`,
        paid: true,
        caseNo,
      });
    }
  }

  return report;
}

/**
 * Take the reservation, but only if it is still there to take.
 *
 * A compare-and-set inside a transaction. Two server instances, or an interval overlapping a
 * manual sweep, would otherwise both charge the same traveler and dispatch two operators to
 * one pickup.
 */
async function claim(db, id, now) {
  const ref = db.collection('scheduled_rides').doc(id);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return false;
      const r = snap.data();
      if (r.status !== 'reserved') return false;
      const held = Number(r.claimedAt) || 0;
      if (held && now - held < CLAIM_STALE_MS) return false; // somebody else has it
      tx.update(ref, { claimedAt: now });
      return true;
    });
  } catch {
    return false;
  }
}

/** Write to the reservation. Never throws — a lost note must not stop the sweep. */
async function touch(db, id, fields) {
  try {
    await db.collection('scheduled_rides').doc(id).set(fields, { merge: true });
  } catch {
    /* deliberate: see above */
  }
}

/** End the reservation with a reason the traveler can be shown verbatim. */
async function close(db, id, status, reason) {
  await touch(db, id, { status, claimedAt: null, closedAt: Date.now(), closedReason: reason });
}

// The interval that drives this lives in server.js, next to the route monitor, because the
// two run on the same tick and a free-tier ping has to drive both.
module.exports = { sweepScheduled, sweepSettlements, WINDOW_MS, ARRIVAL_BUFFER_MIN, GRACE_MS };

// ---- SETTLEMENT, SWEPT ---------------------------------------------------------------------
//
// A completed travel that has been paid for must reach the operator's bank whether or not
// anybody is still holding a phone. Until 29 Aug 2026 nothing guaranteed that: the traveler's
// app posted /travel/settle at the end of the journey, and if it had lost the thread by then
// — matchedOp nulled, app closed, backgrounded past a timer — the fare simply stayed in the
// platform balance. Silently. AR-2109-MIA was charged $19.44, driven by Marcus Reyes to
// completion, and produced no transfer and no receipt.
//
// This is the backstop, and it settles on the SERVER'S evidence rather than the app's:
//
//   status 'completed'  — the operator said so, and that write is what ends a journey
//   paymentIntentId     — now stamped on the travel by /create-payment-intent
//   no transferId       — not already settled
//
// Idempotent by transferId, so it can run every minute forever. transferToOperator re-checks
// the traveler's uid against Stripe's own metadata before a cent moves, so sweeping changes
// only WHEN an operator is paid, never WHO may be.
// A ceiling on one tick, not an expected size. Ordinarily this query matches nothing, because
// the flag is cleared as each travel is paid; the limit exists so a backlog cannot turn one
// sweep into a bill.
const SETTLE_SCAN_LIMIT = 25;

// Reservations examined per tick, for the same reason. A ceiling on the read bill, not a
// judgement about how many reservations may exist.
const RESERVED_SCAN_LIMIT = 100;

async function sweepSettlements({ now = Date.now(), limit = 25 } = {}) {
  const db = adminDb();
  if (!db) return { ok: false, reason: 'no database' };
  const { transferToOperator } = require('./payments');

  let settled = 0;
  let centsPaid = 0;
  const blocked = [];
  try {
    // READS ONLY WHAT OWES SOMEBODY MONEY. This scanned every completed travel, then the
    // newest 200 — and 200 reads a minute is 288,000 a day against a 50,000/day allowance,
    // for a database with 166 writes in it. The read bill for finding nothing was about to
    // be the reason to start paying.
    //
    // `needsPayout` is set when the operator completes the travel (see operatorInbox.ts) and
    // cleared here once paid, so a quiet minute costs nothing at all.
    const snap = await db
      .collection('rides')
      .where('needsPayout', '==', true)
      .limit(SETTLE_SCAN_LIMIT)
      .get();
    const owed = [];
    const unsettleable = [];
    snap.forEach((d) => {
      const x = d.data() || {};
      if (x.transferId) return; // already paid; the flag is cleared below
      // A FLAG THAT CANNOT BE ACTED ON MUST NOT BE READ FOREVER. Without a payment or an
      // operator there is nothing this sweep can ever do, so leaving needsPayout set would
      // buy the same futile document read every minute until someone noticed. It goes to a
      // person instead — which is the honest answer, because somebody may still be owed.
      if (!x.paymentIntentId || !x.operatorId) {
        unsettleable.push({ rideId: d.id, tripNo: x.tripNo || d.id });
        return;
      }
      owed.push({ rideId: d.id, ...x });
    });

    for (const u of unsettleable) {
      blocked.push({ tripNo: u.tripNo, reason: 'no payment or operator recorded — needs a person' });
      await db.collection('rides').doc(u.rideId).set(
        {
          needsPayout: false,
          payoutPending: true,
          payoutBlockedReason: 'no payment or operator recorded — needs a person',
          payoutCheckedAt: now,
        },
        { merge: true },
      );
    }

    for (const ride of owed.slice(0, limit)) {
      // An operator with no payout account yet is RECORDED as owed, never dropped. They
      // finish onboarding, and the next sweep pays them for work already done.
      const { accountId, reason } = await operatorPayoutAccount(db, ride.operatorId);
      if (!accountId) {
        blocked.push({ tripNo: ride.tripNo || ride.rideId, reason });
        await db.collection('rides').doc(ride.rideId).set(
          { payoutPending: true, payoutBlockedReason: reason, payoutCheckedAt: now },
          { merge: true },
        );
        continue;
      }
      const out = await transferToOperator({
        paymentIntentId: ride.paymentIntentId,
        operatorStripeAccount: accountId,
        expectedUid: String(ride.travelerUid),
        expectedTripNo: ride.tripNo || null,
        rideId: ride.rideId,
      });
      if (out.ok) {
        settled += 1;
        centsPaid += out.amountCents;
        await db.collection('rides').doc(ride.rideId).set(
          {
            transferId: out.transferId,
            operatorPaidCents: out.amountCents,
            payoutPending: false,
            payoutBlockedReason: null,
            settledAt: now,
            settledBy: 'sweep',
            needsPayout: false,
          },
          { merge: true },
        );
      } else {
        blocked.push({ tripNo: ride.tripNo || ride.rideId, reason: out.error || out.code });
        await db.collection('rides').doc(ride.rideId).set(
          { payoutPending: true, payoutBlockedReason: out.error || out.code, payoutCheckedAt: now },
          { merge: true },
        );
      }
    }
    return { ok: true, considered: owed.length, settled, centsPaid, blocked };
  } catch (e) {
    // Loudly. The whole point of this sweep is that nobody is watching.
    console.error('[sweep] settlement failed:', e.message);
    return { ok: false, reason: e.message, settled, centsPaid, blocked };
  }
}
