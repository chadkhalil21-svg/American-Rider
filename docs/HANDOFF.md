# Session handoff — American Rider

> **Superseded on 15 Sept 2026 by `CURRENT_HANDOFF.md` at the repository root** (the 13–14 Sept
> design-review sessions: one-sheet booking, MapLibre map, menu, profile, Payment & Settlement).
> This file remains the fuller record for Checkr, the website and Smart Travel (9–10 Sept).

Written 9 September 2026 by Claude at the end of a very long session. A new session should read
this first, then `AGENTS.md`, then the memory index. Everything here was true when written;
verify anything that can change (deploy state, Checkr status) before acting on it.

## Goal

Launch American Rider in Miami: test program with real Operators on **28 Sept 2026**, public
launch **Monday 19 October 2026**. The immediate objective is a release candidate with zero P0
findings, cut as one commit for TestFlight, web and backend, with a physical-device pass.

## Where things stand

**Repository:** branch `skill/american-rider-release-review`, HEAD `a97bfe9`. Application code
is byte-identical to `main` at `870ac9f`. Tag `design-baseline-2026-09-09` marks the design as
it stood before any redesign — revert target.

**Uncommitted work on this branch (not yet committed on purpose — commit only when asked):**
- `site/` — the new marketing website ("The Line"), built 9 Sept, with `site/images/`
  (three ChatGPT-generated photographs, night scenes, used as greyscale plates).
- `.claude/launch.json` — added the `marketing` preview config (python http.server on 8125,
  directory `site`). Start it with preview_start name "marketing"; open
  http://127.0.0.1:8125/ (Brave needs 127.0.0.1, not localhost).

