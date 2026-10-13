'use strict';
// A recorded view is research, never proof of payment and never fare authority.
const C='pricing_quote_views',SAMPLE=120,MAX_AGE=1800000;
const {verify,enabled}=require('./quote-view-contract');
async function record({db,uid,token,now=Date.now(),env=process.env}){
 const v=verify(token,{uid,now,env});
 if(!v)return {ok:false,code:'invalid_view'};
 if(!db)return {ok:false,code:'research_unavailable'};
 try {
  await db.collection(C).doc(v.id).create({
   marketId:v.marketId,distanceBand:v.distanceBand,totalCents:v.totalCents,
   viewedAt:new Date(now),expiresAt:new Date(now+7*86400000),preparedRideId:null,
  });
  return {ok:true,duplicate:false};
 }catch(e){
  if(e?.code===6||e?.code==='already-exists'||e?.code==='ALREADY_EXISTS'||
   /already exists/i.test(String(e?.message||'')))return {ok:true,duplicate:true};
  throw e;
 }
}
async function link({tx,db,view,rideId,now=Date.now()}){
 if(!view)return false;
 const ref=db.collection(C).doc(view.id),snap=await tx.get(ref);
 if(!snap.exists)return false;
 const d=snap.data()||{},at=d.viewedAt?.toMillis?.()??d.viewedAt?.getTime?.(),
  expires=d.expiresAt?.toMillis?.()??d.expiresAt?.getTime?.();
 if(!Number.isFinite(at)||at>now||now-at>MAX_AGE||
   !Number.isFinite(expires)||expires<=now||
   (d.marketId!==view.marketId||d.distanceBand!==view.distanceBand||d.totalCents!==view.totalCents)||
   (d.preparedRideId&&d.preparedRideId!==rideId))return false;
 if(!d.preparedRideId)tx.update(ref,{preparedRideId:rideId,preparedAt:new Date(now)});
 return true;
}
async function report({db,now=Date.now(),env=process.env}){
 if(!enabled(env))return {enabled:false};
 if(!db)return {enabled:true,available:false};
 const snap=await db.collection(C).where('viewedAt','>=',new Date(now-86400000))
  .orderBy('viewedAt','desc').limit(SAMPLE).get();
 let counted=0,prepared=0;const groups=new Map();
 for(const row of snap.docs){
  const d=row.data(),at=d.viewedAt?.toMillis?.()??d.viewedAt?.getTime?.();
  if(!Number.isFinite(at)||at>now-3600000||!/^[-a-z0-9]{3,90}$/.test(String(d.marketId)))continue;
  counted++;
  if(!groups.has(d.marketId))groups.set(d.marketId,{marketId:d.marketId,views:0,prepared:0});
  const g=groups.get(d.marketId);g.views++;
  if(typeof d.preparedRideId==='string'&&/^[a-f0-9]{40}$/.test(d.preparedRideId)){prepared++;g.prepared++;}
 }
 return {enabled:true,available:true,counted,prepared,
  incomplete:snap.docs.length===SAMPLE,groups:[...groups.values()],
  paidConversion:false,priceChangeAuthorized:false};
}
module.exports={record,link,report,C,SAMPLE};
