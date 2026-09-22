// What paid for a travel is read from the charge Stripe recorded, never from the phone's
// current selection: the receipt and the Travel Log name the card that was actually charged,
// and say nothing where the record does not.
const assert = require('node:assert');
const { paidWithFromIntent } = require('./payments');

const results = [];
const check = (label, ok, detail) => results.push({ label, ok: !!ok, detail });

const intent = (details) => ({
  id: 'pi_1',
  status: 'succeeded',
  latest_charge: { id: 'ch_1', payment_method_details: details },
});

const visa = paidWithFromIntent(intent({ type: 'card', card: { brand: 'visa', last4: '4242', wallet: null } }));
check('a card names its brand and last four', visa && visa.type === 'card' && visa.brand === 'visa' && visa.last4 === '4242');
check('a card that was not a wallet says so', visa && visa.wallet === null);

const apple = paidWithFromIntent(intent({ type: 'card', card: { brand: 'mastercard', last4: '4444', wallet: { type: 'apple_pay' } } }));
check('a card through Apple Pay says so', apple && apple.wallet === 'apple_pay' && apple.brand === 'mastercard');

const bank = paidWithFromIntent(intent({ type: 'us_bank_account', us_bank_account: { last4: '6789', bank_name: 'STRIPE TEST BANK' } }));
check('a bank account names its last four and no brand', bank && bank.type === 'us_bank_account' && bank.last4 === '6789' && bank.brand === '');
check('a bank account carries the bank\'s own name', bank && bank.bank === 'STRIPE TEST BANK');
check('a card carries no bank name', visa && visa.bank === null);

check('an unexpanded charge yields nothing rather than a guess', paidWithFromIntent({ id: 'pi_2', status: 'succeeded', latest_charge: 'ch_2' }) === null);
check('a charge without method details yields nothing', paidWithFromIntent({ id: 'pi_3', status: 'succeeded', latest_charge: { id: 'ch_3' } }) === null);
check('nothing is shaped from nothing', paidWithFromIntent(null) === null && paidWithFromIntent(undefined) === null);
check('a brand or last four that is not a string is not invented', (() => {
  const p = paidWithFromIntent(intent({ type: 'card', card: { brand: 7, last4: null } }));
  return p && p.brand === '7' && p.last4 === '';
})());

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.detail ? ` — ${r.detail}` : ''}`);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
assert.strictEqual(failed.length, 0);
