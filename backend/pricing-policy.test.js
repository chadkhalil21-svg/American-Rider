const assert=require('node:assert/strict');
const P=require('./pricing-policy');

assert.equal(P.MARKET_REFERENCE_TARGET_FRACTION,0.90);
assert.equal(P.targetTotalCents(3100),2790);
assert.equal(P.targetTotalCents(2700),2430);
assert.ok(P.REFERENCE_DIMENSIONS.includes('daypart'));
assert.ok(P.REFERENCE_DIMENSIONS.includes('weekdayWeekend'));
assert.ok(P.REFERENCE_DIMENSIONS.includes('calendarClass'));
assert.ok(P.MARKET_BALANCE_SIGNALS.includes('traffic'));
assert.ok(P.MARKET_BALANCE_SIGNALS.includes('specialEvents'));
assert.ok(P.MARKET_BALANCE_SIGNALS.includes('weather'));
assert.ok(P.MARKET_BALANCE_SIGNALS.includes('pickupBurden'));
assert.ok(P.MARKET_BALANCE_SIGNALS.includes('destinationConditions'));
assert.throws(()=>P.targetTotalCents(-1));

console.log('national market-reference pricing policy tests passed');
