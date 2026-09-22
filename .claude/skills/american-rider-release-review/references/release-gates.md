# Release Gates

Deterministic, countable checks. Each gate has a stable ID, a severity, one countable
question, and the evidence a PASS requires. Record exactly one result per gate:
**PASS · FAIL · NOT TESTED · NOT APPLICABLE**.

Rules that apply to every gate:

- PASS is allowed only with evidence from the exact candidate revision or build.
- A translation value proves coverage, not translation quality.
- A passing web test does not prove native iOS behavior.
- A screenshot does not prove interaction or background behavior.
- Test quantity does not prove meaningful coverage.
- "Count = 0" means: produce the count. A belief that it is zero is NOT TESTED.
- Where a gate names a command, run it on the candidate and record the output.
- "Traveler-visible" means every language in `src/i18n/`, not only English.

Severity definitions are in `product-contract.yaml`.

---

## 1. Economics and authoritative quoting (ECO)

| ID | Sev | Countable question | Required evidence |
|---|---|---|---|
| ECO-01 | P0 | Does `platformFee()` in `src/data.ts` return the greater of 150 cents and 5% of the fare rounded up to the cent (Chad, 9 Sept 2026: "five percent") — $1.00→150, $9.99→150, $25.00→150, $29.99→150, $30.00→150, $30.01→151, $45.00→225, $59.99→300, $60.00→300, $61.00→305, $75.00→375, $100.00→500, $250.00→1,250, $1,000.00→5,000, $5,000.00→25,000? | Script output listing every input and output; count of outputs ≠ expected must be 0 |
| ECO-02 | P0 | Does the server's fee computation (the `/quote` and payment paths under `backend/`) return the same fifteen amounts at the same fifteen fares, and does `backend/payments.test.js` (app–server parity at every cent from $0 to $500) pass? | Backend test or curl output per fare; count ≠ expected must be 0; parity mismatch count must be 0 |
| ECO-03 | P0 | Is the coordination commission exactly 1% of the travel fare at $25, $250, $1,000, $5,000 — with no cap? | `coordinationFee()` outputs; $5,000 → $50.00, not $1.00 |
| ECO-04 | P0 | Does the Operator payout equal travel fare − 1% of travel fare at each fare amount in ECO-03? | `earnOf()` / transfer amount per fare |
| ECO-05 | P0 | Is every traveler-facing price derived from the server quote (`quotedFareCents`), with no screen computing a fare or fee independently of the single store derivation? | Grep of `app/` and `src/` for fare or fee arithmetic outside `travelerTotal`; count of independent derivations = 0 |
| ECO-06 | P0 | Does the amount on the payment intent equal the Complete Travel Cost shown at confirmation, to the cent? | Stripe payment intent amount vs. the confirmation screen value for the same travel |
| ECO-07 | P0 | Is there exactly one derivation of the traveler total (`travelerTotal` in `src/state/RideContext.tsx`) that every money-showing screen reads? | Grep count of screens computing fare + fee themselves = 0 |
| ECO-08 | P0 | Do the Terms of Service, in every language, and the About page describe the platform fee as $1.50 or 5% of the travel fare, whichever is greater? | Quoted passage per language |
| ECO-09 | P0 | Does the receipt total equal the confirmation total for the same Travel Number? | Both amounts, same Travel Number |
| ECO-10 | P0 | Is a processing expense ever added to a traveler amount? | Count of traveler-visible lines or arithmetic adding processing = 0 |
| ECO-11 | P1 | Are `PROC_ACH` / `PROC_CARD` (and any processing constants) referenced only in operator or internal code? | Grep results with file paths; count in traveler screens = 0 |
| ECO-12 | P0 | Is a destination outside the market refused rather than priced? | `/quote` response for Homestead-far or out-of-state coordinates is a refusal |
| ECO-13 | P0 | Do travel-class multipliers produce the same amount on options, confirmation and payment for the same class? | Three values, same travel, same class |
| ECO-14 | P0 | Does the amount quoted to the traveler survive to the charge unchanged when the Operator is matched (no re-quote after commitment)? | Quote at confirmation vs. charge after assignment |

## 2. Traveler money presentation (MONEY)

