// The screening pipeline's failure modes, pinned down.
//
// WHY THIS FILE EXISTS. On 26 Aug 2026 the Checkr integration was found to have four holes,
// and the worst was silent: a `consider` report whose findings the webhook did not carry
// matched no disqualifier and PASSED — an operator the screening company flagged, driving.
// The others: no code ever called Checkr (orders were recorded, never placed), the webhook
// signature check compared the header to the secret (Checkr sends an HMAC, so every genuine
// result was a 403), and a paid-but-expired invitation dead-ended with the fee kept.
//
// These tests hold the fixes in place. Run: node backend/checkr.test.js

process.env.CHECKR_WEBHOOK_SECRET = 'test_webhook_secret_for_hmac';

const crypto = require('crypto');
const { adjudicate } = require('./screening');
const { verifySignature, mapReport } = require('./checkr');

const results = [];
const check = (label, ok, detail) => results.push({ label, ok: !!ok, detail });

// ---- The signature: HMAC over raw bytes, not the secret in a header ----------------------

const rawBody = Buffer.from(JSON.stringify({ type: 'report.completed', data: { object: { id: 'rpt_1' } } }));
const goodSig = crypto.createHmac('sha256', 'test_webhook_secret_for_hmac').update(rawBody).digest('hex');

check('a genuine Checkr HMAC verifies', verifySignature(rawBody, goodSig));
check('a wrong HMAC is refused', !verifySignature(rawBody, goodSig.replace(/^./, goodSig[0] === 'a' ? 'b' : 'a')));
check('the OLD bug — secret itself in the header — is refused', !verifySignature(rawBody, 'test_webhook_secret_for_hmac'));
check('a tampered body fails the original signature', !verifySignature(Buffer.concat([rawBody, Buffer.from(' ')]), goodSig));
check('an empty signature is refused', !verifySignature(rawBody, ''));

// ---- THE HOLE: consider with nothing readable must review, never pass --------------------

const consideredEmpty = adjudicate({ status: 'consider', records: [], sexOffender: false, license: {}, movingViolations3y: 0 });
check('consider + zero parsed records → review (the closed hole)', consideredEmpty.decision === 'review', consideredEmpty.decision);

const clearEmpty = adjudicate({ status: 'clear', records: [], sexOffender: false, license: {}, movingViolations3y: 0 });
check('clear + zero records still passes', clearEmpty.decision === 'pass', clearEmpty.decision);

// A consider whose records WERE read and all fall outside the statute passes — by design.
const consideredDismissed = adjudicate({
  status: 'consider',
  records: [{ type: 'misdemeanor', charge: 'Petit theft', disposition: 'Dismissed', date: '2025-01-15' }],
  sexOffender: false, license: {}, movingViolations3y: 0,
});
check('consider + only a dismissal → pass (dismissals are not convictions)', consideredDismissed.decision === 'pass', consideredDismissed.decision);

const felonyRecent = adjudicate({
  status: 'consider',
  records: [{ type: 'felony', charge: 'Burglary', disposition: 'Convicted', date: new Date(Date.now() - 2 * 365 * 864e5).toISOString().slice(0, 10) }],
  sexOffender: false, license: {}, movingViolations3y: 0,
});
check('a felony 2 years old → refuse (§627.748(12)(d)1)', felonyRecent.decision === 'refuse', felonyRecent.decision);

// ---- mapReport: Checkr shapes → adjudicate input, defensively ----------------------------

// A clear report with no fetched details maps to a clear pass.
const mClear = mapReport({ status: 'complete', result: 'clear' }, {});
check('mapped clear report passes', adjudicate(mClear).decision === 'pass');

// A consider report whose details could NOT be fetched maps to consider+empty → review.
const mUnfetched = mapReport({ status: 'complete', result: 'consider' }, {});
check('mapped consider with unfetched details → review', adjudicate(mUnfetched).decision === 'review');

// A consider report with a real felony charge in the criminal search → refuse.
const mFelony = mapReport(
  { status: 'complete', result: 'consider' },
  {
    criminal: [{
      records: [{
        charges: [{ classification: 'Felony', charge: 'Aggravated assault', disposition: 'Convicted', offense_date: new Date(Date.now() - 1 * 365 * 864e5).toISOString().slice(0, 10) }],
      }],
    }],
  },
);
check('mapped felony conviction → refuse', adjudicate(mFelony).decision === 'refuse');

// The sex-offender registry is an absolute bar.
const mSex = mapReport(
  { status: 'complete', result: 'consider' },
  { sexOffender: { records: [{ registry: 'NSOPW' }] } },
);
check('sex-offender registry hit → refuse', adjudicate(mSex).decision === 'refuse');

