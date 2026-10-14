'use strict';
const assert=require('node:assert/strict');
const {DOMAINS,IDS,SERVER,inspectEvidence,send,parseArgs}=require('../scripts/ingest-market-admission.cjs');
const approved=require('./founder-platform-declarations.json');
const now=Date.parse('2026-10-14T15:00:00.000Z');
const iso=n=>new Date(n).toISOString();
function base(domain,marketIds=[IDS[0]]) {
  return {
    kind:'market_evidence',regionId:'fl-southeast',marketIds,
    ...(marketIds.length===3?{allCountiesVerified:true}:{}),
    domain,reference:'real_reviewed_claim_123456789',
    issuer:'Acme Underwriters and Suppliers',
    validUntil:now+2*86400000,
    independentReview:{sourceChecked:true,reviewer:'Ops Reviewer',reviewedAt:iso(now-1000),
      evidenceLocation:'protected-compliance-evidence-asset-123'},
    ...(domain==='company_insurance_bound'?{policy:{
      carrier:'Acme Insurance',binderReference:'carrier_binder_000987',
      namedInsured:'American Rider',territory:['FL'],
      effectiveAt:iso(now-10000),expiresAt:iso(now+3*86400000),
      tncContingentResponseVerified:true
    }}:{})
  };
}
function reject(input,reason){
  assert.throws(()=>inspectEvidence(input,now),reason);
}
(async()=>{
  assert.deepEqual([...DOMAINS].sort(),[...approved.domains].sort());
  assert.equal(DOMAINS.size,11);
  assert.deepEqual(parseArgs(['--input','-']),{inputFile:'-',submit:false});
  assert.deepEqual(parseArgs(['--input','test.json','--submit']),{inputFile:'test.json',submit:true});
  for(let pass=1;pass<=2;pass++){
    for(const domain of DOMAINS) {
      const x=inspectEvidence(base(domain),now);
      assert.equal(x.domain,domain);
      assert.equal(x.shared,false);
      assert.deepEqual(x.marketIds,[IDS[0]]);
      assert.deepEqual(Object.keys(x.body).sort(),['domain','issuer','reference','validUntil']);
    }
    const all=inspectEvidence(base('company_insurance_bound',IDS),now);
    assert.equal(all.shared,true);
    assert.deepEqual(all.marketIds,IDS);
    assert.equal(all.body.allCountiesVerified,true);
    reject({...base('company_insurance_bound',IDS),allCountiesVerified:false},/coverage/i);
    reject({...base('pricing_and_taxes',[IDS[0],IDS[1]])},/all three/i);
    reject({...base('pricing_and_taxes'),reference:'SYNTHETIC'},/real/i);
    reject({...base('pricing_and_taxes'),validUntil:now-1},/future/i);
    reject({...base('pricing_and_taxes'),independentReview:{...base('pricing_and_taxes').independentReview,sourceChecked:false}},/review/i);
    reject({...base('company_insurance_bound'),policy:{...base('company_insurance_bound').policy,tncContingentResponseVerified:false}},/confirmation/i);
    reject({...base('company_insurance_bound'),policy:{...base('company_insurance_bound').policy,expiresAt:iso(now-1)}},/Binder dates/i);
    reject({...base('routing_and_toll_rights'),password:'do-not-save'},/credential/i);
    const screening=inspectEvidence({
      kind:'screening_handoff',regionId:'fl-southeast',provenanceVerified:true,
      signedDeliveryVerified:true,fcraReviewCompleted:true,pilotPassed:true,
      reviewedAt:iso(now-1000),reviewer:'Named reviewer',
      providerName:'Approved CRA',providerAccountReference:'account_12345',
      signedDeliveryEventReference:'event_12345',operationsReportReference:'case_12345'
    },now);
    assert.equal(screening.kind,'screening_handoff');
    assert.equal(screening.report.changesEnvironment,false);
    assert.equal(screening.report.changesMarketAdmission,false);
    await assert.rejects(send(screening,{cookie:'ops_session=long-enough-session'}),/not a database-ingestion/i);
    await assert.rejects(send(all,{}),/named\/MFA/i);
    let calls=[];
    const fakeFetch=async (url,opts)=>{
      calls.push({url,method:opts.method,body:opts.body,header:opts.headers});
      if(opts.method==='GET'){
        const marketId=url.split('/').at(-2);
        return {ok:true,json:async()=>({
          marketId,manifest:{version:'manifest-sha-abcdefghijklmnopqrstuvwxyz',sourceProblems:[]}
        })};
      }
      return {ok:true,json:async()=>({ok:true,status:'paused',cleanupPending:false})};
    };
    const out=await send(all,{cookie:'session=NamedMfaCookieValue999999',fetchFn:fakeFetch});
    assert.equal(out.ok,true);
    assert.equal(out.admissionNotAutomaticallyActivated,true);
    assert.equal(calls.length,4);
    assert.equal(calls[3].url,SERVER+'/ops/markets/regions/fl-southeast/evidence');
    assert.equal(calls[3].method,'POST');
    assert.equal(calls[3].header['x-ar-ops-action'],'1');
    assert.equal(calls[3].header.Cookie,'session=NamedMfaCookieValue999999');
    const posted=JSON.parse(calls[3].body);
    assert.equal(posted.domain,'company_insurance_bound');
    assert.equal(posted.allCountiesVerified,true);
    assert.deepEqual(Object.keys(posted.manifestVersions).sort(),[...IDS].sort());
    assert.equal('policy' in posted,false,'Never submit local binder metadata or identity docs');
    assert.equal('independentReview' in posted,false,'Server sets named Ops reviewer');
    assert.equal('screening' in posted,false);
    console.log('PASS production admission ingestion schema and non-network isolated API test '+pass);
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
