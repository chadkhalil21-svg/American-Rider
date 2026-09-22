// Commissioning — the human decision that lets an operator carry travelers.
//
// WHAT THIS REPLACES. `app/operator/review.tsx` had a Continue button that commissioned the
// operator on the spot, in phone storage, labelled "Test program — review is simulated and
// clears at once". No person ever looked at anything, and no other device could see the
// result. The server now owns the decision, a founder makes it on /ops, and dispatch reads it.
//
// TWO HALVES, AND THEY ARE DIFFERENT KINDS OF CHECK.
//   1. Each document is READ (backend/documents.js): accept, hold or refuse. A hold is the
//      reader saying "a person must look at this", so /ops can accept or refuse a held
//      document by hand. The reader never accepts anything on its own authority beyond that.
//   2. The operator as a whole is COMMISSIONED by a person, on /ops, and only when all four
//      documents stand accepted and in date. That is the only path to `approved`.
//
// Pure functions only. The routes live in server.js and ops.js; these are what they share, so
// the submit gate, the approval gate and the go-on-duty gate cannot drift apart.

/** The four documents a person must see before an operator carries anybody. */
const REQUIRED_DOCS = ['license', 'registration', 'inspection', 'insurance'];

/** Has a document's own expiry date passed? No date on file is not expired — the reader refuses those. */
function docExpired(d, now = Date.now()) {
  if (!d || !d.expiry) return false;
  const end = Date.parse(`${d.expiry}T23:59:59Z`);
  return !Number.isNaN(end) && end < now;
}

/**
 * Where the four documents stand.
 *
 *   accepted  every one accepted and in date — the condition for approval and for duty
 *   reviewable no document missing or refused, but one or more held for a person
 *
 * Absence is not acceptance: a document never submitted is `missing`, never passed.
 */
function documentsStatus(documents, now = Date.now()) {
  const docs = documents || {};
  const missing = [];
  const held = [];
  const refused = [];
  const expired = [];
  for (const k of REQUIRED_DOCS) {
    const d = docs[k];
    if (!d || !d.verdict) missing.push(k);
    else if (d.verdict === 'refuse') refused.push(k);
    else if (docExpired(d, now)) expired.push(k);
    else if (d.verdict !== 'accept') held.push(k);
  }
  const accepted = !missing.length && !held.length && !refused.length && !expired.length;
  const reviewable = !missing.length && !refused.length && !expired.length;
  return { accepted, reviewable, missing, held, refused, expired };
}

/** Is this operator commissioned? Only a person's `approved` counts. */
function commissionCurrent(c) {
  return !!c && c.status === 'approved';
}

/** The words an operator reads when duty is refused for want of a commission. */
function commissionReason(c) {
  if (!c) return 'Your qualification has not been submitted for review.';
  if (c.status === 'pending') return 'Your qualification is under review. Travel cannot be assigned until it is approved.';
  if (c.status === 'refused') return c.reason || 'Your qualification was not approved.';
  return 'Your qualification is not approved.';
}

module.exports = { REQUIRED_DOCS, docExpired, documentsStatus, commissionCurrent, commissionReason };
