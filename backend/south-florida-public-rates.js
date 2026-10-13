'use strict';
// Published government taxi tariff watch: context, NEVER a live TNC market quote.
// Reads at most two fixed official pages per week for Miami-Dade, and no route-
// triggered requests. Other counties remain "source not commissioned".
// This feeds an audit-only collection, not market_reference_snapshots.
const {createHash}=require('node:crypto');
const {adminDb}=require('./firebase-admin');
const WEEK=7*24*60*60_000;
const MAX_HTML=300000;
const PAGES=Object.freeze([
  Object.freeze({id:'miami-dade-passenger-info',
    url:'https://www.miamidade.gov/global/economy/consumer-protection/taxicabs-passenger-information.page'}),
  Object.freeze({id:'miami-dade-legislative-analysis-2025',
    url:'https://www.miamidade.gov/govaction/matter.asp?file=true&fileAnalysis=false&matter=251162&yearFolder=Y2025'}),
]);
const COLLECTION='market_public_rate_watch';
const sha=v=>createHash('sha256').update(String(v)).digest('hex');
const out=(reason)=>({ok:false,status:'unverified',reason,marketId:'fl-miami-dade',rateAuthority:false});
function htmlToText(html){
  return String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ')
    .replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|#160);/gi,' ')
    .replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
}
function extractOfficialTaxiRate(html){
  const text=htmlToText(html);
  // Restrict parsing to the explicit currently described rate schedule, not
  // proposed CPI comparisons or old prices later in the legislative history.
  const m=/(?:maximum\s+taxicab\s+metered\s+rate|metered\s+rate)\s+is\s+calculated\s+at\s*:?\s*(.{0,700})/i.exec(text);
  if(!m) return null;
  const section=m[1];
  const first=/\$\s*2\.95\s+(?:for\s+)?(?:the\s+)?first\s+(?:one[ -]?sixth|1\s*\/\s*6)/i.test(section);
  const intermediate=/\$\s*0\.85\s+(?:for\s+)?each\s+(?:additional\s+)?(?:one[ -]?sixth|1\s*\/\s*6)/i.test(section);
  const later=/\$\s*(0\.\d{2})\s+(?:for|per)\s+each\s+(?:additional\s+)?(?:one[ -]?sixth|1\s*\/\s*6)\s+mile\s+after\s+(?:that|1\s*mile)/i.exec(section);
  if(!first||!intermediate||!later)return null;
  const lastSixthCents=Math.round(Number(later[1])*100);
  if(!Number.isInteger(lastSixthCents)||lastSixthCents<1||lastSixthCents>200)return null;
  return Object.freeze({firstSixthCents:295,upToMileAdditionalSixthCents:85,
    afterMileSixthCents:lastSixthCents});
}
async function readPublicPage(page,{fetchFn=fetch}={}){
  // URLs are hard-coded; no user-controlled URLs, redirects or credential headers.
  const response=await fetchFn(page.url,{redirect:'error',signal:AbortSignal.timeout(8000),
    headers:{'accept':'text/html','user-agent':'American-Rider-Public-Fare-Research/1.0'}});
  if(!response?.ok||response.status!==200)throw Error('official source unavailable');
  const declared=Number(response.headers?.get?.('content-length'));
  if(Number.isFinite(declared)&&declared>MAX_HTML)throw Error('official source oversized');
  const html=await response.text();
  if(Buffer.byteLength(html,'utf8')>MAX_HTML)throw Error('official source oversized');
  const parsed=extractOfficialTaxiRate(html);
  if(!parsed)throw Error('official source schedule not recognized');
  return {id:page.id,url:page.url,rate:parsed,excerptHash:sha(JSON.stringify(parsed))};
}
function compareSources(sources){
  if(!Array.isArray(sources)||sources.length!==PAGES.length||
     sources.some(x=>!x?.rate||!Number.isInteger(x.rate.afterMileSixthCents)))
    return out('two validated independent government pages required');
  if(new Set(sources.map(x=>x.id)).size!==2)return out('duplicate government page');
  const equal=sources.every(x=>JSON.stringify(x.rate)===JSON.stringify(sources[0].rate));
  return {ok:true,marketId:'fl-miami-dade',status:equal?'tariff_consistent':'source_conflict',
    rateAuthority:false,travelerTotalComparable:false,pricePromotionAllowed:false,
    sourceKind:'taxicab_maximum_tariff_not_rideshare_quote',
    pages:sources.map(s=>({id:s.id,url:s.url,rate:s.rate,excerptHash:s.excerptHash})),
    reason:equal?'taxi-only comparison, not an actual rideshare quote':
      'official county sources disagree: do not assert a current taxi rate'};
}
async function sweepSouthFloridaPublicRates({db=adminDb(),fetchFn=fetch,now=Date.now()}={}){
  if(!db)return out('Firestore unavailable');
  if(!Number.isFinite(now)||now<=0)return out('invalid timestamp');
  const ref=db.collection(COLLECTION).doc('fl-miami-dade');
  try{
    const previous=await ref.get();
    const prev=previous.exists?previous.data():{};
    // Use a persisted weekly checkpoint across Render restarts and instances.
    if(Number.isFinite(prev.checkedAt)&&now>=prev.checkedAt&&now-prev.checkedAt<WEEK)
      return {ok:true,skipped:'weekly_cadence',status:prev.status,marketId:'fl-miami-dade',
        rateAuthority:false};
    const resolved=await Promise.allSettled(PAGES.map(p=>readPublicPage(p,{fetchFn})));
    const good=resolved.filter(x=>x.status==='fulfilled').map(x=>x.value);
    let current;
    if(good.length===2)current=compareSources(good);
    else current={...out('one or more official source pages unavailable or changed'),
      failedSources:resolved.map((x,i)=>x.status==='rejected'?PAGES[i].id:null).filter(Boolean)};
    const state={...current,checkedAt:now,checkedIso:new Date(now).toISOString(),
      dataFingerprint:sha(JSON.stringify({status:current.status,
        pages:current.pages||null,failedSources:current.failedSources||null}))};
    // No repeated writes for identical data unless the scheduled audit period
    // has elapsed. Weekly checkpoint is just one small document write.
    await ref.set(state);
    if(current.status!=='tariff_consistent')
      console.warn('[south-florida-tariff] public sources need review',current.status);
    return current;
  }catch(e){
    return out('public rate check cannot be persisted; no rate inferred');
  }
}
module.exports={PAGES,WEEK,COLLECTION,extractOfficialTaxiRate,compareSources,
  readPublicPage,sweepSouthFloridaPublicRates};
