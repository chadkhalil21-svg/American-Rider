// Commissioning: a person approves, and only over four accepted documents.
// Run: node backend/commissioning.test.js
const fs = require('fs');
const path = require('path');
const { documentsStatus, commissionCurrent, docExpired } = require('./commissioning');
const { matchOperator } = require('./matching');
const { DISCLOSURE_VERSION } = require('./disclosure');

const R = [];
const check = (l, c, d) => R.push({ l, ok: !!c, d });

const future = '2099-01-01';
const ok = { verdict: 'accept', expiry: future };
const all = { license: ok, registration: ok, inspection: ok, insurance: ok };

// ——— the documents ———————————————————————————————————————————————————————————
check('four accepted, in-date documents are accepted', documentsStatus(all).accepted);
check('no documents is not accepted — absence is not acceptance', !documentsStatus(undefined).accepted);
check('no documents is not reviewable either', !documentsStatus({}).reviewable);
check('a missing document is named', documentsStatus({ ...all, inspection: undefined }).missing.includes('inspection'));
const held = documentsStatus({ ...all, license: { verdict: 'review', expiry: future } });
check('a held document blocks approval', !held.accepted && held.held.includes('license'));
check('a held document may still go to a person', held.reviewable);
const refused = documentsStatus({ ...all, insurance: { verdict: 'refuse' } });
check('a refused document blocks approval and review', !refused.accepted && !refused.reviewable);
const lapsed = documentsStatus({ ...all, registration: { verdict: 'accept', expiry: '2020-01-01' } });
check('an accepted document that has since expired blocks duty', !lapsed.accepted && lapsed.expired.includes('registration'));
check('no expiry on file is not expired', !docExpired({ verdict: 'accept' }));

// ——— the commission ———————————————————————————————————————————————————————————
check('only approved counts', commissionCurrent({ status: 'approved' }));
check('pending does not count', !commissionCurrent({ status: 'pending' }));
check('refused does not count', !commissionCurrent({ status: 'refused' }));
check('no record does not count', !commissionCurrent(null));

// ——— dispatch reads it ————————————————————————————————————————————————————————
const HERE = { lat: 25.7617, lng: -80.1918 };
const base = { id: 'op', available: true, onlineAt: Date.now(), lat: 25.762, lng: -80.192, disclosureVersion: DISCLOSURE_VERSION };
check('an operator never commissioned is not dispatched', matchOperator([base], HERE) === null);
check('a commissioned operator is dispatched', !!matchOperator([{ ...base, commissioned: true }], HERE));
check('a document refused since commissioning is not dispatched',
  matchOperator([{ ...base, commissioned: true, documentBlocked: true }], HERE) === null);

// ——— the routes are wired ————————————————————————————————————————————————————
const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const ops = fs.readFileSync(path.join(__dirname, 'ops.js'), 'utf8');
const online = (server.match(/app\.post\('\/operator\/online'[\s\S]*?\n\}\);/) || [''])[0];
check('/operator/online refuses without a commission', /commissionCurrent\(commission\)/.test(online) && /not_commissioned/.test(online));
check('/operator/online refuses when a document no longer stands', /documentsStatus\(user\?\.documents\)/.test(online));
check('/operator/online stamps commissioned for dispatch', /commissioned: true/.test(online));
const submit = (server.match(/app\.post\('\/operator\/qualification\/submit'[\s\S]*?\n\}\);/) || [''])[0];
check('submitting sets pending, never approved', /status: 'pending'/.test(submit) && !/status: 'approved', /.test(submit));
check('only /ops writes approved', !/commission: \{ status: 'approved'/.test(server) && /commission: \{ status: 'approved'/.test(ops));
const approve = (ops.match(/app\.post\('\/ops\/operators\/commission'[\s\S]*?\n {2}\}\);/) || [''])[0];
check('approval requires the /ops sign-in', /signedIn\(req\)/.test(approve));
check('approval re-checks the documents at the moment of the click', /documentsStatus\(snap\.data\(\)\.documents\)/.test(approve));
const app = fs.readFileSync(path.join(__dirname, '..', 'app', 'operator', 'review.tsx'), 'utf8');
check('the review screen no longer commissions on a button press', !/onPress=\{\(\) => \{\s*op\.commission\(\)/.test(app));
const ack = (server.match(/app\.post\('\/operator\/disclosure\/acknowledge'[\s\S]*?\n\}\);/) || [''])[0];
check('acknowledging does NOT write the fleet record — only /operator/online puts an operator back in dispatch',
  ack.length > 0 && !/collection\('operators'\)/.test(ack));

let bad = 0;
for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  — ' + (r.d || '')}`); }
console.log(`\n${R.length - bad}/${R.length} passed`);
process.exit(bad ? 1 : 0);
