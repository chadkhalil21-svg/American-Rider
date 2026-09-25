// THE FEE SCHEDULE IS CHOSEN BY THE CARD, AND THE CHOICE MUST HAPPEN BEFORE THE QUOTE.
//
// Chad, 20 Sept 2026: read Stripe's card.country and stop charging the domestic traveler for
// the cost of an international card. The rule itself is proved in payments.test.js. What is
// proved here is the WIRING, which is where this kind of change actually fails:
//
//   - Stripe's country reaches us at all (describePaymentMethod keeps it),
//   - the quote endpoint asks who is calling (otherwise every quote is domestic),
//   - and the APP sends the token that lets it (otherwise the endpoint always answers null).
//
// The last two are read out of the source, because a route that silently stops identifying the
// caller still returns a perfectly good quote — at the wrong price. Nothing about that failure
// is visible at runtime until a traveler with a foreign card is charged more than they were
// quoted, which is the one defect AGENTS.md names as the most serious there is.
const fs = require('fs');
const path = require('path');
const { platformFeeCents, isDomesticCard, quote } = require('./payments');

const results = [];
const check = (label, ok, detail) => results.push({ label, ok: !!ok, detail });
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

// ---- The predicate --------------------------------------------------------------------
check('US is domestic', isDomesticCard('US'));
check('a missing country is international-safe — a first foreign card must not be under-priced',
  !isDomesticCard(undefined) && !isDomesticCard(null) && !isDomesticCard(''));
check('every other country is international',
  ['GB', 'FR', 'CA', 'MX', 'DE', 'JP', 'BR'].every((c) => !isDomesticCard(c)));

// ---- The schedules actually differ, or none of this wiring is worth anything ------------
check('the two card-cost schedules produce their audited $100 fees',
  platformFeeCents(10000, 'US') === 413 && platformFeeCents(10000, 'GB') === 577);
check('the $2 floor controls only where it really covers both schedules',
  platformFeeCents(500, 'US') === 200 && platformFeeCents(500, 'GB') === 200);
check('quote() carries card economics through to the traveler total',
  quote(10000, undefined, undefined, 'GB').travelerPays - quote(10000, undefined, undefined, 'US').travelerPays === 164);

// ---- Stripe's country survives the trip through our own shape ---------------------------
const payments = read('payments.js');
check('describePaymentMethod keeps card.country',
  /country:\s*card && typeof card\.country === 'string'/.test(payments),
  'payments.js no longer reads card.country onto the method');
check('defaultCardCountry returns null rather than throwing when Stripe cannot be reached',
  /async function defaultCardCountry[\s\S]{0,700}?catch\s*\{\s*\n?\s*return null;/.test(payments),
  'a Stripe outage must degrade to the international-safe quote, not block the quote');

// ---- The quote endpoint asks who is calling ---------------------------------------------
const server = read('server.js');
check("/fare-quote is wrapped in attachAuth",
  /app\.post\('\/fare-quote',\s*attachAuth/.test(server),
  'without it every signed-in quote would lose the known card-country input');
check('/fare-quote passes the card-country reader into the canonical fare authority',
  /authoritativeFare\(\{[\s\S]{0,250}?cardCountryFor: defaultCardCountry/.test(server),
  'the country is read and then dropped');
check('attachAuth never refuses a caller — the price must be visible before sign-in',
  /async function attachAuth[\s\S]{0,900}?next\(\);\s*\n\}/.test(read('auth.js')) &&
  !/async function attachAuth[\s\S]{0,900}?res\.status\(401\)/.test(read('auth.js')),
  'attachAuth must not 401; that is requireAuth\'s job');

// ---- And the app sends the token -----------------------------------------------------
const appFares = fs.readFileSync(path.join(__dirname, '..', 'src', 'backend', 'fares.ts'), 'utf8');
const quoteCall = appFares.slice(appFares.indexOf('/fare-quote') - 900, appFares.indexOf('/fare-quote') + 500);
check('the app sends its sign-in token with the fare quote',
  /Authorization: `Bearer \$\{token\}`/.test(quoteCall),
  'the server cannot choose a schedule for a caller it cannot identify');
check('and still quotes when nobody is signed in',
  /\.\.\.\(token \? \{ Authorization/.test(quoteCall),
  'the header must be conditional, not required');

for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.label}${r.ok || !r.detail ? '' : ` — ${r.detail}`}`);
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED of ${results.length}` : `\nall ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
