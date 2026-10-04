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
const operatorHome = read('app/operator/index.tsx');
assert.match(operatorHome, /if \(await op\.acceptRequest\(request\)\) \{\s*dismissAccepted\(\)/,
  'server accepts before the offer sheet is visually dismissed');
assert.doesNotMatch(operatorHome, /closeRequest\(\);[\s\S]{0,220}op\.acceptRequest/,
  'accept cannot lapse an offer before the authoritative transition');
assert.match(operatorHome, /if \(acceptingRef\.current\) return/);
const commissioned = read('app/operator/commissioned.tsx');
assert.match(commissioned, /if \(!op\.ready \|\| op\.verification !== 'commissioned'\)/,
  'the commissioned title is unreachable until server qualification resolves');
const emergency = read('app/emergency.tsx');
assert.match(emergency, /try \{\s*const result = await alertEmergency/);
assert.match(emergency, /catch \{[\s\S]*?state: 'failed'[\s\S]*?finally \{\s*alertBusy\.current = false/,
  'a thrown emergency request must preserve the retry action');
console.log('PASS transient UI/authority boundary invariants');
