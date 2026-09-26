# Commercial Release Acceptance Standard

This is the stop condition for American Rider. Repeated exploratory review is useful, but it is not the release criterion.

## Governing product contract

A candidate is reviewed against the repository's current decisions, in this order:
1. `AGENTS.md` and current product specifications/decision records.
2. Server-authoritative money, identity, qualification, dispatch and Travel-state invariants.
3. The founders' visual source of truth and the three-word rubric: institutional, authoritative, sophisticated.
4. The first-class standard: a Traveler sees the outcome and necessary choice, not internal mechanism.
5. Seamlessness: no unnecessary screen, repeated decision, contradictory amount, dead end or state that requires the user to understand implementation.
6. Current law/provider contracts and production configuration.

A later explicit decision supersedes an older one. A reviewer must search the repository for the feature and its decision history before changing behavior. Existing correct behavior is evidence to preserve, not an invitation to redesign it.

## Release verdict

Commercial release is **GO** only when all rows below have evidence at the exact candidate SHA. Anything else is **NO-GO** or **CONDITIONAL / external gate pending**. A new exploratory finding after GO reopens only the affected gate; it does not make readiness an infinite subjective search.

| Gate | Required evidence | Stop condition |
| --- | --- | --- |
| Build | Release Gate | typecheck, i18n, backend tests, Firestore rules, web/iOS/Android export all green |
| Authority/security | adversarial suite + rules emulator | no client authority over price, payment destination, assignment, qualification, payable Travel state, institutional inbox or another account |
| Money | exhaustive economics + Stripe controlled-money campaign | quote=charge=receipt; 99% fare share; toll/refund/settlement idempotency; no duplicate money movement |
| Immediate Travel | end-to-end trace on physical devices | quote → confirm → dispatch → accept → pickup → onboard → complete → receipt → settlement |
| Scheduled Travel | scheduler/fault tests + physical/provider trace | due-time dispatch, payment failure, no supply, crash/retry and charged-but-not-dispatched paths are explicit and recoverable |
| Smart Travel | planner/economics tests + live OTP/GTFS campaign | itinerary is current; preview equals actual car charges; transit fare attribution is truthful; leg 2 cannot strand or change party; cancellation/replan is coherent |
| Family / Teen | authorization/PIN/message tests + device trace | guardian authorization, age gate, pickup verification, tracking and messaging survive both car legs |
| Operator | qualification + background-presence campaign | documents/screening/insurance/payout/duty rechecked; stale or unqualified Operator cannot receive/accept Travel |
| Inbox/communications | durability + identity tests | institutional messages are server-authored, durable, first-read recorded, push is only notification; Travel chat remains separate |
| Safety/support | physical/device and fault campaign | emergency/support/check-in paths remain reachable under provider/network failure; no false success |
| Language | i18n gates + screen copy audit | five catalogues complete; no raw user-visible literals; no reassurance, chatty/editorial copy, mechanism language or terminology drift |
| Visual/design | screenshot corpus + exactness measurements | every reachable screen reviewed at target device sizes; source-of-truth palette/type/cards/spacing/navigation; no clipping/overflow/dead controls |
| Accessibility/usability | device audit | VoiceOver/TalkBack labels and focus, touch targets, contrast, keyboard/input, reduced motion where relevant; critical flow usable without interpretation |
| Performance/reliability | measured release build | startup, quote, dispatch, map and inbox latency budgets recorded; offline/reconnect/background/restart behavior explicit |
| Compliance | counsel/broker/provider evidence | Florida TNC insurance, disclosure, screening/adverse action, zero-tolerance/reporting, fare/identity/receipt obligations and records confirmed |
| Production configuration | independent attestation | production Firebase/auth, Stripe, Checkr, routing/tolls, push, support, storage, scheduler and ops auth; no demo/test bypass |
| Observability/recovery | staged fault injection | provider outage, Firestore failure/quota, duplicate/out-of-order webhook, restart mid-settlement, stale GPS/clock, push/email failure have detectable recoverable outcomes |

## Screen-by-screen product review

For every reachable screen and state, record: route; entry condition; purpose; primary action; secondary action; empty/loading/error/offline state; copy verdict; visual verdict; accessibility verdict; back/escape behavior; next state; screenshot evidence.

Apply three advisers as lenses, not as invented quotations:
- **Henry Ford lens — unnecessary mechanism:** remove steps, duplicated choices, repeated data entry and screens that exist only because the implementation does.
- **John D. Rockefeller lens — durable institution:** preserve auditability, reliability, clear obligations, recoverability, and economics that survive scale.
- **Steve Jobs lens — outcome over mechanism:** expose the decision/result the person needs; keep routing, payment, qualification and provider machinery behind the surface.

No adviser lens may override law, safety, accessibility, truthful money or an explicit current founder decision.

## Smart Travel acceptance

Smart Travel is not a simulation. It is a coordinated journey with zero, one or two real American Rider car Travels around transit. Each car Travel that exists has its own Travel Number, Operator, charge and settlement. The preview must equal the actual American Rider charges under the same economics. Transit money is shown as agency money and is never represented as collected by American Rider when it is not. Unknown agency fare is labeled unknown, not zero.

Leg 2 may begin only from an authoritative paid/completed leg 1 when a first car leg exists. Booker/Traveler/Teen authorization is frozen across the journey. If a car leg is cancelled or the transit plan becomes unusable, the UI must produce a truthful recoverable state, not silently continue an obsolete itinerary.

## Inbox acceptance

The Operator Inbox is American Rider → Operator institutional correspondence, separate from Travel chat. Messages are server-authored and durable. Push/email may announce a message but are not the record. The first successful read acknowledgement is preserved. A failed acknowledgement remains visibly unread and does not navigate as though the record succeeded. Required notices must remain reconstructable by version/content and timestamp.

## Evidence rule

No row is PASS because code "looks correct." Automated checks prove deterministic code boundaries. Physical-device behavior, provider behavior, legal/compliance structure and production configuration require their own evidence. The release decision is made once, against the complete matrix at one immutable candidate SHA.
