# American Rider — Verified insurer status and Stripe refund/launch audit (2026-10-12)

**Purpose:** Source-led verification against the accepted founder decisions, read-only Stripe sandbox state, released code, and Google/Amazon/NASA guidance. This document does not grant commercial permission or certify physical-service readiness.

## 1. Insurance — decision versus legal condition

**Founder-confirmed current fact:** American Rider **has no automobile/TNC insurance and provides no coverage**. It does not buy, sell, underwrite, or bundle insurance; Operators are responsible for their own qualifying insurance. See accepted [ADR 0002](../decisions/0002-operator-funded-insurance.md). Neither software nor this audit bought a policy. No Operator-side qualification rule is being relaxed.

Florida 2026 [§627.748(7)(b)-(c)](https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0600-0699/0627/Sections/0627.748.html) permits driver-maintained qualifying coverage for ordinary insured periods; subsection (7)(d) nevertheless addresses TNC-maintained first-dollar coverage and defense if the Operator's policy fails. The company currently has no independently proven solution to that statutory condition. **Do not mark company_insurance_bound=true, open Florida paid bookings on this evidence, claim insurance is already held, or buy insurance without founder authorization.** See issue #51. Resolve via qualified Florida coverage/legal review; an automated block of new dispatches cannot cure claims arising before discovery of a lapse.

## 2. Stripe — what is complete, and what is not

**Direct test-account inspection October 12, 2026 (read only):** the linked Stripe sandbox has ONE successful 10,000-cent PaymentIntent and ONE 10,000-cent transfer. Both share transfer group `group_pi_3UJp1tAZW1pAcE2d3YO2Qh64`, and the transfer cites the corresponding test charge. Both objects have empty metadata. The sandbox contains **no refund and no dispute objects**. Therefore they demonstrate basic Stripe sandbox charge/transfer connectivity, **not** a complete identifiable American Rider Travel, 99%-of-fare split, cancellation, refund, reversal, dispute, signed-webhook recovery or final bank payout. Never re-purpose/refund these unrelated historical test objects.

**Existing implemented work retained:** backend/travelmoney.js ownership checks and in-memory adversarial tests; bookingrecovery.js automatic orphan/paid-unmatched cancellation and test idempotency; providerqueue.js durable webhook acceptance and bounded backoff; payments.js Stripe transfers with source transaction and server-derived fare; protected CI runs twice. Do NOT restart this completed synthetic program as though absent.

**Specific source defect confirmed against official Stripe object contract:** `refundTravel()` and `refundableFor()` read `pi.amount_refunded`, which is not the PaymentIntent's authoritative refunded-balance field. Cumulative refunds live on Stripe's [Charge](https://docs.stripe.com/api/charges/object), while the [PaymentIntent](https://docs.stripe.com/api/payment_intents/object) tracks payment progress/received amount. This can overstate remaining refundable balance and understate cumulative refund exposure in the app. `payments.js` now explicitly expands and validates the related Charge and fails closed when missing or inconsistent. `payments-refund-charge.test.js` exercises actual code against an offline Stripe-compatible stand-in twice: partial refunds, duplicate retries, over-refunds, invalid Charge, wrong ownership and network failure. **Zero network and real-money calls.**

**Actual Stripe sandbox proof still outstanding:** A fresh dedicated American Rider tagged test Travel must reconcile charge, processing fees, 99% Transfer to an owned Connect test account, controlled refund, reversal policies, simulated dispute and webhook acknowledgment. Existing plugin exposes test-account reads and refund creation but did not expose a PaymentIntent creation operation during this review. No new test objects were created; lack of permission is not evidence of successful provider testing. See issue #143. Do not alter production Stripe keys or submit real money.

## 3. Institutional design/assurance matrix — existing release versus real-world gaps

| Critical domain | Already simulated/reviewed | Independent still required |
|---|---|---|
| Payments & refunds | Exact-Travel ownership and retry-tested state transitions; Charge-based partial refund regression in this change | New tagged Stripe sandbox payment, refund, dispute, signed webhook and financial ledger reconciliation |
| Insurance & screening | 30+5-day monitoring with adverse lockout, qualified-Operator gates and permissioned documents | Authentic insurer confirmation, statutory company obligations, FCRA adverse actions and policy bind/endorsement evidence |
| Emergency & location | Congestion priority, failed GPS, 10,000 synthetic active Travels, duplicate alerts | Physical iOS/Android receipt, reachable responder, backup channel, human acknowledgment |
| Dispatch & pricing | Route cost authority, Operator assignment race, 10k/100k/1m demand forecasts | Measured arrival-rate load with p95/p99, independent current local quotes and actual Operator expenses |
| Database & outages | Quota recovery, leases, retry limits, cursor pagination and tests | Real observed billed read/write rates, Firestore quota/restore drill and error budgets |
| Teen & Family | Identity/guardian/PIN simulated checks | Real separate devices, guardian revocation, independent real notifications |
| Provider communication | Resend signed event/dedup and retries simulated | Actual end-to-end delivery and response under real failure |
| Android/iOS & accessibility | CI Expo exports, localization checks and static traces | Physical payment-sheet/background GPS/push/VoiceOver and recovery after relaunch |
| Geographic admission | Unknown states and restricted facilities fail closed | Florida operational legal approvals, airports/ports, signed insurance and contracts |

**Engineering reference framework:** Google [Firestore best practices](https://firebase.google.com/docs/firestore/best-practices) require cursor pagination, workload-tested scale and no unnecessary reads; Amazon [idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) and [bounded retries](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_mitigate_interaction_failure_limit_retries.html) prevent duplicate money/side effects; NASA [SWE-055](https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695440/SWE-055%2B-%2BRequirements%2BValidation) requires evidence in the intended customer environment, including adverse conditions. [Stripe test cards](https://docs.stripe.com/testing) support refunds/disputes without real money but should not be used as a throughput load test. The Council is a published evidence and product standard documented in `docs/COUNCIL-STANDARDS.md`, not actual interviews, endorsement or consulting engagements.

**Release discipline:** exact-head double-run CI, sandbox-only provider attempts with proper authorization, independent Render revision checks. Do not open a market, change fares, sign providers, buy insurance, or move real money based on this audit. If source or provider validation is missing, report it as missing.
