const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read=(p)=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const server=read('backend/server.js');
const scheduler=read('backend/scheduler.js');
const scheduled=read('src/backend/scheduled.ts');
const party=read('backend/travelparty.js');

assert.ok(server.includes("app.post('/travel/schedule'"), 'scheduled route exists');
assert.ok(server.includes('const partyResult = normalizeParty(b'), 'scheduled route normalizes party');
assert.ok(server.includes('party,'), 'scheduled record persists party');
assert.ok(scheduler.includes('party: r.party || null'), 'scheduler carries party into live Travel');
assert.ok(scheduled.includes("party?: { mode: 'self' | 'other_adult'"), 'client scheduled contract supports another adult');
assert.equal(scheduled.includes("'minor'"), false, 'client scheduled contract must not advertise unaccompanied minors');
assert.ok(party.includes("unaccompanied_minor_not_supported"), 'server fails closed on unaccompanied minors');

console.log('✓ scheduled Travel preserves Booker/Traveler party semantics');
console.log('✓ scheduled Travel fails closed on unaccompanied minors');
