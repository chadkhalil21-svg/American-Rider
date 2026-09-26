// American Rider Family / Teen Travel — server-authoritative relationship and Travel policy.
const crypto = require('node:crypto');
const { adminDb, adminStatus } = require('./firebase-admin');

const COLLECTION='family_links';
const MIN_AGE=13, MAX_AGE=17;
const clean=(v,n=80)=>String(v||'').trim().replace(/\s+/g,' ').slice(0,n);
const code=()=>crypto.randomBytes(32).toString('hex');
const tokenHash=(v)=>crypto.createHash('sha256').update(String(v||'')).digest('hex');
const INVITE_TTL_MS=7*24*60*60*1000;

function ageOn(dob, now=Date.now()){
  const d=new Date(String(dob||'')+'T00:00:00Z'); if(!Number.isFinite(d.getTime())) return null;
  const n=new Date(now); let a=n.getUTCFullYear()-d.getUTCFullYear();
  if(n.getUTCMonth()<d.getUTCMonth() || (n.getUTCMonth()===d.getUTCMonth()&&n.getUTCDate()<d.getUTCDate())) a--;
  return a;
}
async function createFamilyInvite({guardianUid,guardianName,teenName,teenEmail,teenDob,now=Date.now()}){
 const db=adminDb(); if(!db)return {ok:false,reason:adminStatus().reason};
 const age=ageOn(teenDob,now); if(age===null||age<MIN_AGE||age>MAX_AGE)return {ok:false,reason:'Teen Traveler must be 13–17.'};
 const ref=db.collection(COLLECTION).doc();
 const inviteToken=code();
 await ref.set({guardianUid:String(guardianUid),guardianName:clean(guardianName),teenUid:null,teenName:clean(teenName),teenEmail:clean(teenEmail,160).toLowerCase(),teenDob:String(teenDob),status:'invited',inviteTokenHash:tokenHash(inviteToken),inviteExpiresAt:now+INVITE_TTL_MS,createdAt:now,updatedAt:now,revokedAt:null});
 return {ok:true,id:ref.id,inviteToken};
}
async function acceptFamilyInvite({id,inviteToken,teenUid,teenEmail,emailVerified=false,now=Date.now()}){
 const db=adminDb(); if(!db)return {ok:false,reason:adminStatus().reason};
 const ref=db.collection(COLLECTION).doc(String(id));
 return db.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists)return {ok:false,reason:'invite not found'};const x=s.data()||{};
  if(x.status!=='invited'||x.inviteTokenHash!==tokenHash(inviteToken)||!teenUid||Number(x.inviteExpiresAt||0)<now)return {ok:false,reason:'invite invalid'};
  if(!emailVerified||!teenEmail||String(x.teenEmail||'').toLowerCase()!==String(teenEmail).trim().toLowerCase())return {ok:false,reason:'Invite must be accepted by the verified Teen account it was addressed to.'};
  if(String(x.guardianUid)===String(teenUid))return {ok:false,reason:'Guardian and Teen accounts must be different.'};
  if((ageOn(x.teenDob,now)||0)<MIN_AGE||(ageOn(x.teenDob,now)||99)>MAX_AGE)return {ok:false,reason:'Teen Traveler is not eligible.'};
  tx.set(ref,{teenUid:String(teenUid),status:'active',inviteTokenHash:null,inviteExpiresAt:null,acceptedAt:now,updatedAt:now},{merge:true});return {ok:true,id:ref.id};
 });
}
async function revokeFamilyLink({id,guardianUid,now=Date.now()}){
 const db=adminDb();if(!db)return {ok:false,reason:adminStatus().reason};const ref=db.collection(COLLECTION).doc(String(id));const s=await ref.get();if(!s.exists||String(s.data()?.guardianUid)!==String(guardianUid))return {ok:false,reason:'not authorized'};
 await ref.set({status:'revoked',revokedAt:now,updatedAt:now},{merge:true});
 // Revocation governs future Teen Travel. A Teen already onboard is never stranded by
 // administrative relationship changes; underway Travels retain their existing safety envelope.
 const q=await db.collection('scheduled_rides').where('status','==','reserved').get();
 let cancelledScheduledTravels=0;
 for(const d of q.docs){const r=d.data()||{};if(r.party?.teen===true&&String(r.party?.familyLinkId)===String(id)){
   await d.ref.set({status:'cancelled',cancelledAt:now,closedReason:'Family authorization revoked.'},{merge:true});
   cancelledScheduledTravels++;
 }}
 return {ok:true,cancelledScheduledTravels};
}
async function listFamilyLinks({uid,now=Date.now()}){const db=adminDb();if(!db)return {ok:false,reason:adminStatus().reason};const [g,t]=await Promise.all([db.collection(COLLECTION).where('guardianUid','==',String(uid)).get(),db.collection(COLLECTION).where('teenUid','==',String(uid)).get()]);const seen=new Map();for(const d of [...g.docs,...t.docs]){const x={id:d.id,...d.data()};seen.set(d.id,{id:d.id,status:x.status,role:String(x.guardianUid)===String(uid)?'guardian':'teen',guardianName:x.guardianName,teenName:x.teenName,eligible:x.status==='active'&&ageOn(x.teenDob,now)>=MIN_AGE&&ageOn(x.teenDob,now)<=MAX_AGE,inviteExpiresAt:x.status==='invited'?x.inviteExpiresAt:null});}return {ok:true,links:[...seen.values()]};}
async function activeFamilyLink({id,guardianUid=null,teenUid=null,now=Date.now()}){
 const db=adminDb();if(!db)return null;const s=await db.collection(COLLECTION).doc(String(id)).get();if(!s.exists)return null;const x={id:s.id,...s.data()};
 if(x.status!=='active'||ageOn(x.teenDob,now)<MIN_AGE||ageOn(x.teenDob,now)>MAX_AGE)return null;
 if(guardianUid&&String(x.guardianUid)!==String(guardianUid))return null;if(teenUid&&String(x.teenUid)!==String(teenUid))return null;return x;
}
async function normalizeTeenParty({familyLinkId,requesterUid,bookerUid,journeyNo=null,now=Date.now()}){
 const requester=String(requesterUid), db=adminDb();
 // Smart Travel is one journey with two car legs. Once leg 1 has completed, leg 2 inherits
 // the exact server-stamped Family party from leg 1. A guardian revocation or eighteenth
 // birthday blocks NEW Teen Travel, but cannot strand a Teen at a transit interchange in a
 // journey American Rider has already undertaken to complete.
 if(journeyNo&&db){
  const q=await db.collection('rides').where('travelerUid','==',requester).where('tripNo','==',String(journeyNo).slice(0,24)).limit(1).get();
  const first=q.docs[0]?.data();
  if(first&&first.status==='completed'&&first.paymentIntentId&&first.party?.teen===true&&!first.journeyNo&&String(first.party.familyLinkId)===String(familyLinkId)){
   const p=first.party;
   if(requester===String(p.guardianUid)||requester===String(p.teenUid))return {ok:true,party:{...p,continuedFromJourneyNo:String(journeyNo)}};
  }
 }
 const link=await activeFamilyLink({id:familyLinkId,now});if(!link)return {ok:false,code:'family_authorization_required',error:'An active Family authorization is required.'};
 const guardian=String(link.guardianUid), teen=String(link.teenUid);
 if(requester!==guardian&&requester!==teen)return {ok:false,code:'family_authorization_required',error:'This Family authorization does not belong to this account.'};
 if(String(bookerUid)!==guardian&&String(bookerUid)!==teen)return {ok:false,code:'family_authorization_required',error:'Invalid Family Booker.'};
 return {ok:true,party:{mode:'teen',travelerName:link.teenName,bookerName:link.guardianName,bookedForAnother:requester===guardian,teen:true,familyLinkId:link.id,guardianUid:guardian,teenUid:teen,guardianName:link.guardianName,pinRequired:true,guardianTracking:true,guardianMessaging:true}};
}


