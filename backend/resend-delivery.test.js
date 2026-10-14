'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  MAX_BODY, verifyResendWebhook, sanitizeResendEvent, applyResendDeliveryEvent,
} = require('./resend-delivery');

const reference = {
  secret: 'whsec_plJ3nmyCDGBKInavdOK15jsl',
  payload: '{"event_type":"ping","data":{"success":true}}',
  id: 'msg_loFOjxBNrRLzqYUf',
  timestamp: '1731705121',
  signature: 'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=',
};
function signatureFor(body, secret, id, timestamp) {
  const key = Buffer.from(secret.slice(6), 'base64');
  const bytes = crypto.createHmac('sha256', key).update(id + '.' + timestamp + '.')
    .update(body).digest('base64');
  return 'v1,' + bytes;
}
const signed = (body = reference.payload, opts = {}) => ({
  raw: Buffer.from(body),
  headers: {
    'svix-id': opts.id || reference.id,
    'svix-timestamp': opts.timestamp || reference.timestamp,
    'svix-signature': opts.signature || reference.signature,
  },
  secret: opts.secret || reference.secret,
  now: Number(reference.timestamp) * 1000,
});
function database() {
  const records = {
    insurance_status_requests: {
      req: { uid: 'op', email: 'broker@example.test',
        providerMessageId: 'message-1', deliveryStatus: 'accepted',
        usedAt: null, createdAt: 100 },
    },
    users: { op: { insuranceMonitoring: {
      status: 'verified_active', lastVerifiedAt: 1_000, verificationRequestedAt: 100,
      verificationRequestedTo: 'broker@example.test', verificationRequestCount: 1,
    } } },
  };
  let writes = 0, transactions = 0;
  const ref = (col, id) => ({ col, id });
  const snapshot = r => ({
    exists: !!records[r.col]?.[r.id],
    data: () => structuredClone(records[r.col][r.id]),
  });
  const db = {
    collection(col) {
      return {
        doc(id) { return ref(col, id); },
        where(field, operator, value) {
          assert.equal(field, 'providerMessageId');
          assert.equal(operator, '==');
          return { limit(n) {
            assert.equal(n, 2);
            return { get: async () => ({ docs: Object.entries(records[col] || {})
              .filter(([, v]) => v.providerMessageId === value)
              .slice(0, n).map(([id]) => ({ id, ref: ref(col, id) })) }) };
          } };
        },
      };
    },
    async runTransaction(fn) {
      transactions++;
      let wrote = false;
      const pending = [];
      const out = await fn({
        get: async r => {
          assert(!wrote, 'Firestore transaction reads must precede writes');
          return snapshot(r);
        },
        set(r, patch, { merge } = {}) {
          wrote = true;
          pending.push(() => {
            records[r.col] ||= {};
            records[r.col][r.id] = merge
              ? { ...(records[r.col][r.id] || {}), ...structuredClone(patch) }
              : structuredClone(patch);
            writes++;
          });
        },
      });
      for (const p of pending) p();
      return out;
    },
  };
  return { db, records, get writes() { return writes; }, get transactions() { return transactions; } };
}
async function main() {
  // This vector is published by Svix (2026-09-18). It is independent of our own signer.
  assert.equal(verifyResendWebhook(signed()).id, reference.id);
  assert.throws(() => verifyResendWebhook(signed(reference.payload + ' ')), /signature/);
  assert.throws(() => verifyResendWebhook(signed(undefined, {
    signature: reference.signature.replace('v1,', 'v2,') })), /signature/);
  assert.throws(() => verifyResendWebhook({ ...signed(), now: 2000 }), /stale/);
  assert.throws(() => verifyResendWebhook({
    ...signed(), raw: Buffer.alloc(MAX_BODY + 1),
  }), /body/);
  assert.throws(() => verifyResendWebhook({
    ...signed(), headers: { ...signed().headers, 'svix-id': '../forged' },
  }), /headers/);
  const packet = JSON.stringify({
    type: 'email.bounced', created_at: '2026-10-11T05:00:00.000Z',
    data: { email_id: 'message-1', from: 'American Rider Insurance Verification <insurance@americanrider.app>', to: ['broker@example.test'],
      bounce: { message: 'private provider information must not be stored' } },
  });
  const h = signed(packet, { signature: signatureFor(Buffer.from(packet),
    reference.secret, reference.id, reference.timestamp) });
  const verified = verifyResendWebhook(h);
  const clean = sanitizeResendEvent(verified.id, verified.event);
  assert.deepEqual(Object.keys(clean).sort(), ['emailId','eventAt','id','recipient','type']);
  assert(!JSON.stringify(clean).includes('private provider information'));
  assert.equal(sanitizeResendEvent('event1', { type: 'domain.created', data: {} }), null);
  assert.equal(sanitizeResendEvent('event2', { type: 'email.bounced', data: {
    email_id: 'message-1', from: 'receipts@americanrider.app',
  } }), null, 'ordinary receipts never enter the insurance provider queue');
  assert.throws(() => sanitizeResendEvent('event1',
    { type: 'email.sent', data: { email_id: '', from: 'insurance@americanrider.app' } }), /invalid email/);

  const h1 = database();
  const event = (type, time, extra = {}) => ({
    id: 'event-' + type, type, emailId: 'message-1', recipient: 'broker@example.test',
    eventAt: time, ...extra,
  });
  const delivered = await applyResendDeliveryEvent({
    db: h1.db, event: event('email.delivered', 1000), now: 2000,
  });
  assert.equal(delivered.updated, true);
  assert.equal(h1.records.insurance_status_requests.req.deliveryStatus, 'email.delivered');
  assert.equal((await applyResendDeliveryEvent({
    db: h1.db, event: event('email.sent', 900), now: 2001,
  })).ignored, true);
  assert.equal(h1.records.insurance_status_requests.req.deliveryStatus, 'email.delivered');
  assert.equal((await applyResendDeliveryEvent({
    db: h1.db, event: event('email.bounced', 1100), now: 2002,
  })).updated, true);
  assert.equal(h1.records.users.op.insuranceMonitoring.verificationIssue.kind,
    'insurance_verification_email_unreachable');
  assert.equal(h1.records.users.op.insuranceMonitoring.status, 'verified_active',
    'mail transport cannot cancel or renew policy');
  assert.equal(h1.records.users.op.insuranceMonitoring.lastVerifiedAt, 1000,
    'mail transport cannot extend independent verification');
  const writesBefore = h1.writes;
  assert.equal((await applyResendDeliveryEvent({
    db: h1.db, event: event('email.bounced', 1100), now: 2003,
  })).ignored, true);
  assert.equal(h1.writes, writesBefore, 'duplicate delivery events must not write');
  assert.equal((await applyResendDeliveryEvent({
    db: h1.db, event: event('email.delivery_delayed', 1200), now: 2004,
  })).ignored, true, 'delayed never overrides a permanent bounce');

  const h2 = database();
  h2.records.users.op.insuranceMonitoring.verificationRequestedAt = 200;
  await applyResendDeliveryEvent({ db: h2.db, event: event('email.bounced', 1100), now: 2000 });
  assert.equal(h2.records.users.op.insuranceMonitoring.verificationIssue, undefined,
    'stale request must not attach a new Operator issue');
  const h3 = database();
  h3.records.insurance_status_requests.req.usedAt = 111;
  await applyResendDeliveryEvent({ db: h3.db, event: event('email.bounced', 1100), now: 2000 });
  assert.equal(h3.records.users.op.insuranceMonitoring.verificationIssue, undefined,
    'already-confirmed request cannot create a new Operator action');
  const h4 = database();
  const beforeCorrelated = await applyResendDeliveryEvent({ db: h4.db, event: event('email.delivered', 10,
    { emailId: 'late-message-id' }) });
  assert.equal(beforeCorrelated.ok, false, 'provider event stays retryable until outbound send correlation is persisted');
  assert.equal(beforeCorrelated.reason, 'insurance_request_not_correlated_yet');
  assert.equal(h4.writes, 0, 'race must not invent an email request');
  // Simulate outbound Resend HTTP returning after the signed webhook already arrived:
  // the normal send path now stores its providerMessageId against the existing request.
  h4.records.insurance_status_requests.req.providerMessageId = 'late-message-id';
  const recovered = await applyResendDeliveryEvent({ db: h4.db,
    event: event('email.delivered', 10, { emailId: 'late-message-id' }), now: 20 });
  assert.equal(recovered.updated, true, 'durable retry recovers once the request ID is stored');
  assert.equal(h4.records.insurance_status_requests.req.deliveryStatus, 'email.delivered');
  assert.equal((await applyResendDeliveryEvent({ db: h4.db, event: event('email.delivered', 10,
    { emailId: 'late-message-id', recipient: 'unrelated@example.test' }) })).unmatched, true);
  assert.equal(h4.writes, 1, 'unmatched recipient cannot create a second write');

  // Cross-module ordering contract: the outgoing request stamp must be durable
  // before a message ID is exposed to the asynchronous webhook listener.
  const server = require('node:fs').readFileSync(require('node:path').join(__dirname, 'server.js'), 'utf8');
  const requestStart = server.indexOf('async function issueInsuranceConfirmationRequest');
  const requestEnd = server.indexOf('// --- Continuing Operator insurance status.', requestStart);
  assert(requestStart >= 0 && requestEnd > requestStart, 'find the actual insurance send workflow');
  const sendFlow = server.slice(requestStart, requestEnd);
  const stampPos = sendFlow.lastIndexOf('const resultingEligibility = await saveRequestMetadata();');
  const correlatePos = sendFlow.lastIndexOf('providerMessageId: sent.id || null');
  assert(stampPos >= 0 && correlatePos > stampPos,
    'the current user request stamp must be persisted before exposing providerMessageId');
  assert(sendFlow.includes('const snap=await tx.get(userRef)') &&
    sendFlow.includes('const current=latestUser.insuranceMonitoring||{}'),
    'outgoing insurance email must not overwrite a newer nonpayment/cancellation report');

  console.log('PASS Resend published Svix signature vector, tampering, timestamp, size and event minimization');
  console.log('PASS insurance email delivery, race recovery, bounce, duplicates, stale/confirmed request and zero policy-approval effects');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
