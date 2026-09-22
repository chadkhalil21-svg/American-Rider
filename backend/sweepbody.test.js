// What an untrusted caller may read back from GET /scheduled/sweep.
//
// The endpoint is open on production by design: free cron services send an unauthenticated GET
// and cannot be told otherwise, and the sweep takes no parameters. That reasoning covers what
// the endpoint DOES. It did not cover what it SAYS — the report carries counts, `centsPaid`
// and, when they are not empty, `emergencies`, `cases`, `stranded` and `dispatched`, which
// carry identifiers. Found in the pre-launch sweep, 19 Sept 2026.
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

const R = [];
const check = (l, c, d) => R.push({ l, ok: !!c, d });

// sweepBody is a module-local function, so it is read out of the source and evaluated. The
// alternative is exporting an internal for a test, which server.js does not otherwise do.
const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const m = src.match(/function sweepBody\(report, trusted\) \{[\s\S]*?\n\}/);
check('sweepBody exists in server.js', !!m);
const sweepBody = m ? eval(`(${m[0].replace('function sweepBody', 'function')})`) : null;

const REPORT = {
  scheduled: { ok: true, considered: 3, dispatched: ['AR-2117-MIA'], waiting: 2, failed: [] },
  monitor: { ok: true, watching: 4, moving: 2, congestion: 1, asked: [], cases: ['AR-C-484275'], emergencies: ['AR-2047-MIA'], reoffered: [] },
  assignments: { ok: false, pending: 1, stranded: ['AR-9-MIA'] },
  settlements: { ok: true, considered: 2, settled: 2, centsPaid: 48210, blocked: [] },
};

if (sweepBody) {
  const open = sweepBody(REPORT, false);
  const flat = JSON.stringify(open);

  check('an untrusted caller is told the sweep ran', open.ok === true && open.swept === true);
  check('every pass reports ok/not-ok, so a cron job can still alert',
    open.passes.scheduled.ok === true && open.passes.assignments.ok === false);

  // Nothing identifying, and no amounts.
  check('no Travel Number leaks', !flat.includes('AR-2117-MIA') && !flat.includes('AR-9-MIA'));
  check('NO EMERGENCY LEAKS', !flat.includes('AR-2047-MIA') && !flat.includes('emergencies'));
  check('no support case leaks', !flat.includes('AR-C-484275'));
  check('no money leaks', !flat.includes('48210') && !flat.includes('centsPaid'));
  check('no counts leak', !flat.includes('"considered"') && !flat.includes('"waiting"') && !flat.includes('"watching"'));

  // With the token, the report is unchanged — it is the operator's own diagnostic.
  const full = sweepBody(REPORT, true);
  check('a trusted caller still gets the whole report', JSON.stringify(full) === JSON.stringify(REPORT));

  // The sweep itself must still run for anyone: the gate is on the body, never on the work.
  check('the token is never required to RUN the sweep',
    /const trusted = !!want && got === want;/.test(src) && !/return res\.status\(403\)[\s\S]{0,80}scheduler token/.test(src));
}

let bad = 0;
for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  — ' + (r.d || '')}`); }
console.log(`\n${R.length - bad}/${R.length} passed`);
process.exit(bad ? 1 : 0);
