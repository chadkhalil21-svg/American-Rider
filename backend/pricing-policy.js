// National market-position policy.
//
// A market reference is LOCAL and condition-matched; this policy is NATIONAL.
// Never inherit another market's coefficients or fabricate unavailable real-time conditions.
const MARKET_REFERENCE_TARGET_FRACTION = 0.90;

const REFERENCE_DIMENSIONS = Object.freeze([
  'serviceClass',
  'routedDistanceBand',
  'routedDurationBand',
  'daypart',
  'weekdayWeekend',
  'calendarClass',
  'regulatedLocationClass',
]);

const MARKET_BALANCE_SIGNALS = Object.freeze([
  'requestPressure',
  'availableOperators',
  'pickupEta',
  'acceptanceRate',
  'completionRate',
  'traffic',
  'specialEvents',
  'weather',
  'pickupBurden',
  'destinationConditions',
]);

function targetTotalCents(referenceTotalCents) {
  if (!Number.isInteger(referenceTotalCents) || referenceTotalCents < 0) throw new TypeError('referenceTotalCents must be a non-negative integer');
  return Math.round(referenceTotalCents * MARKET_REFERENCE_TARGET_FRACTION);
}

module.exports = {
  MARKET_REFERENCE_TARGET_FRACTION,
  REFERENCE_DIMENSIONS,
  MARKET_BALANCE_SIGNALS,
  targetTotalCents,
};
