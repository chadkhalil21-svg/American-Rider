# Miami Standard Fare Calibration — 29 September 2026

Status: **evidence-bearing calibration candidate; not production authority**.

Production remains governed by `backend/fares.js` and `backend/economics.js` until this document's promotion gates are satisfied.

## Decision

The existing unit-economics solver is retained. The current Standard fare coefficients
(`$1.00 + $0.85/mile + $0.15/minute`) are not accepted as a durable market calibration:
their repository rationale was anchored to one 5.04-mile / 15-minute comparison.

American Rider's pricing objective is **competitive Traveler Total**, not the lowest technically
possible Total. Operator compensation remains 99% of Travel Fare.

## Evidence basket

`data/miami-fare-calibration.json` contains 14 ordinary South Florida route observations spanning
5–40 miles and 17–66 minutes, plus three airport-origin validation observations kept out of the
ordinary fit. The observations are current historical route averages published by a leading
platform. They are market observations, not an endorsement and not an American Rider dependency.

Independent controls:
- Consumer Reports, 16 Jun 2026: 30 controlled virtual routes across 17 states; median low/high
  price-group difference 42.4%. This establishes that one instantaneous quote is not a stable
  market reference.
  https://www.consumerreports.org/media-room/press-releases/2026/06/consumer-reports-investigation-reveals-uber-and-lyft-ai-driven-pricing-tactics-lead-to-significantly-different-prices/
- RideAustin peer-reviewed study: 282,037 passenger trips among the busiest 200 drivers; 44% under
  3 miles, average 5.1 miles, about 71% within 15 minutes, average about 13 minutes. This controls
  the shape/weighting of the route basket; it does not set Miami prices.
  https://www.tandfonline.com/doi/abs/10.1080/19427867.2021.1892936
- South Florida mobility study using aggregate 2016–2019 Uber Movement data confirms that Miami
  ride-hailing has strong spatial clustering around major thoroughfares and airports. Historical
  evidence only; it does not set 2026 price.
  https://www.sciencedirect.com/science/article/pii/S2213624X20301085
- NYC TLC publishes current HVFHV trip records monthly. These are a national reasonableness dataset,
  not a Miami price source.
  https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page

Secondary Miami cross-checks are deliberately not fit as primary observations:
- TaxiFare.org reports a February 2026 Miami standard-class estimate of $27.73 for about 8 miles /
  21 minutes, medium confidence. This is materially above several direct route averages and therefore
  demonstrates source dispersion rather than a price to copy.
  https://taxifare.org/us/miami
- RideWise's 2026 Miami rate-card analysis is useful as a floor/rate-card cross-check, but rate cards
  do not equal observed upfront Traveler Totals.
  https://getridewise.com/compare

## Reproducible result

Run:

```
node scripts/calibrate-miami-fares.mjs
```

On the 14 ordinary observations, ordinary least squares on observed Traveler Total gives
approximately:

```
Market Total ≈ $9.356 + $0.954/mile + $0.152/minute
```

A planning position of 95% of each observed route-average Total is then reverse-solved through the
**existing** American Rider Platform Fee economics and fitted back to a simple Fare curve. The
resulting candidate is approximately:

```
Candidate Travel Fare ≈ $7.026 + $0.883/mile + $0.142/minute
```

This result is diagnostically important: the current mileage and time slopes are not far from the
basket fit. The principal underpricing is the **$1 base**, not evidence that miles or minutes should
be doubled. The candidate base is economically a minimum compensation/market-position component
that flows 99% to the Operator; it is not an American Rider booking fee.

Example, 8 miles / 21 minutes:
- observed route-average Total in the basket: $20.00;
- 95% calibration target: $19.00;
- current Fare formula: $10.95 before Platform Fee;
- candidate Fare: about $17.08 before Platform Fee;
- candidate Total: about $19.18 after the existing domestic-card Platform Fee solver.

This is why changing only the Platform Fee is the wrong correction.

## Why production is held

Four gates remain before changing `backend/fares.js`:
1. add independent or second-platform **observed upfront Total** sampling; rate cards alone do not count;
2. add short Miami observations below 5 miles so the fitted intercept cannot overprice very short Travel;
3. validate every basket route against American Rider's production road router for routed miles/minutes;
4. run fare/economics/payment tests across the full Fare domain and confirm no class, Smart Travel,
   toll, government-fee or international-card regression.

Until those gates are green, replacing production coefficients would be another under-evidenced
pricing decision. The calibration machinery and evidence are now reproducible; the hold is deliberate.

## National design

A market calibration record must contain: observation date, geography, route, routed miles, routed
minutes, observed Traveler Total, source class, airport/port flag, and inclusion/exclusion reason.
Each market fits its own evidence. The unit-economics solver remains national and centralized.
No production quote requires live competitor access.
