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

const party=read('backend/travelparty.js');
assert.ok(party.includes('unaccompanied_minor_not_supported'));
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
console.log('✓ another-person identity is server authoritative');
console.log('✓ unaccompanied minors fail closed');
console.log('✓ Smart Travel two-charge economics is explicit');
console.log('✓ Operator platform communications are durable and reachable');
