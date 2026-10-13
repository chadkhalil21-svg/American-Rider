'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { quote } = require('./payments');
const app = fs.readFileSync(path.join(__dirname, '..', 'src/state/RideContext.tsx'), 'utf8');
const screen = fs.readFileSync(path.join(__dirname, '..', 'app/reserve.tsx'), 'utf8');

// There must be no invented client-side Smart Travel fee or class multiplier.
// Missing/stale server prices block confirmation rather than using a fallback.
assert.doesNotMatch(app, /platformFee\(leg1 \+ fare/);
assert.match(app, /quotedForClass===travelClass&&quotedTotalCents!==null/);
assert.match(app, /quotedTotalCents == null/);
assert.match(screen, /ride\.quotedForClass===ride\.travelClass/);
assert.match(screen, /ride\.quotedTotalCents\/100/);
assert.match(screen, /journeyNo/);

// Both Smart car legs are independently quoted by the server; the second
// includes the first's context, so two transactions are economically funded.
for (const country of ['US', 'GB', null]) {
  for (const [first, second] of [[300, 300], [1000, 2000], [5000, 7500]]) {
    const leg1 = quote(first, null, [], country, 0);
    const leg2 = quote(second, {
      journeyNo: 'AR-LEG1',
      leg1FareCents: first,
      leg1GovernmentFeeCents: 0,
      leg1TollCents: 0,
    }, [], country, 0);
    assert.ok(Number.isSafeInteger(leg1.travelerPays) && leg1.travelerPays > first);
    assert.ok(Number.isSafeInteger(leg2.travelerPays) && leg2.travelerPays > second);
    assert.equal(leg1.operatorGets, first - Math.floor(first / 100));
    assert.equal(leg2.operatorGets, second - Math.floor(second / 100));
    assert.ok(leg2._economics.platformContributionCents >= leg2._economics.requiredContributionCents);
    assert.equal(leg1.travelerPays + leg2.travelerPays,
      first + second + leg1.appFee + leg2.appFee);
  }
}
console.log('✓ Smart Travel uses two server-priced car legs; no unquoted client fallback');
