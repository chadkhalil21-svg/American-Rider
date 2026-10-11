# Operator presence and financial eligibility — research-first decision (2026-10-11 UTC)

## Governing references
- Stripe Connect: [account.updated and signed webhooks](https://docs.stripe.com/connect/webhooks); [API request limits](https://docs.stripe.com/rate-limits); [test-mode Connect](https://docs.stripe.com/connect/testing).
- Google Firebase: [Firestore best practices](https://firebase.google.com/docs/firestore/best-practices); [automated scale / hotspot avoidance](https://firebase.google.com/docs/firestore/understand-reads-writes-scale); [Firestore vs Realtime Database](https://firebase.google.com/docs/database/rtdb-vs-firestore); [Firestore billing](https://firebase.google.com/docs/firestore/pricing).
- Google SRE: [capacity planning and automation](https://sre.google/sre-book/introduction/).
- Render: [Scaling and autoscaling](https://render.com/docs/scaling). Provider documentation is the reference, not a claim of provider approval.

## Verified old source path and defect
`src/backend/presence.ts` posts to `POST /operator/online` on background GPS delivery; foreground renewal is approximately 90 seconds and mobile OS cadence is not guaranteed. In deployed PR #103, this server route retrieved live `stripe.accounts.retrieve` for **every** successful duty renewal, although the server already receives signed Stripe Connect `account.updated` events in `backend/webhook.js`. Each renewal also rechecks eligibility and writes the `operators` Firestore document. That cost scales with online Operator-hours even if no Traveler requests any Travel.

Illustrative lower bound: one Firestore presence write/minute for 8 hours = 480 writes per Operator shift. 100 active Operators = 48,000 writes per day before any booking, more than 20,000 Firestore Standard free daily writes. This is an illustrative workload, not a measured physical-device cadence or actual database bill.

## Narrow correction in this PR
- Reuse only a **server-bound** Stripe status with the same connected account, `payoutsEnabled===true`, `available===true`, finite age at most 24 hours, and a verified server-side timestamp. Never use a phone's assertion of payout readiness.
- A new shift, account change, disabled state or stale attestation makes a direct Stripe request. Paid `/travel/accept` **still checks Stripe directly**, and scheduled dispatch independently rechecks. Signed `account.updated` immediately disables availability if payout/charge capability is lost.
- Do not extend the original Stripe verification timestamp on repeated location renewals. A Firestore transaction prevents a cached-positive GPS renewal from overwriting a newer signed provider downgrade.
- Never bypass screening, commercial insurance verification, market-admission controls, authenticated accounts, document rules or the five-minute stale presence cutoff. Fail closed when data/providers are not trustworthy.
- The existing webhook and existing market-admission transaction are reused. No new cloud service, paid API, external provider or market authorization is introduced.

## Remaining larger-scale engineering (NOT silently marked complete)
- Separate high-frequency transient location/presence from permanent Firestore financial and compliance records **only after comparative benchmarks** for RTDB or other low-cost options; preserve authenticated server dispatch, geographic matching, five-minute timeout and immediate negative eligibility events. A Redis/RTDB migration is neither justified nor free simply because it is popular.
- Measure actual Firestore reads/writes per Operator-hour and per completed Travel with Firebase Usage Insights and query analysis; measure HTTP p95/p99, saturated geohash-cell query cost, real provider 429s and retry backlogs using synthetic isolated load. Avoid load tests against live Stripe/Firestore/HERE.
- Production Firestore billing tier, post-quota-reset idle volume, signed webhook delivery, true physical-device presence cadence and protected market-admission remain outside current GitHub/Render access. Record as UNVERIFIED, not failed or passed.
- Current Render service has one 0.5 CPU / 512 MiB instance and no configured autoscale; choose Render Pro auto-scaling or an alternate only after total-cost and workload tests. Do not buy plans or migrate without owner approval.
- A 24-hour positive attestation window relies on actual signed Connect event delivery; do not commercially commission event-driven duty until the secure live webhook has been exercised with real account-status changes and delayed/replayed deliveries. Whenever pending Travel is accepted, its required direct live check remains mandatory.

## Council rubric applied
- Ford: one uniform server-authoritative duty and dispatch workflow; no per-city or per-Operator cron machinery.
- Rockefeller: bound provider calls to economic and eligibility events, not idle heartbeats; calculate actual contributions before scale upgrades.
- Jobs / Apple: preserve fast safe Operator availability and one-tap Travel; no hidden state or false approval.
- Harvard / Stanford / MIT research lenses: prove assumptions through load/device/provider experiments, not code comments.
- First-class hospitality: never silently accept an ineligible Operator or strand a Traveler because of an uncaught provider error.

No live market admission, billing or insurer/CRA purchase is changed by this decision.
