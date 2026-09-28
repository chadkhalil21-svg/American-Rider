const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const p = fs.readFileSync(path.join(__dirname,'payments.js'),'utf8');
assert.equal(/transfer_data\s*:/.test(p), false, 'Travel payment code must not create destination charges');
assert.equal(/application_fee_amount\s*:/.test(p), false, 'Travel payment code must not split funds at charge time');
assert.ok(p.includes('stripe.transfers.create'), 'Operator settlement must use explicit transfer');
assert.ok(p.includes('source_transaction: chargeId'), 'settlement transfer must be tied to the Travel charge');
console.log('✓ one money architecture: charge platform, transfer on completed Travel');