// A suspended licence on the MVR: absolute bar via license_status.
const mSuspLicense = mapReport(
  { status: 'complete', result: 'consider' },
  { mvr: { license_status: 'suspended', license_state: 'FL', violations: [] } },
);
check('MVR license_status suspended → refuse (no valid licence)', adjudicate(mSuspLicense).decision === 'refuse');

// Four moving violations inside three years: more than three is the statute's line.
const recent = (m) => new Date(Date.now() - m * 30 * 864e5).toISOString().slice(0, 10);
const mViolations = mapReport(
  { status: 'complete', result: 'consider' },
  { mvr: { license_status: 'valid', violations: [
    { description: 'Speeding', issued_date: recent(2) },
    { description: 'Speeding', issued_date: recent(8) },
    { description: 'Failure to yield', issued_date: recent(14) },
    { description: 'Speeding', issued_date: recent(20) },
  ] } },
);
check('4 moving violations in 3 years → refuse', adjudicate(mViolations).decision === 'refuse');

// An old violation outside the window is not counted.
const mOldViolation = mapReport(
  { status: 'complete', result: 'consider' },
  { mvr: { license_status: 'valid', violations: [{ description: 'Speeding', issued_date: '2020-05-01' }] } },
);
check('one ancient violation → pass', adjudicate(mOldViolation).decision === 'pass', JSON.stringify(adjudicate(mOldViolation)));

// A dispute/suspension at the screening company is never a pass.
const mDispute = mapReport({ status: 'dispute' }, {});
check('a disputed report → review', adjudicate(mDispute).decision === 'review');

// ---- The $17.50 quote exists only when the MVR-only package does --------------------------

const { evaluateExistingReport } = require('./screening');
const goodExisting = {
  source: 'agency',
  issuedAt: Date.now() - 90 * 864e5,
  elements: ['nationwide_criminal', 'sex_offender'], // driving history missing — the common case
};
check(
  'driving-history-only quote is $17.50 when the MVR-only package exists',
  evaluateExistingReport(goodExisting, { mvrOnlyAvailable: true }).feeCents === 1750,
);
check(
  'without an MVR-only package the same case quotes the FULL fee (no paid dead ends)',
  evaluateExistingReport(goodExisting, { mvrOnlyAvailable: false }).feeCents === 4749,
);
check(
  'a complete, recent agency report is still accepted for free',
  evaluateExistingReport(
    { ...goodExisting, elements: ['nationwide_criminal', 'sex_offender', 'driving_history'] },
    { mvrOnlyAvailable: false },
  ).accept === true,
);

// ---- The gross-up: the operator pays cost + the processor's exact cut, never a cent more --

const { grossUpCents, screeningQuote } = require('./screening');
check('gross-up of $47.49 is $49.22 (not the overshooting $49.32)', grossUpCents(4749) === 4922, String(grossUpCents(4749)));
check('processing line for the full check is $1.73', screeningQuote(4749).processingCents === 173, String(screeningQuote(4749).processingCents));
// The proof the formula is break-even: net after Stripe's 2.9% + 30c is >= cost by < 1 cent.
const net = 4922 - Math.round(4922 * 0.029) - 30;
check('net of the $49.22 charge covers the $47.49 cost within a penny', net >= 4749 && net <= 4750, String(net));
check('MVR-only gross-up is $18.34', grossUpCents(1750) === 1834, String(grossUpCents(1750)));

// ---- Dispatch: the gate the operator's own phone cannot toggle off ------------------------

const { matchOperator } = require('./matching');
const { DISCLOSURE_VERSION } = require('./disclosure');
const HERE = { lat: 25.77, lng: -80.19 };
// THE FIXTURES CARRY A CURRENT DISCLOSURE because these cases are about the SCREENING gate and
// nothing else. They were written before the disclosure gate existed, so they carried no
// disclosureVersion; once dispatch started filtering on it they failed for a reason that had
// nothing to do with what they assert. A fixture missing a field the chokepoint reads is not a
// test of that chokepoint. The missing-disclosure case is asserted on its own, below.
const near = { id: 'op_near', available: true, onlineAt: Date.now(), lat: 25.77, lng: -80.19, disclosureVersion: DISCLOSURE_VERSION };
const far = { id: 'op_far', available: true, onlineAt: Date.now(), lat: 25.9, lng: -80.3, screeningCheckedAt: Date.now(), disclosureVersion: DISCLOSURE_VERSION };

check(
  'a screeningBlocked operator is never dispatched, even when nearest and available',
  matchOperator([{ ...near, screeningBlocked: true }, far], HERE)?.operator.id === 'op_far',
);
check(
  'with screening live, an operator with no recorded pass is not dispatched',
  matchOperator([near, far], HERE, 'Standard', { requireScreening: true })?.operator.id === 'op_far',
);
check(
  'with screening live and nobody passed, nobody is dispatched',
  matchOperator([near], HERE, 'Standard', { requireScreening: true }) === null,
);
check(
  'before a provider exists the demo fleet still matches',
  matchOperator([near], HERE)?.operator.id === 'op_near',
);

