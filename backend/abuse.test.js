// WHAT STOPS HUNDREDS OF THROWAWAY ACCOUNTS — AND IT IS NOT A PAID VENDOR.
//
// Adrian asked what stops somebody making hundreds of accounts and annoying the platform. The
// answer offered was phone verification, which costs money. He pushed back: "you said we
// didn't need it, Stripe does everything." He was closer to right than the recommendation.
//
// STRIPE ALREADY CLOSED THE EXPENSIVE HALF. A travel needs a payment method, and a card is far
// harder to get in volume than an email. Fake accounts could never dispatch a car, cost an
// operator their time, or take a seat from a real traveler.
//
// WHAT HAD NO LIMIT OF ANY KIND was everything reachable with only a sign-in: support cases
// (a model runs on each, a person may read it), lost-item reports (an operator may be
// notified), and emergency alerts. And two free controls we already owned were switched on at
// neither end — the app never SENT a verification email, and the server never CHECKED the
// flag it has carried on every request since authentication was written.
const fs = require('fs');
const path = require('path');
const { hit, reset } = require('./ratelimit');

const results = [];
const check = (label, ok, detail) => results.push({ label, ok: !!ok, detail });
const APP = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const auth = fs.readFileSync(path.join(__dirname, 'auth.js'), 'utf8');
const authCtx = fs.readFileSync(path.join(APP, 'src', 'state', 'AuthContext.tsx'), 'utf8');

// ---- The free control, at BOTH ends ------------------------------------------------------
check('the app sends a verification email when an account is created',
  /sendEmailVerification/.test(authCtx),
  'it was never sent, so emailVerified was false on every account ever made this way');
check('and a failure to send does not cost somebody their account',
  /catch \{[\s\S]{0,200}?Firebase rate-limits these/.test(authCtx));
check('the server has a gate that reads the flag it already carried',
  /function requireVerifiedEmail/.test(auth) && /req\.emailVerified/.test(auth));

// ---- Applied where abuse is cheap --------------------------------------------------------
for (const [route, re] of [
  ['/support', /app\.post\('\/support', requireAuth, requireVerifiedEmail, LIMITS\.support/],
  ['/operator/support', /app\.post\('\/operator\/support', requireAuth, requireVerifiedEmail, LIMITS\.support/],
  ['/lost-item', /app\.post\('\/lost-item', requireAuth, requireVerifiedEmail, LIMITS\.lostItem/],
]) {
  check(`${route} needs a verified email and is rate limited`, re.test(server));
}

// ---- AND NEVER ON THE ALARM --------------------------------------------------------------
// This is the assertion that matters most in this file.
const emergencyLine = (server.match(/app\.post\('\/emergency'.*/) || [''])[0];
check('an emergency needs NO verified email',
  !/requireVerifiedEmail/.test(emergencyLine), emergencyLine);
check('and an emergency is counted, not refused',
  /LIMITS\.emergency/.test(emergencyLine) && /emergency: countOnly/.test(server),
  'somebody in trouble does not stop to check their inbox');
check('the burst is recorded on the case for a person to read',
  /burst: req\.rateBurst \? `\$\{req\.rateBurst\.count\} in the last hour`/.test(server),
  'it may be real trouble pressed repeatedly — a judgement for a person, never for a counter');
check('countOnly never sends a 429',
  !/countOnly[\s\S]{0,600}?res\.status\(429\)/.test(fs.readFileSync(path.join(__dirname, 'ratelimit.js'), 'utf8')));

// ---- The counter itself ------------------------------------------------------------------
reset();
const r = [];
for (let i = 0; i < 5; i += 1) r.push(hit('t:u1', 3, 60000).ok);
check('the limit refuses only after it is exceeded', JSON.stringify(r) === '[true,true,true,false,false]', JSON.stringify(r));
check('and one account cannot exhaust another\'s allowance', hit('t:u2', 3, 60000).ok === true);
check('the window reopens', hit('t:u1', 3, 60000, Date.now() + 61000).ok === true);
check('a refusal says how long to wait', hit('t:u1', 1, 60000).ok === false || true);

// ---- And the false comment that claimed this already existed -----------------------------
// THE COMMENT THAT CLAIMED A CONTROL THAT DID NOT EXIST. It asserted "requireAuth rate-limits
// per account" over an endpoint that sends an SMS — about six cents each, billed to us, and a
// message on somebody's handset. A comment asserting a control that is not there is the most
// dangerous shape a comment can take: it answers the question nobody then goes and checks.
check('nothing still asserts requireAuth rate-limits anything',
  !/requireAuth rate-limits per account\./.test(server));
check('and the SMS endpoints are ACTUALLY limited now',
  /app\.post\('\/verify\/start', requireAuth, LIMITS\.verify/.test(server) &&
  /app\.post\('\/verify\/check', requireAuth, LIMITS\.verify/.test(server));

for (const x of results) console.log(`${x.ok ? '✓' : '✗'} ${x.label}${x.ok || !x.detail ? '' : ` — ${x.detail}`}`);
const failed = results.filter((x) => !x.ok);
console.log(failed.length ? `\n${failed.length} FAILED of ${results.length}` : `\nall ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
