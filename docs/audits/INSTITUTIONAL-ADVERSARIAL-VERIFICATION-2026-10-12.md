# American Rider — Institutional Adversarial Audit, 12 October 2026

**Not a production or nationwide certificate.** This is an independent source-based review of current code and ledger and one urgent correction. Follow-up physical device, provider, finance and legal evidence remain separate.

## Standards applied BEFORE code modification

- Google Firestore best practices: https://firebase.google.com/docs/firestore/best-practices — bounded cursor pages, gradual scaling, document read costs, no silent missing rides.
- Amazon Builders' Library: https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/ — make retry-safe state transitions, separate critical actions from repeated traffic; avoid duplicate financial/safety work.
- NASA SWE-055 and SWE-029: https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695440/SWE-055%2B-%2BRequirements%2BValidation and https://swehb.nasa.gov/pages/viewpage.action?navigatingVersions=true&pageId=23200749 — define intended behavior, adverse behavior, acceptance criteria and realistic operational validation.
- Stripe idempotency and webhook delivery: https://docs.stripe.com/api/idempotent_requests and https://docs.stripe.com/webhooks — duplicate, late and failed money/provider messages must be reconciled.
- NIST secure development: https://csrc.nist.gov/pubs/sp/800/218/final ; OWASP API risks https://owasp.org/API-Security/editions/2023/en/0x11-t10/ ; Apple UI https://developer.apple.com/design/human-interface-guidelines/ .

Council is a published-guidance/management-lens review, NOT personal consultation or external endorsement. Ford: repeatable process; Rockefeller: complete costs and reserves; Jobs/Apple: one clear phone workflow; HBS, MIT, Stanford: viable local service economics and marketplace fairness; institutional hospitality: accessible and dependable help.

## Source-confirmed safety defect and correction

Source backend/monitor.js previously inferred congestion from nearby stopped American Rider vehicles and continued BEFORE examining an explicit Traveler help message or an unread Operator report of injury. It could also automatically clear an emergency when motion resumed. These are source-level defects, not proof of a witnessed actual incident.

Corrected in the proposed safety patch: explicit Traveler help is highest priority (regardless of stop timer or congestion); urgent Operator reply bypasses a congestion explanation; escalated/emergency state cannot be silently cleared by movement; failed emergency ticket, Firestore state write or push acceptance is reported as degraded; Traveler and Operator emergency push attempts are independent. It does NOT telephone 911, guarantee device delivery, or substitute a live safety team.

New synthetic tests exercise help during congestion, injured Traveler reported during congestion, moving after emergency, help before stop threshold, case-filing failure and one failed push while attempting the other. Run exact-head twice and retain existing money, auth, monitor, screening, insurance, routing and Firestore emulator tests.

## Whole-platform requirement and real-evidence matrix

| Area | Code/evidence reviewed | Remaining external or scale proof |
|---|---|---|
| Identity and permissions | auth.js, server.js, secure routes and CI | Real Firebase account/session expiry, revocation, unauthorized endpoint attempts |
| Single Traveler Total / Operator share | fareauthority.js, economics.js | Representative local real-route quotes, government tolls, true fixed/variable costs |
| Charges, refunds, payouts, disputes | payments.js, travelmoney.js, bookingrecovery.js | Stripe sandbox object-by-object reconciliation, duplicate webhooks, payment outages, payout settlement |
| Screening and adverse action | screening.js, qualification.js | Actual provider reports, consent/identity, lawful adverse-action trail |
| Commercial insurance and jurisdiction | insurance-monitoring.js, market-readiness.js | Independent insurer confirmation, expiry during Travel, statutory company coverage, permits |
| Travel monitoring/emergency | monitor.js, this correction | Real phones, push receipts, durable ticket delivery, live staff response, GPS loss |
| Full active Travel scan | monitor.js 200-per-page exhaustive one-minute scan | Peak 1k/10k Travel read rate, Firestore price/latency, equitable scalable sharding without omissions |
| Outage recovery and concurrency | PR #130, schedulerlease.js, sweeps | Real quota exhaustion, staggered 1/2/10 instances, backlog p95/p99 aging, rollback |
| Dispatch, presence, GPS, tolls | matching.js, geooperators.js, streets.js | Real mapping/road/airport routes, rider ETA, 10k Operator concurrency and incorrect GPS |
| Provider events and emergency email | providerqueue.js, push.js, Resend callback | Signed durable downstream resolution, no falsely acknowledged support success |
| National pricing | PRs #126, #132, #133, #135 research | BLS publisher-permitted actual files (prior 403), area mapping, local Operator net and cost, permitted comparable current market prices |
| Smart Travel, transit | OTP/GTFS architecture | Real agency schedules, rerouting, connections, system failures and transit fare |
| Family/Teen | guardian/Teen components | Independent real devices, revocation, consent, PIN, guardian safety delivery |
| Lost items, support and accessibility | tickets/support and app screens | Closed-loop real UI test, VoiceOver, actual support and emergency response |
| iOS/Android/payments | Expo build/CI | Physical iOS and Android, Apple Pay/Google Pay test mode, relaunch, push, permissions |
| Market activation, airports, state law | market-readiness and Ops | Live authenticated phone action and enforceable licensing, permits, verified coverage |
| Security, rate limits, privacy | auth, ratelimit, accountdeletion | Multi-instance abuse, object authorization, teen privacy, deletion/retention verification |
| Fully-loaded unit economics | fully-loaded-coverage and ledger | Actual vendor invoices, tax/compliance, Firestore billed usage, corporate insurance, staffed exceptions |
| Release integrity | GitHub checks, Render version | Exact deploy status, health, rollback, incident procedures, no assumption synthetic equals production |

Scale planning: 1,000 continuously active Travels scanned once a minute implies about 1.44 million returned active document reads/day, excluding index cost and other flows. This is arithmetic, NOT a measured bill or proof of service capacity. Test 10k/100k/1M scenarios as different realistic arrival and concurrency distributions and measure p95/p99 ages, peak reads/writes and money idempotency. Avoid an arbitrary cap that silently drops safety coverage.

Prior completion preserved: PR #125 refund recovery, PR #130 quota recovery, and research PR #135 are merged. Source/bundle passing is not an insurance certificate, booking authorization, real Stripe settlement or a guarantee that an emergency notice reaches a person. Release only after required fresh checks; do not change fares, buy providers, or admit markets.
