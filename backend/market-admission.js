// Atomic market-admission contract.
//
// A market is not ready because somebody drew a polygon. Pricing, jurisdiction, insurance,
// screening and routing/regulatory review must all be present before activation.
const { pricingProblems } = require('./market-pricing');
const insurance = require('./insurance-jurisdictions');
const US = require('./jurisdictions/us.json');

function regionAdmissionProblems(region) {
  if (!region) return ['region missing'];
  const p = [...pricingProblems(region)];
  const j = region.jurisdiction;
  if (!j?.stateCode || !j?.tncStatute || !j?.disclosureStatute) p.push(`${region.id}: jurisdiction incomplete`);
  if (!Number.isInteger(j?.screeningYears) || j.screeningYears <= 0) p.push(`${region.id}: screening cadence missing`);
  if (!US.jurisdictions.some((x) => x.code === j?.stateCode)) p.push(`${region.id}: jurisdiction is not in the U.S. registry`);
  if (!insurance.forState(j?.stateCode)) p.push(`${region.id}: Operator insurance requirements not configured`);
  if (region.geographyEvidence?.status !== 'verified') p.push(`${region.id}: authoritative geography not verified`);
  if (region.tollPolicy?.status !== 'verified' || region.tollPolicy?.failClosed !== true) p.push(`${region.id}: toll authority/fail-closed policy not verified`);
  if (!Array.isArray(region.marketFips) || !region.marketFips.length) p.push(`${region.id}: no market geography identifiers`);
  if (!Array.isArray(region.activeMarketFips)) p.push(`${region.id}: activation set missing`);
  // Airports/ports are deliberately separate permit records. Their absence never means
  // permission; fees.js remains default-deny for known authority-controlled places.
  return p;
}

function regionReady(region) {
  return regionAdmissionProblems(region).length === 0;
}

module.exports = { regionAdmissionProblems, regionReady };
