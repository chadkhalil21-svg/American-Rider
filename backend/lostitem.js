// Lost item — the case a report becomes.
//
// The report itself is a Firestore document the app writes (src/backend/lostitem.ts), naming
// the operators it concerns. Naming an operator is not telling them: the operator app has no
// lost item queue and cannot have one until an operator has an account identity
// (docs/OPEN-DECISIONS.md §4). Until it does, a person is the only path a lost bag actually
// has, so every report is also filed as a case — this module shapes that case, and the route
// in server.js files it. Kept apart from the route so the shape is testable without HTTP.

const { adminDb } = require('./firebase-admin');
const { postPlatformMessage } = require('./platforminbox');

const LOST_ITEM_REASON =
  'Lost item reported. Operator recovery workflow opened; human support remains the fallback.';

const MAX_LISTED = 20;
const MAX_WORDS = 2000;

const list = (v) => (Array.isArray(v) ? v.slice(0, MAX_LISTED).map(String).join(', ') : '');

/**
 * Shape a lost item report into the case a specialist reads.
 *
 * body: { itemId, tripNo, travels, description, photoUrl, operators, trip }
 * Returns { error } when nothing can be filed (no description), else { trip, reason,
 * description } ready for fileTicket.
 */
function lostItemTicket(body) {
  const b = body && typeof body === 'object' ? body : {};
  const description = typeof b.description === 'string' ? b.description.trim() : '';
  if (!description) return { error: 'description is required' };

  const tripNo = typeof b.tripNo === 'string' && b.tripNo ? b.tripNo : null;
  const trip = b.trip && typeof b.trip === 'object' ? b.trip : { no: tripNo };
  const travels = list(b.travels);
  const operators = list(b.operators);
  const photo = typeof b.photoUrl === 'string' && b.photoUrl ? b.photoUrl : 'none attached';
  const itemId = typeof b.itemId === 'string' && b.itemId ? b.itemId : '—';

  return {
    trip,
    reason: LOST_ITEM_REASON,
    description:
      `LOST ITEM\n\n` +
      `In the traveler's words:\n${description.slice(0, MAX_WORDS)}\n\n` +
      `Travel: ${tripNo || `not sure which — ${travels || 'no travels listed'}`}\n` +
      `Operators named: ${operators || '—'}\n` +
      `Photo: ${photo}\n` +
      `Report: lost_items/${itemId}\n`,
  };
}

/**
 * Write the case number onto the report itself.
 *
 * The app learns the case number once, in the reply to POST /lost-item, and shows "which a
 * specialist is carrying. Case AR-C-…" under the Operator notified rung. The report document
 * never held it, so a report opened again later — from Patron Support — read "could not be
 * passed to a specialist" about a case that was filed. The app may not write `caseNo` itself
 * (firestore.rules lets a traveler touch only the return and the status), so the server does,
 * with admin access, and checks ownership first: a caller stamps only a report they filed.
 *
 * Best-effort, like the ticket: { ok }. The case is filed either way.
 */
