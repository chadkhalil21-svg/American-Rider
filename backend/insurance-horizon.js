'use strict';
// One date-based guard for NEW Travels, not a claim that the insurer cannot
// cancel unexpectedly. Deliberately conservative for date-only policy evidence.
// 24 hours is American Rider's operational margin, not a statutory period.
const DAY_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ADVANCE_MARGIN_MS = DAY_MS;
const TRAVEL_OVERRUN_MARGIN_MS = ONE_HOUR_MS;

function policyExpiryAt(expiry) {
  if (typeof expiry !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return null;
  // Use UTC to avoid different decisions on phones and servers in different
  // time zones; this ends earlier than the local FL date, deliberately.
  const end = Date.parse(expiry + 'T23:59:59.999Z');
  if (!Number.isFinite(end) || new Date(end).toISOString().slice(0, 10) !== expiry) return null;
  return end;
}

function requiredWindowMs(travelMinutes = null) {
  if (travelMinutes == null) return ADVANCE_MARGIN_MS;
  const mins = Number(travelMinutes);
  // An invalid server estimate cannot support a claim of adequate coverage.
  if (!Number.isFinite(mins) || mins < 0) return Infinity;
  return Math.max(ADVANCE_MARGIN_MS, mins * 60 * 1000 + TRAVEL_OVERRUN_MARGIN_MS);
}

// No insurer source, no parseable expiry, or insufficient remaining time means
// this Operator cannot be offered a NEW Travel. Verified replacement policies
// can restore service through the existing independent confirmation flow.
function coverageUnsafeForNewTravel(expiry, now = Date.now(), travelMinutes = null) {
  const end = policyExpiryAt(expiry);
  if (end === null || !Number.isFinite(now)) return true;
  const window = requiredWindowMs(travelMinutes);
  return !Number.isFinite(window) || now + window >= end;
}

module.exports = {
  DAY_MS, ADVANCE_MARGIN_MS, TRAVEL_OVERRUN_MARGIN_MS,
  policyExpiryAt, requiredWindowMs, coverageUnsafeForNewTravel,
};
