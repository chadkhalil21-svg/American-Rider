// Executable market-reference service.
//
// Collectors are intentionally provider-neutral. A collector fetches lawful evidence and returns
// normalized observations; this service persists them, builds robust cell references, and writes
// candidate snapshots. Production fare coefficients remain separately promotion-gated.
const { adminDb }=require('./firebase-admin');
const { normalizeObservation }=require('./market-evidence-ingest');
const { targetTotalCents }=require('./pricing-policy');
const { planForRegion }=require('./market-evidence');

const OBS='market_reference_observations';
const SNAP='market_reference_snapshots';
const STATE='market_reference_state';
const MAX_OBSERVATIONS_PER_SOURCE=5000;
const HOUR=60*60*1000;

function firestoreReady(){return !!adminDb();}

function median(xs){if(!xs.length)return null;const a=[...xs].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:Math.round((a[m-1]+a[m])/2);}
function distanceBand(miles){const n=Number(miles);return n<3?'0-3':n<7?'3-7':n<15?'7-15':n<30?'15-30':'30+';}
function durationBand(minutes){const n=Number(minutes);return n<10?'0-10':n<20?'10-20':n<40?'20-40':n<60?'40-60':'60+';}
function cellKey(o){return [o.serviceClass,distanceBand(o.routedMiles),durationBand(o.routedMinutes),o.daypart||'any',o.weekdayWeekend||'any',o.calendarClass||'ordinary',o.regulatedLocationClass||'ordinary'].join('|');}

async function persistObservations(db,rows){
  let written=0;
  for(const raw of rows.slice(0,MAX_OBSERVATIONS_PER_SOURCE)){
    const o=normalizeObservation(raw);
    const id=require('node:crypto').createHash('sha256').update([o.marketId,o.sourceId,o.observedAt,o.routedMiles,o.routedMinutes,o.travelerTotalCents].join('|')).digest('hex');
    await db.collection(OBS).doc(id).set(o,{merge:false});
    written++;
  }
  return written;
}

async function recomputeMarket(db,marketId,{now=Date.now(),lookbackDays=90}={}){
  const since=new Date(now-lookbackDays*86400000).toISOString();
  const snap=await db.collection(OBS).where('marketId','==',marketId).where('observedAt','>=',since).limit(10000).get();
  const groups=new Map(),sources=new Set(),families=new Set();
  snap.forEach(d=>{const o=d.data();const k=cellKey(o);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o);sources.add(o.sourceId);families.add(o.sourceType);});
  const cells={};
  for(const [key,rows] of groups){
    // Prevent a high-volume source from numerically overwhelming independent sources: first\n    // reduce each source to its own robust median, then take the median across sources.\n    const bySource=new Map();\n    for(const row of rows){if(!bySource.has(row.sourceId))bySource.set(row.sourceId,[]);bySource.get(row.sourceId).push(Number(row.travelerTotalCents));}\n    const sourceMedians=[...bySource.values()].map(xs=>median(xs.filter(Number.isInteger))).filter(Number.isInteger);\n    const referenceTotalCents=median(sourceMedians);
    if(referenceTotalCents===null)continue;
    const providerCounts={};for(const r of rows){const k=r.providerKey||r.sourceId;providerCounts[k]=(providerCounts[k]||0)+1;}\n    const maxProviderShare=rows.length?Math.max(...Object.values(providerCounts))/rows.length:1;\n    cells[key]={referenceTotalCents,targetTotalCents:targetTotalCents(referenceTotalCents),observations:rows.length,sources:[...bySource.keys()],sourceMedians,evidenceFamilies:[...new Set(rows.map(x=>x.sourceType))],providers:Object.keys(providerCounts),maxProviderShare,latestObservedAt:rows.map(x=>x.observedAt).filter(Boolean).sort().at(-1)||null,asOf:new Date(now).toISOString()};
  }
  const latestObservedAt=[...groups.values()].flat().map(x=>x.observedAt).sort().at(-1)||null;
  // Recompute produces a CANDIDATE. It is deliberately not production authority until an
  // explicit promotion record proves holdout, economics and router gates for this exact snapshot.
  const out={marketId,asOf:new Date(now).toISOString(),latestObservedAt,lookbackDays,observations:snap.size,sourceCount:sources.size,evidenceFamilies:[...families],promotion:{status:'candidate'},cells};
  await db.collection(SNAP).doc(marketId).set(out);
  return out;
}

async function runMarketReferenceSweep({collectors={},now=Date.now(),force=false}={}){
  const db=adminDb();
  if(!db)return{ok:false,reason:'no database'};
  const plans=require('./market-evidence').MARKET_EVIDENCE_PLANS;
  const markets=Object.keys(plans).filter(id=>plans[id]?.admissionOnly!==true);
  const report={ok:true,markets:{}};
  for(const marketId of markets){
    const plan=planForRegion(marketId);
    const stateRef=db.collection(STATE).doc(marketId),stateSnap=await stateRef.get(),state=stateSnap.exists?stateSnap.data():{};
    if(!force&&state.lastSweepAt&&now-Number(state.lastSweepAt)<HOUR){report.markets[marketId]={skipped:'cadence',lastSweepAt:state.lastSweepAt};continue;}
    let written=0;const results=[];
    for(const sourceId of plan.sources){
      const collect=collectors[sourceId];
      if(typeof collect!=='function'){results.push({sourceId,ok:false,reason:'collector not configured'});continue;}
      try{const rows=await collect({marketId,now});const n=await persistObservations(db,Array.isArray(rows)?rows:[]);written+=n;results.push({sourceId,ok:true,observations:n});}
      catch(e){results.push({sourceId,ok:false,reason:e.message});}
    }
    const reference=await recomputeMarket(db,marketId,{now});
    await stateRef.set({lastSweepAt:now,lastSweepIso:new Date(now).toISOString(),lastWritten:written,lastReferenceAsOf:reference.asOf,collectorResults:results},{merge:true});
    report.markets[marketId]={written,reference,collectors:results};
  }
  return report;
}
async function currentReference(marketId){const db=adminDb();if(!db)return null;const s=await db.collection(SNAP).doc(marketId).get();return s.exists?s.data():null;}
module.exports={median,distanceBand,durationBand,cellKey,persistObservations,recomputeMarket,runMarketReferenceSweep,currentReference,firestoreReady};
