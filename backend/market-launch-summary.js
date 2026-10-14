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
// Report ONE next step per evidence SOURCE, not 15 purported founder sign-offs.
// No item here is permission or a replacement for source-authenticated proofs.
const RESOLUTION_STREAMS=Object.freeze([
  Object.freeze({
    id:'reconcile',label:'Reconcile work already developed',
    ids:Object.freeze([
      'jurisdiction_authority','operator_insurance_process','disclosure_and_retention',
      'pricing_and_taxes','routing_and_toll_rights',
    ]),
    next:'Review the existing Florida configuration, signed documents and operational records once. Reuse an independently reviewed reference across all three counties only if it truly applies to each.',
  }),
  Object.freeze({
    id:'external',label:'Confirm real third-party arrangements',
    ids:Object.freeze([
      'company_insurance_bound','screening_agreement','provider:screening_provider',
      'provider_contracts','qualified_operator_supply',
    ]),
    next:'Match existing insurer, agency, provider and qualified Operator records to real counterparties. Do not use test fixtures, founder assent or code as proof of an outside party.',
  }),
  Object.freeze({
    id:'realworld',label:'Verify actual service and recovery',
    ids:Object.freeze([
      'payment_and_reconciliation','safety_coverage','accessible_service',
      'backup_restore_drill','device_and_release_tests',
    ]),
    next:'Reconcile controlled live-money, incident coverage, accessible service, restored backup and real-device evidence. CI green builds alone do not demonstrate these outcomes.',
  }),
]);
const RESOLUTION_INDEX=new Map(RESOLUTION_STREAMS.flatMap(g=>g.ids.map(id=>[id,g.id])));
function founderResolutionPlan(missing=[]){
  const unique=new Map();
  for(const m of missing){
    if(!m||typeof m.id!=='string')continue;
    const previous=unique.get(m.id);
    if(!previous || (previous.code==='record_absent' && m.code!=='record_absent'))
      unique.set(m.id,{id:m.id,code:m.code||'unverified'});
  }
  const planned=new Map();
  for(const v of unique.values()){
    const key=RESOLUTION_INDEX.get(v.id)||'other';
    if(!planned.has(key))planned.set(key,[]);
    planned.get(key).push(v);
  }
  return [
    ...RESOLUTION_STREAMS.map(stream=>({
      id:stream.id,label:stream.label,next:stream.next,
      records:planned.get(stream.id)||[],
    })),
    {id:'other',label:'Check jurisdiction or platform configuration',
      next:'Identify the actual source of any unmatched issue before changing admission rules.',
      records:planned.get('other')||[]},
  ].filter(stream=>stream.records.length).map(stream=>({
    id:stream.id,label:stream.label,next:stream.next,
    items:stream.records.length,
    unrecorded:stream.records.filter(x=>x.code==='record_absent').length,
    needsIndependentCheck:stream.records.some(x=>x.code==='production_verification_missing'),
    codes:[...new Set(stream.records.map(x=>x.code))].sort(),
  }));
}
module.exports={GROUPS,conciseMarketIssues,RESOLUTION_STREAMS,founderResolutionPlan};
