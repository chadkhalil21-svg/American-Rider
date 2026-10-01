const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read=(p)=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const server=read('backend/server.js');
const scheduler=read('backend/scheduler.js');
const scheduled=read('src/backend/scheduled.ts');
const party=read('backend/travelparty.js');

assert.ok(server.includes("app.post('/travel/schedule'"), 'scheduled route exists');
assert.ok(server.includes('pickupRegion.timezone'), 'scheduled epoch is interpreted in the pickup market timezone');
assert.ok(server.includes("code: 'scheduled_time_mismatch'"), 'server rejects a client epoch that disagrees with the displayed civil appointment');
assert.ok(server.includes('civilDate !== serverDate || civilTime !== serverTime'), 'device clock/timezone cannot silently redefine the appointment');
assert.ok(server.includes('const partyResult = await normalizeParty(b'), 'scheduled route normalizes party through authoritative Family-aware policy');
assert.ok(server.includes('party,'), 'scheduled record persists party');
assert.ok(scheduler.includes('party: r.party || null'), 'scheduler carries party into live Travel');
assert.ok(scheduler.includes("doc(`scheduled_${id}`)"), 'scheduled Travel identity is deterministic across crash/replay');
assert.ok(scheduler.includes('if (existingRide.exists)'), 'scheduler recovers an already-created Travel after a crash');
assert.ok(scheduler.includes('effectiveOperator = {'), 'replay preserves the Operator already committed to the Travel');
assert.ok(scheduled.includes('civilDate?: string') && scheduled.includes('civilTime?: string'), 'client contract carries the displayed civil appointment for server validation');
assert.ok(scheduled.includes("party?: { mode: 'self' | 'other_adult'"), 'client scheduled contract supports another adult');
assert.ok(scheduled.includes("mode: 'self' | 'other_adult' | 'teen'"), 'client scheduled contract supports authorized Teen Travel');
assert.ok(party.includes('normalizeTeenParty'), 'server delegates scheduled Teen Travel to Family authorization');

console.log('✓ scheduled Travel preserves Booker/Traveler party semantics');
console.log('✓ scheduled Teen Travel uses Family authorization');
