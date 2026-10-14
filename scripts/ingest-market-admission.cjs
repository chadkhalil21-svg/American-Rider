#!/usr/bin/env node
'use strict';
// Prepare or submit independently verified market evidence through the existing
// named/MFA Operations admission API. Never writes directly to Firebase/Firestore.
// No synthetic records, provider secrets, or self-asserted approvals.
const fs=require('node:fs');
const { domains }=require('../backend/founder-platform-declarations.json');
const DOMAINS=new Set(domains);
const REGION='fl-southeast';
const IDS=Object.freeze(['fl-miami-dade','fl-broward','fl-palm-beach']);
const SERVER='https://american-rider-server-3d7x.onrender.com';
const FAKE=/\b(?:SYNTHETIC|MOCK|PLACEHOLDER|DUMMY|TEST_ONLY|NOT_A_REAL_PROVIDER|FAKE)\b/i;
function fail(message){throw new Error(message);}
function text(value,max=500){
  if(typeof value!=='string'||!value.trim()||value.length>max||FAKE.test(value))fail('A real, non-synthetic reference is required');
  return value.trim();
}
function inspectEvidence(input,now=Date.now()){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Expected a JSON object');
  if(input.kind==='screening_handoff')return inspectScreeningHandoff(input,now);
  if(input.kind!=='market_evidence'||input.regionId!==REGION||!DOMAINS.has(input.domain))
    fail('Unknown region or evidence domain');
  const domain=input.domain;
  const marketIds=input.marketIds;
  if(!Array.isArray(marketIds)||!marketIds.length||marketIds.length>IDS.length||
     new Set(marketIds).size!==marketIds.length||marketIds.some(x=>!IDS.includes(x)))
     fail('Choose one known county or all three');
  const shared=marketIds.length===IDS.length;
  if(shared&&(!IDS.every(x=>marketIds.includes(x))||input.allCountiesVerified!==true))
    fail('Full-region admission requires separately verified coverage of all three counties');
  if(!shared&&marketIds.length!==1)fail('Multi-county evidence must cover all three counties');
  const reference=text(input.reference);
  const issuer=text(input.issuer,120);
  const validUntil=Number(input.validUntil);
  if(!Number.isSafeInteger(validUntil)||validUntil<=now)fail('validUntil must be a future Unix millisecond timestamp');
  const review=input.independentReview;
  if(!review||review.sourceChecked!==true||!review.reviewer||!review.evidenceLocation||
     !review.reviewedAt||!Number.isSafeInteger(Date.parse(review.reviewedAt))||
     Date.parse(review.reviewedAt)>now||Date.parse(review.reviewedAt)<=0)
     fail('Actual independent source review, reference location, reviewer and dated check required');
  text(review.reviewer,120);text(review.evidenceLocation,500);
  if(domain==='company_insurance_bound'){
    const policy=input.policy;
    if(!policy||!policy.carrier||!policy.binderReference||!policy.namedInsured||
       !policy.territory||!policy.effectiveAt||!policy.expiresAt)
      fail('Carrier, binder reference, insured entity, territory and coverage dates required');
    text(policy.carrier,120);text(policy.binderReference);text(policy.namedInsured,120);
    if(!Array.isArray(policy.territory)||!policy.territory.includes('FL'))fail('Florida coverage must be established');
    const from=Date.parse(policy.effectiveAt),through=Date.parse(policy.expiresAt);
    if(!Number.isSafeInteger(from)||!Number.isSafeInteger(through)||from>now||through<=now||
       validUntil>through)fail('Binder dates must prove currently bound coverage and validUntil may not exceed expiry');
    if(policy.tncContingentResponseVerified!==true)fail('Carrier confirmation of TNC lapse-response coverage required');
  }
  // Disallow credentials or webhook secrets in ingestion files. Store evidence
  // references only; provider integration secrets belong with their own provider.
  if(/(?:secret|password|privateKey|apiKey|signingKey)/i.test(JSON.stringify(input)))
    fail('Do not put credential names or secret material in this evidence file');
  return {kind:'market_evidence',domain,marketIds,shared,
    body:{domain,reference,issuer,validUntil,...(shared?{allCountiesVerified:true}:{})},
    reviewer:review.reviewer,evidenceLocation:review.evidenceLocation};
}
function inspectScreeningHandoff(input,now=Date.now()){
  // Information-only, not a claim to set the screening production flag.
  const x=input;
  if(x.regionId!==REGION||x.provenanceVerified!==true||
      x.signedDeliveryVerified!==true||x.fcraReviewCompleted!==true||
      x.pilotPassed!==true||!x.reviewedAt||Date.parse(x.reviewedAt)>now||
      !Number.isSafeInteger(Date.parse(x.reviewedAt)))
    fail('A separately verified signed provider-to-Operations pilot is required');
  for(const k of ['providerName','providerAccountReference','signedDeliveryEventReference',
    'operationsReportReference','reviewer'])text(x[k]);
  if(/(?:secret|password|privateKey|apiKey|signingKey)/i.test(JSON.stringify(x)))
    fail('Do not provide webhook signing secrets');
  return {kind:'screening_handoff',domain:'provider:screening_provider',shared:false,
    report:{provider:x.providerName,providerAccountReference:x.providerAccountReference,
      signedDeliveryEventReference:x.signedDeliveryEventReference,
      operationsReportReference:x.operationsReportReference,
      status:'awaiting independent production configuration verification',
      changesEnvironment:false,changesMarketAdmission:false}};
}
function help(){
  return 'Usage: node scripts/ingest-market-admission.cjs --input <json-file|-> [--submit]\n'+
   'Default: validate only and print a safe summary. --submit: use existing named/MFA\n'+
   'Operations session from AR_OPS_SESSION_COOKIE in the local process environment.\n'+
   'Never paste credentials into chat or commit evidence files. Only actual issuer evidence.\n';
}
function parseArgs(args){
  let inputFile=null,submit=false;
  for(let i=0;i<args.length;i++){
    if(args[i]==='--input'&&args[i+1])inputFile=args[++i];
    else if(args[i]==='--submit')submit=true;
    else if(args[i]==='--help')return {help:true};
    else fail('Unknown or incomplete CLI argument');
  }
  if(!inputFile)fail('Use --input <file|->');
  return {inputFile,submit};
}
async function send(req,{cookie,fetchFn=fetch}={}){
  if(req.kind!=='market_evidence')fail('Screening handoff is not a database-ingestion API');
  if(typeof cookie!=='string'||cookie.length<20||/[\r\n]/.test(cookie))
    fail('An active named/MFA Operations session is required in AR_OPS_SESSION_COOKIE');
  const versions={};
  for(const marketId of req.marketIds){
    const response=await fetchFn(SERVER+'/ops/markets/'+encodeURIComponent(marketId)+'/readiness',{
      method:'GET',headers:{Cookie:cookie},redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok)fail('Operations market-readiness query failed: '+response.status);
    const data=await response.json();
    if(!data.manifest||data.marketId!==marketId||data.manifest.sourceProblems?.length||
       typeof data.manifest.version!=='string'||data.manifest.version.length<20)
      fail('The current market manifest is invalid');
    versions[marketId]=data.manifest.version;
  }
  const url=req.shared?SERVER+'/ops/markets/regions/'+REGION+'/evidence':
    SERVER+'/ops/markets/'+req.marketIds[0]+'/evidence';
  const payload={...req.body,...(req.shared?{manifestVersions:versions}:{manifestVersion:versions[req.marketIds[0]]})};
  const response=await fetchFn(url,{method:'POST',redirect:'error',
    headers:{Cookie:cookie,'Content-Type':'application/json','x-ar-ops-action':'1'},
    body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
  const result=await response.json();
  if(!response.ok||result?.ok!==true)
    fail('Evidence was not accepted by the authenticated server: '+(result?.code||response.status));
  return {ok:true,domain:req.domain,scope:req.marketIds,
    admissionNotAutomaticallyActivated:true,
    cleanupPending:result.cleanupPending??result.fleetCleanup?.done===false,
    recordStatus:result.status||'recorded'};
}
async function run(args=process.argv.slice(2),io={}) {
  const cfg=parseArgs(args);
  if(cfg.help){(io.log||console.log)(help());return;}
  const contents=cfg.inputFile==='-'?fs.readFileSync(0,'utf8'):fs.readFileSync(cfg.inputFile,'utf8');
  const req=inspectEvidence(JSON.parse(contents));
  if(!cfg.submit){
    // Do not print confidential full policy identifiers or original input.
    (io.log||console.log)(JSON.stringify({
      ok:true,mode:'DRY_RUN_NO_NETWORK',kind:req.kind,domain:req.domain,
      markets:req.marketIds||[],sourceReviewRequired:true,
      ...(req.kind==='screening_handoff'?{nextStep:'Independent validation before setting screening workflow flag'}:
      {endpoint:req.shared?'/ops/markets/regions/'+REGION+'/evidence':
        '/ops/markets/'+req.marketIds[0]+'/evidence',requiresNamedMfa:true})
    },null,2));
    return;
  }
  if(req.kind==='screening_handoff')fail('Screening flag requires separate authenticated operational verification; no CLI auto-approval');
  const out=await send(req,{cookie:process.env.AR_OPS_SESSION_COOKIE,fetchFn:io.fetchFn});
  (io.log||console.log)(JSON.stringify(out,null,2));
}
if(require.main===module)run().catch(e=>{console.error('Evidence ingestion refused: '+e.message);process.exitCode=1;});
module.exports={DOMAINS,IDS,REGION,SERVER,parseArgs,inspectEvidence,send,run};
