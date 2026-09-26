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
async function acceptFamilyInvite({id,inviteToken,teenUid,now=Date.now()}){
 const db=adminDb(); if(!db)return {ok:false,reason:adminStatus().reason};
 const ref=db.collection(COLLECTION).doc(String(id));
 return db.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists)return {ok:false,reason:'invite not found'};const x=s.data()||{};
  if(x.status!=='invited'||x.inviteTokenHash!==tokenHash(inviteToken)||!teenUid||Number(x.inviteExpiresAt||0)<now)return {ok:false,reason:'invite invalid'};
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
async function activeFamilyLink({id,guardianUid=null,teenUid=null,now=Date.now()}){
 const db=adminDb();if(!db)return null;const s=await db.collection(COLLECTION).doc(String(id)).get();if(!s.exists)return null;const x={id:s.id,...s.data()};
 if(x.status!=='active'||ageOn(x.teenDob,now)<MIN_AGE||ageOn(x.teenDob,now)>MAX_AGE)return null;
 if(guardianUid&&String(x.guardianUid)!==String(guardianUid))return null;if(teenUid&&String(x.teenUid)!==String(teenUid))return null;return x;
}
async function normalizeTeenParty({familyLinkId,requesterUid,bookerUid,now=Date.now()}){
 const link=await activeFamilyLink({id:familyLinkId,now});if(!link)return {ok:false,code:'family_authorization_required',error:'An active Family authorization is required.'};
 const requester=String(requesterUid), guardian=String(link.guardianUid), teen=String(link.teenUid);
 if(requester!==guardian&&requester!==teen)return {ok:false,code:'family_authorization_required',error:'This Family authorization does not belong to this account.'};
 if(String(bookerUid)!==guardian&&String(bookerUid)!==teen)return {ok:false,code:'family_authorization_required',error:'Invalid Family Booker.'};
 return {ok:true,party:{mode:'teen',travelerName:link.teenName,bookerName:link.guardianName,bookedForAnother:requester===guardian,teen:true,familyLinkId:link.id,guardianUid:guardian,teenUid:teen,guardianName:link.guardianName,pinRequired:true,guardianTracking:true,guardianMessaging:true}};
}
function operatorTeenView(p={}){return p.teen===true?{travelerName:clean(p.travelerName),bookedForAnother:p.bookedForAnother===true,teen:true,guardianName:clean(p.guardianName),pinRequired:true}:{travelerName:clean(p.travelerName||'Traveler'),bookedForAnother:p.bookedForAnother===true,teen:false};}
module.exports={COLLECTION,MIN_AGE,MAX_AGE,ageOn,createFamilyInvite,acceptFamilyInvite,revokeFamilyLink,activeFamilyLink,normalizeTeenParty,operatorTeenView};
