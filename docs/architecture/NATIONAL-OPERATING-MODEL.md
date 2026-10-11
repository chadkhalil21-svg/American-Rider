# American Rider — National-to-International Operating Architecture (ADR draft)
**Date:** 2026-10-10. **Scope:** nationwide, expansion-capable global platform; one-phone founder; smallest safe incremental infrastructure and intervention budget.

## Engineering method — required for consequential decisions
1. First inspect exact `release/current` source, live deployment and project ledger. Do not presume a task is incomplete or complete based on old handoffs.
2. Research current *primary technical documentation*, engineering case studies, current jurisdictional law and provider contracts. Distinguish vendor marketing / an exemplary architecture from the actual code and operating evidence.
3. Write a testable, documented problem statement with measured baseline, unit economics, failure conditions, release/rollback strategy and a comparison of alternatives. Do not add vendors to fix a problem that a simpler change solves.
4. Deliver small exact-head pull requests, run the complete release gates, verify Render live SHAs, measure after a full business-cycle before claiming financial savings or production readiness.
5. Preserve founder-commanded market control, legal/provider-evidence gates, insurance lapse, screening, payments, safety and idempotency. A "fail open" for commercial admission is prohibited.

## One product; jurisdiction is configuration, not a process per city
- Catalog `research`: may contain future markets, no live processes, API calls, or Firestore writes.
- Geography `configured`: coordinates/zone, regulator, local laws, language, time zone, routing, disclosures, toll and tax policies.
- `evidence_pending`: may assemble permitted source updates ONLY when there is an authorized commissioning project / contract and expected relevant evidence. No automatic publisher import.
- `onboarding_approved`: if the proper requirements and provider integrations hold; distinct from permission to sell Travel.
- `commercial_active`: only if authoritative market evidence, infrastructure, operator insurance and screening, payment/safety/reconciliation and production device gates all pass.
- `paused`: fleet blocked and already-running Travel/refund/safety recovery continues.

The number of catalog cities must not multiply base Firestore operations. Globally scoped regulatory settings, statutory/legal text and transport agencies differ; do not copy Florida law into another jurisdiction. Use a global core with state/province/country policies and explicit changes of record.

## Four separated workloads
| Workload | Trigger | Durable store / runtime | Safety |
|---|---|---|---|
| Travel lifecycle, dispatch claim, payment authorization, fee settlement | actual booking/state changes + signed provider events | Firestore transaction + Stripe authoritative records and audit trail | idempotency, owner gates, race tests, fail-closed |
| Active Operator positions / presence / ETA | Operator on duty, location actually moved, demand nearby | initially bounded current provider; evaluate realtime presence store/ephemeral spatial cache with TTL and appropriate retention | not trusted for insurance/identity/transaction authority |
| Compliance deadlines, forgotten settlements, emergency and reservation recovery | event + indexed due-time / selective periodic watchdog | due-only Firestore queries; partitioned, bounded work with lease and capped retry | never skip time-critical safety or money recovery merely for savings |
| Pricing/regulatory evidence research | commissioned source updates, licensed feed signal or staleness threshold | versioned evidence with provenance, sample/digest dedup and explicit promotion | age/confidence/economic/legality and geography gates; never a whole-country hourly download |

Realtime requirements cannot be reduced to a once-per-hour price polling or a once-per-minute GPS write: freshness thresholds are a function of duty/trip state, device reliability, dispatch density and safety, with regional quality-of-service metrics.

## Zero-work safeguards implemented incrementally
- PR #101: future markets in catalog are not automatically ingested; candidate source records capped.
- This PR: for a configured market, **zero active authorized collectors causes zero Firestore operations**, identical source batch digest skips ingestion, append-only create skips writing duplicate historical trips, empty/no-new sample does not recompute up to 10,000 documents or rewrite pricing snapshots. Explicit `force` recalibration remains available.
- Existing active-safety and finance recovery sweeps untouched. **Do not call this a full queue/real-time migration.**
- A once-hourly stdout-only aggregated workload summary now reports each scheduler job's available counts, skipped or failed state without any personal fields or extra Firestore writes. These are **logical results, not billable read/write counts**; reconcile with Google's collection-level Usage Insights.

## Cost and capacity model: measured vs illustrative
Firestore Standard is billed for docs/index reads, writes/deletes, storage, bandwidth and listener fanout. Official free quota *per day* is 50,000 doc reads/20,000 doc writes/20,000 deletes; it is not a guarantee for launch. Source: https://firebase.google.com/docs/firestore/pricing .

