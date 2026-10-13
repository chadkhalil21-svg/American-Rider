'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {persistObservations}=require('./market-reference-service');
const {normalizeObservation}=require('./market-evidence-ingest');
const OBS='market_reference_observations';
function database(){
 const storage=new Map(),stats={created:0,gets:0};
 return {storage,stats,collection(name){
  assert.equal(name,OBS);return {doc(id){return{
    async create(o){if(storage.has(id)){const e=Error('already exists');e.code=6;throw e;}
      stats.created++;storage.set(id,structuredClone(o));},
    async get(){stats.gets++;return{exists:storage.has(id),data:()=>structuredClone(storage.get(id))};}
  }}};
 }};
}
const base={marketId:'fl-miami-dade',sourceId:'controlled-public-price-panel',
 sourceType:'field-panel',observedAt:'2026-10-12T20:00:00Z',
 serviceClass:'standard',routedMiles:6.3,routedMinutes:17,
 travelerTotalCents:1496,providerKey:'provider-A',
 sourceObservationId:'obs-20261012-001',daypart:'evening',
 weekdayWeekend:'weekday',calendarClass:'ordinary',
 regulatedLocationClass:'ordinary',provenance:'authorized offline price research'};
(async()=>{
 for(let pass=1;pass<=2;pass++){
  const db=database();
  const other={...base,providerKey:'provider-B'};
  assert.equal(await persistObservations(db,[base,other]),2,
    'same amount/time/route from separate suppliers are separate evidence');
  assert.equal(db.stats.created,2);
  assert.equal(db.stats.gets,0,'new observations require no extra read');
  assert.equal(await persistObservations(db,[other,base]),0);
  assert.equal(db.stats.gets,2,'only existing stable IDs read once');
  assert.equal(db.stats.created,2);
  await assert.rejects(persistObservations(db,[{...base,travelerTotalCents:1800}]),/conflicting/);
  assert.equal(db.stats.created,2,'corrected price with same ID does not inflate sample');
  await assert.rejects(persistObservations(db,[{...base,sourceObservationId:null}]),/identity|missing|invalid anonymous/);
  assert.equal(db.stats.created,2);
  const again=normalizeObservation(base);
  assert.equal(again.sourceObservationId,base.sourceObservationId);
  const legacy={...base,marketId:'il-chicago',sourceId:'chicago-tnp-open-data',sourceType:'government-trips',
   sourceObservationId:null};
  const historicHash=crypto.createHash('sha256').update([
   legacy.marketId,legacy.sourceId,legacy.observedAt,legacy.routedMiles,
   legacy.routedMinutes,legacy.travelerTotalCents].join('|')).digest('hex');
  await persistObservations(db,[legacy]);
  assert.equal(db.storage.has(historicHash),true,'public published historical hash format unchanged');
  console.log('PASS stable field-panel IDs pass '+pass+': 2 independent sources, changed amount conflict, no first-read cost, legacy hashes intact');
 }
})().catch(e=>{console.error(e);process.exitCode=1});
