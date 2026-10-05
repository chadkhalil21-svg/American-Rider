const PAGE_SIZE=40;
const CASE_ID=/^AR-C-[A-Za-z0-9-]{1,48}$/;
async function listOpsCases({db,kind='emergency',after=''}) {
 if(!db)throw new Error('Firestore unavailable');
 if(!['emergency','support'].includes(kind))throw new Error('Unsupported case queue');
 if(after&&!CASE_ID.test(String(after)))throw new Error('Invalid case cursor');
 let q=db.collection('support_tickets').where('status','==','open').where('kind','==',kind)
   .orderBy('createdAt','asc').orderBy('__name__','asc');
 if(after){const snap=await db.collection('support_tickets').doc(String(after)).get();
   if(!snap.exists)throw new Error('Case cursor no longer exists');
   q=q.startAfter(snap);
 }
 const snap=await q.limit(PAGE_SIZE+1).get();
 const docs=snap.docs.slice(0,PAGE_SIZE);
 return {cases:docs.map((d)=>({id:d.id,...d.data()})),next:snap.docs.length>PAGE_SIZE?docs.at(-1).id:null};
}
async function actOnCase({db,caseNo,action,actor,note,now=Date.now()}) {
 if(!db||!CASE_ID.test(String(caseNo||'')))return {ok:false,code:'invalid_case'};
 if(!actor||!/^[A-Za-z0-9_-]{1,40}$/.test(String(actor)))return {ok:false,code:'named_ops_required'};
 if(!['acknowledge','close'].includes(action))return {ok:false,code:'invalid_action'};
 const text=String(note||'').trim();
 if(text.length<12||text.length>500)return {ok:false,code:'note_required'};
 return db.runTransaction(async(tx)=>{
   const ref=db.collection('support_tickets').doc(String(caseNo));
   const snap=await tx.get(ref);
   if(!snap.exists)return {ok:false,code:'case_not_found'};
   const rec=snap.data();
   if(rec.status!=='open')return {ok:false,code:'case_not_open'};
   if(action==='acknowledge'&&rec.acknowledgedAt)return {ok:true,unchanged:true};
   if(action==='close'&&!rec.acknowledgedAt)return {ok:false,code:'acknowledgement_required'};
   const patch=action==='acknowledge'?
     {acknowledgedAt:now,acknowledgedBy:String(actor),acknowledgementNote:text}:
     {status:'closed',closedAt:now,closedBy:String(actor),closeNote:text};
   const audit=db.collection('audit_log').doc();
   tx.update(ref,patch);
   tx.create(audit,{at:now,actor:String(actor),subject:String(caseNo),action:`case_${action}`,
     caseKind:String(rec.kind||''),note:text});
   return {ok:true,action,caseNo};
 });
}
module.exports={PAGE_SIZE,CASE_ID,listOpsCases,actOnCase};
