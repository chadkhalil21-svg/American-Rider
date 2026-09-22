// A saved payment method, as the app shows it, is read from Stripe's record and shaped here.
// The shape is what the Payment & Settlement screen renders, so it is held to what a traveler
// would recognise: the brand, the last four, the expiry, the wallet it came through, and
// whether it is the one charged when they are not asked.
const assert = require('node:assert');
const { describePaymentMethod } = require('./payments');

const results = [];
const check = (label, ok, detail) => results.push({ label, ok: !!ok, detail });

const visa = {
  id: 'pm_1', type: 'card', customer: 'cus_1',
  card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2027, wallet: null },
};
const applePayCard = {
  id: 'pm_2', type: 'card', customer: 'cus_1',
  card: { brand: 'mastercard', last4: '4444', exp_month: 3, exp_year: 2028, wallet: { type: 'apple_pay' } },
};

const d1 = describePaymentMethod(visa, 'pm_1');
check('brand, last four and expiry are carried through', d1.brand === 'visa' && d1.last4 === '4242' && d1.expMonth === 12 && d1.expYear === 2027);
check('the default is marked as such', d1.isDefault === true);
check('a card is not a wallet', d1.wallet === null);

const d2 = describePaymentMethod(applePayCard, 'pm_1');
check('a card that came through Apple Pay says so', d2.wallet === 'apple_pay');
check('a non-default is not marked default', d2.isDefault === false);

check('no default on record marks nothing default', describePaymentMethod(visa, null).isDefault === false);
check('a method with no card block still has an id and type', (() => { const d = describePaymentMethod({ id: 'pm_3', type: 'us_bank_account' }, null); return d.id === 'pm_3' && d.type === 'us_bank_account' && d.brand === '' && d.last4 === '' && d.expMonth === null; })());
check('nothing is shaped from nothing', describePaymentMethod(null, 'pm_1') === null);
check('an expiry that is not an integer is not invented', describePaymentMethod({ id: 'pm_4', type: 'card', card: { brand: 'amex', last4: '0005', exp_month: '3', exp_year: null } }, null).expMonth === null);

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.detail ? ` — ${r.detail}` : ''}`);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
assert.strictEqual(failed.length, 0);
