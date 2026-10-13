# American Rider — source-led safety push receipt verification (12 October 2026)

## Actual defect vs intended behavior

After an emergency push, `backend/push.js` previously returned **Expo ticket accepted** and `backend/monitor.js` recorded this as a push attempt, but *no later Expo receipt was fetched*. This left errors from Apple/Google notification services unobserved. A ticket ID is NOT physical-device receipt. [Expo's official sending guide](https://docs.expo.dev/push-notifications/sending-notifications/) explicitly says check push receipts about 15 minutes later, before the service deletes receipts after 24 hours. [Apple notification design](https://developer.apple.com/design/human-interface-guidelines/managing-notifications) requires correct urgency handling and permissions; unrestricted critical alerts would require separate platform entitlements. **We claim neither critical alerts nor seen-on-handset delivery.**

### Source / independent institutional lenses

- Google [Firestore best practices](https://firebase.google.com/docs/firestore/best-practices) and [billing](https://cloud.google.com/firestore/pricing): avoid scanning all users/messages, use indexed small due-time queries rather than periodic full reads. The recurring work is bounded to 100 due receipts per 5-minute tick; a second query of at most 100 expired audit records controls storage growth.
- Amazon Builders' Library [making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/): ticket ID is a stable deduplication key, and retrying a receipt lookup does not send a duplicate notification. Provider failures cause delayed retry with a cap and 24h deadline.
- NASA [SWE-055 software requirements validation](https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695440/SWE-055%2B-%2BRequirements%2BValidation): automated network adapter tests alone cannot validate iPhone/Android notification delivery or staffed response in intended conditions.
- Google SRE [latency/traffic/error/saturation](https://sre.google/sre-book/monitoring-distributed-systems/): privacy-safe periodic counters of submitted, accepted by platform, rejected, missing and expired are evidence; user IDs, notification tokens, coordinates and Travel details must not enter aggregated logs.
- OWASP [MASVS](https://mas.owasp.org/MASVS/): treat on-device push as potentially displayed on a lock screen. Do not put personal incidents, locations or raw token in receipt records.
- Harvard Business School, Frances Frei, [Service Excellence by Design](https://www.hbs.edu/faculty/Pages/item.aspx?research=7002): reliable safety service must be supportable at real operating cost. Apple's human-interface notification guidance prioritizes actionable, understandable messages. Stanford design-testing literature helps test recovery journeys, but none of these institutions endorsed or personally reviewed this code.
- Council lens from `docs/COUNCIL-STANDARDS.md`: Ford = repeatable safe process; Rockefeller = bounded costs; Jobs = trustworthy emergency behavior; universities and designers = externally evidenced usability/safety. Historical advisers were **not contacted**.

## Proposed implementation and resource bounds

`backend/pushreceipts.js` durably registers the ticket for `check_in` safety notifications before `notify()` can return success. It stores an Expo ticket, account reference and a **SHA-256 token fingerprint, never raw notification token or Travel details**. It fetches receipts no earlier than 15 minutes; no fetch runs when there is no due work. A distinct `provider_accepted` result means accepted by **FCM/APNs**, not by the actual phone or user. A `provider_rejected` result is recorded and surfaced in aggregate; `DeviceNotRegistered` clears the push token only through a Firestore compare-and-set when it has not rotated. An absent receipt remains unverified; transient provider outage retries without sending another push; after 24h mark unverified-expired; cleanup query deletes audit records when the 7-day retention ends.

Existing cross-instance scheduler lease is retained; work runs only every five minutes via `sweepcadence.js`, max 100 receipt lookups and 100 expired-record purges per execution, using singly indexed Firestore `nextAttemptAt` and `purgeAt`. At idle, the module performs **two empty minimum-charge Firestore queries per five-minute run**, not per Traveler or county (up to 576 empty-query reads/day, aside from scheduler bookkeeping). Activity adds one ticket record write, due-item reads and receipt resolution writes. Real billed reads, official index deployment and measured prod p95 are not attested by an emulator.

## Synthetic proof required by release gate

`backend/pushreceipts.test.js` uses the **actual** receipt/push modules with a fictional Firestore double and Expo responses. Test successful durable ticket, delay before first poll, FCM/APNs provider-accepted status, token-rotation race, invalid-current-token removal, provider 503/outage backoff, missing receipt retry, 24h expiry, 147-ticket backlog spanning 100+47 bounded batches, quota failure before ticket storage, duplicate ticket deduplication and 7-day purge. The release gate now also runs `infra/rules-emulator/push-receipts.test.cjs` against the **real local Firestore emulator**: 205 seeded safety receipts are read in 100+100+5 pages and marked as terminal (a fourth scan must return zero); one stale-token removal transaction must not erase the rotated replacement. The independent deterministic commissioning manifest runs the new 147-ticket synthetic test directly. Existing `push-acceptance.test.js`, `monitor.test.js`, signed Stripe event chain, Firestore emulator Travel scan, architecture/scale checks and twice-run exhaustive release gates remain in force.

**Do not mark successful until exact PR-head CI succeeds and Render confirms release.**

## Further provider reliability finding: Firebase daily reset quota

An earlier real CI run reported `sendOobCode: QUOTA_EXCEEDED` after all other real sign-up/login/session tests had succeeded. Google's [published Firebase limits](https://firebase.google.com/docs/auth/limits) restrict daily password-reset emails. Previously every code commit attempted a real reset, consuming scarce production email quota. The updated PR check retains real provider account creation, token, wrong-password and cleanup steps without issuing email; the reset request now occurs only on the once-daily scheduled check or an explicit manual opt-in. New offline tests run twice and prove no ordinary PR email issuance, exactly one planned email request, and truthful failure on quota denial. **Future daily real reset completion and actual inbox delivery remain unverified**, not silently converted into a success.

## Cross-domain audit: evidence ledger

| Domain | Current evidence level | Open gate |
|---|---|---|
| Emergency classification/escalation | Source-controlled behavior and synthetic monitor tests | Actual handset, permission, OS lock, staff acknowledgment, 911 interaction |
| Expo delivery | Ticket acceptance already modeled; **new provider receipt reconciliation** pending CI | Actual Apple/Google response observed and phone acknowledgment separately |
| Stripe money | Real sandbox $1 partial refund plus independent signed fictitious event replay | Genuine TEST webhook to correct TEST receiver and complete real-money-object Connect refund/transfer reversal |
| Firestore cost | 1,205-document seven-page real local emulator query twice | Actual Firestore index/read/write billing and production-like measured concurrency |
| Regional pricing | Research-only official-file parsing and synthetic 3,111-county study tests | Complete authentic Census/BLS imports and verified Operator actual costs and local market quote comparables |
| Operator/insurance | Operator-funded coverage decision preserved; source-level gates tested | Lawfully admissible market, physical provider/carrier documents and incident runbooks |
| Mobile/security/design | Expo bundles, unit source rules, OWASP/Apple design review | Real signed app end-to-end tests on iOS and Android with screen reader and offline transitions |

A source can motivate tests without proving unobserved field performance. This change is **not commercial launch authorization**, no market status or live fare change, and no actual emergency service/911 notification from our tests.
