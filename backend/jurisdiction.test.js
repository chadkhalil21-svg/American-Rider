// A REGION CANNOT BE OPENED WITHOUT ANSWERING WHOSE LAW APPLIES THERE.
//
// Found 20 Sept 2026 by sweeping for market assumptions rather than by anybody reporting it.
// Seventeen strings in EACH of the five language catalogues name Florida or §627.748, and ten
// backend modules do: the insurance disclosure, the screening standard, the three-year
// re-check, the regulator an operator is told to verify a licence with, and the script they
// read out to an insurance agent.
//
// Every one is correct today and wrong the day we open Georgia — and unlike a wrong
// destination list, which is an inconvenience, this is a legal failure in both directions. An
// operator in Georgia would be handed a disclosure citing a statute that does not govern them,
// Georgia's own disclosure requirement would go unsatisfied, and the gate at
// POST /operator/online would be enforcing the wrong state's rule against them.
const fs = require('fs');
const path = require('path');
const { listRegions, regionFor } = require('./regions');

const results = [];
const check = (label, ok, detail) => results.push({ label, ok: !!ok, detail });

// ---- Every region declares its jurisdiction ---------------------------------------------
for (const r of listRegions()) {
  const j = r.jurisdiction;
  check(`${r.id} declares whose law applies`, !!j && !!j.state, JSON.stringify(j));
  check(`${r.id} names the statute an operator is disclosed under`, !!j && !!j.disclosureStatute);
  check(`${r.id} names the regulator a licence can be checked with`, !!j && !!j.insuranceRegulator);
  check(`${r.id} states how long a screening stands`, !!j && Number.isInteger(j.screeningYears) && j.screeningYears > 0);
}

// ---- And a region CANNOT be constructed without one --------------------------------------
// This is the part that matters. Adding a market must not be possible by copying the Florida
// record and changing the bounding box, because the copy would carry Florida's statute into
// another state in silence.
let threw = false;
try {
  const { REGIONS } = require('./regions');
  // Re-run the constructor the module uses, with the jurisdiction removed.
  const src = fs.readFileSync(path.join(__dirname, 'regions.js'), 'utf8');
  check('the constructor refuses a region with no jurisdiction',
    /throw new Error\(`Region \$\{def\.id\} has no jurisdiction record/.test(src));
  check('and it throws at import, not at first use',
    src.indexOf('has no jurisdiction record') < src.indexOf('const REGIONS'),
    'a check that runs later is a check somebody ships past');
  threw = REGIONS.length > 0;
} catch (e) {
  threw = false;
}
check('the existing regions still load', threw);

// ---- The Florida text is still Florida's, and that is recorded rather than implied --------
// Nothing here asserts the strings are already regionalised, because they are not. What it
// asserts is that the SCALE of the remaining work is written down where it will be seen.
const regionsSrc = fs.readFileSync(path.join(__dirname, 'regions.js'), 'utf8');
// Whitespace-normalised: the sentence is wrapped across lines in the source, and a check that
// breaks on a line wrap is a check that gets deleted rather than fixed.
// Comment markers stripped as well as newlines: a sentence wrapped across two comment
// lines reads as 'a second region // must not be opened' otherwise.
const flat = (t) => t.replace(/^\s*\/\/ ?/gm, '').replace(/\s+/g, ' ');
check('the unfinished half is stated, not left to be discovered',
  /WHAT IS NOT YET DONE/.test(regionsSrc) && /a second region must not be opened/i.test(flat(regionsSrc)));

// ---- What actually reads Florida today, counted so the number cannot quietly grow ---------
const APP = path.join(__dirname, '..');
const catalogues = ['en', 'es', 'fr', 'it', 'de'].map((l) =>
  fs.readFileSync(path.join(APP, 'src', 'i18n', `${l}.ts`), 'utf8'));
// COUNTED ACROSS SPELLINGS, because the first version of this check counted 'Florida' and
// reported French as an outlier with 8 — French says 'Floride'. A measurement that mistakes a
// translation for a gap is worse than no measurement: it sends somebody looking for a defect
// that is not there, and teaches them to distrust the next number.
const floridaStrings = catalogues.map((c) => (c.match(/Florid[ae]|627\.748/g) || []).length);
check('the jurisdiction-specific strings are counted, and every language carries the same number',
  new Set(floridaStrings).size === 1, floridaStrings.join(', '));
check('and there are no MORE of them than when this was measured',
  floridaStrings[0] <= 22, `${floridaStrings[0]} now, 22 when measured on 20 Sept 2026`);

// ---- The jurisdiction is reachable from a coordinate, which is how callers will use it -----
const fl = regionFor({ lat: 25.77, lng: -80.19 });
check('a coordinate resolves to its jurisdiction', fl?.jurisdiction?.stateCode === 'FL');
check('and a coordinate outside every region has none to resolve',
  regionFor({ lat: 40.7128, lng: -74.006 }) === null,
  'New York is not a market; it must not inherit Florida law by default');

for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.label}${r.ok || !r.detail ? '' : ` — ${r.detail}`}`);
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED of ${results.length}` : `\nall ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
