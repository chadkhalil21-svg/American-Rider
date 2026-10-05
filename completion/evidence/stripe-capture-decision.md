# Stripe payment capture policy — implementation checkpoint

**Source time:** 2026-10-04. **No provider transaction was made.** Current integration code uses one PaymentIntent per canonical Travel; it requires provider-confirmed `succeeded` before offering an Operator and treats an unmatched/cancelled capture as a refund obligation. This policy remains unchanged pending founder/merchant approval and live provider testing.

## Primary guidance

- [Stripe: Place a hold on a payment method](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method): `capture_method=manual` authorizes an eligible method and moves a confirmed intent to `requires_capture`; the authorization expires unless captured. Card-not-present validity varies by card brand and merchant/customer initiation (Visa merchant-initiated effectively 4 days 18 hours; Visa customer-initiated 7 days; many others 7 days). Payment method support varies; ACH and iDEAL do not support this flow. Customer statements may not distinguish a hold from a charge. Cancellation releases an authorization; partial capture typically releases the rest and often cannot be followed by another capture.
- [Stripe: Capture a PaymentIntent](https://docs.stripe.com/api/payment_intents/capture): only a capturable intent can be captured; uncaptured intents are canceled after a set number of days (7 by default), subject to the method/network's actual shorter `capture_before`. Capture succeeds to `succeeded` or fails; a new server-side state machine and expiration recovery would be required.
- [Stripe: Payment Intents API](https://docs.stripe.com/payments/payment-intents): use one PaymentIntent per purchase/session and idempotency keys; reuse it after interrupted checkout; use signed webhooks to detect final state; customer secret is not logged or embedded in URLs; avoid sensitive data in metadata. Saved off-session methods may face additional bank authentication.

## Decision boundary

| Option | Advantage | Failure/operational burden |
|---|---|---|
| **Current confirmed capture before offer** | One existing verified `succeeded` authority for offering and settlement, including scheduled off-session charges; simpler same-Travel recovery and provider reconciliation | Charge precedes supply; no Operator, cancelled, paused or timed-out requests become refund obligations. Refund fees, cash float, complaints and dispute exposure require measurement. |
| **Manual authorization then capture at acceptance** | Could release uncaptured holds on unmatched rides and reduce refund volume | Requires supported cards only, capture-expiry alarms, real-time accept/capture race controls, honest Operator/traveler UI while funds held, partial/changed fare policy, later off-session scheduled edge handling, webhook and reversal state overhaul. A hold is not collected funds and must not be labeled paid. |

**Provisional engineering choice:** preserve the currently tested capture-before-offer path rather than changing financial authority without approved merchant/consumer policy and device/provider evidence. Continue fail-closed admission, one Travel, refunded debt tracking and independent Stripe/bank reconciliation. Reconsider manual capture as a controlled later change only after a Stripe test campaign, actual refund/chargeback cost analysis and explicit founder/merchant approval of the consumer policy. A green local test cannot sign off the capture risk or reserves.
