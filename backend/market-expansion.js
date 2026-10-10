'use strict';
// National market EXPANSION planning. A proposal is never geographic activation,
// market admission, Operator onboarding, screening eligibility or travel authority.
// Reuse the Census boundary catalogue and jurisdiction registry; no paid API.
const { createHash } = require('node:crypto');
const US = require('./jurisdictions/us.json');
const { markets } = require('./markets');

const PLAN_COLLECTION = 'market_expansion_plans';
const STATES = Object.freeze(US.jurisdictions.map(j => Object.freeze({
  code: j.code, name: j.name, status: j.status,
})).sort((a,b) => a.name.localeCompare(b.name)));
const sl = s => String(s || '').trim();
const safeText = (s, n) => sl(s).slice(0,n);
function catalog() {
  return { jurisdictions: STATES, counties: markets().map(m => ({
    id:m.id, name:m.name, state:m.state, fips:m.fips, configured:!!m.regionId,
  })).sort((a,b) => a.state.localeCompare(b.state)||a.name.localeCompare(b.name)) };
}
function validateProposal(input, catalogue=catalog()) {
  const stateCode = sl(input?.stateCode);
  if (!STATES.some(j => j.code === stateCode))
    return { ok:false, code:'unknown_jurisdiction', error:'Choose a U.S. jurisdiction from the verified registry.' };
  const marketId = sl(input?.marketId);
  const county = marketId ? catalogue.counties.find(m => m.id === marketId && m.state === stateCode) : null;
  if (marketId && !county)
    return { ok:false, code:'county_not_in_catalog', error:'That county has not been imported for the selected state. Propose the state first; its official county boundaries must be imported before commissioning.' };
  const city = sl(input?.city);
  const scope = county ? 'county' : 'state';
  if (city.length > 80 || !/^[\p{L}\p{M}0-9 .,'-]*$/u.test(city))
    return { ok:false, code:'invalid_city', error:'Use a city name, not an address or personal information.' };
  if (city && !county)
    return { ok:false, code:'county_required_for_city', error:'Choose an imported county before identifying a city; otherwise submit a state-level plan.' };
  // Different cities within the same county are distinct planning intentions,
  // but neither is a separate permission to operate or a duplicate service region.
  const cityKey = city ? createHash('sha256').update(city.toLocaleLowerCase('en-US'))
    .digest('hex').slice(0, 12) : null;
  const id = county ? county.id + (cityKey ? '-city-' + cityKey : '') : stateCode.toLowerCase();
  const label = county ? county.name + ', ' + stateCode : STATES.find(j=>j.code===stateCode).name;
  return { ok:true, plan:{ id, stateCode, countyFips:county?.fips||null,
    countyName:county?.name||null, marketId:county?.id||null,
    city:city||null, scope, label,
    // Planning is intentionally NOT a promise of availability or a launch toggle.
    status:'proposed', commercialAuthority:false, onboardingAuthority:false,
  }};
}
async function proposeMarket({ db, actor, input, now=Date.now(), catalogue=catalog() }) {
  if (!db || !/^[A-Za-z0-9_-]{1,40}$/.test(sl(actor)) || !Number.isSafeInteger(now) || now<=0)
    return { ok:false, code:'named_operations_required' };
  const v=validateProposal(input,catalogue);
  if (!v.ok) return v;
  const p=v.plan;
  const ref=db.collection(PLAN_COLLECTION).doc(p.id),audit=db.collection('audit_log').doc();
  return db.runTransaction(async tx => {
    const previous=await tx.get(ref);
    const original=previous.exists?previous.data():null;
    // No status transition or approval can occur here. An existing plan stays
    // a proposal; no new route is allowed to transition it into market_admission.
    tx.set(ref,{...p, createdAt:original?.createdAt||now, createdBy:original?.createdBy||actor,
      updatedAt:now, updatedBy:actor},{merge:false});
    tx.create(audit,{ at:now, actor:{name:actor,method:'named_ops_mfa'}, action:'market_expansion_proposed',
      planId:p.id, jurisdiction:p.stateCode, scope:p.scope });
    return { ok:true, planId:p.id, status:'proposed', commercialAuthority:false };
  });
}
async function listPlans(db) {
  if (!db) return { ok:false, plans:[], reason:'unavailable' };
  try {
    const snap=await db.collection(PLAN_COLLECTION).limit(101).get();
    return { ok:true, plans:snap.docs.slice(0,100).map(d => ({id:d.id,...d.data()}))
      .sort((a,b)=>b.updatedAt-a.updatedAt), truncated:snap.docs.length>100 };
  } catch {
    return { ok:false, plans:[], reason:'unavailable' };
  }
}
module.exports={ catalog, validateProposal, proposeMarket, listPlans, PLAN_COLLECTION };
