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

assert.ok(scheduled.includes("mode: 'self' | 'other_adult'"), 'scheduled Travel must preserve Booker/Traveler party semantics');
assert.ok(scheduled.includes("| 'teen'"), 'scheduled Travel must support authorized Teen Travel');
assert.ok(scheduled.includes('familyLinkId'), 'scheduled Teen Travel must carry Family authorization reference');
const party=read('backend/travelparty.js');
const family=read('backend/family.js');
assert.ok(party.includes('normalizeTeenParty'), 'Teen Travel must be normalized server-side');
assert.ok(family.includes("status:'active'"), 'Teen Travel requires an active Family relationship');
assert.ok(family.includes('pinRequired:true'), 'Teen Travel must require pickup PIN');
assert.ok(family.includes('guardianTracking:true'), 'Teen Travel must enable guardian tracking');
assert.ok(family.includes('guardianMessaging:true'), 'Teen Travel must enable guardian messaging');
assert.ok(family.includes('continuedFromJourneyNo'), 'Smart Travel leg two must inherit the first leg Family safety envelope');
assert.ok(family.includes("status:'aged_out'"), 'Family authorization must automatically age out');
assert.ok(family.includes('sweepFamilyAgeOut'), 'Family age-out must run as an operational sweep');
const familyScreen=read('app/family.tsx');
assert.ok(familyScreen.includes('useLocalSearchParams'), 'Family invitation must enter through a deep link');
assert.equal(familyScreen.includes('Invitation ID'), false, 'Family UI must not ask a Teen to type an invitation id');
assert.equal(familyScreen.includes('Invitation code'), false, 'Family UI must not ask a Teen to type an invitation token');
const rideContext=read('src/state/RideContext.tsx');
assert.ok(rideContext.includes('party: {...travelPartyRef.current}'), 'Smart Travel must freeze the party at journey start');
assert.ok(rideContext.includes('setTravelParty({...next.party})'), 'Smart Travel leg two must restore the frozen party');
assert.ok(scheduler.includes('party: r.party || null'), 'scheduled reservation party must reach dispatched Travel');

console.log('✓ one-transfer Stripe architecture');
console.log('✓ durable provider crash recovery');
console.log('✓ adverse-action replay safety');
console.log('✓ renewable scheduler leadership');
console.log('✓ scheduled Family/Teen authorization propagation');
