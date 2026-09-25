// EVERY charge we create must be keyed, and the key must be specific to one travel.
//
// This is a source-level gate rather than a behaviour test, deliberately. The defect it guards
// is "somebody adds a new paymentIntents.create and forgets the second argument" — which no
// behavioural test of the existing calls would ever catch. Read the file, find every create,
// and require a key on each.
//
// Found 19 Sept 2026 during a pre-launch sweep: transfers, tips, scheduled travel and
// screening were all keyed; the traveler's own fare — the largest and most frequent charge the
// platform makes — was not. A double-tap on Confirm Travel created a second PaymentIntent for
// the same journey.
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const { platformFeeCents } = require(path.join(ROOT, 'payments.js'));

const R = [];
const check = (l, c, d) => R.push({ l, ok: !!c, d });

const src = fs.readFileSync(path.join(ROOT, 'payments.js'), 'utf8');

// ——— every create is keyed ————————————————————————————————————————————————————
// `stripe.paymentIntents.create(params)` with a single argument is the defect. A keyed call
// either passes a second argument on the same line, or opens a multi-line argument list.
// Balance the parentheses rather than guess where the call ends: a non-greedy match stops at
// the first ")" inside the params object and reports a keyed call as unkeyed, or misses it
// entirely. This found 2 of 5 calls on the first attempt.
function callsTo(needle, text) {
  const out = [];
  let i = 0;
  while ((i = text.indexOf(needle, i)) !== -1) {
    let d = 0, j = i + needle.length - 1;
    for (; j < text.length; j++) {
      if (text[j] === '(') d++;
      else if (text[j] === ')') { d--; if (d === 0) break; }
    }
    out.push(text.slice(i + needle.length, j));
    i = j;
  }
  return out;
}
const creates = callsTo('stripe.paymentIntents.create(', src).map((a) => [null, a]);
check('payments.js still creates PaymentIntents', creates.length > 0, `found ${creates.length}`);
let unkeyed = 0;
for (const m of creates) {
  const args = m[1];
  const keyed = /idempotencyKey/.test(args) || /idempotencyForTravel\(/.test(args);
  if (!keyed) unkeyed++;
}
check(`all ${creates.length} paymentIntents.create calls carry an idempotency key`,
  unkeyed === 0, `${unkeyed} unkeyed`);

// ——— the key is specific to one travel ————————————————————————————————————————
const { __idempotencyForTravel: keyFor } = require(path.join(ROOT, 'payments.js'));
if (typeof keyFor === 'function') {
  const a = keyFor('travel', 'uidA', 'AR-1-MIA', 2450);
  const b = keyFor('travel', 'uidA', 'AR-2-MIA', 2450);
  const c = keyFor('travel', 'uidB', 'AR-1-MIA', 2450);
  const d = keyFor('travel', 'uidA', 'AR-1-MIA', 9900);
  check('same traveler, same travel, same amount -> same key',
    a.idempotencyKey === keyFor('travel', 'uidA', 'AR-1-MIA', 2450).idempotencyKey);
  check('different travel -> different key', a.idempotencyKey !== b.idempotencyKey);
  check('different traveler -> different key', a.idempotencyKey !== c.idempotencyKey);
  check('re-quoted at a new amount -> different key, so the new price is charged',
    a.idempotencyKey !== d.idempotencyKey);
  check('no Travel Number -> NO key, rather than one that could collide',
    keyFor('travel', 'uidA', null, 2450) === undefined);
  check('no uid -> no key', keyFor('travel', null, 'AR-1-MIA', 2450) === undefined);
  check('charge and create keys never collide for the same travel',
    keyFor('charge', 'uidA', 'AR-1-MIA', 2450).idempotencyKey !== a.idempotencyKey);
} else {
  check('idempotencyForTravel is exported for testing', false, 'not exported');
}

// Payment idempotency must not bypass canonical pricing.
check('the canonical loss-safe fee still prices a $25 unknown-card Travel', platformFeeCents(2500) === 282);

let bad = 0;
for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  — ' + (r.d || '')}`); }
console.log(`\n${R.length - bad}/${R.length} passed`);
process.exit(bad ? 1 : 0);
