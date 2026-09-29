# American Rider Cost Model — 29 September 2026

Status: **current verified cost map; corporate unknowns remain explicitly unpriced**.

This document separates (a) cash transaction costs, (b) internal provisions, (c) fixed/scale
infrastructure, and (d) unresolved corporate costs. A provision is not an invoice.

## 1. Per-Travel payment economics

Current Stripe public US standard pricing:
- domestic card: 2.9% + $0.30 per successful charge;
- international card: +1.5%; FX is +1% only if conversion is used;
- dispute received: $15;
- original payment-processing, Connect and currency-conversion fees are not returned on ordinary
  card refunds.
Source: https://stripe.com/pricing

Current Connect pricing when the platform controls pricing:
- $2 per monthly active connected account (active when a payout is sent to bank/debit card);
- 0.25% + $0.25 per payout;
- 0.25% of payout volume for funds routing/platform management;
- Connect Instant Payout: 1% of payout volume.

These are distinct services, not three card-processing charges. Card processing accepts the
Traveler's payment. Connect funds-routing moves the Operator share through the platform architecture.
Connect payout pricing applies when accumulated connected-account funds are sent to a bank/debit
card. The repository's 0.50% variable line combines the two percentage-based Connect components;
its 6-cent line amortizes the fixed 25-cent-per-payout component under an assumed payout cadence.
Source: https://stripe.com/connect/pricing

`backend/economics.js` currently models:
- 2.9% + $0.30 domestic card processing;
- 4.4% + $0.30 international-card processing;
- 0.50% Connect variable cost (0.25% payout + 0.25% funds routing);
- $0.06 fixed payout allowance per charged Travel;
- $0.25 contingency provision;
- $0.25 operating/infrastructure provision;
- at least $0.75 contribution after those items.

The separate $2 active-account charge is handled by `backend/operatorfees.js`, not charged to
Travelers in `economics.js`.

### $20 domestic-card example

The existing solver can produce exactly $20.00 as:
- Travel Fare $17.89;
- Platform Fee $2.11;
- Operator 99% of Fare = $17.72 (commission floors to whole cents);
- American Rider gross = $2.28.

Modeled cash/provisions:
- card processing: $0.88;
- Connect variable: $0.09;
- fixed payout allowance: $0.06;
- contingency provision: $0.25;
- operating/infrastructure provision: $0.25;
- contribution: $0.75.

The last three lines require careful language. The two 25-cent amounts are management allocations,
not vendor invoices. The $0.75 is the amount the pricing solver requires **after** both allocations.

## 2. What the 25-cent contingency is

`CONTINGENCY_RESERVE_CENTS = 25` is an American Rider pricing policy. No vendor takes 25 cents.

It is a provision for exceptional transaction/service losses such as:
- unrecovered refund processing/Connect cost;
- dispute/chargeback fees and unrecovered principal where American Rider bears it;
- fraud/payment loss not otherwise shifted;
- exceptional Traveler service credits/refunds;
- reconciliation corrections and small operational loss events.

Actual contingency loss per completed Travel is:

```
(actual contingency losses in period) / (completed Travels in period)
```

That realized number can be below, equal to, or above $0.25. The $0.75 contribution floor does not
cause a loss and does not consume the reserve. It is a separate required margin.

Reserve accounting for management projections:
```
provision = completed Travels × $0.25
reserve release/(shortfall) = provision − realized contingency losses
```

Do not count both the full reserve provision and an unused reserve release as expenses. Cash is
fungible, but management reporting should keep the reserve designated until loss experience supports
a lower provision.

## 3. Infrastructure actually selected by the repository

### Routing / transit / geocoding
The architecture is self-hosted OSRM + OpenTripPlanner + geocoder rather than per-call commercial
maps. A DigitalOcean Basic 16 GiB / 8 vCPU Droplet is currently $96/month; 8 GiB / 4 vCPU is
$48/month. Source: https://www.digitalocean.com/pricing/droplets

The repository's planning architecture can colocate OTP, OSRM and geocoding initially. Capacity per
server must be load-tested; no honest model should invent "Travels per server" before that test.

### Backend compute
Current application endpoint is on Render. Current public web-service prices include $25/month for
1 CPU/2 GiB, $85 for 2 CPU/4 GiB, $135 for 2 CPU/8 GiB and $175 for 4 CPU/8 GiB. Static sites are
free. Source: https://render.com/pricing

The exact production instance choice is a deployment decision; projections should show the selected
plan rather than silently assuming the free tier.

