'use strict';
// Verify raw, signed Resend delivery callbacks before enqueuing events.
// Primary source: https://resend.com/changelog/managing-webhooks-via-api
const crypto = require('node:crypto');
const EVENT_TYPES = new Set([
  'email.sent', 'email.delivered', 'email.delivery_delayed',
  'email.failed', 'email.bounced', 'email.complained', 'email.suppressed',
]);
function verifyResendEvent(raw, headers, secret, now = Date.now()) {
  if (!Buffer.isBuffer(raw) || raw.length < 1 || raw.length > 32768)
    throw new Error('invalid payload');
  const id = String(headers.id || '');
  const stamp = String(headers.timestamp || '');
  const signature = String(headers.signature || '');
  if (!/^[a-zA-Z0-9_:-]{1,180}$/.test(id) || !/^\d{10}$/.test(stamp) ||
      !Number.isFinite(now) || Math.abs(now / 1000 - Number(stamp)) > 300)
    throw new Error('invalid callback identity or time');
  const encoded = String(secret || '').replace(/^whsec_/, '');
  if (!/^[a-zA-Z0-9+/]+={0,2}$/.test(encoded)) throw new Error('missing signing key');
  const key = Buffer.from(encoded, 'base64');
  if (key.length < 24) throw new Error('invalid signing key');
  const expected = crypto.createHmac('sha256', key)
    .update(Buffer.concat([Buffer.from(id + '.' + stamp + '.'), raw])).digest();
  const valid = signature.split(/\s+/).some(part => {
    const m = /^v1,([a-zA-Z0-9+/]+={0,2})$/.exec(part);
    if (!m) return false;
    const got = Buffer.from(m[1], 'base64');
    return got.length === expected.length && crypto.timingSafeEqual(got, expected);
  });
  if (!valid) throw new Error('invalid signature');
  let body;
  try { body = JSON.parse(raw.toString('utf8')); }
  catch { throw new Error('invalid JSON'); }
  if (!EVENT_TYPES.has(body?.type)) return null;
  const emailId = String(body?.data?.email_id || '');
  const recipients = body?.data?.to;
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(emailId) ||
      !Array.isArray(recipients) || recipients.length !== 1 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(recipients[0])))
    throw new Error('invalid email event identity');
  return { id, type: body.type, data: {
    email_id: emailId, recipient: String(recipients[0]).trim().toLowerCase(),
  } };
}
module.exports = { verifyResendEvent, EVENT_TYPES };
