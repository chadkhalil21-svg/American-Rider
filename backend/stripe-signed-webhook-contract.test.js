'use strict';
// Uses the real Stripe SDK entirely OFFLINE. No network, live money or real keys.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Stripe = require('stripe');

const stripe = new Stripe('sk_test_offline_synthetic_signature_fixture');
const secret = 'whsec_synthetic_dont_configure_in_render';
const connectSecret = 'whsec_different_connect_fixture';
const now = Math.floor(Date.now()/1000);
const event = {
  id:'evt_synthetic_signed_refund_failed',
  object:'event',
  type:'refund.failed',
  data:{object:{id:'re_fixture_123',object:'refund',status:'failed',
    amount:250, payment_intent:'pi_fixture_123'}},
};
const raw = JSON.stringify(event);
const sign = (payload, key, timestamp=now) =>
  stripe.webhooks.generateTestHeaderString({payload,secret:key,timestamp});

const server=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
const rawGeneral=server.indexOf("app.post('/stripe/webhook', express.raw({ type: 'application/json' })");
const rawConnect=server.indexOf("app.post('/stripe/connect-webhook', express.raw({ type: 'application/json' })");
const parsed=server.indexOf("app.use(express.json())");
assert.ok(rawGeneral>=0&&rawConnect>=0&&parsed>rawConnect,
  'Stripe signed bytes must be read before body parsing');
assert.ok(server.includes("readKey('STRIPE_WEBHOOK_SECRET')"));
assert.ok(server.includes("readKey('STRIPE_CONNECT_WEBHOOK_SECRET')"));
assert.ok(server.includes("webhooks.constructEvent(req.body, req.get('stripe-signature'), secret)"));
assert.ok(server.includes("Signature verification failed:"));
assert.ok(server.includes("return acceptDurableProviderEvent('stripe', event, res)"));

for(let pass=0;pass<2;pass++){
  const valid=stripe.webhooks.constructEvent(Buffer.from(raw),sign(raw,secret),secret);
  assert.equal(valid.type,'refund.failed');
  assert.equal(valid.data.object.id,event.data.object.id);
  const other=stripe.webhooks.constructEvent(Buffer.from(raw),sign(raw,connectSecret),connectSecret);
  assert.equal(other.id,event.id);
  assert.throws(()=>stripe.webhooks.constructEvent(Buffer.from(raw),sign(raw,connectSecret),secret),
    /signature|signature header/i,'general receiver must reject Connect signatures');
  assert.throws(()=>stripe.webhooks.constructEvent(Buffer.from(raw),sign(raw,secret),connectSecret),
    /signature|signature header/i,'Connect receiver must reject general signatures');
  assert.throws(()=>stripe.webhooks.constructEvent(Buffer.from(raw+' '),sign(raw,secret),secret),
    /signature|signature header/i,'mutating raw payload must break the signature');
  assert.throws(()=>stripe.webhooks.constructEvent(Buffer.from(raw),sign(raw,secret,now-601),secret),
    /tolerance|timestamp|recency/i,'an old replay must be refused');
  assert.throws(()=>stripe.webhooks.constructEvent(Buffer.from(raw),'t=1,v1=bad',secret),
    /signature|timestamp/i);
}
console.log('PASS TWICE: real Stripe SDK raw HMAC verification, secret isolation, tampering, stale replay, invalid header; no network or money.');
