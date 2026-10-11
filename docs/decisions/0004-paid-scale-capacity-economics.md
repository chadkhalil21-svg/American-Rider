# ADR 0004 — Paid-scale capacity and economic discipline

**Status:** Founder-approved policy, 2026-10-11. **Applies:** American Rider national and subsequent international architecture, launch and operating plans. This policy supersedes any interpretation that American Rider should remain on free Firebase, Render, messaging or other infrastructure tiers.

## Decision

American Rider is a commercial transportation network designed for **thousands to millions of Travelers and Operators**. **Do not design to the limits of free plans** or present a free allowance as viable production capacity. Production may and ordinarily should use reliable, appropriately sized **paid, usage-based services** where required. Free allowance is incidental savings, not an architecture target or a launch gate.

The platform must be **economically self-sustaining per completed Travel** after provider charges and its operating responsibilities; avoid unnecessary compute, writes, provider calls and human intervention regardless of whether the service is paid. Buying capacity is acceptable; paying for unrelated idle work, unbounded queries or accidental retry storms is not.

Scaling is driven by actual demand, measured transaction costs and peak **simultaneous** load rather than by a raw registration count or a simulated million-iteration arithmetic loop. Use one jurisdiction-configurable system, automated exceptions and founder phone-first Operations. Preserve live legal, insurance, screening, market-admission, Travel safety and payment gates.

## Settled Chicago incident — do not reopen as an unknown defect

**Proven source finding:** A previously scheduled market-evidence job accessed up to **1,000 Chicago trip observations hourly** although Chicago was research-only, potentially rewriting approximately **24,000 documents/day** in `market_reference_observations`. Aggregate Firebase figures of approximately 37K reads/24K writes in the earlier incident, and subsequently 35K reads/21K writes shown in a no-cost quota period, could not alone attribute every billed operation to that writer. Calling this a "reading problem" conflates the upstream Chicago data fetch and downstream billed Firestore **writes**.

**Repairs already merged:** [PR #101](https://github.com/chadkhalil21-svg/American-Rider/pull/101) halted hourly imports for research-only markets and bounded collectors. [PR #103](https://github.com/chadkhalil21-svg/American-Rider/pull/103) made inactive/uncommissioned collectors a zero-Firestore-operation path, deduplicated source batches, used append-only record creation and skipped unchanged snapshots/state. The current `backend/market-reference-cost.test.js` specifically covers the no-work case and bounded/idempotent ingestion. **Never suggest re-implementing or re-investigating that same defect without new post-repair evidence.** Historical quota alerts and old-period screenshots are not proof of a regression.

**What is distinct and remains unverified:** actual paid billing state, Firestore collection-level attributable writes after deployment and daily reset, baseline idle usage, per-Travel billable reads/index reads/writes, real location/listener fanout, peak throughput and real signed provider delivery. If new data points to Chicago again, first show the exact post-PR collection rate/source SHA and then investigate that **new** regression, not the old repaired code path.

## Required commercial economics and engineering gates

For each market and load band, project and then measure:

- **Demand:** registered accounts, active monthly Travelers, peak simultaneous Operators, peak request rate, completed Travels/day, peak/hour dispatches, scheduled Travel and burst/failure recovery. One million registrations is not one million concurrent rides.
- **Revenue and margin:** actual Traveler Total breakdown into Travel Fare, Operator's 99%-of-fare entitlement, platform fee, taxes/pass-throughs, reversals and refunds. Compute contribution per *completed* Travel after Stripe processing, Stripe Connect routing, payouts, reserves/chargebacks, hosting, Firestore document/index reads and writes, realtime position delivery, data egress, maps/geocoding/tolls/routing, push/SMS/email, storage, fraud/safety/support, lawful screening/insurance verification and audit retention. Respect existing server-authoritative pricing policy; do not invent a fixed margin.
- **Load and reliability:** 100/1K/10K/100K daily Travels plus million-account and peak-duty scenarios where economically relevant; normal and incident peaks, p50/p95/p99 dispatch/payment latency, retries, backpressure, concurrent acceptance/settlement, privacy and security, site failure and recovery, day-2 operating hours, and real physical iOS/Android traces. A test named `Scale Stress Twice` is evidence only for the actual operations it executed.
- **Financing and scaling:** planned paid Render/Firebase/Stripe/provider capacity, incremental spend forecasts, clear cost per active Operator-hour and Travel, measured trigger points for upgrades, provider limits, usable operational headroom and rollback. Prefer automated alerts and usage attribution; inspect terms before a higher plan, API or vendor is purchased. No new paid service, billing upgrade, limit change or contract is executed solely by this ADR.
- **Safety:** a budget alert must not silently turn off payment reconciliation, support, insurance enforcement, emergency routing or market-gated Travel. Protect against cost explosions with circuit breakers for **noncritical** research/analytics, strict capped retries, idempotency, and alerting; a hard budget or usage stop requires explicit safety/fail-closed operating design, not an assumed harmless cap.
- **Leadership:** a founder-controlled single-phone view of utilization, active Travels, operator duty count, contribution margin, p95 latency, payment exceptions, insurance/screening cases, quota capacity, burn rate, provider failures and actual authorized market status. Escalate exceptions, not routine approvals.

## Research and cost authority

Before significant system design, consult authoritative vendor/engineering material, inspect the actual `release/current` implementation and the [canonical ledger](../../PROJECT-LEDGER.md), and test a small change at a precise SHA before production. [Google Firestore pricing](https://firebase.google.com/docs/firestore/pricing) establishes chargeable document/index reads, writes, storage and network use, and states billing must be enabled to exceed the free quota. [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) distinguishes no-cost Spark from usage-based Blaze. [Google Cloud billing budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets) warns that alerts-only budgets do **not** cap spend; [spend cap budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps) may pause eligible services and therefore need an explicit critical-service continuity plan. [Google SRE capacity planning](https://sre.google/sre-book/software-engineering-in-sre/) emphasizes workload, observability and repeatable capacity management. See [national operating model](../architecture/NATIONAL-OPERATING-MODEL.md), [capacity issue #102](https://github.com/chadkhalil21-svg/American-Rider/issues/102) and [Council standard](../COUNCIL-STANDARDS.md).

## Handoff and evidence discipline

1. Read the ledger at the **current branch HEAD**. Trust its **settled decisions**, but check dated statements against merged PRs, exact CI and Render deployment SHA; a stale ledger status is a recordkeeping defect to correct, not permission to recreate completed work.
2. Identify the *specific missing or newly observed evidence*, compare it against repaired source and release times, and proceed only on a demonstrable delta.
3. Update this ADR and the ledger in the same PR whenever this policy changes. Keep historical errors and fixes recorded and label them completed, rather than repeating "pending" after verified deployment.
4. No code release, paid-market admission, production money movement or billing purchase is implied by a docs-only merge.
