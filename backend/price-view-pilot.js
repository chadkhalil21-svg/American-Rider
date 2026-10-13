'use strict';
// Disabled unless privacy/retention gates pass. Research is never fare authority.
const contract=require('./quote-view-contract');
const {distanceBand}=require('./market-reference-service');
const COLLECTION='pricing_quote_views',MAX_SAMPLE=120;
function viewRecord(view,now){
 return {marketId:view.marketId,distanceBand:view.distanceBand,
  quotedTotalCents:view.totalCents,viewedAt:new Date(now),
  expiresAt:new Date(now+7*24*60*60*1000),preparedRideId:null};
}
async function recordView({db,uid,token,now=Date.now(),env=process.env}){
 const view=contract.verify(token,{uid,now,env});
 if(!view)return {ok:false,reason:'invalid'};
 if(!db)return {ok:false,reason:'unavailable'};
 const ref=db.collection(COLLECTION).doc(view.id);
 try{await ref.create(viewRecord(view,now));return {ok:true,duplicate:false};}
 catch(e){
  if(e?.code===6||e?.code==='already-exists'||e?.code==='ALREADY_EXISTS'||
    /already exists/i.test(String(e?.message||'')))return {ok:true,duplicate:true};
  throw e;
 }
}
async function markBooking({db,uid,token,pickup,dest,marketId,miles,totalCents,rideId,
 now=Date.now(),env=process.env}){
 if(!contract.enabled(env)||!token||!db)return false;
 const view=contract.verify(token,{uid,now,env});
 const fingerprint=contract.routeTag({uid,pickup,dest,env});
 if(!view||!fingerprint||!Number.isFinite(miles)||miles<=0||
   !contract.matchesBooking(view,{marketId,distanceBand:distanceBand(miles),
    totalCents,routeFingerprint:fingerprint})||
   !/^[a-f0-9]{40}$/.test(String(rideId)))return false;
 const ref=db.collection(COLLECTION).doc(view.id);
 return db.runTransaction(async(tx)=>{
  const snap=await tx.get(ref);
  if(!snap.exists)return false;
  const d=snap.data()||{};
  const started=d.viewedAt?.toMillis?.()??d.viewedAt?.getTime?.();
  const expires=d.expiresAt?.toMillis?.()??d.expiresAt?.getTime?.();
  if(!Number.isFinite(started)||started>now||now-started>contract.MAX_AGE||
    !Number.isFinite(expires)||expires<=now||
    d.marketId!==view.marketId||d.distanceBand!==view.distanceBand||
    d.quotedTotalCents!==view.totalCents||
    (d.preparedRideId&&d.preparedRideId!==rideId))return false;
  if(!d.preparedRideId)tx.update(ref,{preparedRideId:rideId,preparedAt:new Date(now)});
  return true;
 });
}
async function recentReport({db,now=Date.now(),env=process.env}){
 if(!contract.enabled(env))return {enabled:false};
 if(!db)return {enabled:true,available:false};
 const snap=await db.collection(COLLECTION)
  .where('viewedAt','>=',new Date(now-24*60*60*1000))
  .orderBy('viewedAt','desc').limit(MAX_SAMPLE).get();
 const markets=new Map();let mature=0,prepared=0;
 for(const doc of snap.docs){
  const d=doc.data()||{};
  const time=d.viewedAt?.toMillis?.()??d.viewedAt?.getTime?.();
  if(!Number.isFinite(time)||time>now-60*60000||time<now-24*60*60000||
    !/^[-a-z0-9]{3,90}$/.test(String(d.marketId||'')))continue;
  mature++;
  const id=d.marketId;
  if(!markets.has(id))markets.set(id,{marketId:id,viewed:0,prepared:0});
  const m=markets.get(id);m.viewed++;
  if(/^[a-f0-9]{40}$/.test(String(d.preparedRideId||''))){m.prepared++;prepared++;}
 }
 return {enabled:true,available:true,mature,prepared,inspected:snap.docs.length,
  saturated:snap.docs.length>=MAX_SAMPLE,
  markets:[...markets.values()].sort((a,b)=>a.marketId.localeCompare(b.marketId)),
  paidConversion:false,automaticPricing:false,representative:false};
}
module.exports={recordView,markBooking,recentReport,COLLECTION,MAX_SAMPLE};