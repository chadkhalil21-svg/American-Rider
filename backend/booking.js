const { createHash } = require('node:crypto');
const { matchOperator } = require('./matching');
const { ageOn, MIN_AGE, MAX_AGE } = require('./family');
const { marketFor } = require('./markets');
const { regionById } = require('./regions');
const { readinessFor } = require('./market-readiness');
const { readKey } = require('./env');

const deny = (status, code, error) => ({ status, body: { ok: false, code, error } });
const digest = (value) => createHash('sha256').update(String(value)).digest('hex');
const bookingId = (uid, key) => digest(`ar-booking-v1:${uid}:${key}`).slice(0, 40);

/** Persist the server's quote and party BEFORE giving the device a payment secret. */
async function prepareBooking({ db, uid, key, fingerprint, record, now = Date.now() }) {
  if (typeof key !== 'string' || !/^[\w-]{16,100}$/.test(key)) {
    return deny(400, 'booking_key_required', 'A booking key is required');
  }
  const id = bookingId(uid, key);
  const ref = db.collection('rides').doc(id);
  return db.runTransaction(async (tx) => {
    const account = await tx.get(db.collection('account_closures').doc(String(uid)));
    if(account.exists&&account.data()?.closingAt)
      return deny(409,'account_closing','Account closure is in progress');
    const snap = await tx.get(ref);
    if (snap.exists) {
      const previous = snap.data();
      if (previous.travelerUid !== String(uid) || previous.bookingFingerprint !== fingerprint) {
        return deny(409, 'booking_conflict', 'This booking key belongs to a different Travel');
      }
      return { status: 200, body: { rideId: id, tripNo: previous.tripNo, status: previous.status, reused: true } };
    }
    tx.create(ref, {
      ...record,
      travelerUid: String(uid),
      bookingFingerprint: fingerprint,
      status: 'awaiting_payment',
      createdAt: now,
      statusAt: now,
    });
    return { status: 201, body: { rideId: id, tripNo: record.tripNo, status: 'awaiting_payment', reused: false } };
  });
}

/** A Stripe success is necessary but not sufficient: the PI must belong to this exact priced Travel. */
function paymentMatches(ride, payment, uid, rideId) {
  return !!payment && payment.status === 'succeeded' &&
    payment.metadata?.uid === String(uid) &&
    payment.metadata?.rideId === String(rideId) &&
    payment.id === String(ride.paymentIntentId || '') &&
    Number(payment.amount_received) === Number(ride.costCents) &&
    Number(payment.amount_received) > 0 &&
    payment.currency === 'usd';
}

/**
 * Bind one verified paid Travel to one still-available Operator in one Firestore transaction.
 * A simultaneous Traveler cannot reserve that Operator; a retry cannot create a new Travel.
 * `payment` is a freshly retrieved provider object (not the mobile app's claim).
 */
