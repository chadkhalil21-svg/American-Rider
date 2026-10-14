'use strict';
// SYNTHETIC CI HARNESS ONLY. Never writes to a real Firebase project, Render or a provider.
// Uses the actual market-readiness and registered founder-command implementation.
const assert = require('node:assert/strict');
if (process.env.AR_SYNTHETIC_STAGING !== 'isolated_ci_only' ||
    process.env.DEPLOYMENT_MODE === 'production' ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  throw new Error('Refusing synthetic fixture outside isolated nonproduction CI');
}
const { markets } = require('../backend/markets');
const { REGIONS, regionById } = require('../backend/regions');
const { REQUIRED_EVIDENCE, manifestFor, inspectMarket } = require('../backend/market-readiness');
const { sweepFounderMarketIntents } = require('../backend/founder-market-intents');
const { screeningReady } = require('../backend/screening');
const declaration = require('../backend/founder-platform-declarations.json');
const intent = require('../backend/founder-market-intents.json');
const now = Date.parse('2026-10-14T14:00:00.000Z');
const ids = ['fl-miami-dade','fl-broward','fl-palm-beach'];
const marketRows = ids.map(id => {
  const market = markets().find(m => m.id === id);
  assert.ok(market);
  const region = regionById(market.regionId);
  assert.equal(region.id,'fl-southeast');
  assert.deepEqual(manifestFor(market,region).sourceProblems,[]);
  return {market,region};
});
assert.equal(intent.commands[0].id,'founder-open-fl-southeast-20261013');
assert.deepEqual(declaration.domains, [
  'company_insurance_bound','disclosure_and_retention','pricing_and_taxes',
  'routing_and_toll_rights','payment_and_reconciliation','provider_contracts',
  'safety_coverage','accessible_service','qualified_operator_supply',
  'backup_restore_drill','device_and_release_tests'
]);
const codeVerified = new Set(['jurisdiction_authority','operator_insurance_process','screening_agreement']);
assert.deepEqual(REQUIRED_EVIDENCE.filter(x => !codeVerified.has(x)),declaration.domains);
function makeInMemoryDb() {
  const documents = new Map();
  let seq=0,writes=0;
  const db = {
    documents,
    get writes(){return writes;},
    collection(name) {
      assert.ok(['market_admission','audit_log'].includes(name),'No live collection permitted');
      return {doc(id){
        const key=name+'/'+(id||'simulated-audit-'+(++seq));
        return {key,async get(){
          return {exists:documents.has(key),data:()=>documents.get(key)};
        }};
      }};
    },
    async runTransaction(fn) {
      const pending=[]; let started=false;
      const tx={
        get(ref) {assert.equal(started,false,'Firestore reads before writes');return ref.get();},
        set(ref,doc,opts={}) {started=true;pending.push({ref,doc,merge:!!opts.merge});},
        create(ref,doc) {started=true;assert.equal(documents.has(ref.key),false);pending.push({ref,doc,merge:false});}
      };
      const result=await fn(tx);
      for(const item of pending){
        const before=item.merge?documents.get(item.ref.key)||{}:{};
        documents.set(item.ref.key,{...before,...item.doc});
        writes++;
      }
      return result;
    }
  };
  return db;
}
function seedSyntheticEvidence(db) {
  for (const {market,region} of marketRows) {
    const manifest=manifestFor(market,region);
    const evidence=Object.fromEntries(declaration.domains.map(domain=>[domain,{
      reference:'SYNTHETIC_TEST_ONLY:'+domain+':'+market.id,
      issuer:'SYNTHETIC_TEST_ONLY_NOT_A_REAL_PROVIDER',
      verifiedBy:'isolated_staging_fixture',
      reviewedAt:now-60000,
      validUntil:now+86400000,
      manifestVersion:manifest.version,
      syntheticFixture:true
    }]));
    db.documents.set('market_admission/'+market.id,{
      status:'waitlist',manifestVersion:manifest.version,evidence
    });
  }
}
async function command(db){
  return sweepFounderMarketIntents({
    // The production flag here exercises the production ACTIVATE FUNCTION only.
    // It does not refer to a real production environment or production database.
    db, markets:markets(), regions:REGIONS, production:true,
    providerMissing:screeningReady()?[]:['screening_provider'],
    now, onOpened:()=>{}
  });
}
(async()=>{
  for(let pass=1;pass<=2;pass++){
    const db=makeInMemoryDb();
    process.env.SCREENING_EVIDENCE_WORKFLOW_VERIFIED='false';
    assert.equal(screeningReady(),false);
    const blocked=await command(db);
    assert.equal(blocked.results[0].code,'region_not_ready');
    assert.ok(blocked.results[0].missing.includes('provider:screening_provider'));
    assert.ok(declaration.domains.every(x=>blocked.results[0].missing.includes(x)));
    assert.equal(db.writes,0);

    seedSyntheticEvidence(db);
    process.env.SCREENING_EVIDENCE_WORKFLOW_VERIFIED='true';
    assert.equal(screeningReady(),true);
    const activated=await command(db);
    assert.equal(activated.ok,true);
    assert.equal(activated.results[0].code,'region_activated');
    assert.deepEqual(activated.results[0].newlyOpened,ids);
    for(const {market,region} of marketRows){
      const status=await inspectMarket({db,market,region,providerMissing:[],now});
      assert.equal(status.status,'active');
      assert.equal(status.readyToActivate,true);
    }
    const priorWrites=db.writes;
    const repeated=await command(db);
    assert.equal(repeated.results[0].code,'already_active');
    assert.equal(db.writes,priorWrites,'Repeat must be idempotent');
    assert.equal([...db.documents.values()].filter(x=>x.action==='market_activated').length,3);

    // Rejection still works even with an approved founder policy declaration.
    const incomplete=makeInMemoryDb();
    seedSyntheticEvidence(incomplete);
    delete incomplete.documents.get('market_admission/fl-broward').evidence.company_insurance_bound;
    const rejected=await command(incomplete);
    assert.equal(rejected.results[0].code,'region_not_ready');
    assert.ok(rejected.results[0].missing.includes('company_insurance_bound'));
    assert.equal(incomplete.writes,0);

    console.log('SYNTHETIC STAGING PASS '+pass+' (not Render production)');
    console.log(JSON.stringify({
      environment:'isolated_ci_synthetic',command:intent.commands[0].id,
      response:activated.results[0].code,
      counties:ids.map(marketId=>({marketId,status:'OPEN / ACTIVE (SYNTHETIC STAGING ONLY)'})),
      independentProof:'SIMULATED_NOT_REAL',
      realTravelPermitted:false,
      productionTouched:false
    }));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
