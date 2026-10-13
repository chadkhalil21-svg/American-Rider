'use strict';
// A recorded view is research, never proof of payment and never fare authority.
const C='pricing_quote_views',SAMPLE=120,MAX_AGE=1800000;
const {verify,enabled}=require('./quote-view-contract');
const {createHash}=require('node:crypto');
const ERASE_PAGE=25;
// The Firebase UID is never persisted in research, yet withdrawals remain queryable.
// This stable per-feature pseudonym MUST be treated as personal, linkable information.
const ownerKey=uid=>createHash('sha256').update('ar-price-view-owner-v1:'+String(uid)).digest('hex');
async function record({db,uid,token,consentToResearch=false,consentVersion=null,now=Date.now(),env=process.env}){
 if(consentToResearch!==true||consentVersion!=='quote-study-v1')return {ok:false,code:'research_consent_required'};
 const v=verify(token,{uid,now,env});
 if(!v)return {ok:false,code:'invalid_view'};
 if(!db)return {ok:false,code:'research_unavailable'};
 const ref=db.collection(C).doc(v.id),owner=ownerKey(uid);
 const data={consentVersion:'quote-study-v1',consentedAt:new Date(now),ownerKey:owner,marketId:v.marketId,distanceBand:v.distanceBand,
  totalCents:v.totalCents,viewedAt:new Date(now),
  expiresAt:new Date(now+7*86400000),preparedRideId:null};
 // Share the account-closure fence's transaction ordering with real bookings:
 // no research record can be added after closure has begun.
 try{
  return await db.runTransaction(async(tx)=>{
   const closure=await tx.get(db.collection('account_closures').doc(String(uid)));
   if(closure.exists&&closure.data()?.closingAt)return {ok:false,code:'account_closing'};
   tx.create(ref,data);
   return {ok:true,duplicate:false};
  });
 }catch(e){
  if(e?.code!==6&&e?.code!=='already-exists'&&e?.code!=='ALREADY_EXISTS'&&
   !/already exists/i.test(String(e?.message||'')))throw e;
  // A duplicate ID is not proof of equivalence. Verify ownership and monetary
  // facts before acknowledging a replay, including after an account closure.
  const prior=await ref.get();
  const p=prior.exists?prior.data():null;
  if(!p||p.ownerKey!==owner||p.marketId!==v.marketId||
    p.distanceBand!==v.distanceBand||p.totalCents!==v.totalCents)
   return {ok:false,code:'quote_view_conflict'};
  return {ok:true,duplicate:true};
 }
}
async function purgeForAccount({db,uid}){
 if(!db||!uid)throw Error('research_cleanup_unavailable');
 const snap=await db.collection(C).where('ownerKey','==',ownerKey(uid)).limit(ERASE_PAGE).get();
 const docs=snap.docs||[];
 for(const doc of docs)await doc.ref.delete();
 // A full page is intentionally treated as unfinished; the next durable
 // sweep verifies zero remaining before the closure fence may disappear.
 return {complete:docs.length<ERASE_PAGE,erased:docs.length};
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
 // Query only mature views: thousands of very recent quotes must not hide
 // yesterday's eligible results behind the 120-row safety limit.
 const snap=await db.collection(C).where('viewedAt','>=',new Date(now-86400000))
  .where('viewedAt','<=',new Date(now-3600000))
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
// Isolated and best-effort AFTER the authoritative booking commit.
async function linkAfterBooking({db,view,rideId,now=Date.now()}){
 if(!db||!view)return false;
 return db.runTransaction(tx=>link({tx,db,view,rideId,now}));
}
module.exports={record,link,linkAfterBooking,report,purgeForAccount,ownerKey,C,SAMPLE,ERASE_PAGE};
