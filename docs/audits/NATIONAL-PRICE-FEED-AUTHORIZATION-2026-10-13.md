# American Rider — National authorized price-source scope
**October 13, 2026. Research and connector safety, not source activation.**

## What this changes
The previously deployed authorized ordinary-price panel was restricted permanently to Miami-Dade/Broward/Palm Beach. This narrow repair makes the same small, rights-guarded, existing connector reusable for any explicitly licensed market **AFTER** that market receives a source-specific evidence plan and required approval. No expensive per-Travel competitor API calls.

- With no new environment variable, behavior is unchanged: three South Florida counties only, and NO network call unless explicit HTTPS URL, approval reference, research-use authorization, and read-only supplier token are ALL present.
- With `AR_PANEL_APPROVED_MARKET_IDS` present, treat it as an explicit **complete approved license scope**, e.g. `fl-miami-dade,fl-broward,fl-palm-beach`; not a wildcard, not inherited from Florida, not inferred from national geography. Empty, malformed, duplicated, wrong-source, unknown or region-only IDs disable the supplier collector entirely.
- A new county/state must FIRST get an explicitly registered plan containing `controlled-public-price-panel`; a research catalogue or FIPS code is not enough. Separate production market admission, regulated fees/insurance, county jurisdiction and source-promotion controls remain unchanged.
- Source still returns no more than 50 privacy-screened nonpromotional full ordinary Totals per call, strictly bounded decoded bytes, verified timestamp and strict market/identity. A fake future plan is test-only and cannot commission a real state.
- The market-reference scheduler remains periodic: no chargeable competitor API lookup per Traveler request. Publisher/source quota and cost caps still depend on the supplier's final contract.
- No paid provider has supplied credentials. The absence of source data remains a hard barrier to claiming independently verified ordinary local market pricing.

## Source-first verification and counterexamples
- City of Chicago true reported 2025+ TNC trips, current official published data: https://catalog.data.gov/dataset/transportation-network-providers-trips-2025 . Fares rounded to nearest $2.50, times rounded to 15 minutes, locality Chicago only. Free **retrospective** calibration for Chicago only if legally operating there later.
- NYC TLC 2026 High Volume FHV trip records: https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page . Public trip miles, time, base passenger fare and additional fee fields, typically two-month delayed. NYC only; never South Florida fare authority.
- Independent Consumer Reports March-April 2026 matched-route price observations: https://github.com/consumerreports/lyft-uber and https://www.consumerreports.org/money/questionable-business-practices/uber-lyft-different-prices-for-same-ride-and-fake-discounts-a1093538909 . 30 virtual routes across 17 states including Miami; real individual offers varied substantially for otherwise identical journeys. A limited, historical research sample; no demonstrated rights to continuously poll the underlying ride networks, nor representative all-route South Florida data.
- Gridwise commercial business analytics https://gridwise.io/analytics; 60+ market reports https://gridwise.io/gridwise-reports, no verified publicly free business feed. Consumer/free driver app is a different product.
- Obi FARE.AI https://obifareai.com expressly offers **one API call per quote** and requires supplier access; no confirmed self-service free local batch export. Its consumer app is not a commercial data license.
- Uber official developer docs https://developer.uber.com/docs/riders/references/api/v1.2/estimates-price-get warn competitive quote comparisons violate the API terms. No unauthorized scraper or protected endpoint.
- Actual current state: vendor outreach was previously sent to Obi and Gridwise by American Rider company Gmail; latest check confirmed only Obi automated absence reply, no authorized free or paid feed and no token.

## Governing design
NASA SWE-055 https://swehb.nasa.gov/spaces/7150/pages/16449673/SWE-055%2B-%2BRequirements%2BValidation requires objective validation that software works in intended customer environment. Google's Firestore read/write billing https://cloud.google.com/firestore/pricing supports bounded event/publication-based polling. Amazon idempotency https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/ supports stable observation IDs and conflict rejection. US FTC/DOJ considerations mean independent company pricing decisions, not competitive coordination.
The existing national price engine is not a promise of current countrywide market quotes; it computes controlled fare from route distance/time plus separately approved local references. Preserve 99% Operator Fare, all-in Traveler Total, toll/government pass-through and present modeled $2.50 fee floor. No price promotion or live market-opening in this PR.

## Two-pass validation
Existing `south-florida-authorized-panel.test.js` covers explicit scope, duplicate IDs, future plan mock, nonexistent state, rights refusal, bad URLs, failed supplier, size limits, private fields, time, batch limits; combined with existing six release workflows and separate full-platform synthetic stress. Tests cannot substitute for actual partner approval/real route observations or protected market admission.

**Founder-facing answer:** The national connection code can be commissioned and tested now, but we cannot create a truly current, licensed South Florida competitive fare feed simply by deploying code. A supplier grant or approved independently collected field study is required before 90%-of-ordinary-market prices can be presented as verified.
