const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root,p),'utf8');
const files = [
  'backend/server.js','backend/payments.js','src/backend/payments.ts',
  'src/state/RideContext.tsx','src/backend/dispatch.ts','app/complete.tsx','firestore.rules',
].map(read).join('\n');

assert.equal(/\/travel\/tip\b/.test(files), false, 'no tip HTTP route may remain');
assert.equal(/\bchargeTip\b|\btipTravel\b|tipCents/.test(files), false, 'no tip charge/client/database authority may remain');

const rules=read('firestore.rules');
assert.ok(rules.includes("touchesOnly(['rating', 'reviewedAt'])"), 'Traveler review must be rating-only');

const qualification=read('backend/qualification.js');
assert.ok(qualification.includes("s?.decision === 'pre_adverse'"), 'pre-adverse must be an explicit qualification hold');

const server=read('backend/server.js');
assert.ok(server.includes("listPlatformMessages"), 'Operator platform inbox routes must be mounted');
assert.ok(server.includes("normalizeParty"), 'server dispatch must normalize Booker/Traveler party');

console.log('✓ no-tip invariant');
console.log('✓ rating-only Firestore authority');
console.log('✓ pre-adverse qualification hold');
console.log('✓ Operator platform inbox mounted');
console.log('✓ server-authoritative Travel party gate');
