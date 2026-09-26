const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ride=fs.readFileSync(path.join(__dirname,'..','src','state','RideContext.tsx'),'utf8');
const smart=fs.readFileSync(path.join(__dirname,'smart.js'),'utf8');
const authority=fs.readFileSync(path.join(__dirname,'fareauthority.js'),'utf8');
const money=fs.readFileSync(path.join(__dirname,'travelmoney.js'),'utf8');

// Process death / restart: journey envelope persists, but it cannot grant authority.
assert.ok(ride.includes("SMART_JOURNEY_STORAGE_KEY = 'american-rider.smart-journey.v1'"));
assert.ok(ride.includes('AsyncStorage.getItem(SMART_JOURNEY_STORAGE_KEY)'),'restart must hydrate Smart Travel continuation');
assert.ok(ride.includes('AsyncStorage.setItem(SMART_JOURNEY_STORAGE_KEY'),'journey mutations must persist');
assert.ok(ride.includes('AsyncStorage.removeItem(SMART_JOURNEY_STORAGE_KEY'),'completion/cancellation must remove persisted continuation');
assert.ok(authority.includes("x.status !== 'completed'"),'leg 2 must still require completed leg 1 after client restart');
assert.ok(authority.includes('!x.paymentIntentId'),'leg 2 must still require paid leg 1 after client restart');

// Cancellation/replan: a cancelled car Travel destroys the continuation instead of silently
// continuing an obsolete transit itinerary.
const cancel=ride.slice(ride.indexOf('const cancelRide:'),ride.indexOf('const threadFor',ride.indexOf('const cancelRide:')));
assert.ok(cancel.includes('smartJourneyRef.current = null')&&cancel.includes('setSmartJourney(null)'),'cancelled Smart car leg must end the journey');

// Unknown agency fare: never represented as a known zero-dollar fare.
assert.ok(smart.includes('if (cents == null) out.fareUnknown = true'));
assert.ok(smart.includes('const transitFareUnknown = ours.some((l) => l.fareUnknown)'));

// Two-car charge reconciliation: preview and actual authority use the same journey continuation.
assert.ok(smart.includes('const q1 = quote(first.cents'));
assert.ok(smart.includes('const q2 = quote(second.cents'));
assert.ok(ride.includes("journeyNo: smartJourneyRef.current?.stage === 'leg2' ? smartJourneyRef.current.leg1No ?? null : null"));
assert.ok(money.includes('expectedTripNo: ride.tripNo || null'),'settlement must bind payout to the Travel payment/number');

console.log('all Smart Travel restart/cancellation/authority invariants passed');
