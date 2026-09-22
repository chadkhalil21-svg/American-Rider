// WHAT A TRAVELER IS OFFERED MUST MATCH WHAT WE CAN ACTUALLY SERVE.
//
// Found 20 Sept 2026 by opening the app as a traveler. The home screen offered Miami
// International Airport and PortMiami — refused by the server the instant a price was asked
// for, a dead end reached by tapping the most obvious row on the screen. And it offered Fort
// Lauderdale Airport, which was NOT refused, because the permit gate read the FEE registry and
// FLL has no fee record. That is the worse one: an operator sent to an airport in a county
// whose permit we do not hold, on our instruction, to collect somebody we had charged.
//
// Two lists, two files, two languages. This is the only thing stopping them drifting apart.
const fs = require('fs');
const path = require('path');
const { GOVERNMENT_FEES, RESTRICTED_PLACES, permitRequired, permitRequiredMessage } = require('./fees');

const results = [];
const check = (label, ok, detail) => results.push({ label, ok: !!ok, detail });
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'data.ts'), 'utf8');

// Every place the SERVER will refuse, taken from both of its lists.
const serverRestricted = [
  ...GOVERNMENT_FEES.filter((f) => f.permitted !== true).map((f) => ({ id: f.id, bbox: f.bbox })),
  ...RESTRICTED_PLACES.map((p) => ({ id: p.id, bbox: p.bbox })),
];
check('the server restricts at least the three places we know need permits',
  serverRestricted.length >= 3, `${serverRestricted.length}`);

// Every place the APP still offers, with its coordinates.
const offered = [...appSrc.matchAll(
  /\{ name: '([^']+)', short: '[^']*', cost: [0-9.]+, meta: '[^']*', lat: (-?[0-9.]+), lng: (-?[0-9.]+)(, permitRequired: true)? \}/g,
)].map((m) => ({ name: m[1], lat: Number(m[2]), lng: Number(m[3]), flagged: !!m[4] }));
check('the destination list was read', offered.length > 10, `${offered.length} places`);

// ---- THE ASSERTION THAT MATTERS -------------------------------------------------------
// Nothing the app offers as bookable may be somewhere the server will refuse.
const wrong = offered.filter((p) => !p.flagged && permitRequired(null, { lat: p.lat, lng: p.lng }));
check('no place offered to a traveler is one the server will refuse',
  wrong.length === 0, wrong.map((p) => p.name).join(', '));

// And the converse: nothing is hidden from travelers that the server would happily serve,
// which would be quietly losing business rather than quietly breaking a promise.
const overFlagged = offered.filter((p) => p.flagged && !permitRequired(null, { lat: p.lat, lng: p.lng }));
check('and nothing is withheld that the server would in fact serve',
  overFlagged.length === 0, overFlagged.map((p) => p.name).join(', '));

check('the three known places are flagged in the app',
  ['Miami International Airport', 'PortMiami · Cruise Terminal', 'Fort Lauderdale Airport']
    .every((n) => offered.find((p) => p.name === n)?.flagged),
  offered.filter((p) => p.flagged).map((p) => p.name).join(', '));
check('the app keeps no filtered copy of the destination list',
  !/export const BOOKABLE_PLACES/.test(appSrc),
  'both screens ask the server; a filtered copy nobody reads is dead code in a pricing file');

// SUPERSEDED THE SAME DAY, AND THE TEST SAYS SO RATHER THAN BEING DELETED. BOOKABLE_PLACES was
// the right fix for an hour: it stopped the app offering places the server would refuse. Then
// the destination list moved to the server entirely (backend/places.js), which fixes the same
// fault AND the larger one behind it — a Miami-Dade list shown to a traveler in Fort
// Lauderdale. Neither screen filters a compiled-in list any more; they ask.
for (const f of ['index.tsx', 'reserve.tsx']) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
  check(`${f} asks the server what can be booked rather than shipping a list`,
    /destinationsNear/.test(src) && !/BOOKABLE_PLACES/.test(src),
    'a list compiled into the app knows one city and needs App Review to learn another');
}

// ---- Fort Lauderdale specifically, because it is a different county and authority --------
check('Fort Lauderdale airport is refused at both ends',
  permitRequired({ lat: 26.0742, lng: -80.1506 }, null)?.end === 'pickup' &&
  permitRequired(null, { lat: 26.0742, lng: -80.1506 })?.end === 'destination');
check('and the refusal names it rather than a Miami-Dade place',
  /Fort Lauderdale/.test(permitRequiredMessage(permitRequired(null, { lat: 26.0742, lng: -80.1506 }))));
check('a restricted place records WHICH authority, because it is not always Miami-Dade',
  RESTRICTED_PLACES.every((p) => typeof p.authority === 'string' && p.authority.length > 0));

for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.label}${r.ok || !r.detail ? '' : ` — ${r.detail}`}`);
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED of ${results.length}` : `\nall ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
