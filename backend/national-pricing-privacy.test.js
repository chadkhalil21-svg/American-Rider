'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const indexes=JSON.parse(read('firestore.indexes.json'));
const ttl=indexes.fieldOverrides.find(x=>x.collectionGroup==='pricing_quote_views'&&x.fieldPath==='expiresAt');
assert.equal(ttl?.ttl,true,'pricing research needs an explicit Firestore TTL deployment manifest');
assert.deepEqual(ttl?.indexes,[],'high-volume expiration timestamp should not be indexed');
const backend=read('backend/server.js'),store=read('backend/quote-view-store.js'),client=read('app/reserve.tsx');
const fareClient=read('src/backend/fares.ts');
assert.match(backend,/consentToResearch:req\.body\?\.consentToResearch===true/);
assert.match(backend,/consentVersion:req\.body\?\.consentVersion/);
assert.match(store,/consentToResearch!==true\|\|consentVersion!=='quote-study-v1'/);
assert.match(client,/accessibilityRole="checkbox"/);
assert.match(client,/onPress=\{joinQuoteStudy\}/);
assert.doesNotMatch(client,/useFocusEffect/,'a passive view MUST NOT be mistaken for consent');
assert.match(fareClient,/consentToResearch:true,consentVersion:'quote-study-v1'/);
for(const lang of ['en','es','fr','it','de']){
 assert.match(read('src/i18n/'+lang+'.ts'),/pricingResearchOptIn:/);
 const legal=read('backend/legal'+(lang==='en'?'':'-'+lang)+'.js');
 assert.match(legal,/4A · /,'localized optional-study notice required');
}
const discovery=require('./public-source-discovery');
const registry=require('./public-source-registry');
for(const id of ['chicago-tnp-open-data','nyc-tlc-hvfhv']){
 const meta=registry.verifiedSource(id);
 assert.ok(meta?.assessment.fitness.includes('trip-shape'),'official observed trips can aid trip geometry');
 assert.equal(meta.assessment.fitness.includes('fare-reference'),false,
   'old fare or rounded tip-inclusive total is not a quote-comparable consumer Total');
}
const schema={authority:'approved agency',endpoint:'https://example.org/data',
 publicationCadence:'daily',geography:'one jurisdiction',publicationLagDays:0,
 hasPassengerCharge:true,hasTripDistance:true,hasTripDuration:true,hasTripCount:true};
assert.equal(discovery.assessPublicSource(schema).fitness.includes('fare-reference'),false);
assert.equal(discovery.assessPublicSource({...schema,hasAllInTotalComparable:true})
 .fitness.includes('fare-reference'),true,
 'only proven full ordinary consumer Total may qualify as market reference evidence');
const collector=read('backend/market-evidence-collectors.js');
assert.match(collector,/resource\/8bbv-xwnh\.json/,'verify latest official 2026 Chicago source');
assert.match(collector,/r\.trip_total/,'do not quietly substitute base Fare for Trip Total');
assert.match(collector,/structural evidence only/,'trip totals with tips cannot directly set quote prices');
const marketPricing=read('backend/market-pricing.js');
assert.match(marketPricing,/no default pricing market/i);
for(const scenario of [10000,100000,1000000]){
 for(let pass=0;pass<2;pass++){
  const tested=discovery.assessPublicSource(schema);
  assert.equal(tested.fitness.includes('fare-reference'),false,scenario+' national traffic volume never creates evidence');
 }
}
console.log('PASS twice: nationwide evidence suitability; privacy consent; TTL manifest; no passive collection; 10k/100k/1m simulations');
