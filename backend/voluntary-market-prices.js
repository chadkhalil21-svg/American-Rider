'use strict';
// Voluntary consumer/Operator reports of their OWN completed or offered TNC fare.
// RESEARCH QUARANTINE ONLY: this collection is NOT market_reference_observations,
// not a promoted price feed, and never changes any American Rider Traveler Total.
// No screenshots, receipts, precise coordinates, IDs, names or source credentials
// are persisted. Commercial data rights and evidentiary quality require review.
const {createHash}=require('node:crypto');
const {marketFor,listMarkets}=require('./markets');

const COLLECTION='market_price_research_submissions';
const MAX_AGE_MS=14*24*60*60*1000;
const ALLOWED_KEYS=new Set([
  'pickup','marketId','observationId','observedAt','routedMiles','routedMinutes',
  'travelerTotalCents','serviceClass','ordinaryNoPromotion','sourceKind',
  'consentToResearch','providerCode',
]);
const PROVIDERS=new Set(['other-leading-platform-a','other-leading-platform-b','other']);
const SOURCE_KINDS=new Set(['my-receipt','my-quote']);

function validateVoluntaryPrice({body,uid,now=Date.now(),marketForPoint=marketFor,marketList=listMarkets}={}){
  if(typeof uid!=='string'||uid.length<10||uid.length>256)throw Error('authenticated contributor required');
  if(!body||typeof body!=='object'||Array.isArray(body))throw Error('observation required');
  if(Object.keys(body).some(k=>!ALLOWED_KEYS.has(k)))throw Error('unexpected or identifying fields prohibited');
  if(body.consentToResearch!==true)throw Error('research consent required');
  if(body.ordinaryNoPromotion!==true||body.serviceClass!=='standard')
    throw Error('ordinary unpromoted standard price required');
  if(!SOURCE_KINDS.has(body.sourceKind))throw Error('source kind invalid');
  if(!PROVIDERS.has(body.providerCode))throw Error('provider kind invalid');
  if(typeof body.observationId!=='string'||!/^[A-Za-z0-9_.:-]{12,100}$/.test(body.observationId))
    throw Error('anonymous stable observation ID required');
  if(Boolean(body.pickup)===Boolean(body.marketId))throw Error('select one pickup market method');
  let market,marketEvidence;
  if(body.marketId){
    if(typeof body.marketId!=='string'||!/^[a-z]{2}-[a-z0-9-]{2,70}$/.test(body.marketId))
      throw Error('pickup county invalid');
    market=(marketList()||[]).find(m=>m.id===body.marketId&&m.regionId)||null;
    marketEvidence='contributor-declared-county';
  }else{
    if(!body.pickup||typeof body.pickup!=='object'||Array.isArray(body.pickup)||
      Object.keys(body.pickup).some(x=>!['lat','lng'].includes(x))||
      !Number.isFinite(body.pickup.lat)||!Number.isFinite(body.pickup.lng)||
      body.pickup.lat < -90||body.pickup.lat>90||
      body.pickup.lng < -180||body.pickup.lng>180)
      throw Error('pickup county cannot be verified');
    market=marketForPoint(body.pickup);
    marketEvidence='county-verified-from-submitted-point';
  }
  if(!market?.id||!/^[-a-z0-9]{3,90}$/.test(market.id))throw Error('no known source market');
  const ts=typeof body.observedAt==='string'?Date.parse(body.observedAt):NaN;
  if(!Number.isFinite(ts)||ts>now+5*60*1000||now-ts>MAX_AGE_MS)
    throw Error('source observation stale or future dated');
  const miles=body.routedMiles,minutes=body.routedMinutes,cents=body.travelerTotalCents;
  if(!Number.isFinite(miles)||miles<0.2||miles>200||
     !Number.isFinite(minutes)||minutes<1||minutes>480||
     !Number.isSafeInteger(cents)||cents<300||cents>100000)
    throw Error('price or route metrics invalid');
  if(miles/(minutes/60)>100)throw Error('unreasonable travel speed');
  const id=createHash('sha256').update(JSON.stringify(
    ['ar-optin-v1',market.id,uid,body.observationId])).digest('hex');
  return {id,document:Object.freeze({
    marketId:market.id,
    marketEvidence,
    sourceType:'voluntary-research',
    sourceKind:body.sourceKind,
    providerKey:body.providerCode,
    serviceClass:'standard',
    routedMiles:miles,routedMinutes:minutes,travelerTotalCents:cents,
    observedAt:new Date(ts).toISOString(),
    ordinaryNoPromotion:true,
    validatedBy:'submitter-attested-unverified',
    reviewState:'quarantined',
    pricePromotionEligible:false,
    // Contributor pseudonym is only for future independent-contributor
    // checks and deletion audits. Do not persist raw Firebase UID.
    contributorPseudonym:createHash('sha256').update(
      JSON.stringify(['ar-optin-contributor-v1',market.id,uid])).digest('hex'),
  })};
}

async function receiveVoluntaryPrice({db,uid,body,now=Date.now(),marketForPoint=marketFor,marketList=listMarkets}={}){
  if(!db||typeof db.collection!=='function')throw Error('price evidence storage unavailable');
  const {id,document}=validateVoluntaryPrice({body,uid,now,marketForPoint,marketList});
  const ref=db.collection(COLLECTION).doc(id);
  try{
    await ref.create(document);
    return Object.freeze({ok:true,researchOnly:true,reused:false,marketId:document.marketId});
  }catch(e){
    if(e?.code!==6&&e?.code!=='ALREADY_EXISTS'&&e?.code!=='already-exists')throw e;
    // Re-use of the same observation identity with changed monetary facts
    // is a conflict, not another valid sample. One extra read only on replay.
    const prior=await ref.get();
    if(!prior.exists||JSON.stringify(prior.data())!==JSON.stringify(document))
      throw Error('observation ID reused with different facts');
    return Object.freeze({ok:true,researchOnly:true,reused:true,marketId:document.marketId});
  }
}

module.exports={COLLECTION,MAX_AGE_MS,validateVoluntaryPrice,receiveVoluntaryPrice};
