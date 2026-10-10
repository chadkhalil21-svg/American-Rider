'use strict';
// One national interface for trusted official provider CONTACT evidence.
// Every new state uses the same workflow and supplies an independently
// validated state-specific licence/contact adapter. Uncommissioned states
// cannot borrow Florida evidence and must fail closed. This does not certify
// active automobile insurance or create a paid provider integration.
const { jurisdictions } = require('./jurisdictions/us.json');
const { lookupOfficialAgencyEmail } = require('./florida-official-insurance-contacts');
const { forState: insuranceRequirements } = require('./insurance-jurisdictions');
const STATES = new Set(jurisdictions.map(j=>j.code));
const ADAPTERS = Object.freeze({
  FL: lookupOfficialAgencyEmail,
});
function insuranceSourceState(user) {
  const operatingMarketId=String(user?.operatingMarket?.id||'');
  // The state is a server-owned market ID, not a free-form email-request field.
  const {markets}=require('./markets');
  return markets().find(m=>m.id===operatingMarketId)?.state || null;
}
async function recognizeOfficialInsuranceContact({stateCode,email,lookup=ADAPTERS}={}) {
  const state=String(stateCode||'').trim().toUpperCase();
  if (!STATES.has(state)) return {recognized:false,reason:'unknown_jurisdiction'};
  if (!insuranceRequirements(state)) return {recognized:false,reason:'insurance_jurisdiction_uncommissioned'};
  const adapter=lookup[state];
  if(typeof adapter!=='function') return {recognized:false,reason:'no_authenticated_state_provider_source'};
  try {
    const result=await adapter(email);
    if(!result || result.recognized!==true) return {
      recognized:false, reason:String(result?.reason||'source_unavailable')
    };
    return {...result,recognized:true,jurisdiction:state};
  } catch { return {recognized:false,reason:'source_unavailable'}; }
}
module.exports={STATES,ADAPTERS,insuranceSourceState,recognizeOfficialInsuranceContact};
