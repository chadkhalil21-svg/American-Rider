// Runtime authority for market-reference pricing.
// Candidate snapshots do not automatically become prices. A quote may consume a reference only
// when the market's evidence-diversity requirement is met and the requested condition cell exists.
const {regionForTrip}=require('./regions');
const {marketFor}=require('./markets');
const {planForRegion}=require('./market-evidence');
const {currentReference,distanceBand,durationBand}=require('./market-reference-service');

function localConditions(region,date=new Date()){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:region.timezone,hour:'numeric',hourCycle:'h23',weekday:'short'}).formatToParts(date).map(x=>[x.type,x.value]));
  const h=Number(p.hour),daypart=h<6?'overnight':h<10?'morning':h<16?'midday':h<20?'evening':'night';
  return {daypart,weekdayWeekend:['Sat','Sun'].includes(p.weekday)?'weekend':'weekday'};
}
function keyForQuote({serviceClass='standard',routedMiles,routedMinutes,region,now=new Date(),calendarClass='ordinary',regulatedLocationClass='ordinary'}){
  const t=localConditions(region,now);
  return [serviceClass,distanceBand(routedMiles),durationBand(routedMinutes),t.daypart,t.weekdayWeekend,calendarClass,regulatedLocationClass].join('|');
}
function referenceScopeForPickup(pickup){
  const market=marketFor(pickup);
  return market?.status==='active'?market.id:null;
}
function qualification(snapshot,plan,cell=null,now=Date.now()){
  if(!snapshot)return {ok:false,reason:'reference missing'};
  // A recomputed snapshot is only a candidate. Runtime pricing requires explicit evidence that
  // this exact snapshot passed holdout, unit-economics and router validation before promotion.
  const p=snapshot.promotion||{};
  if(p.status!=='promoted'||p.snapshotAsOf!==snapshot.asOf||p.holdoutPassed!==true||p.economicsPassed!==true||p.routerPassed!==true)
    return {ok:false,reason:'reference not promoted'};
  if(!snapshot.cells||typeof snapshot.cells!=='object')return {ok:false,reason:'reference cells missing'};
  if(!cell)return {ok:true};
  const families=new Set(cell.evidenceFamilies||[]);
  if(families.size<(plan?.minimumIndependentFamilies||2))return {ok:false,reason:'condition-cell independent evidence insufficient'};
  const observed=Date.parse(cell.latestObservedAt||'');
  if(!Number.isFinite(observed))return {ok:false,reason:'condition-cell evidence timestamp missing'};
  const maxAgeDays=Number(plan?.maxObservationAgeDays||90);
  if(now-observed>maxAgeDays*86400000)return {ok:false,reason:'condition-cell evidence stale'};
  return {ok:true};
}
async function referenceForQuote({pickup,dest,serviceClass,routedMiles,routedMinutes,now=new Date()}){
  const region=regionForTrip(pickup,dest);if(!region)return {ok:false,reason:'region unavailable'};
  const marketId=referenceScopeForPickup(pickup);if(!marketId)return {ok:false,reason:'service market unavailable',regionId:region.id};
  const market=marketFor(pickup);
  const plan=planForRegion(marketId);if(!plan)return {ok:false,reason:'evidence plan unavailable',regionId:region.id,marketId:market.id};
  const snapshot=await currentReference(market.id),snapshotQ=qualification(snapshot,plan);
  if(!snapshotQ.ok)return {...snapshotQ,regionId:region.id,marketId:market.id};
  const key=keyForQuote({serviceClass,routedMiles,routedMinutes,region,now});
  const cell=snapshot.cells[key];
  if(!cell||!Number.isInteger(cell.targetTotalCents))return {ok:false,reason:'condition-matched reference unavailable',regionId:region.id,marketId:market.id,key};
  const cellQ=qualification(snapshot,plan,cell,now.getTime());
  if(!cellQ.ok)return {...cellQ,regionId:region.id,marketId:market.id,key};
  return {ok:true,regionId:region.id,marketId:market.id,key,referenceTotalCents:cell.referenceTotalCents,targetTotalCents:cell.targetTotalCents,referenceAsOf:cell.latestObservedAt,sources:cell.sources||[]};
}
module.exports={localConditions,keyForQuote,referenceScopeForPickup,qualification,referenceForQuote};
