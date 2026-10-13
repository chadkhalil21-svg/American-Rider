'use strict';
// Optional, contract-authorized South Florida quote feed. Zero network, provider,
// Firestore reads or cost unless an authorized source has been deliberately
// configured with an approved right to use its data for pricing research.
const {isIP}=require('node:net');
const {normalizeObservation}=require('./market-evidence-ingest');
const {boundedSourceText}=require('./bounded-source-response');
const MARKETS=new Set(['fl-miami-dade','fl-broward','fl-palm-beach']);
const MAX_ROWS=50, MAX_BYTES=120000;
function approvedSource(env=process.env){
  if(env.AR_PANEL_APPROVED_FOR_MARKET_RESEARCH!=='true' ||
     !env.AR_PANEL_APPROVAL_REFERENCE ||
     !env.AR_PANEL_READ_TOKEN ||
     !env.AR_PANEL_HTTPS_URL)return null;
  let url;
  try{url=new URL(env.AR_PANEL_HTTPS_URL);}catch{return null;}
  if(url.protocol!=='https:'||url.username||url.password||url.hash||
     url.port&&url.port!=='443'||
     isIP(url.hostname)||!url.hostname.includes('.')||
     /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname)||
     !url.pathname||url.pathname==='/')return null;
  return {url,token:String(env.AR_PANEL_READ_TOKEN),approvalRef:String(env.AR_PANEL_APPROVAL_REFERENCE)};
}
function authorizedMarketPanelCollectors({env=process.env,fetchFn=fetch}={}){
  const source=approvedSource(env);
  if(!source)return {};
  return {'controlled-public-price-panel':async({marketId,now=Date.now()})=>{
    if(!MARKETS.has(marketId))throw Error('unapproved market id');
    const requestUrl=new URL(source.url);
    requestUrl.searchParams.set('marketId',marketId);
    const res=await fetchFn(requestUrl.href,{
      method:'GET',redirect:'error',signal:AbortSignal.timeout(8000),
      headers:{accept:'application/json',
        authorization:'Bearer '+source.token,
        'user-agent':'American-Rider-Approved-Market-Research/1.0'},
    });
    if(!res?.ok||res.status!==200)throw Error('market research feed unavailable');
    const raw=await boundedSourceText(res,{maxBytes:MAX_BYTES,label:'market research feed'});
    let data;
    try{data=JSON.parse(raw);}catch{throw Error('invalid market research response');}
    if(data?.approvalReference!==source.approvalRef ||
       data?.marketId!==marketId ||
       data?.pricingResearchUseApproved!==true ||
       !Array.isArray(data.observations) ||
       data.observations.length>MAX_ROWS)throw Error('market research feed scope or permissions invalid');
    return data.observations.map(row=>{
      if(!row||typeof row!=='object'||row.marketId!==marketId||
         row.serviceClass!=='standard' ||row.currency!=='USD'||
         row.fullOrdinaryTravelerTotal!==true||row.promotionApplied!==false||
         row.routeConditionsConfirmed!==true ||
         !row.providerKey || typeof row.providerKey!=='string'||
         typeof row.observationId!=='string' ||
         !/^[A-Za-z0-9_.:-]{8,128}$/.test(row.observationId)||
         !Number.isSafeInteger(row.travelerTotalCents)||
         row.travelerTotalCents<=0)
        throw Error('unmatched or promotional price cannot enter comparison');
      const date=Date.parse(row.observedAt||'');
      if(!Number.isFinite(date)||date>now+5*60000||now-date>30*86400000)
        throw Error('stale or future price observation');
      // Block personal price targeting and personally identified observations.
      if(row.userId||row.deviceId||row.income||row.protectedClass||
         row.accountId||row.customerId||row.personalizedPrice===true)
        throw Error('personalized observation prohibited');
      return normalizeObservation({
        marketId,sourceId:'controlled-public-price-panel',sourceType:'field-panel',
        observedAt:row.observedAt,serviceClass:'standard',
        routedMiles:row.routedMiles,routedMinutes:row.routedMinutes,
        travelerTotalCents:row.travelerTotalCents,
        daypart:row.daypart,weekdayWeekend:row.weekdayWeekend,
        calendarClass:'ordinary',regulatedLocationClass:'ordinary',
        providerKey:row.providerKey,sourceObservationId:row.observationId,
        confidence:'source_declared_research',
        provenance:'approved authorized panel '+source.approvalRef+
          '; validated source-declared full ordinary Traveler Total; not independently verified',
      },now);
    });
  }};
}
module.exports={approvedSource,authorizedMarketPanelCollectors,MARKETS,MAX_ROWS};
