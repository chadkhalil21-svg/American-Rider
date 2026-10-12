# Verified-payment reconciliation review — 12 October 2026

## Existing decisions and scope

Read `PROJECT-LEDGER.md`, `docs/decisions/0002-operator-funded-insurance.md`, `docs/COUNCIL-STANDARDS.md`, existing refund PR #146/#147, provider retry PR #149 and open evidence issue #143. **American Rider has no insurance and provides none; Operators purchase their own.** This change has no insurance, market, rate, legal-gate, payment-authority, or customer-interface alteration.

## Design references reviewed BEFORE editing

- Stripe PaymentIntent and event types: https://docs.stripe.com/api/payment_intents/object and https://docs.stripe.com/api/events/types. `payment_intent.succeeded` means Stripe recorded payment; receipt is NOT proof it belongs to a correctly priced/owned Travel.
- Stripe recommends assigning order/Travel identifiers using authenticated server metadata: https://docs.stripe.com/api/metadata. Payment metadata is a reconciliation hint, not sufficient authorization.
- Amazon Builders' Library, retries and idempotent APIs: https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/. A second event for the same PaymentIntent must not repeat a support case or monetary action.
- Google Firestore operations and contention: https://firebase.google.com/docs/firestore/best-practices. No additional whole-fleet searches; preserve the existing one-Travel transaction and bounded writes.
- NASA SWE-055: https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695440/SWE-055%2B-%2BRequirements%2BValidation. Exercise nominal, invalid, duplicate, partial, failed, and delayed conditions; mock results do not certify connected services or real device usability.

## Real source discrepancy

`backend/webhook.js` returned success when `payment_intent.succeeded` lacked the `rideId` metadata. This removed a verified successful charge from further provider-event processing without reconciling it to an authoritative Travel or telling anyone. A present-but-invalid Travel or mismatched amount/owner was retried until the 12-attempt dead-letter policy, with no explicit money-reconciliation case.

Not every successful charge should be tied to a Travel: the existing Operator account-cost PaymentIntent explicitly carries `product: 'American Rider operator account cost'` with no rideId. This payment must not become a false Travel support case.

## Corrective scope

- Valid Operator account-cost payments are ignored by the *Travel* reconciliation branch, not refunded or transferred here. Other types remain subject to the normal payment processing rules.
- Valid, owned and exactly priced Travel payments use the existing Firestore transaction unchanged. A cancelled Travel's `refundPending` path remains unchanged.
- Successful payments without a Travel ID, with a missing Travel, or with mismatched owner/amount/currency/previous PaymentIntent now create an idempotent **support exception keyed by Stripe PaymentIntent ID**. Repeated provider events share the case. A failed support notification raises an error for the existing durable inbox to retry. No automatic refund, card charge, operator transfer, or invented Travel.
- Offline synthetic tests execute the real event handler twice: legitimate Operator cost, valid and cancelled Travels, missing reference, missing Travel, wrong owner, wrong amount, wrong currency, event replay, email failure and later recovery, malformed provider ID. No real Stripe objects, sender, or passenger data are used.

## Open, genuinely external proof

Provider-side Stripe SANDBOX still has only an untagged 100-dollar payment and transfer and zero refund/dispute objects and test webhook endpoints (latest check 12 October 2026). The actual signed-provider inbox, fresh tagged test Travel through charge/refund/Connect/dispute and physical iOS/Android payment sheet remain **NOT certified**, tracked in issue #143. Real emergency notifications and human acknowledgment (issue #138), measured capacity/billed reads, and separate Florida statutory insurance duty (issue #51) remain unsatisfied. Readiness gates must not be lowered for test completion.

Council review applies the published founder-ratified engineering and service rubric from `docs/COUNCIL-STANDARDS.md`, not personal consultation or endorsement by named historical figures or institutions. Deploy only when every exact-head protected workflow succeeds, then independently verify backend, main website and preview are live on the same merge SHA.