### Firestore
Current Standard-edition us-central1 list pricing is $0.30/million document reads, $0.90/million
writes and $0.10/million deletes, after free quota; 50,000 reads/day and 20,000 writes/day are in
the free quota. Sources:
https://firebase.google.com/docs/firestore/standard-edition
https://firebase.google.com/docs/firestore/pricing

The repository's historical infrastructure document used an older/higher read price. At current
$0.30/million, a pathological whole-fleet dispatch scan still scales badly in architecture even if
the dollar amount is lower:
- 1,000 Operators × 100,000 Travels = 100M reads ≈ $30 before free quota;
- 10,000 × 1M = 10B reads ≈ $3,000;
- 65,000 × 12.5M = 812.5B reads ≈ $243,750.
A geo-index remains the correct fix; the cost should not be normalized as acceptable waste.

### Map tiles / object storage
Cloudflare R2 Standard: $0.015/GB-month, $4.50/million Class A operations, $0.36/million Class B,
10 GB storage + 1M A + 10M B free monthly, and Internet egress free.
Source: https://developers.cloudflare.com/r2/pricing/

MapLibre itself is open-source; the architecture avoids per-Travel map-display pricing.

### Transactional email
Resend: Free 3,000/month; Pro $20/month includes 50,000 transactional emails and $0.90/1,000
overage; Scale $90/month includes 100,000. Source: https://resend.com/pricing

### App build/distribution
Expo EAS: Free $0; Starter $19/month; Production $199/month plus additional usage. Production
includes $225 build credit and updates to 50K MAUs. Source: https://expo.dev/pricing

Apple Developer Program: $99/year. Source: https://developer.apple.com/programs/

### Toll resolution
`backend/tolls.js` invokes HERE only for toll-cost resolution. HERE confirms requesting toll cost
counts as an additional transaction, but public documentation does not establish American Rider's
actual contracted per-transaction price. Treat this as **unpriced until account/contract pricing is
known**, never as $0. Source:
https://docs.here.com/routing/docs/routing-v8-tolls-for-route

## 4. Costs deliberately outside American Rider's ordinary Travel expense

Under the current product doctrine:
- Operator vehicle, fuel, maintenance and depreciation: Operator cost, not platform cost;
- Operator qualifying commercial/TNC/livery policy: Operator cost;
- Operator screening: Operator cost;
- toll principal: Traveler pass-through, reimbursed whole to Operator;
- government/airport/port fee principal: Traveler pass-through, remitted whole;
- Operator-funded Instant Payout fee: not an American Rider subsidy when the Operator elects it.

Pass-through principal is not revenue. American Rider still prices the payment-processing effect
caused by collecting pass-through money.

## 5. Corporate costs not yet truthfully priceable

The repository does not yet contain authoritative invoices for:
- Florida TNC-level corporate insurance/backstop exposure;
- outside legal counsel;
- CPA/tax/compliance;
- paid customer/operator support labor;
- payroll/benefits;
- office/facilities;
- production security/audit services;
- HERE toll account/contract usage;
- any future vendor replacing self-hosted components.

These are not zero. They are **unknown**. No projection may be called fully loaded until material
items have quotes/budgets and are allocated against conservative volume.

## 6. Scale view: why the platform is inexpensive but payments are not

At a representative $20 domestic-card Travel, modeled AR gross is $2.28. The payment/Connect cash
cost modeled before internal provisions is about $1.03, or roughly 45% of AR gross. The two internal
25-cent provisions consume another $0.50 of modeled gross, leaving $0.75 contribution.

Thus the dominant known marginal cost is **payments**, not maps, routing or email.

Illustrative constant-$20 mix (not a revenue forecast):

| Travels/month | Traveler volume | AR gross | payment+Connect model | contingency provision | operating provision | contribution |
|---:|---:|---:|---:|---:|---:|---:|
| 10,000 | $200,000 | $22,800 | ~$10,300 | $2,500 | $2,500 | $7,500 |
| 100,000 | $2,000,000 | $228,000 | ~$103,000 | $25,000 | $25,000 | $75,000 |
| 1,000,000 | $20,000,000 | $2,280,000 | ~$1,030,000 | $250,000 | $250,000 | $750,000 |

The operating provision is intentionally much larger than the currently visible fixed software
invoice at low volume. At 100,000 Travels it provisions $25,000/month; at 1M it provisions
$250,000/month. That excess is not evidence that infrastructure costs that much. It is a buffer for
infrastructure plus unresolved operating/corporate expense. Once actual vendor and corporate costs
are known, this allowance should be recalibrated rather than automatically spent.

