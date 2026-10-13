// Two-pass synthetic client idempotency regression (no network, real users, or funds).
import assert from 'node:assert/strict';
import {prepareResearchAttempt} from '../src/backend/voluntaryAttempt.ts';
const a={marketId:'fl-miami-dade',sourceKind:'my-receipt',providerCode:'other',
  routedMiles:6.3,routedMinutes:19,travelerTotalCents:1550,ageHours:2,
  serviceClass:'standard',ordinaryNoPromotion:true,consentToResearch:true};
const start=Date.parse('2026-10-13T17:00:00Z');
const first=prepareResearchAttempt(a,null,start,'research-observation-111');
assert.equal(first.body.observedAt,'2026-10-13T15:00:00.000Z');
assert.strictEqual(prepareResearchAttempt({...a},first,start+3600000,'research-observation-222'),first);
const edited=prepareResearchAttempt({...a,travelerTotalCents:1800},first,start+3600000,'research-observation-333');
assert.notEqual(edited.body.observationId,first.body.observationId);
assert.throws(()=>prepareResearchAttempt({...a,ageHours:336},null,start,'research-observation-444'),/clock/);
for(let pass=0;pass<2;pass++)for(let i=0;i<10000;i++){
 const draft={...a,marketId:i%2?'fl-broward':'fl-miami-dade',
   routedMiles:1+i%80,travelerTotalCents:1000+i};
 const initial=prepareResearchAttempt(draft,null,start,'research-original-'+String(i).padStart(6,'0'));
 assert.strictEqual(prepareResearchAttempt({...draft},initial,start+2500,
   'research-retry-'+String(i).padStart(6,'0')),initial);
 const modified=prepareResearchAttempt({...draft,travelerTotalCents:1001+i},
   initial,start+3000,'research-edited-'+String(i).padStart(6,'0'));
 assert.notEqual(modified.body.observationId,initial.body.observationId);
}
console.log('PASS: 20,000 synthetic retry/edit scenarios; no HTTP requests or funds');
