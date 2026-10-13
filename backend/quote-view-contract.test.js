'use strict';
const assert=require('node:assert/strict');
const q=require('./quote-view-contract');
const env={PRICE_VIEWS_PILOT:'1',PRICE_VIEWS_PRIVACY_OK:'1',
 PRICE_VIEWS_TTL_READY:'1',PRICE_VIEWS_KEY:'separate-private-pilot-key-minimum-32-characters'};
const pickup={lat:25.7,lng:-80.2},dest={lat:25.8,lng:-80.1};
const fingerprint=q.routeTag({uid:'fake-user-1',pickup,dest,env});
const args={routeFingerprint:fingerprint,uid:'fake-user-1',marketId:'fl-miami-dade',distanceBand:'3-7',
 totalCents:1440,now:Date.UTC(2026,9,13,18),env,id:'0'.repeat(32)};
assert.equal(q.enabled({}),false);
for(const x of ['PRICE_VIEWS_PILOT','PRICE_VIEWS_PRIVACY_OK','PRICE_VIEWS_TTL_READY','PRICE_VIEWS_KEY']){
 const altered={...env};delete altered[x];assert.equal(q.enabled(altered),false);
}
const token=q.issue(args);
assert.ok(token);
assert.deepEqual(q.verify(token,{uid:args.uid,now:args.now,env}),{
 id:'0'.repeat(32),marketId:args.marketId,distanceBand:'3-7',
 totalCents:1440,routeFingerprint:fingerprint,issuedAt:args.now});
assert.equal(q.verify(token,{uid:'other-user',now:args.now,env}),null);
assert.equal(q.verify(token,{uid:args.uid,now:args.now+31*60000,env}),null);
assert.equal(q.verify(token+'x',{uid:args.uid,now:args.now,env}),null);
assert.equal(q.issue({...args,env:{}}),null);
assert.equal(q.matchesBooking(q.verify(token,{uid:args.uid,now:args.now,env}),
 {marketId:'fl-miami-dade',distanceBand:'3-7',totalCents:1450,routeFingerprint:fingerprint}),false);
for(let pass=0;pass<2;pass++)for(let i=0;i<10000;i++){
 const token=q.issue({...args,totalCents:1000+i%400,id:i.toString(16).padStart(32,'0')});
 const original=q.verify(token,{uid:args.uid,now:args.now,env});
 assert.ok(original);
 assert.equal(q.matchesBooking(original,{marketId:args.marketId,
  distanceBand:args.distanceBand,totalCents:original.totalCents,routeFingerprint:fingerprint}),true);
 assert.equal(q.matchesBooking(original,{marketId:'fl-broward',
  distanceBand:args.distanceBand,totalCents:original.totalCents,routeFingerprint:fingerprint}),false);
}
assert.notEqual(fingerprint,q.routeTag({uid:'fake-user-1',pickup,
 dest:{lat:25.81,lng:-80.1},env}));
assert.equal(q.matchesBooking(q.verify(token,{uid:args.uid,now:args.now,env}),
 {marketId:args.marketId,distanceBand:args.distanceBand,totalCents:1440,
 routeFingerprint:q.routeTag({uid:args.uid,pickup,dest:{lat:25.81,lng:-80.1},env})}),false);
console.log('PASS: 20k two-pass synthetic quote evidence signatures, privacy-gated and non-price-authoritative');