**Three copies of the app exist and differ:**
| Copy | Commit | Date |
|---|---|---|
| Web `https://american-rider.expo.app` | current code (`870ac9f`) | 6 Sept |
| TestFlight build 36 (testers' phones) | `7dae837` | 4 Sept |
| iOS Simulator (iPhone 17 Pro) | `7dae837`, built locally 7 Sept 20:00 | — |
The simulator app is also saved at `~/Downloads/American-Rider-Simulator-Baseline-2026-09-09/`
(`xcrun simctl install booted <path>/AmericanRider.app` reinstalls it). A local simulator build of
the CURRENT code fails at link (Xcode 26.6, expo-widgets `SwiftUICore`); the 4 Sept commit builds
fine, so the failure is something added after 4 Sept (BUILD-05 points at the 5 Sept Info.plist
change). Not yet diagnosed.

**Backend:** Render deploys GitHub `origin/main` = `3483a1d`, seven commits behind the candidate
(missing the Metrorail stop-count fix in `backend/smart.js` and `smart.test.js`). `/health`
showed: stripe test, screening off, 6 operators / 0 dispatchable.

**Live domain:** `https://americanrider.app` is served by the Render backend (`HOME_HTML` in
`backend/server.js` plus `/terms`, `/privacy`). It shows the old table price ($24.50) and the
phrase "every travel fare" — both to fix when the homepage is replaced by `site/`.

## The release review (6 Sept)

Skill: `.claude/skills/american-rider-release-review/` (committed). Report and evidence:
`~/Downloads/American-Rider-Review-Handoff/05-audit-and-evidence/` and the ZIP
`~/Downloads/American-Rider-Review-Handoff.zip` (given to ChatGPT for an independent review).
Result: **BLOCK** — 164 gates: PASS 41, FAIL 94, NOT TESTED 29; 29 open P0 findings (26 gates +
3 qualitative). 54 of 107 adversarial verifications did not run (agent limit). The full P0 list is
in the report; the ones that drive the recommendation:
- fee implementation vs contract (ECO-01/02/08/10, PAY-02) — see "unresolved" below
- receipt prints a literal "−$1.15" credit (`app/receipt.tsx`)
- Smart Travel is a simulation labelled "Total Charged" with tip chips (`app/smartride.tsx`)
- dropped pickup pin dispatches from hardcoded Brickell (`app/pickup-map.ios.tsx:112`,
  `RideContext.tsx:540`)
- active travel does not survive termination; sign-out leaves the previous account's `ar:` keys
- simulated vehicle under a "LIVE · MIAMI" badge
- unanswered offers not re-offered; uncommissioned / expired-insurance operators can enter service
- 8 red controls where only Call 911 may be red; emergency message names demo travel AR-2047-MIA
- TestFlight, web and backend never cut from one commit (BUILD-01/03)

## Founder decisions — decided

- Standing rubric (Adrian, 7 Sept): Lead App Architect and Quality Auditor; Institutional /
  Authoritative / Sophisticated; six-part review output. Saved in memory `standing-rubric`.
- Product contract (`references/product-contract.yaml`): 99% of travel fare to the Operator,
  1% commission no cap, traveler pays travel fare + the platform fee (the greater of $1.50 and
  5% of the travel fare, rounded up to the cent — Chad, 9 Sept), one Complete Travel Cost,
  no breakdown on traveler screens.
- Launch target (proposed by Claude, Adrian agreed in spirit, not formally confirmed):
  test program 28 Sept 2026; public launch **Monday 19 October 2026**.
- Smart Travel (Chad, 9 Sept): build it REAL (dispatch two car legs, charge car legs + one $1.50,
  never the transit fare, real Travel Numbers); show it ALWAYS on Travel Options with the numbers
  (grey only when no transit route exists); include buses on dedicated right-of-way / ≤15-min
  frequency; implement with OpenTripPlanner on Miami-Dade GTFS rather than the hand-typed
  23-station list.
- Maps (Chad, 9 Sept): no Google. iPhone = Apple Maps; Android = MapLibre/OSM; routing and
  pricing server-side on self-hosted OSRM; one Expo codebase for both stores.
- Screening: operators pay. Packages `american_rider_operator` (live, $39.49),
  `american_rider_mvr_only` (Checkr building), `american_rider_basic_only` (Checkr cloning from
  `checkrdirect_basic_plus_criminal`, requested by email to Andrew, Checkr support).

## Unresolved — do not resolve alone

1. **Platform fee — DECIDED 9 Sept 2026, no longer open.** Chad: "five percent", relayed by
   Adrian. The fee is the greater of $1.50 and 5% of the travel fare, rounded up to the cent —
   $1.50 exactly below a $30 fare, continuous at $30, never a loss on a US or international
   card. Implemented the same day in `src/data.ts platformFee()`, `backend/payments.js
   platformFeeCents()` (parity-tested to the cent from $0 to $500 in `backend/payments.test.js`),
   the Terms in five languages, the About page, `backend/support.js`, `backend/site.js`,
   `site/index.html`, `AGENTS.md`, `docs/REVIEW-BRIEF.md`, the product contract and the release
   gates. Adrian's 5 Sept contract text ("exactly $1.50") is superseded. Still to update: the
   memory notes `platform-fee-contract-conflict` and `standing-rubric`, and the older docs that
   still describe a flat $1.50 (GO-LIVE, FARE-MODEL, PAYMENTS-PLAIN, PRODUCT-SPEC,
   LAUNCH-CHECKLIST, GAME-PLAN, MAPS, ORDER-OF-OPERATIONS, MAC-HANDOFF, V1.0-SPEC). Do not
   re-ask.
2. Dynamic Type 1.3× cap in `AppText.tsx` vs the accessibility contract.
3. Locked palette contrast: muted 3.24:1, faint 1.96:1 on paper.
4. "Reserve Travel" label on Home (opens search); ARTS terms on traveler screens.

## Checkr — status 9 Sept

- Andrew (support) email: Developer Access is self-serve. Adrian submitted "Request account
  review" (3–5 business days). Reason text given. Remaining dashboard steps: kickoff module,
  request staging, authorization checklist (needs a recorded demo — Claude prepares it once
  staging exists). Webhook: `https://american-rider-server.onrender.com/checkr/webhook`
  (`backend/server.js:112`, signature check in `backend/checkr.js`). Code expects the three
  package slugs above. `backend/checkr.js` points only at production `api.checkr.com`; staging
  needs a one-line base-URL config change.
- Account Security email (business validation): Adrian replied 9 Sept with usage, volume,
  business details, operations, account security (names: Adrian Derk Smith, Chad Khalil Dia).
  **Documents not yet sent:** Florida Fictitious Name registration (sunbiz.org — American Rider is
  a sole proprietorship; check who holds the EIN before filing) and the IRS EIN letter (Chad
  could not download it; fastest replacement is a 147C letter by phone, 800-829-4933).

## Website — `site/`

Concept "The Line": one ink line runs the length of the page and is the motif — it enters as
the rule under the opening, becomes the route on the Miami map (real server quotes from
Brickell: MIA $17.97 (was $19.13 until the airport coordinate moved to the terminal kerb, 9 Sept evening), Wynwood $10.50, South Beach $13.29, Coral Gables $17.85, PortMiami $10.50,
Kendall $27.62, Design District $11.96), becomes the divider in the fare ledger (replaces the
hairline above "The Operator receives"), becomes the divider above the Plate row in the
Operator's record, and ends under Begin Travel. Line geometry is measured in the overlay's own
coordinate space (subtract `pageTop`) and re-measured on every frame when any anchor moves —
both were real bugs Adrian found. Journey scene: map LEFT, copy right (line enters beside
Brickell). Photographs: greyscale + multiply + masks, never under text; the journey photo is
unused. `?static=1&scene=<id>` is the review mode for headless captures. Verified: no text
touched by the line at 1280 and 390; no overflow. Adrian: "it actually looks perfect."
Not yet deployed to `americanrider.app`; do that only on founder approval (replace `HOME_HTML`
or serve `site/` statically, keep `/terms` `/privacy`).

## Redesign in progress

Adrian had ChatGPT review the 45 simulator screenshots
(`~/Downloads/American-Rider-Screens-TestFlight36.zip`) and produce design suggestions and
mockups; Chad is choosing one. Adrian will paste the chosen suggestions; build the redesign on a
new branch, never on the baseline.

## Failed attempts — what did not work, and why (do not repeat)

- **Local simulator build of current code** fails at link: `cannot link directly with
  SwiftUICore` (Xcode 26.6, expo-widgets extension). The 4 Sept commit `7dae837` builds; so the
  cause is a change after 4 Sept, likely the 5 Sept `Info.plist`/plugin edit. Not diagnosed.
- **`npx expo run:ios` piped through `tail`** hung for 40 minutes waiting on an interactive
  prompt. Run it with `CI=1`, streaming to a log, `--configuration Release --no-bundler`.
- **Headless Brave captures of scrolled scenes**: `#fragment`, `?at=`, `scrollIntoView` and
  `--virtual-time-budget` all failed. Only the page's own `?static=1&scene=<id>` mode (body
  translateY) works. The pane cannot screenshot while hidden; JS still runs there.
