const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const p = fs.readFileSync(path.join(__dirname,'payments.js'),'utf8');
assert.equal(/transfer_data\s*:/.test(p), false, 'Travel payment code must not create destination charges');
assert.equal(/application_fee_amount\s*:/.test(p), false, 'Travel payment code must not split funds at charge time');
assert.ok(p.includes('stripe.transfers.create'), 'Operator settlement must use explicit transfer');
assert.ok(p.includes('source_transaction: chargeId'), 'settlement transfer must be tied to the Travel charge');
// Wallet setup is deliberately independent of whole-platform readiness. A screening,
 // scheduler, HERE or Ops outage must not disable adding a card. Actual charging remains
 // protected by requireOperationalReadiness.
const server = fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
const wallet = fs.readFileSync(path.join(__dirname,'..','app','wallet.tsx'),'utf8');
assert.ok(
  server.includes("canManagePaymentMethods: keyMode !== 'no-key' && !!readKey('STRIPE_PUBLISHABLE_KEY')"),
  'Wallet capability must be derived from Stripe configuration, not global readiness',
);
assert.ok(
  /create-payment-intent[^\n]*requireOperationalReadiness/.test(server),
  'Travel charging must remain behind operational readiness',
);
assert.ok(
  wallet.includes('!payConfig.canManagePaymentMethods'),
  'Wallet Add payment method must use the Wallet-specific capability',
);
assert.equal(
  /disabled=\{adding \|\| !payConfig\.canTakePayment\}/.test(wallet),
  false,
  'Wallet must not use the whole-platform payment gate',
);
console.log('✓ one money architecture: charge platform, transfer on completed Travel');
console.log('✓ Wallet setup capability is independent; Travel charging remains fail-closed');
