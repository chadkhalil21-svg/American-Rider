const assert=require('node:assert/strict');
const E=require('./market-evidence');
const A=require('./market-admission');
const R=require('./regions');

assert.deepEqual(E.planProblems('fl-southeast'),[]);
assert.ok(E.source('chicago-tnp-open-data').primaryEligible);
assert.ok(E.source('nyc-tlc-hvfhv').primaryEligible);
assert.equal(E.source('american-rider-field-panel').primaryEligible,false);
assert.deepEqual(E.planProblems('tx-austin'),['tx-austin: no market evidence plan']);
assert.equal(A.regionReady(R.regionById('fl-southeast')),true);

console.log('national market evidence registry tests passed');
