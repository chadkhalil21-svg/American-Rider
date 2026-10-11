'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { cachedPayoutStatus, STRIPE_DUTY_MAX_AGE_MS } = require('./stripe-duty-cache');

const NOW = 1_800_000_000_000;
const ready = { available: true, payoutsEnabled: true,
  stripeAccountId: 'acct_operator_1', stripeCheckedAt: NOW - 60_000 };
const lookup = fleet => cachedPayoutStatus({ accountId:'acct_operator_1', fleet, now:NOW });

assert.deepEqual(lookup(ready), { payoutsEnabled:true, cached:true,
  due:[], stripeCheckedAt:NOW-60_000 }, 'one recent server-verified status survives an ordinary GPS renewal');
for (const changed of [
  { available:false }, { payoutsEnabled:false }, { stripeAccountId:'acct_other' },
  { stripeCheckedAt:null }, { stripeCheckedAt:0 }, { stripeCheckedAt:NOW+1 },
  { stripeCheckedAt:NOW-STRIPE_DUTY_MAX_AGE_MS },
  { stripeCheckedAt:NOW-STRIPE_DUTY_MAX_AGE_MS-1 },
]) {
  assert.equal(lookup({...ready,...changed}),null,
    'no cached approval for an offline, revoked, mismatched, absent, future or expired attestation');
}
assert.equal(lookup(null),null);
assert.equal(cachedPayoutStatus({accountId:null,fleet:ready,now:NOW}),null);
assert.ok(STRIPE_DUTY_MAX_AGE_MS>0 && STRIPE_DUTY_MAX_AGE_MS<=24*60*60_000,
  'fallback provider refresh must remain finite');

const server = fs.readFileSync(require.resolve('./server'), 'utf8');
const route = server.split("app.post('/operator/online'")[1]?.split("app.post('/operator/offline'")[0] || '';
assert.match(route,/cachedPayoutStatus\(/);
assert.match(route,/cachedStatus \|\| await connectAccountStatus\(/,
  'first duty, untrusted status and expiration must call the provider');
assert.match(route,/stripeCheckedAt = cachedStatus \? cachedStatus\.stripeCheckedAt : Date\.now\(\)/,
  'GPS renewals must never extend the trusted status timestamp');
assert.match(route,/stripeAccountId: rec\.stripeAccountId \|\| null/,
  'cache must bind to authenticated server-side Connect account ID');
assert.match(route,/assessOperator\(/);
assert.match(route,/accountDisabled\(req\.uid\)/,
  'Firebase Auth/account checks continue at every heartbeat');
const accept = server.split("app.post('/travel/accept'")[1]?.split("app.post('/travel/progress'")[0] || '';
assert.match(accept,/qualificationChecks\(uid, u\)/,
  'a paid acceptance must still query live Stripe, independent of the duty cache');
const checks = server.split('async function qualificationChecks')[1]?.split('const qualificationBody')[0] || '';
assert.match(checks,/connectAccountStatus\(/,
  'live acceptance is never satisfied solely by cached status');
const webhook = fs.readFileSync(require.resolve('./webhook'), 'utf8');
assert.match(webhook,/case 'account.updated'/);
assert.match(webhook,/available: false/);
assert.match(webhook,/stripeCheckedAt: Date\.now\(\)/,
  'signed provider account changes must immediately disable/revalidate status');

console.log('PASS finite account-bound Stripe status reuse; live acceptance and signed downgrade gates retained');
