// Market pricing registry: local evidence/configuration feeding one common fare engine.
//
// CRITICAL INVARIANT: there is NO default pricing market. A region that has no explicit
// pricing record cannot be priced. This prevents a newly-added Texas/California region from
// silently inheriting South Florida coefficients.
//
// These are the CURRENT production coefficients, not the unpromoted 29 Sept calibration.
// Promotion of new coefficients is a separate evidence-gated change.
const PRICING = Object.freeze({
  'fl-southeast': Object.freeze({
    regionId: 'fl-southeast',
    currency: 'USD',
    baseCents: 100,
    perMileCents: 85,
    perMinuteCents: 15,
    minimumFareCents: 300,
    calibrationStatus: 'current-production',
    evidenceAsOf: '2026-09-20',
    // Jurisdictional/corporate costs are NOT assumed to be zero merely because the common
    // Stripe solver has no line for them. Market admission must explicitly review them.
    regulatoryEconomicsReviewed: true,
    regulatoryEconomicsNote:
      'Florida launch-market corporate/regulatory costs remain subject to the commercial-release budget; per-Travel public-body fees are separate pass-through records.',
  }),
});

function pricingForRegion(regionId) {
  return PRICING[String(regionId || '')] || null;
}

function pricingForTrip(pickup, dest) {
  const { regionForTrip } = require('./regions');
  const r = regionForTrip(pickup, dest);
  return r ? pricingForRegion(r.id) : null;
}

function pricingProblems(region) {
  if (!region?.id) return ['region missing'];
  const p = pricingForRegion(region.id);
  if (!p) return [`${region.id}: no explicit pricing record`];
  const out = [];
  for (const k of ['baseCents','perMileCents','perMinuteCents','minimumFareCents']) {
    if (!Number.isInteger(p[k]) || p[k] < 0) out.push(`${region.id}: invalid ${k}`);
  }
  if (p.currency !== 'USD') out.push(`${region.id}: unsupported settlement currency ${p.currency}`);
  if (!p.calibrationStatus) out.push(`${region.id}: calibration status missing`);
  if (!p.evidenceAsOf) out.push(`${region.id}: evidence date missing`);
  if (p.regulatoryEconomicsReviewed !== true) out.push(`${region.id}: regulatory economics not reviewed`);
  return out;
}

module.exports = { PRICING, pricingForRegion, pricingForTrip, pricingProblems };