- **Line overlay bugs (both found by Adrian, both real):** measuring anchors from the top of
  the document instead of the overlay's own `.page` box put every line one header-height too
  low; measuring once at load left the line stale after fonts/address-bar reflow. Fixed by
  `pageTop` subtraction and per-frame re-measurement. My hit-test had passed because it made the
  same mistake — verify geometry in the overlay's coordinate space.
- **`.plate` as an image class** collided with the record's `.row.plate`; images use `.photo`.
- **Private artifact links** cannot be opened by Adrian without signing in to claude.ai in that
  browser; deliver files (SendUserFile) or serve locally instead.
- **The audit's adversarial verification** stopped at 53 of 107 on a session agent limit; the
  54 unverified gates are listed in the report.
- **Context compaction lost a fact** (Chad could not download the EIN letter) — the reason this
  file exists. Write the handoff before a session is long, not when it is full.

## How to run / verify (short)

`npm run check` (typecheck + three i18n gates + backend tests); `cd backend && npm run lint &&
npm test` (354/354 on a97bfe9); `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios`.
Production web deploy: `npx expo export --platform web && npx eas-cli deploy --prod`.
Never type secrets, tax IDs or passwords; never create accounts; Adrian is the account holder
and needs one instruction at a time; Chad needs evidence and answers by count, not status.

