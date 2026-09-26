# Failure-mode audit — 2026-09-25

This is a release-gate document, not a claim that passing automated tests makes the service legally or operationally ready.

## Release rule

Do not merge while a Critical item is open. High items require either a fix or an explicit release-blocking operational control with an owner.

## Closed in this audit

- **Public operational sweep execution — High.** `/scheduled/sweep` could execute dispatch, screening, monitoring and settlement work for an unauthenticated caller. Response detail was redacted, but execution itself remained a resource-amplification surface. The route now requires `SCHEDULER_TOKEN`; the process's internal 60-second sweep remains the primary clock.
- **Public operator economics example — High.** The Operate page still printed a fixed $26.00 traveler total from an obsolete fee schedule. Removed; operator earnings are shown from the invariant 99% fare share without inventing a card-dependent traveler total.
- **Insurance copy — High.** Removed the categorical statement that the operator policy is the only coverage that can apply. The product rule remains: every operator procures and maintains qualifying coverage; any separate coverage the platform may be legally required to maintain does not relieve that duty.
- **Screening exception semantics — Medium.** A provider flag with unreadable findings or a record with no usable date still fails closed, but is now described as source clarification/dispute resolution rather than routine human approval. The deterministic statutory screen remains the normal path.
- **Cross-module regression coverage.** `backend/launchfailure.test.js` now pins these failure boundaries and exhaustively checks the modeled contribution floor from $3 through $500 for domestic, international and unknown card country.

## Screening policy: minimum-human-intervention design

For Florida operations, the automatic decision standard is the statutory standard in Fla. Stat. §627.748(12), applied identically to every applicant. A machine-readable report passes automatically when no statutory disqualifier is present and refuses qualification when an authoritative report establishes a statutory disqualifier. American Rider does not add a general "criminal record" exclusion.

An ambiguous source is not a discretionary judgement call. Missing dates, unreadable findings, contradictory source data, provider suspension/dispute, or an unmapped candidate remain blocked while the authoritative source is corrected or clarified. Human intervention is reserved for source conflicts the provider/operator dispute process cannot resolve automatically. Nobody may manually waive a statutory minimum.

Where consumer-report adverse-action rules apply, the decision workflow must preserve required notices, the report/rights delivery, and a meaningful dispute opportunity before final adverse action. Those procedural steps should be automated where the provider/API permits; automation does not remove the underlying rights.

## Economics failure boundaries

The canonical pricing engine guarantees the configured 75-cent **modeled transaction contribution**, not company net profit. Its current fixed Connect allowance is 16 cents per Travel. That is a planning allocation, not a universal guarantee: low-volume active Operators can incur more fixed Connect cost per completed Travel. Before economics are called fully loaded, choose and encode the low-volume account policy (platform subsidy, operator account charge/waiver, or another verified Connect structure).

The 25-cent contingency reserve and 25-cent operating-overhead allowance are planning values. Replace them with measured loss and operating data as volume develops. Refunds, disputes, small separately charged gratuities, support labor, insurance/compliance, legal/accounting, tax administration and fixed infrastructure can exceed those allowances.

## Remaining release blockers / high-risk verification

1. **Florida insurance backstop interpretation — legal.** Operator-procured coverage is mandatory by product policy. Counsel must resolve the platform's separate obligation under §627.748(7)(d) if operator coverage lapses or fails.
2. **FCRA adverse-action workflow — compliance/engineering.** A refusal currently creates a support ticket describing the notice process. Replace the ticket dependency with an auditable notice-state machine before using third-party consumer reports for live adverse decisions.
3. **Operator background execution — engineering.** Foreground timers are not a durable production presence mechanism on iOS/Android. Verify native background location/presence behavior under lock, suspension, network loss, force-quit and reboot.
4. **Low-volume Connect economics — business/economics.** Resolve the 16-cent allocation assumption before representing the 75-cent floor as fully loaded.
5. **Payout wording and cadence — product/payments.** Distinguish transfer to the connected account on Travel completion from Stripe's bank payout schedule. Public copy must not imply bank settlement is instantaneous.
6. **Webhook durability — engineering.** Both provider webhooks acknowledge before asynchronous work completes. A process death after HTTP 200 but before Firestore completion can lose work unless events are durably queued or idempotently reconciled from provider state.
7. **Scheduler single-instance behavior — engineering.** Every server process starts its own 60-second interval. Idempotency protects several money paths, but multi-instance deployment must prove all sweep jobs are safe under concurrent execution or elect a single scheduler.
8. **Dispatch scale — engineering/cost.** Re-offer paths can read the fleet collection. Replace full-fleet scans with indexed/geospatial partitioning before fleet scale makes read cost/latency material.
9. **Disaster tests — operations.** Exercise Firestore quota exhaustion, Stripe outage, Checkr outage, routing outage, push failure, email/support failure, stale GPS, device clock skew, duplicate requests, out-of-order webhooks, process restart mid-settlement and partial region outage.
10. **Secrets/production configuration — operations.** Production configuration must verify restricted Stripe keys, webhook secrets, scheduler token, ops authentication, private object storage, support delivery, production Firebase project and no test-mode bypass.

## Definition of done

A release candidate is ready for final review only when the Release Gate is green at the candidate SHA, Critical/High blockers above are closed or explicitly prevented from occurring in production, live-provider sandbox drills have been recorded, and the deployed configuration has been checked independently of source code.
