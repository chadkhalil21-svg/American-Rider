'use strict';
// A launch review should not require an additional attestation of things that
// the deployed jurisdiction and Operator eligibility engines already enforce.
// This is only a duplicate-RECORD exemption, NEVER new permission to sell Travel.
//
// Florida §627.748(17) preempts ordinary municipal/county TNC license schemes.
// §627.748(7), (12) still govern real insurance and each driver's background
// check. All independent market evidence and live provider gates remain intact.
const {forState}=require('./insurance-jurisdictions');
const {continuingStatus}=require('./insurance-monitoring');
const {coverageUnsafeForNewTravel}=require('./insurance-horizon');
const {screeningCurrent}=require('./screening');

const CONFIGURED_FL='fl-southeast';
const VERIFIED_CONTROLS=Object.freeze([
 'jurisdiction_authority',   // law and boundary already checked by manifestFor()
 'operator_insurance_process', // verified status + advance-expiry fail-closed
 'screening_agreement',      // provider-neutral statutory checks, not exclusive contracting
]);

function configuredControls(manifest) {
  if(!manifest || manifest.regionId!==CONFIGURED_FL ||
      manifest.jurisdiction?.stateCode!=='FL' ||
      !Array.isArray(manifest.sourceProblems)||manifest.sourceProblems.length ||
      !String(manifest.jurisdiction.tncStatute||'').includes('627.748') ||
      manifest.insurance!==forState('FL')?.source ||
      typeof continuingStatus!=='function' ||
      typeof coverageUnsafeForNewTravel!=='function' ||
      typeof screeningCurrent!=='function') return [];
  return [...VERIFIED_CONTROLS];
}

/**
 * Bind code-verifiable SUBCONTROLS to existing mixed-purpose admission domains.
 * A verified subcontrol does not satisfy the whole domain: taxes, contracts,
 * external coverage, live payments, and physical service need independent proof.
 * This mapping is deliberately read-only and cannot activate a market.
 */
const {pricingForRegion,pricingProblems}=require('./market-pricing');
const {DISCLOSURE,DISCLOSURE_VERSION,disclosureCurrent}=require('./disclosure');
const tollAuthorities=require('./toll-authorities');

function mappedConfiguredSubcontrols(manifest) {
  if(configuredControls(manifest).length!==VERIFIED_CONTROLS.length)return [];
  const price=pricingForRegion(manifest.regionId);
  const checks=[
    {
      domain:'pricing_and_taxes',
      subcontrol:'explicit_fare_matrix_and_currency',
      verified:!!price && pricingProblems({id:manifest.regionId}).length===0,
      outstanding:'Tax treatment, statutory pass-through and independently verified production economics',
    },
    {
      domain:'routing_and_toll_rights',
      subcontrol:'toll_authority_inventory_and_fail_closed_policy',
      verified:manifest.tollPolicy?.status==='verified' &&
        manifest.tollPolicy?.failClosed===true &&
        tollAuthorities.forMarket(manifest.regionId)?.verifiedDiscovery===true,
      outstanding:'Actual routing service availability, provider terms and applicable access rights',
    },
    {
      domain:'disclosure_and_retention',
      subcontrol:'versioned_operator_insurance_disclosure',
      verified:DISCLOSURE.statute===manifest.jurisdiction?.disclosureStatute &&
        DISCLOSURE.version===DISCLOSURE_VERSION &&
        disclosureCurrent({version:DISCLOSURE_VERSION,at:1}) &&
        !disclosureCurrent(null),
      outstanding:'Verified delivery, statutory record retention and operational recovery',
    },
  ];
  return checks.map(c=>({...c,verified:c.verified===true,domainSatisfied:false}));
}

module.exports={VERIFIED_CONTROLS,configuredControls,mappedConfiguredSubcontrols};
