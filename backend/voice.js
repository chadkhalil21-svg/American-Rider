// One live Travel, one current Operator assignment, two ephemeral calling identities.
// An old Operator's JWT remains cryptographically valid until expiry; assignment-specific
// identities and a fresh Travel read on every TwiML request prevent reoffer from reconnecting it.
const { createHash } = require('node:crypto');
const { readKey } = require('./env');

const SID = () => readKey('TWILIO_ACCOUNT_SID');
const API_KEY = () => readKey('TWILIO_API_KEY_SID');
const API_SECRET = () => readKey('TWILIO_API_KEY_SECRET');
const TWIML_APP = () => readKey('TWILIO_TWIML_APP_SID');
const AUTH_TOKEN = () => readKey('TWILIO_AUTH_TOKEN');
const WEBHOOK_URL = () => readKey('TWILIO_CONNECT_WEBHOOK_URL');
function serverSdkPresent() { try { require.resolve('twilio'); return true; } catch { return false; } }
function webhookUrlValid() {
  try { const url = new URL(WEBHOOK_URL() || ''); return url.protocol === 'https:' &&
    url.pathname === '/voice/connect' && !url.search && !url.hash; } catch { return false; }
}
const ready = () => !!(SID() && API_KEY() && API_SECRET() && TWIML_APP() && AUTH_TOKEN() && webhookUrlValid() && serverSdkPresent());
function reason() {
  if (ready()) return null;
  return `Platform calling is not configured: ${[
    !SID() && 'TWILIO_ACCOUNT_SID', !API_KEY() && 'TWILIO_API_KEY_SID',
    !API_SECRET() && 'TWILIO_API_KEY_SECRET', !TWIML_APP() && 'TWILIO_TWIML_APP_SID',
    !AUTH_TOKEN() && 'TWILIO_AUTH_TOKEN', !webhookUrlValid() && 'TWILIO_CONNECT_WEBHOOK_URL (HTTPS /voice/connect)',
    !serverSdkPresent() && 'Twilio server SDK not installed',
  ].filter(Boolean).join(', ')}.`;
}

// The suffix reveals neither uid nor a stable cross-Travel identity. It changes on reoffer.
function assignmentFor(rideId, operatorUid) {
  if (!rideId || !operatorUid) return null;
  return createHash('sha256').update(`${rideId}:${operatorUid}`).digest('hex').slice(0, 24);
}
function identityFor(rideId, side, operatorUid) {
  const assignment = assignmentFor(rideId, operatorUid);
  if (!assignment) return null;
  return `ar_${String(rideId)}_${assignment}_${side === 'operator' ? 'operator' : 'traveler'}`;
}
const counterpartOf = (side) => side === 'operator' ? 'traveler' : 'operator';
function callerForRide(from, ride) {
  const m = /^(?:client:)?ar_([a-f0-9]{40})_([a-f0-9]{24})_(traveler|operator)$/.exec(String(from || ''));
  if (!m || !ride || !['assigned', 'accepted', 'arrived', 'onboard'].includes(String(ride.status))) return null;
  const actual = String(from).replace(/^client:/, '');
  if (actual !== identityFor(m[1], m[3], ride.operatorId)) return null;
  return { rideId: m[1], side: m[3] };
}
function verifiedTwilioWebhook(signature, params) {
  if (!ready() || typeof signature !== 'string' || !signature) return false;
  try { return require('twilio').validateRequest(AUTH_TOKEN(), signature, WEBHOOK_URL(), params || {}); }
  catch { return false; }
}
function accessToken({ rideId, side, operatorUid, ttlSeconds = 3600 }) {
  if (!ready()) return { ok: false, error: reason(), code: 'voice_not_configured' };
  const identity = identityFor(rideId, side, operatorUid);
  if (!identity) return { ok: false, error: 'An assigned Travel is required', code: 'no_assignment' };
  try {
    const { AccessToken } = require('twilio').jwt;
    const token = new AccessToken(SID(), API_KEY(), API_SECRET(), {
      identity, ttl: Math.min(3600, Math.max(60, ttlSeconds)),
    });
    token.addGrant(new AccessToken.VoiceGrant({ outgoingApplicationSid: TWIML_APP(), incomingAllow: true }));
    return { ok: true, token: token.toJwt(), identity };
  } catch (e) { return { ok: false, error: e?.message || String(e), code: 'voice_failed' }; }
}
function connectTwiml({ rideId, side, operatorUid }) {
  const to = identityFor(rideId, counterpartOf(side), operatorUid);
  if (!to) return '<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>';
  // Derived from the saved assignment, never the dialed To or any client-supplied number.
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial answerOnBridge="true" timeout="30"><Client>${to}</Client></Dial></Response>`;
}
module.exports = { ready, reason, accessToken, connectTwiml, identityFor, assignmentFor,
  counterpartOf, callerForRide, verifiedTwilioWebhook };
