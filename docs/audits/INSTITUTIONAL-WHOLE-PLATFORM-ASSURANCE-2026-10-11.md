# American Rider — Institutional Whole-Platform Assurance Review

**Review date:** 2026-10-11 (UTC). **Status:** evidence-led code audit, draft PR; not a production certificate.
**Authority:** the canonical `PROJECT-LEDGER.md`, `AGENTS.md`, `docs/COUNCIL-STANDARDS.md`, actual `release/current` code and exact-head GitHub checks. Protected supplier billing, live provider deliveries, Render SHA and real-device observations are independently required.

## Method / the Council

This is a structured application of **published** guidance, not literal consultation with Henry Ford, Rockefeller, Jobs, NASA, Lockheed, Apple, MIT, Stanford, Harvard or Emirates. It separates (1) design principles; (2) implementation inspected; (3) synthetic verification; (4) real-world validation; (5) unresolved external evidence. Passing offline unit tests alone never closes (4) or (5).

- **NASA systems engineering:** assign every requirement to a module, a verification method and evidence, with a distinct intended-use validation record. [NASA verification matrix](https://www.nasa.gov/reference/system-engineering-handbook-appendix/), [SWE-055](https://swehb.nasa.gov/spaces/7150/pages/16449673/SWE-055%2B-%2BRequirements%2BValidation).
- **Google SRE:** track latency, traffic, errors and saturation; page only for actionable risks to customers, payments, safety, or compliance. [Google four golden signals](https://sre.google/sre-book/monitoring-distributed-systems/).
- **Google Firestore:** avoid needless reads, sequential hot indexes, large scans and document contention; scale gradually, test meaningful peak throughput. [Firestore best practices](https://firebase.google.com/docs/firestore/best-practices), [understand reads/writes at scale](https://firebase.google.com/docs/firestore/understand-reads-writes-scale).
- **Amazon AWS Well-Architected / Builders Library:** make mutations idempotent, cap concurrency, retry only transient errors with backoff and jitter, avoid feedback storms, maintain recovery paths and backpressure. [AWS resilience](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/design-interactions-in-a-distributed-system-to-mitigate-or-withstand-failures.html), [operational excellence](https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/operational-excellence.html).
- **NIST/OWASP:** reduce the vulnerability surface, protect all object and function authorizations, prevent resource-consumption abuse and unsafe API responses. [NIST SSDF SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final), [OWASP API Top 10](https://api-security.owasp.org/editions/2023/en/0x11-t10/).
- **Stripe:** webhook signatures, duplicate/out-of-order delivery, durable idempotent queueing, and settlement/payment state verification. [Stripe idempotent API](https://docs.stripe.com/api/idempotent_requests), [webhooks](https://docs.stripe.com/webhooks).
- **Marketplace science:** geographically variable supply-demand and Operator availability; test dispatch/acceptance/cancellation using synthetic agents. [Stanford spatial pricing](https://www.gsb.stanford.edu/faculty-research/working-papers/spatial-pricing-ride-sharing-networks), [Uber simulated marketplace](https://www.uber.com/us/en/blog/simulated-marketplace/).
- **Business, design and first-class service:** sustainable service funding, clear one-Total presentation, simple recovery, legible on-duty and support states. [HBS](https://www.hbs.edu/faculty/Pages/item.aspx?research=7002), [Apple](https://developer.apple.com/design/human-interface-guidelines/design-principles). Emirates is a hospitality benchmark, not an engineering or regulatory certifier.
- **Historical Ford/Rockefeller/Jobs lenses:** reusable standard work, actual full operating costs, and coherent phone-first customer experience. These are interpretations, not attributed statements.

## Requirement-to-code verification matrix

**Classification:** P = established by source/test only, E = external/on-device/live proof pending, F = code defect found and patched in this draft, R = risk requiring a separate engineering program, N = not checked end to end. Rows marked P are **not** certified in production.

| ID | Safety, security, money or operational requirement | Source reviewed | Evidence / status / additional check |
|---|---|---|---|
| AR-01 | Single server-authoritative Traveler Total; Operator receives 99% of Fare | `backend/fareauthority.js`, `payments.js`, `economics.js` | P: `payments.test.js`, `idempotency.test.js`; E: final live Stripe objects, toll and payout reconciliation |
| AR-02 | Every charge mapped to a real owned Travel | `backend/booking.js`, `travelmoney.js` | P: `travelmoney.test.js`, `payments.test.js`; E: sandbox processing/transfer/refund proofs |
| AR-03 | Unserved paid Travel cancelled/refunded; eligible refund cannot starve | `backend/bookingrecovery.js` | **F:** former refundPending query scanned unrelated statuses then ignored them after limit; draft filters `status=cancelled` at query, with composite index and >100-invalid-row synthetic regression; must deploy index before code |
| AR-04 | Every external webhook verified, stored durably, retried without duplication | `providerqueue.js`, `webhook.js`, `resend-delivery.js` | P: `providerqueue.durability.test.js`; E: ledger notes signed Resend callback still resulted in 503 due to Firestore write deadline; investigate capacity before saying commissioned |
| AR-05 | Authenticated object access and money ownership | `auth.js`, `booking.js`, `trustboundaries.js`, `server.js` | P: existing adversarial trace suite; R: OWASP object/property-level endpoint-by-endpoint red-team review and actual Auth identities not covered by source scan |
| AR-06 | Operator screening held, renewal enforced, never silent eligibility bypass | `screening.js`, `qualification.js` | P: `screening.test.js`, renewal cursor logic; E: actual provider reports, licensing and adverse-action workflow records |
| AR-07 | Operator insurance continuity, correct jurisdiction, unverified policy blocks duty | `insurance-monitoring.js`, `eligibility.js`, jurisdiction registry | P: `insurance-monitoring.test.js`; E: legal company-insurer first-dollar contingency and real insurer responses not certified |
| AR-08 | Travel safety monitor never silently drops active rides | `monitor.js` | P: test demonstrates 900 active rides fully paged; R: reads *every active Travel every ~minute* and may saturate as concurrency rises; do not cap without sharded/event-driven equivalent safety |
| AR-09 | Assigned ride recovery bounded; old development records expire | `monitor.js` | P: bounded `ASSIGNED_SCAN_LIMIT` and stale-expiry tests; R: max backlog age / fairness under high demand not measured |
| AR-10 | Provider queues bounded, leased, crash-replayable | `providerqueue.js`, `schedulerlease.js` | P: 1200/tick cap, eight parallel handlers and durable claims; E: live backlog age, dead-letter volume, instance failure recovery |
| AR-11 | No full-collection Operator dispatch scans | `geooperators.js`, `matching.js` | P: `geooperators.test.js` tests prefix limits; E: production city-wide saturated tile throughput and actual pick-up times |
| AR-12 | Research-only cities cannot exhaust Firestore | `market-reference-service.js`, `market-evidence-collectors.js` | P: PR #101/#103 previously merged; additional cadence, safe candidate isolation and cache changes **only draft PR #124**; do not report as production |
| AR-13 | Market prices reflect approved independent passenger Totals | `market-reference-authority.js`, `market-pricing.js` | E: South Florida data-source commissioning absent; no defensible 10% claim nationwide; draft PR #124 has safety tests but no national dataset |
| AR-14 | No service outside approved geography and jurisdiction | `regions.js`, `market-readiness.js`, `markets.js` | P: `market-readiness.test.js`; E: insurance/legal/airport and separate per-state regulatory proof |
| AR-15 | Unknown tolls and routing outages do not silently change charge | `tolls.js`, `streets.js`, `fareauthority.js` | P: `tolls.test.js` and server fail-closed; E: current self-hosted OSRM/OTP/HERE availability, official toll coverage and real passenger route parity |
| AR-16 | Customer-facing quote survives login, relaunch and payment-sheet flows | Expo SDK 57 app/ `server.js` | N/E: compile, simulator, auth-synthetic not proof of actual iOS/Android device, Apple Pay/Google Pay, push, accessibility and background state |
| AR-17 | Single phone administrative exception workflow | `ops.js`, `opscases.js`, `market-readiness-ui.js` | E: device/OAuth/MFA/role trace; an installed founder command is not the same as authenticated tool access |
| AR-18 | Support/emergency reachable without cheap-model failure exposing the rider | `support.js`, `tickets.js`, `monitor.js` | P: emergency requests counted but not throttled; E: human response, email/SMS, AI vendor expense, emergency delivery under network and Firestore outage |
| AR-19 | Limits resist throwaway account / resource-consumption abuse | `ratelimit.js`, `server.js` | P: authenticated counters Firestore-transactional, anonymous limits process-local; R: multi-instance fallback local counters are not globally enforceable during Firestore failures |
| AR-20 | Live cost attribution to every completed Travel | `fully-loaded-coverage.js` and ledger | P: scenario sensitivity including payouts; E: actual unit costs, refunds, labor, insurance, provider invoices, Render/Firestore measured traffic |
| AR-21 | Test, artifact, exact SHA and deployment prove each release | Actions / `PROJECT-LEDGER.md` / `scripts` | P: six workflow suites exist; E: release SHA on Render, real signed providers, operational and device acceptance separately required |
| AR-22 | Privacy and data retention meet real jurisdictional requirements | `legal.js`, `accountdeletion.js`, `family.js` | N/E: current rights, actual deletion/replay propagation, retained travel safety evidence and teen guardian flows need user/device and legal tests |
| AR-23 | Source API calls cannot cause accidental purchase/unsanctioned scraping | `market-evidence-collectors.js`, `market-evidence.js` | P: only Chicago collector is wired; E: contractual data rights for national coverage unavailable |
| AR-24 | Background tasks do no needless work when no customers | `sweepcadence.js`, `schedulerlease.js`, `providerqueue.js` | P: separate cursors and leader lease in source; R: collect actual per-collection idle reads/writes, not generic whole-day billing screenshots |

## Reproduced specific defect (refund starvation)

Before this change, `sweepBookingRecovery()` queried **all** `refundPending=true` records with `.limit(100)`, then skipped those whose status was not `cancelled`. With 125 irrelevant pending records ahead of a legitimate cancelled paid Travel, a healthy refund could remain outside the batch indefinitely. Each minute also re-read the irrelevant records. This violates AWS bounded-queue/drain guidance, Stripe financial recovery, and our own operator/traveler service promise.

**Draft correction:** add `where('status', '==', 'cancelled')` before `.limit(100)`, add the exact composite Firestore index in `firestore.indexes.json`, and test the backlog using a query double that actually applies *both* filters. This is an error-recovery correction only: no refund is executed by this PR. Deploying server before index builds is unsafe because Firestore may reject the compound query; stage/index-confirm first.

The existing test only verified three eligible records. The new regression adds 125 irrelevant flags before the eligible refund and checks it is recovered, the scan is under capacity, and no second refund happens.

## Scale: be precise about what a simulation proves

- 1,000 simultaneously active Travels, queried once a minute, implies ~1.44 **million document-read results per day** for the live safety monitor alone, if that concurrency persisted for 24 hours. This arithmetic is **not measured Firestore usage**; index reads, latency and other work are excluded. The monitor cannot be arbitrarily capped because every active Travel needs coverage. A sharded/event-driven safety architecture with measured lag and failover is future work.
- A 100-record recovery batch at a 60-second tick is a theoretical maximum of 144,000 records/day under ideal processing, **not a tested SLA**. The new predicate eliminates an identified starvation source, not all potential backlogs. Test 10K/100K/1M registered user scenarios with *peak concurrent rides and booking/settlement rate* assumptions, p95/p99 latencies, provider faults, and Firestore budget attribution.
- The Chicago *research-only* import amplifier was settled in earlier merged PRs. Do not rediscover old work. What is NOT certified is actual production source usage after new activation and the draft #124 reference cache/cadence improvements.

## Recommended next independent gates

1. Complete exact-head six-workflow CI **on this separate PR**, including emulator rules and the new recovery starvation test. Do not conflate it with pricing PR #124, already six-green but **draft and not deployed**.
2. Provision Firestore's new composite index and confirm its building state before any merged/backend release using the compound refund query.
3. Measure real Firestore billed reads/writes by collection and type under idle and controlled load; test sustained 1K/10K concurrent duty/rides, not just one million in-process math iterations.
4. Commission payment/provider callbacks and prove actual signed queue acknowledgments, Stripe sandbox transfer/refund reconciliation and physical iOS/Android critical flows before approving commercial scale.
5. Independently resolve the legal/insurance/airport evidence and national pricing source-rights gaps; never treat synthetic testing as an operating permit.
6. Design capacity-bounded **yet complete** Travel safety monitoring, recovery fairness, on-call telemetry and deploy rollback. Prioritize a safety guarantee over saving a few reads.

**No live charge, refund, email, market activation, contract or production deploy occurs through this audit.**
