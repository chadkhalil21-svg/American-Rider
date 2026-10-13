'use strict';
const assert=require('node:assert/strict');
const c=require('./quote-view-contract');
const p=require('./price-view-pilot');
const now=Date.UTC(2026,9,13,19),uid='synthetic-user';
const env={PRICE_VIEWS_PILOT:'1',PRICE_VIEWS_PRIVACY_OK:'1',
 PRICE_VIEWS_TTL_READY:'1',PRICE_VIEWS_KEY:'separate-private-price-study-secret-32-characters'};
const pickup={lat:25.76,lng:-80.24},dest={lat:25.78,lng:-80.26};
const routeFingerprint=c.routeTag({uid,pickup,dest,env});
const issue=(id='f'.repeat(32))=>c.issue({uid,marketId:'fl-miami-dade',
 distanceBand:'3-7',routeFingerprint,totalCents:1650,id,now,env});
const token=issue();
const records=new Map(),counts={creates:0,updates:0,gets:0,queries:0};
const docs=()=>({doc:id=>({id,create:async d=>{
 if(records.has(id)){const e=new Error('already exists');e.code=6;throw e;}
 records.set(id,{...d});counts.creates++;
}}),
 where:(field,op,date)=>{assert.equal(field,'viewedAt');return{
 orderBy:()=>({limit:max=>({get:async()=>{counts.queries++;return {
 docs:[...records].filter(([,d])=>d.viewedAt>=date)
  .sort((a,b)=>b[1].viewedAt-a[1].viewedAt).slice(0,max)
  .map(([id,d])=>({id,data:()=>d}))};}})})};}});
const db={collection:name=>{assert.equal(name,p.COLLECTION);return docs();},
 runTransaction:async fn=>fn({get:async ref=>{counts.gets++;
 const d=records.get(ref.id);return {exists:!!d,data:()=>d};},
 update:(ref,changes)=>{counts.updates++;Object.assign(records.get(ref.id),changes);}})};
const options={db,uid,token,now,env};
(async()=>{
 assert.equal((await p.recordView({...options,env:{}})).ok,false);
 assert.equal(counts.creates,0);
 assert.equal((await p.recordView(options)).duplicate,false);
 assert.equal((await p.recordView(options)).duplicate,true);
 assert.equal(counts.creates,1);
 assert.equal((await p.recordView({...options,uid:'attacker'})).ok,false);
 const booking={...options,pickup,dest,marketId:'fl-miami-dade',
  miles:5,totalCents:1650,rideId:'a'.repeat(40),now:now+60000};
 assert.equal(await p.markBooking({...booking,dest:{lat:25.9,lng:-80.26}}),false);
 assert.equal(await p.markBooking({...booking,totalCents:1651}),false);
 assert.equal(await p.markBooking({...booking,uid:'attacker'}),false);
 assert.equal(counts.gets,0);
 assert.equal(await p.markBooking(booking),true);
 assert.equal(counts.updates,1);
 assert.equal(await p.markBooking(booking),true);
 assert.equal(counts.updates,1);
 assert.equal(await p.markBooking({...booking,rideId:'b'.repeat(40)}),false);
 assert.equal(await p.markBooking({...booking,now:now+31*60000}),false);
 const report=await p.recentReport({db,now:now+61*60000,env});
 assert.equal(report.mature,1);assert.equal(report.prepared,1);
 assert.equal(report.markets[0].viewed,1);
 assert.equal(report.paidConversion,false);assert.equal(report.automaticPricing,false);
 assert.equal((await p.recentReport({db,env:{}})).enabled,false);
 assert.equal(counts.queries,1);
 for(let round=0;round<2;round++)for(let i=0;i<10000;i++){
  const t=issue(i.toString(16).padStart(32,'0'));
  assert.ok(c.verify(t,{uid,env,now}));
  assert.equal(c.verify(t,{uid:'attacker',env,now}),null);
  assert.equal(c.matchesBooking(c.verify(t,{uid,env,now}),{
   marketId:'fl-broward',distanceBand:'3-7',
   totalCents:1650,routeFingerprint}),false);
 }
 assert.equal(counts.creates,1,'synthetic stress must not touch data');
 console.log('PASS: 20,000 synthetic attestations, safe replay, route edits, other account, expiration, no money');
})().catch(e=>{console.error(e);process.exitCode=1;});
