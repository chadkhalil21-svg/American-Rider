// Support tickets — the part that makes "a person has your case" true.
//
// The whole point of this file is that it CANNOT quietly fail. The old escalation told the
// traveler a specialist was responding and notified nobody; the fix is worthless if filing a
// ticket can fail silently and the screen still says help is coming. So every function here
// returns { ok } and the caller changes what the traveler is told based on it.
//
// Two destinations, deliberately:
//   1. Firestore — the durable record. Survives restarts, queryable, is the case history.
//   2. Email     — the alert. A record nobody looks at is not support.
//
// ⚠️ CORRECTION, 17 Aug 2026. This header used to say email was the only missing half and
// that `ok` reflected "the Firestore write alone, which means someone has to actually watch
// that collection". BOTH halves were missing. `firebase-admin` was never a dependency of
// this server, so the Firestore write never happened either, and fileTicket returned
// { ok:false } for every case it was ever given. Nobody was watching that collection because
// nothing was in it. Both destinations must be configured before real travel:
//   FIREBASE_SERVICE_ACCOUNT  (see backend/firebase-admin.js)  — the durable record
//   SUPPORT_EMAIL + RESEND_API_KEY                             — the alert
// /health reports whether each is actually working, so this cannot hide again.
const { readKey } = require('./env');
const { adminDb, adminStatus } = require('./firebase-admin');

// WAS: a require inside a try/catch that swallowed the reason, against a package that was
// not in package.json — so this returned false forever and every ticket silently vanished.
// See backend/firebase-admin.js for the full account of it.
const db = () => adminDb();

/** AR-C-XXXXXX. Short enough to read aloud, long enough not to collide. */
function newCaseNo() {
  const n = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
  return `AR-C-${n}`;
}

