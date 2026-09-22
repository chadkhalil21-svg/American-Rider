// The statutory standard, case by case. This is the file that decides whether a person may
// drive, so every rule in §627.748 gets a test that would fail if the rule were dropped.
const path = require('path');
const ROOT = __dirname;
for (const [rel, exports] of [
  ['./firebase-admin.js', { adminDb: () => null, adminStatus: () => ({ ok: false, reason: 'test' }) }],
  ['./tickets.js', { fileTicket: async () => ({ caseNo: 'AR-C-1' }) }],
  ['./env.js', { readKey: () => '' }],
]) {
  const p = require.resolve(path.join(ROOT, rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports, children: [], paths: [] };
}
const { adjudicate, evaluateExistingReport, SCREENING_FEE_CENTS, MVR_ONLY_FEE_CENTS,
  BASIC_ONLY_FEE_CENTS } = require(path.join(ROOT, 'screening.js'));

const now = Date.parse('2026-08-23T12:00:00Z');
const yearsAgo = (y) => new Date(now - y * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
// STATUS MATTERS NOW, and it did not when these were written. A `consider` whose findings the
// parser got nothing out of is HELD for a person — "not read" must never become "pass". So a
// fixture testing an acceptable operator has to carry a status the standard can clear, and a
// fixture testing a disqualifier carries the records that disqualify.
const base = (o = {}) => ({
  status: 'clear', records: [], sexOffender: false,
  license: { valid: true, state: 'FL' }, movingViolations3y: 0, ...o,
});
/** A report the screening company flagged, with findings we could read. */
const considered = (o = {}) => base({ status: 'consider', ...o });

const R = [];
const check = (l, c, d) => R.push({ l, ok: !!c, d });
const decide = (rep) => adjudicate(rep, { now });

// ---- passes ------------------------------------------------------------------------------
check('clean report passes', decide(base({ status: 'clear' })).decision === 'pass');
check('a felony SIX years ago passes — outside the 5-year window',
  decide(considered({ records: [{ type: 'felony', charge: 'Grand theft', disposition: 'convicted', date: yearsAgo(6) }] })).decision === 'pass');
check('a DUI six years ago passes',
  decide(considered({ records: [{ type: 'misdemeanor', charge: 'DUI', disposition: 'convicted', date: yearsAgo(6) }] })).decision === 'pass');
check('a violent charge SIX years ago passes — the violent window is 5',
  decide(considered({ records: [{ type: 'misdemeanor', charge: 'Battery', disposition: 'convicted', date: yearsAgo(6) }] })).decision === 'pass');
check('a suspended-licence conviction FOUR years ago passes — that window is 3',
  decide(considered({ records: [{ type: 'misdemeanor', charge: 'Driving while license suspended', disposition: 'convicted', date: yearsAgo(4) }] })).decision === 'pass');
check('three moving violations passes; the bar is MORE than three',
  decide(base({ movingViolations3y: 3 })).decision === 'pass');
check('a dismissed felony is not a conviction and passes',
  decide(considered({ records: [{ type: 'felony', charge: 'Grand theft', disposition: 'nolle prosequi', date: yearsAgo(1) }] })).decision === 'pass');
check('an expunged record passes',
  decide(considered({ records: [{ type: 'felony', charge: 'Fraud', disposition: 'expunged', date: yearsAgo(2) }] })).decision === 'pass');
check('an unrelated recent misdemeanor passes — only the listed ones disqualify',
  decide(considered({ records: [{ type: 'misdemeanor', charge: 'Trespassing', disposition: 'convicted', date: yearsAgo(1) }] })).decision === 'pass');

// ---- refusals ----------------------------------------------------------------------------
const refuses = [
  ['felony within 5 years', considered({ records: [{ type: 'felony', charge: 'Grand theft', disposition: 'convicted', date: yearsAgo(2) }] })],
  ['DUI within 5 years', considered({ records: [{ type: 'misdemeanor', charge: 'Driving under the influence', disposition: 'convicted', date: yearsAgo(3) }] })],
  ['reckless driving within 5 years', considered({ records: [{ type: 'misdemeanor', charge: 'Reckless driving', disposition: 'convicted', date: yearsAgo(1) }] })],
  ['hit and run within 5 years', considered({ records: [{ type: 'misdemeanor', charge: 'Hit and run', disposition: 'convicted', date: yearsAgo(4) }] })],
  ['fleeing an officer within 5 years', considered({ records: [{ type: 'misdemeanor', charge: 'Fleeing or eluding', disposition: 'convicted', date: yearsAgo(2) }] })],
  ['violent offence within 5 years', considered({ records: [{ type: 'misdemeanor', charge: 'Aggravated assault', disposition: 'convicted', date: yearsAgo(2) }] })],
  ['violent offence at FOUR years — the defect that let this pass', considered({ records: [{ type: 'misdemeanor', charge: 'Battery', disposition: 'convicted', date: yearsAgo(4) }] })],
  ['lewdness within 5 years', considered({ records: [{ type: 'misdemeanor', charge: 'Indecent exposure', disposition: 'convicted', date: yearsAgo(3) }] })],
  ['driving on a suspended licence within 3 years', considered({ records: [{ type: 'misdemeanor', charge: 'Driving while license suspended', disposition: 'convicted', date: yearsAgo(2) }] })],
  ['driving on a revoked licence within 3 years', considered({ records: [{ type: 'misdemeanor', charge: 'Driving with revoked license', disposition: 'convicted', date: yearsAgo(1) }] })],
  ['on the sex offender registry', base({ sexOffender: true })],
  ['no valid driver license', base({ license: { valid: false, state: 'FL' } })],
  ['four moving violations in three years', base({ movingViolations3y: 4 })],
];
for (const [label, rep] of refuses) {
  const out = decide(rep);
  check(`refuses: ${label}`, out.decision === 'refuse' && out.reasons.length > 0, out.decision);
}

// ---- held for a person -------------------------------------------------------------------
check('a record with no date is held, never waved through',
  decide(considered({ records: [{ type: 'felony', charge: 'Grand theft', disposition: 'convicted', date: '' }] })).decision === 'review');
check('a suspended report is held', decide(base({ status: 'suspended' })).decision === 'review');
check('a flagged report whose findings could not be read is HELD, never passed',
  decide(base({ status: 'consider', records: [] })).decision === 'review');
check('  and a flagged report whose records ARE readable and all clear still passes',
  decide(considered({ records: [{ type: 'misdemeanor', charge: 'Trespassing', disposition: 'convicted', date: yearsAgo(1) }] })).decision === 'pass');

// ---- the thing that must never happen ----------------------------------------------------
check('NOTHING disqualifying ever returns pass',
  refuses.every(([, rep]) => decide(rep).decision !== 'pass'));
check('a held result is never a pass',
  decide(base({ status: 'suspended' })).decision !== 'pass');

// ---- AN EXISTING REPORT, AND WHAT IT SPARES THE OPERATOR PAYING FOR TWICE. ----------------
//
// "We do not want to force a package that is not required, ever" (Chad, 27 Aug 2026) has to
// hold in BOTH directions. Until 29 Aug the adjudication knew the case where the criminal
// half was already done, and sent the mirror case — driving record in hand, criminal half
// missing — to the full $47.49, charging for the MVR it had just been given.
const recent = now - 30 * 24 * 3600 * 1000;
const ALL = ['nationwide_criminal', 'sex_offender', 'driving_history'];
// Both partial packages provisioned, so the tiers are reachable.
const both = { now, mvrOnlyAvailable: true, criminalOnlyAvailable: true };
const ex = (elements, o = {}) =>
  evaluateExistingReport({ source: 'agency', issuedAt: recent, elements }, { ...both, ...o });

check('a complete recent report costs nothing',
  ex(ALL).accept === true && ex(ALL).feeCents === 0, JSON.stringify(ex(ALL)));

check('criminal half in hand: only the driving history is bought',
  ex(['nationwide_criminal', 'sex_offender']).tier === 'mvr'
  && ex(['nationwide_criminal', 'sex_offender']).feeCents === MVR_ONLY_FEE_CENTS,
  JSON.stringify(ex(['nationwide_criminal', 'sex_offender'])));

check('driving history in hand: only the criminal check is bought',
  ex(['driving_history']).tier === 'criminal'
  && ex(['driving_history']).feeCents === BASIC_ONLY_FEE_CENTS,
  JSON.stringify(ex(['driving_history'])));

check('driving history plus one criminal element still buys only the criminal package',
  ex(['driving_history', 'sex_offender']).tier === 'criminal'
  && ex(['driving_history', 'sex_offender']).feeCents === BASIC_ONLY_FEE_CENTS,
  JSON.stringify(ex(['driving_history', 'sex_offender'])));

check('a partial price is never cheaper than what it buys',
  MVR_ONLY_FEE_CENTS + BASIC_ONLY_FEE_CENTS >= SCREENING_FEE_CENTS,
  `${MVR_ONLY_FEE_CENTS} + ${BASIC_ONLY_FEE_CENTS} vs ${SCREENING_FEE_CENTS}`);

check('nothing in hand is the full price',
  ex([]).tier === 'full' && ex([]).feeCents === SCREENING_FEE_CENTS, JSON.stringify(ex([])));

// ---- THE LOOPHOLES. ----------------------------------------------------------------------
check('a report older than three years buys nothing, whatever it contains',
  evaluateExistingReport(
    { source: 'agency', issuedAt: now - 4 * 365 * 24 * 3600 * 1000, elements: ALL }, both,
  ).feeCents === SCREENING_FEE_CENTS);

check('a report with no date is not accepted',
  evaluateExistingReport({ source: 'agency', issuedAt: null, elements: ALL }, both).accept === false);

check('a report the OPERATOR hands us is not accepted, at any price',
  evaluateExistingReport({ source: 'operator', issuedAt: recent, elements: ALL }, both).accept === false);

check('an unprovisioned partial package is never quoted, in either direction',
  ex(['nationwide_criminal', 'sex_offender'], { mvrOnlyAvailable: false }).feeCents === SCREENING_FEE_CENTS
  && ex(['driving_history'], { criminalOnlyAvailable: false }).feeCents === SCREENING_FEE_CENTS);

check('no partial tier is ever an acceptance',
  [ex(['nationwide_criminal', 'sex_offender']), ex(['driving_history'])]
    .every((v) => v.accept === false));

let bad = 0;
for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  <-- ' + r.d}`); }
console.log(`\n${R.length - bad}/${R.length} passed`);
process.exit(bad ? 1 : 0);
