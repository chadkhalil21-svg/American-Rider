# American Rider — source-led pricing audit and freshness correction (13 October 2026)

## Commercial decision: simple, nationwide, Operator-sustainable, auditable

Our stated objective is **credible competitive ordinary all-in Traveler prices**, not mandatory 10% discounts, and the full 99% of Travel Fare reaches Operators. The current South Florida $1 + $0.85/mile + $0.15/min fare is a fallback, **not** a scientifically justified national price. There is no US-wide default price. A new market must establish local operator costs, full-trip utilization, regulatory minimum earnings, trip routing/fees, source provenance, traveler willingness to book, live service availability and price transparency independently. No price increase or new jurisdiction is authorized here.

**Universities, actual research (no personal endorsement):**
1. [Stanford GSB, Bimpikis/Candogan/Saban, Spatial Pricing in Ridesharing Networks (2019)](https://www.gsb.stanford.edu/faculty-research/publications/spatial-pricing-ridesharing-networks): origin conditions and unbalanced operator flows matter; flat national rates are unsound.
2. [Columbia/Carnegie Mellon/Harvard, Ma/Fang/Parkes, Spatio-Temporal Pricing (2021)](https://pubsonline.informs.org/doi/10.1287/opre.2021.2178): dispatch incentives and stable spatial/time prices matter; not permission to launch unexplained surge.
3. [Columbia, Yu/Ma, Iterative Network Pricing (2023)](https://arxiv.org/abs/2311.08392): weekly route/destination adjustment using the **prior week's observable conditions**, subject to assumptions including origin market clearing. It cannot calibrate a marketplace with no real quote/booking coverage.
4. [MIT, Simchi-Levi, Identify Optimal Prices (2017)](https://news.mit.edu/2017/identifying-optimal-product-prices-0918): compare similar journeys, test against actual sales, then optimize; retailer results are not rideshare forecasts.
5. [Columbia, value of travel time and quoted ETA](https://business.columbia.edu/faculty/research/personalized-pricing-and-value-time-evidence-auctioned-cab-rides): wait time changes value; prefer disclosed ETA/service conditions to secret behavioral or demographic personalized prices.
6. [Caltech, Price Cycles (2022)](https://authors.library.caltech.edu/records/gesmd-dgt86): erratic price/supply cycling can worsen reliability; protect Operator economics and avoid sharp real-time changes.

**Leading operating and design standards (not official company sponsorship):**
- [Google, production ML data monitoring](https://developers.google.com/machine-learning/crash-course/production-ml-systems/monitoring): validate the full data input population, not only its latest row; distinguish training/serving and require data freshness.
- [Google Firebase Firestore billing](https://firebase.google.com/docs/firestore/pricing) and [database best practices](https://firebase.google.com/docs/firestore/best-practices): unnecessary 90-day historical reads create avoidable per-document charges.
- [Amazon Builders Library, idempotent requests](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/): never duplicate batches on retries or treat a reused observation identity with different prices as the same intent.
- [Spotify Engineering, risk-aware experimentation](https://engineering.atspotify.com/2024/3/risk-aware-product-decisions-in-a-b-tests-with-multiple-metrics): conversion is not a sufficient success measure; Operator acceptance, cancellations, net contribution, refunds, safety and service reliability must pass guardrails.
- [Apple HIG, Apple Pay](https://developer.apple.com/design/human-interface-guidelines/apple-pay): present and confirm the actual total, with fees and later additions disclosed clearly.
- [Nielsen Norman Group, hidden checkout fees](https://www.nngroup.com/articles/sneaking/): disclose one clear complete Traveler Total rather than attractive fare followed by surprising fees.
- [NASA SWE-055 requirements validation](https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695440/SWE-055%2B-%2BRequirements%2BValidation): simulated checks do not establish that real-device payment, routing, airport/port admission or independently sourced market quotes work in the intended operating environment.
- FTC's special-purpose 2025 upfront-pricing Rule covers tickets/short-term lodging, **not generally rideshares**. Nonetheless transparent disclosure and avoidance of misrepresentation remain sound practice; do not call that particular rule a rideshare mandate.

**Council lenses:** Ford = one repeatable local cost-and-routing model; Rockefeller = good two-sided economics, reserve and automated failure recovery; Jobs = one credible price, no deceptive promotions or dashboard burden. These are our analytical perspectives, not meetings or endorsements.

## Actual defect found and corrected in this change

The prior eligible-reference builder combined up to **90 days** of prices in one per-condition cell and the runtime checked only its *newest* timestamp. Thus one current source record plus many obsolete source records could pass a freshness test and distort an observed-market median; the family and >=20 quorum could be falsely satisfied. A market with a tighter age plan was especially vulnerable. This was inconsistent with the goal of current market prices.

**Correction (no new collectors, databases, API keys, external service calls or live fare changes):**
- Reject individually stale (>30 days; or tighter plan threshold) and future-dated comparable source records from source medians, sample counts, family/provider quorums and candidate targets.
- Add both **oldest** and **newest** eligible-observation timestamps to each cell. A promoted price is refused if the oldest timestamp is missing, impossible or expired. Pre-existing legacy promoted cells lacking that field fail closed.
- Recompute candidates with no more than 30 days of records instead of prior default 90, reducing unnecessary Firestore document reads. Historical/public estimates remain research-only and unqualified.
- Test both old-quote poisoning (19 obsolete + 1 fresh), future timestamps, missing range, mixed families, all price-authority safeguards and the existing synthetic 10k/100k/1m scenarios.

**Not established:** current local independently comparable competitive quotes in all U.S. markets; city-level Operator utilization and livery vehicle expenses; valid prospective demand elasticity; real-device Stripe and app payment evidence; future jurisdiction-specific regulation. No promotion or automatic pricing adjustment may bypass those gaps.

## Smallest useful next pricing decision

Keep one deterministic server Total. For each jurisdiction **after legal/economic admission**, use versioned local Operator minimum pay + actual expense/duty assumptions as a sustainability *lower bound*, cross-check against unlicensed *public data* as research only, and conduct narrow pre-registered market/time-cell tests once genuine customer quote and completed-booking signals exist. Weekly updates only when data quantity and quality are sufficient. Choose a fare that maximizes dependable completed Travels with sustainable Operator outcomes, not an arbitrary '90% of competitors' promise. No per-Travel competitor quote API required.
