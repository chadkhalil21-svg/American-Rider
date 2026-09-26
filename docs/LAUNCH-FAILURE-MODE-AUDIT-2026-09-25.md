# Failure-mode audit — 2026-09-25

This is a release-gate document, not a claim that passing automated tests makes the service legally or operationally ready.

## Release rule

Do not merge while a Critical item is open. High items require either a fix or an explicit release-blocking operational control with an owner.

## Closed in this audit

- **Public operational sweep execution — High.** `/scheduled/sweep` could execute dispatch, screening, monitoring and settlement work for an unauthenticated caller. Response detail was redacted, but execution itself remained a resource-amplification surface. The route now requires `SCHEDULER_TOKEN`; the process's internal 60-second sweep remains the primary clock.
- **Public operator economics example — High.** The Operate page still printed a fixed $26.00 traveler total from an obsolete fee schedule. Removed; operator earnings are shown from the invariant 99% fare share without inventing a card-dependent traveler total.
- **Insurance copy — High.** Every Operator must procure and maintain qualifying coverage. Florida Stat. §627.748(7)(d) separately requires insurance maintained by the TNC to provide the statutory coverage from the first dollar and defend the claim if the Operator’s paragraph (b)/(c) insurance lapses or does not provide the required coverage. The contingency requirement does not relieve the Operator of American Rider’s qualification rule.
- **Screening exception semantics — Medium.** A provider flag with unreadable findings or a record with no usable date still fails closed, but is now described as source clarification/dispute resolution rather than routine human approval. The deterministic statutory screen remains the normal path.
- **Cross-module regression coverage.** `backend/launchfailure.test.js` now pins these failure boundaries and exhaustively checks the modeled contribution floor from $3 through $500 for domestic, international and unknown card country.
- **Webhook durability — High.** Verified Stripe and Checkr events are written to `provider_events` before HTTP acknowledgement. Processing is leased, idempotently reclaimed after worker failure, retried with backoff, and swept periodically.
- **Scheduler single-instance behavior — High.** Every server may keep its local 60-second clock, but `operations_sweep` is protected by a transactional Firestore leader lease with renewal and owner-checked release, preventing horizontally scaled instances from concurrently executing the sweep.
- **Payout wording and cadence — Medium.** Public copy now distinguishes American Rider’s transfer of the Operator’s 99% fare share to the Stripe connected account on Travel completion from Stripe’s separate bank-payout schedule.
- **FCRA adverse-action workflow — High.** The screening pipeline now maps only concrete statutory reasons to provider adverse items, starts provider-hosted pre-adverse action with an explicit seven-day dispute interval, persists provider notice/dispute/final states, re-adjudicates corrected reports, cancels pending adverse action when a dispute clears the record, blocks qualification throughout, and escalates notice-delivery exceptions.
- **Low-volume Connect economics — Medium.** The low-volume policy is encoded: the $2 monthly active-account cost is recovered from the Operator account that incurs it, with separate card-cost gross-up, and is waived at 20 completed Travels in that calendar month. Traveler pricing carries only the distinct 6-cent per-Travel fixed payout allowance.
- **Operator-authored payable Travel state — High.** The Operator phone no longer writes `arrived`, `onboard`, `completed`, `declined`, status timestamps or `needsPayout`. `/travel/progress` owns those transitions, verifies assignment and predecessor state, preserves the Teen PIN gate, and requires fresh server-held Operator presence near pickup for arrival and near destination for completion. Firestore permits only Travel telemetry from the assigned Operator.
- **Patron Support cross-Travel refund substitution — High.** Automatic credits are now bound to an owned Firestore `rideId`; the PaymentIntent is read from that Travel, never accepted from the case payload. Stripe refund idempotency is one domain per Travel, preventing retries or differing approved amounts from creating multiple automatic refunds.
- **Insurance disclosure fail-closed — High.** The obsolete operational claim that American Rider provides no insurance has been removed from the governing disclosure and dispatch commentary. Production readiness now requires the actual bound TNC contingency coverage wording and reviewed ES/FR/IT/DE equivalents; missing terms block production rather than inventing coverage.
- **Smart Travel stale-continuation authority — High.** Smart Travel now revalidates the transit middle against the Travel region's current OTP state before offering the second car Travel. Planner/realtime outage, disappeared service, or a changed route holds continuation rather than trusting the itinerary selected earlier. The quote and revalidation endpoints also inherit the production readiness gate.
- **Smart Travel market coupling — High.** Traveler presentation no longer branches on Miami-Dade identity, and transfer inclusion is explicit feed data rather than a universal same-agency assumption. Multi-market regression fixtures exercise distinct feed IDs/agencies/fares/free modes, variable fares, changed routes and provider outage.

