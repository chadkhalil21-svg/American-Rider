# National geographic starting-price candidates — audit implementation

**Status:** Draft PR #126. Offline research only. No nationwide price coverage, licensing, market activation, Firestore cost changes, or actual price data commissioning.

## Governing references and reasoning

- [U.S. Census / OMB CBSA delineation files](https://www.census.gov/programs-surveys/metro-micro/about/delineation-files.html): versioned county-to-metro/micropolitan/nonmetropolitan geographic classification, without a separate fare table for every town.
- [BLS May 2025 metro and nonmetro OEWS](https://www.bls.gov/oes/current/oessrcma.htm): independently published area employment/wage measurements. Observed wages are not legally required Operator net income, guaranteed future earnings or competitor prices.
- [AAA Your Driving Costs](https://newsroom.aaa.com/auto/your-driving-costs/): vehicle ownership/operating methodology. Must distinguish fixed and variable components and avoid double counting or treating national averages as local actuals.
- [Stanford GSB spatial pricing](https://www.gsb.stanford.edu/faculty-research/publications/spatial-pricing-ridesharing-networks): Operator location, availability and compensation matter, not just mile/minute rates.
- [HBS service excellence](https://www.hbs.edu/faculty/Pages/item.aspx?research=7002): fund the service system actually delivered.
- [Google Firestore best practices](https://firebase.google.com/docs/firestore/best-practices): keep regional profiles versioned/low write volume, avoid per-booking external research lookups and full-catalog rescans.
- [AWS Builder's Library idempotency](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/): duplicate releases and failed retries must not repeat writes or payments.
- [NASA validation SWE-055](https://swehb.nasa.gov/spaces/7150/pages/16449673/SWE-055%2B-%2BRequirements%2BValidation): offline computational tests are not live pilot evidence.

Council application is published reference guidance rather than claimed personal consultation or endorsement.

## Implemented offline calculation

Input: one **verified, versioned** county FIPS + economic area category (metro, micro, nonmetro), approved area net hourly compensation target, variable vehicle cost per mile, paid duty-time utilization, empty/pickup mileage factor, fixed per-Travel costs, dated distinct cost sources.

Output: a research-only regional coefficient candidate. For the Operator's 99% share:
- per-mile: ceil(vehicle cost/mile × (1 + empty/paid miles ratio) / 0.99)
- per-minute: ceil(target net cents/hour / (60 × paid duty fraction × 0.99))
- base: ceil(per-Travel fixed cost / 0.99)
- minimum: max($3.00, base)

The same economic area's approved input can inform multiple towns without generating a different table for every road, but **each county must first have a grounded national data mapping**. A population category does not establish a competitor's fare or permission to operate.

The module deliberately returns `status:'research-candidate'`, `bookable:false`, and `marketTargetVerified:false` on every result. It does not override `backend/market-pricing.js`, update `backend/markets.js`, activate any state, or call external APIs. This is NOT automatically deployed starting rates for every U.S. town.

### Conditions for actual production
1. Import real nationwide **versioned** Census county-to-CBSA/county grouping (including territories if in scope); geographically classify every supported pickup/destination correctly. Do not use county FIPS strings invented from names.
2. Import BLS regional earnings data and an appropriate documented vehicle-cost input, reconcile gross-vs-net targets, vehicle fixed/variable expenses, duty and pickup time, insurance, fraud, fees, tolls, taxes, federal/state/local law and scarce rural supply. Store source date and input version; reject stale data.
3. Validate against Operator hourly net earnings including empty miles, Traveler acceptance, wait times and complete unit economics. Adjust only approved geographic profiles.
4. If claiming 10% below the market, validate against independent, permitted **full actual passenger charge** observations. Neither Census, BLS, AAA nor American Rider's own fares prove competitor price level. The 90% target is a founder policy, not university guidance.
5. Market admission remains a separate fail-closed policy: state TNC insurance, screening, operations licensing, airport/port permissions, signed UX/payment test evidence and routing/tolls required before accepting a booking. Never open a state just because a cost profile exists.
6. No live money, real travelers or provider contracts are exercised by this document.

## Current other safeguards in draft

- `market-reference-authority.js`: stronger two-source cell qualification and 5-minute future timestamp skew check.
- `market-evidence-ingest.js`: reject future-dated observations at ingress.
- `market-reference-service.js`: no hourly Chicago refetch after a successful unchanged check, reject cross-market source contamination, research candidates do not overwrite live-promoted snapshots.
- `market-reference-cache.js`: 30 s / 128-entry / single-flight cache; no per-booking public competitor API request.
- `fareauthority.js`: only adjust from approved full traveler market totals when actual route and toll result are known; subtract toll/government pass-throughs once.
- Tests: 102,000 geography/cost scenario generations, 100,000 cached lookup operations, 22-day Chicago source replay, toll/card-country and source integrity failures. These synthetic tests **do not measure actual per-request Firebase invoice or CPU/network under peak national load**.

## Work still outstanding

An actual cost-data ingestion workflow, county mapping at nationwide scale, bias/accuracy holdouts, contract/legal rights to market-price observations, protection of critical scheduler during quota errors (GitHub issue #128), realistic distribution of Travel requests, live payment/screening/insurance/provider confirmations, and physical-device tests. Review the separate unresolved PR #124 before closing it; its old branch conflicts with current release.

No promoted live rates or deployment authorized by this audit. Exact-head twice-run CI and then authorized staged release required.
