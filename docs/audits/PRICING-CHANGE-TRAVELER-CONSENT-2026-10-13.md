# American Rider — pricing review and safe fare-change delivery (13 October 2026)

## Founder objective

Nationally consistent, independent, economically viable transportation. Begin with public local benchmarks, Operator cost and demand, then adjust prices using actual completed Travel and availability outcomes. 99% of Travel Fare to Operator; one honest all-in Traveler Total. Minimum new service-market costs and regional licensing are independent gates. **$21 for a 10-mile/25-minute standard Florida Travel is a RESEARCH candidate, not a verified current competitor quote nor a newly deployed fare.**

## What actual external research says, and does not say

- [Stanford GSB — Bimpikis, Candogan, Saban, Spatial Pricing in Ridesharing Networks (2019)](https://www.gsb.stanford.edu/faculty-research/publications/spatial-pricing-ridesharing-networks): demand balance and pickup/destination context matter. Does not supply Miami passenger prices.
- [Carnegie Mellon/Harvard, Fang/Parkes et al., Spatio-Temporal Pricing (2021)](https://doi.org/10.1287/opre.2021.2178): smooth origin/time pricing helps balance demand and Operator dispatch acceptance, subject to modeling assumptions.
- [MIT — Simchi-Levi optimal prices (2017)](https://news.mit.edu/2017/identifying-optimal-product-prices-0918): start by comparing similar offerings, test actual buying behavior, learn. Do not claim retail experiment gains transfer to our TNC.
- [MIT/Wharton Pricing Experimental Design (2023)](https://proceedings.mlr.press/v202/simchi-levi23a.html): learning demand by price testing carries revenue and downside risk. Pre-register, monitor and cap disruption; no early identity-based differential prices.
- [UC Berkeley 2024 actual Operator study](https://laborcenter.berkeley.edu/gig-passenger-and-delivery-driver-pay-in-five-metro-areas/): full duty time, vehicle wear, expenses and idle time must be counted; 99% share per booked Fare alone is not proof of good hourly earnings.
- [Consumer Reports March–April 2026 route-matched field methodology](https://github.com/consumerreports/lyft-uber): 17 states, 30 routes; same ordinary trip quotes can vary even when sampled within minutes. No unrestricted rights to monetize underlying volunteer observations are inferred.
- [Apple Apple Pay Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/apple-pay): present actual including fees/taxes and seek informed confirmation; explicitly discusses changing car-ride prices.
- [Amazon Builders Library: idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/): duplicate booking keys must reuse the original immutable booking; no repeated new charges.
- [Google Firestore pricing](https://cloud.google.com/firestore/pricing) and [best practices](https://firebase.google.com/docs/firestore/best-practices): avoid reads solely to police a price; reuse existing region record and server-computed Total.
- [NASA SWE-055 Requirements Validation](https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695440/SWE-055%2B-%2BRequirements%2BValidation): two-pass synthetic/CI success is not physical iOS TestFlight or real-money/airport safety validation.

**Council analytical lenses (not meetings or endorsements):** Ford: preserve one common rate and server path; Rockefeller: unit economics and 99% Operator fare protected; Jobs: one comprehensible total, and no surprise repricing at checkout. University/business/theoretical guidance informs the decision but does not magically create an actual quote in each region.

## The bug blocking safe future price changes

Current production South Florida coefficients are $1 + $0.85/mi + $0.15/min (min Fare $3), Platform Fee min $2.50. Existing modern mobile app sends `agreedTotalCents` to `/travel/prepare`; server compares against authoritative recomputation and returns 409 if different. However *older TestFlight clients omit this field*, and server formerly allowed them to book without that confirmation even after we change rates. They could see a lower old-app Total and book at a new higher rate.

**Safe correction:** During ordinary current-coefficient Florida operation, old clients remain accepted (no live pricing or availability regression). From the instant any base/per-mile/per-minute/minimum fare coefficient changes, the server demands an integer `agreedTotalCents` from the upgraded app, returning HTTP 428 with actionable upgrade instruction if absent **before booking/payment/dispatch**. Future regions fail closed by default. Modern clients already send the field; the prior exact-cent mismatch 409 check remains unchanged. Repeated booking idempotency returns a previously prepared immutable Travel as it did before—no new charge or Fare creation. No new database reads, API calls, services, feature flags, private user data, or user-interface controls.

**Tests:** 24k synthetic scenarios across two passes, domestic/international/unknown card country, tolls, government fees, Operator 99% split and platform contribution; static server ordering and four parameter-change checks; old-client compatibility only for the literal already-released Florida coefficients. All six protected workflows must pass exact PR head. **This is a prerequisite for making a fare increase, not permission or proof of actual market competitiveness.**

## Still needed to select and turn on rates

- Verifiable *current* and condition-matched full-passenger-Totals, or a transparent founder-approved economic starting-fare strategy that acknowledges competition is not verified.
- Operator and insurance/livery costs, pickup/deadhead utilization, traffic, first-trip ETAs, acceptance and cancellations in **each** Florida county.
- Device testing current and old app handling of 428 and 409 before any production rate increase. Current old TestFlight must be sunset with a replacement if a rate revision goes live.
- Sandbox PaymentIntent/receipt/Stripe idempotency evidence and State/airport/port legal gates where relevant. Synthetic tests alone cannot certify operating readiness.
- A separately reviewed single change to the pricing register to 100/95/32, rather than automatically changing live Traveler charges because this safety change passed.

## General strategy / what would be a better way?

**Do not build more competitor-price machinery.** Until we have data, use the evidence-labeled $21 Florida scenario as one candidate only, test against other cost-based options. For expansion obtain government fares and BLS/AAA/IRS as *context*, choose local-cost and legal floors, then small whole-market/weekly experiments after real booked/declined demand exists. Maintain a single server Total and a finite escalation path, not complicated opaque surges. Price by geography/route/time, never personal device/income/protected traits.
