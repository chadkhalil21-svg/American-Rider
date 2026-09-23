// Cost and abuse controls are enforced on the server, not the client.
// Run: node backend/costcontrols.test.js
const fs = require('fs');
const path = require('path');
const { perIp, perAccount } = require('./ratelimit');

const R = [];
const check = (l, c, d) => R.push({ l, ok: !!c, d });
const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

// Every route that costs money or reaches a third party carries a server-side limit.
const limited = [
  ["post", "/operator/document", 'LIMITS.document'],
  ["post", "/operator/screening/existing", 'LIMITS.screening'],
  ["post", "/operator/screening/intent", 'LIMITS.screening'],
  ["post", "/operator/screening/order", 'LIMITS.screening'],
  ["post", "/operator/screening/reinvite", 'LIMITS.screening'],
  ["post", "/connect/onboard", 'LIMITS.connect'],
  ["post", "/connect/dashboard", 'LIMITS.connect'],
  ["post", "/payment-methods/setup-intent", 'LIMITS.payments'],
  ["post", "/payment-methods/default", 'LIMITS.payments'],
  ["delete", "/payment-methods/:id", 'LIMITS.payments'],
  ["post", "/create-payment-intent", 'LIMITS.payments'],
  ["post", "/charge-ride", 'LIMITS.payments'],
  ["post", "/travel/tip", 'LIMITS.payments'],
  ["post", "/travel/cancel", 'LIMITS.payments'],
  ["post", "/travel/dispatch", 'LIMITS.dispatch'],
  ["post", "/travel/schedule", 'LIMITS.dispatch'],
  ["post", "/travel/return-operator", 'LIMITS.dispatch'],
  ["post", "/travel/announce", 'LIMITS.announce'],
  ["post", "/travel/follow-link", 'LIMITS.announce'],
  ["post", "/voice/token", 'LIMITS.voice'],
  ["post", "/verify/start", 'LIMITS.verify'],
  ["post", "/support", 'LIMITS.support'],
  ["post", "/lost-item", 'LIMITS.lostItem'],
  ["post", "/operator/market", 'LIMITS.market'],
  ["get", "/operator/qualification", 'LIMITS.qualification'],
  ["get", "/operator/commission", 'LIMITS.qualification'],
  ["post", "/operator/qualification/submit", 'LIMITS.qualification'],
  ["post", "/waitlist", 'LIMITS.waitlist'],
  ["post", "/quote", 'LIMITS.quoteIp'],
  ["post", "/fare-quote", 'LIMITS.quoteIp'],
  ["get", "/destinations", 'LIMITS.quoteIp'],
  ["get", "/markets", 'LIMITS.quoteIp'],
  ["post", "/route", 'LIMITS.routeIp'],
  ["post", "/smart-quote", 'LIMITS.routeIp'],
];
for (const [m, p, lim] of limited) {
  const line = (server.match(new RegExp(`app\\.${m}\\('${p.replace(/[/:]/g, (c) => '\\' + c)}',[^\\n]*`)) || [''])[0];
  check(`${m.toUpperCase()} ${p} carries ${lim}`, line.includes(lim), line);
}
check('req.ip is the caller behind Render\'s proxy', /app\.set\('trust proxy', 1\)/.test(server));

// The same document upload is read once.
const doc = (server.match(/app\.post\('\/operator\/document'[\s\S]*?\n\}\);/) || [''])[0];
check('document reading: a repeated upload returns the stored reading, no second model call',
  /prior\.imageUrl === imageUrl && prior\.evidence && prior\.readerVersion === READER_VERSION/.test(doc) && doc.indexOf('repeated: true') < doc.indexOf('readDocument('));
// Stripe charges are idempotent (see idempotency.test.js); screening orders are keyed per payment.
const payments = fs.readFileSync(path.join(__dirname, 'payments.js'), 'utf8');
check('screening payment is keyed', /idempotencyKey: `ar_screening_/.test(payments));

// The limiters themselves.
const run = (mw, req) => {
  let passed = false;
  const res = { set() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  mw(req, res, () => { passed = true; });
  return passed ? 200 : res.code;
};
const ip = perIp({ name: 't-ip', limit: 3, windowMs: 60000 });
const codes = [1, 2, 3, 4].map(() => run(ip, { ip: '198.51.100.7' }));
check('perIp: the fourth call in the window is refused', codes.join() === '200,200,200,429', codes.join());
check('perIp: another address is not affected', run(ip, { ip: '198.51.100.8' }) === 200);
const acct = perAccount({ name: 't-acct', limit: 1, windowMs: 60000 });
check('perAccount: keyed on the signed-in uid', run(acct, { uid: 'u1' }) === 200 && run(acct, { uid: 'u1' }) === 429 && run(acct, { uid: 'u2' }) === 200);

let bad = 0;
for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  — ' + (r.d || '')}`); }
console.log(`\n${R.length - bad}/${R.length} passed`);
process.exit(bad ? 1 : 0);
