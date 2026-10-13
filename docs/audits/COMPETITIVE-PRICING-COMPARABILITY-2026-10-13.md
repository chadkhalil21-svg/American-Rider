# 13 October 2026 — Competitive Pricing Source-Lineage Repair and Council Review

**Commercial objective:** American Rider shall quote one true all-in Traveler Total, pay Operators 99% of the Travel Fare, and position ordinary local Travels competitively without artificially low cost-plus pricing or mandatory ten-percent discounts. Florida's three counties are the first commissioned markets; the architecture stays nationally reusable. This is an audit/repair of an existing evidence engine, not a new research product.

## Verified defect and correction

The existing authorized panel verified source-declared ordinary all-in Totals, but `market-evidence-ingest.js` discarded that assertion, and `market-reference-service.js` never set `travelerTotalComparable` when building a condition cell. The existing runtime gate explicitly demands that field. As built, even sufficiently sampled lawful all-in evidence could never pass the gate. Worse, observed source counts also included historical Chicago trip totals and public estimates as if they could help satisfy a market-price quorum.

The repair:
- Carries a boolean source-declared `hasAllInTotalComparable` through the already-verified authorized-panel adapter and normalization, without claiming independent verification.
- During reference recomputation, counts only records both flagged comparable **and** from an explicitly primary-eligible source with matching source family. Public price estimates, historical trips, missing data and incompatible source types remain research-only, cannot establish a reference median, cannot increase the qualified sample size, and cannot meet the two-family rule.
- Keeps the existing approved reference source, minimum 20 observations per condition cell, at least two independent evidence families/sources, largest provider <=70%, staleness, candidate isolation, independent holdout, server economics, route gates and explicit promotion unchanged.
- Makes no change to fares, market admissions, supplier credentials, network requests, scheduled polling, Firestore query count, money, insurance, price personalized to a Traveler, or live-source activation. Synthetic source records never enter production.

## Pricing discrepancy: source-led directional warning, NOT a lawful market-authority feed

Public February 2026 fare *estimates* (not contemporary matched route/time receipts):
| Geographic context | Typical trip (approx.) | Independent published estimate | Current formula illustration, before pass-throughs |
| --- | --- | ---: | ---: |
| Miami | 8 mi, 21 min | $27.73 | $13.45 |
| Cutler Bay | 8.5 mi, 22 min | $30.74 | $14.03 |
| FLL airport area | 16 mi, 33 min | $40.84 | $22.05 |
| PBI airport area | 13 mi, 22 min | $32.35 | $17.85 |

Sources: https://taxifare.org/us/miami ; https://taxifare.org/us/cutler-bay ; https://taxifare.org/us/fll ; https://taxifare.org/us/pbi ; source methodology https://taxifare.org/methodology . The publisher explicitly says these are planning estimates, not guaranteed or current comparable quotes. Its terms https://taxifare.org/terms allow ordinary attribution and small excerpts but call for licensing for bulk reuse. **Never scrape/import these records as market-price authority**. No automatic increase, 90% target or commercial benchmark claim is justified by this table. Airport facility charges and insurance/admission must be handled separately.

## Council lenses, anchored in actual external authority

- **Ford / operational repeatability:** one server price and one booked Total; prevent app multiplication/recalculation; avoid unnecessary per-Travel vendor requests.
- **Rockefeller / unit economics:** preserve 99% Operator Fare, variable processor and Connect fees, a fixed minimum Platform Fee, government/toll pass-through, and contribution margin.
- **Jobs / hospitality:** the Traveler sees precisely the amount chargeable, and is told whenever the current Total changes. Apple's design guidance requires transparent charges in payment flows: https://developer.apple.com/design/human-interface-guidelines/apple-pay .
- **MIT Sloan and Stanford GSB / pricing:** price by the economic value and local supply/demand of a journey, not a universally cheap fallback or a compulsive discount. See https://ocw.mit.edu/courses/15-818-pricing-spring-2010/ and https://www.gsb.stanford.edu/faculty-research/publications/spatial-pricing-ridesharing-networks .
- **NBER / market uncertainty:** contemporaneous *identical route* prices can differ across platforms. See https://www.nber.org/papers/w34441 . National city averages are inadequate as proof for a specific quote.
- **Google Cloud / cost:** control read and index work; the existing snapshot cache and event-driven limited data sweep remain. See https://firebase.google.com/docs/firestore/pricing and https://firebase.google.com/docs/firestore/best-practices .
- **Amazon / replay:** stable source observation IDs and same-key/different-price conflicts avoid duplicate or altered observations when a supplier retries: https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/ .
- **NASA / validation:** twice-run synthetic nominal/failure scenarios are necessary, but a real rights-permitted sample and iPhone/Android/Stripe sandbox journey are still needed before operational certification: https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695440/SWE-055%2B-%2BRequirements%2BValidation .

These are analytical lenses, not real meetings with historical executives or institutional endorsements.

## The shortest path to actual competitive prices

1. Verify live all-in American Rider server quotes on a fixed basket of **real pickup/destination coordinates**, class, timestamp and toll/airport-class for each of Miami-Dade, Broward and Palm Beach; preserve only the necessary bounded research records.
2. Obtain lawful *current matched full-Totals* through existing pending Obi/Gridwise inquiries or deliberately consented and independently checked ordinary Consumer/Operator fare quotations. Confirm exact rights, source sample, promotions, provider independence, date, pass-throughs and whether customer charge is genuinely known (Operator earnings alone are not sufficient).
3. Calibrate county/time/route bands as a **candidate**, comparing 90%, 95%, 100% of credible market median and sustainable economics; a 10% discount is not mandatory. Avoid using standard-price estimates for premium or airport class pricing.
4. Run 2 passes of synthetic booking/quote/charge/settlement, class/pickup changes, Smart Travel two legs, all card-country/toll cases, missing/stale/poisoned data, missing license, high supplier concentration, duplicate events, 10K/100K/1M workload model; add stage/live sandbox and actual handset proof. Independently approve each pricing change through an exact-SHA PR and confirm Render SHA. Do not commission other states by default.

**Current conclusion:** The price computation repair in PR #176 is production-live, but real competitive pricing remains **BLOCKED ON RIGHTS-PERMITTED CURRENT MATCHED MARKET QUOTES**, not on the number of additional research screens built. The specific data supplier conversations already exist; do not spam duplicate solicitations. Do not unilaterally raise commercial fares on stale averages.
