// The assistant's destination list must equal the app's, exactly.
//
// WHY THIS FILE EXISTS. Three separate times a place name has been renamed in src/data.ts and
// left stale in a backend table, and every time it hid because the app normally prices and
// dispatches by COORDINATES — so the name-based paths are only exercised where geocoding is
// unavailable, or by the assistant, which nothing called until 25 Aug 2026.
//
// The damage was not subtle when it finally surfaced: the model returned 'Miami Airport', the
// app looked it up in PLACES, found nothing, and told the traveler "American Rider does not
// serve that destination yet" — about the busiest destination in the market.
//
// There is no shared source between a TypeScript app and a JavaScript server, so this test IS
// the link. Run: node backend/assistant.test.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const results = [];
const check = (label, ok, detail) => results.push({ label, ok: !!ok, detail });

// ---- Read the app's own list out of src/data.ts, rather than trusting a copy. -------------
const dataTs = fs.readFileSync(path.join(ROOT, 'src/data.ts'), 'utf8');
const placesBlock = dataTs.slice(
  dataTs.indexOf('export const PLACES'),
  dataTs.indexOf('];', dataTs.indexOf('export const PLACES')),
);
const appPlaces = [...placesBlock.matchAll(/short:\s*'([^']+)'/g)].map((m) => m[1]);
const homeShort = (dataTs.match(/HOME_PLACE[^=]*=\s*\{[^}]*short:\s*'([^']+)'/) || [])[1];

check('read the app place list', appPlaces.length >= 5, `found ${appPlaces.length}`);
check('read HOME_PLACE', !!homeShort, homeShort);

// ---- The assistant's list. ----------------------------------------------------------------
const assistantJs = fs.readFileSync(path.join(__dirname, 'assistant.js'), 'utf8');
const destBlock = assistantJs.slice(
  assistantJs.indexOf('const DESTINATIONS = ['),
  assistantJs.indexOf('];', assistantJs.indexOf('const DESTINATIONS = [')),
);
const assistantDests = [...destBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]);

const expected = [...appPlaces, homeShort].filter(Boolean);
const missing = expected.filter((p) => !assistantDests.includes(p));
const extra = assistantDests.filter((d) => !expected.includes(d));

check(
  'every bookable place is offered to the assistant',
  missing.length === 0,
  `missing: ${missing.join(', ')}`,
);
check(
  'the assistant offers nothing the app cannot book',
  extra.length === 0,
  `not in the app: ${extra.join(', ')}`,
);

// ---- The fare table must be able to price every one of them by NAME. ----------------------
const faresJs = fs.readFileSync(path.join(__dirname, 'fares.js'), 'utf8');
const unpriceable = expected.filter((p) => {
  if (p === 'Home') return false; // Home is priced from the traveler's own saved address.
  // Quoted or bare key, both are valid JS object keys.
  return !(faresJs.includes(`'${p}':`) || faresJs.includes(`\n  ${p}:`));
});
check(
  'every place the assistant can return has a fare by name',
  unpriceable.length === 0,
  `unpriceable: ${unpriceable.join(', ')}`,
);

// ---- The voice, which is a rubric requirement and not a preference. -----------------------
const systemPrompt = assistantJs.slice(
  assistantJs.indexOf('const SYSTEM = `'),
  assistantJs.indexOf('`;', assistantJs.indexOf('const SYSTEM = `')),
);
for (const word of ['warm', 'warmly', 'friendly', 'cheerful', 'excited']) {
  check(
    `the brief does not ask for "${word}"`,
    !new RegExp(`\\b${word}\\b`, 'i').test(systemPrompt),
    'AGENTS.md: report the fact and stop',
  );
}
check(
  'the brief forbids exclamation marks',
  /NO exclamation marks/i.test(systemPrompt),
  'a reply with an exclamation mark fails the rubric',
);

let bad = 0;
for (const r of results) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.ok ? '' : '   <-- ' + r.detail}`);
}
console.log(`\n${results.length - bad}/${results.length} passed`);
process.exit(bad ? 1 : 0);