| ID | Sev | Countable question | Required evidence |
|---|---|---|---|
| MONEY-01 | P0 | Across every traveler screen for one travel, how many distinct values are presented as its Complete Travel Cost? | Must be 1; list each screen and the value it presents (a separately labeled tip or refund is not a second Complete Travel Cost) |
| MONEY-02 | P0 | How many traveler screens itemize commission, platform fee, processing or Operator payout? | Count = 0, with screen list checked |
| MONEY-03 | P1 | Does every displayed amount carry a label saying what it is? | Count of unlabeled amounts = 0, per screen |
| MONEY-04 | P1 | Does any screen render an amount and a doubt about that amount together ("may change", "estimate", "approx.")? | Grep output with every hit listed; count = 0 |
| MONEY-05 | P2 | Is currency formatting identical on every screen and in every language (symbol, two decimals, thousands separator)? | Sample of ≥10 amounts across ≥5 screens, ≥2 languages |
| MONEY-06 | P1 | Does an amount ≥ $1,000.00 render without truncation or wrapping on every money screen at 320pt? | Screenshots at 320pt with a $1,234.56 travel |
| MONEY-07 | P2 | Do prices in columns use tabular figures? | Computed style or component (`Num`) on each column |
| MONEY-08 | P1 | Is the all-in amount labeled as the complete cost (or plain-English equivalent), never as an estimate where the amount is authoritative? | Label text per screen |
| MONEY-09 | P0 | Can a pending or failed payment ever display as paid? | State matrix: pending, failed, succeeded → label shown for each |
| MONEY-10 | P1 | Is a tip, where offered, shown separately and never altering the travel fare or Complete Travel Cost? | Receipt with tip: three distinct labeled lines |
| MONEY-11 | P1 | Is a refund or reversal shown with its own amount and status, never netted silently into the travel amount? | Refunded travel receipt |

## 3. Terminology and copy (COPY)

| ID | Sev | Countable question | Required evidence |
|---|---|---|---|
| COPY-01 | P2 | How many traveler-visible occurrences of "ride", "trip", "ride fare", "trip fare" or "every fare" refer to American Rider transportation? | Grep of `src/i18n/*.ts` and JSX; count = 0, with each hit classified |
| COPY-02 | P2 | How many traveler-visible occurrences of "driver", "rider" or "passenger" appear where "Operator" or "Traveler" is meant? | Grep output with every hit listed; count = 0 |
| COPY-03 | P2 | How many traveler-visible strings contain a flagged phrase (No hidden fees, No surge pricing, Best prices, Ride smarter, Great choice, You're all set, Almost there, Don't worry)? | Count = 0, all languages |
| COPY-04 | P2 | How many user-visible strings contain an exclamation mark? | Grep output with every hit listed; count = 0 |
| COPY-05 | P2 | How many user-visible strings contain an emoji? | Grep output with every hit listed; count = 0 |
| COPY-06 | P1 | How many controls are named after something other than the action they immediately perform? | Audit table: every control label → action performed; mismatches = 0 |
| COPY-07 | P2 | How many visible numbers lack a label or unambiguous meaning? | Audit per screen; count = 0 |
| COPY-08 | P2 | How many place names use conversational shorthand where a proper name exists ("MIA Airport")? | Grep output with every hit listed; count = 0 |
| COPY-09 | P2 | Is every Travel Number rendered in the monospace component and in one consistent format? | Grep of Travel Number render sites; format sample |
| COPY-10 | P2 | Do operator screens use ARTS terms (Commissioned, In Service, Travel Number) and traveler screens plain English, with no leakage either way? | Audit of ≥10 strings per side |
| COPY-11 | P2 | How many user-visible strings apologize ("sorry", "unfortunately", "we couldn't")? | Grep output with every hit listed; count = 0 |
| COPY-12 | P2 | How many section labels or headings editorialize a state ("Quiet right now", "A little busy")? | Grep output with every hit listed; count = 0 |

## 4. Localization completeness and quality (L10N)

