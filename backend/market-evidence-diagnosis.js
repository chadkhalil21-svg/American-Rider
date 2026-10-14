'use strict';
// Diagnose RECORD state, not whether the underlying real-world work exists.
// Never turn software tests or founder assertion into external insurance/CRA approval.
function evidenceProblem(id, proof, manifestVersion, now=Date.now()) {
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) return {
    id, code:'record_absent', reason:'No approved evidence record is stored. This does not establish that the underlying work was not completed.',
  };
  const t=Number(proof.reviewedAt),expiry=Number(proof.validUntil);
  if (proof.manifestVersion !== manifestVersion) return {
    id, code:'record_version_mismatch', reason:'The existing evidence record must be checked against the current jurisdiction requirements.',
  };
  if (!String(proof.reference||'').trim() || !String(proof.issuer||'').trim() ||
    !String(proof.verifiedBy||'').trim() || !Number.isSafeInteger(t) || t<=0 || t>now ||
    !Number.isSafeInteger(expiry) || expiry<=t) return {
    id, code:'record_invalid', reason:'The evidence record lacks valid independent review, provenance or dates.',
  };
  if (expiry<=now) return {
    id, code:'record_expired', reason:'The recorded evidence has expired and requires current confirmation.',
  };
  return null;
}
module.exports={evidenceProblem};
