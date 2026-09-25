# American Rider — Launch Fare Model

Updated 25 September 2026. This document is the business contract for Standard Travel pricing.
The server remains authoritative; the app may display a quote but may never choose the charge.

## 1. Transportation fare

> **Travel Fare = max($4.50, $1.50 + $1.15 × routed miles + $0.25 × traffic-adjusted routed minutes)**

Distance pays for vehicle use. Time pays for the Operator's occupied time and congestion.
There is no general surge multiplier and no traveler-specific willingness-to-pay pricing.
Different departure times may therefore quote differently when expected road time differs.

If the production router is unavailable, the server may use its documented distance/time
fallback; the quote records whether time came from the router or from the fallback estimate.

## 2. Operator compensation

> **Operator base compensation = 99% × Travel Fare**

The 1% coordination commission has no cap. Tolls are not fare and are reimbursed separately,
whole, to the Operator when the Operator incurs them. Government/facility charges are
pass-through amounts and are not included in the 99/1 split.

Instant payout is optional. Any Stripe Instant Payout charge elected by an Operator is an
Operator withdrawal convenience cost, not a reduction of the displayed base compensation.

## 3. Traveler Total

> **Traveler Total = Travel Fare + platform charge + tolls + mandatory government/facility charges**

The traveler sees one Total Travel Cost before confirmation. Tolls and legally required
facility charges remain auditable internally even when the primary purchase surface is kept
simple.

For a U.S.-issued card, the launch platform-charge schedule is:

> **max($2.00, 5.00% × Travel Fare)**

For an international-issued card:

> **max($2.00, 6.50% × Travel Fare)**

The international increment mirrors Stripe's published additional 1.5 percentage-point card
processing charge. The platform charge funds card processing, Connect, routing/maps, hosting,
storage, monitoring, payment risk, and American Rider's operating contribution. It is not
described to the traveler as a Stripe fee.

The $2.00 floor and the percentage branch meet continuously:
- domestic: $40.00 fare -> $2.00 charge;
- international: approximately $30.77 fare -> percentage branch.

## 4. Payment-cost invariant

The amount displayed to an Operator as **You receive** is not reduced later by American Rider's
ordinary payment-processing or platform-infrastructure costs.

American Rider pays ordinary platform-side Stripe/Connect costs from its own platform revenue.
An optional Instant Payout fee may be borne by the Operator only when the Operator affirmatively
chooses that withdrawal method.

A first-time travel must not be deliberately priced on a payment schedule known to be
insufficient. The authoritative quote flow must know the selected PaymentMethod's issuer country
before the traveler confirms the final amount. Until that flow is proven end-to-end, it remains
a release blocker for international-card pricing.

## 5. No tipping

American Rider does not solicit gratuities. Operator compensation is designed into the Travel
Fare itself. Do not restore a tip surface or treat tips as part of modeled Operator earnings.

## 6. Pricing examples — domestic card, before toll/facility pass-throughs

| Travel | Travel Fare | Platform charge | Traveler Total | Operator receives |
|---|---:|---:|---:|---:|
| fare minimum | $4.50 | $2.00 | $6.50 | $4.46* |
| 0.89 mi / 8 min | $4.52 | $2.00 | $6.52 | $4.47 |
| 2 mi / 9 min | $6.05 | $2.00 | $8.05 | $5.99* |
| 6 mi / 16 min | $12.40 | $2.00 | $14.40 | $12.28* |
| 15 mi / 30 min | $26.25 | $2.00 | $28.25 | $25.99* |
| $50 fare | $50.00 | $2.50 | $52.50 | $49.50 |
| $100 fare | $100.00 | $5.00 | $105.00 | $99.00 |

*Server commission uses integer cents and floors the 1% commission, so exact cent outcomes are
authoritative in code.

## 7. Calibration policy

Short/medium/long categories are analytics bins, not separate rate cards. Recalibration uses
actual South-Florida completed Travels and comparable incumbent receipts. A rate change belongs
server-side and must preserve all of these invariants:

1. competitive Traveler Total across a representative distribution, not every instantaneous quote;
2. materially superior Operator dollar compensation;
3. positive American Rider unit economics after directly attributable platform costs;
4. no hidden reduction of the Operator's displayed compensation;
5. deterministic, auditable pricing logic.
