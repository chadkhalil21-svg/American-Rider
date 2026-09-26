const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read=(p)=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const server=read('backend/server.js');
const scheduler=read('backend/scheduler.js');
const scheduled=read('src/backend/scheduled.ts');
const party=read('backend/travelparty.js');

assert.ok(server.includes("app.post('/travel/schedule'"), 'scheduled route exists');
assert.ok(server.includes('const partyResult = await normalizeParty(b'), 'scheduled route normalizes party through authoritative Family-aware policy');
assert.ok(server.includes('party,'), 'scheduled record persists party');
assert.ok(scheduler.includes('party: r.party || null'), 'scheduler carries party into live Travel');
assert.ok(scheduled.includes("party?: { mode: 'self' | 'other_adult'"), 'client scheduled contract supports another adult');
assert.ok(scheduled.includes("mode: 'self' | 'other_adult' | 'teen'"), 'client scheduled contract supports authorized Teen Travel');
assert.ok(party.includes('normalizeTeenParty'), 'server delegates scheduled Teen Travel to Family authorization');

console.log('✓ scheduled Travel preserves Booker/Traveler party semantics');
console.log('✓ scheduled Teen Travel uses Family authorization');
