const assert=require('node:assert/strict');
const {pointFromWaitlist,coarseAreaFor}=require('./waitlistgeo');
for(const x of [{},{lat:null,lng:null},{lat:'',lng:''},{lat:'not-a-number',lng:1},
 {lat:91,lng:0},{lat:40,lng:181}])assert.equal(pointFromWaitlist(x),null);
assert.deepEqual(pointFromWaitlist({lat:0,lng:0}),{lat:0,lng:0});
assert.equal(coarseAreaFor(null),null);
const actual=pointFromWaitlist({lat:25.770123,lng:-80.192456});
assert.equal(coarseAreaFor(actual),'25.5,-80.5');
assert.ok(!coarseAreaFor(actual).includes('770123'));
assert.equal(coarseAreaFor(pointFromWaitlist({lat:40.76,lng:-73.98})),'40.5,-74');
console.log('PASS unlocated interest does not fabricate 0,0 and out-of-county interest stores only a half-degree cell');
