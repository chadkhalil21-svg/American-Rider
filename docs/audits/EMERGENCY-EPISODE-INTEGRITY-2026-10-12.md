# American Rider — Priority review of emergency-after-escalation, October 12, 2026

**Status: code correction proposed, not real-world emergency certification.** Review against live `release/current` after PR #139, canonical ledger and [open safety evidence issue #138](https://github.com/chadkhalil21-svg/American-Rider/issues/138).

## Standards before design

- NASA software requirements validation: demonstrate intended behavior in normal and abnormal usage, not merely compilation: https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695440/SWE-055%2B-%2BRequirements%2BValidation
- Google Firestore reliability and scale: do not drop safety cases because a query is paged, database quotas are exhausted, or a background update is delayed: https://firebase.google.com/docs/firestore/best-practices
- Amazon retry idempotency and same-key/different-intent problem: an idempotency key must identify the *incident*, not permanently silence another incident by the same customer: https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/
- Resend provider duplicate controls are limited to their documented key-retention period and are not evidence that any human responded.

## Actual source flaw and fix

`backend/monitor.js` previously stopped processing both `emergency` and `escalated` records before checking explicit Traveler 'help' or Operator urgent warnings. `escalated` is used for routine unresolved non-emergency support cases; a new emergency after that state was silently skipped. The fix skips already-active emergency records, but evaluates explicit urgent signals **before** deciding to skip an existing nonurgent escalation. The emergency ticket has its own urgent kind and does not reuse the previous support ticket.

Previously, case idempotency used one permanent key per ride and kind. A second true incident on the same Travel after authorized clearance would receive the old case; with a previously accepted alert, it could be silently deduplicated forever. A deterministic, bounded SHA-derived case key now includes the stable monitoring episode boundary (last clearance or the monitor question timestamp), allowing safe retry within an incident and a new case after real clearance. This is an improvement, not a distributed transaction or human delivery guarantee.

## Synthetic acceptance tests

1. New Traveler 'help' from `escalated` overrides prior nonurgent support.
2. New Operator injury report from `escalated` overrides prior nonurgent support.
3. Already-open `emergency` is never opened again each minute.
4. Two genuinely separate emergencies after review and clearance get different ticket keys.
5. Repeated attempts while a database emergency write is failing keep a stable key; existing no-GPS, congestion, 10,000-active synthetic, email and app tests remain required.

## Remaining non-synthetic boundaries

- **Emergency service:** Push acceptance is not receipt or staffed response; verify an actual iOS and Android receipt, readable call-911 instructions, accessibility, and a reachable real responder. Do not place a real 911 call during synthetic tests.
- **Money:** Synthetic and isolated Stripe sandbox objects need exact ownership reconciliation, real webhook signatures, refunds and charge/transfer reversals in a dedicated test environment; not yet demonstrated.
- **Florida insurance:** TNC's statutory lapse/fallback obligation remains open in issue #51. No code can replace verified binding insurer documents and Florida legal advice.
- **Capacity:** 10k/100k/1m registered-user forecasts and 10k synthetic concurrent Travels do not establish Firestore quotas, cost, billed reads, external routing/notifications, or p99 production performance.
- **Nationwide prices:** Government driver wage archive/county crosswalk, actual Operator expense + net targets, and current independent route-comparable Traveler totals remain incomplete. Do not change fares or activate jurisdictions.

No real passenger or live-money activity is authorized by this correction. Council perspectives remain conceptual published-management lenses, not personal endorsements. Merge only after all exact-head required tests, independently check Render running revision, and preserve the issue ledger.
