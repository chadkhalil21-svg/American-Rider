# American Rider — fully loaded Travel contribution audit (prelaunch)

**Date:** 2026-10-11. **Evidence standard:** sources and current `release/current` code before design; business-school published service funding and marketplace research; Google SRE cost/capacity planning. **This report supersedes the unsupported use of the $1.14 figure as “net profit.”** It does not change live quote pricing or claim that a business with no launched paid Travels has earned a profit.

## Decision

The existing `backend/economics.js` solves a minimum fee against **selected transaction cash fees plus two INTERNAL 25-cent provisions**, then ensures an additional minimum $0.75 modeled contribution. It is a transaction contribution **budget**, not an invoice-by-invoice reconciliation of *all* platform and corporate costs. A realized profit calculation must replace assumptions with verified supplier invoices, payouts, paid support/labor, insurance/legal/CPA, and billed use divided by completed Travels, together with costs caused by Operators who remain online without completing any Travels. There is no evidence that the monthly fixed expenses and variable supplier charges fit inside the 25c overhead in every activity mix.

### Previously completed cost analysis — reused, not rebuilt

Read `docs/COST-MODEL-2026-09-29.md` before this report. It already defines four layers: payment costs, internal provisions, infrastructure, and unquoted corporate expenses. The September cost map contains now-stale examples with a **$2.00** minimum fee. **Current `backend/economics.js` is $2.50 minimum**, including international-card fail-safe and Connect payouts. The old $2.00 example and Sept gross/fee allocation must NOT be represented as today's live pricing. No new fee change was made.

### Exact audited current $20 domestic example

Fare $17.50 + Platform Fee $2.50 = Traveler Total $20.00. Operator receives **$17.33** (99% of Fare rounded down cent for 1% commission). American Rider gross $2.67 (not $20 revenue). Domestic Stripe $0.88; modeled Connect percentage $0.09; 6c assumed payout allowance; internal contingency $0.25; internal operating allowance $0.25; **$1.14 modeled contribution AFTER those assumptions**.

For the same Fare/fee with a non-US card, modeled contribution is **$0.84**. This is only a $0.09 cushion above the system's minimum modeled $0.75 contribution. FX charges (if settlement creates conversion), other international fees, actual plan/payment-method mix and unpriced company costs are separate.

### Previously omitted account-level economics

