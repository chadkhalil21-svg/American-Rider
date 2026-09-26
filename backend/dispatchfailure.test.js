const assert=require('node:assert/strict');
const {matchOperator,presenceStale,PRESENCE_STALE_MS}=require('./matching');
const {DISCLOSURE_VERSION}=require('./disclosure');
const now=2_000_000_000_000;
const base={id:'op',lat:25.6,lng:-80.3,available:true,onlineAt:now-90_000,insuranceExpiry:'2099-12-31',screeningBlocked:false,screeningCheckedAt:now-1000,disclosureVersion:DISCLOSURE_VERSION,commissioned:true,documentBlocked:false,classes:['Standard']};

assert.equal(presenceStale({...base,onlineAt:now-PRESENCE_STALE_MS},now),false,'presence at cutoff remains current');
assert.equal(presenceStale({...base,onlineAt:now-PRESENCE_STALE_MS-1},now),true,'one millisecond past cutoff fails closed');
assert.equal(presenceStale({...base,onlineAt:now+60_000},now),false,'small future timestamp is not stale by itself');
assert.equal(presenceStale({...base,onlineAt:null},now),true,'missing GPS/presence timestamp is stale');

assert.ok(matchOperator([base],{lat:25.61,lng:-80.31},'Standard',{requireScreening:true,now}),'current qualified operator can match');
assert.equal(matchOperator([{...base,onlineAt:now-PRESENCE_STALE_MS-1}],{lat:25.61,lng:-80.31},'Standard',{requireScreening:true,now}),null,'stale phone cannot dispatch');
assert.equal(matchOperator([{...base,available:false}],{lat:25.61,lng:-80.31},'Standard',{requireScreening:true,now}),null,'off-duty operator cannot dispatch');
assert.equal(matchOperator([{...base,commissioned:false}],{lat:25.61,lng:-80.31},'Standard',{requireScreening:true,now}),null,'lost qualification cannot dispatch');
assert.equal(matchOperator([{...base,screeningCheckedAt:null}],{lat:25.61,lng:-80.31},'Standard',{requireScreening:true,now}),null,'missing production screening cannot dispatch');

console.log('all stale-presence / dispatch fail-closed tests passed');
