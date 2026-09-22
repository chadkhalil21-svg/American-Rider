// NOTHING IN THE APP MAY ASSUME MIAMI.
//
// Adrian, 20 Sept 2026: "if someone opens the app in New York City, what would they see?" and
// "my concern is of when we want to go National, and or beyond."
//
// The destination list moving to the server fixed the visible half. The half underneath it was
// `const MARKET_SUFFIX = ', Miami, FL'`, appended to every loose search for every traveler on
// earth: somebody in New York typing "times square" had Apple asked about "times square,
// Miami, FL" FIRST, and somebody in Fort Lauderdale typing "las olas" — a street four miles
// away, inside our own market — was asked about Miami before their own city.
//
// This file exists because that constant was invisible. It was a sensible line when the market
// was one city, it stayed correct-looking for months, and nothing would ever have failed
// loudly. The next one will be written for the same good reason, so the test is written
// against the CLASS rather than the instance.
const fs = require('fs');
const path = require('path');

const results = [];
const check = (label, ok, detail) => results.push({ label, ok: !!ok, detail });
const APP = path.join(__dirname, '..');
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const codeOf = (rel) => stripComments(fs.readFileSync(path.join(APP, rel), 'utf8'));

// Files that decide WHERE something is. A city name in any of these is a market assumption.
const LOCATION_CODE = [
  'src/backend/fares.ts',
  'src/backend/destinations.ts',
  'app/reserve.tsx',
  'app/saved-place.tsx',
  'app/index.tsx',
];

// ---- No city is hardcoded into the search path -----------------------------------------
const CITYISH = /(['"`])[^'"`]*,\s*(Miami|Fort Lauderdale|New York|Orlando|Tampa|FL|NY)\s*['"`]/;
for (const f of LOCATION_CODE) {
  const code = codeOf(f);
  check(`${f} anchors no search to a named city`, !CITYISH.test(code),
    (code.match(CITYISH) || [])[0]);
}
check('the Miami suffix constant is gone entirely',
  !/MARKET_SUFFIX/.test(codeOf('src/backend/fares.ts')));

// ---- The anchor is the traveler's own position -------------------------------------------
const fares = codeOf('src/backend/fares.ts');
check('a loose search is anchored by reverse-geocoding the traveler',
  /reverseGeocodeAsync/.test(fares));
check('and the anchor is built from the place Apple names, not from a constant',
  /place\?\.city \|\| place\?\.subregion/.test(fares));
check('an unresolvable anchor searches UNANCHORED rather than defaulting to a city',
  /return '';/.test(fares) && /: \[q\];/.test(fares),
  'a wrongly anchored search reliably returns the wrong city, which is worse than a loose one');
check('geocodePlace takes where the traveler is',
  /export async function geocodePlace\(query: string, near: Coords \| null/.test(fares));

// ---- Every call site passes it -----------------------------------------------------------
for (const f of ['app/reserve.tsx', 'app/saved-place.tsx']) {
  const code = codeOf(f);
  const calls = code.match(/geocodePlace\([^)]*\)/g) || [];
  check(`${f} anchors every geocode call (${calls.length} found)`,
    calls.length > 0 && calls.every((c) => /,/.test(c)),
    calls.filter((c) => !/,/.test(c)).join(' | '));
}

// ---- And the destination list is asked for, never shipped --------------------------------
for (const f of ['app/index.tsx', 'app/reserve.tsx']) {
  check(`${f} asks the server which places exist near the traveler`,
    /destinationsNear/.test(codeOf(f)));
}

// ---- What a traveler outside every market is told ----------------------------------------
const market = codeOf('backend/market.js');
check('an out-of-market answer names no city, so it reads the same in every one',
  !/Miami|Florida/.test(market.split('function outsideMarketMessage')[1] || ''),
  'the message is about us, not about where they happen to be standing');

for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.label}${r.ok || !r.detail ? '' : ` — ${r.detail}`}`);
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED of ${results.length}` : `\nall ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
