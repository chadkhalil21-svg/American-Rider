# Codex route and state inventory

## Method and count

This inventory covers all 49 Expo Router source modules in `app/`: 47 route identities, one shared layout, and one iOS implementation of `/pickup-map`. The audit inspected all route sources, their context/API dependencies, the five language catalogues, and the server tests. A source inspection is not a visual pass. The screenshot manifest records all device work as pending.

State abbreviations: **D** default/populated, **L** loading or submitting, **E** empty, **F** failure/provider unavailable, **O** offline or interrupted, **R** restart/restored, **K** keyboard or long input, **T** terminal/completed, and **P** permission denied.

## Traveler and account routes (24)

| Route | Material reachable states inspected | Authority or exit |
| --- | --- | --- |
| `/` | D, L, E, F, O, R; signed out, Traveler, Operator, drawer, current and scheduled Travel | Auth and server Travel records; drawer/sign-out |
| `/account` | D, R; grouped account, Travel, and assistance navigation | Back or selected route |
| `/profile` | D, L, E, F, K; account name, saved places, cabin, contacts, history | Firebase Auth plus local saved preferences |
| `/wallet` | L, E, D, F, O, K; saved methods, default, setup, detach, Apple Pay | Stripe-backed server APIs |
| `/settings` | D, K; five languages, legal links, account closure | Stored language and real routes |
| `/notifications` | D, P, F; category preferences and OS permission | OS permission plus server token/preferences |
| `/delete-account` | D, K, L, F, T; provider-specific reauthentication and active-Travel refusal | Authenticated closure API and Firebase reauthentication |
| `/saved-place` | D, E, K, L, F, P, T; add, replace, remove, unresolved geocode | Device location optional; geocode before local save |
| `/prefs` | D, K, T; saved cabin environment | Local durable preference; back/save |
| `/invite` | D, L, F, T; share/copy and unavailable referral | Server-issued referral only |
| `/history` | L, E, D, F, O; filters and receipt navigation | Authenticated Travel records |
| `/reserve` | D, K, L, E, F, O, P; pickup/destination, party, quote, schedule, class, Smart offer | Server quote and dispatch authority |
| `/pickup-map` | D, L, P, F, K, T; generic and iOS map implementations | Device location/map selection; returns coordinates |
| `/schedule` | D, K, L, F, T; date/time, class, payment, submitted reservation | Server scheduling and payment method |
| `/ride` | L, D, F, O, R, T; search, assigned, accepted, arrived, onboard, completed/cancelled | Server Travel subscription; demo ticker only for explicit demo operators |
| `/complete` | D, L, F, T; rating submission and receipt | Completed server Travel only |
| `/receipt` | L, D, F, R; charge, method, Operator, Travel Number | Server payment/Travel record |
| `/message` | L, E, D, F, O, K; real thread and failed send/read | Authenticated Travel thread |
| `/safety` | D, K, L, F; share, trusted contacts, check-in | Server follow/support plus device contacts state |
| `/emergency` | D, K, L, F, O; 911, emergency case, known/unknown Travel context | 911 stays direct; server case is not shown as successful on failure |
| `/issues` | D, K, L, F, T; support categories and immediate/queued outcomes | Authenticated support API |
| `/lost` | D, K, L, F, T; Travel selection, description, photo, case result | Authenticated lost-item API/private upload |
| `/family` | L, E, D, F, O, K, T; invite acceptance/retry, links, active Teen Travel, revoke | Server Family authorization; failed reads no longer appear empty |
| `/family-travel` | L, E, D, F, O, K; follow link and guardian thread | Server-authorized guardian Travel/thread |

## Smart Travel route (1)

| Route | Material reachable states inspected | Authority or exit |
| --- | --- | --- |
| `/smart` | L, D, E, F, O, R, T; planner none/unavailable, known/unknown fare, changed itinerary, zero/one/two car legs, leg continuation/cancellation | Server journey reference, revalidation, separate authoritative car Travels and agency-paid transit |

The Smart Travel backend tests cover single-feed and multi-feed shapes, unknown fares, two-charge economics, party preservation, cancellation, stale itinerary refusal, and restart continuation. Live OTP/realtime campaigns remain external.

## Operator routes (21)

| Route | Material reachable states inspected | Authority or exit |
| --- | --- | --- |
| `/drive` | D, K; economics explanation and Operator entry | Auth role selection |
| `/operator` | L, E, D, F, O, R, P; not commissioned, off/on duty, offer, expiry, acceptance, stale presence | Server qualification, presence, matching, and acceptance |
| `/operator/qualify` | D, L, F, T; checklist refresh and held/refused documents | Server assessment, never client approval |
| `/operator/documents` | D, L, F, K, T; upload/read/held/refused/accepted | Private upload grant and server document reader |
| `/operator/background` | D, L, F, T; existing report, order, provider wait/review/refusal | Server screening and Checkr workflow |
| `/operator/insurance` | D, K, L, F, T; policy details, upload, expiry/refusal | Server document and eligibility checks |
| `/operator/vehicle` | D, K, L, F, T; identity and vehicle record | Server profile record |
| `/operator/disclosure` | D, L, F, T; English, reviewed translation availability, current/stale acknowledgement | Versioned server disclosure |
| `/operator/review` | L, D, F; held, provider pending, refusal, commissioned | Server qualification status |
| `/operator/commissioned` | T; commissioned outcome | Server eligibility result |
| `/operator/guidelines` | D; operating obligations | Back to Operator flow |
| `/operator/payouts` | L, E, D, F, O; Connect readiness/dashboard | Stripe Connect server APIs |
| `/operator/profile` | D, E, F; identity, vehicle, market, record links | Server profile/qualification records |
| `/operator/inbox` | L, E, D, F, O; unread/read and acknowledgement failure | Durable server-authored institutional inbox |
| `/operator/pickup` | D, L, F, O, R; navigate, arrive, Teen pickup PIN | Server state machine and pickup verification |
| `/operator/trip` | D, L, F, O, R; accepted, arrived, onboard, completion | Server state machine and telemetry |
| `/operator/communicate` | L, E, D, F, O, K; failed delivery and live thread | Authenticated Travel thread; no optimistic success |
| `/operator/complete` | T; completion and settlement-pending result | Server-completed Travel |
| `/operator/revenue` | L, E, D, F; completed Travel earnings | Server Travel/payment records |
| `/operator/withdraw` | D, L, F, T; payout dashboard/withdrawal outcome | Stripe Connect server path |
| `/operator/support` | D, K, L, F, T; human-required and bounded automatic outcomes | Authenticated Operator support API |

There are 21 Operator route identities, including the Operator entry route at `/drive`.

## Framework and failure route (2)

| Route/module | Material states inspected | Result |
| --- | --- | --- |
| `/_layout` | font load, provider composition, protected/authenticated application | Shared initialization; not a visible product destination |
| `/+not-found` | unknown route | Explicit recovery navigation |

## State-matrix result

- **47 route identities** were enumerated.
- **49 route source modules** were inspected, including `/_layout` and the iOS `/pickup-map` implementation.
- **46 product destinations** exist when the framework layout is excluded; this includes the not-found recovery route.
- Default, loading/submitting, empty, populated, provider failure/offline, permission, keyboard/input, restart, and terminal states were traced where each state applies.
- Automated tests cover authority, money, concurrency, provider retry, Family/Teen, Smart Travel, dispatch, screening, scheduling, messaging, support, and Firestore rules.
- Physical-device layout, assistive-technology focus order, background execution, and full visual review are **PENDING**. They are not marked as passed by this inventory.
