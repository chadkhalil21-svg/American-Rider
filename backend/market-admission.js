// Atomic market-admission contract.
//
// A market is not ready because somebody drew a polygon. Pricing, jurisdiction, insurance,
// screening and routing/regulatory review must all be present before activation.
const { pricingProblems } = require('./market-pricing');
const insurance = require('./insurance-jurisdictions');

function regionAdmissionProblems(region) {
  if (!region) return ['region missing'];
  const p = [...pricingProblems(region)];
  const j = region.jurisdiction;
  if (!j?.stateCode || !j?.tncStatute || !j?.disclosureStatute) p.push(`${region.id}: jurisdiction incomplete`);
  if (!Number.isInteger(j?.screeningYears) || j.screeningYears <= 0) p.push(`${region.id}: screening cadence missing`);
  if (!insurance.forState(j?.stateCode)) p.push(`${region.id}: Operator insurance requirements not configured`);
  // Airports/ports are deliberately separate permit records. Their absence never means
  // permission; fees.js remains default-deny for known authority-controlled places.
  return p;
}

function regionReady(region) {
  return regionAdmissionProblems(region).length === 0;
}

module.exports = { regionAdmissionProblems, regionReady };
