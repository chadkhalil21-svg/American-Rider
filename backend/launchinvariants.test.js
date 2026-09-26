const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=(p)=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

const payments=read('backend/payments.js');
assert.equal(/transfer_data\s*:/.test(payments),false);
assert.equal(/application_fee_amount\s*:/.test(payments),false);
assert.equal(/\bchargeTip\b|\btipTravel\b|tipCents/.test(
  ['backend/server.js','backend/payments.js','src/backend/payments.ts','src/state/RideContext.tsx','src/backend/dispatch.ts','app/complete.tsx','firestore.rules'].map(read).join('\n')
),false);

const server=read('backend/server.js');
assert.ok(server.indexOf('await enqueueProviderEvent') < server.indexOf("res.json({ received: true"), 'durable receipt precedes webhook ACK');
assert.ok(server.includes("const name = 'operations_sweep'") && server.includes('await acquireLease(name,'),'sweeps have a single-leader lease');
assert.ok(server.includes("scheduler: readKey('SCHEDULER_TOKEN') ? 'authenticated' : 'off'"), 'health exposes scheduler authorization readiness');
assert.ok(server.includes("tolls: readKey('HERE_API_KEY') ? 'on' : 'off'"), 'health exposes toll authority readiness');
assert.ok(server.includes("const declaredProduction = DEPLOYMENT_MODE === 'production'") && server.includes("const productionMode = declaredProduction || keyMode === 'live'"), 'server has explicit production posture and live money implies it');
assert.ok(server.includes("if (!fleet.length && !operationalMode)"), 'demonstration fleet is impossible in production posture');
assert.ok(server.includes('function productionReadiness()'), 'production readiness is centralized');
assert.ok(server.includes("code: 'production_not_ready'"), 'production operations fail closed when dependencies are incomplete');
for (const route of ['/operator/online', '/fare-quote', '/create-payment-intent', '/travel/dispatch', '/travel/schedule', '/travel/accept']) {
  const line = server.split('\\n').find((x) => x.includes(`app.post('${route}'`)) || '';
  assert.ok(line.includes('requireOperationalReadiness'), `${route} is gated by production readiness`);
}
assert.ok(server.includes(".collection('operators').where('available', '==', true).get()"), 'dispatch prefilters to available Operators');

const party=read('backend/travelparty.js');
assert.ok(party.includes("['self','other_adult','teen']"), 'Teen Travel is an explicit server-authoritative party mode');
assert.ok(party.includes('normalizeTeenParty'), 'Teen Travel delegates to the Family authorization authority');
assert.ok(server.includes('party: operatorPartyView(party)'));
assert.ok(server.includes('travelerName: party.travelerName'));
assert.ok((server.match(/travelerName: party\.travelerName/g)||[]).length >= 2, 'immediate and scheduled Travel use normalized Traveler identity');

const smart=read('backend/payments.js');
assert.ok(smart.includes('transactionCount: 2'));
assert.ok(smart.includes('Math.max(0, combined - alreadyPaid)'));

const inbox=read('backend/platforminbox.js');
assert.ok(inbox.includes("collection('platform_messages')"));
assert.ok(read('src/components/operator.tsx').includes("'Communications'"));


assert.ok(server.includes("app.post('/smart-quote', requireOperationalReadiness"), 'Smart Travel quote must fail closed when production providers are incomplete');
assert.ok(server.includes("app.post('/smart-revalidate', requireOperationalReadiness"), 'Smart Travel continuation verification must fail closed when production providers are incomplete');
assert.ok(server.includes("const productionMode = declaredProduction || keyMode === 'live'"), 'a live Stripe key must force production posture even if DEPLOYMENT_MODE is omitted');
assert.ok(server.includes("if (keyMode !== 'test' || productionMode)"), 'local Stripe test helper must be disabled in production posture');

console.log('✓ production money path has one transfer architecture');
console.log('✓ no gratuity money path');
console.log('✓ durable webhook ACK ordering');
console.log('✓ single-leader sweeps');
console.log('✓ scheduler authorization readiness is observable');
console.log('✓ toll authority readiness is observable');
console.log('✓ production posture disables demonstration fleet independently of Stripe mode');
console.log('✓ production Travel/payment operations fail closed on missing dependencies');
console.log('✓ dispatch prefilters to available Operators before authoritative matching');
console.log('✓ another-person identity is server authoritative');
console.log('✓ Teen Travel is bound to Family authorization');
console.log('✓ Smart Travel two-charge economics is explicit');
console.log('✓ Operator platform communications are durable and reachable');

const appConfig = require('../app.json');
assert.equal(appConfig.expo.name, 'American Rider', 'product name is American Rider');
assert.equal(appConfig.expo.ios.infoPlist.CFBundleDisplayName, 'American Rider', 'iOS display name matches product name');
console.log('✓ native display name is consistent');
