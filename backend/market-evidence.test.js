const assert=require('node:assert/strict');
const E=require('./market-evidence');
const A=require('./market-admission');
const R=require('./regions');

assert.deepEqual(E.planProblems('fl-southeast'),[]);
assert.equal(E.planForRegion('fl-southeast').admissionOnly,true);
for(const id of ['fl-miami-dade','fl-broward','fl-palm-beach']){
  assert.deepEqual(E.planProblems(id),[]);
  assert.equal(E.planForRegion(id).regionId,'fl-southeast');
}
assert.ok(E.source('chicago-tnp-open-data').primaryEligible);
assert.equal(E.source('nyc-tlc-hvfhv').primaryEligible,false);\nassert.equal(E.source('california-cpuc-tnc-public').primaryEligible,false);
assert.equal(E.source('american-rider-field-panel').primaryEligible,false);
assert.deepEqual(E.planProblems('tx-austin'),['tx-austin: no market evidence plan']);
assert.equal(A.regionReady(R.regionById('fl-southeast')),true);

console.log('national market evidence registry tests passed');

const panel=E.source('controlled-public-price-panel');
assert.match(panel.caveat,/Human-controlled audit evidence/);
assert.match(panel.caveat,/No automated access/);
