# Nationwide competitive-pricing evidence and 90% assurance — 11 October 2026

**Status:** Audit infrastructure only. No live price adjustment, subscription, market expansion, Firestore polling, independent live price connection, airport admission, or claim of national market coverage.

## Founder policy and interpretation

- Retain **90% of the independently verified, comparable, current local market Traveler Total** as the planning target. This is a FOUNDER strategic price goal, not a university-recommended universal discount. Avoid systematic 20–40% discounts unsupported by market strategy.
- Retain the contractual **99% Travel Fare to Operator**, independent 1% commission, centrally calculated **minimum $2.50 Platform Fee** and the existing economics floor. Always compare **Traveler Total** (including processing-funded fees and relevant pass-throughs), not the Fare alone.
- One common cost/price engine. Independent local evidence per metropolitan service market, with route duration/distance, time-of-day, class, weekday, special location, traffic and source recency separated. Do not copy South Florida coefficients into another jurisdiction; no national flat rate.
- Never represent a *target* as a measured discount, or assume all routes/current quotes match a historical average. Do not buy 50 APIs or run 1,000 idle city crawlers.

## What data EXISTS and the preferred lowest-cost coverage

| Evidence | Geographic scope | Source and update | Suitable for automatic 90% live quote? |
|---|---|---|---|
| City of Chicago TNP trips | Chicago | Public fare + trip totals, distance/time and location/time approximations; published retrospective updates with rounding. https://data.cityofchicago.org/Transportation/Transportation-Network-Providers-Trips-2026-/8bbv-3wbe/data | **No**; source calibration only, needs tip/fee normalization and independent confirmation |
| NYC TLC HVFHV monthly trip records | NYC | Public monthly Parquet, often ~2 months behind; `base_passenger_fare` excludes tolls, tips, taxes and fees; normalizing to the full Traveler Total requires separate components. https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page and https://www.nyc.gov/assets/tlc/downloads/pdf/data_dictionary_trip_records_hvfhs.pdf | **No**; retrospective and partly noncomparable without harmonization |
| Other municipal/state published TNC reports | Source-by-source local market | Free where actual suitable fare/time/distance fields are present; otherwise structural evidence only | **Not without field/schema/recency validation** |
| Independent matched-route field/audit panels | Per approved market / daypart | Audit with permission and records of source, mode, amount, time, inclusions, age and operator earnings | Validation; cannot silently substitute a single founder snapshot for independent evidence |
| Licensed rideshare market data | Markets allowed by signed data contract | **Price not verified; not purchased.** Contract must explicitly permit competitive comparison and specify available trip total, geography and freshness | Only after license + actual endpoints verified |
| Platform-published rate-card/history pages | Where published | Public figures often averages or components, not current upfront quotes | Secondary diagnostics, never primary market authority |

**Access/usage critical:** One major operator's `GET /estimates/price` requires approval and its published terms expressly forbid using that API to offer competitive price comparisons. Do not build or purchase an integration against it under those conditions. https://developer.uber.com/docs/riders/references/api/v1.2/estimates-price-get

There is no independently verified, free, geographically complete, continuously refreshed U.S. rideshare **Traveler Total** feed as of this research. Never infer that Chicago or NYC evidence applies to Florida, or that a publication marked "hourly" is updated continuously.

## Existing architecture — REUSE, do not duplicate

