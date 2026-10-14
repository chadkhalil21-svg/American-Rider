'use strict';
// Founder-facing explanation only. Actual legal and commercial authority is
// enforced by market-readiness.js. These headings are not four new approvals.
const GROUPS=Object.freeze([
  Object.freeze({id:'insurance',label:'Insurance and operating authority',issues:Object.freeze([
    'jurisdiction_authority','company_insurance_bound','operator_insurance_process','disclosure_and_retention',
  ])}),
  Object.freeze({id:'operators',label:'Qualified Operators and screening',issues:Object.freeze([
    'screening_agreement','qualified_operator_supply','provider:screening_provider',
  ])}),
  Object.freeze({id:'travel',label:'Travel and payments',issues:Object.freeze([
    'pricing_and_taxes','routing_and_toll_rights','payment_and_reconciliation','provider_contracts',
  ])}),
  Object.freeze({id:'safety',label:'Safety and release readiness',issues:Object.freeze([
    'safety_coverage','accessible_service','backup_restore_drill','device_and_release_tests',
  ])}),
]);
const INDEX=new Map(GROUPS.flatMap(g=>g.issues.map(x=>[x,g.id])));
function conciseMarketIssues(missing=[]){
  const byId=new Map();
  for(const m of missing){
    if(!m || typeof m.id!=='string') continue;
    const prior=byId.get(m.id);
    // Preserve the most actionable non-absent problem if input covers counties
    // with different evidence states. Do not confuse "unrecorded" with "failed".
    if(!prior || (prior.code==='record_absent' && m.code!=='record_absent'))
      byId.set(m.id,{id:m.id,code:typeof m.code==='string'?m.code:'unverified'});
  }
  const grouped=new Map();
  for(const m of byId.values()){
    const group=INDEX.get(m.id)||'other';
    if(!grouped.has(group))grouped.set(group,[]);
    grouped.get(group).push(m);
  }
  return [...GROUPS,{id:'other',label:'Other configuration issues'}]
    .filter(g=>grouped.has(g.id)).map(g=>{
      const issues=grouped.get(g.id);
      const absent=issues.filter(x=>x.code==='record_absent').length;
      const provider=issues.filter(x=>x.code==='production_verification_missing').length;
      const existing=issues.length-absent-provider;
      return {id:g.id,label:g.label,items:issues.length,unrecorded:absent,
        unverifiedProvider:provider,needsReview:existing,
        message:absent===issues.length
          ? 'Approval records have not been filed here; prior work may still be valid.'
          : provider===issues.length
            ? 'Live production verification has not been confirmed.'
            : 'Check previously completed work and the current evidence records.',
      };
    });
}
module.exports={GROUPS,conciseMarketIssues};