async function stampLostItemCase({ itemId, uid, caseNo }, { database } = {}) {
  const d = database || adminDb();
  if (!d || !itemId || !uid || !caseNo) return { ok: false };
  try {
    const ref = d.collection('lost_items').doc(String(itemId));
    const snap = await ref.get();
    if (!snap.exists || (snap.data() || {}).travelerUid !== uid) return { ok: false };
    await ref.update({ caseNo: String(caseNo) });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

async function notifyLostItemOperators({ itemId, uid }, { database, postMessage } = {}) {
  const d = database || adminDb();
  const send = postMessage || postPlatformMessage;
  if (!d || !itemId || !uid) return { ok: false, delivered: 0 };
  const ref = d.collection('lost_items').doc(String(itemId));
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, delivered: 0 };
  const item = snap.data() || {};
  if (item.travelerUid !== uid) return { ok: false, delivered: 0 };
  const ids = Array.from(new Set(Array.isArray(item.notifiedOperatorIds) ? item.notifiedOperatorIds.map(String).filter(Boolean) : []));
  let delivered = 0;
  for (const operatorUid of ids) {
    const out = await send({
      uid: operatorUid,
      category: 'support',
      title: 'Lost item report',
      body: item.tripNo
        ? `A Traveler reported an item from Travel ${item.tripNo}. Please check the vehicle and record what you find.`
        : 'A Traveler reported an item that may be from one of your recent Travels. Please check the report and record what you find.',
      action: { screen: `/operator/lost-item?itemId=${encodeURIComponent(String(itemId))}` },
      required: true,
    }).catch(() => ({ ok: false }));
    if (out?.ok) delivered += 1;
  }
  const patch = {
    operatorDeliveryCount: delivered,
    operatorDeliveryAt: delivered > 0 ? Date.now() : null,
  };
  if (delivered > 0) {
    patch.status = 'operator-notified';
    patch.statusAt = Date.now();
  }
  await ref.set(patch, { merge: true });
  return { ok: delivered > 0, delivered, expected: ids.length };
}

async function operatorLostItem({ itemId, operatorUid }, { database } = {}) {
  const d = database || adminDb();
  if (!d || !itemId || !operatorUid) return { ok: false, status: 503, error: 'Lost-item service unavailable' };
  const snap = await d.collection('lost_items').doc(String(itemId)).get();
  if (!snap.exists) return { ok: false, status: 404, error: 'Report not found' };
  const item = snap.data() || {};
  const ids = Array.isArray(item.notifiedOperatorIds) ? item.notifiedOperatorIds.map(String) : [];
  if (!ids.includes(String(operatorUid))) return { ok: false, status: 403, error: 'Not authorized for this report' };
  const candidateTripNos = Array.isArray(item.candidateTripNos) ? item.candidateTripNos.map(String) : [];
  return {
    ok: true,
    item: {
      id: String(itemId),
      tripNo: item.tripNo || null,
      candidateTripNos,
      description: String(item.description || '').slice(0, 2000),
      status: item.status || 'reported',
      response: item.operatorResponses?.[String(operatorUid)] || null,
      photoObjectKey: item.photoObjectKey || null,
      createdAt: Number(item.createdAt || 0),
    },
  };
}

async function respondLostItem({ itemId, operatorUid, outcome, tripNo }, { database } = {}) {
  const d = database || adminDb();
  if (!d || !itemId || !operatorUid) return { ok: false, status: 503, error: 'Lost-item service unavailable' };
  if (!['located', 'not-found'].includes(outcome)) return { ok: false, status: 400, error: 'Outcome must be located or not-found' };
  const ref = d.collection('lost_items').doc(String(itemId));
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, status: 404, error: 'Report not found' };
  const item = snap.data() || {};
  const ids = Array.isArray(item.notifiedOperatorIds) ? item.notifiedOperatorIds.map(String) : [];
  if (!ids.includes(String(operatorUid))) return { ok: false, status: 403, error: 'Not authorized for this report' };
  const candidates = Array.isArray(item.candidateTripNos) ? item.candidateTripNos.map(String) : [];
  let boundTrip = item.tripNo || null;
  if (outcome === 'located') {
    if (!boundTrip) {
      if (!tripNo || !candidates.includes(String(tripNo))) return { ok: false, status: 400, error: 'Select the Travel in which the item was found' };
      const ride = await d.collection('rides').where('tripNo', '==', String(tripNo)).limit(1).get();
      const rideDoc = ride.docs?.[0];
      if (!rideDoc || String((rideDoc.data() || {}).operatorId || '') !== String(operatorUid)) {
        return { ok: false, status: 403, error: 'That Travel is not assigned to this Operator' };
      }
      boundTrip = String(tripNo);
    }
  }
  const now = Date.now();
  const responses = { ...(item.operatorResponses || {}), [String(operatorUid)]: { outcome, tripNo: boundTrip, at: now } };
  const patch = { operatorResponses: responses, statusAt: now };
  if (outcome === 'located') {
    patch.status = 'located';
    patch.tripNo = boundTrip;
    patch.locatedByOperatorId = String(operatorUid);
  } else {
    const everyAnsweredNotFound = ids.length > 0 && ids.every((id) => responses[id]?.outcome === 'not-found');
    patch.status = everyAnsweredNotFound ? 'not-found' : 'operator-notified';
  }
  await ref.set(patch, { merge: true });
  await postPlatformMessage({
    uid: item.travelerUid,
    category: 'support',
    title: outcome === 'located' ? 'Your item was located' : 'Lost item update',
    body: outcome === 'located'
      ? 'The Operator located the item. Open the report to arrange its return.'
      : (patch.status === 'not-found' ? 'The Operators connected with this report did not locate the item.' : 'One Operator checked and did not locate the item. Other checks remain open.'),
    action: { screen: `/lost?itemId=${encodeURIComponent(String(itemId))}` },
    required: true,
  }).catch(() => {});
  return { ok: true, status: patch.status, tripNo: boundTrip };
}

module.exports = {
  lostItemTicket, stampLostItemCase, notifyLostItemOperators, operatorLostItem, respondLostItem, LOST_ITEM_REASON,
};
