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
module.exports={VERIFIED_CONTROLS,configuredControls};