async function notifyByEmail(ticket) {
  const to = readKey('SUPPORT_EMAIL');
  const key = readKey('RESEND_API_KEY');
  if (!to || !key) return false; // not configured — the caller must not claim otherwise
  const emergency = ticket.kind === 'emergency';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'American Rider <support@americanrider.app>',
        to: [to],
        subject: emergency
          ? // First word in the inbox says what it is. Nothing else we send is capitalised
            // like this, so an emergency cannot be mistaken for a billing question.
            `EMERGENCY · ${ticket.caseNo} · ${ticket.trip?.no || 'no travel number'}`
          : `${ticket.caseNo} · Patron Support · ${ticket.trip?.no || 'no travel number'}`,
        text:
          `Case ${ticket.caseNo}\n` +
          `Traveler: ${ticket.email || ticket.uid}\n` +
          `Travel: ${ticket.trip?.no || '—'}  ${ticket.trip?.dep || '?'} → ${ticket.trip?.arr || '?'}\n` +
          `Charged: ${ticket.trip?.totalCents != null ? '$' + (ticket.trip.totalCents / 100).toFixed(2) : '—'}\n` +
          (emergency && ticket.emergency
            ? `Operator: ${ticket.emergency.operator || '—'}\n` +
              `Vehicle: ${ticket.emergency.vehicle || '—'}  PLATE ${ticket.emergency.plate || '—'}\n` +
              `Location: ${ticket.emergency.address || '—'}\n` +
              `Coordinates: ${
                ticket.emergency.coords
                  ? `${ticket.emergency.coords.lat}, ${ticket.emergency.coords.lng}`
                  : '—'
              }\n`
            : '') +
          `Routed to a person because: ${ticket.reason}\n\n` +
          `In the traveler's words:\n${ticket.description}\n`,
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * File a case. Returns { ok, caseNo }.
 * ok=false means NOBODY has been told — the caller must say that plainly.
 */
async function fileTicket({ uid, email, description, trip, reason, kind, emergency, category }) {
  const caseNo = newCaseNo();
  const ticket = {
    caseNo, uid: uid || null, email: email || null,
    description: String(description || '').slice(0, 4000),
    trip: trip || null, reason: reason || null,
    // What the traveler filed it under ('fare', 'route', 'cancel', 'safety'), when the app said.
    category: typeof category === 'string' && category ? category.slice(0, 40) : null,
    // 'support' or 'emergency'. An emergency is queried, sorted and alerted differently
    // from a fare question, so it is stamped rather than inferred from the wording.
    kind: kind || 'support',
    emergency: emergency || null,
    status: 'open', createdAt: Date.now(),
  };

  let stored = false;
  let failReason = adminStatus().reason;
  const d = db();
  if (d) {
    try {
      await d.collection('support_tickets').doc(caseNo).set(ticket);
      stored = true;
    } catch (e) {
      failReason = `Firestore write failed: ${e.message}`;
    }
  }

  const emailed = await notifyByEmail(ticket);

  // A case is only "reaching a person" if it is somewhere a person will find it.
  // `reason` is logged rather than returned to the app: the traveler needs to know it
  // failed, not why our credentials are wrong. But an operator of this server must be able
  // to find out in one place, so a failure is never silent again.
  if (!stored && !emailed) {
    console.error(
      `[tickets] case ${caseNo} REACHED NOBODY — ${failReason || 'email not configured'}`,
    );
  }
  return { ok: stored || emailed, caseNo, stored, emailed, failReason };
}

/**
 * Move an open emergency case's location on, as the vehicle moves.
 *
 * Only the traveler who opened the case may write to it — a case number is short enough to
 * guess, and nobody should be able to move somebody else's reported position.
 *
 * Returns { ok }. Best-effort by design: the app has already told the traveler where the
 * notification stands, and a dropped update must not change that.
 */
async function updateTicketLocation({ caseNo, uid, address, coords }) {
  const d = db();
  if (!d || !caseNo || !uid) return { ok: false };
  try {
    const ref = d.collection('support_tickets').doc(String(caseNo));
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.uid !== uid) return { ok: false };
    const existing = snap.data() || {};

    await ref.update({
      'emergency.address': address || null,
      'emergency.coords': coords || null,
      'emergency.locationAt': Date.now(),
    });

    // THE FIRST LOCATION HAS TO BE EMAILED, NOT JUST STORED.
    //
    // The alert fires the instant the emergency screen opens, which is the right thing —
    // a traveler who dials 911 and never returns to the app must still have been reported.
    // But at that instant the phone has not resolved its position yet (permission prompt,
    // then GPS), so the email that reaches a person said "Location: —". Every fix after
    // that only patched this document, which nobody re-reads. The one screen whose whole
    // purpose is answering "where are you" was telling our own team nothing.
    //
    // So: the first time a location lands on an emergency case, send it. Later movement
    // stays in the document — two emails is right, forty is noise.
    const hadLocation = !!(existing.emergency && (existing.emergency.address || existing.emergency.coords));
    if (!hadLocation && (address || coords) && existing.kind === 'emergency') {
      await notifyLocationByEmail({ ...existing, emergency: { ...existing.emergency, address, coords } });
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** The follow-up an emergency case sends the moment it learns where the traveler is. */
async function notifyLocationByEmail(ticket) {
  const to = readKey('SUPPORT_EMAIL');
  const key = readKey('RESEND_API_KEY');
  if (!to || !key) return false;
  const e = ticket.emergency || {};
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'American Rider <support@americanrider.app>',
        to: [to],
        subject: `EMERGENCY LOCATION · ${ticket.caseNo} · ${ticket.trip?.no || 'no travel number'}`,
        text:
          `Case ${ticket.caseNo} — the traveler's position has been established.\n\n` +
          `Location: ${e.address || '—'}\n` +
          `Coordinates: ${e.coords ? `${e.coords.lat}, ${e.coords.lng}` : '—'}\n` +
          (e.coords ? `Map: https://maps.google.com/?q=${e.coords.lat},${e.coords.lng}\n` : '') +
          `\nVehicle: ${e.vehicle || '—'}  PLATE ${e.plate || '—'}\n` +
          `Operator: ${e.operator || '—'}\n` +
          `Traveler: ${ticket.email || ticket.uid}\n\n` +
          `Later movement is recorded on the case document, not emailed.\n`,
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * The cases a traveler has filed, newest first — their own record of what they have asked us.
 *
 * Filtered by uid alone and sorted here: an orderBy beside a where needs a composite index,
 * and a support screen must not fail because one was not created. Each row is only what the
 * app prints — the case number, its kind, when it was filed, which travel it concerns and the
 * stored status. Never the description we were sent or the reason we recorded.
 */
async function listTickets(uid, { limit = 20, database } = {}) {
  const d = database || db();
  if (!d || !uid) return [];
  const snap = await d.collection('support_tickets').where('uid', '==', String(uid)).get();
  return snap.docs
    .map((doc) => (typeof doc.data === 'function' ? doc.data() : doc) || {})
    .filter((x) => x && x.caseNo)
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
    .slice(0, limit)
    .map((x) => ({
      caseNo: String(x.caseNo),
      kind: x.kind === 'emergency' ? 'emergency' : 'support',
      createdAt: Number(x.createdAt) || 0,
      tripNo: x.trip && typeof x.trip === 'object' && x.trip.no ? String(x.trip.no) : null,
      status: typeof x.status === 'string' && x.status ? x.status : 'open',
    }));
}

module.exports = { fileTicket, newCaseNo, updateTicketLocation, listTickets };
