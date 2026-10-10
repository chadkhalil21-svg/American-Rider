// The screening gate on POST /operator/online, case by case. This decides whether an
// unscreened person may carry a passenger, so every branch gets a test.
const path = require('path');
const ROOT = __dirname;
const { screeningCurrent, screeningReady, RECHECK_MS } = require(path.join(ROOT, 'screening.js'));

const now = Date.now(), YEAR = 365*24*3600*1000;
const R = [];
const check = (l, c, d) => R.push({ l, ok: !!c, d });

// No vendor link is required. Only the owner's verified end-to-end evidence
// commissioning is authoritative. A URL alone can never enable paid Travel.
const priorProviderUrl = process.env.SCREENING_PROVIDER_URL;
const priorPilot = process.env.SCREENING_EVIDENCE_WORKFLOW_VERIFIED;
try {
  process.env.SCREENING_PROVIDER_URL = 'https://example.test/cra';
  delete process.env.SCREENING_EVIDENCE_WORKFLOW_VERIFIED;
  check('vendor link alone cannot mark screening ready', !screeningReady());
  process.env.SCREENING_EVIDENCE_WORKFLOW_VERIFIED = 'false';
  check('uncommissioned evidence workflow cannot mark screening ready', !screeningReady());
  delete process.env.SCREENING_PROVIDER_URL;
  process.env.SCREENING_EVIDENCE_WORKFLOW_VERIFIED = 'true';
  check('vendor-neutral verified evidence workflow may be signed off with NO vendor link', screeningReady());
} finally {
  if (priorProviderUrl === undefined) delete process.env.SCREENING_PROVIDER_URL;
  else process.env.SCREENING_PROVIDER_URL = priorProviderUrl;
  if (priorPilot === undefined) delete process.env.SCREENING_EVIDENCE_WORKFLOW_VERIFIED;
  else process.env.SCREENING_EVIDENCE_WORKFLOW_VERIFIED = priorPilot;
}

// screeningCurrent is what the gate turns on.
check('no screening at all -> not current', !screeningCurrent(null));
check('undefined -> not current', !screeningCurrent(undefined));
check('passed, recheck in the future -> current',
  screeningCurrent({ decision: 'pass', recheckDue: now + YEAR }));
check('passed but recheck overdue -> NOT current',
  !screeningCurrent({ decision: 'pass', recheckDue: now - 1 }));
check('refused -> never current',
  !screeningCurrent({ decision: 'refuse', recheckDue: now + YEAR }));
check('held for review -> never current',
  !screeningCurrent({ decision: 'review', recheckDue: now + YEAR }));
check('ordered but not returned -> not current',
  !screeningCurrent({ decision: 'ordered', recheckDue: now + YEAR }));
check('awaiting a provider -> not current',
  !screeningCurrent({ decision: 'awaiting_provider' }));
check('awaiting an agency report -> not current',
  !screeningCurrent({ decision: 'awaiting_agency' }));
check('a pass with no recheck date -> not current (no date, no licence to drive)',
  !screeningCurrent({ decision: 'pass' }));

// The three-year clock runs from the report, so a two-year-old accepted report expires in one.
const conducted = now - 2*YEAR;
check('report conducted 2 years ago is still current for ~1 more year',
  screeningCurrent({ decision: 'pass', recheckDue: conducted + RECHECK_MS }));
check('report conducted 3 years and a day ago is not',
  !screeningCurrent({ decision: 'pass', recheckDue: (now - 3*YEAR - 86400000) + RECHECK_MS }));

let bad = 0;
for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}`); }
console.log(`\n${R.length - bad}/${R.length} passed`);
process.exit(bad ? 1 : 0);
