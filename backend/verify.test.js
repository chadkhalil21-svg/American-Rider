// Phone verification: the number goes to Twilio in the only shape it accepts, and "we could
// not check" never reads as "verified".
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const { ready, toE164 } = require(path.join(ROOT, 'verify.js'));

const R = [];
const check = (l, c, d) => R.push({ l, ok: !!c, d });

// ——— no credentials, no feature ———————————————————————————————————————————————
// Every integration in this directory behaves this way. A feature that half-exists is worse
// than one that is plainly absent.
check('without credentials the feature reports itself off', ready() === false);

// ——— E.164, because Twilio refuses anything else ——————————————————————————————
check('a US ten-digit number is normalised', toE164('(305) 555-0134') === '+13055550134');
check('spaces and dashes are removed', toE164('305-555-0134') === '+13055550134');
check('a leading 1 is understood', toE164('1 305 555 0134') === '+13055550134');
check('an international number is passed through', toE164('+44 20 7183 8750') === '+442071838750');
check('letters are refused rather than guessed at', toE164('call me') === null);
check('empty is refused', toE164('') === null && toE164(null) === null);
check('too short is refused', toE164('+12') === null);
check('too long is refused', toE164('+1234567890123456789') === null);
// A nine-digit US number is a typo, not a number. Guessing a digit would send a code to a
// stranger's handset.
check('nine digits is refused, not padded', toE164('305 555 013') === null);

// ——— the failure direction ————————————————————————————————————————————————————
const src = fs.readFileSync(path.join(ROOT, 'verify.js'), 'utf8');
check('ok is returned ONLY on Twilio-approved',
  /r\.ok && body\.status === 'approved'/.test(src));
check('an unreachable Twilio is a failure, never a pass',
  /catch \(e\) \{\s*return \{ ok: false, code: 'check_failed'/.test(src));
check('no code is stored on our side', !/code:\s*digits\s*\}/.test(src) || !/collection\('verifications'\)/.test(src));

// ——— the route records it server-side ————————————————————————————————————————
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const route = (server.match(/app\.post\('\/verify\/check'[\s\S]*?\n\}\);/) || [''])[0];
check('POST /verify/check exists', route.length > 0);
check('it requires a signed-in traveler, so an SMS cannot be aimed at a stranger',
  /app\.post\('\/verify\/check', requireAuth/.test(server));
check('POST /verify/start requires auth too', /app\.post\('\/verify\/start', requireAuth/.test(server));
check('phoneVerified is written by the SERVER', /phoneVerified: true/.test(route));
check('the normalised number is stored, not what was typed', /mobile: out\.to/.test(route));
check('a failed write does not tell the traveler their correct code was wrong',
  /could not record verification/.test(route));
check('/health reports whether verification is configured', /phoneVerification: verifyReady\(\)/.test(server));

// ——— and a phone must not be able to forge it ————————————————————————————————
const rules = fs.readFileSync(path.join(ROOT, '..', 'firestore.rules'), 'utf8');
const users = (rules.match(/match \/users\/\{uid\} \{[\s\S]*?\n {4}\}/) || [''])[0];
const allowed = [...users.matchAll(/hasOnly\(\[([\s\S]*?)\]\)/g)].map((m) => m[1]).join(' ');
check('A PHONE CANNOT WRITE phoneVerified', !/'phoneVerified'/.test(allowed));

let bad = 0;
for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  — ' + (r.d || '')}`); }
console.log(`\n${R.length - bad}/${R.length} passed`);
process.exit(bad ? 1 : 0);
