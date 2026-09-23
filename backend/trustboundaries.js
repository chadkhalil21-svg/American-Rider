const LIVE_TRAVEL = Object.freeze(['assigned', 'accepted', 'arrived', 'onboard']);

const fail = (status, error, code) => ({ ok: false, status, error, code });

async function authorizeVoiceTravel({ db, uid, rideId }) {
  const id = String(rideId || '');
  if (!id) return fail(400, 'rideId is required', 'ride_required');
  const snap = await db.collection('rides').doc(id).get();
  if (!snap.exists) return fail(404, 'No such travel', 'no_travel');
  const ride = snap.data() || {};
  const side = String(ride.travelerUid || '') === String(uid) ? 'traveler'
    : String(ride.operatorId || '') === String(uid) ? 'operator' : null;
  if (!side) return fail(403, 'You are not on that travel', 'not_your_travel');
  if (!LIVE_TRAVEL.includes(String(ride.status || ''))) {
    return fail(409, 'That travel is not underway', 'travel_not_live');
  }
  return { ok: true, ride, rideId: id, tripNo: String(ride.tripNo || ''), side };
}

async function lostItemTravel({ db, uid, lostItemId }) {
  const id = String(lostItemId || '');
  if (!id) return fail(400, 'lostItemId is required', 'item_required');
  const itemSnap = await db.collection('lost_items').doc(id).get();
  if (!itemSnap.exists) return fail(404, 'No such lost-item report', 'no_item');
  const item = itemSnap.data() || {};
  if (String(item.travelerUid || '') !== String(uid)) {
    return fail(403, 'That lost-item report belongs to another traveler', 'not_your_item');
  }
  if (!item.tripNo) return fail(409, 'The originating travel is not known', 'travel_unknown');
  const rides = await db.collection('rides').where('travelerUid', '==', String(uid))
    .where('tripNo', '==', String(item.tripNo)).limit(1).get();
  const doc = rides.docs[0];
  if (!doc) return fail(409, 'The originating travel cannot be verified', 'travel_unverified');
  return { ok: true, item, ride: doc.data() || {}, rideId: doc.id };
}

function authorizeAnnouncement({ ride, uid, event }) {
  const rules = {
    assigned: { status: 'assigned', uid: ride?.travelerUid },
    arrived: { status: 'arrived', uid: ride?.operatorId },
    completed: { status: 'completed', uid: ride?.operatorId },
  };
  const rule = rules[event];
  if (!rule) return fail(400, 'A known event is required', 'unknown_event');
  if (String(rule.uid || '') !== String(uid)) return fail(403, 'That event cannot be announced by this account', 'wrong_party');
  if (String(ride?.status || '') !== rule.status) return fail(409, 'The Travel state does not support that event', 'event_not_current');
  return { ok: true };
}

async function claimAnnouncement({ rideRef, uid, event, now = Date.now() }) {
  const claim = rideRef.collection('announcements').doc(event);
  try {
    await claim.create({ event, claimedAt: now, by: String(uid) });
    return { ok: true, claim };
  } catch (e) {
    if (e?.code === 6 || /already exists/i.test(String(e?.message))) return { ok: false, duplicate: true };
    throw e;
  }
}

module.exports = { LIVE_TRAVEL, authorizeVoiceTravel, lostItemTravel, authorizeAnnouncement, claimAnnouncement };
