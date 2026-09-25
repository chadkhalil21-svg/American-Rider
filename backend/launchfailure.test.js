// Launch failure-mode regression suite.
// These are cross-module invariants: conditions that must fail closed even when a happy-path
// unit test in the owning module would still pass.
const fs = require('fs');
const path = require('path');
const { adjudicate } = require('./screening');
const { economicsFor, minimumPlatformFeeCents } = require('./economics');

const R = [];
const check = (label, ok, detail='') => R.push({ label, ok: !!ok, detail });
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

// SCREENING: missing/ambiguous source data never becomes a pass.
check('screening: provider flag with unreadable findings fails closed',
  adjudicate({ status:'consider', records:[], sexOffender:false, license:{}, movingViolations3y:0 }).decision !== 'pass');
check('screening: record with no usable date fails closed',
  adjudicate({ status:'consider', records:[{type:'felony',charge:'Felony record',disposition:'convicted',date:''}], sexOffender:false, license:{valid:true}, movingViolations3y:0 }).decision !== 'pass');
check('screening: statutory bar is deterministic',
  adjudicate({ status:'clear', records:[], sexOffender:true, license:{valid:true}, movingViolations3y:0 }).decision === 'refuse');

// ECONOMICS: every cent in the supported fare range must meet the modeled contribution target,
// including the more expensive international-card branch and unknown-country safe default.
for (const country of ['US','GB',null]) {
  let bad = null;
  for (let fare=300; fare<=50000; fare++) {
    const fee = minimumPlatformFeeCents({ travelFareCents:fare, cardCountry:country });
    const e = economicsFor({ travelFareCents:fare, platformFeeCents:fee, cardCountry:country });
    if (e.contributionCents < 75) { bad={fare,fee,contribution:e.contributionCents}; break; }
  }
  check(`economics: modeled contribution >=75c for ${country || 'unknown'} cards, $3-$500`, !bad, JSON.stringify(bad));
}

// PUBLIC/OPERATIONAL CONTROL: a remote caller must not be able to execute money/dispatch sweeps
// merely by knowing the URL.
const server = read('server.js');
check('operations: scheduler endpoint requires a configured secret',
  /if \(!want \|\| got !== want\)[\s\S]{0,180}status\(401\)/.test(server));
check('operations: public sweep response helper is gone', !/function sweepBody\(/.test(server));

// PUBLIC COPY: pin regressions that materially misstate money or insurance.
const site = read('site.js');
check('copy: obsolete $26.00 traveler total is gone', !site.includes('Charged to the traveler</span><span class="amount">$26.00'));
check('copy: no claim that operator policy is the only insurance that can apply',
  !site.includes('only coverage that applies to their travels'));
check('copy: ambiguous screening is described as source clarification, not guessed approval',
  site.includes('source clarification or dispute resolution is required'));

const failed=R.filter(x=>!x.ok);
for(const r of R) console.log(`${r.ok?'PASS':'FAIL'}  ${r.label}${r.ok?'': '  <-- '+r.detail}`);
console.log(`\n${R.length-failed.length}/${R.length} passed`);
process.exit(failed.length?1:0);