Let:
- `T` completed Travels/day; `R` billed doc reads/Travel; `W` writes/Travel, measured separately for booking, dispatch, completion and settlement;
- `O` online Operators; `H` duty hours/operator/day; `p` location updates/operator/hour;
- `I_R` and `I_W` no-user daily baseline; `S_R` and `S_W` background/recovery usage for active records;
- `L_R` listener fanout reads per update, `q` fraction of positions persisted to Firestore.

Estimated daily Firestore reads `I_R + R*T + S_R + L_R`, writes `I_W + W*T + S_W + O*H*p*q`. Treat `R,W,p,q` as measured variables, NOT fixed architectural facts. For example at **100 reads/40 writes per Travel**, 10,000 Travels/day alone would produce ~1M reads and 400K writes plus GPS, background, index and listener traffic. With 1,000 Operators working eight hours, location every 30 seconds = 960,000 position updates/day. Even if positions cost little in raw write fees on a paid plan, geographic dispatch timeliness, reads/fanout, saturation and failover dominate engineering.

Track separately: Stripe processing/Connect/instant payout and refunds; geocoding/autocomplete, routing/tolls/ETA, push/SMS/email, hosting CPU/memory, outbound data, observability, backup and resilience, incident response and insurance/screening verification. Compute contribution per **completed** Travel net of these costs, not raw database spend alone.

### Proposed load gates (verify; not production certifications)
- Idle for 24h: no irrelevant market-source writes; record actual total idle Firestore reads/writes, top collection groups, scheduler lease writes, HTTP requests, process CPU/memory. Instrument and eliminate idle amplification; do not invent a target before measuring.
- Travel cohort: sampled production-authorized test journey with Stripe reconciliation and snapshots of billable operations per stage; private data excluded from telemetry.
- Concurrent regional load: 100 / 1,000 / 10,000 active Operators and different ping frequencies, dispatch latency p50/p95/p99, memory/CPU, Firestore query/transaction index reads, incident handling capacity, degraded network and failover.
- National load: demand by local peak hour and configured jurisdiction, not straight-line monthly averages. Include operator-hours, active Travels and payment webhook bursts; 100/1K/10K/100K daily Travels and then 1M simulations separately.
- Failure injection: missing indexes, Firestore quota/outage, Stripe outages/webhook replays, scheduler contention/worker failure, invalid insurance, revocations, privacy, airport gates.
- Threshold and pricing choice to be approved only after baseline: one existing Render 0.5 CPU/512MB instance has no demonstrated million-user capacity. Keep manual capacity upgrades until measurements justify another tier.

## Immediate next engineering work, after this no-waste PR
1. **Firestore collection-level Usage Insights** to identify true writer/reader collections and validate Chicago/market-reference attribution. Use 24h & 7d; this is available in Google Cloud console with no additional charge: https://firebase.google.com/docs/firestore/enterprise/usage-insights .
2. Add no-write-to-Firestore metrics: per logical lifecycle action and worker, total work, failure/timeout, latency percentile, rows read/written where explicitly observed, request/queue costs and idle baseline. Compare logs to billed Firestore totals (SDK retries, listeners and index charges need reconciling).
3. Partition recurring jobs into urgent durable deadlines (critical, never cost-suppressed) versus research/housekeeping (can skip when there is no work). Replace scanning with indexed due timestamps, delayed tasks and durable idempotent queues where load/coverage justify them. Source: https://docs.cloud.google.com/tasks/docs/configuring-queues .
4. Benchmark Operator live-presence backend separately from Firestore audit records; validate Realtime Database presence and alternatives, live GPS update policies, privacy/retention, intermittent connectivity; no unconsented paid dependencies. Source: https://firebase.google.com/docs/database/rtdb-vs-firestore .
5. Define geography/grid indexes and bounded nearby candidate retrieval; preserve one authoritative server-side match/claim. Spatial reference: https://www.uber.com/us/en/blog/h3/ ; Firestore realtime performance: https://firebase.google.com/docs/firestore/real-time_queries_at_scale .
6. Enforce per-service unit economics and clear founder-triggered upgrades. Render compute units and autoscale availability: https://render.com/docs/compute-plans and https://render.com/docs/platform-features-by-plan .

## Founder and ChatGPT
Founder requests direct chat commands on phone with one clear result, plus authenticated OAuth consent and revocation. Plugin creation is not OAuth approval. Protected market status only counts as available when live authorized read works. Founder requests important engineering changes start with current primary web/source research, then exact-code verification before writing. Maintain `PROJECT-LEDGER.md` every significant change so conversation limits do not cause lost decisions.
