// Dev tool: create a TEST-MODE Stripe Connect account for a pretend operator, so we can prove
// the 99/1 split locally before any real operator has signed up.
//
// Run:  node create-test-operator.js
// It prints an account id (acct_...) to use as operatorStripeAccount when charging a ride.
//
// TEST MODE ONLY. The values below are Stripe's documented test values (a fake SSN, a fake
// routing/account number, an address token that auto-passes verification). Never real data.

require('dotenv').config();
const Stripe = require('stripe');

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('STRIPE_SECRET_KEY is not set — add it to backend/.env');
  process.exit(1);
}
if (!key.startsWith('sk_test_')) {
  console.error('Refusing to run: this tool is TEST MODE ONLY and your key is not an sk_test_ key.');
  process.exit(1);
}
const stripe = Stripe(key);

(async () => {
  try {
    const acct = await stripe.accounts.create({
      type: 'custom',
      country: 'US',
      email: 'operator.demo@americanrider.test',
      business_type: 'individual',
      capabilities: { transfers: { requested: true } },
      individual: {
        first_name: 'Miguel',
        last_name: 'Operator',
        email: 'operator.demo@americanrider.test',
        phone: '+15005550006',
        dob: { day: 1, month: 4, year: 1990 },
        address: { line1: 'address_full_match', city: 'Miami', state: 'FL', postal_code: '33101' },
        ssn_last_4: '0000',
        id_number: '000000000',
      },
      business_profile: {
        mcc: '4121',
        product_description: 'Rideshare operator',
        url: 'https://americanrider.test',
      },
      tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '8.8.8.8' },
      external_account: {
        object: 'bank_account',
        country: 'US',
        currency: 'usd',
        routing_number: '110000000',
        account_number: '000123456789',
      },
    });
    console.log('operator account :', acct.id);
    console.log('transfers        :', acct.capabilities.transfers);
    console.log('payouts enabled  :', acct.payouts_enabled);
  } catch (e) {
    console.error('failed:', e.message, e.raw ? `(${e.raw.code || e.raw.type})` : '');
    process.exit(1);
  }
})();
