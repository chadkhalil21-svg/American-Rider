const assert=require('node:assert/strict');
const {PUBLIC_MARKET_SOURCES,publicSourceFor}=require('./public-market-sources');
assert.equal(publicSourceFor('il-chicago').cost,'free');
assert.equal(publicSourceFor('il-chicago').passengerChargeEvidence,true);
assert.equal(publicSourceFor('ma-statewide').passengerChargeEvidence,false);
assert.ok(String(publicSourceFor('ny-nyc').publication).includes('monthly'));
assert.equal(publicSourceFor('fl-southeast'),null);
assert.ok(Object.isFrozen(PUBLIC_MARKET_SOURCES));
console.log('public market source catalog tests passed');