- `backend/market-evidence.js` provides a national source catalog and evidence plans; `backend/market-evidence-ingest.js` normalizes every supplier into the same schema and refuses personalized pricing data.
- `backend/market-evidence-collectors.js` has only Chicago's public historical collector. PRs #101/#103/#116 ensure no work for uncommissioned markets and bounded/idempotent import. Do not enable an hourly history download without publication-change evidence. No South Florida licensed independent real-time collector currently exists.
- `backend/market-reference-service.js` stores provider-normalized observations and independently reduces them into local condition cells. `backend/market-reference-authority.js` requires exact-snapshot promotion, source diversity, router validation, economic check and freshness. `backend/pricing-policy.js` sets 0.90. `backend/market-pricing.js` still contains the earlier **September 20 South Florida fare curve**; unpromoted September 29 calibration is NOT the production curve.
- NEW `backend/market-price-assurance.js` compares **the actual domestic/international/card-aware server fee solver** to an already promoted market cell. It is pure/offline, does **no** paid provider calls or Firestore work, cannot change a Fare, and distinguishes `unverified`, `above_target_review`, `within_target_band`, `material_underpricing_review`, and `economic_review_required`.
- Its **85% lower review threshold** is purely a planning diagnostic (five percentage points beneath the founder's 90% target), NOT a second consumer pricing policy. It requires recorded matched source/service-class, actual verified route, full charge comparability, at least two independent evidence families, two source IDs, acceptable source concentration and an exact promoted snapshot. If any is missing, status is **UNVERIFIED**, not "competitive."
- `backend/market-price-assurance.test.js` tests ordinary and international cards, pass-throughs, prior/absent/unapproved/stale/economically invalid evidence, mismatched markets, unsupported router and charge comparability, over/underpricing, and 50 hypothetical-market portability. No synthetic case certifies a real market.

## Optimal commissioning by market

1. **Acquire once:** Identify local government/publisher datasets and permitted schema/license. Use their actual release/version, not a recurring quote-time scrape. Never enable a research collector simply because a city is in the market catalog.
2. **Verify twice:** Supplement the local government data with an independent observation family using actual comparable full Traveler Totals. Request a scoped, limited paid license ONLY for cities where no valid free/field evidence is available and it is economically justified. No unauthorized scraping or competitor coordination.
3. **Normalize:** Keep source IDs, provider, snapshot date, city, service class, matched route/time, tolls, airport charges, discounts/tips treatment and quality. Verify route data through our real OSRM/OTP stack before a quote comparison.
4. **Audit:** Build local robust medians/condition cells, compare the full American Rider Total against the 90% target and operator/economic floors. Flag uncompetitive OR excessive underpricing. Do not treat price evidence as a mandate to reduce fares below our operating cost.
5. **Promote safely:** Holdout validation, human-approved initial coefficients, consent and legal checks, synthetic end-to-end tests twice, exact-SHA CI, then a small monitored live pilot per jurisdiction. Changed source publication should recalculate only the relevant commissioned market; old/unknown source data cannot reprioritize national rates.
6. **Phone-first operations:** Alert founder **only** on missing primary market evidence, price drift requiring approval, vendor availability, invalid provider license, economics floor loss or material unit pricing changes; routine collected data does not require manual approval per trip.

## External institutional basis (guidance, not endorsements)

- Stanford GSB, Bimpikis/Candogan/Saban: local demand pattern and driver location balance affect pricing and consumer welfare. https://www.gsb.stanford.edu/faculty-research/publications/spatial-pricing-ridesharing-networks
- Harvard Business School, Frances Frei: define service value and build a credible funding mechanism. https://www.hbs.edu/faculty/Pages/item.aspx?research=7002
- MIT Sloan, Freund/van Ryzin: rapidly moving ridehail prices can undermine efficiency; do not mechanically chase every change. https://mitsloan.mit.edu/faculty/directory/daniel-freund
- FTC: monitoring public competitor prices is distinct from coordination; do not use a shared cross-competitor price-setting arrangement. https://www.ftc.gov/advice-guidance/competition-guidance/guide-antitrust-laws/dealings-competitors/price-fixing
- Google SRE: low-toil, useful measurement and only actionable alerting. https://sre.google/sre-book/monitoring-distributed-systems/

**Rollout limit:** This PR is an audit/sourcing design and reusable checker. A real continuously current national comparison would need explicit market-by-market suitable evidence and its legal/technical access. This design neither establishes that source nor purchases it. Preserve every existing market safety/insurance/screening gate.