| ID | Sev | Countable question | Required evidence |
|---|---|---|---|
| L10N-01 | P1 | Does `node scripts/check-i18n.mjs` report every language complete with zero duplicate keys? | Command output on the candidate |
| L10N-02 | P1 | Does `node scripts/check-untranslated.mjs` report zero untranslated user-visible strings? | Command output |
| L10N-03 | P2 | Does `node scripts/check-unused-i18n.mjs` report zero keys nothing renders? | Command output |
| L10N-04 | P1 | How many module-level constants store translated sentences (evaluated at import, before the stored language is read) rather than keys? | Grep of `t(` at module scope in `src/` and `app/`; count = 0 |
| L10N-05 | P1 | Has each non-English language been read by a reader of that language for register (usted / vous / Lei / Sie) and meaning, on this revision? | Reviewer name, language, date, ≥20 strings sampled, defects listed |
| L10N-06 | P2 | How many sentences are assembled from concatenated fragments around an expression rather than one interpolated key? | Scanner output for `}text{` and `>text{` patterns; count = 0 |
| L10N-07 | P1 | Does changing language re-render every visible screen immediately, without reload? | Screen text before/after switch on ≥3 screens |
| L10N-08 | P1 | Does a chosen language persist across app termination and relaunch? | Relaunch evidence on device |
| L10N-09 | P1 | Is a language control reachable on the front door, with each language named in itself? | Screenshot and tap evidence |
| L10N-10 | P2 | Does every screen hold at 320pt in the longest language (typically German) without horizontal overflow? | `scrollWidth ≤ innerWidth` per screen, or device screenshots |
| L10N-11 | P1 | Does every translated legal document state that the English version governs? | Quoted line per language per document |
| L10N-12 | P2 | Are dates and times displayed in the language's format where they appear? | One sample per language |
| L10N-13 | P1 | Does the app open in the device language when supported, and in English otherwise, with no stored choice? | Cleared-storage launch in an `es` and a `ja` locale |

## 5. Navigation and state integrity (NAV)

| ID | Sev | Countable question | Required evidence |
|---|---|---|---|
| NAV-01 | P1 | How many routes under `app/` are reachable from no UI control and are not deliberately withdrawn (`src/withdrawn/`)? | Route list vs. navigation grep; count = 0 |
| NAV-02 | P1 | How many withdrawn features still have a file under `app/` (and therefore a public URL on web)? | Grep output with every hit listed; count = 0 |
| NAV-03 | P1 | Does Back from every screen return to the screen the user came from? | Audit table of screen → back target |
| NAV-04 | P0 | Does an active travel survive app termination and relaunch with its Travel Number, state and Operator intact? | Kill and relaunch during active travel; state after |
| NAV-05 | P0 | After sign-out, how many items of the previous account's data remain visible or cached? | Grep output with every hit listed; count = 0 |
| NAV-06 | P1 | Does a deep link or notification tap for a completed travel open its receipt, never a live screen? | Recorded tap path and the resulting screen |
| NAV-07 | P1 | Does a stale notification (for a travel that no longer exists) open a defined state, not a blank or crashed screen? | Recorded tap path and the resulting screen |
| NAV-08 | P1 | Does an unknown route render the not-found screen with a working way home? | Navigate to an invented route |
| NAV-09 | P1 | How many screens can be opened without the data they render (cold-open guards)? | Direct navigation to each guarded route; count of blank/crash = 0 |
| NAV-10 | P2 | Does switching Traveler ↔ Operator preserve the other role's in-progress state? | Switch mid-flow and return |
| NAV-11 | P1 | Does the hardware/system back gesture behave identically to the on-screen back control? | Device evidence on ≥5 screens |
| NAV-12 | P1 | Is the primary action of every screen reachable without scrolling at 320pt with the keyboard closed? | Screenshot of every screen |

## 6. Map, route and travel continuity (MAP)

| ID | Sev | Countable question | Required evidence |
|---|---|---|---|
| MAP-01 | P1 | Do the pickup and destination persist visually from destination selection through confirmation? | Screenshots at each of the four stages, same travel |
| MAP-02 | P1 | Is the drawn route from server route data, or, when routing fails, a fallback that is visibly not a road route? | Route source per screen; fallback appearance |
| MAP-03 | P0 | Is a schematic or simulated map ever labeled or presented as live geographic tracking? | Every "LIVE" or equivalent label with its data source; count of mislabels = 0 |
| MAP-04 | P1 | During approach, is the Operator's position real presence data, and is the age of that data shown or bounded? | Data source; stale threshold |
| MAP-05 | P1 | How many travel stages (matching, assigned, arriving, active, complete) show identical map furniture? | Screenshot per stage; count of identical stages = 0 |
| MAP-06 | P2 | During active travel, is less than 50% of the map permanently covered by panels? | Measured fraction, with the screenshot it was measured on |
| MAP-07 | P1 | Is the Travel Number visible throughout active travel? | Screenshot at every stage |
| MAP-08 | P1 | Are Operator name, vehicle and plate visible from assignment until boarding is confirmed? | Screenshot at every stage |
| MAP-09 | P2 | Does every map animation stop when its underlying state ends (vehicle stops at completion; pulse stops when matched)? | Observation after each state change |
| MAP-10 | P1 | How many destinations offered in the app lack coordinates? | Count from `src/data.ts` = 0 |
| MAP-11 | P1 | Do the web and iOS map variants present the same facts (pins, route, Operator, Travel Number, state)? | Side-by-side at the same stage |
| MAP-12 | P1 | Does a moved pickup pin re-price and re-route, and is the new price shown before commitment? | Pin moved, then the new quote shown before commitment |

