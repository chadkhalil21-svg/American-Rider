// Where American Rider operates — the gate every price and every route passes through.
//
// ONE DEFINITION, because there were two and they disagreed. routes.js bounded the map to one
// box and returned null outside it; fares.js bounded nothing at all. So a pickup outside the
// market got no route — and a price.
//
// FOUND 28 Aug 2026 by opening the app in the simulator, whose default location is Union Square
// in SAN FRANCISCO. The app quoted $6,228.25 to Miami International Airport and offered a
// Continue button. The server agreed: 3,359 miles, $6,228.43, priced by distance, and it would
// have created a PaymentIntent for it.
//
// It is not a hypothetical. A traveler two counties north, a phone whose GPS drifts to a cell
// tower, anyone opening the app on a plane — each gets a number instead of an answer. And a
// price a traveler cannot possibly have meant is the single defect this app treats most
// seriously: it is a surprise about money, in the worst direction.
//
// SINCE 9 SEPT 2026 the definition of "where" is regions.js — one record per service region,
// national by design (Chad: "think nationally"). This file is the gate and the words; it
// names no place, because the next region must not need a new sentence.
//
// SINCE 22 SEPT 2026 the PICKUP is gated by county markets (backend/markets.js): it must be in
// an ACTIVE county, not merely inside the region's rectangle (which also takes in Key Largo).
// The DESTINATION rule is unchanged: anywhere inside the pickup's region — a travel between
// regions is not sold.
const { servesPoint, tripOutsideMarkets } = require('./markets');

/** Is this point somewhere American Rider serves — an ACTIVE market? */
function inMarket(p) {
  return servesPoint(p);
}

/**
 * Which end of a travel stops it being sold, if either. null when the pickup is in an active
 * market and the destination is inside its region; else 'pickup' | 'destination' | 'both'.
 */
function outsideMarket(pickup, dest) {
  return tripOutsideMarkets(pickup, dest);
}

/** What to tell somebody, in the traveler's own words rather than ours. No place is named. */
function outsideMarketMessage(which) {
  if (which === 'pickup') return 'American Rider does not operate where you are yet.';
  if (which === 'destination') return 'American Rider does not travel to that destination yet.';
  return 'American Rider does not yet serve that area.';
}

module.exports = { inMarket, outsideMarket, outsideMarketMessage };