async function assignPaidTravel({ db, uid, rideId, payment, candidate, now = Date.now(), requireScreening = true }) {
  const ref = db.collection('rides').doc(String(rideId));
  const opRef = candidate ? db.collection('operators').doc(String(candidate.operator.id)) : null;
  return db.runTransaction(async (tx) => {
    const account = await tx.get(db.collection('account_closures').doc(String(uid)));
    if(account.exists&&account.data()?.closingAt)
      return deny(409,'account_closing','Account closure is in progress');
    const rideSnap = await tx.get(ref);
    if (!rideSnap.exists) return deny(404, 'no_travel', 'No such Travel');
    const ride = rideSnap.data();
    if (String(ride.travelerUid) !== String(uid)) return deny(403, 'not_yours', 'This Travel belongs to another Traveler');
    // Atomic with activation/pause, not a cached HTTP preflight. Monitor reoffers and the
    // unattended scheduled worker use this same transaction without going through HTTP.
    const liveMoney = String(readKey('DEPLOYMENT_MODE') || '').toLowerCase() === 'production' ||
      /^(sk|rk)_live_/.test(readKey('STRIPE_SECRET_KEY') || '');
    if (liveMoney) {
      const market = marketFor({ lat: ride.pickupLat, lng: ride.pickupLng });
      if (!market) return deny(409, 'market_waitlist', 'No new Operator offers are admitted in this market');
      const admitRef = db.collection('market_admission').doc(market.id);
      const admitSnap = await tx.get(admitRef);
      const admission = readinessFor({ market, region: regionById(market.regionId),
        record: admitSnap.exists ? admitSnap.data() : {}, now });
      if (admission.status !== 'active') return deny(409, 'market_waitlist', 'New Operator offers are paused in this market');
    }
    if (ride.party?.teen && (!ride.teenPickup?.required || !/^[0-9a-f]{64}$/.test(String(ride.teenPickup.hash || '')))) {
      return deny(409, 'teen_pin_unavailable', 'Teen pickup code has not been securely prepared');
    }
    if (ride.party?.teen && !ride.party.continuedFromJourneyNo) {
      const linkId = String(ride.party.familyLinkId || '');
      if (!linkId) return deny(409, 'family_authorization_required', 'Family authorization is not available');
      const linkSnap = await tx.get(db.collection('family_links').doc(linkId));
      const link = linkSnap.exists ? linkSnap.data() : null;
      const age = ageOn(link?.teenDob, now);
      if (!link || link.status !== 'active' || age === null || age < MIN_AGE || age > MAX_AGE ||
          String(link.guardianUid) !== String(ride.party.guardianUid) ||
          String(link.teenUid) !== String(ride.party.teenUid)) {
        return deny(409, 'family_authorization_revoked', 'Family authorization is no longer active');
      }
    }
    if (ride.status === 'assigned' && ride.operatorId && !ride.releasedAt) {
      if (!paymentMatches(ride, payment, uid, rideId)) return deny(409, 'payment_unconfirmed', 'Payment is not confirmed for this Travel');
      return { status: 200, body: { rideId, tripNo: ride.tripNo, matched: operatorView(ride), reused: true } };
    }
    const released = ride.status === 'assigned' && !!ride.releasedAt;
    if (!released && !['awaiting_payment', 'awaiting_assignment'].includes(ride.status)) {
      return deny(409, 'travel_not_dispatchable', 'This Travel cannot be dispatched');
    }
    if (!paymentMatches(ride, payment, uid, rideId)) {
      return deny(409, 'payment_unconfirmed', 'Payment is not confirmed for this Travel');
    }
    if (!candidate) {
      if (released) return deny(409, 'reoffer_pending', 'A released offer awaits another Operator');
      tx.update(ref, { status: 'awaiting_assignment', paidAt: ride.paidAt || now, statusAt: now });
      return { status: 200, body: { rideId, tripNo: ride.tripNo, matched: null, paymentConfirmed: true } };
    }
    const opSnap = await tx.get(opRef);
    const op = opSnap.exists ? opSnap.data() : null;
    const from = { lat: Number(ride.pickupLat), lng: Number(ride.pickupLng) };
    const valid = op && !op.currentRideId && matchOperator(
      [{ ...op, id: opRef.id }], from, ride.travelClass || 'Standard', { requireScreening, now },
    );
    if (!valid || String(valid.operator.id) !== String(candidate.operator.id)) {
      return deny(409, 'operator_unavailable', 'That Operator is no longer available');
    }
    const fields = {
      status: 'assigned', statusAt: now, paidAt: ride.paidAt || now,
      operatorId: opRef.id, operatorName: op.name || '', operatorCar: op.car || '',
      operatorPlate: op.plate || '', operatorLat: Number(op.lat), operatorLng: Number(op.lng),
      operatorEtaMin: valid.etaMin, operatorMiles: valid.miles, operatorDemo: false,
      offeredAt: now, notifiedOperatorAt: null, releasedAt: null, releasedReason: null,
      ...(released ? { declinedBy: [...new Set([...(Array.isArray(ride.declinedBy) ? ride.declinedBy : []), String(ride.operatorId)])] } : {}),
    };
    if (released && ride.operatorId && String(ride.operatorId) !== opRef.id) {
      const oldRef = db.collection('operators').doc(String(ride.operatorId));
      const oldSnap = await tx.get(oldRef);
      if (oldSnap.exists && String(oldSnap.data().currentRideId || '') === String(rideId)) {
        tx.update(oldRef, { currentRideId: null, reservedAt: null });
      }
    }
    tx.update(opRef, { currentRideId: String(rideId), reservedAt: now });
    tx.update(ref, fields);
    return { status: 200, body: { rideId, tripNo: ride.tripNo, matched: operatorView(fields) } };
  });
}

function operatorView(ride) {
  return {
    id: String(ride.operatorId), name: ride.operatorName || '',
    car: ride.operatorCar || '', plate: ride.operatorPlate || '',
    lat: Number(ride.operatorLat), lng: Number(ride.operatorLng),
    etaMin: Number(ride.operatorEtaMin) || 0, miles: Number(ride.operatorMiles) || 0,
    demo: ride.operatorDemo === true,
  };
}

module.exports = { bookingId, prepareBooking, paymentMatches, assignPaidTravel };
