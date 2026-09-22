# American Rider — Release Review Report

Candidate `a8f9db3`, reviewed 17 Sept 2026, 21:40–22:40 EDT. Produced by the procedure in
`.claude/skills/american-rider-release-review/` against product contract v2. Every gate result
is from this revision or is marked NOT TESTED; nothing was carried over from an earlier review.

---

## Scope

The working tree at `HEAD` = `a8f9db3` on `skill/american-rider-release-review` — the release
candidate for TestFlight 37 (not yet cut), comprising everything since TestFlight 36 (`7dae837`,
4 Sept): the one-sheet booking, MapLibre maps, the three-group menu, Account details, Payment &
Settlement from Stripe, the 5 % fee rule, the Travel Log and Receipt as records, Patron Support
with cases, Lost Item end to end, the thread reading its record. Roles: Traveler on the iPhone 17
simulator (Patron Support, Lost Item, the thread — walked today on `e8c791a`, whose app code is
byte-identical to this candidate); Operator by code and backend tests only. Flows: code and
catalogue audit of every screen; backend test suite; the live server's `/health`; no physical
device, no web build, no TestFlight build of this candidate exists.

## Identity of the candidate

| Field | Value |
|---|---|
| Source commit | `a8f9db370fcf854dc1204142945bfb171c8578f4` |
| Branch or PR | `skill/american-rider-release-review` (pushed; level with origin) |
| Web deployment identifier | none for this candidate — no public web app by founder decision (Adrian, 17 Sept 2026). The OLD deployment `american-rider.expo.app` is still online (HTTP 200, bundle `entry-110f5389…`, pre-9-Sept code) — promoted to production: **not from this candidate** (see F-01) |
| TestFlight build number | none for this candidate. Last build: 36, cut from `7dae837` (4 Sept). Build 37 (EAS `fc2e14dc`, from `cc55122`) failed at signing on 17 Sept; `eas build:list` returned nothing non-interactively in this session, so the numbers are from `CURRENT_HANDOFF.md`, not re-read |
| Backend revision and environment | `dcccfe3` on Render (`american-rider-server.onrender.com`), verified by `/health` `commit: dcccfe3`, `stripe: test`; `git diff dcccfe3..a8f9db3 -- backend` is empty, so the candidate's server code is what is live |
| Devices and viewports | iPhone 17 simulator, iOS 26.5, 402 × 874 pt, standard type, en + es (today's walk of `e8c791a`); no physical device; no 320/375/430 pt; no enlarged or AX type |
| Roles tested | Traveler (simulator: Patron Support, Lost Item ladder/return/thread, Settings); Operator: code and backend tests only |
| Reviewer | Claude (Fable 5.1) in Adrian's session. **This reviewer implemented `e8c791a`** (the thread's query fix) inside the candidate range, so the deterministic layer below is the implementer's; the qualitative layer was completed by a separate agent with no session context (see Qualitative judgment) |
| Date | 17 September 2026 |

The web deployment and the TestFlight build were not cut from the same commit: there is no web
deployment of this candidate (by decision) and no TestFlight build of it yet. BUILD-01 is
therefore NOT APPLICABLE to the candidate, and the stale public deployment is carried as F-01.

## Recommendation

**CONDITIONAL PASS** — to TestFlight testers, once three things are confirmed by Adrian:
(1) the old `american-rider.expo.app` deployment is taken down (F-01: a public surface quoting a
fee rule the live server no longer charges); (2) the ride screen no longer presents a scripted
vehicle position under a "LIVE · MIAMI" badge — either the badge comes off or the screen carries
the test program's simulation label as payments, review and revenue already do (F-02); (3) the
emergency screen's control and the arrived-stage cancellation sentence (a money statement) read
from the catalogue in five languages (part of F-04); (4) the founders have said which wording
stands when the sheet says "No charge is made" and the receipt says "Total Charged" for the same
travel in test mode (F-20) — a one-key change once decided. The remaining P0 (red controls
beyond Call 911, F-03) and the P1s are required before public testing and launch, not before
internal testers. This is not launch approval: 99 of 164 gates are NOT TESTED, most needing a
physical device, and the qualitative layer found six further P1s.

> PASS FOR TESTING means the build may go to TestFlight testers. It is never launch approval.

## Findings

Severity is the contract's table (P0 money/safety/security/false status; P1 broken primary flow,
misleading status, major localization failure; P2 friction, terminology, design-system; P3
polish). The gate's own weight is quoted with each.

### P0 — Launch blockers

- **F-01 · P0 · ECO-08 / MONEY-01 context, BUILD-01.** The retired web deployment at
  `american-rider.expo.app` is live (HTTP 200 at 21:45 EDT, bundle `entry-110f5389…`), built from
  pre-9-Sept code that states the earlier fee rule, while the server it talks to (`dcccfe3`) charges
  the greater of $1.50 and 5 %. A public traveler surface and the charge disagree about money
  (Stripe is in test mode, so no real money moves — the contradiction is what is live).
  *Correction:* take the deployment down in the Expo dashboard (Adrian; the decision of 17 Sept
  already says no public web app). Closed when the URL no longer serves the app.
- **F-02 · P0 · MAP-03 (gate P0).** The ride screen's map carries the badge "LIVE · MIAMI"
  (`traveler.liveMiami`, drawn in `src/components/LiveMap.ios.tsx:211` and `LiveMap.tsx:216`) over
  a vehicle whose position is `targetFraction(status)` — a fixed fraction of the route per demo
  status step (`LiveMap.ios.tsx:44–51`) — while the travel advances on the store's 2.6 s timer.
  No operator position feed reaches `RideContext` (grep: none). A simulated map is presented as
  live tracking; payments, review and revenue carry a simulation label, the travel does not.
  *Correction:* remove the badge from the ride map, and add the test-program label the other
  simulated surfaces carry (one key ×5) until the operator's presence feed drives the car.
