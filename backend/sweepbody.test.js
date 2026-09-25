// Operational sweep authorization.
//
// /scheduled/sweep can dispatch reservations, re-offer assignments, expire screening and move
// money. It is not a public diagnostic. The server has its own 60-second clock, so an external
// scheduler is optional and must authenticate when used.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

const R=[]; const check=(l,c)=>R.push({l,ok:!!c});
const block = src.slice(src.indexOf('async function runSweep'), src.indexOf('// --- Private file storage.'));

check('runSweep exists', block.startsWith('async function runSweep'));
check('scheduler secret is read', /readKey\('SCHEDULER_TOKEN'\)/.test(block));
check('missing or wrong scheduler secret fails closed', /if \(!want \|\| got !== want\)/.test(block));
check('unauthorized scheduler request receives 401', /status\(401\)/.test(block));
check('the old public redaction helper is gone', !/function sweepBody\(/.test(src));
check('the process still has its internal 60-second operational clock',
  /setInterval\([\s\S]*runAllSweeps\(\)[\s\S]*60 \* 1000/.test(src));
check('GET and POST sweep routes both use the protected handler',
  /app\.get\('\/scheduled\/sweep', runSweep\)/.test(src) &&
  /app\.post\('\/scheduled\/sweep', runSweep\)/.test(src));

let bad=0;
for(const r of R){if(!r.ok)bad++;console.log(`${r.ok?'PASS':'FAIL'}  ${r.l}`);}
console.log(`\n${R.length-bad}/${R.length} passed`);
process.exit(bad?1:0);
