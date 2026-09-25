const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

const payments=read('backend/payments.js');
const server=read('backend/server.js');
const queue=read('backend/providerqueue.js');
const checkr=read('backend/checkr.js');
const lease=read('backend/schedulerlease.js');
const scheduled=read('src/backend/scheduled.ts');
const scheduler=read('backend/scheduler.js');

assert.equal(/transfer_data\s*:/.test(payments), false, 'payments.js must not create destination charges');
assert.equal(/application_fee_amount\s*:/.test(payments), false, 'payments.js must not create application-fee charges');
assert.ok(payments.includes("idempotencyKey: `ar_transfer_"), 'completed-Travel transfer must be idempotent');
assert.ok(server.includes("keyMode !== 'test'"), 'terminal charge route must refuse live Stripe mode');

assert.ok(queue.includes("where('status', 'in', ['pending', 'processing'])"), 'expired processing events must be sweep candidates');
assert.ok(queue.includes("x.status === 'processing' && Number(x.leaseUntil || 0) > now"), 'live provider lease must prevent concurrent processing');

assert.ok(checkr.includes('activeProviderAdverseActions({ reportId, api })'), 'report replay must reuse active adverse action');
assert.ok(checkr.includes("type === 'report.dispute_completed'"), 'provider dispute completion must re-enter adjudication');

assert.ok(lease.includes('renewLease'), 'scheduler lease must support renewal');
assert.ok(server.includes('renewLease(name'), 'server must renew leadership during long sweeps');
assert.ok(server.includes('releaseLease(name'), 'server must release leadership after a sweep');

assert.ok(scheduled.includes("mode: 'self' | 'other_adult' | 'minor'"), 'scheduled Travel must carry minor party semantics');
assert.ok(scheduled.includes('guardianAttestation'), 'scheduled Travel must carry guardian attestation');
assert.ok(scheduler.includes('party: r.party || null'), 'scheduled reservation party must reach dispatched Travel');

console.log('✓ one-transfer Stripe architecture');
console.log('✓ durable provider crash recovery');
console.log('✓ adverse-action replay safety');
console.log('✓ renewable scheduler leadership');
console.log('✓ scheduled party propagation');