- **F-03 · P0 · SAFE-02 (gate P0; contract `buttons.red: reserved exclusively for Call 911`).**
  Eight red control sites beyond Call 911: `app/safety.tsx:196` "Emergency assistance",
  `app/settings.tsx:105` "Delete Account", `app/delete-account.tsx:109,130` "Yes, delete",
  `app/index.tsx:482` upcoming-travel "Cancel", `app/ride.tsx:233,499` "Yes, cancel",
  `app/ride.tsx:420` "I need help", `app/operator/index.tsx:405` "Decline". *Correction:* ink for
  every one (the contract's ghost secondary), leaving `app/emergency.tsx:378` "Call 911" the only
  red control. Known since 16 Sept (handoff "Found, not fixed"), unchanged.

### P1 — Required before public testing

- **F-04 · P1 · L10N-02 (gate P1).** `scripts/check-untranslated.mjs` reports zero, and at least
  fourteen English literals render from JSX expressions it does not scan:
  `app/emergency.tsx:356` "Text my location" / "Send my location" (the emergency screen's
  primary control); `app/complete.tsx:209` "Complete"; `app/operator/vehicle.tsx:107` "Save";
  `app/delete-account.tsx:130` "Deleting…" / "Yes, delete"; `app/ride.tsx:276` "Your operator",
  `:457–458` "charged" / "Charged" (a key `traveler.chargedLabel` exists); `app/reserve.tsx:166`
  "N mi", `:275` "Looking up…"; `app/schedule.tsx:167–169` "Today" / "Tomorrow" / "Pick a day"
  (rendered at `:234`); `app/prefs.tsx:85` "Quiet" / "Conversation" (rendered at `:108`);
  `app/operator/index.tsx:385,396` "Pickup" / "Destination"; `app/operator/pickup.tsx:64`
  "Arrived" / "En route" / "N min". The independent review found more, on the live-travel path
  itself: `STATUS_LABELS` "Travel Confirmed" / "Operator En Route" / "Operator Arrived" /
  "Traveler Onboard" / "Arrival" / "Travel Complete" (`src/data.ts:475–481`, rendered
  `ride.tsx:252`, `index.tsx:405`); the step labels `['En Route','Arrived','Onboard','Arrival']`
  (`ride.tsx:148`); `'Operator Assigned' : 'Upcoming Travel'` (`index.tsx:451`); **the money
  sentence at `ride.tsx:483` "Your fare is returned less a $3.00 arrival fee, which goes to
  ${name}."**; "Total Charged" / "Total Due" (`complete.tsx:128–130`); the schedule paragraph
  (`schedule.tsx:193–195`); "Confirm today's verification word with your operator:"
  (`safety.tsx:174`); "Not recorded" (`emergency.tsx:63–65`); "Your account" / "Your travel
  history" (`delete-account.tsx`); "Sending" / "Send" (`CheckInCard.tsx:79`); "Dropped pin"
  (`pickup-map.ios.tsx`); operator: "At Pickup" / "Proceed to Pickup", "NAVIGATION · TO PICKUP"
  (`operator/pickup.tsx:47,71`), the Under Review paragraph (`operator/review.tsx:51–52`),
  `Message ${traveler}` (`operator/communicate.tsx:107`). Thirty-plus in all: the live-travel
  screen is English in four languages. *Correction:* key each ×5, and teach the checker ternary,
  array and template literals (its `CODEY` rule skips any line with `= ( ) : ;`) so the count is
  real — the same class of miss as the colon-in-text-node fix of 16 Sept.
- **F-05 · P1 · AUTH-05 (gate P1) and SAFE-05-class promise.** `deleteAccount` calls Firebase
  `deleteUser` only (`src/state/AuthContext.tsx:170`); ride records keep `travelerName`
  (`src/backend/dispatch.ts:260`, the display name at booking) and the traveler's uid, while
  the screen states "American Rider keeps the financial record of completed travel — with your
  name and contact details removed" (`traveler.deletionRecordKept`). The promise is not kept.
  *Correction:* a server endpoint with admin access that, on deletion, blanks `travelerName` on
  the account's rides (and any contact fields) and then deletes the user; the app cannot write
  those fields (rules).
- **F-06 · P1 · REL-03 (gate P1).** 41 `fetch(` sites in `src/backend/*.ts` and
  `src/screens/AuthScreen.tsx`; one carries a timeout (the front door's `/health` probe, 8 s).
  Against a Render free tier that sleeps, every other call can hang with no user-visible outcome.
  *Correction:* one `fetchWithTimeout` (AbortController, ~15 s) in `src/backend/` used by every
  call, each failure mapped to the screen's existing error state.
- **F-07 · P1 · REL-09 (gate P1).** No crash reporting is configured (no Sentry, Crashlytics or
  Bugsnag in `package.json` or `app.json`). The 9–15 Sept receipt crash lived six days because
  nothing reported it. *Correction:* add a crash reporter to the native build before testers.
- **F-08 · P1 · A11Y-05 (gate P1) — and a contract conflict.** `src/components/AppText.tsx:48`
  `MAX_FONT_SCALE = 1.3` applied application-wide (`allowFontScaling maxFontSizeMultiplier`);
  the contract says `dynamic_type: supported`, `text_size_cap: no arbitrary application-wide
  1.3x cap`. `AGENTS.md` still says `allowFontScaling={false}` — stale either way. Listed under
  founder decisions; the fix is one constant once decided.
- **F-19 · P1 · Q-14, Q-34 (misleading status).** Operational figures that nothing measures:
  "Estimated operator arrival: N minutes" on the sheet is `rollWait()` — random 2–8
  (`RideContext.tsx:108–112`, set at `startBooking`); the same random figure sits under "ARRIVAL"
  after dispatch has computed a real `etaMin` (`dispatch.ts:105,306`); "Estimated Search Time
  ~ 00:12" is a constant (`ride.tsx:206–209`); riding time is `durationSec × (5−st)/3`
  (`ride.tsx:261`) — the demo step, not position; "Estimated travel time: 24 minutes" on Home and
  in lists is a fixed table value per destination (`data.ts:67–91`). *Correction:* no operator
  arrival figure until an operator is matched, then `matchedOp.etaMin` labelled "Operator
  arrival"; remove the constant; state the route's measured duration after the quote or nothing.
- **F-20 · P1 · Q-33 (money state; the founders may hold it to P0).** In test mode the sheet
  says "Payments are simulated during the test program. No charge is made." (captures 2, 4, 12)
  and the same account's receipt says "Total Charged $19.44" (capture 19), the ride screen
  "$19.44 charged" in green, the completion screen "Total Charged". Two statements about one
  travel's money. *Correction:* derive the label from the payment mode ("Total · no charge made"
  in test mode on ride, complete and receipt) and store the mode on the record so an old receipt
  cannot say "charged" for a test-mode charge.
- **F-21 · P1 · Q-36, Q-34 (misleading status).** The demonstration fleet is unlabelled to the
  traveler: name, car, plate, "VERIFIED" (`ride.tsx:345`, on operators `dispatch.ts:83` calls
  "THESE PEOPLE DO NOT EXIST" — and the receipt review already ruled "Verified" a claim the system
  cannot make), scripted replies 1.5 s after any message (`opOnMyWay`, `opGotIt`), boarding by
  itself after 25 s, a journey advancing every 2.6 s; the Travel Log and receipt print "Operator
  Miguel D." on completed, charged travel indistinguishable from real rows (capture 13).
  *Correction:* when `matchedOp.demo`: "Demonstration operator · test program" in place of
  VERIFIED, no car drawn, no scripted replies, `operatorDemo` on the record for the log and receipt.
- **F-22 · P1 · A11Y-02, A11Y-01, A11Y-09 (gate P1/P1/P2).** `PrimaryButton`, `OutlineButton`,
  `DrawerRow` and the three `LetterheadBar` icons carry no `accessibilityRole` or label
  (`src/components/UI.tsx`; only `Chip` does); `ride.tsx` 12 Pressables with 0 roles, `safety.tsx`
  9/0, `schedule.tsx` 7/0 — VoiceOver announces no "button" and nothing for menu, back and
  account. `app/wallet.tsx:144–151` "Set as default" / "Remove": ≈33 pt tall, hit areas
  overlapping by 8 pt (44 pt minimum). No reduced-motion handling anywhere in `app/` or `src/`.
  *Correction:* roles and labels in the four shared components and the letterhead (covers most
  screens at once); one 44-pt action row on the wallet card; `AccessibilityInfo.isReduceMotionEnabled`
  gating the loops in `anim.ts`.
- **F-23 · P1 · Q-20, Q-39 (operator primary flow).** `OperatorMap` (`src/components/operator.tsx:242–312`)
  is a drawn grid with a looping car under "NAVIGATION · TO PICKUP" / "TO DESTINATION"; no
  navigation exists and no hand-off to a navigator is offered (no `maps://` link in
  `operator/pickup.tsx` or `trip.tsx`). "Travel Notes" is `operator.travelNotesDemo`, one
  sentence for every travel, while the traveler's sheet presents the cabin environment "as the
  operator will receive it" (`reserve.tsx:307`). `operator.foregroundOnly`: dispatch stops when
  the phone locks. *Correction:* `MonoMap` with the pickup and an "Open in Maps" control; render
  the booking's `tripPrefs`; drop the word NAVIGATION until navigation exists.

### P2 — Required before launch

- **F-09 · P2 · COPY-01, COPY-02 (gate P2).** English: "every fare" ×5 (`roleOperatorSub`,
  `readySub`, `retainOnceCommissioned`, `whereItLands`, `reachesYouWithoutAsking` — operator
  surfaces), `delEveryTrip` "Every trip and receipt on this account.", `tapToSeeRide` "Tap to see
  your ride"; iOS prompts in `app.json`: "the price of your trip" (location when-in-use), "shows
  your driver on the map while your trip is underway" (expo-maps). Spanish: `classStandardSub`
  "hasta 4 pasajeros", `classLargeSub` "hasta 6 pasajeros" where English says "guests". French:
  "course" on 29 lines of `fr.ts` (operator strings, = ride). German: "Fahrt" on 77 lines — the
  ordinary word for a car journey; a native reader must say whether it is the flagged sense
  (L10N-05); German also alternates "Betreiber" (42) and "Operator" (52) for one role. On the
  orphaned recruiting page, `driveHeroSub` "Operators keep 99% of every travel cost — …
  commission on the fare is just 1%" misstates the model (the share is of the fare, not the
  cost) and sells ("just"). *Correction:* travel / travel fare / operator / traveler in each,
  one word per role per language; prompts too; `driveHeroSub` → "Operators retain 99% of the
  travel fare. The coordination commission is 1%."
- **F-10 · P2 · ECO-05, ECO-07 (gate P0; no disagreement demonstrated).** `app/reserve.tsx:257`
  `allIn(key)` computes each class row's Complete Travel Cost itself (fare + `platformFee` +
  government lines) instead of reading a store derivation; `travelerTotal` additionally applies
  the Smart Travel leg-2 fee rule (`RideContext.tsx:316–321`). The rows are hidden on a leg-2
  sheet (`reserve.tsx:506`, `!smartLeg`), so no two amounts render today; the second derivation
  is the risk the store's own comment names. *Correction:* `ride.totalForClass(key)` in the
  store, rows read it. Not P0: same functions, same inputs, and the divergent case is hidden.
- **F-11 · P2 · NAV-01 (gate P1).** `app/drive.tsx` (operator recruiting) is reachable from no
  control (0 references) and is not in `src/withdrawn/`. *Correction:* move it to `src/withdrawn/`
  with the planner, or link it from where operators are meant to find it.
- **F-12 · P2 · SAFE-11 (gate P0; two of three walked screens meet it).** From the ride screen
  the emergency screen is two taps (Safe Travels card → Emergency assistance); from the in-travel
  Menu two; from the in-travel message thread three (back, then the same two). *Correction:* the
  Safe Travels row on the thread's letterhead, or the thread reached as a sheet over the ride.
- **F-13 · P2 · A11Y-12 (gate P2) — contract palette.** `faint` `#B4B3AB` on paper is 1.96:1
  (threshold 3:1 for secondary text); `muted` 3.24:1 passes; `green` `#1F8A5B` 4.04:1 is used for
  the ride's "charged" figure (body threshold 4.5:1). The palette is fixed by the contract, so
  this is listed under founder decisions, not silently passed.
- **F-14 · P2 · MONEY-09 observation (gate NOT TESTED).** The Travel Log's total is labelled
  "charged" and is the sum of each record's quoted `totalCents` (`app/history.tsx:76`), not of
  payments; `paidWith` exists only after settlement. A completed travel whose payment did not
  succeed would be counted as charged. *Correction:* sum what settled, or label the figure as
  the travel cost.
- **F-15 · P2 · Q-14 (from today's walk).** On a report filed to every recent operator, the
  Return card's paragraph opens "Arrange it now…" and no control follows (`app/lost.tsx:539`);
  and "Message the operator" on such a report opens the thread on `candidateTripNos[0]` — one
  operator of possibly several (`app/lost.tsx:220`). Chad's sentence; his word first.
- **F-16 · P2 · known, unchanged.** Content scrolls under the status bar on every scrolling
  screen (seen again today on screens 34–35); Home's SUGGESTED TRAVEL estimate is not computed
  from the current departure; the operator pickup notes card shows one demo sentence for every
  travel (`app/operator/pickup.tsx`, now F-23).
- **F-24 · P2 · COPY-06 (gate P1), Q-14.** Controls named for something other than what they do:
  "Reserve Travel" on Home opens the destination search and reserves nothing (the rubric's own
  example; it duplicates the field, `index.tsx:523–533` vs `718–732`); "Begin Travel" opens Home;
  "Travel Complete" (`ride.tsx:504`) is a state used as a button name; "Complete" (`complete.tsx:209`)
  saves the review and leaves. Labels: "FREQUENT DESTINATIONS" lists the three most RECENT
  distinct destinations (`index.tsx:244–256`); "Finding the best available Operator" where
  dispatch matches the nearest. *Correction:* name each for its action ("Enter destination",
  "Continue", "Return to Home"); "Recent Destinations" ×5; "Matching an available operator".
- **F-25 · P2 · Q-10, Q-21.** The "Confirm your number" step (`AuthScreen.tsx:474–514`) says
  "Number verification is not switched on during the test program." and then asks for any six
  digits under VERIFICATION CODE — a screen whose copy says it does nothing. *Correction:* remove
  the step while SMS verification is off (alternative 1 of three in the qualitative section).
- **F-26 · P2 · Q-34.** Invitations: "Your code identifies the people you bring to American
  Rider." over a code that `invite.tsx` itself says is "registered nowhere; sign-up never asks
  for one". *Correction:* withdraw the screen or the sentence until a code is recorded.
- **F-27 · P2 · Q-23.** Defaulted states: `message.tsx:112` prints the raw Firestore error
  ("Missing or insufficient permissions." reached the screen on 17 Sept — this reviewer's own
  capture); `receipt.tsx:44–53` renders an empty frame when the record is absent;
  `lost.tsx:398–405` a bare title while a report loads. *Correction:* one sentence each in the
  traveler's words (`errConversationLoad` exists; "This receipt could not be opened."; "Reading
  the report…").
- **F-28 · P2 · Q-21.** In live mode nothing on the sheet says a charge follows "Confirm Travel"
  (the card is charged once an operator is matched, `RideContext.tsx:909,967`; `paymentModeNote`
  is null outside test mode). *Correction:* one line under the control: "Your card is charged
  once an operator is assigned." — no instrument named.
- **F-29 · P2 · Q-04, Q-35, Q-42.** Two solid-ink controls compete on the ride screen at arrival
  ("Confirm Boarding" and "Communicate"); the three reassurances "VERIFIED", "%{name} will come
  right there." and "Operators always keep their full 99%."; the iPhone live map (Apple pins,
  blue polyline, `car.fill`) and the Android/web SVG map read as generic rideshare, outside the
  palette. *Correction:* ghost "Communicate" while boarding is up; remove the three; see the map
  alternatives under founder decisions.

