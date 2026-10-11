'use strict';
const assert=require('node:assert/strict');
const {summarizeBackgroundWork,createBackgroundReporter}=require('./workload-summary');
let t=10_000_000,events=[];
const reporter=createBackgroundReporter({intervalMs:60_000,now:()=>t,emit:(...args)=>events.push(args)});
const snapshot={
  scheduled:{ok:true,considered:0,dispatched:[{rideId:'secret-id',travelerName:'private'}]},
  monitor:{ok:false,activeTravelsRead:12,reason:'private exception data',emergencies:[{coordinates:'private'}]},
  screening:{ok:true,skipped:'cadence'},
  bookingRecovery:{ok:true,scanned:2,overCapacity:false,pending:['private-travel-id']},
};
assert.equal(reporter(snapshot),true);
assert.equal(reporter(snapshot),false);
t+=60_000;
assert.equal(reporter(snapshot),true);
assert.equal(events.length,2);
const summaries=events.map(e=>e.join(' '));
for(const row of summaries){
 assert.ok(row.includes('"activeTravelsRead":12'));
 for(const secret of ['secret-id','travelerName','coordinates','private exception','private-travel-id'])
  assert.ok(!row.includes(secret),'No personal details in operations telemetry');
}
const report=summarizeBackgroundWork(snapshot);
assert.equal(report.bookingRecovery.scanned,2);
assert.equal(report.screening.skipped,'cadence');
assert.equal(report.monitor.failed,true);
assert.deepEqual(Object.keys(report).sort(),Object.keys(snapshot).sort());
assert.throws(()=>createBackgroundReporter({intervalMs:0}),/Invalid telemetry interval/);
console.log('PASS national low-overhead worker telemetry: aggregate, bounded, privacy-safe');