## Screening policy: minimum-human-intervention design

For Florida operations, the automatic decision standard is the statutory standard in Fla. Stat. §627.748(12), applied identically to every applicant. A machine-readable report passes automatically when no statutory disqualifier is present and refuses qualification when an authoritative report establishes a statutory disqualifier. American Rider does not add a general "criminal record" exclusion.

An ambiguous source is not a discretionary judgement call. Missing dates, unreadable findings, contradictory source data, provider suspension/dispute, or an unmapped candidate remain blocked while the authoritative source is corrected or clarified. Human intervention is reserved for source conflicts the provider/operator dispute process cannot resolve automatically. Nobody may manually waive a statutory minimum.

Where consumer-report adverse-action rules apply, the decision workflow must preserve required notices, the report/rights delivery, and a meaningful dispute opportunity before final adverse action. Those procedural steps should be automated where the provider/API permits; automation does not remove the underlying rights.

## Economics failure boundaries

The canonical pricing engine guarantees the configured 75-cent **modeled transaction contribution**, not company net profit. The current Travel-level model carries a 6-cent fixed payout allowance. Stripe's separate $2 monthly active-account cost is recovered from the Operator account that incurs it and is waived when that Operator completes 20 Travels in the same calendar month; card collection cost for that pass-through is grossed up separately. The 99% fare share is not reduced.

The 25-cent contingency reserve and 25-cent operating-overhead allowance are planning values. Replace them with measured loss and operating data as volume develops. Refunds, disputes, small separately charged gratuities, support labor, insurance/compliance, legal/accounting, tax administration and fixed infrastructure can exceed those allowances.

## Remaining release blockers / high-risk verification

1. **Florida TNC contingency insurance — legal/operations.** Operator-procured qualifying coverage remains mandatory. Before Florida operations, procure and document TNC-maintained coverage satisfying §627.748(7)(d) for the contingency in which an Operator’s required coverage lapses or fails, and have Florida insurance counsel/broker confirm the policy structure and disclosure wording. Production now fails closed until the approved English, Spanish, French, Italian and German coverage text is configured.
2. **Operator background execution — physical-device validation.** Native background presence is implemented with Expo Location/TaskManager and foreground renewal remains as an additional signal. Verify the implemented path under lock, suspension, network loss/recovery, force-quit and reboot on release-build iOS/Android; record evidence rather than inferring platform behavior from source.
3. **Dispatch scale — engineering/cost.** Ordinary and return dispatch now use Firestore’s indexed `available == true` prefilter before the authoritative eligibility/distance gate. This removes reads for off-duty Operators without duplicating qualification logic. At materially larger fleet size, add a server-owned spatial candidate partition so reads scale with nearby on-duty supply rather than all on-duty Operators.
4. **Disaster tests — operations plus deterministic regression coverage.** Durable webhook duplicate/retry/backoff/expired-lease recovery and payment/settlement idempotency now have automated regression coverage. Still exercise real Firestore quota exhaustion, Stripe outage, Checkr outage, routing/toll outage, push failure, email/support failure, stale GPS/device clock conditions, process restart during live provider operations and partial region outage.
5. **Secrets/production configuration — operations.** Production/live-money posture now fails closed through a shared readiness gate for core Travel operations, and an unknown deployment mode is itself a blocker. Production configuration must still independently attest restricted Stripe keys, webhook secrets, scheduler token, named ops authentication, private object storage, support delivery, production Firebase project, provider credentials and no test-mode bypass.

## Definition of done

A release candidate is ready for final review only when the Release Gate is green at the candidate SHA, Critical/High blockers above are closed or explicitly prevented from occurring in production, live-provider sandbox drills have been recorded, and the deployed configuration has been checked independently of source code.