## 7. Accessibility and responsive behavior (A11Y)

| ID | Sev | Countable question | Required evidence |
|---|---|---|---|
| A11Y-01 | P1 | How many interactive elements have a touch target smaller than 44×44pt? | Measured list; count = 0 |
| A11Y-02 | P1 | How many interactive elements lack an accessibility role or accessible name? | Accessibility inspector audit; count = 0 |
| A11Y-03 | P1 | Are inactive screens, closed drawers and hidden sheets removed from the accessibility tree? | VoiceOver traversal does not reach them |
| A11Y-04 | P1 | Is VoiceOver focus order logical on the primary traveler flow and the primary operator flow? | Recorded VoiceOver traversal order |
| A11Y-05 | P1 | Is Dynamic Type supported, with no arbitrary application-wide 1.3× cap? | `AppText` configuration; rendering at AX sizes |
| A11Y-06 | P1 | Does the primary flow hold at accessibility text sizes (AX1–AX5) without clipped or overlapping text? | Screenshots at every size |
| A11Y-07 | P1 | Is every error message associated with the input it concerns (announced with it, positioned with it)? | Every form listed, with where each error renders and what VoiceOver announces |
| A11Y-08 | P1 | How many states are communicated only through color? | Audit; count = 0 |
| A11Y-09 | P2 | Is reduced motion honored (no motion when the system setting is on)? | Observation with the setting on |
| A11Y-10 | P1 | How many screens overflow horizontally at 320, 375, 390 or 430pt? | `scrollWidth ≤ innerWidth` per screen per width; count = 0 |
| A11Y-11 | P2 | With the keyboard open, is the primary action still reachable on every form? | Screenshot of every form |
| A11Y-12 | P2 | Does ink body text meet 4.5:1 contrast against its surface, and do muted and faint text meet 3:1 (the secondary-text threshold)? | Measured contrast ratio per text style; the palette is fixed by the contract, so a ratio the palette cannot meet is reported under founder decisions required, not silently passed |
| A11Y-13 | P1 | Are all text renders routed through `AppText` (no direct React Native `Text`)? | Grep count of direct imports = 0 |

## 8. Authentication, account, authorization and privacy (AUTH)

| ID | Sev | Countable question | Required evidence |
|---|---|---|---|
| AUTH-01 | P0 | Can a signed-in Traveler read any travel that is not their own? | Firestore rules test; count of readable foreign documents = 0 |
| AUTH-02 | P0 | Can an Operator read travels not assigned to them? | Rules test; count = 0 |
| AUTH-03 | P0 | How many secrets (`sk_`, webhook secrets, service keys) appear in the client bundle or the repository? | Scan of `dist/` and `git grep`; count = 0 |
| AUTH-04 | P0 | Does every authenticated backend endpoint verify the Firebase ID token before acting? | Endpoint list with verification line per endpoint |
| AUTH-05 | P1 | Does account deletion remove personal data and retain the financial record with name and contact removed? | Post-deletion document inspection |
| AUTH-06 | P1 | Does sign-in persist across relaunch and does sign-out revoke it? | Relaunch evidence both ways |
| AUTH-07 | P1 | Are saved home/work addresses stored on the device only, never on the server? | Server-side search for the addresses = 0 hits |
| AUTH-08 | P1 | Does an expired token (401) lead to re-authentication rather than a crash or a blank screen? | Forced-expiry test |
| AUTH-09 | P2 | Are the Terms and Privacy Policy reachable before an account exists? | Front-door links open the documents |
| AUTH-10 | P0 | Are follow/share tokens unguessable (≥128 bits) and expiring (`MAX_LIFE_MS`)? | Token generation code and an expiry test |
| AUTH-11 | P1 | Does the app request only the permissions it uses, each with a stated reason? | `app.json` usage strings vs. features |
| AUTH-12 | P1 | Are error messages consistent with the account-existence policy (no more disclosure than the policy allows)? | The message shown for every auth error |

## 9. Safety and emergency behavior (SAFE)

