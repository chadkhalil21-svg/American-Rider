'use strict';
const assert=require('node:assert/strict');
const {issue,verify,routeTag}=require('./quote-view-contract');
const {record,link,report,C,SAMPLE}=require('./quote-view-store');
const now=Date.UTC(2026,9,13,18),uid='synthetic-uid',
 env={PRICE_VIEWS_PILOT:'1',PRICE_VIEWS_PRIVACY_OK:'1',PRICE_VIEWS_TTL_READY:'1',
 PRICE_VIEWS_KEY:'synthetic-separate-key-32-chars-minimum'};
const fingerprint=routeTag({uid,env,pickup:{lat:25.7,lng:-80.2},dest:{lat:25.8,lng:-80.1}});
const token=issue({uid,now,env,id:'a'.repeat(32),marketId:'fl-miami-dade',
 distanceBand:'3-7',totalCents:1450,routeFingerprint:fingerprint});
(async()=>{
 const items=new Map();let creates=0,reads=0;
 const db={collection:n=>{assert.equal(n,C);return {doc:id=>({
  create:async o=>{if(items.has(id)){const e=Error('already exists');e.code=6;throw e;}
   items.set(id,o);creates++;}
 }),where:()=>({orderBy:()=>({limit:cap=>({get:async()=>{reads++;return{
  docs:[...items.values()].slice(0,cap).map(d=>({data:()=>d}))};}})})})};}};
 assert.equal((await record({db,token,uid,now,env})).ok,true);
 assert.equal((await record({db,token,uid,now,env})).duplicate,true);
 assert.equal(creates,1);
 assert.equal((await record({db,token,uid:'attacker',now,env})).ok,false);
 const view=verify(token,{uid,now,env}),ride='b'.repeat(40);
 const txDB={collection:()=>({doc:id=>({id})})};
 const tx={updates:[],get:async ref=>({exists:items.has(ref.id),
  data:()=>items.get(ref.id)}),update:(ref,changes)=>tx.updates.push(changes)};
 assert.equal(await link({tx,db:txDB,view,rideId:ride,now:now+10}),true);
 assert.equal(tx.updates.length,1);
 Object.assign(items.get(view.id),tx.updates[0]);
 assert.equal(await link({tx,db:txDB,view,rideId:ride,now:now+20}),true);
 assert.equal(tx.updates.length,1);
 assert.equal(await link({tx,db:txDB,view,rideId:'c'.repeat(40),now:now+20}),false);
 const info=await report({db,now:now+61*60000,env});
 assert.equal(info.counted,1);assert.equal(info.prepared,1);
 assert.equal(info.priceChangeAuthorized,false);assert.equal(info.paidConversion,false);
 assert.equal(reads,1);assert.equal(SAMPLE,120);
 assert.equal((await report({env:{}})).enabled,false);
 console.log('PASS: one write per distinct view, no double count, protected booking, bounded founder report');
})().catch(e=>{console.error(e);process.exitCode=1;});
