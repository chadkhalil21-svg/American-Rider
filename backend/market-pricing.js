// Market pricing registry: local evidence/configuration feeding one common fare engine.
//
// CRITICAL INVARIANT: there is NO default pricing market. A region that has no explicit
// pricing record cannot be priced. This prevents a newly-added Texas/California region from
// silently inheriting South Florida coefficients.
//
// An independently reviewed local starting-price candidate, pending physical-device
// validation before this PR is eligible for merger. NO national fallback is allowed.
const PRICING = Object.freeze({
  'fl-southeast': Object.freeze({
    regionId: 'fl-southeast',
    currency: 'USD',
    baseCents: 100,
    perMileCents: 95,
    perMinuteCents: 32,
    minimumFareCents: 300,
    calibrationStatus: 'initial-local-cost-and-public-model',
    evidenceAsOf: '2026-10-13',
    // Jurisdictional/corporate costs are NOT assumed to be zero merely because the common
    // Stripe solver has no line for them. Market admission must explicitly review them.
    regulatoryEconomicsReviewed: true,
    regulatoryEconomicsNote:
      'Florida rates are an independent initial starting-price choice supported by public price models only, not verified live competing quotes. Per-Travel statutory charges remain pass-through; legal/insurance and duty-time economics remain launch gates.',
  }),
});

// First-price cohort safeguard, based on the last schedule that legacy TestFlight
// clients could book without sending an agreed all-in Traveler Total. If ANY
// regional coefficient changes, older clients MUST update before a new booking.
// Future regions also require total confirmation. No network/database work.
const LEGACY_FL_BOOKING_PRICE = Object.freeze({
  regionId: 'fl-southeast', baseCents: 100,
  perMileCents: 85, perMinuteCents: 15, minimumFareCents: 300,
});
function requiresAgreedTotalOnBooking(pricing) {
  return !pricing || Object.keys(LEGACY_FL_BOOKING_PRICE).some(
    key => pricing[key] !== LEGACY_FL_BOOKING_PRICE[key]
  );
}

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

module.exports = { PRICING, pricingForRegion, pricingForTrip, pricingProblems, requiresAgreedTotalOnBooking };
