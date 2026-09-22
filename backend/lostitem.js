// Lost item — the case a report becomes.
//
// The report itself is a Firestore document the app writes (src/backend/lostitem.ts), naming
// the operators it concerns. Naming an operator is not telling them: the operator app has no
// lost item queue and cannot have one until an operator has an account identity
// (docs/OPEN-DECISIONS.md §4). Until it does, a person is the only path a lost bag actually
// has, so every report is also filed as a case — this module shapes that case, and the route
// in server.js files it. Kept apart from the route so the shape is testable without HTTP.

const { adminDb } = require('./firebase-admin');

const LOST_ITEM_REASON =
  'Lost item reported. No operator queue exists yet — a person carries this one.';

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

module.exports = { lostItemTicket, stampLostItemCase, LOST_ITEM_REASON };
