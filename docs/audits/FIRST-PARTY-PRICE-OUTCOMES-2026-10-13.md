# First-party fare-outcome learning — source-led audit, October 13, 2026

## Decision
The first useful pricing step is to understand the actual booking prices and outcomes **already held by American Rider**, not to depend on a paid per-Travel competitor feed. Keep ordinary service-market economics, all-in Traveler Total, 99% Operator fare share and independent market-source promotion unchanged. No automated experiments or fare changes are activated.

## Primary reference framework
- [Google Cloud Firestore best practices](https://firebase.google.com/docs/firestore/best-practices): reuse a bounded, already-paid query; avoid offsets, idle re-scans, redundant read/write amplification and hot aggregate documents.
- [Amazon Builders Library, safe idempotent retries](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/): deduplicate events/IDs; never count repeated booking states as separate sales.
- [NASA SWE-055](https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695440/SWE-055%2B-%2BRequirements%2BValidation): adverse, unknown, malformed and incomplete operational observations cannot be treated as validation of demand or market price.
- [Stanford GSB, Spatial Pricing in Ride-Sharing Networks](https://www.gsb.stanford.edu/faculty-research/working-papers/spatial-pricing-ride-sharing-networks): demand differs by local origin and network balance; do not pool unrelated counties into one price.
- [Apple Human Interface Guidelines, design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles/): clearly describe sampled/unknown states and exclude private trip details. [Google SRE eliminating toil](https://sre.google/sre-book/eliminating-toil/): readable one-phone Operations without weekly manual exports.

## Actual source check before design
- `backend/server.js` /travel/prepare already writes server-calculated `costCents`, `travelCostCents`, `miles`, pickup coordinates and status to `rides`, and `backend/booking.js` uses an idempotent prepared booking key.
- `backend/opsboarddata.js` already reads at most **120 rides created in the prior 24 hours** for its board, setting `saturated` at the boundary.
- The `/fare-quote` endpoint is public and does **not** durably record every displayed quote. A quote impression rate, price elasticity, abandonment, controlled experimental arm and comprehensive booking-to-quote conversion rate are NOT measurable from stored ride records alone.
- The existing `backend/market-reference-authority.js` protects live rates with independent comparisons/holdout. Data from our own prices is **not independent proof** of wider local market fares.

## Change
The existing protected /ops page now renders a coarse, research-only readout from its existing 24-hour sample, grouping eligible standard records by pickup county and route distance. It reports a recorded median and completed median, count of completed/cancelled/other statuses, explicit exclusions and sample limit. The pure helper discards precise pickup points, labels, user IDs, Operator identities, Smart Travel and synthetic bookings from results. If the recent section fails, the pricing panel says unavailable; if zero, no inference; if 120, visibly partial. A new test repeats missing, duplicate, corrupt, private, out-of-region, 10K/100K/1M-scenario bounded samples twice. **Zero additional Firestore queries/writes, supplier calls, Stripe operations or Fare changes on normal board usage.**

## Limitations and NEXT real step
The report is descriptive; it cannot infer whether a booking was *caused* by price. It does not certify final payment settlement, representative sample, true currency mix, completed-trip benefit or market competitiveness. In the future, after a documented privacy/consent assessment, add a minimal first-party quote-impression and outcome cohort with consent/retention, fraud filters, proper randomization and holdouts; use real operational data and stop on customer harm, cost or quality issues. Do not prematurely run price experiments, alter legal disclosure/market admission, or represent unverified volunteers as market truth. Continue sourcing lawful actual Tri-County references (#164) and cleaning opt-in records on deletion (#169). No new paid tool required.