[Stripe Connect current pricing](https://stripe.com/connect/pricing) charges platforms handling pricing **$2 per monthly active payout account** and **0.25% + 25c per payout**, plus **0.25% for funds routing**. Current `backend/operatorfees.js` tries to charge an eligible Operator the $2 monthly account cost (plus their card cost) if fewer than **20** completed Travels. **It WAIVES the fee with 20 or more Travels**. Therefore at exactly 20 completed Travels, the platform incurs a **10c per Travel account cost** despite a waiver; the code does not deduct that specific charge directly at Travel quote time. It *might* fit in the 25c general allowance; no allocation has been established. A scheduled payout four times per month is $1 in fixed payouts, averaging **5c** over 20 Travels, but **20c** over five Travels—versus the current 6c flat quote allowance. The user's per-Operator monthly ride distribution and actual payout frequency are therefore material. The $2 collected below 20 rides only offsets costs once collection ACTUALLY succeeds; nonpayment and declined cards are not guaranteed recoveries.

### Reconciled margin identities

Retain the $0.25 contingency as a conservative unreleased provision and compare actual realized contingency losses against it (only charge losses **above** the provision additionally); never call it a Stripe fee, charge it twice, or simply treat unused provision as distributable profit before a reviewed release.

```
Contribution before actual operating overhead
  = model contribution + assumed 25c operating allowance + assumed 6c payout allowance
  = $1.45 domestic, or $1.15 international per example Travel.

Actual risk-reserved contribution per Travel
  = pre-overhead contribution
    − actual fixed payouts (25c × payouts / Travels)
    − actual Connect monthly active-account charge / Travels
    + actually collected separate Operator account fees / Travels
    − actual variable platform/provider/support overhead per Travel
    − fixed corporate + compute + compliance expense / Travels
    − realized contingency losses exceeding prior reserve provision / Travels.
```

For **one** Operator completing 20 domestic-card Travels/month, four standard payouts, account $2 charge **waived**, and zero other fixed monthly costs, the base *before OTHER overhead* is **$1.30 per Travel**. With actual other overhead at **$0.25** it produces **$1.05** risk-reserved contribution; at **$0.60**, $0.70 (below the $0.75 policy minimum); at **$1.50**, **−$0.20** per Travel. For international cards, base before other overhead is $1.00, so just $0.25 of other expense reaches the $0.75 target. These sensitivity numbers are arithmetic tests, **not actual carrier/hosting/support bills**.

The management-only `backend/fully-loaded-coverage.js` and its deterministic test replace the 6c/25c assumptions with supplied actual payouts, Connect accounts/collections, actual-style variable/fixed expenses and excess risk. This is **not** called by live quotes. A field left unpriced must NOT silently become zero in executive profit reporting: synthetic zero means scenario baseline only.

## Real external supplier rates and code ownership (current source checked)

| Cost | Vendor authority / code | Cash vs assumption | Missing measurement |
|---|---|---|---|
| Cards / Stripe processing | [Stripe payment prices](https://stripe.com/pricing) / `backend/economics.js` | 2.9%+30c domestic, 4.4%+30c international in current solver | actual charge type, invoice, FX, refunds, payment-method mix |
| Connect routing, payouts, account | [Stripe Connect](https://stripe.com/connect/pricing), `backend/operatorfees.js` | 0.5% combined percent + 6c **payout assumption**, $2 active/month handled separately and **waived >=20 Travels** | actual active counts, payout number, fee collection, Connect account price configuration |
| Disputes / refunds / failed charges | [Stripe dispute fee](https://stripe.com/pricing), docs cost model | 25c **risk provision**, not actual average losses | loss rate, unrecovered principal, complaint volume, chargebacks, payout reversals |
| Backend | [Render compute](https://render.com/pricing) | **Verified** one Ohio `0.5c-512mb` Render web server, list rate **$7/month**; main/preview are **static sites** | actual invoice, static bandwidth/egress, scaling/multi-instance requirements |
| Fleet positions / updates | `backend/server.js /operator/online` and `backend/geooperators.js` | on-duty periodic renewals plus indexed bounded location candidate reads; Firestore billed separately | operator hours, renewal rate, listener fanout, write/index billed usage by collection |
| Firestore Blaze | [Firestore billed operations](https://cloud.google.com/firestore/pricing) | Standard region illustrative $0.03/100k reads and $0.09/100k writes beyond free | production database region and billable index/listener/storage/network usage per Travel and duty-hour; Google billing plan not verified |
| Address, map, street routes | `src/location.ts`, `src/backend/placeSearch.ts`, `backend/streets.js`; [DigitalOcean](https://www.digitalocean.com/pricing/droplets) | Native device location/reverse geocoding; backend `/place-search` and self-hosted OSRM/OTP strategy. A **planned** 16 GiB routing server would list at ~$96/mo, but **not verified as provisioned/billed** | real geocoder source and API entitlement, routing/traffic quality, workload, hosting invoice |
| Toll-cost fallthrough | `backend/tolls.js`; [HERE toll guide](https://docs.here.com/routing/docs/routing-v8-tolls-for-route) | HERE toll request incurs additional provider transaction (not necessarily every Travel) | account contract, per-call price, authorized TNC/commercial uses, fraction of quotes requiring toll |
| Push and transactional email | Expo push / `backend/push.js`; [Resend pricing](https://resend.com/pricing) | Resend paid Pro $20/mo/50k transactional emails, $0.90/1k overage; actual Resend plan unverified | number per Travel/onboarding, OTP/email, push, deliverability/support bill |
| SMS / voice / special communications | optional `twilio` dependency; [Twilio US SMS](https://www.twilio.com/en-us/sms/pricing/us) | ~0.83c per outbound SMS segment **plus carrier fees**, not a claim that every Travel sends SMS | implemented send path, carrier registration, call time, consent, operator/traveler mix |
| Build, app updates, storage | [Expo EAS](https://expo.dev/pricing), [Cloudflare R2](https://developers.cloudflare.com/r2/pricing/) | optional Production $199/mo plus usage, R2 separately metered | actual plan, OTA MAU, tiles/object use, storage retention and backups |
| Screening / verification | provider-neutral screening, insurer verification, document automation | Operator pays required policy and screening; **platform verifier/dispute/review labor is not necessarily zero** | executed CRA contract, actual verifier fees, false positives, exception percentage |
| Company liability, compliance, service | D02 + Florida statute, corporate accounting and support | no verified full expenses, vendor contract or company TNC backstop invoice in repository; founder's policy remains unchanged | company-level statutory insurance obligations, counsel/accountant/taxes, 24/7 critical safety support, fraud/security, airport permits |
| Customer acquisition and refunds | marketing, referral campaigns, refund events | **not priced by 25c as known cash cost** | cost per acquired paying Traveler/Operator, conversion, repeat Travel, subsidy and retention |

**Vendor cost caveat:** Some suppliers offer different price schedules or forbid certain regulated use cases in cheap plans. E.g. [HERE plan exclusions](https://www.here.com/get-started/pricing/rps-limits-excluded-use-cases) may matter for location/asset tracking; American Rider currently uses HERE only as toll fallback but must confirm its particular plan and intended commercial license. Never assume a free-tier or a published low-cost SKU applies to all nationwide TNC use.

### Live Resend usage evidence retrieved during this audit

Read-only [Resend account usage](https://resend.com/pricing) reports **3/100 daily emails and 4/3,000 monthly** (at query time), with one of three permitted domains and 10 requests/sec. Those limits match the provider's **Free** plan. This is real current limit evidence, not a guessed monthly bill or a demonstrated scalable commercial email service. A platform sending 1–3 emails per completed Travel could exceed the 100/day limit at surprisingly low Travel volume, even before Operator onboarding, insurance reminders, lost items, disputes and support. The **Pro** public price is $20/month for 50,000 transactional messages with no daily email limit and $0.90 per 1,000 overage; actual billing enrollment/contract remains an owner action. A resilient TNC should set alerts and an appropriate paid plan **before** routine high-volume launch; do not design a customer notification failure into a free-tier ceiling.

## Institutional decision: price model and commercial launch

- [Harvard Business School / Frances Frei](https://www.hbs.edu/faculty/Pages/item.aspx?research=7002) says successful service offerings require an explicit funding mechanism. An undocumented overhead provision is an **engineering assumption**, not an explicit funded service cost.
- [Google SRE capacity planning](https://sre.google/sre-book/introduction/) says forecast demand, load-test *service* capacity, observe performance and balance resource cost with availability. A one-million iteration simulation does not certify real cloud throughput/expenses.
- [Stanford GSB / MIT Sloan pricing evidence](decisions/0005-institutional-pricing-blaze-and-florida-assessment.md) supports local demand/driver economics and avoiding unstable instant price swings. Test quoted Traveler Total AND Operator acceptance/earnings, not just fee income.
- [Ford / Rockefeller / Jobs council rubric](../COUNCIL-STANDARDS.md): automate cheap routine reconciliations; measure the full marginal service cost; provide one reliable quote. These figures are a reference framework, NOT living advisers who were consulted.

**Release and change constraint:** This is a source-led financial audit + management-only calculator + regression tests. No user-facing fare, payment, operator percentage, insurance rule, TNC coverage evidence, additional subscription or commercial market admission is changed. Do not alter production fee floors without measured invoices and a market price/Operator outcome review.

## Minimum evidence needed to say the $20 Travel is actually profitable

1. Read billing invoices/usage from Stripe, Render, Firebase, Resend, maps/routing, communications/storage (once available), reconciled to billable API calls/transactions; avoid repeated screenshots when plugin exists.
2. Resolve actual expected waived Connect-account share and payout rate by Operator monthly cohort (1,5,20,50,200 Travels/month), including unsuccessful account-cost collections.
3. Quantify completed Travels/month, Online Operator-hours and fleet utilization (including idle 0-Travel months) to allocate fixed compute and compliance.
4. Obtain actual corporate insurance/legal/CPA and safety/support budgets, test dispute and refund losses and physical failure support obligations. **Do not treat company insurance as zero solely because operators pay for their own policy**.
5. Reconcile totals with `backend/fully-loaded-coverage.js` and publish net contribution plus monthly fixed-cost break-even point, including severe downside and international-card scenarios.
6. Run exact-head backend/Firestore stress and scale suites *twice*; then validate real pilot cost per Travel, per active Operator-hour and per month without charging real passengers in uncontrolled tests.

**Status: model exists and is positive in supported scenarios; full cost recovery is NOT yet audited.**
