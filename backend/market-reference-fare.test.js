const assert=require('node:assert/strict');
const {fareForMarketTarget,controlledTotal,controlledTargetFromAllIn}=require('./market-reference-fare');
const fakeQuote=(fare)=>({travelerPays:fare+200+350,passThroughCents:350});
assert.equal(controlledTotal(fakeQuote(1000)),1200);
assert.deepEqual(fareForMarketTarget({floorFareCents:1000,targetControlledTotalCents:1500,quoteForFare:fakeQuote}),{fareCents:1300,reason:'market reference',controlledTotalCents:1500});
assert.deepEqual(fareForMarketTarget({floorFareCents:1400,targetControlledTotalCents:1500,quoteForFare:fakeQuote}),{fareCents:1400,reason:'production/economic floor',controlledTotalCents:1600});
const {quote}=require('./payments');
assert.equal(controlledTargetFromAllIn({targetTravelerTotalCents:2000,passThroughCents:350}),1650);
assert.equal(controlledTargetFromAllIn({targetTravelerTotalCents:350,passThroughCents:350}),null);
assert.equal(controlledTargetFromAllIn({targetTravelerTotalCents:200,passThroughCents:350}),null);
assert.equal(controlledTargetFromAllIn({targetTravelerTotalCents:2000,passThroughCents:-1}),null);
for(const cardCountry of ['US','GB',null]){
  const q=fare=>quote(fare,null,[],cardCountry,500);
  const target=controlledTargetFromAllIn({targetTravelerTotalCents:2400,passThroughCents:q(800).passThroughCents});
  const result=fareForMarketTarget({floorFareCents:800,targetControlledTotalCents:target,quoteForFare:q});
  const after=q(result.fareCents);
  assert.ok(after.travelerPays<=2400,'actual TOTAL including toll may not exceed approved market target');
  assert.ok(2400-after.travelerPays<=3,'whole-cent rounding must be tight');
  assert.equal(after.tollCents,500);
  assert.ok(after._economics.platformContributionCents>=after._economics.requiredContributionCents);
}
console.log('market-reference fare solver tests passed');
