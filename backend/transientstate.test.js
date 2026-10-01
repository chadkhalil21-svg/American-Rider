const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = (p) => fs.readFileSync(p, 'utf8');

const reserve = read('app/reserve.tsx');
assert.match(reserve, /ride\.setQuotedFareCents\(null\);[\s\S]*ride\.setQuotedFeeLines\(\[\]\);[\s\S]*ride\.setTripCoords\(null\);/);
assert.match(reserve, /const quoteReady = smartLeg \|\| \(!pricing && !priceFailed && !unavailable && ride\.quotedFareCents != null\);/);
assert.match(reserve, /quoteReady \? fmt\(allIn\(cls\.key\)\) : '—'/);
assert.doesNotMatch(reserve, /const baseCents = ride\.quotedFareCents \?\? Math\.round\(ride\.arrival\.cost \* 100\)/);

const ride = read('app/ride.tsx');
const cancelCalls = [...ride.matchAll(/ride\.cancelRide\(\)/g)];
assert.ok(cancelCalls.length >= 2, 'both cancellation surfaces remain covered');
assert.equal((ride.match(/await ride\.cancelRide\(\)/g) || []).length, cancelCalls.length, 'every visible cancellation awaits authority before navigation');

const support = read('src/state/RideContext.tsx');
assert.match(support, /submitIssue\([\s\S]*?\.catch\(\(\) => \{[\s\S]*?setIssueState\('failed'\)/);
assert.match(read('app/issues.tsx'), /ride\.issueState === 'describing' \|\| ride\.issueState === 'failed'/);

const pickup = read('app/operator/pickup.tsx');
assert.doesNotMatch(pickup, /op\.cancelOp\(\)/);
assert.match(pickup, /const ok = await op\.confirmArrival\(\)/);
assert.match(pickup, /const ok = await op\.beginTrip\(\)/);

const trip = read('app/operator/trip.tsx');
assert.match(trip, /const ok = await op\.completeOp\(\)/);
assert.match(trip, /disabled=\{completeBusy\}/);

const communicate = read('app/operator/communicate.tsx');
assert.match(communicate, /if \(!t \|\| !tripNo \|\| sending\) return/);
assert.match(communicate, /disabled=\{sending \|\| !draft\.trim\(\)\}/);

const home = read('app/index.tsx');
assert.match(home, /const ok = await ride\.cancelScheduled\(\)/);
assert.match(home, /schedCancelFailed/);

console.log('PASS transient UI/authority boundary invariants');
