'use strict';
// Founder commands committed through the already-authenticated GitHub account.
// Deployment is a request to the existing admission engine, NEVER authority to
// fabricate insurance, licensing, providers or paid-booking evidence.
// This is deliberately one standard national mechanism, not per-county scripts.
const {manifestFor, activateRegion}=require('./market-readiness');
const configured=require('./founder-market-intents.json');
const MAX_AGE=45*24*60*60*1000;
const ACTOR='github:chadkhalil21-svg';
const METHOD='founder_gitops_release';
const DATE=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function validateIntents(source,now=Date.now()){
  if(!source||source.version!==1||!Array.isArray(source.commands)||
    source.commands.length>10) return {ok:false,code:'invalid_intent_registry'};
  const seen=new Set(),commands=[];
  for(const c of source.commands){
    if(!c||c.action!=='open'||c.requestedBy!=='chadkhalil21-svg'||
      !/^founder-open-[a-z0-9-]{4,80}$/.test(String(c.id||''))||
      !/^[a-z]{2}-[a-z0-9-]{2,70}$/.test(String(c.regionId||''))||
      !DATE.test(String(c.requestedAt||''))||!DATE.test(String(c.expiresAt||''))||
      seen.has(c.regionId)) return {ok:false,code:'invalid_founder_instruction'};
    const requested=Date.parse(c.requestedAt),expires=Date.parse(c.expiresAt);
    if(!Number.isFinite(requested)||!Number.isFinite(expires)||
      requested>now+5*60_000||expires<=requested||expires-requested>MAX_AGE)
      return {ok:false,code:'invalid_instruction_window'};
    seen.add(c.regionId);
    commands.push({...c,requested,expires});
  }
  return {ok:true,commands};
}

async function sweepFounderMarketIntents({
  db,markets=[],regions=[],production=false,providerMissing=[],
  intents=configured,now=Date.now(),activate=activateRegion,onOpened=()=>{},
}={}){
  if(!production)return {ok:true,skipped:'nonproduction'};
  if(!db||!Array.isArray(markets)||!Array.isArray(regions)||
    !Array.isArray(providerMissing)||typeof activate!=='function')
    return {ok:false,code:'missing_authoritative_services'};
  const checked=validateIntents(intents,now);
  if(!checked.ok)return checked;
  const results=[];
  for(const command of checked.commands){
    if(now>command.expires){
      results.push({regionId:command.regionId,code:'instruction_expired',ok:false});
      continue;
    }
    const region=regions.find(r=>r.id===command.regionId);
    const entries=markets.filter(m=>m.regionId===command.regionId);
    if(!region||!entries.length){
      results.push({regionId:command.regionId,code:'unconfigured_region',ok:false});
      continue;
    }
    const expectedVersions=Object.fromEntries(entries.map(m=>[
      m.id,manifestFor(m,region)?.version,
    ]));
    try {
      // Rechecks EVERY current production requirement inside one atomic transaction.
      // The founder's intent cannot revive a market intentionally paused later.
      const outcome=await activate({
        db,entries:entries.map(market=>({market,region})),
        actor:ACTOR,auditMethod:METHOD,intentRequestedAt:command.requested,
        founderCommandId:command.id,
        expectedVersions,providerMissing,now,
      });
      const opened=Array.isArray(outcome.newlyOpened)?outcome.newlyOpened:[];
      if(outcome.ok&&opened.length)onOpened();
      results.push({regionId:command.regionId,ok:outcome.ok===true,
        code:outcome.code||'unknown_result',newlyOpened:opened,
        missing:Array.isArray(outcome.missing)?[...new Set(outcome.missing.map(x=>x.id))]:[],
      });
    }catch {
      results.push({regionId:command.regionId,ok:false,code:'admission_check_unavailable'});
    }
  }
  return {ok:results.every(x=>x.ok),results};
}
module.exports={ACTOR,METHOD,MAX_AGE,validateIntents,sweepFounderMarketIntents};