| ID | Sev | Countable question | Required evidence |
|---|---|---|---|
| SAFE-01 | P0 | Does Call 911 place a real call on a physical iPhone? | Physical-device evidence (dialer opened with 911) |
| SAFE-02 | P0 | How many red buttons exist in the app? | Count = 1, and it is Call 911 |
| SAFE-03 | P0 | Does the emergency message contain vehicle, plate, Operator, Travel Number and location with a timestamp? | Generated message text |
| SAFE-04 | P1 | Does the share-travel link show the current position, and hide a position older than the stale threshold rather than presenting it as current? | Follow page at fresh and stale times |
| SAFE-05 | P0 | How many safety promises are rendered that the product does not keep? | Audit of every safety string against implemented behavior; count = 0 |
| SAFE-06 | P1 | With location denied, does the emergency screen say so and still function? | Denied-permission test |
| SAFE-07 | P1 | Are saved emergency contacts (≤3) reachable from the emergency screen in one tap? | Recorded tap path and the resulting screen |
| SAFE-08 | P0 | On a device that cannot place calls, is the user told to use another phone? | Simulator/iPad evidence |
| SAFE-09 | P1 | Is the Traveler prompted to check the plate before boarding? | Screenshot at arrival |
| SAFE-10 | P1 | Does "I need help" reach a defined destination (screen or person), never a dead end? | Recorded tap path and the resulting screen |
| SAFE-11 | P0 | Can the emergency screen be reached in ≤2 taps from any active-travel screen? | Tap count from every active-travel screen |

## 10. Operator availability and background operation (OPS)

| ID | Sev | Countable question | Required evidence |
|---|---|---|---|
| OPS-01 | P1 | Does an Operator remain In Service with the phone locked for ≥30 minutes? | Physical-device evidence: presence timestamps across the interval |
| OPS-02 | P0 | Is presence renewed at least every 90 seconds in the background, and is presence older than 5 minutes excluded from matching? | Server logs; matching test with stale presence |
| OPS-03 | P0 | Is an unanswered offer re-offered (a lapse is not a decline)? | `sweepAssignments` evidence: lapsed offer → re-offer |
| OPS-04 | P0 | Can an Operator without a valid insurance expiry date enter service? | Attempt with no date and with an expired date; both refused |
| OPS-05 | P0 | Can an account that is not Commissioned receive travel? | The attempt, and the refusal shown |
| OPS-06 | P1 | Does a background presence renewal ever blank the Operator's vehicle record? | Record before/after renewal |
| OPS-07 | P1 | Does going out of service stop background location updates within one renewal interval? | Location task state after |
| OPS-08 | P1 | Is a revoked location permission surfaced as an explicit block to entering service, not a silent failure? | Revoke, then attempt |
| OPS-09 | P1 | Is Always location permission requested with a stated reason before entering service? | The prompt's text as shown on device |
| OPS-10 | P1 | Does dispatch select the nearest available, In-Service, Commissioned Operator? | `matchOperator` test with ≥3 candidates |
| OPS-11 | P1 | Does an Operator receive an offer while the app is backgrounded (notification arrives)? | Physical-device evidence |
| OPS-12 | P1 | Is the Operator shown the Traveler's pickup, destination, fare and payout before accepting? | Offer screenshot showing all four values |

## 11. Scheduled travel (SCHED)

| ID | Sev | Countable question | Required evidence |
|---|---|---|---|
| SCHED-01 | P0 | Is a scheduled travel dispatched at its time when the Traveler's phone is closed and the app is not running? | Server-side scheduler evidence; phone off during dispatch |
| SCHED-02 | P1 | Does a scheduled travel persist to the account and survive relaunch? | Terminate, relaunch, and the state observed after |
| SCHED-03 | P1 | Can a time in the past be scheduled? | The attempt, and the refusal shown |
| SCHED-04 | P0 | Does cancelling before dispatch charge nothing? | Payment records after cancel = none |
| SCHED-05 | P0 | Does the amount quoted at scheduling equal the amount charged at dispatch? | Both amounts, same Travel Number |
| SCHED-06 | P2 | Is the scheduled time displayed in the market's local time in every language? | One sample per language |
| SCHED-07 | P1 | Is the Traveler notified before the scheduled time and at dispatch? | Notification received, with timestamp, on device |
| SCHED-08 | P1 | If no Operator is available at the scheduled time, is the Traveler told, and is the travel not silently dropped? | Forced no-availability test |

## 12. Payments, receipts, retries and idempotency (PAY)