## Next actions, in order

1. ~~Chad's yes on the fee SHAPE~~ — received 9 Sept 2026 ("five percent") and implemented:
   the greater of $1.50 and 5% of the travel fare. Money work is unblocked.
2. Fix the 29 P0s, money first (receipt credit, Smart Travel real, price fallback), then
   dispatch (pin, re-offers, commissioning), safety (red controls, demo Travel Number, emergency
   reach), state (relaunch, sign-out), map "LIVE" badge.
3. Diagnose the local simulator link failure so the simulator can mirror current code.
3a. Replace the public demo OSRM router with a self-hosted regional router BEFORE 28 Sept (addendum).
4. One commit → Chad cuts TestFlight → web deploy → push `main` (backend) → device pass.
5. Checkr: documents, kickoff module, staging, demo.
6. Transit engine (OpenTripPlanner + GTFS), then Android.

## Addendum — 9 Sept, evening (from the original session, after this file was first written)

Chad, relayed by Adrian, on scale (verbatim intent, not paraphrase of a decision):
- **Transit:** the typed 23-station list is not acceptable for a national platform. Confirmed:
  delete it; OpenTripPlanner on each city's GTFS feed; opening a city = loading its feed.
- **Maps/infrastructure cost at millions of users:** the founders were shown a third-party AI
  cost table (Netlify, Supabase, Google Maps ≈ $5,000/month at 250k rides). Verified: Google
  ended its $200 credit March 2025 and bills ~$5/1,000 routing or geocoding calls; Mapbox is
  cheaper but still per call. **None of those services is in our stack.** The principle given to
  Chad: pay per server, never per call. Plan: iPhone = Apple MapKit (free, no quota);
  Android/web = MapLibre + self-hosted Protomaps tiles on Cloudflare R2 (zero egress);
  routing = self-hosted OSRM or Valhalla, regional (replace the public demo router BEFORE the
  test program); transit = OTP; address search = Apple on-device on iOS, self-hosted Pelias
  elsewhere; Firestore reads bounded now and Operator presence pings moved to a purpose-built
  store before ~10k Operators; Stripe's percentage is the largest cost at any scale, which is
  why the rising fee is right. No Google anywhere.
- Chad's earlier message (same day): build Smart Travel REAL; show it always with the numbers;
  include dedicated-right-of-way / ≤15-min buses; one Expo codebase for both stores.
- Adrian sent Checkr the business-validation reply (documents to follow); Andrew (Checkr) is
  cloning the basic package; developer review requested.
- Fee: Chad answered 9 Sept 2026 — "five percent". The rule is the greater of $1.50 and 5% of
  the travel fare, rounded up to the cent, and it is implemented. Do not re-ask.

## 9 Sept, late evening — fee decided, Smart Travel built real, OTP running

**All uncommitted. `npm run check` exit 0 (typecheck, three i18n gates, backend lint + tests).**

- **Fee decided and implemented:** the greater of $1.50 and 5% of the travel fare, rounded up,
  whole-cent arithmetic (`Math.ceil(cents / 20)`) so app and server agree at every cent. Chad:
  "five percent" (relayed by Adrian, "do everything now"). Touched: `src/data.ts`,
  `backend/payments.js` (+ `journeyFeeCents`), Terms/About en/es/fr/it/de, `backend/support.js`,
  `backend/site.js`, `site/index.html`, AGENTS.md, REVIEW-BRIEF, product-contract.yaml v2,
  release gates ECO-01/02/08, `backend/payments.test.js` (parity every cent $0–$500, net > 0 on
  US and international cards). Memory `platform-fee-contract-conflict` records the decision.
