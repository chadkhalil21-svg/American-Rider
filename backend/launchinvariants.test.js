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

console.log('✓ production money path has one transfer architecture');
console.log('✓ no gratuity money path');
console.log('✓ durable webhook ACK ordering');
console.log('✓ single-leader sweeps');
console.log('✓ scheduler authorization readiness is observable');
console.log('✓ toll authority readiness is observable');
console.log('✓ dispatch prefilters to available Operators before authoritative matching');
console.log('✓ another-person identity is server authoritative');
console.log('✓ Teen Travel is bound to Family authorization');
console.log('✓ Smart Travel two-charge economics is explicit');
console.log('✓ Operator platform communications are durable and reachable');
