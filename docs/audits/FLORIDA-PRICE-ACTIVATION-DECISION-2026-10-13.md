# Florida competitive price activation — coded release candidate, NOT APPROVED OR LIVE
Date: 13 October 2026. Parent research: PR #179 / docs/audits/SOUTH-FLORIDA-CONCRETE-PRICE-CANDIDATE-2026-10-13.md.

## Business objective and source-led decision

The founder directs American Rider to avoid unnecessary underpricing while maintaining a superior Traveler experience and providing Operators 99% of the Travel Fare. Stanford's geographic ridesharing network research (https://www.gsb.stanford.edu/faculty-research/publications/spatial-pricing-ridesharing-networks) explains why one price cannot be copied blindly across the country. MIT's experiments (https://news.mit.edu/2017/identifying-optimal-product-prices-0918) support controlled learning from actual bookings. Berkeley's entire-shift pay study (https://laborcenter.berkeley.edu/gig-passenger-and-delivery-driver-pay-in-five-metro-areas/) explains why 99% share per Travel is not evidence of sustainable full-day wages. Apple's Apple Pay guidelines (https://developer.apple.com/design/human-interface-guidelines/apple-pay) require clear pre-payment Total and price-change notice. Google Firebase Firestore charging (https://firebase.google.com/docs/firestore/pricing) requires minimal reads, so do not add a market API or per-Travel database scan. Amazon retry guidance (https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) and Stripe (https://docs.stripe.com/api/idempotent_requests) require retry-safe same booking/payment. NASA SWE-055 (https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695440/SWE-055%2B-%2BRequirements%2BValidation) requires actual intended-device/use validation beyond simulation. Institutional/Council principles are ANALYTIC lenses (Ford standardization, Rockefeller earnings/margin, Jobs single truthful Total), not meetings or endorsements.

**Coded rate proposal for active Southeast Florida region ONLY:** $1.00 base + $0.95 per road mile + $0.32 per road minute, minimum Fare $3; exact dynamic Platform Fee >=$2.50; Operators retain 99% of Travel Fare, entire toll reimbursement and all public-body fees passed through.

| Standard ordinary road journey | Old domestic all-in before pass-throughs | Coded candidate all-in |
| --- | ---: | ---: |
| 3 miles, 10 minutes | $7.55 | $9.55 |
| 5 miles, 15 minutes | $10.00 | $13.05 |
| 8 miles, 21 minutes | $13.45 | $17.82 |
| 10 miles, 25 minutes | $15.75 | $21.00 |

**Public non-live context:** https://getridewise.com/compare (published June 2026 modeled 10mi/25min Miami comparison $20.15–$21.20), and separately https://getridewise.com/blog/uber-fare-calculator-2026 (September 2026 model $18.66–$23.74). Both are **estimates from the same publisher / same underlying rate-card lineage**, NOT two independent providers or real quotes. Several older RideWise Miami pages contain DISAGREEING historical coefficients (e.g. March $0.90/mi vs Oct $1.20/mi) and are inadequate for exact competitive-claim certification. Never ingest them into primary market-reference cells or claim guaranteed percentages below competing platforms.

**Government public taxi context, not TNC price:** Official Miami-Dade page https://www.miamidade.gov/global/service.page?Mduid_service=ser1572618493969359 cites resolution R-700-22 (first sixth $2.95, next five sixths $0.85 each, every sixth thereafter $0.55). This means 5 whole miles $20.40 and 10 whole miles $36.90 before waiting, tip/toll, equipment and airport charges. Another county legacy URL shows $0.40 for the post-first-mile sixth; treat it as stale and use the linked resolution. Taxi meter prices do NOT authorize rideshare passenger pricing.

**Vehicle costs are a sensitivity proxy, not a fact about our Operators:** IRS revised business mileage https://www.irs.gov/tax-professionals/standard-mileage-rates in July-Dec 2026 = 76c/mile, not verified commercial insurance/vehicle cost. A proposed 10-mile 25-minute fare pays Operator ~ $18.32. With 20% deadhead miles, proxy cost $9.12, remainder $9.20 per occupied Travel (~$22.08 per occupied hour). With 65% loaded duty utilization, this corresponds to ~$14.35 per full on-duty hour BEFORE taxes/extra insurance—not a living-wage guarantee. Never publicize as hourly earnings.

## Release preconditions — purpose of DRAFT PR

This branch contains the **actual change to `backend/market-pricing.js`** and updates exact-cent tests; it is intentionally DRAFT / UNMERGED so prices stay unchanged until final permission to charge new amounts and physical testing. The already deployed prior PR #180 requires `agreedTotalCents` on ALL newly priced bookings; older TestFlight builds that omit this confirmation would receive HTTP 428 and cannot book. That is safe against surprise billing but could block customers. Must submit and verify replacement iOS build and Android compatibility in the physical client, including appropriate explanatory old-client experience, before merging.

Require actual county-specific Operator licensing/insurance/livery overhead, real road routing and airport/port permissions, known Stripe PaymentIntent flows and refund recovery, an actual test-device accepted Total under changed-price 409 and old-client 428, and at least a defensible founder-approved evidence statement for chosen starting Fare. No existing sandbox CI can certify those facts. No state outside existing admitted tri-county area can inherit rates; `backend/markets.js` and `backend/market-readiness.js` stay unchanged. Preserve one final Total, no additional API calls or Firestore reads.

## If approved

Once all six exact-head CI suites pass AND real-device/reconciliation and commercial release criteria documented, a single merge/deploy changes the one Florida record with a reversible Git history. Monitor initial completed bookings and Operator wait-times; if margins or demand are poor, independently adjust based on actual data, no manipulative personalized profile pricing. Never assume external market-model estimates prove current prices.
