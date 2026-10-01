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
function qualification(snapshot,plan){
  if(!snapshot)return {ok:false,reason:'reference missing'};
  const families=new Set(snapshot.evidenceFamilies||[]);
  if(families.size<(plan?.minimumIndependentFamilies||2))return {ok:false,reason:'independent evidence insufficient'};
  if(!snapshot.latestObservedAt||!Number.isFinite(Date.parse(snapshot.latestObservedAt)))return {ok:false,reason:'evidence timestamp missing'};
  if(!snapshot.cells||typeof snapshot.cells!=='object')return {ok:false,reason:'reference cells missing'};
  return {ok:true};
}
async function referenceForQuote({pickup,dest,serviceClass,routedMiles,routedMinutes,now=new Date()}){
  const region=regionForTrip(pickup,dest);if(!region)return {ok:false,reason:'region unavailable'};
  const market=marketFor(pickup);if(!market||market.status!=='active')return {ok:false,reason:'service market unavailable',regionId:region.id};
  const plan=planForRegion(market.id);if(!plan)return {ok:false,reason:'evidence plan unavailable',regionId:region.id,marketId:market.id};
  const snapshot=await currentReference(market.id),q=qualification(snapshot,plan);
  if(!q.ok)return {...q,regionId:region.id,marketId:market.id};
  const key=keyForQuote({serviceClass,routedMiles,routedMinutes,region,now});
  const cell=snapshot.cells[key];
  if(!cell||!Number.isInteger(cell.targetTotalCents))return {ok:false,reason:'condition-matched reference unavailable',regionId:region.id,marketId:market.id,key};
  return {ok:true,regionId:region.id,marketId:market.id,key,referenceTotalCents:cell.referenceTotalCents,targetTotalCents:cell.targetTotalCents,referenceAsOf:snapshot.latestObservedAt,sources:cell.sources||[]};
}
module.exports={localConditions,keyForQuote,qualification,referenceForQuote};