- **Smart Travel is real.** The 23-station list and the simulated ride (`app/smartride.tsx`, its
  timer, random Travel Number, "Total Charged", tips) are deleted. Now: `backend/transit.js`
  (OTP GraphQL adapter, `planConnection`, access CAR_DROP_OFF+WALK / egress CAR_PICKUP+WALK —
  OTP 2.10 refuses the car modes alone), `backend/smart.js` (real plan; car ends priced by the
  ordinary fare model, ends under 0.4 crow-miles are walks; ONE fee on the combined car fare;
  Miami-Dade Transit's $2.25 counted once per journey, Metromover/MIA Mover $0, Tri-Rail and
  Brightline fare unknown and said so), `backend/transit-routes.fl-southeast.json` (14 frequent routes:
  rail/mover + 9 Miami-Dade buses + 1 Palm Tran bus at ≤15-min p90 wait), `/smart-quote` returns 200 `{status:'ok'|'none'}`
  or 503 `{status:'unavailable'}`, `/health.transit`. Client: `app/smart.tsx` is the single
  Smart Travel screen (journey legs with the demo's tiles, cost card: American Rider / transit
  paid to the agency / journey / direct, depart–arrive times, "Reserve first travel" → the real
  Travel Confirmation and dispatch; after leg 1, "Reserve last travel"); `app/options.tsx` shows
  the card ALWAYS with the journey price, modes, minutes and "$x less/more than direct travel",
  greyed with "No transit route" or "Transit planning is unavailable"; `app/complete.tsx`
  offers the last travel after leg 1; Home shows the journey row; `RideContext` carries
  `smartJourney`, `beginSmartLeg(1|2)`, one-fee `feeFor`; leg 2 sends `journeyNo` and the server
  credits leg 1's fee (`/create-payment-intent`). `src/smartLegs.ts` names legs in five
  languages. 47 obsolete strings removed, 31 added, all five catalogues complete.
- **OpenTripPlanner 2.10.0 runs locally** (PID 89315, port 8080, `~/otp-data/`, Java 25 via
  Homebrew; graph 229 MB, build 46 s, 1.5 GB RSS). Deploy files in `infra/otp/` (Dockerfile,
  render.yaml, build.sh, README with numbered steps). Set `OTP_URL` on the backend to use it.
  Three real journeys planned end to end (Brickell→MIA, Wynwood→Dadeland, Coral
  Gables→South Beach) — see docs/ECONOMICS-AND-INFRASTRUCTURE.md.
- **Data corrections:** MDT GTFS is `https://www.miamidade.gov/transit/googletransit/current/google_transit.zip`
  (the `/transit/GIS/` address is dead); Metrorail is route_type 2 (RAIL), Metromover 0; the
  app's airport coordinate was on the airfield and is now the terminal kerb (25.7953, −80.2789),
  so Brickell→MIA quotes $17.97 (website re-quoted).
- **Findings for the founders (not fixed):** Fla. Stat. 627.748(6) requires time and distance
  on the receipt — `app/receipt.tsx` shows neither; 627.748(4) requires the fare calculation
  method to be disclosed — the Terms do not state it. MIA and PortMiami charge $2.00 per TNC
  pickup and require permits; the fare has no airport fee, no time component, no tolls.
  Dispatch reads the whole `operators` collection per travel (the real scaling cliff).
- **NOT tested on a device or in a browser:** the web preview needs a Firebase sign-in and
  Claude cannot create accounts. Screens are type-checked and string-gated only; the backend
  is unit-tested and exercised live against OTP. A founder pass of Travel Options → Smart
  Travel → Reserve first travel → Travel Complete → Reserve last travel is the next evidence.
- **Next actions:** founders read docs/ECONOMICS-AND-INFRASTRUCTURE.md; commit; provision the
  routing server and set `OTP_URL`; replace the OSRM demo router; receipt time/distance;
  airport-fee decision and permits.

## 10 Sept, small hours — committed, national, seen on the simulator

**Five commits on `skill/american-rider-release-review`** (a97bfe9 → 3ac4f8e): the 5% fee;
Smart Travel real + OTP infra + site; the receipt's time and distance + the real credit
amount; regions + government fees + own-router; the language fixes. `npm run check` exit 0
at each. Chad's instruction was "commit", so everything is committed; nothing pushed.

