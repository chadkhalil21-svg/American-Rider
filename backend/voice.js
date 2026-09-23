// Calling between a traveler and their operator, over WiFi or data — Twilio Voice.
//
// WHY IT EXISTS (Adrian, 20 Sept 2026): "for calls, may you build something that allows them
// to call each other through our platform using WiFi or data?"
//
// AND WHY IT REVERSES LAST NIGHT'S ADVICE, which should be said plainly. On 19 September the
// recommendation was NOT to buy Twilio yet, because the traveler's mobile number was written
// at sign-up and read by nothing: verifying a field nothing consumes is ceremony. The
// condition attached to that advice was "wire the number into something that uses it, and then
// verification earns its keep". Calling IS that something. The requirement changed, so the
// answer changes — one Twilio account now carries the call AND the verification behind it.
//
// WHY NOT BUILD THE TELEPHONY OURSELVES. WebRTC between two phones needs a signalling server,
// STUN, and TURN relays for the majority of mobile networks that will not connect peer to
// peer — and a kerbside call that fails is worse than no call button, because somebody is
// standing in the street relying on it. Buying the media path is cheaper than running one, and
// the part that is genuinely ours is who may call whom, which is below.
//
// NEITHER PARTY EVER LEARNS THE OTHER'S NUMBER. Both sides dial the platform, not each other.
// A traveler gets an operator's mobile number nowhere in this file, and an operator gets a
// traveler's nowhere either — which is the point of routing it through us rather than showing
// a tel: link, and it survives the travel ending.
//
// NO CREDENTIALS, NO FEATURE, AND THE APP IS TOLD SO. Same rule as Verify, Checkr, Resend and
// Stripe: ready() is false without the four values, the routes answer 503 with a reason, and
// /health reports it — because a call button that silently does nothing is the worst possible
// version of this.
//
// THE APP HALF IS A NATIVE DEPENDENCY AND IS NOT PRETENDED AT HERE. Placing a VoIP call needs
// @twilio/voice-react-native-sdk, which is a native module: it requires a prebuild, and on iOS
// it needs CallKit and the VoIP push entitlement so a call can ring when the app is closed.
// That is a real piece of work and it is listed as such rather than stubbed, because a stub
// that answers "calling" and does nothing is the defect this codebase keeps finding.
const { readKey } = require('./env');

const SID = () => readKey('TWILIO_ACCOUNT_SID');
const API_KEY = () => readKey('TWILIO_API_KEY_SID');
const API_SECRET = () => readKey('TWILIO_API_KEY_SECRET');
const TWIML_APP = () => readKey('TWILIO_TWIML_APP_SID');

/** Is platform calling configured at all? `/health` reports this so a silent outage cannot happen. */
const ready = () => !!(SID() && API_KEY() && API_SECRET() && TWIML_APP());

/** Why it is off, in words a founder can act on rather than a boolean. */
function reason() {
  if (ready()) return null;
  const missing = [
    !SID() && 'TWILIO_ACCOUNT_SID',
    !API_KEY() && 'TWILIO_API_KEY_SID',
    !API_SECRET() && 'TWILIO_API_KEY_SECRET',
    !TWIML_APP() && 'TWILIO_TWIML_APP_SID',
  ].filter(Boolean);
  return `Platform calling is not configured: ${missing.join(', ')} not set.`;
}

/**
 * The identity a party uses on a call, and the only thing the other end ever sees.
 *
 * SCOPED TO ONE TRAVEL, NOT TO A PERSON. 'ar_AR-2048-MIA_traveler' says which travel and which
 * side, and nothing about who. An identity that were the uid would follow somebody across
 * every travel they ever take and would be worth harvesting; this one stops being meaningful
 * the moment the travel ends.
 */
const identityFor = (rideId, side) => `ar_${String(rideId)}_${side === 'operator' ? 'operator' : 'traveler'}`;

/** The other end of a call on this travel. */
const counterpartOf = (side) => (side === 'operator' ? 'traveler' : 'operator');

/**
 * Mint a Voice access token for one party on one travel.
 *
 * WHO MAY CALL WHOM IS DECIDED BY THE CALLER, NOT BY THIS FUNCTION — the route checks the
 * signed-in uid against the travel record before asking for a token, because a token is
 * permission and permission must be granted where the facts are known.
 */
function accessToken({ rideId, side, ttlSeconds = 3600 }) {
  if (!ready()) return { ok: false, error: reason(), code: 'voice_not_configured' };
  if (!rideId) return { ok: false, error: 'A travel is required', code: 'no_travel' };

  let jwt;
  try {
    const twilio = require('twilio');
    const { AccessToken } = twilio.jwt;
    const { VoiceGrant } = AccessToken;
    const token = new AccessToken(SID(), API_KEY(), API_SECRET(), {
      identity: identityFor(rideId, side),
      ttl: Math.min(3600, Math.max(60, ttlSeconds)),
    });
    token.addGrant(new VoiceGrant({ outgoingApplicationSid: TWIML_APP(), incomingAllow: true }));
    jwt = token.toJwt();
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e), code: 'voice_failed' };
  }
  return { ok: true, token: jwt, identity: identityFor(rideId, side) };
}

/**
 * The TwiML that joins the two ends of a travel.
 *
 * IT IGNORES WHATEVER THE CALLER SENDS ABOUT WHO TO RING. Twilio posts the dialled value from
 * the device, and a device is not trusted: the destination is derived from the travel and the
 * side, so a tampered app cannot dial an arbitrary number through our account — which would be
 * our telephone bill and somebody else's harassment.
 */
function connectTwiml({ rideId, side }) {
  const to = identityFor(rideId, counterpartOf(side));
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response><Dial answerOnBridge="true" timeout="30"><Client>${esc(to)}</Client></Dial></Response>`;
}

module.exports = { ready, reason, accessToken, connectTwiml, identityFor, counterpartOf };
