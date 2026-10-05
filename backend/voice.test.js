const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const twilio = require('twilio');
const { ready, reason, accessToken, connectTwiml, identityFor, counterpartOf,
  callerForRide, verifiedTwilioWebhook } = require('./voice');
const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const rideId = 'a'.repeat(40);
const ride = { status: 'assigned', operatorId: 'current-operator-uid' };
const old = { ...ride, operatorId: 'previous-operator-uid' };
const from = identityFor(rideId, 'traveler', ride.operatorId);
const to = identityFor(rideId, 'operator', ride.operatorId);
assert.match(from, /^ar_[a-f0-9]{40}_[a-f0-9]{24}_traveler$/);
assert.equal(counterpartOf('traveler'), 'operator');
assert.equal(callerForRide(`client:${from}`, ride)?.side, 'traveler');
assert.equal(callerForRide(identityFor(rideId,'operator',old.operatorId), ride), null,
  'a previous Operator cannot call a replacement using a still-valid JWT');
assert.equal(callerForRide(identityFor(rideId,'traveler',old.operatorId), ride), null,
  'a stale Traveler token cannot ring the old Operator after a reoffer');
assert.equal(callerForRide(from, { ...ride, status: 'completed' }), null);
assert.equal(callerForRide('client:ar_' + rideId + '_operator', ride), null);
assert.match(connectTwiml({ rideId, side:'traveler', operatorUid:ride.operatorId }),
  new RegExp(`<Client>${to}<\\/Client>`));
assert.ok(!connectTwiml({ rideId, side:'traveler', operatorUid:ride.operatorId }).includes('current-operator-uid'));
assert.match(server, /authorizeVoiceTravel\(\{ db, uid: req\.uid, rideId \}\)/);
assert.match(server, /app\.post\('\/voice\/token', requireAuth, LIMITS\.voice, requireFreshAuth/);
assert.match(server, /verifiedTwilioWebhook\(req\.headers\['x-twilio-signature'\], req\.body\)/);
assert.match(server, /callerForRide\(from, ride\)/);
assert.match(server, /express\.urlencoded\(\{ extended: false, limit: '16kb' \}\)/);
assert.match(server, /<Reject\/>/);
assert.equal(verifiedTwilioWebhook('', {}), false);
const names = ['TWILIO_ACCOUNT_SID','TWILIO_API_KEY_SID','TWILIO_API_KEY_SECRET',
  'TWILIO_TWIML_APP_SID','TWILIO_AUTH_TOKEN','TWILIO_CONNECT_WEBHOOK_URL'];
const saved = Object.fromEntries(names.map((k)=>[k,process.env[k]]));
try {
  Object.assign(process.env, {
    TWILIO_ACCOUNT_SID: 'AC'+'a'.repeat(32), TWILIO_API_KEY_SID:'SK'+'b'.repeat(32),
    TWILIO_API_KEY_SECRET:'c'.repeat(32), TWILIO_TWIML_APP_SID:'AP'+'d'.repeat(32),
    TWILIO_AUTH_TOKEN:'local-test-secret-not-a-live-account',
    TWILIO_CONNECT_WEBHOOK_URL:'https://calls.example.test/voice/connect',
  });
  assert.equal(ready(), true, reason() || 'ready');
  const minted = accessToken({ rideId, side:'operator', operatorUid:ride.operatorId });
  assert.equal(minted.ok, true, minted.error);
  assert.equal(minted.identity, to);
  assert.equal(minted.token.split('.').length, 3);
  const params = { From:`client:${to}`, To:`client:${from}` };
  const signed = twilio.getExpectedTwilioSignature(process.env.TWILIO_AUTH_TOKEN,
    process.env.TWILIO_CONNECT_WEBHOOK_URL, params);
  assert.equal(verifiedTwilioWebhook(signed,params), true);
  assert.equal(verifiedTwilioWebhook(signed,{ ...params, From:`client:${from}` }), false);
  assert.equal(verifiedTwilioWebhook('forged-signature',params), false);
  process.env.TWILIO_CONNECT_WEBHOOK_URL = 'http://calls.example.test/voice/connect';
  assert.equal(ready(), false); assert.match(reason(),/HTTPS/);
} finally {
  for (const [k,v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k]=v; }
}
console.log('PASS Voice JWT, signed webhook, current Operator assignment, completed-Travel rejection and no personal number');
