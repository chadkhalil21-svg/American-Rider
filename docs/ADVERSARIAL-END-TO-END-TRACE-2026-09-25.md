# Adversarial End-to-End Trace — Operator and Traveler — 25 September 2026

This is a hostile state-transition audit, not a feature review. Each step names the authority that may change state, the durable record, and the attack attempted. A transition is considered defended only when the server/rules derive authority from durable state rather than a client assertion.

## Fictional Operator: Elena Marquez (uid op_elena)

1. **Account and documents.** Firebase identity establishes uid. Client may write only profile/push fields in users/op_elena. License, registration, insurance readings and human exceptions are server records. Attack: forge screening, disclosure, Stripe destination, insurance decision, fleet availability. Firestore rules refuse those client fields.
2. **Qualification.** backend/qualification.js derives qualification on every assessment from current account state, required documents, insurance evidence/expiry/limits, suspension and screening. No stored approved flag is authority. Attack: stale approval, expired insurance, screening review/refusal/expiry, mismatched vehicle/insured. Result: blocker, not qualification.
3. **Connect.** Stripe account id is server-written; payout readiness is read from Stripe. Attack: client names another Connect destination. Payment and settlement never accept a payout destination from the client.
4. **Disclosure and duty.** /operator/online re-runs assessment, payout readiness, market and position gates and writes operators/op_elena with server authority. Native background presence renews the same endpoint. Attack: stale phone, expired coverage during shift, missing location, forged availability. Matching rejects stale presence/coverage and client cannot write operators.
5. **Dispatch candidate.** /travel/dispatch reads available Operators server-side and matchOperator applies current fleet gates. Synthetic fleet is impossible in operational mode. Attack: Traveler names Operator or modifies fare/operator assignment. Ignored; server selects and creates rides/{rideId}.
6. **Scheduled dispatch.** scheduler claims reservation transactionally, revalidates Family authorization, then now re-runs full Operator assessment and Stripe payout readiness immediately before charging. Attack found/fixed in this audit: stale matchable Operator previously could reach scheduled charge without full revalidation.
7. **Offer acceptance.** /travel/accept reads Firebase/Stripe externals and transactionally re-reads ride, user and fleet; only the offered Operator can accept and eligibility is re-derived. Attack: old offer, another Operator, lapsed document, disabled account, lost payout readiness. Refused/released.
8. **Re-offer.** sweepAssignments excludes prior Operators and now revalidates each candidate's user record and Stripe payout readiness before reassignment. Attack found/fixed: stale candidate previously could be presented as newly assigned before failing acceptance.
9. **Travel state machine.** Operator client can progress accepted → arrived → onboard → completed only. Teen onboard additionally requires server-recorded PIN verification. Completion stamps needsPayout. Attack found/fixed: rules previously allowed accepted/arrived to jump directly to completed, which could bypass Teen PIN and queue payout. Exact predecessor transitions are now enforced.
10. **Payout.** settlement requires completed status, the ride's own paymentIntentId and server-looked-up Operator account. Stripe metadata must match Traveler uid/Travel Number; amount is derived from Stripe-stamped fare; transfer uses source_transaction and Travel-idempotent key. Replays return/resolve to one transfer. Sweep backs up phone-triggered settlement.
11. **Monthly Connect cost.** Operator account fee is separate from 99% fare share, bounded to the account/month and waived at configured Travel threshold.

## Fictional Traveler: Marcus Reed (uid trav_marcus)

1. **Identity.** Firebase token establishes uid; server ignores client attempts to act as another Traveler. Firestore permits only own profile/push fields and scoped Travel reads.
2. **Quote.** /fare-quote derives distance fare, government fees, card-country cost model and server-side HERE toll state. Attack: client supplies fare/toll/fee. Server recomputes; unknown toll fails closed.
3. **Party.** normalizeParty binds self Travel to authenticated identity, requires adult delegate name, and validates Teen Family authorization server-side. Attack: arbitrary minor/guardian declaration. Refused unless authoritative Family link exists.
4. **Dispatch.** /travel/dispatch re-prices from coordinates, checks market/permit/toll state, selects Operator server-side, creates immutable authority fields and Travel Number. Attack: forged Operator, fare, distance, Travel Number. Client cannot create rides.
5. **Payment.** /create-payment-intent first proves the ride exists, belongs to Marcus, is payable and carries an authoritative fare. The PaymentIntent receives server-derived uid, rideId, Travel Number, fare, government fee and toll metadata. Attack found/fixed: concurrent payment preparation had no Firestore claim. payForTravel now transactionally claims the transition before Stripe and commits the returned intent only while holding that claim; Stripe's Travel-specific idempotency remains the second layer.
6. **Cancellation.** /travel/cancel ignores any client payment id and uses the ride's own. Ownership and refundable amount are re-read from Stripe. Underway/completed Travel cannot use the ordinary cancellation path. Arrival fee, when applicable, is bounded to the refund and sent to the recorded Operator.
7. **Messaging/follow/emergency.** server derives participant role from the ride. Ordinary thread closes outside active stages; guardian role requires Teen party. Emergency/support records are server-side.
8. **Completion.** Traveler cannot declare completion. Only the assigned Operator can advance the exact state machine. Traveler may rate only a completed Travel and cannot alter authority/money fields.
9. **Settlement.** Traveler-triggered /travel/settle can settle only Marcus's own completed Travel and cannot choose PaymentIntent, amount or payout destination. Server sweep provides an independent eventual-settlement path.
10. **Refund/support.** refund ownership and ceiling come from Stripe. A support decision is not represented as money moved unless Stripe returns a real refund.

## Residual evidence boundaries

Code cannot establish physical OS scheduling after force-quit/reboot, real push delivery, actual provider production behavior, actual bank payout timing, deployed secret correctness, or statutory insurance procurement. Those remain evidence campaigns in the device/provider validation matrix.

## Defects discovered and corrected during this trace

- Scheduled Travel did not perform full authoritative Operator revalidation immediately before charging and assignment.
- Re-offer could announce a stale/ineligible Operator before acceptance rejected them.
- Operator Firestore state transitions allowed skipping required Travel stages, including a path around Teen pickup verification to completed/needsPayout.
- Traveler payment preparation lacked a Firestore claim around the Stripe creation transition; concurrent requests/process failure relied too heavily on Stripe idempotency.