## 7. Projection rule

Every forecast must show, separately:
1. Traveler transaction volume;
2. Operator compensation;
3. American Rider gross revenue (1% commission + Platform Fee);
4. processor/Connect cash expense;
5. realized contingency losses;
6. actual infrastructure/vendor expense;
7. corporate fixed/semi-variable expense;
8. reserve provision/release;
9. contribution/EBITDA/cash flow, with those terms not conflated.

This prevents a $0.25 provision from being mistaken for a $0.25 vendor bill and prevents cheap
infrastructure from being mistaken for fully loaded profitability.


## 8. Payout-cost correction

The current 6-cent fixed payout allowance is a **planning assumption**, not an intrinsic per-Travel
Stripe fee. Stripe supports daily, weekly, monthly and manual payout timing. The 25-cent fixed
Connect payout component therefore belongs mathematically to a payout event:

```
fixed payout cost per Travel = $0.25 × standard payout count / completed Travels
```

Examples:
- 20 Travels + 4 standard payouts/month = 5.0 cents/Travel;
- 100 Travels + 4 payouts = 1.0 cent/Travel;
- 200 Travels + 4 payouts = 0.5 cent/Travel.

Operator-elected Instant Payout must be configured so its incremental Instant Payout fee is borne
by the electing Operator rather than socialized across Travelers/other Operators, subject to the
actual Connect account configuration. American Rider must not promise that ordinary Connect payout
cost disappears merely because an Operator chooses Instant Payout: the platform's contracted
Connect pricing and the incremental instant fee are separate concepts.

Before commercial launch, replace the hard-coded 6-cent long-run assumption in management reporting
with actual monthly payout-event accounting. Quote-time economics may retain a conservative
allowance until enough payout behavior exists to estimate it safely.

## 9. Platform Fee floor versus contribution floor

These are independent controls.

Current:
- minimum Platform Fee = $2.00;
- minimum contribution after modeled costs/provisions = $0.75.

A proposed $2.50 minimum Platform Fee does **not** mathematically create $1.25 contribution.
Illustrative domestic-card results under the current cost model:

| Travel Fare | current minimum fee / contribution | $2.50 fee floor / contribution | fee needed for $1.25 contribution |
|---:|---:|---:|---:|
| $10 | $2.00 / $0.84 | $2.50 / $1.32 | $2.50 / $1.32 |
| $20 | $2.16 / $0.75 | $2.50 / $1.08 | about $2.67 / $1.25 |
| $30 | $2.40 / $0.75 | $2.50 / $0.84 | about $2.92 / $1.25 |
| $50 | $2.90 / $0.75 | $2.90 / $0.75 | about $3.41 / $1.25 |
| $100 | $4.13 / $0.75 | $4.13 / $0.75 | about $4.65 / $1.25 |

If the business policy is "$2.50 minimum Platform Fee **and** at least $1.25 contribution," both
constants must change and the solver should remain responsible for raising the fee above $2.50 when
necessary. Do not change either production constant until market-position tests show the resulting
Traveler Totals remain inside the approved competitive band.

## 10. Adverse-event control and reserve measurement

Do not invent an American Rider chargeback percentage before launch. Measure:
- payment authorization failure rate (failed attempts / attempts);
- dispute count rate (disputes / settled card transactions);
- dispute dollar loss rate (net lost principal + fees / settled card volume);
- fraud loss rate;
- refund/service-credit rate and unrecovered processing cost;
- reconciliation adjustments;
- recovery/win rate and time to resolution.

Payment failures that are declined before a successful charge are principally conversion/service
events, not automatically cash losses. Fraud/disputes that settle and are later reversed can be
cash losses. Keep these categories separate.

External risk guardrails are controls, not forecasts. Visa's VAMP metric combines fraud and
dispute counts over settled card-not-present transactions; card-network monitoring thresholds are
far too high to be treated as an acceptable American Rider operating target. Stripe notes that
chargeback rates vary materially by industry and business model. American Rider's 25-cent reserve
must therefore be recalibrated from its own cohort loss data after launch.

Operational controls required at launch: Stripe Radar/risk signals, idempotent PaymentIntents and
webhooks, authenticated Traveler/account binding, receipt/route/Travel-number evidence retention,
refund authority/audit trail, dispute webhook queue, evidence packet generation, reconciliation
exceptions, and weekly risk reporting. Reserve review monthly initially; never lower it from a
small sample.
