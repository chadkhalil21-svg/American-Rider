'use strict';
// Resend delivers transport facts, NEVER policy standing. No provider event may authorize duty.
// Sources: https://resend.com/docs/webhooks/verify-webhooks-requests
//          https://docs.svix.com/receiving/verifying-payloads/how-manual
const crypto = require('node:crypto');
const MAX_BODY = 32 * 1024;
const CLOCK_SKEW_MS = 5 * 60_000;
const TYPES = new Set([
  'email.sent', 'email.delivered', 'email.delivery_delayed',
  'email.bounced', 'email.failed', 'email.suppressed', 'email.complained',
]);
const FINAL_FAILURES = new Set(['email.bounced', 'email.failed', 'email.suppressed', 'email.complained']);
const ranks = {
  accepted: 0, pending: 0, 'email.sent': 1, 'email.delivery_delayed': 2,
  'email.delivered': 3, 'email.bounced': 4, 'email.failed': 4,
  'email.suppressed': 4, 'email.complained': 4,
};
const cleanEmail = value => String(value || '').trim().toLowerCase();
const validId = id => /^[A-Za-z0-9_.:-]{1,160}$/.test(String(id || ''));
function verifyResendWebhook({ raw, headers, secret, now = Date.now() }) {
  if (!Buffer.isBuffer(raw) || !raw.length || raw.length > MAX_BODY) throw Error('invalid body');
  if (!/^whsec_[A-Za-z0-9+/=_-]{16,}$/.test(String(secret || ''))) throw Error('webhook not configured');
  const id = String(headers?.['svix-id'] || '');
  const timestamp = String(headers?.['svix-timestamp'] || '');
  const signature = String(headers?.['svix-signature'] || '');
  if (!validId(id) || !/^[0-9]{10,12}$/.test(timestamp) || signature.length > 2048) throw Error('invalid headers');
  const tsMs = Number(timestamp) * 1000;
  if (!Number.isSafeInteger(tsMs) || !Number.isFinite(now) || Math.abs(now - tsMs) > CLOCK_SKEW_MS) throw Error('stale timestamp');
  const base64 = secret.slice('whsec_'.length).replace(/-/g, '+').replace(/_/g, '/');
  const expected = crypto.createHmac('sha256', Buffer.from(base64, 'base64'))
    .update(id + '.' + timestamp + '.').update(raw).digest();
  const match = signature.split(' ').filter(Boolean).some(item => {
    if (!item.startsWith('v1,')) return false;
    const supplied = item.slice(3);
    if (!/^[A-Za-z0-9+/]{43}=$/.test(supplied)) return false;
    const candidate = Buffer.from(supplied, 'base64');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  });
  if (!match) throw Error('signature invalid');
  let parsed;
  try { parsed = JSON.parse(raw.toString('utf8')); } catch { throw Error('invalid JSON'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('invalid event');
  return { id, event: parsed };
}
function sanitizeResendEvent(id, payload) {
  const type = String(payload?.type || '');
  if (!TYPES.has(type)) return null;
  const emailId = String(payload?.data?.email_id || '');
  if (!validId(id) || !validId(emailId)) throw Error('invalid email event');
  const to = Array.isArray(payload?.data?.to) ? payload.data.to : [];
  const recipient = to.length === 1 ? cleanEmail(to[0]) : null;
  const at = Date.parse(String(payload?.created_at || payload?.data?.created_at || ''));
  return {
    id, type, emailId,
    recipient: recipient && recipient.length <= 254 ? recipient : null,
    eventAt: Number.isFinite(at) ? at : null,
  };
}
async function applyResendDeliveryEvent({ db, event, now = Date.now() }) {
  if (!db || !event || !TYPES.has(event.type) || !validId(event.emailId)) {
    return { ok: false, reason: 'unusable provider event' };
  }
  const q = await db.collection('insurance_status_requests')
    .where('providerMessageId', '==', event.emailId).limit(2).get();
  if (q.docs.length > 1) return { ok: false, reason: 'provider message is not unique' };
  if (!q.docs.length) return { ok: true, unmatched: true };
  const ref = q.docs[0].ref;
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: true, unmatched: true };
    const request = snap.data() || {};
    if (request.providerMessageId !== event.emailId ||
        (event.recipient && cleanEmail(request.email) !== event.recipient)) {
      return { ok: true, unmatched: true };
    }
    const prior = String(request.deliveryStatus || 'pending');
    if ((ranks[event.type] || 0) < (ranks[prior] || 0) ||
        ((ranks[event.type] || 0) === (ranks[prior] || 0) &&
         Number(request.deliveryEventAt || 0) >= Number(event.eventAt || now))) {
      return { ok: true, ignored: true };
    }
    tx.set(ref, {
      deliveryStatus: event.type, deliveryEventAt: event.eventAt || now,
      deliveryEventId: event.id, deliveryUpdatedAt: now,
    }, { merge: true });
    // A bounce means contact cannot receive this request, NOT that insurance has lapsed.
    // Only the latest pending request may set an Operator-facing action; older/out-of-order
    // events and a completed confirmation cannot alter current Operator state.
    if (FINAL_FAILURES.has(event.type) && !request.usedAt) {
      const userRef = db.collection('users').doc(String(request.uid || ''));
      const userSnap = await tx.get(userRef);
      if (userSnap.exists) {
        const u = userSnap.data() || {}, m = u.insuranceMonitoring || {};
        const isCurrent = cleanEmail(m.verificationRequestedTo) === cleanEmail(request.email) &&
          Number(m.verificationRequestedAt) === Number(request.createdAt);
        if (isCurrent) {
          const issue = {
            kind: 'insurance_verification_email_unreachable', at: now,
            requestId: ref.id, transportEvent: event.type,
            note: 'The provider contact cannot receive the confirmation request. Update the contact or use a verified alternate channel.',
          };
          tx.set(userRef, { insuranceMonitoring: { ...m, verificationIssue: issue } }, { merge: true });
        }
      }
    }
    return { ok: true, updated: true, status: event.type };
  });
}
module.exports = {
  MAX_BODY, CLOCK_SKEW_MS, TYPES, FINAL_FAILURES,
  verifyResendWebhook, sanitizeResendEvent, applyResendDeliveryEvent,
};
