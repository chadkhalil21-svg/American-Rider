const assert=require('node:assert/strict');
const {fareForMarketTarget,controlledTotal,controlledTargetFromAllIn}=require('./market-reference-fare');
const fakeQuote=(fare)=>({travelerPays:fare+200+350,passThroughCents:350});
assert.equal(controlledTotal(fakeQuote(1000)),1200);
assert.deepEqual(fareForMarketTarget({floorFareCents:1000,targetControlledTotalCents:1500,quoteForFare:fakeQuote}),{fareCents:1300,reason:'market reference',controlledTotalCents:1500});
assert.deepEqual(fareForMarketTarget({floorFareCents:1400,targetControlledTotalCents:1500,quoteForFare:fakeQuote}),{fareCents:1400,reason:'production/economic floor',controlledTotalCents:1600});
// Actual published reference is the all-in amount; never compare it with
// a fare+fee sub-total without subtracting the known toll and public fees.
const verifiedAllInTarget=2000;
const verifiedPassThrough=350;
const controlled=controlledTargetFromAllIn({
  targetTravelerTotalCents:verifiedAllInTarget,passThroughCents:verifiedPassThrough,
});
assert.equal(controlled,1650);
const solved=fareForMarketTarget({floorFareCents:500,targetControlledTotalCents:controlled,quoteForFare:fakeQuote});
assert.equal(solved.fareCents,1450);
assert.equal(fakeQuote(solved.fareCents).travelerPays,verifiedAllInTarget);
assert.equal(controlledTargetFromAllIn({targetTravelerTotalCents:350,passThroughCents:350}),null);
assert.equal(controlledTargetFromAllIn({targetTravelerTotalCents:300,passThroughCents:350}),null);
assert.equal(controlledTargetFromAllIn({targetTravelerTotalCents:2000,passThroughCents:-1}),null);
assert.equal(controlledTargetFromAllIn({targetTravelerTotalCents:2000,passThroughCents:NaN}),null);
console.log('market-reference fare solver tests passed');
