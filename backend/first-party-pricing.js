'use strict';
// Read-only insight from already-created Travel records. No new Firestore or
// third-party price lookup; this NEVER issues a pricing recommendation or changes fares.
// The board provides at most 120 recent records; no identifying fields leave this function.
const {marketFor}=require('./markets');
const {distanceBand}=require('./market-reference-service');
const STATUSES=new Set([
 'awaiting_payment','awaiting_assignment','assigned','accepted','arrived','onboard',
 'completed','cancelled','payment_failed','no_operator',
]);
const LIMIT=120;
const moneyMedian=arr=>{
 if(!arr.length)return null;
 const sorted=arr.slice().sort((a,b)=>a-b),m=Math.floor(sorted.length/2);
 return sorted.length%2?sorted[m]:Math.round((sorted[m-1]+sorted[m])/2);
};
function summarizeFirstPartyPricing(rows,{saturated=false,resolveMarket=marketFor}={}){
 if(!Array.isArray(rows))throw new TypeError('rows required');
 const groups=new Map(),ids=new Set();
 let excluded=0,accepted=0,duplicates=0;
 for(const ride of rows.slice(0,LIMIT)){
  const id=String(ride?.id??'');
  if(!id||ids.has(id)){duplicates++;continue;}
  ids.add(id);
  const cents=ride?.costCents,miles=ride?.miles,st=ride?.status;
  // Only server-priced persisted ordinary bookings; do not treat a simulated
  // booking, unset fare, absurd distance or unavailable county as market demand.
  if(ride?.operatorDemo===true||ride?.synthetic===true||ride?.journey||
     String(ride?.travelClass||'Standard').toLowerCase()!=='standard'||
     !Number.isSafeInteger(cents)||cents<300||cents>1000000||
     !Number.isFinite(miles)||miles<0.2||miles>200||!STATUSES.has(st)||
     !Number.isFinite(ride?.pickupLat)||!Number.isFinite(ride?.pickupLng)){
    excluded++;continue;
  }
  let market;
  try{market=resolveMarket({lat:ride.pickupLat,lng:ride.pickupLng});}catch{market=null;}
  if(!market?.id||typeof market.id!=='string'||!/^[-a-z0-9]{3,90}$/.test(market.id)){
   excluded++;continue;
  }
  accepted++;
  const band=distanceBand(miles),key=market.id+'|'+band;
  if(!groups.has(key))groups.set(key,{marketId:market.id,distanceBand:band,
    recorded:0,completed:0,cancelled:0,other:0,prices:[],completedPrices:[]});
  const g=groups.get(key);
  g.recorded++;g.prices.push(cents);
  if(st==='completed'){g.completed++;g.completedPrices.push(cents);}
  else if(st==='cancelled')g.cancelled++;
  else g.other++;
 }
 const segments=[...groups.values()].sort((a,b)=>a.marketId.localeCompare(b.marketId)||
   ['0-3','3-7','7-15','15-30','30+'].indexOf(a.distanceBand)-
   ['0-3','3-7','7-15','15-30','30+'].indexOf(b.distanceBand))
   .map(g=>Object.freeze({marketId:g.marketId,distanceBand:g.distanceBand,
    recorded:g.recorded,completed:g.completed,cancelled:g.cancelled,other:g.other,
    medianRecordedTotalCents:moneyMedian(g.prices),
    medianCompletedTotalCents:moneyMedian(g.completedPrices)}));
 return Object.freeze({
  inspected:Math.min(rows.length,LIMIT),valid:accepted,excluded,duplicates,
  saturated:saturated||rows.length>=LIMIT,segments,
  // These are outcomes of prepared bookings, NOT quote impressions, price
  // elasticity, verified card charges or independent competitor prices.
  completeQuoteFunnel:false,marketReferenceEligible:false,priceChangeAuthorized:false,
 });
}
module.exports={LIMIT,summarizeFirstPartyPricing};
