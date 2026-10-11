'use strict';
// Resend delivery status is transport evidence, NEVER insurer policy confirmation.
// Reuse the existing retryable provider inbox and operator insurance case records.
const { adminDb } = require('./firebase-admin');
const { normalizeEmail, policyFingerprint } = require('./insurance-contact-trust');
const STATES = Object.freeze({
  'email.sent': 'sent', 'email.delivery_delayed': 'delivery_delayed',
  'email.delivered': 'delivered', 'email.bounced': 'bounced',
  'email.failed': 'failed', 'email.complained': 'complained',
  'email.suppressed': 'suppressed',
});
const RANK = Object.freeze({ pending:0, accepted:0, sent:1,
  delivery_delayed:2, delivered:3, bounced:4, failed:4, complained:4, suppressed:4 });
const TERMINAL = new Set(['bounced', 'failed', 'complained', 'suppressed']);
const DELIVERY_ISSUES = new Set(['email_bounced','email_failed','email_complained','email_suppressed']);
async function handleResendDeliveryEvent(event, { db = adminDb(), now = Date.now() } = {}) {
  const kind = STATES[event?.type];
  const messageId = String(event?.data?.email_id || '');
  const recipient = normalizeEmail(event?.data?.recipient);
  if (!kind || !messageId || !recipient) return { ok:true, ignored:true };
  if (!db) return { ok:false, reason:'email delivery database unavailable' };
  const found = await db.collection('insurance_status_requests')
    .where('providerMessageId','==',messageId).limit(2).get();
  if (!found.docs.length) return { ok:true, ignored:true };
  if (found.docs.length !== 1) return { ok:false, reason:'ambiguous email provider ID' };
  const requestRef = found.docs[0].ref;
  return db.runTransaction(async tx => {
    const snap = await tx.get(requestRef);
    if (!snap.exists) return { ok:true, ignored:true };
    const row = snap.data() || {};
    if (row.providerMessageId !== messageId ||
        normalizeEmail(row.email) !== recipient) return { ok:true, ignored:true };
    const oldRank = RANK[String(row.deliveryStatus || 'pending')] ?? 0;
    if (oldRank >= RANK[kind]) return { ok:true, unchanged:true };
    let userRef=null, eligible=false;
    if (TERMINAL.has(kind) && row.uid) {
      userRef = db.collection('users').doc(String(row.uid));
      const userSnap = await tx.get(userRef);
      const m = userSnap.exists ? userSnap.data()?.insuranceMonitoring : null;
      eligible = !!m && Number(m.verificationRequestedAt) === Number(row.createdAt) &&
        normalizeEmail(m.verificationRequestedTo) === recipient &&
        !!row.policyFingerprint && row.policyFingerprint === policyFingerprint(m) &&
        !(Number(m.lastVerifiedAt) >= Number(row.createdAt)) &&
        (!m.verificationIssue || DELIVERY_ISSUES.has(m.verificationIssue.kind)) &&
        !['cancelled','nonrenewed','pending_cancellation','coverage_reduced','vehicle_removed']
          .includes(String(m.status || ''));
    }
    tx.set(requestRef, {
      deliveryStatus: kind, deliveryUpdatedAt:now,
      deliveryEventId:String(event.id || '').slice(0,180),
    }, { merge:true });
    if (eligible) {
      // A bounce requests contact repair. It does not change eligibility, status,
      // lastVerifiedAt, or the statutory 35-day maximum age.
      tx.update(userRef, {'insuranceMonitoring.verificationIssue': {
        kind:'email_' + kind, at:now, source:'resend_delivery_feedback',
        note:'The policy-status email was not delivered. Correct the contact or use an independently verified alternative.',
      }});
    }
    return { ok:true, deliveryStatus:kind, operatorActionRequired:eligible };
  });
}
module.exports={STATES,RANK,handleResendDeliveryEvent};
