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

## Independent Council review: what is priced and where it comes from

**The market does not publish one uniquely correct fare for a journey.** Actual offers change by time, account, vehicle class, service and availability. An NBER study audited 2,238 matched trips in NYC and observed mean absolute inter-platform gaps of about $3.50 (14%); this is empirical evidence against representing a 90% *target of a market-distribution estimate* as a guarantee cheaper than every live quotation. https://www.nber.org/digest/202602/do-rideshare-users-comparison-shop

**Do not conflate data types:**
- *Competitor market observed prices* — anonymized, verified completed-trip full passenger charge or consented matched quote panel, dated, permissioned; source for our 90% desired positioning.
- *Published city-level rate cards* — starting base/per mile/per minute/booking amounts for rough normal market baseline. Useful provisional research only; not reliable for surge/upfront/taxes/promotions. RideWise reports 312 cities across 50 states but public summary ownership and source collection are third-party; verify the rights to use the actual detailed records, underlying original rate cards, corrected observations and permitted analysis: https://getridewise.com/blog/rideshare-rate-card-analysis-300-cities .
- *Vehicle operating costs, regional wages, traffic, routing and our own booking conversion* — a compensation/economics and service-availability FLOOR, NEVER evidence of a competitor's price. Sources: 2026 AAA Your Driving Costs https://newsroom.aaa.com/2026/09/aaa-new-vehicle-ownership-costs-hit-12863-annually/ ; BLS local OEWS https://www.bls.gov/oes/current/oessrcma.htm ; Census CBSA https://www.census.gov/programs-surveys/metro-micro/about/delineation-files.html .
- *American Rider own bookings* — evidence of our own conversion, real operator acceptance, cancellation and contribution only; must not be recast as independent third-party market prices.

**Verified commercial leads, not yet licensed/integrated:**
- Gridwise Analytics has national/metro customer-price and driver earnings analytics; its weekly report product explicitly advertises **60+ markets**, not unlimited coverage or a public free per-quote API. No verified quote, contract or technical access yet. https://gridwise.io/gridwise-reports ; https://gridwise.io/analytics
- Obi publishes a proprietary Intelligent Pricing API used in its price comparison research and has broad geographic ambitions. No verified price, accepted competitive-use license or guaranteed U.S. rural coverage. https://rideobi.com/research/
- MIT-licensed illustrative 50+-city open-source fare calculator: https://github.com/vinceblock99/rideshare-fare-calculator ; code is permissively licensed, but **software licensing does not independently settle rights to or truth of input data**, and the author's own stated 10–15% accuracy gap is incompatible with certifying an exact 10% advantage. Do not silently integrate.
- Major competitor API forbids competitive pricing comparisons, and TaxiFareFinder API forbids storing results or statistical analysis to produce own fares. https://developer.uber.com/docs/riders/references/api/v1.2/estimates-price-get ; https://www.taxifarefinder.com/apitos.php?lang=en

**Council application, not endorsement:**
- Stanford Bimpikis/Candogan/Saban, spatial pricing: location-specific demand balance influences driver supply and consumer surplus; optimize metro coefficients and fleet reliability, not arbitrary town-by-town tables. https://www.gsb.stanford.edu/faculty-research/publications/spatial-pricing-ridesharing-networks
- MIT Sloan Freund/van Ryzin, rapid pricing oscillation: independent stable calibration and measured own network operations, not 1-minute copycat prices. https://www.sciencedirect.com/science/article/pii/S0968090X25003183
- HBS Frei, sustainable service funding: route-matched Traveler Total must clear actual Operator + infrastructure/processing/corporate obligations. https://www.hbs.edu/faculty/Pages/item.aspx?research=7002
- Uber marketplace simulation: simulate impact on assignment, acceptance, cancellation and service wait; a cheap price quote with no nearby Operator is NOT successful Travel. https://www.uber.com/us/en/blog/simulated-marketplace/
- Apple / IDEO / Emirates first-class benchmarks: clear one Total, reliable service, discretion; do not show diagnostic confidence/research internals to Traveler. https://developer.apple.com/design/human-interface-guidelines/design-principles ; https://designthinking.ideo.com/introduction ; https://www.emirates.com/us/english/experience/cabin-features/first-class/b777/
- NASA systems-engineering verification matrix and Lockheed Martin simulation: pin the input data version, source contract, calibration hash, tests and release SHA to each market promotion. https://www.nasa.gov/reference/system-engineering-handbook-appendix/ ; https://investors.lockheedmartin.com/news-releases/news-release-details/lockheed-martin-advances-construction-new-next-generation
- Google SRE/AWS: only actionable exceptions, release-aware source ingestion, no redundant full-market polling. https://sre.google/sre-book/monitoring-distributed-systems/ ; https://aws.amazon.com/blogs/architecture/reinvent-2019-introducing-the-amazon-builders-library-part-i/

**Source buying decision:** No unconditional subscription. For each candidate provider ask for (1) metro list including small/rural markets, (2) Standard economy class vs premium, (3) paid passenger **full Total** vs driver pay, (4) currency/time band and sample count, (5) all toll/government fee components, (6) refresh latency, (7) right to fit our own calibration, store aggregates and continue using them after contract cancellation, (8) API/CSV sample and versioning, (9) flat fee, usage/overage and cap. If missing any fundamental data right or sample quality requirement, decline. Evaluate cost **per successfully calibrated admitted metro / month**, not per 1M quote calls. High-volume transaction APIs are unnecessary for region coefficients.

**Free-first national cold-start:** Define geographic market profiles using Census OMB county-to-CBSA tables (metro/micro/nonmetro) and public operating cost constraints. A new municipality inherits its *approved economic market profile*, not a different city or state's arbitrary price. For metro without permitted third-party price observations, quote **only from an independently approved cost-and-compensation-floor profile** and explicitly mark competitive discount unverified. Never claim this is 90% below current market. Regional profile is separate from jurisdictional licensing/admission; adding a CBSA is NOT opening its market.

**Confidence and operational outcomes:** Use historical full Traveler Totals only when normalized and locally representative. Reject single vendor overconcentration, 90-day-old observations, unavailable/unknown class, multiple fees/airport ambiguity, missing routing and snapshot/version mismatch. Verify short-trip and 30+-mile holdouts, reject underpricing including fixed payout/card effects and Operator net negative. Trace observed conversion, acceptance, pickup ETA, trips per duty hour, contribution and returns as separate real performance measures, including in low-density towns. No simple 10%-below-average promise is defensible at the single-ride level.

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
