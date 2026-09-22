# Test Matrix

What release testing must cover, and what each environment can and cannot prove. A cell
that was not exercised on the candidate revision is **NOT TESTED** and appears in the report
as residual risk. It is never assumed.

## Environments

| Environment | Proves | Cannot prove |
|---|---|---|
| **Web production build** (`https://american-rider.expo.app`, promoted from the candidate commit) | Layout, copy, localization, navigation, money presentation, flow, most state handling | Anything native: push, background location, Live Activity, Apple Pay, real dialing, native maps, permissions prompts, termination/relaunch semantics |
| **iOS Simulator** | Native layout, Dynamic Type, VoiceOver traversal, keyboard behavior, permission prompts, termination and relaunch, deep links | Background presence with the phone locked, real calls, push delivery, Apple Pay, real GPS, battery and thermal behavior |
| **Physical iPhone** (TestFlight build, number recorded) | Everything native-only: background operation with the phone locked, push, Live Activity, Call 911 reaching the dialer, real location, Apple Pay, real permission revocation | Nothing it was not run on — record the device model and iOS version |
| **Backend test environment** (revision recorded) | Server pricing, matching, settlement, idempotency, webhook verification, error codes, sweeps | Client rendering, native behavior |

**Native-only capabilities must not pass using web stubs or simulator assumptions.** The web
build swaps `@stripe/stripe-react-native` and `expo-widgets` for shims and renders three
components (`LiveMap`, `FindMiguel`, the pickup map) in non-native variants. A pass observed
there proves the web variant, nothing more.

## Viewports

Every screen, both roles, at each width. Evidence: no horizontal overflow
(`scrollWidth ≤ innerWidth` on web; no clipped edge on device), primary action reachable.

| Width | Represents |
|---|---|
| 320pt | iPhone SE and smallest supported |
| 375pt | iPhone 13 mini / classic width |
| 390pt | iPhone 14 / 15 / 16 |
| 430pt | Plus / Pro Max |

## Type sizes

| Setting | Evidence |
|---|---|
| Standard Dynamic Type | Baseline screenshots |
| Enlarged Dynamic Type (Large / xLarge / xxxLarge) | Primary flow screenshots; no clipping, no overlap |
| Accessibility Dynamic Type (AX1–AX5) | Primary flow screenshots; every primary action still reachable |

## Content stress

| Condition | How to produce it | Evidence |
|---|---|---|
| Long names | An Operator and a Traveler named with 40+ characters | Every card and header that shows a name |
| Long addresses | A destination like "Miami Beach Convention Center, 1901 Convention Center Dr" | Selection list, review, receipt, emergency message |
| Every supported language | en, es, fr, it, de — switched from the front door | Every screen in at least the longest language; money and safety screens in all five |
| Large monetary values | A travel at $1,234.56 and one at $12,345.67 | Every money screen at 320pt |
| Keyboard-open states | Every form with the keyboard raised | Primary action reachable; nothing hidden |

## Permissions and connectivity

| Condition | How to produce it | Evidence |
|---|---|---|
| Denied and revoked permissions — denied | Deny location / notifications at the prompt | Each dependent screen states the denial and still functions or explicitly blocks |
| Denied and revoked permissions — revoked | Grant, then revoke in Settings, then return | Same as denied; no silent failure; Operator cannot enter service without location |
| Offline | Airplane mode at each primary action | Every action explicitly refused or visibly queued; nothing silently dropped |
| Timeouts | Backend paused or a 30s+ delay injected | Every network call reaches a user-visible outcome |

## Server responses

Each code, from each endpoint the client calls, must produce a defined UI state. Record the
screen text for each cell.

| Code | Meaning to test |
|---|---|
| 400 | Malformed request from the client |
| 401 | Expired or missing token → re-authentication |
| 403 | Authenticated but not permitted (e.g. Operator not Commissioned) |
| 409 | Conflict — travel already assigned, duplicate submission |
| 429 | Rate limited → wait and retry, no duplicate action |
| 500 | Server fault → no charge assumed, no travel assumed |
| 503 | Server unavailable / asleep → explicit state, retry path |
| Malformed body | Invalid JSON or missing fields → fails safely, no crash |

## Lifecycle

| Condition | How to produce it | Evidence |
|---|---|---|
| App termination and relaunch | Kill the app during: destination selection, matching, active travel, Operator In Service | State restored or explicitly reset; Travel Number and Operator intact during active travel |
| Stale notifications | Tap a notification for a travel that completed or was cancelled | A defined screen (receipt or not-found), never blank or crashed |
| Deep links | Open a Travel Number link for own travel, another user's travel, an invented one | Own → receipt; foreign → refused; invented → not-found |
| Background and locked-phone operation | Operator In Service, phone locked, ≥30 minutes | Presence timestamps continue at ≤90s; an offer arrives as a notification; physical device only |

## Roles

Both roles on every environment where they can run. Record which roles were tested where.

| Role | Primary flow to walk |
|---|---|
| Traveler | Front door → account → destination → options → confirmation → matching → travel → completion → receipt |
| Operator | Qualification → documents → insurance → disclosure → Commissioned → In Service → offer → operation → completion → revenue |
| Both on one account | Switch mid-flow each way; the other role's state preserved |