| ID | Sev | Countable question | Required evidence |
|---|---|---|---|
| PAY-01 | P0 | Can retrying a failed or timed-out payment create a second charge? | Idempotency-key test: two submissions → one charge |
| PAY-02 | P0 | Does the payment intent amount equal the Complete Travel Cost? | Intent amount vs. displayed amount |
| PAY-03 | P0 | Is the Operator transfer exactly travel fare − 1% and is it automatic on completion? | Transfer record per completed travel |
| PAY-04 | P0 | If a travel is charged but cannot be created, is a case opened and the amount refundable, and is the Traveler told? | Forced-failure test; case record; screen text |
| PAY-05 | P1 | Does the receipt show the Complete Travel Cost and the Travel Number? | Receipt screenshot with both values visible |
| PAY-06 | P1 | Does a declined card produce a clear message and no travel? | Test card decline |
| PAY-07 | P0 | Is every webhook signature verified before the event is acted on? | Handler code and a bad-signature test |
| PAY-08 | P0 | Does a failed transfer leave the travel unsettled rather than marked paid to the Operator? | `sweepSettlements` test |
| PAY-09 | P0 | Is simulated-payment mode labeled in the test program and impossible in the production configuration? | The config value in each environment |
| PAY-10 | P1 | Does a refund path exist, and is it tested? | Test name and its output on the candidate |
| PAY-11 | P1 | Are 400, 401, 403, 409, 429, 500 and 503 from the payment server each mapped to a defined traveler-visible state? | Matrix with screen text per code |
| PAY-12 | P1 | Does a malformed payment response fail safely (no charge assumed, no travel created)? | Malformed-response test |

## 13. Reliability and observability (REL)

| ID | Sev | Countable question | Required evidence |
|---|---|---|---|
| REL-01 | P1 | Does the backend health endpoint respond, and is the host's health check green for the candidate revision? | Health response body and the host dashboard state |
| REL-02 | P1 | Does every backend error path log with the Travel Number where one exists? | Grep of error logging sites |
| REL-03 | P1 | Does every client network call have a timeout with a user-visible outcome? | Call list with timeout per call; count without = 0 |
| REL-04 | P1 | Does each of 400, 401, 403, 409, 429, 500, 503 from every endpoint produce a defined UI state? | Matrix of code × endpoint → screen text |
| REL-05 | P1 | Does malformed JSON from any endpoint fail without a crash? | Malformed-body test per endpoint and the handled outcome |
| REL-06 | P1 | Offline, is every action either explicitly refused or queued with a visible state, never silently dropped? | Airplane-mode test per action |
| REL-07 | P2 | Are Firestore reads per travel bounded (no unbounded listeners or scans)? | Read counts per flow against the daily quota |
| REL-08 | P1 | Does the monitor report an overflow loudly when a scan limit is reached? | `report.unwatched` test |
| REL-09 | P1 | Is crash reporting configured and receiving from the native build? | A test crash appears in the dashboard |
| REL-10 | P2 | Is cold start under 3 seconds on the oldest supported iPhone? | Measured cold-start time on the named device, with the build number |
| REL-11 | P1 | Do `cd backend && npm run lint && npm test` both pass on the candidate? | Command output (lint is not optional; it finds wiring errors tests cannot) |
| REL-12 | P1 | Does `npm run check` (typecheck, three i18n gates, backend tests) pass on the candidate? | Command output |

## 14. Release identity and source/build parity (BUILD)

| ID | Sev | Countable question | Required evidence |
|---|---|---|---|
| BUILD-01 | P0 | Were the web deployment and the TestFlight build cut from the same commit? | Both commit hashes, shown equal |
| BUILD-02 | P1 | Is the app version / build number incremented and recorded for this candidate? | `app.json` and `eas build:list` |
| BUILD-03 | P1 | Is the backend revision recorded and deployed before the client release? | Backend commit and deploy time vs. client |
| BUILD-04 | P1 | Was the working tree clean at build time (no uncommitted changes compiled in)? | `git status` at build |
| BUILD-05 | P1 | Was `npx expo prebuild --clean` run after any change to `plugins` in `app.json`? | `Podfile.lock` contains every plugin |
| BUILD-06 | P0 | How many secrets are present in git history or the built bundle? | Secret scan output over history and bundle; count = 0 |
| BUILD-07 | P1 | Was every native-only capability verified on a physical device for THIS build number? | Device, build number, capability, date |
| BUILD-08 | P2 | Do the release notes list only founder-approved changes? | Notes vs. commit list |
| BUILD-09 | P1 | Does the review report name the exact commit, deployment id, build number and backend revision? | The report's identity table, complete |
| BUILD-10 | P1 | Was the project built from a path containing no space? | The build log's project path |
