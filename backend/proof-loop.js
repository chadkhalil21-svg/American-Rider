// THE PROOF — the whole money path, end to end, once.
//
// NOT A UNIT TEST. It calls the real functions in payments.js against real Stripe in test
// mode, on the founders' own account, and reads every number back FROM STRIPE rather than
// from our own variables. The question this answers is not "does our arithmetic agree with
// itself" — the test suites already answer that — but "does Stripe agree with us".
//
// Run:  node proof-loop.js
// TEST MODE ONLY. It refuses to run against a live key: it creates accounts and moves money.
require('dotenv').config();
const Stripe = require('stripe');
const { quote, createPaymentIntent, transferToOperator } = require('./payments.js');

const key = process.env.STRIPE_SECRET_KEY || '';
if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_')) {
  console.error('Refusing to run: this creates accounts and moves money, and your key is not a test key.');
  process.exit(1);
}
const stripe = Stripe(key);
const money = c => '$' + (c / 100).toFixed(2);
const results = [];
const check = (label, ok, detail) => results.push({ label, ok: !!ok, detail });

(async () => {
  console.log('1. An operator who can actually be paid');
  const op = await stripe.accounts.create({
    type: 'custom', country: 'US', email: 'proof-operator@americanrider.app',
    capabilities: { transfers: { requested: true } },
    business_type: 'individual',
    individual: {
      first_name: 'Proof', last_name: 'Operator', email: 'proof-operator@americanrider.app',
      phone: '+15555555555', ssn_last_4: '0000', dob: { day: 1, month: 1, year: 1990 },
      address: { line1: 'address_full_match', city: 'Miami', state: 'FL', postal_code: '33131', country: 'US' },
    },
    business_profile: { mcc: '4121', url: 'https://americanrider.app' },
    tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '8.8.8.8' },
    external_account: {
      object: 'bank_account', country: 'US', currency: 'usd',
      routing_number: '110000000', account_number: '000123456789',
    },
  });
  const fresh = await stripe.accounts.retrieve(op.id);
  console.log('   ' + op.id + '   transfers=' + fresh.capabilities?.transfers);
  check('operator can receive transfers', fresh.capabilities?.transfers === 'active', JSON.stringify(fresh.capabilities));

  const FARE = 2450; // $24.50 — Brickell to Miami International Airport
  const q = quote(FARE);
  console.log('\n2. The quote for a ' + money(FARE) + ' fare');
  console.log('   traveler pays  ' + money(q.travelerPays));
  console.log('   operator gets  ' + money(q.operatorGets) + '  (' + (100 * q.operatorGets / FARE).toFixed(2) + '% of the fare)');
  console.log('   we keep        ' + money(q.travelerPays - q.operatorGets));

  const uid = 'proof-traveler-' + Date.now();
  const made = await createPaymentIntent({
    travelCostCents: FARE, uid, email: 'proof@americanrider.app',
    tripNo: 'AR-PROOF-MIA', dep: 'Brickell', dest: 'Miami International Airport',
  });
  console.log('\n3. Charging the traveler through the production path');
  console.log('   ' + made.paymentIntentId + ' for ' + money(made.breakdown.travelerPays));
  check('intent is for the all-in price', made.breakdown.travelerPays === q.travelerPays, money(made.breakdown.travelerPays));

  const paid = await stripe.paymentIntents.confirm(made.paymentIntentId, {
    payment_method: 'pm_card_visa', return_url: 'https://americanrider.app',
  });
  console.log('   ' + paid.status + ', ' + money(paid.amount_received) + ' received');
  check('the traveler was actually charged', paid.status === 'succeeded', paid.status);
  check('Stripe took exactly what was quoted', paid.amount_received === q.travelerPays,
    money(paid.amount_received) + ' vs ' + money(q.travelerPays));
  check('the route is on the receipt and the statement', /Brickell to Miami International Airport/.test(paid.description || ''), paid.description);

  console.log('\n4. Settling — the 99% moves');
  const out = await transferToOperator({
    paymentIntentId: made.paymentIntentId, operatorStripeAccount: op.id,
    expectedUid: uid, expectedTripNo: 'AR-PROOF-MIA', rideId: 'proof-' + Date.now(),
  });
  check('the transfer succeeded', out.ok, out.error || out.code);

  if (out.ok) {
    const t = await stripe.transfers.retrieve(out.transferId);
    console.log('\n5. Read back from Stripe, not from us');
    console.log('   transfer ' + t.id + '  ' + money(t.amount) + ' -> ' + t.destination);
    check('operator received exactly 99% of the fare', t.amount === q.operatorGets,
      money(t.amount) + ' vs ' + money(q.operatorGets));
    check('transfer waits on the traveler\'s own charge (source_transaction)', !!t.source_transaction, String(t.source_transaction));
    const keeps = paid.amount_received - t.amount;
    const expected = Math.floor(FARE * 0.01) + (q.travelerPays - FARE);
    console.log('   American Rider keeps ' + money(keeps) +
      '  = 1% commission ' + money(Math.floor(FARE * 0.01)) + ' + platform fee ' + money(q.travelerPays - FARE));
    check('platform take is commission + fee exactly', keeps === expected, money(keeps) + ' vs ' + money(expected));

    console.log('\n6. Settling twice must not pay twice');
    const again = await transferToOperator({
      paymentIntentId: made.paymentIntentId, operatorStripeAccount: op.id,
      expectedUid: uid, expectedTripNo: 'AR-PROOF-MIA', rideId: 'proof-repeat',
    });
    const all = await stripe.transfers.list({ destination: op.id, limit: 10 });
    console.log('   transfers to this operator: ' + all.data.length);
    check('a repeated settlement does not pay the operator twice', all.data.length === 1,
      all.data.length + ' transfers, totalling ' + money(all.data.reduce((n, x) => n + x.amount, 0)));

    console.log('\n7. Somebody else must not be able to claim this fare');
    const stolen = await transferToOperator({
      paymentIntentId: made.paymentIntentId, operatorStripeAccount: op.id,
      expectedUid: 'a-different-traveler', expectedTripNo: 'AR-PROOF-MIA', rideId: 'proof-theft',
    });
    check('a settlement for the wrong traveler is refused', !stolen.ok, JSON.stringify(stolen));
  }

  console.log('\n' + '='.repeat(66));
  let bad = 0;
  for (const r of results) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.ok ? '' : '\n      ' + r.detail}`); }
  console.log(`\n${results.length - bad}/${results.length} passed`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('\nPROOF FAILED: ' + e.message); process.exit(1); });
