'use strict';
const assert=require('node:assert/strict');
const {forecast,sustained}=require('./capacity-forecast');
const populations=[10000,100000,1000000];
for(let pass=0;pass<2;pass++){
 const seen=[];
 for(const users of populations){
  const p=forecast({registeredUsers:users,dailyTravelRate:0.02,
   activeMinutes:25,peakMultiplier:6,assignmentCandidatesPerTravel:3});
  assert.equal(p.dailyTravels,users*0.02);
  assert.equal(p.monitorDocumentReadsLowerBound,p.dailyTravels*25);
  assert.equal(p.estimatedPeakConcurrent,Math.ceil(p.averageConcurrent*6));
  assert.equal(p.firestoreIndexReadsIncluded,false);
  assert.equal(p.launchCapacityVerified,false);
  assert.equal(p.benchmarkedLatencyP99Ms,null);
  assert.ok(p.monitorReadPagesAtPeak>=1);
  seen.push(p);
 }
 assert.ok(seen[0].estimatedPeakConcurrent<seen[1].estimatedPeakConcurrent);
 assert.ok(seen[1].estimatedPeakConcurrent<seen[2].estimatedPeakConcurrent);
 const running=seen[2];
 assert.ok(running.monitorDocumentReadsLowerBound>1000000-1,
  '40k Travels/day at 25 minutes each produce 1m minimum monitor reads');
}
for(const peak of [0,1,200,201,900,10000,100000]){
 const m=sustained(peak);
 assert.equal(m.monitorDocumentReadsPerDay,peak*1440);
 assert.equal(m.pageRequestsPerSweep,Math.floor(peak/200)+1);
 assert.equal(m.provenFirestoreCapacity,false);
}
assert.equal(sustained(1000).monitorDocumentReadsPerDay,1440000);
assert.equal(sustained(10000).monitorDocumentReadsPerDay,14400000);
for(const invalid of [-1,NaN,Infinity,1.5,'1000']){
 assert.throws(()=>sustained(invalid));
}
assert.throws(()=>forecast({registeredUsers:1000,dailyTravelRate:1.1}));
assert.throws(()=>forecast({registeredUsers:1000,activeMinutes:0}));
assert.throws(()=>forecast({registeredUsers:1000,peakMultiplier:101}));
console.log('PASS twice: 10k/100k/1m registered-user planning; 100k sustained-active case; no real load, billed cost or p99 claim.');
