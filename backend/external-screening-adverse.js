'use strict';
// A provider-neutral, manual FCRA adverse-action evidence ledger.
// This does NOT send a consumer report, notices, rights sheet, or final rejection.
// Staff must independently deliver required documents through an approved secure
// channel and attest to that evidence before moving any state forward.
// No report particulars, SSNs, dates of birth, or findings are stored here.
const HOLD_MS = 7 * 24 * 60 * 60 * 1000; // Conservative internal minimum; NOT a statutory FCRA waiting period.
const MAX_REPORT_AGE_MS = 3 * 365 * 24 * 60 * 60 * 1000;
const ACTIONS = new Set(['propose','record_pre_notice','dispute','withdraw','finalize']);
const REASONS = new Set(['criminal_history','sex_offender_match','driver_license','moving_violations','other_statutory']);
const validRef = x => /^[A-Za-z0-9][A-Za-z0-9._:/-]{5,119}$/.test(String(x||'').trim());
const str = (x,max=400)=>String(x||'').trim().slice(0,max);
function validateTransition(input,now=Date.now()) {
  const action=str(input.action,30),uid=str(input.uid,140),caseNo=str(input.caseNo,80),
    note=str(input.note,400),reference=str(input.reference,120);
  if (!ACTIONS.has(action)) return {ok:false,status:400,error:'Unknown screening adjudication action.'};
  if(!uid||!/^AR-C-[A-Za-z0-9-]{1,48}$/.test(caseNo))return {ok:false,status:400,error:'Valid Operator and case required.'};
  if(note.length<12)return {ok:false,status:400,error:'A substantive non-sensitive review note is required.'};
  if(['propose','record_pre_notice','finalize'].includes(action)&&!validRef(reference))
    return {ok:false,status:400,error:'A verified agency or delivered-notice evidence reference is required.'};
  if(action==='propose'){
    const reportDate=str(input.reportIssuedOn,20);
    const issuedMs=Date.parse(reportDate+'T12:00:00Z');
    if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(reportDate)||
       !Number.isFinite(issuedMs)||new Date(issuedMs).toISOString().slice(0,10)!==reportDate||
       issuedMs>now||now-issuedMs>=MAX_REPORT_AGE_MS)
      return {ok:false,status:400,error:'The verified CRA report must have a valid date within the statutory check interval.'};
  }
  if(action==='propose'&&(!REASONS.has(input.reasonCode)||input.agencyAuthenticated!=='yes'||
      input.reportMatchesOperator!=='yes'||input.permittedPurpose!=='yes'||input.disqualifierConfirmed!=='yes'))
    return {ok:false,status:400,error:'Verify authoritative CRA source, report owner, lawful purpose and statute-based disqualification.'};
  if(action==='record_pre_notice'&&(input.reportCopyProvided!=='yes'||
      input.rightsSummaryProvided!=='yes'||input.deliveryConfirmed!=='yes'))
    return {ok:false,status:400,error:'Confirm actual delivery of the consumer report, FCRA rights and pre-adverse notice.'};
  if(action==='finalize'&&(input.finalNoticeDelivered!=='yes'||input.providerFindingsRechecked!=='yes'||
     input.noOpenDispute!=='yes'))
    return {ok:false,status:400,error:'Final notice delivery, unchanged CRA evidence and absence of open disputes must be independently confirmed.'};
  if(!Number.isSafeInteger(now)||now<=0)return {ok:false,status:400,error:'Invalid review timestamp.'};
  return {ok:true,action,uid,caseNo,reference,note,reasonCode:input.reasonCode||null};
}
async function recordAdverseReview({db,input,actor,now=Date.now()}) {
  if(!db||!/^[A-Za-z0-9_-]{1,40}$/.test(String(actor?.name||'')))
    return {ok:false,status:401,error:'Named Operations authentication required.'};
  const v=validateTransition(input,now);
  if(!v.ok)return v;
  const {uid,caseNo,action,note,reference,reasonCode}=v;
  const uref=db.collection('users').doc(uid),cref=db.collection('support_tickets').doc(caseNo),
    fref=db.collection('operators').doc(uid),aref=db.collection('audit_log').doc();
  return db.runTransaction(async tx=>{
    const [us,cs,fs]=await Promise.all([tx.get(uref),tx.get(cref),tx.get(fref)]);
    if(!us.exists||!cs.exists)return {ok:false,status:404,error:'Operator or screening review case not found.'};
    const u=us.data()||{},caseData=cs.data()||{},screen=u.screening||{},a=screen.adverseAction||{};
    if(screen.transferCaseNo!==caseNo||caseData.uid!==uid||caseData.status!=='open'||
      caseData.kind!=='support'||!/^Operator screening — review (existing|new) provider report$/.test(caseData.reason||'')||
      !screen.consentAt)
      return {ok:false,status:409,error:'The case is not a current, authorized screening review.'};
    let decision=screen.decision,stage=a.stage||null,changed=null,closed=false;
    // An independent CRA contact and authenticated receipt must precede both
    // positive and potentially adverse screening decisions. Staff checkboxes
    // alone must not create a disqualifying report or final decision.
    const handoff=caseData.screeningHandoff||{},authenticated=handoff.authenticatedReport||{};
    // Every adverse-action transition must be attributable to the same assigned
    // reviewer. A change of staff requires a separate audited reassignment.
    if(handoff.owner!==actor.name)
      return {ok:false,status:409,error:'This adverse-review case is assigned to a different reviewer or has no verified owner.'};
    if(action==='propose' && (handoff.stage!=='report_authenticated' ||
        handoff.owner!==actor.name || authenticated.by!==actor.name ||
        !authenticated.verifiedAt || authenticated.reference!==reference ||
        String(authenticated.agency||'').toLowerCase()!==String(screen.provider||'').toLowerCase()))
      return {ok:false,status:409,error:'Independently verify agency contact and matching report receipt before proposing adverse action.'};
    if(['record_pre_notice','finalize'].includes(action) &&
        (handoff.stage!=='report_authenticated' ||
         authenticated.reference!==a.reportReference || !authenticated.verifiedAt))
      return {ok:false,status:409,error:'Adverse review lacks a still-authenticated, matching agency report.'};
    if(action==='propose') {
      if(!['awaiting_agency','review'].includes(decision)||(stage&&stage!=='withdrawn'))
        return {ok:false,status:409,error:'Only an unresolved current agency report may start adverse consideration.'};
      decision='pre_adverse';stage='proposed';
      changed={stage,reasonCode,reportReference:reference,reportIssuedOn:input.reportIssuedOn,
        proposedAt:now,proposedBy:actor.name};
    } else if(action==='record_pre_notice') {
      if(decision!=='pre_adverse'||stage!=='proposed')
        return {ok:false,status:409,error:'Prepare the screening decision before recording pre-adverse notice delivery.'};
      stage='pre_notice_sent';
      changed={...a,stage,preNoticeSentAt:now,preNoticeReference:reference,preNoticeBy:actor.name};
    } else if(action==='dispute'){
      if(decision!=='pre_adverse'||!['proposed','pre_notice_sent'].includes(stage))
        return {ok:false,status:409,error:'Only a pending adverse review may be disputed.'};
      stage='disputed';changed={...a,stage,disputedAt:now,disputedBy:actor.name};
    } else if(action==='withdraw'){
      if(decision!=='pre_adverse'||!['proposed','pre_notice_sent','disputed'].includes(stage))
        return {ok:false,status:409,error:'Only a pending adverse consideration may be withdrawn.'};
      decision='review';stage='withdrawn';changed={...a,stage,withdrawnAt:now,withdrawnBy:actor.name};
    } else if(action==='finalize') {
      if(decision!=='pre_adverse'||stage!=='pre_notice_sent'||!Number.isSafeInteger(a.preNoticeSentAt)||
         now-a.preNoticeSentAt<HOLD_MS)
        return {ok:false,status:409,error:'Notice must be independently delivered, the internal review interval elapsed and disputes resolved first.'};
      decision='refuse';stage='finalized';closed=true;
      changed={...a,stage,finalNoticeSentAt:now,finalNoticeReference:reference,finalizedAt:now,finalizedBy:actor.name};
    }
    tx.set(uref,{screening:{
      decision,proposedDecision:decision==='pre_adverse'?'refuse':null,
      summary:decision==='refuse'?'Screening eligibility review finalized; contact Patron Support to request information and dispute records.'
        :decision==='pre_adverse'?'A screening decision is under review. You may request your report and dispute inaccurate information.'
        :'Background screening remains on hold pending verified clarification.',
      adverseAction:changed,
      ...(closed?{finalizedAt:now}:{finalizedAt:null})
    }},{merge:true});
    if(fs.exists)tx.set(fref,{available:false,commissioned:false,screeningBlocked:true,
      screeningCheckedAt:null,screeningReason:'Background screening is not cleared.',
      offDutyReason:'screening_adverse_review',offDutyAt:now},{merge:true});
    if(closed)tx.set(cref,{status:'closed',closedAt:now,closedBy:actor.name,
      closeNote:'Final adverse decision verified with separate provider/notice references in restricted audit.'},{merge:true});
    else tx.set(cref,{acknowledgedAt:now,acknowledgedBy:actor.name,
      acknowledgementNote:'Screening adverse review: '+stage,
      // A dispute or withdrawn proposal invalidates the old report as
      // clearance/adverse-action authority. Recontact CRA and authenticate a
      // corrected report before any new adjudication can proceed.
      ...(['dispute','withdraw'].includes(action) ? {screeningHandoff:{
        ...handoff, stage:action==='dispute'?'dispute_open':'clarification_needed',
        authenticatedReport:null,updatedAt:now,owner:handoff.owner||actor.name}} : {})
    },{merge:true});
    tx.set(aref,{at:now,subject:uid,actor:{name:actor.name},action:'screening_adverse_'+action,
      caseNo,stage,reference:reference||null,reasonCode:action==='propose'?reasonCode:null,note});
    return {ok:true,decision,stage,caseNo};
  });
}
module.exports={HOLD_MS,validateTransition,recordAdverseReview};