### P3 — Refinement

- **F-17 · P3 · AUTH-04 note.** `/quote`, `/route`, `/smart-quote`, `/fare-quote` accept
  unauthenticated calls by design (no account data); they are the only public write endpoints
  and carry no rate limit — abuse costs routing calls, not money.
- **F-18 · P3 · L10N.** Spanish first rung "Notificado" (one word from "Operador avisado";
  "Registrado" is the rung's meaning); the camera and location iOS prompts are English-only
  (`locales/` carries only the photo library string).

## Gate totals

| Category | PASS | FAIL | NOT TESTED | NOT APPLICABLE | Total |
|---|---|---|---|---|---|
| 1 Economics and authoritative quoting | 8 | 2 | 4 | 0 | 14 |
| 2 Traveler money presentation | 3 | 0 | 8 | 0 | 11 |
| 3 Terminology and copy | 7 | 3 | 2 | 0 | 12 |
| 4 Localization completeness and quality | 5 | 1 | 7 | 0 | 13 |
| 5 Navigation and state integrity | 1 | 1 | 10 | 0 | 12 |
| 6 Map, route and travel continuity | 1 | 1 | 10 | 0 | 12 |
| 7 Accessibility and responsive behavior | 1 | 5 | 7 | 0 | 13 |
| 8 Authentication, account, authorization and privacy | 3 | 1 | 8 | 0 | 12 |
| 9 Safety and emergency behavior | 0 | 2 | 9 | 0 | 11 |
| 10 Operator availability and background operation | 3 | 0 | 9 | 0 | 12 |
| 11 Scheduled travel | 0 | 0 | 8 | 0 | 8 |
| 12 Payments, receipts, retries and idempotency | 3 | 0 | 9 | 0 | 12 |
| 13 Reliability and observability | 4 | 2 | 6 | 0 | 12 |
| 14 Release identity and source/build parity | 6 | 0 | 2 | 2 | 10 |
| **All** | **45** | **18** | **99** | **2** | **164** |

### Gate results with evidence (PASS and FAIL; NOT TESTED are listed under residual risk)

- ECO-01 PASS — `scratchpad/eco.js` evaluated `platformFee()` from `src/data.ts` at the fifteen
  fares: 150,150,150,150,150,151,225,300,300,305,375,500,1250,5000,25000 cents; mismatches 0.
- ECO-02 PASS — `platformFeeCents()` at the same fifteen: identical; `backend/payments.test.js`
  (parity every cent $0–$500, "flat below $30", "continuous at $30") passed in `npm run check`.
- ECO-03 PASS — `coordinationFee`: $25→$0.25, $250→$2.50, $1,000→$10.00, $5,000→$50.00 (no cap).
- ECO-04 PASS — payout = fare − 1 %: $24.75, $247.50, $990.00, $4,950.00; `earnOf` in
  `src/state/OperatorContext.tsx:157` is `fare − coordinationFee(fare)`.
- ECO-05 FAIL, ECO-07 FAIL — one traveler-facing derivation outside the store (F-10).
- ECO-08 PASS — Terms: `backend/legal.js:43,159` (en), `legal-es.js:50` "1,50 USD o el 5 %",
  `legal-fr.js:42` "1,50 USD … 5 %", `legal-it.js:39`, `legal-de.js:39`; About `backend/site.js:56`.
- ECO-10 PASS, ECO-11 PASS — `PROC_ACH`/`PROC_CARD`/`procFor` are defined and referenced only in
  `src/data.ts:334–393`; no `app/` or `src/` file references them; no traveler line adds processing.
- ECO-12 PASS — tests "Miami to New York is refused", "THE $6,228 QUOTE: San Francisco to Miami is
  refused, not priced", "outside the market it is null, like the price" (passed at `a8f9db3`).
- MONEY-02 PASS — no traveler screen itemizes an amount for commission, fee, processing or payout
  (grep of every `fmt(` site: reserve, ride, complete, receipt, history, schedule, index, lost,
  issues). The receipt's footer states "The Operator retained 99% of the travel fare." — a
  percentage, no amount, founders' 15 Sept decision.
- MONEY-04 PASS — "estimate/approx/may change" hits attach to times (`approxMinToPickup`,
  `estimatedTravelTime`, `shareTravelSub` arrival estimate) or operator screens
  (`estimatedRevenue`, insurance `estimatesOnly`); none to a traveler amount.
- MONEY-08 PASS — "Complete Travel Cost" (`reserve.tsx:660` footer, `schedule.tsx:420`), "Total
  Charged" (`receipt.tsx:94`); no authoritative amount is labelled an estimate.
- COPY-01 FAIL, COPY-02 FAIL — F-09. COPY-06 FAIL — F-24 (four controls named for something other
  than their action; today's walk found none on Patron Support/Lost Item). COPY-03 PASS (0 flagged phrases, five catalogues). COPY-04
  PASS (0 "!" in en/fr/it/de; es: 0 outside a comment). COPY-05 PASS (0 emoji). COPY-08 PASS ("MIA
  Mover" is the people-mover's name; `src/data.ts:104–110` maps "MIA Airport" to the full name).
  COPY-09 PASS (the three `{tripNo}` sites outside a `Mono` line — `emergency.tsx:310`,
  `issues.tsx:220`, `message.tsx:99` — are inside `<Mono>` wrappers; format `AR-####-MIA`).
  COPY-11 PASS (0 apologies). COPY-12 PASS (0 editorial state labels).
- L10N-01 PASS — `check-i18n.mjs`: de/es/fr/it all 900 keys, no duplicates. L10N-02 FAIL — F-04.
  L10N-03 PASS — all 900 keys used. L10N-04 PASS — 0 module-level `t(` in `src/` and `app/`.
  L10N-07 PASS — today's walk on `e8c791a` (same app code): Settings → Español re-rendered Patron
  Support, the reopened ladder and the thread at once; English restored the same way.
  L10N-11 PASS — `legal-es.js:18` "…inglés es la jurídicamente vinculante.", `legal-fr.js:11` "La
  version anglaise est juridiquement contraignante.", `legal-it.js:8`, `legal-de.js:9`.
- NAV-01 FAIL — F-11 (`/drive` 0 references; every other route ≥1). NAV-02 PASS — `app/plan.tsx`
  gone, `src/withdrawn/plan.tsx`; no withdrawn feature under `app/`.
- MAP-03 FAIL — F-02. MAP-10 PASS — `PLACES` in `src/data.ts`: 25 entries, 0 without coordinates.
- A11Y-01 FAIL — F-22 (wallet links ≈33 pt, overlapping). A11Y-02 FAIL — F-22 (shared controls and
  letterhead icons without role or name). A11Y-05 FAIL — F-08. A11Y-09 FAIL — F-22 (no
  reduced-motion handling). A11Y-12 FAIL — F-13. A11Y-13 PASS — the only `Text` import from
  `react-native` under `app/` and `src/` is `src/components/AppText.tsx`.
- AUTH-03 PASS — tree: no `sk_live_`/`sk_test_` key, `whsec_`, private key; history (`git log -p
  --all -S`) 0 for `sk_live_`, `whsec_`, `"private_key"`, Resend `re_…`, `AKIA…`; the installed
  `e8c791a` bundle 0. The Firebase web `apiKey` in `src/firebase.ts` is public by design.
- AUTH-04 PASS — 57 routes in `backend/server.js`; 34 carry `requireAuth` on the definition line,
  and every route that reads or writes an account's data is among them; the 23 without are the
  two signature-verified webhooks, health/config, public pages and legal documents,
  `/follow/:token` (token-authenticated), `/connect/done`, the four quoting endpoints (F-17) and
  `/scheduled/sweep` (`SCHEDULER_TOKEN`, 403 otherwise, `server.js:1677–1680`).
- AUTH-05 FAIL — F-05. AUTH-11 PASS — `app.json`: location when-in-use, always, photos, camera
  and the map's location prompt each state a reason and match a feature (wording: F-09).
- SAFE-02 FAIL — F-03. SAFE-11 FAIL — F-12.
- OPS-03 PASS — `monitor.test.js` "unanswered travel is re-offered to a free operator"; "an
  operator who has not checked in is never re-offered travel"; "a lapsed policy is not re-offered".
- OPS-04 PASS — "expired insurance is refused", "a missing expiry is held, never accepted", "an
  unreadable expiry is held", "lapsed coverage: not dispatched", "an expired licence is refused".
- OPS-05 PASS — an operator joins the fleet only through `POST /operator/online` (Stripe
  `payouts_enabled` and document id = uid, `server.js:597–612`); dispatch takes only `available`,
  presence fresh, coverage in force, not `screeningBlocked` (`server.js:249–251`,
  `backend/matching.js:98`); tests "a screeningBlocked operator is never dispatched", "with
  screening live, an operator with no recorded pass is not dispatched".
- PAY-05 PASS — `send/American-Rider-Screens/19-travel-receipt-8b82b97.png` shows Total Charged
  and the Travel Number; `app/receipt.tsx` and `src/receipt.ts` are unchanged since `8b82b97`.
- PAY-08 PASS — `settle.test.js` "a failed transfer leaves the travel unsettled", "a settled
  travel is never paid twice", "a completed travel with no payment is not settled".
- PAY-09 PASS — `src/state/PaymentConfigContext.tsx:73`: the "Payments are simulated during the
  test program" note renders only when the server reports its key mode is `test`; a live key
  cannot show it; `/health` reports `stripe: test` today.
- REL-01 PASS — `/health` `ok: true`, `commit: dcccfe3`, the candidate's backend. REL-03 FAIL —
  F-06. REL-08 PASS — `monitor.test.js:304` `unwatched === true` with a reason. REL-09 FAIL —
  F-07. REL-11 PASS — `cd backend && npm run lint` exit 0; tests: 23 files, every check passed
  (`npm run check` at `a8f9db3`). REL-12 PASS — `npm run check` exit 0 (tsc clean; 900 keys ×5;
  no untranslated by the script's own scan; no unused).
- BUILD-03 PASS — backend `dcccfe3` deployed 16 Sept 21:55 EDT, before any client release;
  `git diff dcccfe3..a8f9db3 -- backend` empty. BUILD-04 PASS — the simulator build of
  `e8c791a` recorded `dirty: false`; no TestFlight build exists. BUILD-05 PASS — `ios/Podfile.lock`
  (regenerated by `prebuild --clean` in tonight's build) carries expo-notifications, expo-widgets,
  expo-location, expo-apple-authentication, stripe-react-native, maplibre, expo-image-picker.
  BUILD-06 PASS — as AUTH-03. BUILD-09 PASS — the identity table above. BUILD-10 PASS —
  `/Users/adriansmith/AmericanRider`, no space. BUILD-01, BUILD-08 NOT APPLICABLE (no web
  deployment or release notes exist for this candidate).

## Failed gates

| Gate | Sev | Evidence | Finding |
|---|---|---|---|
| ECO-05 | P0 | `app/reserve.tsx:257` computes fare + fee + government lines per class row | F-10 |
| ECO-07 | P0 | the same second derivation; `travelerTotal` alone carries the leg-2 rule | F-10 |
| COPY-01 | P2 | 7 English hits, 2 prompt strings, fr "course" ×29 lines, de "Fahrt" ×77 lines | F-09 |
| COPY-02 | P2 | expo-maps prompt "driver"; es "pasajeros" ×2 | F-09 |
| COPY-06 | P1 | "Reserve Travel", "Begin Travel", "Travel Complete", "Complete" | F-24 |
| L10N-02 | P1 | ≥14 literals in expressions the checker skips, incl. the emergency control | F-04 |
| NAV-01 | P1 | `/drive` referenced by no control, not withdrawn | F-11 |
| MAP-03 | P0 | "LIVE · MIAMI" over `targetFraction(status)` | F-02 |
| A11Y-01 | P1 | wallet "Set as default"/"Remove" ≈33 pt, hit areas overlapping | F-22 |
| A11Y-02 | P1 | shared buttons and letterhead icons: no role, no name | F-22 |
| A11Y-05 | P1 | `MAX_FONT_SCALE = 1.3` application-wide | F-08 |
| A11Y-09 | P2 | no reduced-motion handling | F-22 |
| A11Y-12 | P2 | faint 1.96:1, green 4.04:1 | F-13 |
| AUTH-05 | P1 | `deleteUser` only; `travelerName` stays on rides; screen promises removal | F-05 |
| SAFE-02 | P0 | 8 red control sites beyond Call 911 | F-03 |
| SAFE-11 | P0 | 3 taps from the in-travel thread | F-12 |
| REL-03 | P1 | 1 of 41 network calls has a timeout | F-06 |
| REL-09 | P1 | no crash reporter | F-07 |

## P0 / P1 gates not tested

| Gate | Sev | Reason | Evidence that would close it |
|---|---|---|---|
| ECO-06, ECO-09, ECO-13, ECO-14 | P0 | no travel booked and charged in this review | one travel: sheet amount, class rows, intent amount, receipt, same Travel Number |
| MONEY-01, MONEY-09 | P0 | no single travel walked across every screen; no payment state matrix | the same travel on every screen; pending/failed/succeeded each shown |
| MONEY-03, MONEY-06, MONEY-10, MONEY-11 | P1 | not measured; no $1,234.56 travel; no tipped or refunded receipt produced | those receipts at 320 pt |
| L10N-05 | P1 | no native reader on this revision | a named reader per language, ≥20 strings |
| L10N-08, L10N-09, L10N-13 | P1 | not relaunched; front door not opened this session; no cleared-storage launch in es/ja | device evidence (code: `src/i18n/index.ts:48` device locale → en fallback; front-door endonyms `AuthScreen.tsx:315`) |
| NAV-03, NAV-06, NAV-07, NAV-09, NAV-11, NAV-12 | P1 | not walked beyond Patron Support/Lost Item (back from the thread verified) | the audit tables |
| NAV-04, NAV-05 | P0 | no kill/relaunch during active travel; no sign-out data check | device evidence |
| MAP-01, 02, 04, 05, 07, 08, 11, 12 | P1 | no travel booked | stage screenshots |
| A11Y-03, 04, 06, 07, 08, 10 | P1 | no VoiceOver or AX-size pass; no width sweep | device evidence |
| AUTH-01, AUTH-02 | P0 | no rules-emulator test exists (`firestore.rules` reads: rides `ownsExisting() \|\| drivesExisting()`; messages the same, and the query now carries the reader's uid) | a rules test with two accounts |
| AUTH-06, 07, 08, 10, 12 | P1 | not exercised; AUTH-10 code: `crypto.randomBytes(16)` (128 bits), `MAX_LIFE_MS` 12 h, no expiry test found | relaunch, server search, forced 401, an expiry test |
| SAFE-01, SAFE-03, SAFE-05, SAFE-08 | P0 | no physical device; message not generated (code builds vehicle, plate, operator, Travel Number, coordinates, address, timestamp — `emergency.tsx:159–207`); safety-string audit partial (`shareTravelSub` "your live location" is the vehicle's last position, hidden when >5 min old, `follow.js:104–114`); `emgNoCalls` exists (`emergency.tsx:244`) | dialer opened; the generated text; the audit; simulator `tel:` refusal |
| SAFE-04, 06, 07, 09, 10 | P1 | not exercised | the follow page fresh/stale; denied location; the tap paths |
| OPS-02 | P0 | background renewal on a locked phone needs a device; the matching half is tested (`matching.js:61–98`, "an operator silent past the window is stale"; heartbeat every 60 s `heartbeat.ts:47`) | presence timestamps, phone locked |
| OPS-01, 06, 07, 08, 09, 10, 11, 12 | P1 | device or offer screen not exercised (OPS-10: "3 min out: dispatched to the NEAREST operator" exists; candidate count not verified) | device evidence; a ≥3-candidate test |
| SCHED-01, 04, 05 | P0 | not exercised (the server sweeps: `/health` `scheduledTravel.sweeping: true`, `lastSweepAt`; "no operators, past grace: unmatched and never charged") | phone-off dispatch; cancel-before-dispatch; quoted vs charged |
| SCHED-02, 03, 07, 08 | P1 | not exercised | relaunch; past-time attempt; notifications; forced no-availability |
| PAY-01 | P0 | no idempotency key on the travel PaymentIntent create (`payments.js:318,359`; transfers, tips, reservations are keyed); no two-submission test | the test |
| PAY-02, 03, 04, 07 | P0 | no intent inspected; transfer amount not asserted (settle tests prove the sweep, not the cents); no forced-failure test; Stripe `constructEvent` present (`server.js:87–95`) but no Stripe bad-signature test (Checkr HMAC tests exist) | the tests |
| PAY-06, 10, 11, 12 | P1 | not exercised (`refunds.create` exists, `payments.js:428`) | test-card decline; refund test; code matrix; malformed body |
| REL-02, 04, 05, 06 | P1 | not audited | grep of error sites; code × endpoint matrix; malformed body; airplane mode |
| BUILD-02, BUILD-07 | P1 | `eas build:list` gave no output non-interactively; no device | the list; device evidence |

## Qualitative judgment

Completed by: an independent Claude agent (fresh context; implemented no change under review; evidence = source, catalogues and the captures in send/ — no device walk). The founders may want a human designer's pass on top; this layer is what an agent could establish from the files.

Evidence base: `app/*.tsx`, `app/operator/*.tsx`, `src/components/{UI,AppText,MonoMap,LiveMap,LiveMap.ios,HomeMap,RouteMap,FindMiguel*,CheckInCard,operator}.tsx`, `src/theme.ts`, `src/data.ts`, `src/state/RideContext.tsx` (grepped), `src/backend/dispatch.ts` (grepped), `backend/server.js` (grepped for the arrival fee), `scripts/check-untranslated.mjs`, `src/i18n/{en,es,fr,it,de}.ts` (≥60 strings per language read), captures 1, 2, 3, 4, 6, 7, 8, 12, 13, 19, 20, 22, 29, 32, 34, 35, 36 and every CAPTION file. No capture exists of the searching, live-travel or Travel Complete screens; answers about them are from source only.

### American Rider identity

**Q-01 — YES.** Captures 1 (Home), 4 (Travel Confirmation), 7 (drawer), 19 (Receipt), 22 (Patron Support), 12 (Payment & Settlement), 36 (thread) all carry the same letterhead (hamburger/back · "AMERICAN RIDER" 12/600 +3.12 · "NATIONAL TRANSPORTATION" 7.5/600 · person outline), 11pt letterspaced section labels in `ink2`, white radius-16 hairline cards, solid-ink primary, ghost secondary, paper `#F7F7F5`. One screen would be mistaken for another company's: the live-travel map on iPhone (`src/components/LiveMap.ios.tsx`) is Apple Maps with system pins, a blue polyline and a `car.fill` glyph under a pill badge — none of it in the palette. Not captured; judged from source.

**Q-02 — NO.** `app/ride.tsx` lines 206–209: "Estimated Search Time" over the literal `~ 00:12` — a figure nothing measures. Lines 256–263: the eyebrow "ARRIVAL" over `etas[st]`, whose values are `'Confirmed'`, `pickupWait + ' min'`, `'Here'`, `'18 min'`, `'4 min'`, `'Arriving'` (`src/data.ts` 484–491) — words under a time label, and the minutes come from `rollWait()` (random 2–8, `RideContext.tsx` 108–112, called at `startBooking`, line 595). Apple would not ship a countdown that does not count. Correction: see Q-14.

**Q-03 — YES, with one stiff line.** Heading "Arrange Transportation" (`beginTravel2`) and body "Select the matter, then describe it. What the record of the travel can settle is settled at once; everything else is read by a person, who replies by email." (`supportSub`, capture 22) are precise and plain. The exception: "Review your itinerary and authorize operator dispatch." (`reviewAndConfirm`, capture 2) — "authorize operator dispatch" is ARTS on the one sheet every traveler reads. Correction: "Review your travel and confirm." (P3).

### Visual hierarchy

**Q-04 — NO on Home and on arrival; YES elsewhere.** Home (capture 1): the "Enter Destination" field and the solid-ink "Reserve Travel" button perform the identical action (`app/index.tsx` 523–533 vs 718–732: both `startBooking(); navigate('/reserve', {search:'1'})`), so two elements compete at primary weight, and the ink button is cut off at the bottom of the 2:25 capture (its top edge at ≈y 1985 of 2000) whenever Suggested + three Frequent rows are present. Sheet (captures 2–4): "Confirm Travel" alone — correct. Ride at status 2: `FindMiguel` renders a `PrimaryButton` "Confirm Boarding" (`FindMiguel.ios.tsx` 135) and the action row renders a second `PrimaryButton` "Communicate" (`ride.tsx` 512) — two ink buttons on one screen. Correction: on Home keep one entry (the field), demote or remove the button (founders' word — Chad kept it for balance, 16 Aug); on the ride screen make "Communicate" a ghost while "Confirm Boarding" is up (P2).

**Q-05 — YES.** `UI.tsx`: Display 34/600 lh 38.1 −0.68; Title 27/600 lh 32.4 −0.54; Sub 14.5/400 muted; SectionLabel 11/600 +1.65 uppercase ink2; row title 15/400 ink; meta 12.5/400 muted; buttons 16/600. Three weights, four tones; captures 8, 13, 19 read their levels without boxes or colour.

**Q-06 — NO.** (1) Content scrolls under the status bar: captures 34 and 35 show "Operator notified" / "STATUS" rendered through the 9:22 clock — `Screen` (`UI.tsx` 53–60) has no top inset on scroll, a known open P2 on every scrolling screen. (2) `app/wallet.tsx` 144–151: "Set as default" and "Remove" stacked with `gap: 8`, each `hitSlop={8}` on ~17pt text — the two touch areas overlap by 8pt and each is ≈33pt tall, under the 44pt minimum. (3) Capture 4: the footer's `borderTopWidth: 1` hairline (`reserve.tsx` 762) sits 12pt above a bordered card and separates nothing. Correction for (1): give the scroll content a paper-coloured status-bar mask or `contentInsetAdjustmentBehavior`; for (2): one row of actions with 16pt gap and 44pt minHeight (P2).

### Intentional whitespace

**Q-07 — YES, two pools.** Front door: a single spring above the lockup and a fixed 56pt gap (`AuthScreen.tsx` 334–356) — composed. Space pools at one end on Case filed (capture 32: card ends at ≈y 860, "Return to Home" at ≈y 1710, nothing between) and on Payment & Settlement (capture 12, empty below ≈y 1480). P3.

**Q-08 — NO.** No spacing scale exists (`src/theme.ts` holds radii only); values are transcribed per element from the demo: section-label top margins 22 (`issues`, `lost`), 24 (`account`, `profile`, `wallet`), 26/28 (`index`); card top margins 10, 12, 14, 16, 18, 20, 22 across `reserve`, `profile`, `history`, `ride`, `index`, `issues`, `complete`; row vertical padding 13 (`receipt`), 14 (`issues` cases), 15 (`profile`, `wallet`), 16 (`account`, `lost`, `history`). Consistent to the eye, per-element in fact. P3.

### Unnecessary containers

**Q-09 — NO, three.** (1) `ride.tsx` 439–464: "Travel Number" and "Payment" are two single-row cards stacked 12pt apart — one card, two rows. (2) `lost.tsx` 484–496: "WHAT YOU DESCRIBED" is a card around one sentence (capture 35: "Umbrella, rear footwell"). (3) `reserve.tsx` 651–663: the total sits in a card inside a hairline-topped footer — the hairline is the redundant container. P3.

**Q-10 — YES.** (1) "Reserve Travel" on Home duplicates the field (Q-04). (2) "Estimated Search Time ~ 00:12" fills the searching screen with a number that is a constant. (3) The "Confirm your number" step (`AuthScreen.tsx` 474–514): "Number verification is not switched on during the test program." then a field labelled VERIFICATION CODE and "Enter any 6 digits." — a screen whose own copy says it does nothing. (4) Invitations (`invite.tsx`): a code "registered nowhere; sign-up never asks for one" (file header) under "Your code identifies the people you bring to American Rider." Corrections at Q-14, Q-34, Q-21.

**Q-11 — NO, two.** (1) `reserve.tsx` 362/395: identical 9pt ink dots beside "Departure" and "Arrival" (capture 2) — same colour, both labelled by the text; the dot carries no meaning, the objection Chad raised on 15 Aug for the recent rows. (2) The footer hairline (Q-09). P3.

### Natural language

**Q-12 — NO.** Weakest sentences: "Review your itinerary and authorize operator dispatch." (sheet); "The operator on your travel has finished for the day, so the item travels as its own dispatch." (`lostOwnDispatch`); "%{n} travels, every operator told." (`lostNTravelsTold`, telegraphic); "Total · payment in progress" (`totalPaymentInProgress`). Correction: "Review your travel and confirm."; "…so it comes back on a separate travel."; "Every operator on these %{n} travels has been told." (P3).

**Q-13 — YES.** Editorial: "Finding the best available Operator" (`rideFindingBest` — dispatch matches the nearest, and the next line says so: "Matching your reservation to the nearest qualified operator."). Sells: "The fare is yours. Operators keep 99% of every travel cost — American Rider's commission on the fare is just 1%." (`driveHeroSub` — "just", and "every travel cost" misstates the model: the share is of the fare, not the cost, which includes the platform fee; the row beneath it says "Retain 99% of the travel fare"). Chats: "Welcome back" (`auth.welcomeBack`), "This page took / a wrong turn." (`wrongTurnL1/L2`), "Something went wrong. Please try again." (`errGeneric`), "Tap to see your ride" (`tapToSeeRide` — "ride" is a flagged term). Reassures: "Drag the pin to where you're standing — %{name} will come right there." (`dragPinToStanding`). Scripted operator chat: "On my way — a few minutes out." / "Got it — see you soon." (`opOnMyWay`, `opGotIt`, sent by the demo ride 1.5 s after any message). Correction: `driveHeroSub` → "Operators retain 99% of the travel fare. The coordination commission is 1%." (P2, money statement); `rideFindingBest` → "Matching an available operator" (P2); the rest are one-string P3 changes.

**Q-14 — NO (material).** Controls: "Reserve Travel" on Home opens the destination search and reserves nothing — the rubric's own example. "Begin Travel" (`auth.ready`) opens Home. "Travel Complete" (`ride.tsx` 504) is a state used as a button label; "Complete" (`complete.tsx` 209) saves the review and leaves — the same defect the support screen fixed on 16 Sept with "Return to Home". "Arrange it now and the item leaves as soon as it is found." with no control beneath it (capture 35; caption admits it). Numbers: "ARRIVAL" over `Confirmed`/`Here`/`Arriving`; "ARRIVAL 3 min" at status 1 is `rollWait()`'s random figure even after dispatch has computed `etaMin` from distance (`dispatch.ts` 105, 306) — the real number exists and is not used; while riding, `durationSec × (5−st)/3` (`ride.tsx` 261) — remaining time derived from the demo step, not position. "Estimated operator arrival: 3 minutes" on the sheet (capture 3) — random. "~ 00:12" — constant. "FREQUENT DESTINATIONS" (`recentTravel: 'Frequent Destinations'`) labels `recentDistinct`, the three most recent distinct destinations (`index.tsx` 244–256 over `myRides` sorted newest-first, `dispatch.ts` 412) — the row's own "Aug 16 · from Brickell" says recency. "Estimated travel time: 24 minutes" (captures 1, 6) is `PLACES[].meta`, a fixed table value per destination regardless of pickup (`data.ts` 67–91). Correction: (a) print no operator-arrival figure until an operator is matched, then `matchedOp.etaMin`, labelled "Operator arrival"; while riding label it "Arrival at destination" and derive it from route progress only when the operator reports position; (b) remove "~ 00:12"; (c) relabel the section "Recent Destinations" (five languages) or select by count; (d) remove the fixed travel-time line from list rows, or state the server's measured duration after the quote; (e) rename the Home button to the action it performs or remove it (Q-04) (P1 for a/b, P2 for c/d/e).

**Q-15 — YES, one gap.** Full names ("Miami International Airport", "Current location — 799 Brickell Plaza"), exact amounts, dates with year, locale clock (captures 13, 19, 20). The gap is the table travel time above; the route's real `durationSec` exists once quoted and is not printed on the sheet.

### Translation tone

**Q-16 — YES.** Sixty-plus strings per language read: es uses usted throughout ("Seleccione el viaje…", "Inicie sesión en su cuenta.", "No se le ha cobrado este viaje."); fr vous ("Choisissez par où commencer.", "Ce trajet ne vous a pas été facturé."); it Lei ("Selezioni il viaggio…", "Non le è stato addebitato questo viaggio."); de Sie ("Wählen Sie die Fahrt…", "Diese Fahrt wurde Ihnen nicht berechnet."). No "no se preocupe", no exclamation marks, no diminutives. Two terminology defects, not register: de alternates "Betreiber" (42) and "Operator" (52) for one role (`rideStepOnWay: 'Ihr Betreiber ist unterwegs.'` vs `reviewAndConfirm: '…Entsendung des Operators.'`); fr uses "course" 45 times (contract flag "ride"), including traveler-facing `rideFareReturned: 'Votre course vous est intégralement remboursée.'`, beside "trajet" (119) and "voyage" (37). Correction: one word per role and per journey in each catalogue (P2, terminology inconsistency).

**Q-17 — UNCLEAR.** No 320pt capture exists; every caption lists "320-pt width" under NOT TESTED, and no French/Italian/German screen has been looked at. Longest candidates: "Reisendenbetreuung kontaktieren" (ghost button), "Gesamtkosten der Fahrt" beside a 20/600 amount in the sheet footer, the wallet row with "Als Standard festlegen"/"Entfernen" stacked, the ride head row (23pt title + "ARRIVAL" figure). Settles it: captures of those four in de at 320pt.

**Q-18 — NO (material, on one line).** Money, safety and legal strings sampled agree across five languages (`paymentsSimulated`, `call911First`, `emgNoCalls`, `refundTiming`, `cancellationGrace` with "3,00 USD", `operatorRetainedNote`; `legal.translationNotice` present in all five stating English governs). But the money statement at the moment of cancelling after arrival is an English template literal: `ride.tsx` 483 "Your fare is returned less a $3.00 arrival fee, which goes to ${name}." — a Spanish traveler reads English at exactly the moment money is at stake; "Total Charged"/"Total Due" (`complete.tsx` 128–130) and "${amount} charged"/"Charged" (`ride.tsx` 457–458) likewise. Correction: keys for all three, five languages (P1 with Q-19's list).

### Traveler versus Operator voice

**Q-19 — NO, minor crossings; and a localization failure.** Crossings into traveler screens: "authorize operator dispatch" (sheet), "Dispatch unavailable." (`dispatchUnavailable`), "its own dispatch" (lost). Untranslated English rendered on traveler screens in every language (the scanner's `CODEY` rule skips any line containing `= ( ) : ;` or a dotted identifier, so ternaries, arrays and template literals pass): `STATUS_LABELS` "Travel Confirmed"/"Operator En Route"/"Operator Arrived"/"Traveler Onboard"/"Arrival"/"Travel Complete" (`data.ts` 475–481, rendered `ride.tsx` 252 and `index.tsx` 405); step labels `['En Route', 'Arrived', 'Onboard', 'Arrival']` (`ride.tsx` 148); `'Operator Assigned' : 'Upcoming Travel'` (`index.tsx` 451); `'Today'/'Tomorrow'/'Pick a day'` and ". An operator is assigned ahead of that time and the card on file is charged then. The assignment appears on your home screen." (`schedule.tsx` 167–169, 193–195); "Confirm today's verification word with your operator:" (`safety.tsx` 174); `'Text my location' : 'Send my location'` and `'Not recorded'` fallbacks (`emergency.tsx` 63–65, 356); `'Deleting…' : 'Yes, delete'`, `'Your account'`, `'Your travel history'` (`delete-account.tsx`); `'Sending' : 'Send'` (`CheckInCard.tsx` 79); `'Dropped pin'` (`pickup-map.ios.tsx`). Operator side: `'At Pickup' : 'Proceed to Pickup'`, `'Arrived'`, `'En route'`, "NAVIGATION · TO PICKUP" (`operator/pickup.tsx` 47, 64, 71); the Under Review paragraph (`operator/review.tsx` 51–52); `Message ${traveler}` (`operator/communicate.tsx` 107). Correction: key every one (the gate's "no untranslated string" is a scanner limitation, not a fact); extend the scanner to string literals inside ternaries/arrays (P1 — the live-travel screen is English in four languages).

**Q-20 — NO (material).** Offer sheet (`operator/index.tsx` 337–439) is precise: countdown, "ESTIMATED REVENUE", pickup/destination, ETA only when measured. Revenue (`operator/revenue.tsx`) is honest ("Test program — operations and revenue shown here are simulated."). The instrument fails on the road: (1) `OperatorMap` (`src/components/operator.tsx` 242–312) is a drawn grid with a looping animated car under the tag "NAVIGATION · TO PICKUP" / "NAVIGATION · TO DESTINATION" — no navigation exists and no maps hand-off is offered (no `maps://`/`comgooglemaps://` link in `pickup.tsx` or `trip.tsx`). (2) "Travel Notes" on every pickup is `operator.travelNotesDemo` — "Atmosphere: Quiet · Climate: Moderate · Operator Playlist offered at pickup. You retain final discretion." — the same sentence for every travel (`pickup.tsx` 100–103 admits it), while the traveler's sheet presents the cabin environment "as the operator will receive it" (`reserve.tsx` 307). (3) `operator.foregroundOnly`: "Keep American Rider open to stay in service…" — dispatch stops when the phone locks. Correction: replace `OperatorMap` with `MonoMap` showing the pickup and a "Open in Maps" control that hands the coordinates to the system navigator; render the booking's actual `tripPrefs` in Travel Notes; background location before operators are recruited (P1: broken primary flow for an operator).

### Flow continuity

**Q-21 — NO at two screens.** Walked from source: front door → email/mobile → password → Confirm your number → Select Account → ready → Home → Travel Confirmation (search) → sheet → Confirm Travel → searching → enroute. Missing answers: on "Confirm your number", *what am I doing* — typing six meaningless digits into VERIFICATION CODE; on the searching screen, *what happens next* — "Estimated Search Time ~ 00:12" never changes. On the sheet, *what happens next* after "Confirm Travel" is unstated: the operator is dispatched and, once matched, Stripe's sheet opens and the card is charged (`RideContext.tsx` 909, 967) — in live mode `paymentModeNote` returns null so nothing on the sheet says a charge follows. Correction: remove the verification step while verification is off (three alternatives below); remove the constant; one line beneath Confirm Travel: "Your card is charged once an operator is assigned." — no instrument named, so it does not conflict with the founders' hold on the instrument line (P2).

Structural: the verification step. (1) Remove it while SMS is off — comprehension high, continuity unchanged, risk nil (`step === 'confirm'` branch and `code` state go), identity best. (2) Keep it, rewrite as an information screen with no field — comprehension medium ("why am I here"), no risk, identity poor (a screen that only explains its absence). (3) Wire real SMS verification — comprehension high, risk high (provider, cost, review), not for this candidate. Recommend (1).

**Q-22 — YES.** Merge: Home's two entry controls (Q-04). Remove: the verification step. Two menus present the same three groups (`index.tsx` drawer and `app/account.tsx`), by Chad's 14 Sept decision — acceptable. The one sheet (`reserve.tsx`) is long (map, itinerary, class, Smart Travel, cabin, fees) but the sticky footer (capture 4) keeps price and action in view; no split needed.

**Q-23 — NO, three defaulted states.** Designed: "Calculating" with the control disabled; "Unavailable" + "Select the destination again to confirm the amount."; "Completed travel appears here."; "Saved payment methods could not be read." vs "No payment method saved."; the cancel card; the searching screen's three ways out. Defaulted: `receipt.tsx` 44–53 renders an empty frame with only the letterhead when `view` is absent; `lost.tsx` 398–405 renders a title only while a reopened record loads; `message.tsx` 112 prints the raw thread error verbatim — "Missing or insufficient permissions." reached the screen on 17 Sept (CAPTION-lost-item-ladder). Correction: one sentence in the traveler's words for each ("This receipt could not be opened."; "Reading the report…"; "This conversation could not be loaded." — `errConversationLoad` already exists and is unused here) (P2).

**Q-24 — YES, deliberately.** An account is required before any price or destination is shown (`_layout.tsx` 61–65 overlays `AuthScreen` until signed in); payment is deferred ("Payment can be added when you reserve your first travel."); push is requested only after sign-in (`_layout.tsx` 27–39); location is requested on first Home open. The gate is a product choice for the founders; the charge-at-confirm without a stated line is Q-21's correction.

### Map coherence

**Q-25 — NO (structural).** Per stage, from source: selection — no map (`reserve.tsx` 333: `!editing &&`; capture 6); review/options/confirmation — one MonoMap frame with both ends and the ink route (capture 2); matching — no map, a radar and "~ 00:12" (`ride.tsx` 164–243); assignment — a different map (Apple Maps on iPhone, `LiveMap.ios.tsx`; a fixed SVG bezier on Android/web, `LiveMap.tsx`) with a car placed at `targetFraction(status)` = 0.15/0.6/1.0 of the approach path; arrival — car at 1.0, `FindMiguel` card; active — camera pulls back, car at 0.45/0.9 of the trip route by status step; complete — no map, "dep → arr" text. Each stage differs, but three stages have no map and two stages draw a position that is a function of the 2.6 s timer, not of anybody's location.

**Q-26 — NO.** Pickup, destination and route disappear at destination selection (while the field is focused) and at matching; the map provider, palette and pin language change at assignment (monochrome MapLibre → Apple colour, ink route → blue polyline); Operator identity is absent from Travel Complete (`complete.tsx` shows only "dep → arr" and the Travel Number); Travel Number is continuous from the ride screen on.

**Q-27 — NO (material).** `liveMiami: 'LIVE · MIAMI'` is drawn in a pill over `LiveMap.ios.tsx` (line 211) and `LiveMap.tsx` (line 216). On iPhone the car's position is `pointAlong(path, targetFraction(status))` — the demo step, not a report from the operator (demo operators "cannot report anything", `RideContext.tsx` 1069). On Android/web the "map" is a 358×170 bezier with a car looping every 7 s, a marching dashed route and a pinging ring — no data source at all. Operator side: "NAVIGATION · TO PICKUP" over a drawn grid. The contract: "a schematic or simulated map is never presented as real live geographic tracking." Correction: remove the badge everywhere; draw a car only from a reported position (`matchedOp.lat/lng` updated by the operator's presence heartbeat), never from status; on Android draw the MonoMap route with no car until a position exists; on the operator side drop the word NAVIGATION until navigation exists (P1).

**Q-28 — NO; and a contract conflict.** During active travel the map is a 2.1:1 frame (≈342×162pt on a 390×844 screen, ≈19% of height), `pointerEvents` off, above five cards; the uncovered part tells the traveler a status-derived car position (Q-27). `MonoMap.tsx` states the design intent: "CONTEXT, NOT A CONTROL … never the subject" — Chad approved that for Home on 13 Sept. The contract says `map_role: the travel workspace, not an unrelated decorative card`. The implementation applies the Home decision to every stage, including live travel where the contract's role matters most. Reported as a conflict for the founders to settle.

Structural failure — the map across stages. Three alternatives:

| | A. One MonoMap frame, every stage | B. Keep Apple Maps for live travel, restyle | C. No live map; status ladder + finder |
|---|---|---|---|
| Comprehension | High: the frame the traveler saw at confirmation persists; the route stays, the operator's dot appears on it when reported | Medium: a second map language mid-journey; a traveler learns two maps | Medium-low: "where is the car" answered only in words |
| Continuity | Full: pickup, destination, route, Travel Number and operator on one frame from selection to completion (frame kept during search and complete, ends marked, route greyed after) | Broken at assignment (provider, palette, pins) | Route lost at matching; map absent for the longest stage |
| Implementation risk | Medium: `LiveMap.ios.tsx`/`expo-maps` retired; camera follow via `frameKey`/`Camera`; operator position must come from presence — visible in code review and one device walk | Low: badge and status-driven car removed, colours changed; provider stays | Low: delete two components; `FindMiguel` stays |
| Identity | Strongest: one drawn instrument in the palette, as Chad specified on 13 Sept | Weakest: a third party's map inside the letterhead | Calm but thin; contradicts the contract's map role |

Recommend A: it is the only one that satisfies both the continuity list and Chad's 13 Sept map decision, and it makes the badge question disappear because nothing is drawn that is not reported.

### Meaningful motion

**Q-29 — NO.** Decorative: `LiveMap.tsx` `driveLoop`, `dashLoop`, `ringLoop` (lines 53–84) run regardless of state; `OperatorMap` loops a car under "NAVIGATION". Explains state: Radar (searching), `PulseDot` (live travel banner), `SweepArc` (assessing), `Halo` (in service), Drawer slide, segmented thumb, press scale. Correction: within Q-27's.

**Q-30 — NO on Android/web, UNCLEAR on iPhone.** The three SVG loops stop only on unmount; at "Operator Arrived" the car keeps driving. On iPhone `LiveMap.ios.tsx` 118–137 eases to a target and clears its interval — correct in source; whether the camera jump at the phase flip (`shownFraction` reset to 0, line 121) reads as a snap needs a device walk.

**Q-31 — NO (P3).** `_layout.tsx` 56: `animation: 'fade'` for every push; the back chevron implies a horizontal stack and the "sheet" is a full screen that fades. The Drawer originates from the hamburger's side (correct). Correction: `slide_from_right` for pushes, `slide_from_bottom` for the confirmation sheet, fade only for the auth overlay.

**Q-32 — NO (P3).** The map and the whole sheet body vanish when the search field is focused (`!editing`) and reappear on pick; searching → enroute swaps the entire screen; the cancel card, the `FindMiguel` card (after a 3.5 s timeout, `ride.tsx` 136) and "Calculating" → amount all appear with no transition.

### Trust

**Q-33 — NO (no second amount found), one contradiction of state.** Home suggested card $17.97 (capture 1) = sheet $17.97 (captures 2–4; the quote is passed through, `index.tsx` 599–607); receipt $19.44 = Travel Log $19.44 (captures 13, 19, 20); every money screen reads `ride.travelerTotal` or the record. Residual: `complete.tsx` shows `trip.total` while `ride.tsx` shows Stripe's `amountCents` — parity is proven for the fee (`backend/payments.test.js`), not for class multipliers or fee lines. The contradiction is of state: the sheet says "Payments are simulated during the test program. No charge is made." (captures 2, 4, 12) and the same account's receipt says "Total Charged $19.44" (capture 19, next day), the ride screen "$19.44 charged" in green, the completion screen "Total Charged". Correction: derive the label from `paymentModeNote`'s source: in test mode "Total · no charge made" on ride, complete and receipt, and store the mode on the record so an old receipt cannot say "charged" for a simulated charge (P1; the founders may hold it to P0 under "money disagreement").

**Q-34 — NO (material).** "Estimated operator arrival: 3 minutes" — random. "~ 00:12" — constant. "LIVE · MIAMI" — status-driven. "VERIFIED" on every matched operator (`ride.tsx` 345) including the demonstration fleet ("THESE PEOPLE DO NOT EXIST", `dispatch.ts` 83) — and the receipt team already ruled "screening is not live, so 'Verified' would be a claim the system cannot make" (CAPTION-travel-receipt). "Your code identifies the people you bring to American Rider." — registered nowhere. "Finding the best available Operator" — nearest. The cabin environment "as the operator will receive it" vs the operator's fixed demo note. "Estimated travel time: 24 minutes" — a table constant. The $3.00 arrival fee is real (`backend/server.js` 1002–1056 withholds it and transfers it) — not a false promise. Correction: each named above; VERIFIED shown only when `matchedOp.demo === false` and screening is recorded on the operator (P1).

**Q-35 — YES, three.** "VERIFIED" eyebrow (the badge whose only job is trust); "%{name} will come right there." (`dragPinToStanding`); "Operators always keep their full 99%." (`operatorsKeepFull`, invite foot — the model stated a fourth time, as a slogan). The reassurance strings the rubric lists are absent. Correction: remove the three (P2 for VERIFIED).

### Product truth

**Q-36 — NO (material).** Real: dispatch, Stripe, the case, the lost-item record, the thread (Firestore), the arrival fee. Simulated and labelled: payments ("Payments are simulated…"), operator revenue, operator review ("Test program — review is simulated and clears at once."), screening. Simulated and NOT labelled to the traveler: the demonstration fleet — name, car, plate, "VERIFIED", a car moving on the map, "Confirm Boarding", scripted replies ("Got it — see you soon."), a journey advancing every 2.6 s (`RideContext.tsx` 1031–1043) and boarding itself after 25 s (1187–1191). No traveler-facing string says "demonstration operator"; capture 13 prints "Operator Miguel D." — the fictional operator — on a completed, charged travel of 29 Aug indistinguishable from the rows beside it. Correction: when `matchedOp.demo`, the operator card reads "Demonstration operator · test program" in place of VERIFIED, the map draws no car, the thread's scripted replies are removed, and the record carries `operatorDemo` onto the Travel Log and receipt rows (P1).

**Q-37 — YES, two exceptions.** Clean absences: SUGGESTED TRAVEL and Frequent Destinations for a new account (`index.tsx` 195–228, 652), "Completed travel appears here.", "Your cases" absent when none, "Not set" (capture 8), no rating anywhere, "Not recorded" on the receipt (capture 19). Furniture in place of absence: the verification step and "~ 00:12" (Q-10).

### Missing product ideas

**Q-38 — YES.** Ranked by moment of need: (1) 5:30 AM scheduled airport travel — no notification when the operator is assigned or arriving; the splash admits "The notification is still not built" (`schedule.tsx` 186–187) and the traveler must open the app. (2) Airport pickup — no flight number or terminal on the sheet; the MIA venue note (`venueMIA`) tells the traveler where to stand but the operator is not told which terminal. (3) At the kerb — no masked voice line; the thread is the only channel and the finder arrow is iPhone-only (`FindMiguel.tsx` is a button).

**Q-39 — YES.** (1) Navigation: no hand-off to a navigator; a drawn map labelled NAVIGATION. (2) The travel's actual requests: luggage assistance, charging cable, quiet — booked by the traveler, replaced on the operator's screen by one demo sentence. (3) Background dispatch: "Keep American Rider open to stay in service." — an operator cannot lock the phone between travels.

**Q-40 — YES.** One travel record, one frame: from the moment a destination is chosen, make the itinerary card and the MonoMap frame a single component that every later screen mounts — sheet, searching, live, complete, receipt — with the stage written onto it (route ink → operator dot → route greyed → record). Every number on it (amount, operator arrival, Travel Number, mode) read from the record and from `paymentModeNote`'s source, never re-derived by a screen. That single change removes the provider switch, the vanishing route, the random ETA, the "charged" contradiction and the untranslated `STATUS_LABELS` at once, because the labels live in one place and the frame never leaves.

### Engineered, not decorated

**Q-41 — YES, with named decoration.** Alignment is exact in the captures (labels left, values right, hairlines full-width, tabular figures). Decoration: the LIVE pill, the looping car and pinging ring (`LiveMap.tsx`), "~ 00:12", the itinerary dots, the operator initials disc (`ride.tsx` 320–328 — a filled initials circle, which AGENTS.md forbids in the letterhead; here it is the demo's operator card).

**Q-42 — NO, two components.** The Apple Maps live view (system pins, blue polyline, `car.fill`) resembles every rideshare app; the SVG live map (grid, dashed blue route, car with windshield highlights) is a generic rideshare illustration. Also: red appears on five controls besides Call 911 — "Emergency Assistance" (`safety.tsx` 193–197, opens a screen), "Delete Account"/"Yes, delete" (`delete-account.tsx`), "Yes, cancel" (`ride.tsx` 497–500), "I need help" (`ride.tsx` 420), operator "Decline" — against `buttons.red: reserved exclusively for the actual Call 911 action`. Correction: ink ghost for all five; red-bordered white for Call 911 only (P2, design-system violation).

**Q-43 — NO.** Missed by earlier reviews: (1) `AppText.tsx` 48 `MAX_FONT_SCALE = 1.3` applied to every string — the contract names this exact cap as prohibited (`text_size_cap: no arbitrary application-wide 1.3x cap`), and AGENTS.md still says `allowFontScaling={false}` — documentation and contract both disagree with the code. (2) `UI.tsx`: `PrimaryButton`, `OutlineButton`, `DrawerRow` and all three `LetterheadBar` icons carry no `accessibilityRole` or `accessibilityLabel` (only `Chip` does); `ride.tsx` 12 Pressables, 0 roles; `safety.tsx` 9/0; `schedule.tsx` 7/0 — VoiceOver gets no "button" and nothing at all for the menu, back and account icons (contract: role, name, value, state on every interactive element; P1, inaccessible primary action). (3) No reduced-motion handling anywhere in `app/` or `src/` (contract: honored). (4) The scanner's blind spot and the English live-travel screen (Q-19). (5) The random `pickupWait` on the money screen (Q-14). (6) "Frequent" over recent (Q-14). (7) "No charge is made" against "Total Charged" (Q-33). Correction for (1): remove the cap and let rows wrap (`numberOfLines` already guards the two rows named in the comment), or obtain a founder decision recorded in the contract; for (2): roles and labels in the four shared components and the letterhead, which covers most screens in one change; for (3): `AccessibilityInfo.isReduceMotionEnabled` gating the loops in `anim.ts`.

### Material NOs (ranked)

1. **P1 — Fabricated operational figures on the money and live screens** (Q-14, Q-34): random "Estimated operator arrival: N minutes" (`rollWait`), the same random figure under ARRIVAL after a real `etaMin` exists, `~ 00:12`, riding time derived from the demo step.
2. **P1 — Simulation presented as live and real** (Q-27, Q-36): "LIVE · MIAMI" over a status-placed car; the Android/web looping bezier; demonstration operators with name, plate, VERIFIED, scripted replies and no label; operator "NAVIGATION" over a drawn grid.
3. **P1 — Money-state contradiction in test mode** (Q-33): "No charge is made" on the sheet vs "$19.44 charged" / "Total Charged" on ride, complete and receipt of the same account.
4. **P1 — English on the live-travel path in four languages** (Q-18, Q-19): `STATUS_LABELS`, step labels, "Total Charged/Due", the arrived-stage cancel sentence, "charged", plus the schedule, safety, emergency, delete-account and operator literals; the untranslated gate does not see ternaries, arrays or template literals.
5. **P1 — Accessibility** (Q-43): no roles/labels on the shared buttons and letterhead icons; no reduced motion; the 1.3× cap the contract prohibits; overlapping sub-44pt link targets (`wallet.tsx`).
6. **P1 — Operator instrument** (Q-20, Q-39): no navigation hand-off; fixed demo Travel Notes in place of the traveler's booked cabin environment (contradicting the sheet); foreground-only dispatch.
7. **P2 — Map structure** (Q-25–Q-28): three stages without a map, a provider/palette switch at assignment, the contract's `map_role` vs "context, not the subject" — alternative A recommended; founders to reconcile the contract line.
8. **P2 — Controls and labels that misdescribe** (Q-14, Q-04): "Reserve Travel" reserves nothing; "FREQUENT DESTINATIONS" lists recent; "ARRIVAL" over words; "Arrange it now" with no control; "Finding the best available Operator"; "Estimated travel time" from a fixed table; "Complete"/"Begin Travel"/"Travel Complete" as button names.
9. **P2 — Content scrolls under the status bar** (Q-06; captures 34, 35), the known open item.
10. **P2 — The verification step that does nothing** (Q-10, Q-21) — remove while SMS is off.
11. **P2 — Invitations** (Q-34): a code registered nowhere under "Your code identifies the people you bring to American Rider."
12. **P2 — Terminology** (Q-13, Q-16): "every fare" in five operator strings, "Tap to see your ride", `driveHeroSub` "99% of every travel cost — … just 1%", fr "course" ×45, de Betreiber/Operator.
13. **P2 — Red on five controls other than Call 911** (Q-42).
14. **P2 — Defaulted states** (Q-23): raw Firestore error text in the thread; empty receipt and lost-item frames.
15. **P2 — Charge at confirm unstated in live mode** (Q-21) — one sentence, no instrument named.
16. **P3** — "authorize operator dispatch"; "Welcome back", the 404 pun, "Something went wrong", "will come right there", "Treated as a professional"; fade transitions; per-element spacing; itinerary dots; single-row cards; whitespace pools on Case filed.

### UNCLEAR needing device evidence

- Q-17: 320pt captures in German of the sheet footer, receipt buttons, wallet row and ride head row.
- Q-30/Q-31/Q-32 on iPhone: whether the Apple map camera snaps at the approach→trip phase flip, and how the fade pushes, the search-mode vanish and the cancel card read in motion.
- The searching, live-travel and Travel Complete screens themselves: no capture exists in send/ (screens 1–36 skip them); every answer about them is from source.
- VoiceOver: focus order, what the letterhead icons announce, whether the Drawer's scrim traps focus; Dynamic Type at the 1.3 cap and at AX sizes.
- The Stripe sheet moment after "Confirm Travel" in test and live mode, and the wording of the Live Activity (`src/widgets/TravelActivity.tsx`, not read).
- Android: `LiveMap.tsx` behaviour during a real travel; `FindMiguel.tsx` (button only) at arrival.
- A real (non-demo) operator's travel end to end: whether `etaMin`, position and the arrival fee flow reach the traveler's screens as the source suggests.

## Regression scope

The change inside the candidate range that this reviewer implemented, `e8c791a`, altered
`watchTravelThread` for BOTH the traveler's thread (`app/message.tsx`) and the operator's
(`app/operator/communicate.tsx`). Re-tested: the traveler's thread on the simulator in English
and Spanish, reopened from a lost-item report — the stored message from 16 Sept listed, back
intact. NOT re-tested: the operator's thread (needs the Pro simulator with the operator role and
an assignment); an operator's reply arriving on the traveler's side (none exists). `10d54c5`
changed only catalogue strings and `message.tsx` presentation — walked. `fc01d5b`, `625d003`,
`a8f9db3`, `b2a0dfc` are docs/evidence or superseded by `e8c791a`.

## Tests added or changed

none in the candidate range `b2a0dfc..a8f9db3`. The 23 backend test files ran at `a8f9db3`
(every check passed); what each proves is unchanged from the 16 Sept handoff. This review added
no test; the tests it found missing are named above (PAY-01 idempotency, a Stripe
bad-signature case, a Firestore rules test, a follow-token expiry test, a ≥3-candidate match).

## Residual risk

Every NOT TESTED gate above, and every uncovered cell of the test matrix:

- **Physical iPhone (TestFlight build of this candidate): none exists.** Open: Call 911 reaching
  the dialer; background presence with the phone locked; push; Live Activity; Apple Pay; real
  GPS; permission revocation; Sign In with Apple. Closed only by a device pass on build 37.
- **Viewports:** only 402 pt (iPhone 17) seen; 320/375/430 pt untested — overflow and the primary
  action's reach at 320 pt are open on every screen.
- **Type sizes:** standard only; enlarged and AX sizes untested (and capped at 1.3× — F-08).
- **Content stress:** no 40-character names, long addresses, $1,234.56 travel, keyboard-open pass;
  only en and es seen on screen; fr/it/de never rendered on a device this revision.
- **Permissions and connectivity:** denied/revoked permissions, airplane mode, 30 s+ timeouts
  untested — and F-06 says most calls would hang.
- **Server responses:** no code × endpoint matrix; malformed-body behaviour unknown on the client.
- **Lifecycle:** termination during selection, matching, active travel, In Service; stale
  notifications; deep links to own/foreign/invented Travel Numbers — untested (own `/lost?item=`
  reopen works; a foreign id falls back to the list by code, `app/lost.tsx:118–124`).
- **Roles:** Traveler primary flow NOT walked front door → receipt this revision; Operator flow
  not walked; both-on-one-account switching untested.
- **Data left in production Firestore:** two lost-item test reports and one message on Adrian's
  account (16 Sept), one support case AR-C-986761 — test data visible on his Patron Support.

## Founder decisions required

1. **Dynamic Type cap (F-08).** The contract says supported, no application-wide 1.3× cap; the app
   caps at 1.3× on purpose (`AppText.tsx:13–20`, the demo-exactness rule); `AGENTS.md` still says
   `allowFontScaling={false}`. Either the contract's line changes or the cap comes off; `AGENTS.md`
   must say which.
2. **Palette contrast (F-13).** `faint` `#B4B3AB` is 1.96:1 on paper; the palette is contractual.
   Keep faint for non-text ornaments only, or darken it — a founder's choice.
3. **"LIVE · MIAMI" during the test program (F-02).** The badge is the demo's; the position is
   scripted until the operator's presence feed drives the car. Remove, or label the simulation.
4. **Red controls (F-03).** The contract is explicit; confirming that cancel, delete, decline and
   "I need help" go to ink is a formality, but the founders have kept them red since 16 Sept.
5. **German "Fahrt" (F-09).** Whether the ordinary German word for a car journey counts as the
   flagged "ride" needs a native reader and a founder's word; French "course" does not.
6. **The Return paragraph and thread on a broad report (F-15)** — Chad's sentence.
7. **The map's role during live travel (Q-25–Q-28).** The contract says `map_role: the travel
   workspace`; `MonoMap.tsx` says "context, not a control … never the subject" — Chad's 13 Sept
   decision for Home, applied to every stage. Three alternatives are compared in the qualitative
   section; A (one MonoMap frame through every stage, a car drawn only from a reported position)
   is recommended. Either the contract line or the implementation changes.
8. **Test-mode money wording (F-20).** "No charge is made" against "Total Charged" for one travel.
9. **Labelling the demonstration fleet (F-21)** and the "VERIFIED" eyebrow on operators the
   system has not screened.
10. **Unchanged from `docs/OPEN-DECISIONS.md` §0:** vehicle tiers, the two Apple maps, self-hosted
   tiles, control names, the 99 % statement's placement, the last blue control, "Operator
   notified" as a rung label.
11. **No contract change is proposed by this review.** The receipt's 99 % footer line states a
   percentage and no amount, consistent with `traveler_screens_itemize.operator_payout: false`
   as the founders read it on 15 Sept.

## Final release statement

**CONDITIONAL PASS.** "This candidate (commit `a8f9db370fcf854dc1204142945bfb171c8578f4`, build
`none yet — TestFlight 37 to be cut from it`) may proceed to `TestFlight internal testers` once the
following are confirmed by `Adrian`: `the american-rider.expo.app deployment is down (F-01); the
ride map no longer shows "LIVE · MIAMI" over a scripted position, or the screen carries the
test-program simulation label (F-02); the emergency screen's control and the arrived-stage
cancellation sentence read from the catalogue in five languages (F-04, emergency.tsx:356,
ride.tsx:483); the founders' word on the test-mode "charged" wording is applied (F-20) — each
verified on the stamped build`."