async function listGuardianActiveTravels({guardianUid}){
 const db=adminDb();if(!db)return {ok:false,reason:adminStatus().reason};
 const links=await db.collection(COLLECTION).where('guardianUid','==',String(guardianUid)).get();const teenUids=new Set();
 for(const d of links.docs){const x=d.data()||{};if(x.teenUid)teenUids.add(String(x.teenUid));}
 const active=[];
 for(const teenUid of teenUids){const q=await db.collection('rides').where('travelerUid','==',teenUid).get();for(const d of q.docs){const r=d.data()||{};if(r.party?.teen===true&&String(r.party?.guardianUid)===String(guardianUid)&&['assigned','accepted','arrived','onboard'].includes(String(r.status)))active.push({id:d.id,tripNo:r.tripNo||d.id,status:r.status,travelerName:r.party?.travelerName||'Teen Traveler',operatorName:r.operatorName||'',operatorId:r.operatorId||'',travelerUid:r.travelerUid||teenUid,dep:r.dep||'',dest:r.dest||'',createdAt:Number(r.createdAt)||0});}}
 active.sort((a,b)=>b.createdAt-a.createdAt);return {ok:true,travels:active};
}
async function sweepFamilyAgeOut({now=Date.now()}={}){
 const db=adminDb();if(!db)return {ok:false,reason:adminStatus().reason};
 const q=await db.collection(COLLECTION).where('status','==','active').get();let agedOut=0,cancelledScheduledTravels=0;
 for(const d of q.docs){const x=d.data()||{},age=ageOn(x.teenDob,now);if(age!==null&&age>=MIN_AGE&&age<=MAX_AGE)continue;
  await d.ref.set({status:'aged_out',agedOutAt:now,updatedAt:now},{merge:true});agedOut++;
  const reserved=await db.collection('scheduled_rides').where('status','==','reserved').get();
  for(const r of reserved.docs){const v=r.data()||{};if(v.party?.teen===true&&String(v.party?.familyLinkId)===String(d.id)){await r.ref.set({status:'cancelled',cancelledAt:now,closedReason:'Teen Traveler is no longer age-eligible.'},{merge:true});cancelledScheduledTravels++;}}
 }
 return {ok:true,agedOut,cancelledScheduledTravels};
}
function operatorTeenView(p={}){return p.teen===true?{travelerName:clean(p.travelerName),bookedForAnother:p.bookedForAnother===true,teen:true,guardianName:clean(p.guardianName),pinRequired:true}:{travelerName:clean(p.travelerName||'Traveler'),bookedForAnother:p.bookedForAnother===true,teen:false};}
module.exports={COLLECTION,MIN_AGE,MAX_AGE,ageOn,createFamilyInvite,acceptFamilyInvite,revokeFamilyLink,listFamilyLinks,activeFamilyLink,normalizeTeenParty,listGuardianActiveTravels,sweepFamilyAgeOut,operatorTeenView};
