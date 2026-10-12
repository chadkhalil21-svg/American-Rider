'use strict';
// National, provider-neutral competitive PRICE ASSURANCE. Pure and offline.
// It NEVER writes Firestore, calls suppliers, adjusts a live Fare, or opens a market.
// Use only a promoted, independent, condition-matched reference and the real fee solver.
const { minimumPlatformFeeCents, economicsFor } = require('./economics');
const { keyForQuote, qualification } = require('./market-reference-authority');
const { MARKET_REFERENCE_TARGET_FRACTION } = require('./pricing-policy');

const UNDERPRICING_REVIEW_BAND = 0.05; // diagnostic 5 percentage points below our 90% target; NOT a fare policy.
const boundedCent = x => Number.isSafeInteger(x) && x >= 0;
function evaluateQuote({ marketId, region, quote, snapshot = null, plan = null, now = new Date() }) {
  if (!quote || !boundedCent(quote.travelCostCents) ||
      !boundedCent(quote.governmentFeeCents ?? 0) || !boundedCent(quote.tollCents ?? 0) ||
      !Number.isFinite(quote.routedMiles) || quote.routedMiles < 0 ||
      !Number.isFinite(quote.routedMinutes) || quote.routedMinutes <= 0 ||
      !region?.timezone || !marketId || !quote.marketId ||
      !Number.isFinite(new Date(now).getTime())) {
    return { status: 'unverified', reason: 'missing or invalid route/quote inputs' };
  }
  // This is the SAME fee and cost model used by the live server; never compare Fare
  // alone against the market's full passenger Total.
  const input = {
    travelCostCents: quote.travelCostCents,
    governmentFeeCents: quote.governmentFeeCents ?? 0,
    tollCents: quote.tollCents ?? 0,
    cardCountry: quote.cardCountry ?? null,
    transactionCount: quote.transactionCount ?? 1,
  };
  if (!Number.isInteger(input.transactionCount) || input.transactionCount < 1 || input.transactionCount > 4)
    return { status: 'unverified', reason: 'invalid payment count' };
  const platformFeeCents = minimumPlatformFeeCents(input);
  const e = economicsFor({ ...input, platformFeeCents });
  const base = {
    marketId, travelerTotalCents: e.travelerPays,
    platformFeeCents, operatorGetsCents: e.operatorGets,
    modeledContributionCents: e.platformContributionCents,
    // Existing economic provisions are MODELED, not supplier invoices.
    modeledFloorPassed: e.platformContributionCents >= e.requiredContributionCents,
  };
  const missing = reason => ({ ...base, status: 'unverified', reason });
  if (quote.marketId !== marketId || snapshot?.marketId !== marketId)
    return missing('market-specific evidence missing or mismatched');
  if (quote.routerVerified !== true)
    return missing('production street distance/time not verified');
  if (quote.comparableChargesVerified !== true)
    return missing('pass-through and service comparability not verified');
  if (!plan) return missing('market evidence plan missing');
  const header = qualification(snapshot, plan);
  if (!header.ok) return missing(header.reason);
  let key;
  try {
    key = keyForQuote({
      serviceClass: quote.serviceClass || 'standard',
      routedMiles: quote.routedMiles,
      routedMinutes: quote.routedMinutes,
      region, now: new Date(now),
      calendarClass: quote.calendarClass || 'ordinary',
      regulatedLocationClass: quote.regulatedLocationClass || 'ordinary',
    });
  } catch {
    return missing('invalid time-zone or comparison cell');
  }
  const cell = snapshot.cells?.[key];
  if (!cell) return missing('condition-matched evidence missing');
  const approved = qualification(snapshot, plan, cell, new Date(now).getTime());
  if (!approved.ok) return missing(approved.reason);
  if (cell.travelerTotalComparable !== true)
    return missing('reference fare/fees/tolls were not harmonized to Traveler Total');
  if (!Number.isFinite(cell.maxProviderShare) || cell.maxProviderShare > 0.70)
    return missing('independent provider concentration not verified');
  if (!boundedCent(cell.referenceTotalCents) || cell.referenceTotalCents === 0 ||
      cell.targetTotalCents !== Math.round(cell.referenceTotalCents * MARKET_REFERENCE_TARGET_FRACTION))
    return missing('reference price or 90% target invalid');
  const referenceTotalCents = cell.referenceTotalCents;
  const targetTotalCents = cell.targetTotalCents;
  const reviewLowerBoundCents = Math.round(referenceTotalCents * (MARKET_REFERENCE_TARGET_FRACTION - UNDERPRICING_REVIEW_BAND));
  const gapToTargetCents = e.travelerPays - targetTotalCents;
  let status = 'within_target_band';
  if (!base.modeledFloorPassed) status = 'economic_review_required';
  else if (e.travelerPays < reviewLowerBoundCents) status = 'material_underpricing_review';
  else if (e.travelerPays > targetTotalCents) status = 'above_target_review';
  return {
    ...base, status, conditionKey: key,
    referenceTotalCents, targetTotalCents, gapToTargetCents,
    discountPct: Math.round((1 - e.travelerPays / referenceTotalCents) * 1000) / 10,
    referenceAsOf: cell.latestObservedAt,
    evidenceSources: cell.sources,
    // Informational result only; any rate change requires separately approved promotion.
    productionFareChanged: false,
  };
}
function auditMarket({ marketId, region, quotes, snapshot = null, plan = null, now = new Date() }) {
  if (!Array.isArray(quotes) || quotes.length > 1000) throw new RangeError('at most 1000 quote cases per audit');
  const rows = quotes.map(quote => evaluateQuote({ marketId, region, quote, snapshot, plan, now }));
  const counts = {};
  for (const row of rows) counts[row.status] = (counts[row.status] || 0) + 1;
  return { marketId, cases: rows.length, counts, rows, productionFareChanged: false };
}
module.exports = { evaluateQuote, auditMarket, UNDERPRICING_REVIEW_BAND };
