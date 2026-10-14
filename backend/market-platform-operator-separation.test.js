'use strict';
const assert=require('node:assert/strict');
const {markets}=require('./markets');
const {regionById}=require('./regions');
const M=require('./market-readiness');

const ids=['fl-miami-dade','fl-broward','fl-palm-beach'];
const entries=ids.map(id=>{
  const market=markets().find(m=>m.id===id);
  return {market,region:regionById(market.regionId)};
});
const versions=Object.fromEntries(entries.map(({market,region})=>[
  market.id,M.manifestFor(market,region).version
]));
const now=1800000000000;
const allowedCollections=new Set(['market_admission','audit_log']);
function proof(id,domain){
  return {reference:'independent-'+id+'-'+domain,issuer:'Independent verified issuer',
    verifiedBy:'named_mfa_reviewer',reviewedAt:now-1000,validUntil:now+86400000,
    manifestVersion:versions[id]};
}
function dbWithPlatformEvidence(missingDomain=null){
  const records=new Map();
  let auditId=0, operatorCollectionReads=0;
  for(const id of ids){
    const evidence=Object.fromEntries(M.REQUIRED_EVIDENCE.map(domain=>[
      domain,proof(id,domain)
    ]));
    if(missingDomain)delete evidence[missingDomain];
    records.set('market_admission/'+id,{status:'waitlist',
      manifestVersion:versions[id],evidence});
  }
  return {
    records,
    get operatorCollectionReads(){return operatorCollectionReads;},
    collection(name){
      if(!allowedCollections.has(name)){
        operatorCollectionReads++;
        throw new Error('Regional admission attempted an individual Operator read: '+name);
      }
      return {doc(id){
        const key=name+'/'+(id||'audit-'+(++auditId));
        return {key,async get(){return {
          exists:records.has(key),data:()=>records.get(key)
        };}};
      }};
    },
    async runTransaction(fn){
      const writes=[];
      const tx={
        get:ref=>ref.get(),
        set:(ref,obj,opts)=>writes.push([ref,obj,opts]),
        create:(ref,obj)=>writes.push([ref,obj,null]),
      };
      const outcome=await fn(tx);
      for(const [ref,obj,opts] of writes){
        const prior=opts?.merge?records.get(ref.key)||{}:{};
        records.set(ref.key,{...prior,...obj});
      }
      return outcome;
    },
  };
}
async function attempt(db,providerMissing=[]){
  return M.activateRegion({db,entries,actor:'github:chadkhalil21-svg',
    auditMethod:'founder_gitops_release',
    founderCommandId:'founder-open-fl-southeast-20261013',
    intentRequestedAt:now-1000,expectedVersions:versions,providerMissing,now});
}
(async()=>{
 for(let pass=1;pass<=2;pass++){
  const ready=dbWithPlatformEvidence();
  const open=await attempt(ready);
  assert.equal(open.code,'region_activated',
    'valid regional platform proof can activate without any individual Operator rows');
  assert.deepEqual(open.newlyOpened,ids);
  assert.equal(ready.operatorCollectionReads,0);
  for(const entry of entries){
    const state=M.readinessFor({market:entry.market,region:entry.region,
      record:ready.records.get('market_admission/'+entry.market.id),now});
    assert.equal(state.status,'active');
    assert.equal(state.readinessScope.level,'regional_platform');
    assert.equal(state.readinessScope.individualOperatorRowsRequired,false);
    assert.equal(state.readinessScope.operatorEligibilityCheckedAtRuntime,true);
    assert.equal(state.readinessScope.configuredMarket,true);
    assert.equal(state.readinessScope.platformEvidenceComplete,true);
  }
  const missing=dbWithPlatformEvidence('company_insurance_bound');
  const denied=await attempt(missing);
  assert.equal(denied.code,'region_not_ready');
  assert.ok(denied.missing.some(x=>x.id==='company_insurance_bound'));
  assert.equal(missing.operatorCollectionReads,0);
  const provider=dbWithPlatformEvidence();
  assert.equal((await attempt(provider,['screening_provider'])).code,'region_not_ready',
    'actual screening integration cannot be replaced by an Operator eligibility timer');
  assert.equal(provider.operatorCollectionReads,0);
 }
 console.log('PASS twice: platform-only region check, no Operator row reads, hard external/provider gates');
})().catch(e=>{console.error(e);process.exitCode=1;});
