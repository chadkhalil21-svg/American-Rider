// AN OPERATOR CAN REACH THE PLATFORM AI, AND THE GUARDS ARE THE SAME ONES.
//
// Patron Support has resolved travelers' cases with an AI since 16 August. An operator had no
// path at all — not a worse one, none. This proves the new one refuses what it must before a
// model is ever asked, and that its remedy is the right direction of money.
const fs = require('fs');
const path = require('path');
const { resolveOperatorIssue, MAX_AUTO_PAYMENT_CENTS } = require('./operatorsupport');
const { MAX_AUTO_CREDIT_CENTS } = require('./support');

const results = [];
const check = (label, ok, detail) => results.push({ label, ok: !!ok, detail });
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const run = (description, language = 'en') => resolveOperatorIssue({ description, travel: {}, language });

(async () => {
  // ---- Refused before a model is asked ---------------------------------------------------
  // No ANTHROPIC_API_KEY is needed for any of these: they must not reach a model at all.
  for (const [label, text] of [
    ['a passenger who assaulted them', 'A passenger grabbed my arm when I stopped'],
    ['an accident', 'I was in a crash on the way to the pickup'],
    ['a legal threat', 'I am going to speak to a lawyer about this'],
    ['the same thing in Spanish', 'Un pasajero me empujó al salir del coche'],
  ]) {
    const out = await run(text);
    check(`${label} goes straight to a person`, out.action === 'escalate' && out.forced === true, JSON.stringify(out));
  }
  check('an empty message is not sent to a model either',
    (await run('   ')).action === 'escalate');

  // ---- The guard is SHARED with the traveler's side, not a second copy --------------------
  const src = read('operatorsupport.js');
  check('it uses the shared mustReachHuman(), which carries the translated patterns too',
    /mustReachHuman/.test(src) && !/ALWAYS_HUMAN\.some/.test(src),
    'a second copy of that list would drift, and the drifted copy is the one nobody reads');
  check('and it checks the model OUTPUT as well as the input',
    (src.match(/mustReachHuman/g) || []).length >= 3);

  // ---- The direction of money, which is the whole reason this is a separate resolver ------
  check('the operator resolver can pay, and cannot credit or refund',
    /'explain', 'pay', 'escalate'/.test(src) && !/refund/i.test(src.replace(/\/\/.*$/gm, '')),
    'a refund would take a completed fare back from a traveler to settle an operator complaint');
  check('it is told in the prompt that the money is ours, not the traveler\'s',
    /THE MONEY YOU PAY IS OURS, NOT THE TRAVELER'S/.test(src));
  check('and that a deactivation, screening or insurance decision is never its to make',
    /deactivation, screening or insurance decision/.test(src));

  // ---- The cap ---------------------------------------------------------------------------
  check('an automatic payment is capped', Number.isInteger(MAX_AUTO_PAYMENT_CENTS) && MAX_AUTO_PAYMENT_CENTS > 0);
  check('at the same figure the traveler side uses, because both cover one whole typical travel',
    MAX_AUTO_PAYMENT_CENTS === MAX_AUTO_CREDIT_CENTS, `${MAX_AUTO_PAYMENT_CENTS} vs ${MAX_AUTO_CREDIT_CENTS}`);

  // ---- Wired, not merely written ---------------------------------------------------------
  // This codebase's recurring defect is the second thing, not the first: built at both ends
  // and never connected at the gate.
  const server = read('server.js');
  check('POST /operator/support exists', /app\.post\('\/operator\/support'/.test(server));
  check('and it requires a signed-in caller', /app\.post\('\/operator\/support', requireAuth/.test(server));
  check('an approved payment is actually transferred, not just reported',
    /transferFixed\(\{ account, amountCents: decision\.pay_cents/.test(server));
  check('and a transfer that fails becomes an escalation rather than a settled case',
    /approved but not issued/.test(server));

  // ---- The fee formula is not quoted at anybody, on either side ---------------------------
  check('neither resolver may quote a fee formula',
    /NEVER QUOTE A FEE FORMULA/.test(src) && /NEVER QUOTE A FEE FORMULA/.test(read('support.js')),
    'two schedules exist; any formula stated is wrong for half the people who read it');

  for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.label}${r.ok || !r.detail ? '' : ` — ${r.detail}`}`);
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length ? `\n${failed.length} FAILED of ${results.length}` : `\nall ${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