// ---- Presence: a flag nobody clears is not evidence anybody is there ----------------------
//
// This is the defect that put a paying traveler in a Gray Toyota Camry that did not exist
// (29 Aug 2026). `available` is written on Go On Duty and cleared only by Go Off Duty, which
// a closed app, a flat battery and an uninstall all skip. Matching is by distance, so the
// oldest abandoned record nearest the traveler won.

const { presenceStale, PRESENCE_STALE_MS } = require('./matching');
const T0 = 1_800_000_000_000;
const ago = (ms) => ({ id: 'op', available: true, lat: 25.77, lng: -80.19, onlineAt: T0 - ms });

check('an operator who checked in a moment ago is present', !presenceStale(ago(1000), T0));
check('an operator silent past the window is stale', presenceStale(ago(PRESENCE_STALE_MS + 1), T0));
check(
  'two missed renewals are tolerated — a tunnel is not a disappearance',
  !presenceStale(ago(3 * 90_000), T0),
  `90s renewals against a ${PRESENCE_STALE_MS / 1000}s window`,
);
check('a record with NO onlineAt at all is stale, not present', presenceStale({ available: true }, T0));
check('a zero or nonsense timestamp is stale', presenceStale({ onlineAt: 0 }, T0) && presenceStale({ onlineAt: 'soon' }, T0));

// And the same rule at the chokepoint, which is the part that actually failed.
const stale = { id: 'op_stale', available: true, onlineAt: T0 - PRESENCE_STALE_MS - 1, lat: 25.77, lng: -80.19, disclosureVersion: DISCLOSURE_VERSION };
const live = { id: 'op_live', available: true, onlineAt: T0 - 1000, lat: 25.9, lng: -80.3, disclosureVersion: DISCLOSURE_VERSION };
check(
  'a NEARER stale operator loses to a FARTHER live one',
  matchOperator([stale, live], HERE, 'Standard', { now: T0 })?.operator.id === 'op_live',
  JSON.stringify(matchOperator([stale, live], HERE, 'Standard', { now: T0 })),
);
check(
  'when everybody nearby is stale, nobody is dispatched rather than a phantom',
  matchOperator([stale], HERE, 'Standard', { now: T0 }) === null,
);

// ---- The disclosure gate, and why production reported nobody (20 Sept 2026) ---------------
//
// A record with NO disclosureVersion has never gone on duty through POST /operator/online,
// which is the only thing that writes the field. dispatchgate.test.js pins the rule — absence
// is not agreement — and it is right: §627.748(8)(a) is about an operator having been told,
// and "we have no record" is not "we told them".
//
// WHAT IT EXPLAINS. Production reports six operators, five available and none dispatchable.
// Those six records predate the field, so every one of them fails this filter, and dispatch
// returns null — which is indistinguishable from an empty market. The fix is not to loosen the
// gate. It is that an operator must go on duty through /operator/online, which writes the
// field, and that is the first step of the end-to-end test.
//
// It also broke four cases above, whose fixtures were written before this gate existed and
// carried no disclosure. They assert things about SCREENING and PRESENCE; a fixture missing a
// field the chokepoint reads is not a test of that chokepoint. Repaired, not loosened.
const noDisclosure = { id: 'op_demo', available: true, onlineAt: Date.now(), lat: 25.77, lng: -80.19 };
const oldDisclosure = { ...noDisclosure, id: 'op_old', disclosureVersion: '2026-08-29.1' };
const okDisclosure = { ...noDisclosure, id: 'op_ok', disclosureVersion: DISCLOSURE_VERSION };
check(
  'an operator who never saw a disclosure is NOT dispatched, even with nobody else to send',
  matchOperator([noDisclosure], HERE) === null,
  JSON.stringify(matchOperator([noDisclosure], HERE)),
);
check(
  'an OLD disclosure is fatal too — asked, answered, and out of date',
  matchOperator([oldDisclosure], HERE) === null,
);
check(
  'and a FARTHER operator on the current disclosure wins over a nearer one with none',
  matchOperator([noDisclosure, { ...okDisclosure, lat: 25.9, lng: -80.3 }], HERE)?.operator.id === 'op_ok',
);

// ---- Verdict ------------------------------------------------------------------------------

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.label}${r.ok || !r.detail ? '' : ` — got ${r.detail}`}`);
console.log(failed.length ? `\n${failed.length} FAILED of ${results.length}` : `\nall ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
