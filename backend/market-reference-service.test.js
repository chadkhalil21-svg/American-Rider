const assert=require('node:assert/strict');
const S=require('./market-reference-service');
const E=require('./market-evidence');
assert.equal(S.median([30,10,20]),20);
assert.equal(S.median([10,20]),15);
assert.equal(S.cellKey({serviceClass:'standard',daypart:'evening',weekdayWeekend:'weekday',calendarClass:'ordinary',regulatedLocationClass:'ordinary'}),'standard|7-15|20-40|evening|weekday|ordinary|ordinary');
assert.deepEqual(E.planProblems('il-chicago'),[]);
assert.deepEqual(E.planProblems('ny-nyc'),[]);
console.log('live market-reference service tests passed');