- **Region registry** `backend/regions.js` (fl-southeast: Miami-Dade, Broward, Palm Beach;
  feeds MDT, BCT, PALMTRAN, SFRTA, BRIGHTLINE; `OTP_URL[_FL_SOUTHEAST]`, `OSRM_URL[...]`).
  `market.js`, `routes.js`, `transit.js`, `smart.js` read it. `/health.regions[]`.
- **Government fees** `backend/fees.js` (MIA $2.00 pickup, PortMiami $2.00 pickup, bboxes
  from OSM); `quote()` → `governmentFeeCents`, `feeLines`; app shows the line on Travel
  Confirmation and the receipt (`quotedFeeLines` in RideContext); `remittance.js` +
  `GET /ops/remittance`. BCT fare unknown (null) — broward.org unreadable; Palm Tran $2.00.
- **Street routing** `backend/streets.js`: region OSRM → OTP direct CAR → straight line. The
  public demo router is gone. `fares.js quoteWithRoute()` returns routed miles/minutes beside
  the price (no price changed).
- **OTP graph** rebuilt with five feeds (62 s). Server on :8080 (PID in `~/otp-data/otp.pid`).
  Local backend on :4242 via `.claude/launch.json` "backend"; `backend/.env` now has
  `OTP_URL=http://localhost:8080` (local only).
- **Simulator**: the "cannot link SwiftUICore" story was wrong. Real cause: a stale
  `ios/Pods/React-Core-prebuilt/.last_build_configuration` after `pod install` (CocoaPods
  drops the dotfile), so a Debug build linked the Release core. Cure: `npx expo prebuild
  --clean -p ios` (with LANG set). Release build 8 min. Build command that embeds the local
  backend: `CI=1 EXPO_PUBLIC_API_URL=http://localhost:4242 LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
  npx expo run:ios --device <udid> --configuration Release --no-bundler`. The iPhone 17
  simulator (E1B5D5C5…) holds a signed-in account (Spanish); installing over it keeps the
  session (`xcrun simctl install E1B5D5C5-FCBB-4729-96DC-AFF1DE3D8778 <.app>`); set its
  location with `xcrun simctl location <udid> set 25.767,-80.1919`.
- **Seen and screenshotted**: Home ($17.97 airport quote), Destination, Travel Options with the
  Smart Travel card (Coche · Metrobus 11 · Coche, "$3.78 más que el viaje directo" at 00:17),
  Smart Travel screen, Travel Confirmation of leg 1 ($10.50). Not exercised: Confirm (would
  dispatch; 0 operators locally), payment, Travel Complete, the receipt.
- **AI planner**: `src/withdrawn/plan.tsx` (already out of the router); server route
  `/assistant` now 410; `/health.assistant = 'withdrawn'`.
- **Open**: 16 `toLocaleDateString('en-US')` calls ignore the language; section labels scroll
  under the status bar; BCT fare; FLL/PBI/MCO/TPA fees unverified (secondary sources);
  MIA + PortMiami TNC permits (Adrian); fare time term (proposal in the economics doc §8);
  dispatch still reads the whole `operators` collection.
- **Later the same night (commits 40b797f, bdad7ec):** Travel Options omitted the airport fee
  ($17.66 vs Destination's $19.66) — fixed to sum exactly what the server sums; `traveler.continue`
  and `traveler.distance/duration/travelNumber/backgroundCheck` were named under the wrong
  namespace — keys added; `scripts/check-unused-i18n.mjs` now also fails on any
  'namespace.key' the code names that en.ts lacks (the reverse check); Travel Preferences'
  segmented options translated. Seen on the simulator after each fix: Home, Destination,
  Travel Options ($19.66, Spanish), Travel Preferences, Travel Confirmation with the
  "Miami International Airport fee · Incluido · se remite a Miami-Dade Aviation Department ·
  $2.00" line. Open: government-fee NAMES are English in every language (registry data);
  the Destination screen keeps the previous quote on screen while a new destination is typed.

