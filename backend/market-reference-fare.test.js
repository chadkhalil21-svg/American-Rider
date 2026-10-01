const assert=require('node:assert/strict');
const {fareForMarketTarget,controlledTotal}=require('./market-reference-fare');
const fakeQuote=(fare)=>({travelerPays:fare+200+350,passThroughCents:350});
assert.equal(controlledTotal(fakeQuote(1000)),1200);
assert.deepEqual(fareForMarketTarget({floorFareCents:1000,targetControlledTotalCents:1500,quoteForFare:fakeQuote}),{fareCents:1300,reason:'market reference',controlledTotalCents:1500});
assert.deepEqual(fareForMarketTarget({floorFareCents:1400,targetControlledTotalCents:1500,quoteForFare:fakeQuote}),{fareCents:1400,reason:'production/economic floor',controlledTotalCents:1600});
console.log('market-reference fare solver tests passed');
