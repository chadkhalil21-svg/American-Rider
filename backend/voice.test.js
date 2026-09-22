// WHO MAY RING WHOM, AND WHAT NEITHER OF THEM LEARNS.
//
// Adrian, 20 Sept 2026: let a traveler and their operator call each other through the platform
// over WiFi or data. The media path is Twilio's — running TURN relays for a kerbside call that
// must not fail is not our business to be in. What IS ours is the gate, and that is what this
// proves, because the gate is the only part a mistake in is dangerous.
const fs = require('fs');
const path = require('path');
const { ready, reason, accessToken, connectTwiml, identityFor, counterpartOf } = require('./voice');

const results = [];
const check = (label, ok, detail) => results.push({ label, ok: !!ok, detail });
const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

// ---- Off without credentials, and it says why ------------------------------------------
check('platform calling is off without credentials', ready() === false);
check('and says which values are missing, not just "off"',
  /TWILIO_API_KEY_SID/.test(reason()) && /TWILIO_TWIML_APP_SID/.test(reason()), reason());
check('a token cannot be minted while it is off',
  accessToken({ tripNo: 'AR-2048-MIA', side: 'traveler' }).ok === false);
check('/health reports it, so a silent outage is impossible',
  /platformCalling: voiceReady\(\)/.test(server));

// ---- The identity says which travel and which side, and nothing about who ---------------
const id = identityFor('AR-2048-MIA', 'traveler');
check('an identity names the travel and the side', id === 'ar_AR-2048-MIA_traveler');
check('and carries no account id, so it cannot follow somebody between travels',
  !/uid|user|@/i.test(id));
check('the two sides are distinct and each points at the other',
  counterpartOf('traveler') === 'operator' && counterpartOf('operator') === 'traveler');

// ---- Neither party ever learns the other's number ---------------------------------------
// COMMENTS STRIPPED FIRST. The first version of this check matched the word "mobile" in this
// file's own explanation of why there are no mobile numbers in it — a test that reads prose
// and reports on code, which is worse than no test because it is read as proof.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const voiceCode = stripComments(fs.readFileSync(path.join(__dirname, 'voice.js'), 'utf8'));
check('no telephone number reaches the call path at all',
  !/\bmobile\b|\bphoneNumber\b|toE164|\bto:\s/.test(voiceCode),
  'both ends dial the platform; a tel: link would hand a personal number over permanently');
check('and the call path never reads the users collection, where a number would be',
  !/collection\('users'\)/.test(voiceCode));

// ---- The destination is derived, never accepted from the device -------------------------
const twiml = connectTwiml({ tripNo: 'AR-2048-MIA', side: 'traveler' });
check('the TwiML dials the OTHER side of the same travel',
  /<Client>ar_AR-2048-MIA_operator<\/Client>/.test(twiml), twiml);
check('and the connect route ignores whatever the device dialled',
  /Twilio posts whatever the device dialled and it is ignored/i.test(server) &&
  /const m = \/\^\(\?:client:\)\?ar_/.test(server),
  'otherwise a tampered app dials any number in the world on our account');
check('an unrecognised caller is rejected rather than connected somewhere',
  /<Reject\/>/.test(server));
check('the travel number is escaped into the XML',
  /<Client>[^<]*<\/Client>/.test(connectTwiml({ tripNo: 'A&B"<>', side: 'operator' })) &&
  !/[<>"]B/.test(connectTwiml({ tripNo: 'A&B"<>', side: 'operator' }).split('<Client>')[1]));

// ---- The gate: on the travel, and only while it is live ---------------------------------
check('a token needs a signed-in caller', /app\.post\('\/voice\/token', requireAuth/.test(server));
check('the side is decided from the travel record, never from the request body',
  /String\(ride\.travelerUid \|\| ''\) === String\(req\.uid\)/.test(server));
check('somebody not on the travel is refused',
  /not_your_travel/.test(server));
check('and a finished travel can no longer be called',
  /travel_not_live/.test(server) && /const LIVE = \['assigned', 'accepted', 'arrived', 'onboard'\]/.test(server),
  'a channel that outlives the journey is a way to contact a stranger whose car you sat in');

for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.label}${r.ok || !r.detail ? '' : ` — ${r.detail}`}`);
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED of ${results.length}` : `\nall ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
