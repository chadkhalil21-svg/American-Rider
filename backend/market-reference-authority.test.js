const assert=require('node:assert/strict');
const {qualification}=require('./market-reference-authority');
const plan={minimumIndependentFamilies:2};
assert.equal(qualification(null,plan).ok,false);
assert.equal(qualification({evidenceFamilies:['government-trips'],latestObservedAt:'2026-09-01T00:00:00Z',cells:{}},plan).ok,false);
assert.equal(qualification({evidenceFamilies:['government-trips','independent-audit'],latestObservedAt:'2026-09-01T00:00:00Z',cells:{}},plan).ok,true);
assert.equal(qualification({evidenceFamilies:['government-trips','independent-audit'],cells:{}},plan).ok,false);
console.log('market-reference runtime authority tests passed');
