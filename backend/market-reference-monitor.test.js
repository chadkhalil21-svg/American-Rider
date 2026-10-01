const assert=require('node:assert/strict');
const M=require('./market-reference-monitor');
const now=Date.parse('2026-10-01T12:00:00Z');

assert.equal(M.CADENCE.externalObservationMinutes,60);
assert.equal(M.CADENCE.productionPromotionMinutes,1440);
assert.equal(M.CADENCE.ownMarketplaceMaxAgeMinutes,5);
assert.equal(M.GUARDRAILS.targetFraction,0.90);
assert.equal(M.GUARDRAILS.prohibitPersonalizedPricing,true);
assert.equal(M.GUARDRAILS.declaredEmergencyDisablesUpwardDynamicAdjustment,true);
assert.equal(M.GUARDRAILS.emergencyBaselineDays,30);
assert.equal(M.freshness({kind:'traffic',asOf:'2026-10-01T11:57:00Z'},now).ok,true);
assert.equal(M.freshness({kind:'traffic',asOf:'2026-10-01T11:50:00Z'},now).ok,false);
assert.equal(M.freshness({kind:'weather',asOf:'2026-10-01T11:50:00Z'},now).ok,true);
assert.equal(M.promotionDecision({currentCents:3000,nextCents:3150,independentEvidenceFamilies:2,holdoutPassed:true,economicsPassed:true,routerPassed:true}).promote,true);
assert.equal(M.promotionDecision({currentCents:3000,nextCents:3400,independentEvidenceFamilies:2,holdoutPassed:true,economicsPassed:true,routerPassed:true}).promote,false);
assert.equal(M.promotionDecision({currentCents:3000,nextCents:3050,independentEvidenceFamilies:1,holdoutPassed:true,economicsPassed:true,routerPassed:true}).promote,false);
console.log('market-reference monitoring contract tests passed');
