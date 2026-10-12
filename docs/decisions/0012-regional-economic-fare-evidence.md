# ADR 0012: Regional earnings, vehicle costs and fare evidence

**2026-10-12: RESEARCH ONLY. Not national commercial pricing or market admission.**

## Authoritative sources

**Wages:** BLS May 2025 OEWS: https://www.bls.gov/oes/tables.htm. The importer accepts native official all-data CSV/TXT with area, occupation and median hourly wages. It rejects missing, suppressed, conflicting or implausible values. Taxi driver SOC 53-3054 and chauffeur/shuttle SOC 53-3053 are occupational comparators, NOT independent Operator net earnings. The May 2025 BLS area definitions are necessary before mapping those records to county geography. 2023 Census metro codes cannot simply be assumed equivalent to 2025 BLS wage regions. The previous unattended BLS wage archive request returned HTTP 403 in GitHub Actions. Do not evade access controls, purchase unapproved data, or invent missing wages. This PR supplies input validation; it does **not** claim that live official wage archives have been ingested.

**Vehicle expenses:** IRS Announcement 2026-11 sets business standard mileage at 76 cents per mile July 1-December 31, 2026: https://www.irs.gov/irb/2026-29_irb. This is a tax benchmark, NOT a local actual rideshare vehicle cost or an approved fare. Do not add ordinary fuel, repair and depreciation expenses again over this proxy. Local costs, commercial insurance, financing, driver deadhead mileage, duty utilization, vehicle mix and corporate expenses still need measurement. AAA 2026 Your Driving Costs, https://newsroom.aaa.com/2026/09/aaa-new-vehicle-ownership-costs-hit-12863-annually/ , can cross-check but national new-car average is not a local operator invoice. IRS period expiry blocks relying on an unverified new-year rate.

**Observed rideshare totals:** Chicago 2025+ public transportation network provider trip dataset https://data.cityofchicago.org/d/6dvr-xwnh contains rounded Fare, Tip, Additional Charges and Trip Total. A bounded <=200 record City sample is an example of historical actual paid transactions only; it is not representative, current on-demand quotes, county coverage, or independent comparable route evidence. Trip Total includes optional tips and charges; matching actual Traveler Totals requires equivalent pickup/dropoff, time, distance, toll, service and legal rights. Historical NYC taxi data are a separate category, never silently equated with TNC quotes.

## Implemented research boundaries

- scripts/collect-national-pricing-evidence.py uses Python stdlib, accepts verified BLS offline data, optionally samples a capped public Chicago query monthly, records a dated IRS tax benchmark, source URLs and BLS checksum.
- scripts/collect-national-pricing-evidence.test.py repeats failure tests twice: suppressed wages, source conflicts, invalid city totals, future data, stale mileage period and fabricated market claims.
- .github/workflows/national-pricing-research.yml runs at most once monthly plus explicitly requested or proposed changes. It saves a short-lived artifact, not 3,144 per-county database writes. No external vendor request per Travel.
- Every record remains bookable=false, farePromotionAllowed=false, tenPercentBelowMarketVerified=false, nationalPricingCertified=false. Zero new fees, payment changes, provider contracts or service market activations.

## Must be completed before using national prices

1. Secure publisher-permitted official May 2025 BLS wage download and verified matching OEWS geographic definitions. Publish missing/suppressed counties without silent guessed fallbacks. BLS employee hourly earnings are NOT a statutory, contract or independent-Operator net target.
2. Independently measure local fixed/variable vehicle costs, insurance, deadhead miles, utilization, target Operator net, and fully loaded platform cost without double counting.
3. Obtain legally usable, contemporary, representative comparable full Traveler Totals in every active pricing market from independent source families; route-time/toll matching and holdout performance are required. Chicago City TNC data alone cannot substantiate 90% of ordinary market rates nationwide.
4. Check state/airport/port insurance, authority, payment, device and customer safety gates separately. Nationwide geography and economic research are never permission to book.
5. Target approximately 90% of verified ordinary Traveler market totals only when Operator and platform economics make it sustainable. Where they conflict, do not promise that discount.

This is an evidence adapter and fail-closed research audit, not a completed nationwide price claim. See issue #129 and the canonical PROJECT-LEDGER.md.
