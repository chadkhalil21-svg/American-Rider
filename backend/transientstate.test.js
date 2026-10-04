const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const reserve = read('app/reserve.tsx');
assert.match(reserve, /ride\.setQuotedFareCents\(null\);[\s\S]*ride\.setQuotedFeeLines\(\[\]\);[\s\S]*ride\.setTripCoords\(null\);/);
assert.match(reserve, /const authoritativePriceReady = ride\.quotedFareCents != null && !pricing && !ride\.repricing && !priceFailed && !unavailable/);
assert.match(reserve, /if \(!authoritativePriceReady \|\| ride\.quotedFareCents == null\) return null/);
assert.match(reserve, /!authoritativePriceReady \? \(/); // The total must not print a provisional figure.
assert.doesNotMatch(reserve, /const baseCents = ride\.quotedFareCents \?\? Math\.round\(ride\.arrival\.cost \* 100\)/);

const ride = read('app/ride.tsx');
const cancelCalls = [...ride.matchAll(/ride\.cancelRide\(\)/g)];
assert.ok(cancelCalls.length >= 2, 'both cancellation surfaces remain covered');
assert.equal((ride.match(/await ride\.cancelRide\(\)/g) || []).length,
  cancelCalls.length, 'every visible cancellation awaits authority before navigating');
assert.match(ride, /if \(ok\) router\.dismissTo\('\/'\)/);
assert.match(ride, /if \(await ride\.cancelRide\(\)\) router\.dismissTo\('\/'\)/);

const support = read('src/state/RideContext.tsx');
assert.match(support, /submitIssue\([\s\S]*?\.catch\(\(\) => \{[\s\S]*?setIssueState\('describing'\)/);
const issues = read('app/issues.tsx');
assert.match(issues, /if \(!await ride\.submitDescription\(draft\)\) setSubmissionFailed\(true\)/);
assert.match(issues, /submissionFailed && <Text/);

const pickup = read('app/operator/pickup.tsx');
assert.doesNotMatch(pickup, /op\.cancelOp\(\)/);
assert.match(pickup, /const ok = await op\.confirmArrival\(\)/);
assert.match(pickup, /const ok = await op\.beginTrip\(\)/);
const trip = read('app/operator/trip.tsx');
assert.match(trip, /const ok = await op\.completeOp\(\)/);
assert.match(trip, /disabled=\{completing\}/);
const communicate = read('app/operator/communicate.tsx');
assert.match(communicate, /if \(!text \|\| !tripNo \|\| sendingRef\.current\) return/);
assert.match(communicate, /disabled=\{sending \|\| !draft\.trim\(\) \|\| !tripNo\}/);
const home = read('app/index.tsx');
assert.match(home, /if \(!await ride\.cancelScheduled\(\)\) setScheduledCancelError/);
assert.match(home, /disabled=\{cancellingScheduled\}/);
console.log('PASS transient UI/authority boundary invariants');
