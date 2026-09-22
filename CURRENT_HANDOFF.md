# CURRENT HANDOFF — American Rider

Written Tuesday 15 September 2026, 13:15 EDT, replacing the 13 September handoff; §0 rewritten
16 Sept 2026 and extended by dated DELTA CHECKPOINTS since.

> **START HERE: ADDENDUM 2 at the end of §0 is the current state (20 Sept: the fare model
> restored, two fee schedules, tolls, the insurance licence corrected). The addendum above it
> covers 19/20 Sept. Original pointer: — 19/20 Sept 2026. Build 39
> was rejected (ITMS-90189) and build 40 carries the same code; one further fix, `2eec9b5`, is
> pushed and in no build. The addendum corrects four statements in the 21:45 checkpoint above
> it, including the claim that the field test needs a real operator in a car. The OpenCode
> transition further up was superseded on 19 Sept.**
> §0 runs oldest-first, so scroll to the bottom of it. That checkpoint and the "Exact next
> action" under it supersede every earlier statement in this file, including §5, §6 and §12,
> and it corrects three statements in the 11:30 checkpoint above it.

Read this,
then `AGENTS.md` (permanent rules; updated this session), the product contract
(`.claude/skills/american-rider-release-review/references/product-contract.yaml`, v2), the
release-review skill in the same folder, `docs/HANDOFF.md` (9–10 Sept: Checkr, website, Smart
Travel — still the fuller record), and the memory index
(`~/.claude/projects/-Users-adriansmith-AmericanRider/memory/MEMORY.md`).

Every repository claim below was checked against Git and the files at 13:10 EDT on 15 Sept
unless marked **ASSUMED**, **NOT VERIFIED** or **UNKNOWN**. Times are EDT.

---

## 0. Since checkpoint `a4b1618` — verified against Git 16 Sept 2026, 16:05 EDT

Where this differs from §5, §6 or §12 below, this section wins. VERIFIED = checked now; ASSUMED
= stated without a check.

**Branch, HEAD, status (VERIFIED).** `skill/american-rider-release-review` at `4f0e9e8`, level with
origin (0 ahead / 0 behind). `origin/main` is still `3483a1d`. 16 commits since `a4b1618`, 61 files.
Tree clean except the deliberately untracked 13 MB `send/American-Rider-Screens/flow-one-sheet-
565e218.mp4`. No worktrees. Memory (outside the repo): `chad-review-protocol` gained steps 7–9
(audit the caption item by item before sending; press every control on the stamped build,
back included, and read the system log; both simulators hold the SAME account);
`platform-fee-contract-conflict` notes the docs sweep.

**Gates at `4f0e9e8` (VERIFIED, 16:02 EDT).** tsc clean · 5 languages × 885 keys, no untranslated
string, no unused key · backend lint clean · 22 test files, 0 FAIL (new: `paidwith.test.js`,
`support.test.js`).

**Commits since `a4b1618`, oldest first (VERIFIED).**
| Commit | What |
|---|---|
| `f215954` | Docs sweep to the 5 % fee rule (11 docs); `legal/` regenerated from legal.js/site.js |
| `ea5380f` | Travel Log rebuilt on the records: completed travel only; route/date-with-year/class/operator per row; count + sum charged; filter labels as keys ×5; SERVER stores what paid at settlement (`paidWithFromIntent`) |
| `0d76060` | Wrapped button labels centred (demo behaviour) |
| `441a0aa` | **Crash fixed:** back on any receipt from the log/Recent Travel killed the app (TypeError since 9 Sept) |
| `8ec0002` | Log dates in `ink2`; chips' touch area 44 pt via hitSlop |
| `5827f98` | Log rows spoken as "destination, from departure" |
| `3aa22f7` | Receipt as a record: Departure/Destination rows; 99 % statement moved from the blueTint panel to a footer line (Chad's word; AGENTS.md exception); "Contact Patron Support"; bank name; "Copy emailed"; "Travel to … again" works for any destination (`q` param on reserve.tsx) |
| `e3a83f5`, `8b82b97` | Receipt spacing; long row values given room |
| `b261ecf` | Evidence + handoff (Travel Log, Receipt) |
| `3dd57bb` | Patron Support: "Regarding" travel card + Travel Log pick mode (`?pick=1`); "Your cases" (new `GET /support/cases`); SERVER enforces Safety category, always-human patterns in es/fr/it/de, per-language messages; seeded AR-2047-MIA can no longer be a case's travel |
| `06f02bf` | Patron Support route two lines; caret ink; no chevron in pick mode |
| `23e0232` | Evidence + handoff (Patron Support) |
| `e2d030f` | Lost Item selection step: full rows; "Ask all recent operators" counting distinct operators; subtext one instruction |
| `bf11d0d` | `scripts/build-simulator.sh` builds with `xcodebuild` directly (Xcode 27); AGENTS.md note |
| `4f0e9e8` | Evidence + handoff (Lost Item) |

**Founder instructions this session (Adrian, in chat).** "Read instructions thoroughly, execute
exactly, verify every update before sending" (four Chad reviews: Travel Log, Travel Receipt,
Patron Support, Lost Item — all answered, each with a caption in `send/` listing done / held
with reason / gates / walked / not tested). "Commit and push" — given three times, all done.
**"Deploy the backend to Render" (16 Sept ~16:00)** — the push of the branch to `main` was
refused by the harness as a production deploy; nothing was deployed. Adrian must run it:
`cd ~/AmericanRider && git push origin skill/american-rider-release-review:main` (fast-forward,
VERIFIED possible; Render tracks `main` — ASSUMED auto-deploy is on, else Manual Deploy in the
dashboard). No new environment variable is required (VERIFIED against render.yaml and every
`readKey`/`process.env` read; OTP_URL/OSRM_URL stay optional).

**Decisions recorded (newer founder word, already in AGENTS.md).** The receipt's 99 % panel is a
footer line (Chad, 15 Sept). Everything else Chad asked for and was not built is held with a
reason in the five captions; no permanent rule changed. Open founder items remain
`docs/OPEN-DECISIONS.md` §0.

**Found, not fixed.** French operator strings say "course" (= ride) ×8 in `src/i18n/fr.ts` (P2,
contract terminology). Home's SUGGESTED TRAVEL estimate is not computed from the current
departure (P2, seen with the simulator in San Francisco). Content scrolls under the status bar
(known P2). Six red controls beyond Call 911 (SAFE-02): safety "Emergency assistance", settings
"Delete Account", delete-account "Yes, delete", Home upcoming "Cancel", ride "Yes, cancel",
operator "Decline". Lost Item's window lists non-cancelled travels of any status (ASSUMED
acceptable — the founders' 16 Aug spec is "the day's travels"; the Travel Log lists completed only).

**Rejected — do not repeat.** Sending captures before auditing the caption against the review
item by item (Adrian sent the Travel Log back; four gaps found). A "second account" capture
(both simulators are Adrian's account). `npx expo run:ios --device <sim>` on Xcode 27 (takes every
simulator for a phone; use the script). Mixing docs and app changes in one commit. A route
trace on the receipt (the path driven is not recorded). A case-handling status (none is tracked).
An item-category picker or delivery-location selector on Lost Item (founders, 16 Aug). Any
caption sentence about a state that was not walked on the named build.

**Environment (VERIFIED).** Xcode 27.0 (27A266a) installed itself overnight 15/16 Sept; licence
accepted by Adrian 16 Sept 14:38 EDT (`sudo xcodebuild -license accept`); iOS 26.5 runtime intact;
iPhone 17 `E1B5D5C5…` booted and running the stamped `e2d030f` production build
(`.expo/simulator-build.json`: dirty=false, built 19:20:35Z); iPhone 17 Pro shut down since the
update. Walked on `e2d030f`: Patron Support → Lost Item (six rows; "Ask all recent operators ·
The operator of these 6 travels is notified.") → Spanish → English restored.

**Live services (VERIFIED 16:05 EDT — SUPERSEDED at 21:06 EDT: the backend is deployed, see
"THE BACKEND IS DEPLOYED" below).** Render `/health`: `assistant: on`, no `regions`, stripe
test; `/payment-methods` 404 — still the pre-9-Sept build. TestFlight 36 (`7dae837`) and the web
app: unchanged, NOT re-checked. Waiting on the deploy: the 5 % Terms/About, payment-method routes,
what paid at settlement (+bank), `GET /support/cases`, Safety enforced, translated support
messages, regions, withdrawn assistant. **After the backend deploys and before TestFlight 37 +
the web deploy, build 36 and the web app show the old fee while the server charges the new
(Stripe test mode, no real money)** — the documented order is backend → web → TestFlight 37.

**Not tested this session.** Physical device; Android; web; 320 pt; enlarged type; fr/it/de on
screen; a travel settled by a server carrying `paidWith`; a support case or lost-item report
submitted to production (would reach real people); EAS/TestFlight on Xcode 27 (ASSUMED
unaffected — EAS builds in the cloud).

**DECISION, Adrian, 17 Sept 2026: NO PUBLIC WEB APP — "we dont want a web version tho, we want it as
the app itself."** The web deploy is OUT of the release cut (it was step 2 below and in §12). The
path is backend (live) → TestFlight 37 (Chad) → parity → release-gate audit → App Store. The
localhost:8081 browser preview stays a development tool. The OLD deployment at
american-rider.expo.app was still online on 17 Sept at a pre-9-Sept bundle (`entry-110f5389…`),
quoting the old fee against the live server: taking it down is Adrian's action (Expo dashboard),
flagged to him; until it is down the money contradiction is not closed. Chad's confirmation of
the decision is not recorded.

**Exact next action.** 1) DONE 16 Sept 21:05–21:07 EDT: Adrian pushed `main` (`d2cccc7`), Render
redeployed, and `/health`, the three 401s and the `/about` wording were verified (see "THE
BACKEND IS DEPLOYED" below). 2) (Web deploy WITHDRAWN 17 Sept — see the decision above.) Chad cuts TestFlight 37 from the branch head
(`docs/TESTFLIGHT-RUNBOOK.md`), then `npm run parity`. 3) Adrian runs
`/american-rider-release-review` for a verified P0 count.

**Lost Item verified end to end (16 Sept 2026, 16:26–17:05 EDT; Adrian: "verify that the lost
Item screen page works complete").** Two builds, both carrying HEAD's app code (`git diff --stat
e2d030f..04ad886 -- app src backend` is empty): the stamped `e2d030f` production build on iPhone 17
for everything before "Report the item", and a `04ad886` build pointed at the LOCAL backend
(`http://localhost:4242`, no `FIREBASE_SERVICE_ACCOUNT`, no `RESEND_API_KEY`) on iPhone 17 Pro for
the submission, so that no report reached a person. WALKED: Menu → Patron Support → Lost Item (six
travels, full rows) → "Ask all recent operators" → row → Describe (button disabled until text;
Add a photo → iOS prompt → picker → thumbnail → Remove) → back → back → Patron Support; then, on
the local build, row → "Black bag, back seat" → Report the item → the ladder (Reported ·
Operator notified with the "could not be passed to a specialist" note — the server logged
`[tickets] case AR-C-484275 REACHED NOBODY — no service account`, which is the expected local
outcome) → Arrange the return → path 1, "Marcus Reyes, who drove your travel", Return travel: No
charge, rung "Marcus Reyes carries it." → Message the operator → thread "Travel AR-2117-MIA ·
Lost item" → "Hi" sent and shown → back (ladder intact) → back → Patron Support → re-entered →
YOUR CASES "Lost Item · Return arranged · Filed September 16, 2026 · Travel AR-2117-MIA".
**Test data left in production Firestore under Adrian's account:** one `lost_items` document
(travel AR-2117-MIA, "Black bag, back seat", status `return-arranged`, return = Marcus Reyes,
$0) and one `messages` document ("Hi", same travel, `lostItemId` set). Rules forbid the app
deleting either; remove them in the Firebase console if the case row should not stay on Adrian's
Patron Support. The local server's case `AR-C-484275` was stored nowhere and emailed to nobody.

**Lost Item — the eleven defects found at `04ad886`, and what was done (16 Sept 2026,
17:20–18:50 EDT; Adrian: "fix the lost item defects", then "commit the fixes". Commits
`8bbb625` (app, catalogues, checker, server route, tests, locales) and `cdeba05` (the case
number stamped on the report); docs in `978b88d` and the commit carrying this line. NOT pushed.)**
1. FIXED — `app/lost.tsx` describe step: the subtitle counts DISTINCT operators, the same number
   the "Ask all" row showed ("For the operator of these 6 travels." / "For the 2 operators of
   these 6 travels."), never the number of travels.
2. FIXED — the subtitles no longer claim delivery before "Report the item": `lostForOne` "For
   Marcus Reyes, who drove your travel to …", `lostForTravel` + `lostNoOperatorRecorded` when no
   operator is recorded. `lostSentToOne`, `lostSentToN`, `yourOperator` retired ×5.
3. FIXED — the Return paragraph is `traveler.lostReturnHow` ×5. `scripts/check-untranslated.mjs`
   now treats a colon inside a text node as prose (`CODEY_BARE`), which is how it was missed.
4. FIXED — "Travel" is `traveler.travelSingular` ×5 (also used by the thread header, which said
   the PLURAL "Viajes AR-…" in every language but English, and by YOUR CASES). The checker now
   counts a `<>` fragment as opening a text node. `travelNo` retired ×5.
5. FIXED — YOUR CASES lost-item rows are pressable (chevron) and open `/lost?item=<id>`, which
   watches the record and draws the ladder, the return and the thread; a record that cannot be
   read falls back to the list. Support-case rows stay inert (they open nothing).
6. FIXED — `app/issues.tsx` reads cases and lost items on every focus (`useFocusEffect`), not
   once on mount.
7. HELD for the founders (`docs/OPEN-DECISIONS.md` §0.9) — the "Operator notified" rung label is
   the founders' 16 Aug word and stays. The thread's empty line no longer claims possession
   ("Anything else that helps find it goes here."). The broad report's note also no longer says
   "went to 1 operators": `lostReportWentToOne` / `lostReportWentTo` ("This report names …").
8. FIXED — `backend/lostitem.js` shapes the case; `POST /lost-item` in server.js calls it;
   `backend/lostitem.test.js` (22 checks: refusals, the composed text, blanks, the 20/2000 caps).
   The app now sends the travel's real route and amount in `trip` (`src/backend/lostitem.ts`)
   instead of blanks and a zero.
9. FIXED — "Add a photo" and "Remove" are 44 pt pressables inside the same card height.
10. FIXED — `app.json` `locales` + `locales/{es,fr,it,de}.json` carry
    `NSPhotoLibraryUsageDescription`; iOS shows it in the PHONE's language (prebuild regenerates
    `*.lproj/InfoPlist.strings`). The camera and location prompts remain English-only.
11. FIXED — YOUR CASES sets the travel number in `Mono`.
12. FOUND ON THE REOPEN WALK, FIXED (`cdeba05`) — the report document never held the case number
    (the app learns it once, in the reply to `POST /lost-item`), so a reopened report always read
    "could not be passed to a specialist". The app may not write `caseNo` (rules), so the server
    stamps it with admin access after filing, ownership-checked (`stampLostItemCase`). Takes
    effect on Render once the backend is deployed; the local server has no admin, so the local
    build cannot show it.
**Collateral of the checker fix:** three English paragraphs the old gate had hidden, all with a
colon in the first line, are now keys ×5: `traveler.notifAlwaysSent` (Notifications foot),
`operator.consentInstruction` (screening consent note; the server still records the English
instruction, server.js:1942), `operator.travelNotesDemo` (`app/operator/pickup.tsx`). **Found,
not fixed:** that pickup notes card is DEMO DATA, the same sentence for every travel — it should
read the travel's cabin environment. Catalogues 885 → 891 keys.
**Walked on the fixed build (working tree at `8bbb625`, local API, iPhone 17 Pro, 18:20–18:50
EDT):** Patron Support → YOUR CASES row (chevron, travel number in Mono) → the reopened ladder
drawn from the record ("Travel AR-2117-MIA.", Return arranged, No charge) → back → Lost Item →
"Ask all recent operators" → "For the operator of these 6 travels." → "Umbrella, rear footwell"
→ Report the item → the broad ladder ("6 travels, every operator told.", the Return paragraph
from its key, "This report names one operator…"; server log: case AR-C-738290 reached nobody,
expected locally) → back → YOUR CASES lists both reports at once (focus refresh) → Español →
the reopened ladder fully translated (heading, rungs, DEVOLUCIÓN paragraph) → English restored.
**Second test record in production Firestore under Adrian's account:** an unplaced report
("Umbrella, rear footwell", no travel number, status `operator-notified`). Seen, not fixed
(P3): the Spanish catalogue's `reported` reads "Notificado" — one word from "Operador avisado";
"Registrado" would be the rung's meaning.
Not tested: the `caseNo` branch of the ladder note (needs a server with a service account and
email; production would email `SUPPORT_EMAIL`, so it was not submitted there); the "any
operator" return path (Marcus Reyes was available, so path 1 was taken); a report with a photo
submitted (photo added and removed only); fr/it/de on screen; the iOS photo prompt in Spanish
(needs a Spanish-language simulator).

**Chad's review of Describe the Item (relayed 16 Sept 2026 evening, on TestFlight 36) — answered
in `865981a`, evidence `send/American-Rider-Screens/29–31-describe-item-*-865981a.png` +
`CAPTION-describe-item-865981a.txt`.** Done: the subtitle "For Marcus Reyes, the operator on your
travel to …" (no "drove", no "sent"); the example "Black backpack, rear seat, behind the
operator" (no "driver's side"); one instruction under the field; WHERE IN THE VEHICLE — five
chips (Chad's Henry Ford point), one at most, joined to the description as written; "Add a
photo" in ink (the 13–14 Sept sheet precedent); PHOTO · OPTIONAL; five languages (897 keys).
Held with reasons in the caption: the stiff/untrue button and title names, a 15-minute search
promise, the vault, a value/urgency selector, delivery options, a hotline. Walked on the stamped
build; not submitted. Adrian forwards the caption and the three PNGs.

**Chad's review of the Patron Support confirmation (Screen 15, relayed 16 Sept 2026 ~20:30 EDT,
on TestFlight 36; he had filed case AR-C-239306 himself) — answered in `135249d`, pushed to the
branch, NOT yet captured.** Done: eyebrows in the section-label grey (CASE FILED / NOT FILED /
ANSWERED / REFUNDED / NOT SENT — the blue/green/red overrides removed); the server's `filed` line
"A person reads your case and replies by email to <account email>." ×5 (`backend/support.js`,
`supportMessage(kind, language, { email })`; `filedNoEmail` variant); Case number · Matter ·
Travel Number rows on the card; "Return to Home" (`traveler.returnHome`); the form's instruction
hidden once the outcome shows. Held: concierge/dossier names, a 60-minute or clock-time promise,
a hotline, a handling tracker, the governance slogan. **Capture blocked on two things only
Adrian can do:** the push of `main` (Render must serve the new sentence) and his yes to filing
ONE marked test case against production from the simulator (it emails the support inbox). The
stamped `135249d` production build is installed on iPhone 17 for that capture. Adrian's push of
`main` was refused to the harness at 20:15 EDT ("Production Deploy"), as on 16 Sept afternoon;
a `/health` watch for `assistant: withdrawn` runs in the session.

**THE BACKEND IS DEPLOYED (16 Sept 2026, ~21:05 EDT).** Adrian pushed
`skill/american-rider-release-review:main` (`3483a1d..d2cccc7`); Render redeployed by ~21:06.
VERIFIED on the live server: `/health` `assistant: withdrawn`, `regions[fl-southeast]`
(`otp: fetch failed` — no OTP on any server, expected), stripe test, fleet 6/6/0;
`/payment-methods`, `/support/cases`, `/lost-item` → 401 unauthenticated; `/about` states
"a platform fee of $1.50 or 5% of the travel fare, whichever is greater". Release-cut step 1 of
`§0 Exact next action` is done; the web deploy and TestFlight 37 remain (both on Adrian's word /
Chad's keyboard), then `npm run parity`. Until then TestFlight 36 and the web app show the old
fee while the server charges the new (Stripe test mode).

**Confirmation-screen capture done (21:10 EDT), with Adrian's yes:** one test case filed from the
stamped `135249d` build against production — `AR-C-986761`, Incorrect Travel Cost, travel
AR-2117-MIA, description marked as a founders' screen-review test asking for a person; the
resolver escalated; one email went to the support inbox (disregard). Evidence:
`send/American-Rider-Screens/32-support-case-filed-135249d.png`, `33-support-your-cases-135249d.png`,
`CAPTION-support-case-filed-135249d.txt`. YOUR CASES now lists that case from the live
`GET /support/cases`, the two lost items, and Adrian's 8 Sept emergency case AR-C-632298.

**After Chad's reply to screen 32 ("The email must be support@americanrider.com", 21:22 EDT):**
americanrider.com is EPG Media's (the trademark note, §"Founder/business track") — told to Adrian,
message drafted for Chad. Adrian: `MAIL_FROM` on Render is support@americanrider.app → `7a3dffd`:
the filed line names the sender, read from `MAIL_FROM` at request time ("A person reads your case
and replies from support@americanrider.app to <account email>." ×5; no MAIL_FROM → no sender
named; `replySender()` parses "Name <addr>" or a bare address; support.test.js 25/25). Adrian
pushed `main` to `7a3dffd` at ~21:50 EDT (server-side only; no app build needed). NOT captured
on a screen — that is one more filed case and one more email; Adrian's call. `1dd98c3`: `/health`
now carries `commit` (Render's `RENDER_GIT_COMMIT`, 7 chars) so a deploy is verified by its
revision, not assumed — visible the next time `main` moves.

**Environment after this work.** iPhone 17: the stamped `135249d` production build (clean
worktree; `.expo/simulator-build.json` is its record), booted, English, on Patron Support.
iPhone 17 Pro: the working tree at `8bbb625` built for `http://localhost:4242` (dirty flag
true: uncommitted at build time), location pinned to Brickell, shut down. Local backend stopped.
Build worktrees removed. Branch pushed to origin; `origin/main` = `dcccfe3`, live on Render and VERIFIED by `/health` `commit: dcccfe3` at 21:55 EDT.

**DELTA CHECKPOINT — 17 Sept 2026, ~20:50 EDT, since the last handoff commit `cc55122` (17 Sept
afternoon; `04ad886` was expected, but §0 above was updated seven times after it and records
everything through `cc55122`).** Founder decisions and facts from the day are in memory, not
repeated here: `no-public-web-app`, `americanrider-app-mailboxes` (chad@ created, Cloudflare
forwarding, support@ delivery unverified, "Send as" not set), `apple-individual-membership-chad`
(corrected: repeat builds run without Chad).

- **TestFlight 37 attempted on Adrian's word and FAILED.** EAS build `fc2e14dc` (number 37, from
  `cc55122`, gates green) errored at signing: the stored provisioning profile (5 Sept) lacks
  Sign In with Apple, which `c2c3b07` (13 Sept, Chad's front door) added to app.json. Both
  targets' credentials were otherwise valid without Chad. One credit spent — 13 of 15 left,
  reset 1 Oct. Option 2 (drop the entitlement for now) was prepared and Adrian REVERTED it;
  app.json and `src/state/appleSignIn.ts` are as committed. Path: Chad ticks Sign In with
  Apple on `com.americanrider.app` (developer.apple.com → Identifiers), then
  `eas build -p ios --profile production --non-interactive --no-wait`; message drafted for
  him. Lesson: check the profile's capabilities against app.json BEFORE spending a build.
- **Chad's third Lost Item review (ladder, return, thread; on build 36, a report he filed 12
  Sept) → `10d54c5`:** no "drove" ("%{name}, the operator on your travel"; "…has finished for
  the day…"; invite text says operator); the Return card states the outcome ("Arrange it now
  and the item leaves as soon as it is found. American Rider chooses who brings it back."),
  "Still in service, so the item returns on their next travel near you.", "%{name} brings it
  back."; last rung "Returned"; thread: no monogram disc, header "Operator <name>", placeholder
  keyed (was an English template literal), Send and own bubbles in ink, fallback name
  translated. 900 keys ×5. HELD for the caption: dossier/custody names, "Property Restored &
  Verified", a delivery-location choice, insured-transit/escort-fee claims, a voice line, a
  live courier map, a sign-off receipt (founders 16 Aug; nothing exists to back them).
- **P1 found and fixed → `fc01d5b`:** the traveler's message screen never read the stored
  thread (only this session's own words + the demo script), so a reopened thread was empty and
  an operator's reply could never appear. It now watches Firestore (`watchTravelThread`, the
  operator side's subscription); the live demo ride keeps its script; unsent words stay from
  the store; a listener that cannot attach says so.
- **Tests run:** tsc + the three i18n gates at `10d54c5` and `fc01d5b` (clean; 900 keys);
  `npm run check` in full + backend lint at `cc55122` before the EAS build. No backend change
  since `1dd98c3`.
- **Branch/HEAD/status:** `skill/american-rider-release-review` @ `fc01d5b`, pushed; `origin/main`
  = `dcccfe3` (live on Render, `/health` `commit: dcccfe3`), so main is behind by
  `cc55122`, `10d54c5`, `fc01d5b` + this checkpoint — docs and app, a fast-forward. Tree clean
  except the untracked mp4. iPhone 17 Pro shut down (local `8bbb625` build).
- **STOPPING POINT.** A stamped `BUILD_REF=fc01d5b` simulator build was compiling in the
  background when the session ended; it installs itself on iPhone 17 and rewrites
  `.expo/simulator-build.json` (which read `10d54c5` at the stop). NOT DONE: the three captures
  for Chad and their caption. Two captures of `10d54c5` were taken and deleted (superseded).
- **Not tested:** `fc01d5b` on any device — the thread must list the "Hi" sent on 16 Sept
  against AR-2117-MIA; if it does not, the fix is not proven. The specialist line "…which a
  specialist is carrying. Case AR-C-…" on a live-filed report (both test reports were filed
  against the LOCAL server, so their ladders show the fallback line Chad objected to — the
  caption must say why his 12 Sept report showed it: the hand-off did not complete, the
  free-tier cold start is the likely cause, and the runbook's pre-flight already asks for the
  Render Starter upgrade). es/fr/it/de of the new strings on screen.

**DELTA CHECKPOINT — 17 Sept 2026, ~21:35 EDT, since `b2a0dfc` (the previous checkpoint).
VERIFIED against Git, the live server and the simulator at the times given.**

- **Checkpoint verified at the start (21:00 EDT):** branch `skill/american-rider-release-review` @
  `b2a0dfc`, level with origin; `origin/main` = `dcccfe3`, live on Render (`/health` `commit:
  dcccfe3`, `assistant: withdrawn`, support firestore + email on); iPhone 17 held the stamped
  `fc01d5b` build (`.expo/simulator-build.json` and the installed bundle's SHA-256 agree); tree
  clean except the untracked mp4. Local `main` is a stale ref at `870ac9f`, behind `origin/main`
  — nothing reads it.
- **The fc01d5b walk FAILED the handoff's own test.** The thread for AR-2117-MIA showed "Missing
  or insufficient permissions." where the 16 Sept "Hi" should have been. Firestore refuses a
  listener that queries `messages` by `tripNo` alone: the rule (`travelerUid == uid ||
  operatorId == uid`) cannot be proven from that query, and rules are not filters. The fc01d5b
  fix was real and could never attach; the operator's screen had the same defect. **Fixed →
  `e8c791a`:** `watchTravelThread(tripNo, side, …)` adds `where('travelerUid' | 'operatorId',
  '==', uid)` and drops the orderBy (two equalities need no composite index; sorted on the
  phone). Gates at `e8c791a`: tsc clean · 900 keys ×5, no untranslated, no unused · backend
  lint clean · 23 test files, all passing (`npm run check` in full; no server change).
- **Captured on the stamped `e8c791a` build → `625d003`:** `34-lost-item-return-e8c791a.png`,
  `36-lost-item-thread-e8c791a.png` (the "Hi" read back from the record — the fix proven),
  `35-lost-item-arrange-e8c791a.png`, `CAPTION-lost-item-ladder-e8c791a.txt` (DONE / FOUND,
  FIXED / HELD / WHY THE 12 SEPT LINE / GATES / WALKED / FOUND, NOT FIXED / NOT TESTED). Walked
  in English and Spanish, back pressed, the app log read for the walk (one process, no
  exception). Nothing filed, sent or arranged against production.
- **Screen 35 shows NO "Arrange the return" control, and cannot on this account:** the control
  exists only on a report against one travel with no return yet; the broad "Umbrella" report has
  no travel number, and the AR-2117-MIA report's return is already arranged. The caption says
  so. The previous next-action text expected the control — it was wrong. Filing a third report
  against production would reach a person: Adrian's call, not taken.
- **Found, not fixed.** (P2, wording) On a broad report the Return paragraph opens "Arrange it
  now" with no control beneath it — Chad's sentence (10d54c5), one string ×5, his word first.
  (P2, design) A broad report's "Message the operator" opens the thread on the FIRST candidate
  travel (`candidateTripNos[0]` in `app/lost.tsx`), one operator of possibly several — harmless
  here (one operator drove all six), wrong in general. (P3) The Spanish first rung "Notificado"
  (known since 16 Sept).
- **Why Chad's 12 Sept report read the fallback line — what is established:** `POST /lost-item`
  existed on the live server on 12 Sept (in `3483a1d`, since `e84e699` of 16 Aug), so the route
  was not missing; the server did not return a case number at filing; the cause is NOT recorded
  (free-tier cold start is the likely one; the runbook's pre-flight asks for Starter). `cdeba05`
  (the server stamps `caseNo` onto the report) IS live in `dcccfe3`.
- **Environment.** iPhone 17 booted, English, on Settings, running the stamped `e8c791a`
  production build (`.expo/simulator-build.json` = e8c791a, dirty=false, bundle sha
  `8ae34b5c…`). Build worktree removed. iPhone 17 Pro shut down (local `8bbb625` build). Local
  backend stopped. The superseded fc01d5b captures live only in the session scratchpad.
- **NOT pushed.** `e8c791a`, `625d003` and this checkpoint are local only — Adrian: no push,
  deploy, TestFlight, merge or PR until he says. `origin/skill/…` = `b2a0dfc`; `origin/main` =
  `dcccfe3`.
- **Not tested.** `e8c791a` on a physical device; an operator's reply appearing in the
  traveler's thread (none has been written); the operator screen's thread with the new query
  (unwalked — needs the Pro with the operator role and an assignment); fr/it/de on screen;
  the "…which a specialist is carrying. Case AR-C-…" line on a live-filed report.

- **Release review run on `a8f9db3` (17 Sept, 21:40–22:45 EDT; Adrian: "run the release review")
  → `docs/RELEASE-REVIEW-a8f9db3.md`.** CONDITIONAL PASS to internal TestFlight testers on four
  conditions (stale `american-rider.expo.app` down; no "LIVE · MIAMI" over a scripted car, or a
  simulation label; the emergency control and the arrived-stage cancel sentence keyed ×5; the
  founders' word on test-mode "charged" wording). P0 ×3: F-01 stale web deployment, F-02 LIVE
  badge over `targetFraction(status)`, F-03 eight red control sites beyond Call 911. P1 ×14
  incl. ≥30 English literals the untranslated checker cannot see (F-04), deletion keeps
  `travelerName` (F-05), 1 of 41 fetches has a timeout (F-06), no crash reporting (F-07), the
  1.3× type cap vs the contract (F-08), random arrival figures (F-19), demo fleet unlabelled
  (F-21), no accessibility roles on shared controls (F-22), operator NAVIGATION over a drawn
  grid (F-23). Gates: 45 PASS · 18 FAIL · 99 NOT TESTED · 2 N/A of 164. Qualitative layer by a
  separate agent (no session context); founders may want a human pass. Nothing pushed.

- **Chad's review of the Safety screen (relayed 17 Sept ~23:05 EDT, on TestFlight 36) →
  `e91a693`, evidence `625d003`-style in the commit after it:** the subtitle states only true
  outcomes (route monitoring's real order: operator, then traveler, then a case); the word of
  the day (shown to the traveler alone — the operator never knew it) is a per-travel code from
  the Travel Number on BOTH phones (`src/verification.ts`; Safety screen while a travel is
  underway, operator pickup screen); "Add a contact" ink; contacts sentence states the outcome;
  Share Travel disabled with a note when no travel is underway, its message keyed; no red on the
  screen ("Emergency Assistance" solid ink, "Contact Patron Support" ghost); English literals
  keyed ×5 on the emergency screen ("Text/Send my location", "Not recorded") and the ride
  screen's $3.00 cancellation sentence. 908 keys ×5; gates green; walked en + es on the stamped
  build. **The walk filed emergency case AR-C-756617** (opening the emergency screen files at
  once) against the seeded AR-2047-MIA with no travel underway — one support email, disregard.
  HELD: telemetry/concierge/escrow/executive-protection names, flight sync, the two-zone
  consolidation (its zones name systems that do not exist). FOUND, NOT FIXED: the emergency
  screen shows the seeded AR-2047-MIA when no travel is underway (P1); the Add-a-contact sheet
  sits under the keyboard (P2). NOT WALKED: the code on screen (needs a travel underway —
  booking on production needs Adrian's word) and the operator's pickup screen.

- **Chad's review of the Invitations screen (relayed 17 Sept ~23:40 EDT, on TestFlight 36) →
  `6a7df7a`, evidence in the commit after it:** the code (generated on the phone, registered
  nowhere, never asked for at sign-up — it identified nobody) is gone with its tinted panel;
  HOW IT WORKS and the 99 % footnote are gone; the screen is the invitation: subtitle, THE
  INVITATION (the sentence as sent: "I travel with American Rider, a national transportation
  service. americanrider.app"), "Send an invitation" → the share sheet. 903 keys ×5 (seven keys
  retired); gates green; walked en + es on the stamped build. HELD: membership/credential/
  delegate/stewardship names (no membership, credential, delegate account or credit exists),
  delegate sub-accounts, a credits ledger. Closes the release review's F-26.

- **The code on both phones (18 Sept, 00:04–00:15 EDT; Adrian: "book a travel and capture the
  code") → `a500f88`:** `44-safety-code-6a7df7a.png` + `45-operator-pickup-code-6a7df7a.png`, the
  addendum at the foot of `CAPTION-safety-e91a693.txt`. Travel AR-2119-MIA, $18.30 on the saved
  test Visa, operator = Adrian's own operator account on the iPhone 17 Pro (In Service after
  acknowledging the insurance disclosure, which was recorded on the account), code 5000 on both
  screens (= `verificationCode('AR-2119-MIA')`), cancelled by the traveler before arrival (fare
  returned). **FOUND (P1): the first attempt, with no operator on duty, ended at "No operator
  matched yet" — the six demonstration records in Firestore `operators` have no presence, the
  phone (and the server) treat them as absent since `11839ce` (29 Aug), and the in-memory
  stand-ins only serve when the collection is EMPTY. So nobody in the test program can book
  unless a real operator is on duty; TestFlight 36 has the same rule. Founder's call: delete the
  six records (then test mode uses the stand-ins as designed) or keep an operator on duty when
  Chad tests. FOUND (P1): the operator is never told the traveler cancelled — a minute after the
  cancellation the Pro still read "Proceed to Pickup" with Confirm Arrival; `OperatorContext.tsx`
  watches no cancellation.** Environment after: the Pro holds the 6a7df7a production build, taken
  off duty and shut down; iPhone 17 on Home, English.

- **Chad's review of the operator page (relayed 18 Sept ~00:20 EDT, on TestFlight 36) →
  `0d2ae7b`, `d0233df`, `146652a`, evidence `b615c37`.** Most of what he saw had left on 5 Sept
  (competitor comparison, cash-out, bonuses, "every fare"); the page has been reachable from no
  control since the 14 Sept menu decision, so it was captured by its address. DONE: the subtitle
  is his directive with the contract's term ("American Rider operates under a 99% travel fare
  retention model for professional operators."); the rows are "99% Travel Fare Retention",
  "Independent Dispatch Autonomy", "Capital Settlement"; "Treated as a professional" removed
  (his point); one LEDGER card, three lines — travel fare 99% to operator, coordination
  commission 1%, platform fee paid by the traveler (the greater of $1.50 and 5%, never from the
  operator's share); "Your Numbers" is the "Net Yield Projection Model"; "Quote ›" in ink. 904
  keys ×5; gates green; walked en + es, stepper pressed and the figures recomputed. HELD:
  "Partnership"/"Partner" (the Terms say independent contractors), "Real-Time Capital Liquidity"
  (Stripe's schedule), "Demand-Based Tariff Adjustments" (no surge exists), a compliance engine,
  sliders and preset ledgers, vehicle standards (OPEN-DECISIONS §0.1), a credentials portal
  (the upload is inside the qualification). FOUND AND FIXED mid-capture: the ledger's label and
  value met with no gap (`146652a`).

- **Chad's review of Operator Qualification + Commercial Insurance (18 Sept afternoon, on
  TestFlight 36) → `4e564fa` + `a332664`, evidence in the commits after them.** The six blocks of insurance
  buying advice moved to a new screen, `app/operator/guidelines.tsx` ("Commercial Coverage
  Guidelines"), reached by a link — nothing deleted, the two cost tiers are the founders' 10 Aug
  decision. The insurance step keeps the expiry date, the certificate-holder requirement in one
  paragraph, the providers, the declarations page. Certificate-holder sentence rewritten (was
  clumsy and passive); "rate drivers under 25" → operators; the qualification banner said "99%
  of every fare" (flagged phrase AND wrong quantity) → "99% of the travel fare"; blue off the
  quote links, the broker's number and the disclosure link. 907 keys ×5; gates green; walked,
  nothing submitted. HELD: "Driver License" (the name of the document Florida issues), "Operator
  Credential Verification", "Provide Document" (one control serves five rows, one not a
  document), a minimum-coverage table (**§627.748(7)'s limits are nowhere verified in this
  repository — get them from counsel and the table is an afternoon**), COI OCR and carrier APIs.
- **Four more on the second pass (`a332664`), after Adrian relayed the review again.** "‹ Back"
  is INK on all nine screens that share it — Chad listed it and it was wrongly held against
  `docs/OPEN-DECISIONS.md` §0.6, which asks exactly that question; **§0.6 IS NOW ANSWERED and
  should be struck.** The qualification screen said "Estimates only — not financial advice"
  with no figure on it, and the insurance step said the same after its figures moved: both now
  state what is true where they stand. "Policy expiry date" → "Policy expiration date".
  "Submit My Policy" → "Submit Declarations Page" (a certificate of insurance is a different
  document; the note above the control already named the declarations page). 908 keys ×5.
- **THE STATUS BAR DEFECT IS FIXED (`5d4afcc`).** Every scrolling screen drew content through
  the clock; Screen's padding is inside contentContainerStyle, so it scrolled away with the
  content. A paper band the height of the top inset now sits above the ScrollView — one
  component, all 53 screens. It had been on the known list since 15 Sept and had been damaging
  every screenshot sent to the founders.
- **EVIDENCE IS NOW THE WHOLE PAGE (`scripts/stitch-screens.swift`, AGENTS.md).** Chad, twice:
  "you are merely pasting it incorrectly, therefore it cuts off" — he was right, a screenshot is
  one phone screen. Overlapping frames are joined by pixel match, and the stitcher refuses
  rather than guesses when two frames do not overlap. **The earlier sets already sent (lost item
  34–36, Safety 37–40 + 44–45, Invitations 41–43) still have the old framing and the status-bar
  collision; re-take them on a current build before Chad sees them again.**

- **Another agent's work, verified on the simulator and kept (18 Sept, 21:00–22:20 EDT).**
  `37ee116` saves that state, tagged `save/before-disclosure-gate` — **the tag is LOCAL ONLY, never pushed; on a fresh clone the revert point is the commit `37ee116`, not the tag.** Notifications: ink toggles,
  switch role and label, text column wraps. Disclosure: three cards became one card with
  expandable rows. Nine strings ×5, including "Invitations" → "Extend Patronage" and "Safety" →
  "Passenger Security" — **both reverse earlier decisions** (no membership or patronage exists;
  "Traveler" is the contract's word, not "passenger"). Flagged to Adrian, not changed.
- **The accordion hid text the statute requires → `850a554`, approved by Adrian ("looks good").**
  One row opened and the rest stayed shut, so an operator could acknowledge §627.748(8)(a)2
  text that never rendered. The screen now tracks which parts were opened. The control stays
  off and reads "Open all 3 parts to continue" until all three are open, then reads "I Have
  Read This"; each opened part keeps a quiet "Read" mark. Two strings ×5, 910 keys. Gates
  green. Walked on a local-server build; three captures in the session scratchpad.
- **TWO GAPS FOUND IN THE SAME REVIEW, NOT FIXED.**
  1. The disclosure is checked in ONE place, `POST /operator/online` (`server.js:673`). Dispatch
     does not check it. An operator already on duty when the version moves keeps receiving
     travel under the old acknowledgement. **This is live: the version was bumped today.**
  2. The operator's qualification state lives in device storage, so a second phone shows no
     operator row in the drawer and cannot reach the operator screens at all. The disclosure
     file's own comment names this pattern as a past defect, fixed for dispatch, not for the
     app's state.

**DELTA CHECKPOINT — 19 Sept 2026, ~11:30 EDT, since `1969348` (the previous checkpoint).**

**NO COMMITS THIS SESSION. No application code changed.** Branch
`skill/american-rider-release-review` @ `1969348`, tree clean, level with origin (0 ahead /
0 behind). `origin/main` still `dcccfe3`. Nothing deployed, no TestFlight build. Every artifact
produced today lives on the Desktop, outside the repository and outside version control.

- **Chad asked to take over the project, then reversed it the same day.** Adrian first asked for
  a complete handover package to send Chad and "be done with him"; Chad then said Adrian should
  keep working on it. The packages were built and remain on the Desktop. **The handover is not in
  effect and no accounts were transferred.**
- **Three deliverables on the Desktop (not in the repo, not version controlled):**
  - `~/Desktop/american-rider-handover.zip` — 4.5 MB, 342 files. `git archive HEAD` minus
    `send/`, plus a new `HANDOVER.md` written for a successor: setup and build commands, the
    NINE accounts that must transfer with their project ids (Firebase `american-rider`, Render
    `american-rider-server`, Stripe, EAS `bf6e7e6a-079d-4d91-bc42-f21732f069cb`, Apple
    `com.americanrider.app` / ASC `6798078543` / team `6Z24V6YD4A`, Resend, Checkr, Anthropic,
    the domain), the TWELVE Render env vars, what to read first, and the money model.
  - `~/Desktop/american-rider-screenshots.zip` — 24.2 MB, 51 screenshots, 18 captions, 1 mp4.
  - `~/Desktop/american-rider-disclosure-demo.mp4` — 11 s at 3x, the disclosure gate walked;
    the "no service account" error tail trimmed off. The raw 180 s capture was overwritten and
    is gone.
- **PERSONAL IDENTIFIERS WERE SCRUBBED FROM THE DESKTOP PACKAGES ONLY. THE REPOSITORY STILL
  CARRIES ALL OF THEM.** Removed in the zips: the name (→ "the founder" / "the founders"),
  `adrianderksmith@gmail.com`, `/Users/adriansmith/…` (→ `/Users/you/…`), `redwolfgaming77`, and
  the founder web demo worker URL. 202 text hits across 37 files.
- **A functional fix exists in the package that is NOT in the repo.** `backend/gate.test.js` and
  `backend/disclosure.test.js` hardcode `const ROOT = '/Users/adriansmith/AmericanRider/backend'`.
  Scrubbing the path would have broken them, so in the package they were changed to
  `const ROOT = __dirname` and both were run there (12/12 and 33/33 passing). **The repo copies
  still hold the absolute home path.** Worth applying to the repo on its own merits.
- **Four screenshots had the name or email burned into the PIXELS; redacted in the Desktop copies
  only.** Found with tesseract OCR over all 51, boxes drawn with ffmpeg in the app's own
  background colour, then all 51 re-scanned clean: `7-menu` (drawer header), `8-account-details`
  (name ×2 + email), `32-support-case-filed` (email), `45-operator-pickup-code` (name). The 18
  captions were scrubbed too. **The repo's `send/` copies are NOT redacted and still show the
  name.** OCR is good, not perfect; very small or low-contrast text could have been missed.
- **Launch today is not possible. A message for Chad was drafted and NOT sent** (no channel to
  him from here). Its four points: build 37 cannot be cut until Chad ticks Sign In with Apple;
  App Store review is days not hours; Render still serves the pre-9-Sept build; the release
  review's launch blockers are open.
- **TESTS WERE NOT RUN THIS SESSION.** The last full run was at `850a554` (18 Sept 2026): tsc
  clean · 910 keys ×5, no untranslated, no unused · backend lint clean · 23 test files passing.
  Nothing in the repo has changed since, so those results still describe `1969348` — but they
  were **not re-verified today** and should be treated as dated, not current.

**Exact next action (19 Sept 2026).**

1. **Chad ticks Sign In with Apple on `com.americanrider.app`** at developer.apple.com →
   Identifiers. Nothing from 17–18 Sept reaches him until this happens: build 37 failed at
   signing for exactly this and spent one EAS credit (13 of 15 left, reset 1 Oct). Message
   drafted 19 Sept, not sent.
2. **Adrian pushes `main` so Render deploys.** `origin/main` is `dcccfe3`. **CORRECTED 19 Sept
   12:55 EDT — this step named four things and three of them were already live.** The 5 % fee
   wording, the payment-method routes and `GET /support/cases` went out on 16 Sept in
   `3483a1d..d2cccc7`, and `d2cccc7` is an ancestor of `dcccfe3`; the same file verifies it at
   "THE BACKEND IS DEPLOYED" above. What is genuinely undeployed is the disclosure
   version `2026-09-18.1` and everything else in the 43 commits since `dcccfe3`. **The version bump asks every operator who acknowledged
   `2026-08-29.1` to read it again — done deliberately while that is a handful of test accounts,
   and far cheaper now than after the operator program opens on 28 Sept.**
3. **TestFlight 37** from the branch head once step 1 is done, then `npm run parity`.
4. **Consider applying the `__dirname` test fix** (above) to the repo.

**Carried forward, still open.**

- **Two disclosure gaps found 18 Sept, not fixed.** (a) The disclosure is checked in ONE place,
  `POST /operator/online` (`server.js:673`); dispatch does not check it, so an operator already
  on duty when the version moves keeps receiving travel under the old acknowledgement.
  **CORRECTED 19 Sept 12:55 EDT: NOT live. The bump is committed, not deployed — `origin/main`
  still serves `2026-08-29.1`, verified with `git grep DISCLOSURE_VERSION dcccfe3`. The defect
  is real in the code and becomes live the moment `main` moves.** (b) Operator qualification state lives in device
  storage, so a second phone shows no operator row in the drawer and cannot reach the operator
  screens at all.
- **Two renames that reverse earlier decisions, kept but flagged to Adrian, never settled:**
  "Invitations" → "Extend Patronage" and "Safety" → "Passenger Security". No membership or
  patronage exists, and "Traveler" is the contract's word, not "passenger".
- **Release review `docs/RELEASE-REVIEW-a8f9db3.md`, conditions still open:** the stale
  `american-rider.expo.app` deployment quoting the old fee (Adrian's to take down); the
  "LIVE · MIAMI" badge over a scripted position; the remaining English literals on the
  live-travel path (`STATUS_LABELS`, step labels — the emergency control is now keyed); the
  founders' word on test-mode "charged" wording.
- **Found 18 Sept, not fixed:** the emergency screen shows the seeded `AR-2047-MIA` when no
  travel is underway and files against it (P1); the Add-a-contact sheet sits under the keyboard
  (P2); the broad lost-item report's "Arrange it now" paragraph with no control beneath it
  (P2, Chad's own sentence — his word first).
- **Evidence sets already sent to Chad still carry the OLD framing and the status-bar collision**
  (lost item 34–36, Safety 37–40 + 44–45, Invitations 41–43). Re-take on a current build before
  he sees them again.
- **Needs counsel, not code:** Florida §627.748(7)'s coverage limits are nowhere verified in this
  repository. Chad asked for a minimum-coverage table; it cannot be drawn until the limits are
  confirmed. Once they are, the table is an afternoon.
- **`docs/OPEN-DECISIONS.md` §0.6 is ANSWERED** (the shared `BackLink` is ink, Chad 18 Sept) and
  was struck. The rest of §0 stands.

---

## FINAL TRANSITION CHECKPOINT — 19 Sept 2026, 12:55 EDT. THE PROJECT MOVES TO OpenCode HERE.

**This is the last entry written by this agent. Everything below §0 is older than this block.
Where they disagree, this wins.**

### Git state, verified at 12:55 EDT

| | |
|---|---|
| Branch | `skill/american-rider-release-review` |
| HEAD | `15ae931` — "The notifications screen is named for dispatch, and says which channel carries what" |
| Working tree | clean apart from this file, which is committed as the last act of the session |
| Ahead of `origin/skill/american-rider-release-review` | 1 commit (`15ae931`) — **NOT pushed** |
| Ahead of `origin/main` | 43 commits |
| `origin/main` | `dcccfe3` (16 Sept 21:53 EDT) — unchanged all session |
| Stashes | none |
| Worktrees | one, the repository itself |
| Local tags | `design-baseline-2026-09-09`, `save/before-disclosure-gate` (`37ee116`) — **both LOCAL ONLY, `git ls-remote --tags origin` returns nothing** |

Nothing was pushed, merged or deployed this session. No TestFlight build was cut. No EAS credit
was spent (13 of 15 remain, reset 1 Oct).

### What this session did

Two things, in order.

**1. Audited the 11:30 checkpoint against Git and found three false statements.** All three are
corrected in place above, each marked `CORRECTED 19 Sept 12:55 EDT`. In summary: the backend
deploy of 16 Sept DID happen (`3483a1d..d2cccc7`, and `d2cccc7` is an ancestor of `dcccfe3`), so
the 5 % fee wording, the payment-method routes and `GET /support/cases` are live and have been
since 16 Sept 21:06; the disclosure gap (a) is NOT live, because the version bump is committed
and not deployed; and the "tree clean" line described a tree that held this file uncommitted.

**2. Answered Chad's design review of screen 27, Notifications.** Adrian relayed it at ~12:20
EDT with the standing instruction. Committed as `15ae931`.

### Files changed this session

`15ae931` — seven files, +62 / −46:

| File | Change |
|---|---|
| `src/i18n/en.ts` `es.ts` `fr.ts` `it.ts` `de.ts` | 9 strings rewritten per Chad's §4 blueprint, 1 new key `traveler.notifChannels`. 910 → **911 keys** |
| `app/notifications.tsx` | renders `traveler.notifChannels` beneath the always-sent footer, with the comment explaining which channel carries what |
| `app/settings.tsx` | the Notifications row carries the screen's new name and flexes/wraps (`rowTitleWrap`) so the chevron holds its place in French |

This file, `CURRENT_HANDOFF.md`, is the only other change and is committed separately.

**No backend file, no server route, no data model and no dependency was touched.**

### Decisions made this session

1. **Chad's §4 "Recommended Layout & Best-Practice Blueprint" is the authoritative spec, not his
   §1 corrections.** His review gave two different strings for the subtext. §4 is the one he
   labels the blueprint, so §4 was implemented verbatim for the screen title, the subtext, the
   three item titles and the three item subtitles.
2. **The emailed receipt is stated as ungoverned by these preferences, because it is.**
   `backend/server.js:1225` sends it on settlement and checks NO preference. The old subtitle
   ("American Rider sends your receipt after each travel") implied the toggle controlled it. The
   toggle controls the push and only the push. This was the one substantive defect in the screen
   and Chad's "multi-channel clarity" point is what exposed it.
3. **Only the two channels that exist are named** — Expo push (`backend/push.js`) and Resend
   email (`backend/email.js`). Chad asked for SMS channel selectors; there is no SMS path, and a
   control for a channel that does not exist is the defect the offers row was deleted for.
4. **The always-sent footer keeps the scheduled-travel fact Chad's wording dropped.** An
   unfillable reservation is always reported and is not a safety check-in.
5. **The Settings row was renamed to match the screen it opens**, because AGENTS.md forbids
   naming a control after something other than what it does.
6. **German reads "Disposition und Mitteilungen"** — the literal compound was unusable. This is
   the one place the five languages are not a literal rendering of each other.

### Held, not built, with reasons (all four are Chad's, all four are his call to overrule)

- **Notification Profiles** (his Jobs note) — the three row ids ARE the preference keys
  `backend/push.js` reads. A profile layer is a server contract, not copy.
- **SMS / per-channel selectors** — no SMS infrastructure exists. See decision 3.
- **Folding the screen into Settings** (his Ford note) — it is already in Settings, one tap.
  Inlining three toggles and two footers pushes Delete Account down, and Apple requires that no
  harder to find than Sign Out (5.1.1(v)).
- **Quiet hours / Executive Mode** — needs a rule for what it may never suppress. Safety
  check-ins, unfillable scheduled travel, travel assigned to an operator on duty and the two
  screening notices are all non-refusable by design in `KINDS` in `backend/push.js`.

### Verified this session, and how

- `npx tsc --noEmit` — clean.
- `npm run i18n` — **911 keys × 5 languages**, no untranslated user-visible string, no unused key.
- `cd backend && npm run lint` — clean. `npm test` — **23 test files, 0 FAIL**.
- Layout MEASURED, not looked at, per AGENTS.md: the app rendered at `localhost:8081` and
  inspected with `getBoundingClientRect` + `getComputedStyle` at 390 × 844 in **English, French
  and German**. Results: no horizontal overflow in any of the three; the three toggle tracks are
  `rgb(20,23,31)` = `colors.ink` at 46 × 28 radius 999; the Settings chevron holds x 337.1→345
  in English (title one line) and in French (title two lines).

### NOT verified — the next agent must do this before Chad sees anything

- **Nothing has been seen on the iOS simulator.** No build was run this session. The web preview
  lays the screen out but the AuthScreen gate covers it, so there is **no image of screen 27 in
  its new state**, in any language.
- **No caption was written and nothing was placed in `send/`.** Deliberate: the protocol forbids
  a caption sentence about a state that was not walked on the named build.
- Not tested this session: physical device, Android, 320 pt, enlarged type, a real push
  delivered, the emailed receipt against the new wording.

### Known issues, risks and blockers carried into the transition

**Blockers (not code):**

1. **Chad must tick Sign In with Apple on `com.americanrider.app`** at developer.apple.com →
   Identifiers. Build 37 failed at signing for exactly this and spent one EAS credit. Nothing
   from 17–19 Sept reaches Chad until this is done. A message was drafted 19 Sept and never sent
   — there is no channel to Chad from this machine.
2. **`origin/main` must move for the disclosure version to deploy.** Fast-forward is possible and
   verified. The bump re-asks every operator who acknowledged `2026-08-29.1` to read it again,
   which is deliberate while that is a handful of test accounts and far cheaper than after the
   operator program opens on 28 Sept.
3. **Florida §627.748(7) coverage limits are nowhere verified in this repository.** Chad's
   minimum-coverage table cannot be drawn until counsel confirms them.

**P1:** the emergency screen shows the seeded `AR-2047-MIA` when no travel is underway and files
a case against it (found 18 Sept, not fixed).

**P2:** the Add-a-contact sheet sits under the keyboard; the broad lost-item report's "Arrange it
now" paragraph has no control beneath it (Chad's own sentence, his word first); French operator
strings say "course" ×8 in `src/i18n/fr.ts`; Home's SUGGESTED TRAVEL estimate is not computed
from the current departure; content scrolls under the status bar; six red controls beyond Call
911 (SAFE-02).

**Architectural, unfixed:** the disclosure is checked in ONE place, `POST /operator/online`
(`backend/server.js:673`); dispatch does not check it. Operator qualification state lives in
device storage (`docs/OPEN-DECISIONS.md` §4), so a second phone shows no operator row at all.

**Unsettled renames, kept and flagged, never answered by a founder:** "Invitations" → "Extend
Patronage" and "Safety" → "Passenger Security". No membership or patronage exists, and
"Traveler" is the contract's word, not "passenger". **New, same shape:** Chad's screen-27
vocabulary ("Transit Departure Advisories", "Arrival & Stationing Alerts") is a stiffer register
than the traveler voice AGENTS.md describes as "plain English, precisely used". It was
implemented because a founder asked for it in writing. Recorded as `docs/OPEN-DECISIONS.md`
§0.10 for a founder's word.

**Release review `docs/RELEASE-REVIEW-a8f9db3.md`, conditions still open:** the stale
`american-rider.expo.app` deployment quoting the old fee against the live server (Adrian's to
take down in the Expo dashboard); the "LIVE · MIAMI" badge over a scripted position; the
remaining English literals on the live-travel path (`STATUS_LABELS`, step labels); the founders'
word on test-mode "charged" wording.

**Evidence risk:** every evidence set Chad already holds predates `37ee116`. His screen-27
review was written against a build in which the toggles were still green and the sublines still
fragments — both had been fixed hours earlier. Re-take every capture on a current build before
he sees them again: lost item 34–36, Safety 37–40 + 44–45, Invitations 41–43.

### Exact next recommended action

**`git push origin skill/american-rider-release-review`** — one commit, `15ae931`, plus the
handoff commit. It is the only unpushed work and the branch is otherwise level with origin.
Adrian's word is needed; this agent was told not to push.

Then, in order: (1) Chad ticks Sign In with Apple; (2) Adrian pushes `main` so Render takes the
disclosure version; (3) build the simulator with `scripts/build-simulator.sh`, walk screen 27 in
English and French, stitch the captures with `scripts/stitch-screens.swift` and write the caption
— screen 27 is implemented and gate-verified but has never been seen running; (4) TestFlight 37,
then `npm run parity`.

### What the next coding agent needs to know before continuing

1. **Read `AGENTS.md` first, then this file, then `docs/OPEN-DECISIONS.md` §0.** `AGENTS.md`
   carries the permanent rules and is not optional — the rubric in it is the acceptance test for
   every screen and every string.
2. **The per-session memory at `~/.claude/projects/-Users-adriansmith-AmericanRider/memory/`
   DOES NOT TRANSFER to OpenCode.** Fifteen files live there, including the review protocol, the
   platform-fee history and the founders' working styles. Everything load-bearing has been
   written into the repository, but if something reads as unexplained, that directory is where
   the explanation is.
3. **`npm run check` is the one command** — typecheck, the three i18n gates, backend tests. The
   backend lint is separate and is NOT optional: `cd backend && npm run lint`. It has caught two
   shipped ReferenceErrors that 195 passing tests did not.
4. **Anything built at import time stores KEYS, not sentences** — `ROWS` in
   `app/notifications.tsx` is the pattern. The render site calls `t()`.
5. **Do not judge a screen by a screenshot.** Render at `localhost:8081`, set 390 × 844, and diff
   `getComputedStyle` / `getBoundingClientRect`. `docs/EXACTNESS-SWEEP.md` has the recipe.
6. **`backend/gate.test.js` and `backend/disclosure.test.js` still hardcode
   `const ROOT = '/Users/adriansmith/AmericanRider/backend'`.** They break on any other machine
   or path. The fix is `const ROOT = __dirname`; it was proven in the Desktop handover package
   (12/12 and 33/33 passing there) and was never applied to the repo. **This is the single
   cheapest thing the next agent can do, and it matters more now that the project is moving.**
7. **Three handover artefacts sit on the Desktop, outside the repository and outside version
   control**, built 19 Sept for a handover that Chad then reversed:
   `~/Desktop/american-rider-handover.zip` (4.5 MB, 342 files, includes a `HANDOVER.md` naming
   the nine accounts and twelve Render env vars), `~/Desktop/american-rider-screenshots.zip`
   (24.2 MB), `~/Desktop/american-rider-disclosure-demo.mp4`. **They were built at `1969348` and
   are now one commit stale.** Personal identifiers were scrubbed from those packages ONLY — the
   repository still carries all of them, and `send/` still holds four screenshots with the
   founder's name or email burned into the pixels.
8. **No server is left running.** The Metro/web dev server used for the 390 × 844 measurements
   was stopped before this checkpoint was committed.
9. **Do not re-add the AI planner link to Home** (`app/plan.tsx` is in the tree with no entry
   point, withdrawn 4 Sept) and **do not reinstate the no-blue rule** (reversed 11 Aug).

**DEPLOYED AND PUSHED — 19 Sept 2026, 14:38–14:52 EDT. Adrian ran both pushes himself.**

`git push origin skill/american-rider-release-review` (`1969348..918139a`), then
`git push origin skill/american-rider-release-review:main` (`dcccfe3..918139a`). Render
auto-deployed and `/health` reported `commit: 918139a` at 14:52:19.

VERIFIED on the live server after the deploy: `ok: true` - stripe test - assistant withdrawn -
webhook on - receipts on - documents on - regions `fl-southeast` - **`insuranceDisclosure` is
now `2026-09-18.1`** - `/payment-methods` and `/support/cases` 401 unauthenticated. The new
About page is live: its seven sections are Platform governance, What a traveler pays, How
payment is settled, Operator framework, Qualification and coverage, Patron standards, Contact,
and the fee rule ("whichever is greater") is on it.

Two readings that are NOT regressions, checked because they looked like ones. `GET /lost-item`
answers 404 because the route is `app.post` (`server.js:1257`); it is not an auth hole. `fleet`
reads 6 operators / 5 available / **0 dispatchable** — that is `presenceStale` on seeded demo
operators nobody is running, not the disclosure bump, which is not in that filter. The 16 Sept
checkpoint recorded 6/6/0 before any of this.

**THE DISCLOSURE GAP IS NOW LIVE, exactly as the 19 Sept checkpoint predicted.** The version
moved, and `disclosureCurrent()` is still called in one place only, `POST /operator/online`
(`server.js:673`). Dispatch does not check it, so an operator already on duty keeps receiving
travel under the old acknowledgement. This was cheap to accept while the operator program is a
handful of test accounts; it stops being cheap on 28 Sept.

**Four screen reviews answered today, each with evidence in `send/`:** Notifications
(`15ae931`, screens 54–57), Settings (`9a1ef51`, 58–61), Account Termination (`a1c7028`,
62–66), the public About page (`fb901be`/`918139a`, 67). Gates at `918139a`: tsc clean - 919
keys x 5, no untranslated, no unused - backend lint clean - 23 test files, 0 FAIL.

**Two defects found by taking Chad's reviews seriously, neither reported by him.** The emailed
receipt was sent on settlement without checking the "Travel complete" preference, so a traveler
who turned it off still received it. And four strings on the termination screen were English in
all five languages, including the two card headings and the final confirm control, which was
also only VISUALLY disabled — no `disabled` prop, so VoiceOver announced it as available and a
tap went nowhere.

**Still the only thing between here and TestFlight 38: Chad ticking Sign In with Apple** on
`com.americanrider.app` (developer.apple.com → Identifiers). `app.json:31` declares
`usesAppleSignIn: true`; the stored provisioning profile predates it, which is what failed
build 37 at signing. 13 of 15 EAS credits left, reset 1 Oct. Once ticked, the build runs
without him: `eas build -p ios --profile production --non-interactive --no-wait`, then
`eas submit -p ios --latest`. The runbook also says to move Render to Starter (~$7/mo) the same
day, so a cold start does not make the app look broken to an unsupervised tester.

---

## CHECKPOINT — 19 September 2026, 21:45 EDT. TestFlight 39 submitted.

**Branch `skill/american-rider-release-review` at `795cbf0`. `origin/main` is the same commit.
Render is on `795cbf0`, verified. TestFlight 39 built from `795cbf0` and submitted to Apple.
For the first time, all three carry the same code.**

Twenty commits since build 38 (`c5df3ef`), which is what Chad had been reviewing all day.

### Six defects found by sweeping under the screens, all fixed

None of these was visible in any screenshot, which is why the screen reviews never surfaced them.

| | |
|---|---|
| `7d6e218` | The traveler's fare had no Stripe idempotency key. Every other charge did. A double-tap on Confirm Travel created a second live PaymentIntent for the same journey. |
| `6f5a058` | `/scheduled/sweep` is open by design, and its response carried `centsPaid`, waiting travels and — when non-empty — `emergencies`, `cases`, `stranded` and `dispatched`, with Travel Numbers in them. Confirmed against production with curl before changing it. |
| `b6854c8` | `users/{uid}` allowed the signed-in person to write every field, including `screening` (whether they may carry passengers), `insuranceDisclosure` (the statutory acknowledgement) and `stripeAccountId` (where their money goes). A gate that reads a value the gated party can write is not a gate. |
| `08c0d89` | The disclosure was checked only at `POST /operator/online`. An operator already on duty when the version moved kept taking travel under the old one. Latent until 14:52 today, when the bump deployed. |
| `61de90d`, `1c7b6de` | **F-A.** The phone read the whole fleet, chose its own operator and wrote the assignment; the rules checked only that the traveler was themselves. So screening, insurance and disclosure guarded the re-offer sweep and scheduled travel and never an ordinary booking. |
| `7d6e218` | Two test files hardcoded an absolute home path and could only run on this machine. |

**F-A is closed in code and NOT yet in the rules.** `allow create: if false` on rides and
`allow read: if false` on operators are committed but **not deployed** — that waits until a
travel has actually gone through `POST /travel/dispatch`. Deploying first would break booking
for whatever build is live. `rules.test.js` walks every .ts/.tsx under src/ and app/ and fails
if any file creates a travel or reads the fleet, so the precondition is checkable rather than
believed.

### Chad's eight directives

1. **"American" on the home screen** — done. It was the literal string "American R." typed into
   app.json, not an OS truncation. Android has no `label` key and still reads "American Rider"
   from `expo.name`; flagged, not guessed at.
2. **Twilio Verify** — server half built, switched off, tested. **The recommendation is to not
   buy it yet:** the traveler's `mobile` field is written at sign-up and read by NOTHING. If the
   number is to be load-bearing, the wiring is the work and verification is the small part.
   Stripe already covers operator tax identity; Twilio has no role there.
3. **Apple and Google sign-in** — both configured and both buttons render. Google verified to
   Google's own sign-in page on the simulator. **Apple can only be proven on a phone** — the
   simulator build strips the entitlement on purpose.
4. **Red** — kept on failure messages, capped to two controls: Call 911 and the final
   "Yes, delete". Five controls went to ink. No hex value changed.
5. **Cormorant Garamond** — built app-wide and on the web, then **reverted in full on his word**
   (`795cbf0`). Every typography-bearing file diffs to ZERO differences against `c5df3ef`, and
   no reference to the family survives anywhere. It never reached a tester.
6. **Deployment sequence** — followed. Backend deployed before cutting 39, because build 39's
   client calls `/travel/return-operator` and the live server answered 404.
7. **Retire american-rider.expo.app** — Adrian's; no CLI exists for it.
8. **Field test** — pending, and see the blocker below.

### Three things that only appeared by running the work

- **A crash on the sign-in screen**, introduced the moment Google was configured. The
  configured-flag was `!!(ios || web)`, so the control rendered on web where the hook requires
  `webClientId` and throws — inside render, blanking the whole screen (`90143af`).
- **Google refused our redirect.** We forced `americanrider://`; a Google iOS client only
  accepts the scheme derived from its own id. `Error 400: invalid_request`, and nothing was
  registered to receive a callback either (`3e4d139`). **This was flagged as the one thing a
  simulator could not answer. It answered it in four seconds.**
- **The keyboard covered the field being typed into** (Chad). One branch of the shared `Screen`
  returned a bare View — no scroll, nothing that could move. The same branch serves account
  termination and the Add-a-contact sheet: one container, one fault, three reports (`6a95446`).

### The blocker on the field test, and it is not ours

**Production reports 6 operators, 5 available, 0 DISPATCHABLE.** `PRESENCE_STALE_MS` is five
minutes and the seeded fleet last checked in long ago. This predates everything above — the old
client-side matcher applied the same filter, so booking in production has been answering "no
operator matched" for anyone who tried it. **A successful dispatch needs a real operator to go
on duty**, which also exercises the disclosure gate. Arrange that before the field test rather
than discovering it during.

### Next actions, in order

1. `eas submit -p ios --latest` — running at the time of writing.
2. `npm run parity` once Apple finishes — all three rows should read `795cbf0`.
3. Field test on a physical phone: both sign-in buttons, push, and Book → Pay → Dispatch →
   Complete. An operator must be on duty first.
4. **Then** `firebase deploy --only firestore:rules`. Last, after the proof.

### Smaller, still open

- The Google consent screen shows a personal Gmail as the support email. One line on Google's
  own sheet, nowhere in the product, changeable without a rebuild.
- `americanrider.app` is missing from Firebase's authorized domains.
- `american-rider.expo.app` still serves the superseded fee.
- Chad's `.p8` is unused today — Firebase needs no key for native iOS — but Apple requires token
  revocation on account deletion, and that will need it. Keep it.

## ADDENDUM — 19/20 September 2026, after the checkpoint above. Build 40, and one more fix.

The checkpoint above stopped at "build 39 submitted". Three things happened after it, and none
of them were written down until now.

**Build 39 was rejected by Apple, ITMS-90189 — redundant binary.** Build number 39 had already
been used. Nothing was wrong with the build.

**Build 40 is the same app with a new number.** VERIFIED against EAS: build 40 is commit
`584756a`, finished 19 Sept 22:00:13, fingerprint `53c946cd92d831a82dfd65eff988fc76216fef8c`
— **identical to build 39's fingerprint**, and `584756a` is the docs-only handoff commit on top
of build 39's `795cbf0`. So builds 39 and 40 contain the same application code. Whether 40
reached App Store Connect is NOT VERIFIED: the installed eas-cli has no `submit:list`.

**`2eec9b5` — the emergency screen stops naming a journey nobody took.** A P1 on the known list
since 18 September. With no travel underway the safety screen printed `AR-2047-MIA`, the seeded
demonstration journey, and `alertEmergency` filed the case against it. The rule was already
written on that screen — the comment above the facts says NOTHING IS INVENTED ON THIS SCREEN,
and the operator, vehicle and plate had all been fixed under it. The travel number had not.
RideContext's `openHelp` was given exactly this guard on 15 September for the support path; the
same fault on the emergency screen outlived it by four days, on the one screen where it matters
most. Two files: `app/emergency.tsx`, `src/backend/support.ts`. Pushed to
`origin/skill/american-rider-release-review` on 20 Sept. **It is in NO build.** Builds 39 and 40
both predate it.

**State after this addendum (VERIFIED).** Branch `skill/american-rider-release-review` at
`2eec9b5`, level with its remote. Tree clean, nothing untracked. **`origin/main` is still
`795cbf0`, two commits behind** — `584756a` (docs) and `2eec9b5` (client). Render therefore runs
`795cbf0`, which is correct: neither commit touches `backend/`. A push to `main` is a Render
deploy and is Adrian's to run.

### Chad's four questions, answered 19 Sept — `send/ANSWERS-TO-CHADS-FOUR-QUESTIONS.txt`

Every figure recomputed against the code rather than recalled. Four corrections to what this
file and the sweep record previously said:

1. **The field test never needed a vehicle.** Going on duty is a position and a timestamp;
   the operator side is already eighteen screens in this same app. Two simulators and two
   accounts run the whole chain. What is needed first is ours to do: a Stripe account cleared
   for payouts (test mode), the disclosure acknowledged at the current version, an insurance
   expiry on file, a position. Only **Sign in with Apple, push and Apple Pay** need a physical
   phone, because the simulator build strips those entitlements. The checkpoint above framed
   this as blocked on a real operator in a car. It is not.
2. **`site/index.html:244` is NOT stale.** §2 of this file lists it among surfaces "still
   stating older rules". The line reads "$16.47 … plus the $1.50 platform fee", and $1.50 IS
   the fee at a $16.47 fare (5% would be $0.83). Verified live: `americanrider.app` states the
   5% rule in full, and its calculator runs the server's own arithmetic. **The website was
   edited and needs nothing.** What is still wrong is `american-rider.expo.app` — checked
   19 Sept, HTTP 200, still bundle `entry-110f5389…` — and that is a whole web export of the
   app, not a page, which is why the answer is taking it down rather than editing it.
3. **The card break-evens, computed against `backend/payments.js`.** If the fee were a flat
   $1.50 it stops covering Stripe above a fare of **$60.56 domestic** (2.9% + $0.30) and
   **$33.27 international** (4.4% + $0.30). Chad recalled $50 and $30. Under the shipped rule
   the thinnest margin over every fare $1–$500 is **$0.58 domestic and $0.10 international, both
   at a $29.99 fare**, and no fare loses money on either card type. The rule cannot branch on
   card country: the traveler is quoted one price before choosing a payment method, and Stripe
   reports the country only after the charge. Leaving $1.50 in place to $30 — below both
   break-evens — is what makes a single card-agnostic rule safe.
4. **Competitor pricing WAS verified, on 9 Sept, in `docs/ECONOMICS-AND-INFRASTRUCTURE.md` §3.**
   Brickell→MIA $17.97 all-in against a $25 UberX average; MIA→South Beach $26.89 against $28;
   operator keeps 91–93% of what the traveler pays against Uber's 55–70%. This was about to be
   answered "not verified" from memory. The run-book had it. `check-repo-docs-first` again.

### Next actions, in order — REPLACES the list above

1. **Two-simulator end-to-end test** — operator on duty, travel dispatched through
   `POST /travel/dispatch`, paid, completed. No vehicle, no field trip.
2. **Then** `firebase deploy --only firestore:rules` — the last step of F-A.
3. Physical phone, about ten minutes: Sign in with Apple, push, Apple Pay.
4. A build carrying `2eec9b5`, whenever the next one is cut. Builds 39 and 40 do not have it.
5. Adrian: `git push origin skill/american-rider-release-review:main` (Render deploy, no
   backend change in either commit); take down `american-rider.expo.app`.

## ADDENDUM 2 — 20 September 2026. Chad's consolidated configuration, and a fare model restored.

Commits `0424e9f`, `5a2ba76`, `ff47cfd`, `95cf498`, `b188339`, `ae4f6a9`, `d348812`, `20f676a`.
Gates at each: `npm run check` exit 0, 30 test files, 0 failing assertions, backend lint clean,
five languages (931 keys), nothing untranslated or unused.

### The fare model was wrong in production and had been since it was written

`backend/fares.js` charged **$3.00 + $1.80/mile, no time term, $9.00 minimum**. The agreed model
— `docs/FARE-MODEL.md`, Chad's 10 July consolidation — is **$2.00 + $0.85/mile + $0.20/minute**.
The doc had flagged the divergence as an open P1 since 15 Sept and it shipped anyway, through
TestFlight 40.

Chad's verified route settled it. Miami to MIA, 5.04 road miles, 15 minutes: UberX $9.15, Lyft
$11.98, the shipped model **$12.07 — above both**, the agreed model **$9.28**. Restored, and
`faremodel.test.js` pins the $9.28 to the cent. **Nothing had ever asserted what a mile costs**,
which is why a two-month drift reached a TestFlight build.

**The time term has no source of minutes.** No street router is configured (`/health` reports the
planner unreachable), so minutes are derived from distance by a speed that rises with distance —
continuous, 15 mph on a one-mile crawl to an asymptote of 38, calibrated so the benchmark route
resolves to exactly 15.0 minutes. **It is a bridge: derived minutes cannot respond to traffic,
which is the entire reason the term exists.** Setting `OSRM_URL` switches every quote to measured
distance AND duration, retires the circuity factor, and supplies toll amounts. **It is now the
highest-value infrastructure outstanding.**

**Every named destination was repriced** — 29 server entries and every `PLACES` row, journey times
included. A table that disagrees with the formula is a second fare model.

### The minimum: two instructions conflict, and the choice is in the open

"Lowest total travel cost is $5" and "$6.00 minimum" cannot both hold — a $6.00 floor on the FARE
puts the lowest total at $7.50. **$5.00 is implemented**, on Chad's own competitive argument (he
puts Uber's Miami minimum at $6.09 and called our old $9.00 "meaningfully above both"). One
constant in `backend/fares.js` reverses it. **Unresolved; a founder should confirm.**

### Two fee schedules, and the tier tables that could not ship

Chad specified tiered fee tables keyed on the TOTAL. Run against every fare they have three
faults: they **lose money from $135 to about $300** on both card types (worst −$0.22); the fee is
**ambiguous at 492 domestic and 965 international fares** and undefined at 30, because a tier
keyed on a total that contains the fee is a fixed point; and they **reintroduce the price step**.
Built instead, same intent: **domestic = greater of $1.50 or 2.5% of fare; international = greater
of $1.50 or 5%**, keyed on the FARE, continuous. Zero losing fares, thinnest $0.007 domestic at
$59.99 and $0.10 international at $29.99 — and that is now a test.

**The card country is read from the traveler's SAVED DEFAULT card before quoting.** A correction
worth recording: the earlier claim that "Stripe only tells us the country after the charge" is
**false** — Chad was right. `card.country` is readable before any charge. The real constraint is
our own sequencing: on a FIRST travel no card exists when the price must be shown. Since
`setup_future_usage` already saves the card, every travel after the first is classified
correctly; the first is quoted domestic and the difference absorbed (under $1 at the longest fare
in the table, once per traveler).

**The fee formula is no longer quoted at the traveler anywhere** — Terms, About, website, operator
ledger note, all five languages. `legal.test.js` used to REQUIRE the formula verbatim; it now
forbids it, because there are two schedules and a page naming one is wrong for half its readers.

### Tolls, airport fees, insurance

**Tolls** are a third kind of money: traveler pays, **operator reimbursed whole on top of the
99%**, no commission taken, platform take provably identical with and without. The amount comes
from the router, so it is zero until the router is up — the money path is built and proved now.

**Airport and port fees were already built exactly as specified** ($2.00, pickup only, named
payee, geofenced, pass-through, itemised). Nothing needed building. **NOT DONE: Chad's sequencing
instruction** — launch without airport service means declining MIA/PortMiami pickups until the
permit exists, or we quote a fee we cannot remit for a pickup operators may not legally make.
**This is the top of the list.**

**The insurance licence number we were given does not exist.** `L084885` returns "No Licensee
found" at licenseesearch.fldfs.com; the real record is **`L084884` — GARZOR INSURANCE LLC**
(LLC, not "Inc."; the state holds no record at the Thorpe Road address given). Corrected in
`src/data.ts`. The screen invites operators to verify the licence themselves, so publishing the
number as supplied would have handed every one of them a number the state denies.

### Seventeen assertions had been failing and nothing re-ran them

The 18 Sept disclosure gate (`08c0d89`) refuses any operator record without a current
`disclosureVersion`. **The gate is right and was left alone** — an attempt to soften it was caught
by `dispatchgate.test.js`, which pins "absence is not agreement". The fixtures were stale. But the
same fact **very likely explains production's "6 operators, 5 available, 0 dispatchable"**: those
records predate the field. It had also silently disabled the re-offer sweep and scheduled travel.

### Status questions, answered from the code

**Dynamic Island / Live Activity: built and IN TestFlight 40** (`expo-widgets` in app.json at
`584756a`; RideContext drives start/update/end). **Notifications: built and in build 40**;
delivery unproven because APNs does not reach a simulator. **Sounds: yes** — `shouldPlaySound`,
`sound: 'default'`, Android channel importance; no custom sound file, which is an asset decision.
**Twilio: built, tested, off** (`phoneVerification: "off"` live); recommendation unchanged — the
`mobile` field is still read by nothing.

### Blocked, and whose they are

- **`american-rider.expo.app` is still up (HTTP 200).** The earlier claim that no CLI exists was
  wrong — `eas deploy:delete` does. But there is **no alias** by that name (the delete was tried
  and refused: "No hosting deployment alias with the name 'american-rider' exists"), so the URL is
  the dev-domain production deployment. `npx eas deploy:delete` with no argument should offer a
  picker. **It is permanent, unlike the alias route.** Adrian's.
- **The two-simulator end-to-end test needs Firebase Admin credentials**, which are not on this
  machine, or it writes real records to production. Adrian's call; not taken quietly.
- **Render has not picked up `d333aaa`.** It still reports `795cbf0` hours later, so auto-deploy
  is off or it failed. **None of today's pricing reaches anybody until that is looked at.**
- **Stripe must be set to settle exclusively in USD** with no multi-currency presentment, or an
  international card can carry a further 1% the schedules do not account for. Dashboard, not code.

## 1. Objective and the task in progress

**Objective (unchanged):** a release candidate with zero open P0s, cut as ONE commit for
TestFlight, the web app and the backend, with a physical-device pass, for the operator test
program on **28 September 2026** and public launch on **Monday 19 October 2026**.

**Task in progress:** answering Chad's screen-by-screen reviews with evidence. Adrian relays
each review with "Read instructions thoroughly, execute them exactly as specified, and verify
every update yourself before sending it back. I expect total compliance with specs." The
working rule that held all session: implement everything the app can say truthfully within the
locked visual system; hold only what is untrue, not built, or fails Chad's own rubric from the
stiff side; state every hold with its reason in the caption; send Chad stamped screenshots.

Reviews answered this session (all delivered to Adrian in chat with captions; Chad reviewed and
replied to at least the booking and payment sets, so delivery reached him): the front door +
five booking screens (13 Sept, prior session), the four-screen consolidation, the menu, the
profile, the Wallet (twice). **No review is pending at the time of writing.** Chad's last
message (on 4eab05c) asked for real payment management; `dd56afe` answers it.

## 2. Economics — the founder-approved rule (Adrian in writing, 13 Sept 2026 ~23:00)

- The Operator receives 99% of the travel fare.
- American Rider retains 1% of the travel fare.
- The traveler's platform fee is **the greater of $1.50 or 5% of the travel fare — not $1.50
  plus 5%**.
- The traveler pays the travel fare plus that platform fee.
- Stripe processing is an internal platform expense.
- Traveler-facing quotes show one Complete Travel Cost.

Recorded in: product contract v2, `AGENTS.md`, memory `platform-fee-contract-conflict`,
`src/data.ts platformFee()`, `backend/payments.js platformFeeCents()`,
`backend/payments.test.js` (parity every cent $0–$500), Terms ×5 (`backend/legal.js`), About.
**Still stating older rules** (unchanged this session, all listed with line numbers in the
13 Sept handoff's §0, which this file replaces): the LIVE Render backend and americanrider.app
(pre-9-Sept code: "$1.50, rising on larger fares"), TestFlight 36, the deployed web app, the
founders' demo worker, `site/index.html:244`, tracked `legal/` and `dist-deploy/` exports, and
docs GO-LIVE, FARE-MODEL, PAYMENTS-PLAIN, PRODUCT-SPEC, MAC-HANDOFF, LAUNCH-CHECKLIST, GAME-PLAN,
MAPS, ORDER-OF-OPERATIONS, V1.0-SPEC. Live surfaces are closed by the release cut; docs are an
hour's edit awaiting approval.

## 3. Decisions made this session (14 Sept 2026) — founder instructions and what was chosen

Recorded in `AGENTS.md` (Design rules + Architecture) and memory `booking-flow-one-sheet`
unless noted. Where a decision extends or conflicts with an authoritative file, it is flagged.

1. **ONE sheet from destination to car** (Chad: "it is subpar to have four screens before a
   car is on its way"). `app/reserve.tsx` is Travel Confirmation: destination entry, route
   map, one itinerary card (Departure · Arrival · Departure time with "Modify departure
   time ›"), estimated operator arrival, VEHICLE CLASS rows with each class's Complete Travel
   Cost, the Smart Travel card (always; greyed with its reason), CABIN ENVIRONMENT rows with
   "Modify cabin environment ›", government fee lines, and a footer fixed in view: Complete
   Travel Cost, payment-mode note while simulated, Confirm Travel (dispatches), cancellation
   terms. `options.tsx` and `review.tsx` deleted. Cabin Environment is a sub-screen with Done.
2. **Map = MapLibre, monochrome in the palette, one component for iPhone and Android**
   (Chad, 13 Sept, supersedes his 9 Sept "iPhone = Apple Maps"). `src/components/MonoMap.tsx`,
   `mapStyle.ts` (theme tokens only; OpenFreeMap tiles as interim source; OSM attribution
   printed under the frame in five languages), `HomeMap.tsx`, `RouteMap.tsx`; `*.web.tsx`
   render nothing. Apple Maps remains ONLY in `app/pickup-map.ios.tsx` and
   `src/components/LiveMap.ios.tsx` — **inconsistent with "one map"; not done; a founder
   should hear the cost before it is.** `@maplibre/maplibre-react-native` 11.3.10 (New
   Architecture only; RN 0.86 has nothing else). **Resolved in `a4b1618` (15 Sept 13:27):**
   `AGENTS.md` Architecture now carries the MapLibre decision (Chad, 13 Sept) beneath the
   `LiveMap.tsx` line and names the two Apple Maps files as an open item; the cost (about a
   day) is put to the founders in `docs/OPEN-DECISIONS.md` §0.2.
3. **Colour off the controls; blue links.** Chad (13–14 Sept) took blue out of the booking
   controls, the drawer head link and the caret. **CONFLICT:** `AGENTS.md` "THE BLUE STAYS"
   still lists "View profile ›" among the demo's blue places; that control is now "Account
   details ›" in ink by Chad's 14 Sept instruction. **Resolved in `a4b1618` (15 Sept 13:27):**
   the bullet now carries "Exceptions Chad made on 13–14 Sept 2026, which stand" (sheet
   controls, "Account details ›", the caret — ink). The shared blue `BackLink` (saved-place
   editor) is the one blue control left on the session's screens — founder call, open as
   `docs/OPEN-DECISIONS.md` §0.6.
4. **Menu = three groups** (Account / Travel / Assistance) on the Home drawer and the
   in-travel Menu screen; head = the account's name (or its address), never a handle; no
   initials disc; Sign Out in ink; "Become an Operator" removed (operators enter at the front
   door: Auth → Operator role → qualification); Notifications only inside Settings; Wallet →
   Payment Methods → (next day) Payment & Settlement; Invite Friends → Invitations; Safe
   Travels → Safety. Kept despite Chad's alternatives (stiff, or in the Terms): Travel Log,
   Patron Support, About American Rider, Sign Out.
5. **Account details** (`app/profile.tsx`): editable name saved to Firebase Auth
   (`setDisplayName`); "Account established <year>"; Saved Places = home, work, up to eight
   favourites (Adrian's request; `src/savedPlaces.ts`, device-only, geocoded before saving;
   also a SAVED PLACES section on Home that books from the saved coordinates); the saved cabin
   environment; trusted contacts count → Safety; travels COMPLETED this year; Payment Methods
   row; and the 99% model stated once at the foot with the About link. **Decision extending
   the founders' brief §10A** ("stated once, in About and on the receipt"): Chad asked for the
   model statement in the menu and on the profile; it went on the profile only, with the
   contract's term "travel fare" (not his "Base Fare"), and was kept out of the menu. A
   founder may reverse either half.
6. **Cabin preferences are genuinely saved**: `src/state/cabinPrefs.ts` holds climate, music,
   atmosphere, charging cable, luggage assistance; `startBooking` seeds each travel from it.
   The old `RideContext.defaultPrefs` were never editable or persisted (three of five reset on
   every booking while the screen said "saved"); superseded, not yet deleted from RideContext.
7. **Payment & Settlement** (`app/wallet.tsx`, Chad's exact title): the traveler's saved
   methods READ FROM STRIPE via new server routes (`GET /payment-methods`,
   `POST /payment-methods/setup-intent`, `POST /payment-methods/default`,
   `DELETE /payment-methods/:id`, all `requireAuth`, ownership-checked); "Add payment method"
   = Stripe's sheet in setup mode; Apple Pay availability row; `applePay: { merchantCountryCode:
   'US' }` now passed to the sheet for payment AND setup; off-session charges (gratuity,
   scheduled travel) use the traveler's chosen default. "Travel Log & Receipts" (not "Tax
   Receipts"). The contract's traveler voice is "plain English"; "Settlement" is Chad's word,
   used on his explicit instruction (twice).
8. **Held for the founders, with reasons already sent to Chad** (do not implement on
   speculation): vehicle-tier rename (Executive Sedan/SUV — needs a vehicle standard and a
   qualification gate); honorifics and membership tiers; portraits/monograms; "Travel Ledger",
   "Conclude Session", "Security Protocols", "Platform Governance & Philosophy", "Final
   Reservation Review", "Authorize & Dispatch Operator", "Total Authorization", "Confirm
   Itinerary" vs "Travel Confirmation" (Chad gave two names for the same controls; the
   existing true, translated names stayed — each is a one-string change); a payment instrument
   shown before Stripe's sheet runs; exact cabin temperatures; corporate/personal billing,
   retainers, monthly statements, expense-system forwarding, "Tax Receipts"; carbon or tier
   metrics; card artwork; a full-screen member drawer or bottom dock; "enterprise-grade"
   security slogans; "Multimodal First-Class Transfer" tier. The "Payments are simulated"
   note stays while payments are simulated (Terms promise; disappears with a live key).

## 4. Work completed and pushed (all on `skill/american-rider-release-review`)

| Commit | When (14 Sept) | What |
|---|---|---|
| `110d934` | 14:14 | One sheet (`reserve.tsx`); `options.tsx`/`review.tsx` deleted; MapLibre map + style; `cabinPrefs.ts`; `HomeMap.ios.tsx` deleted; MapLibre plugin in `app.json`; catalogues |
| `565e218` | 14:16 | Search-field caret in ink |
| `1557748` | 17:22 | Menu regrouped (drawer + Menu screen); wallet title |
| `d5b52ec` | 18:11 | Account details; favourites; saved-place editor; cabin defaults persist; Home saved-places section |
| `4eab05c` | 19:16 | Payment Methods cleanup (vendor/processing/credits/transit text gone) |
| `dd56afe` | 20:49 | Payment & Settlement with real saved methods; four server routes; `backend/methods.test.js` |

Exact files changed per commit: `git log --name-status 899b735..HEAD`. Catalogue arc:
847 → 860 keys (every removed key was retired in all five languages; no duplicates).
Also written this session (not tracked by design): `send/American-Rider-Screens/` — twelve
stamped PNGs (`1-home-565e218` … `12-payment-settlement-dd56afe`), `flow-one-sheet-565e218.mp4`
(93 s), five `CAPTION-*.txt`; yesterday's four unstamped PNGs deleted. Memory:
`booking-flow-one-sheet.md` (new), `platform-fee-contract-conflict.md` and `standing-rubric.md`
(updated for the 13 Sept written confirmation), `MEMORY.md` index.

## 5. Branch, HEAD, Git status (verified 15 Sept 13:10 EDT)

- Branch `skill/american-rider-release-review`; **HEAD `dd56afe`**; remote identical (0 ahead /
  0 behind; `git ls-remote` = `dd56afe`). `origin/main` = `3483a1d` (5 Sept); branch is 62
  commits ahead of main, 6 of them touching `backend/`. Nothing merged. No stash, no worktrees
  (the `~/AmericanRider-build-<sha>` checkouts were all removed), tag `design-baseline-2026-09-09`.
- **Committed at the end of the 15 Sept session** (Adrian: "do whatever you can so that the
  next session will remember absolutely everything"): this handoff, the twelve stamped PNGs
  and five captions in `send/American-Rider-Screens/`, the removal of the 13 Sept unstamped
  set, `AGENTS.md` (colour exceptions + maps), `docs/HANDOFF.md` (pointer here),
  `docs/OPEN-DECISIONS.md` (section 0). **Still untracked on purpose:** the 13 MB
  `flow-one-sheet-565e218.mp4` (too large for git history; it is in the folder and was sent
  to Chad). Memory lives outside the repo: `~/.claude/projects/-Users-adriansmith-AmericanRider/
  memory/` — `session-2026-09-14-design-reviews`, `chad-review-protocol`, updated
  `booking-flow-one-sheet` and `founders-adrian-and-chad`.

## 6. Tests, gates, builds and simulator checks — actual results

**At HEAD `dd56afe`, 15 Sept 13:10 (this handoff, read-only):** `npm run check` exit 0 — tsc
clean; de/es/fr/it all 860 keys; no untranslated strings; all 860 keys used; backend: 20 test
files, 638 assertions, 0 FAIL. `cd backend && npx eslint .` exit 0.

**Simulator builds this session** (`SSO_PREVIEW=1 npm run build:sim`, ~10 min each; Release):
working tree at `899b735`+ (twice, for the sheet and for MapLibre), then stamped `BUILD_REF`
builds of `565e218`, `1557748`, `d5b52ec`, and `dd56afe` — the last one with
`EXPO_PUBLIC_API_URL=http://localhost:4242`. **Both simulators (iPhone 17
`E1B5D5C5-…`, iPhone 17 Pro `0879CF4F-…`) now run `dd56afe` pointed at the LOCAL backend**, which
is NOT running; `.expo/simulator-build.json` records it. Rebuild for production before any
production-pointed capture or parity claim. iPhone 17 is signed in as Adrian's own account.
No EAS build or submit was run.

**Walked on the simulator, by opening screens (not by diff):**
- One sheet at `899b735`+ and again at `565e218`: suggestion → sheet; class change moves the
  footer price ($17.97 → $27.03); Modify cabin → Done keeps scroll and class; Enter
  Destination → results → Wynwood → re-quote $10.50 with the route re-framed; Confirm Travel →
  live screen "No operator matched yet" (production has 0 dispatchable operators) → Cancel.
- MapLibre: home map (ink dot, attribution) and route map (street path from the server, ink
  end dots, place labels rendering) at `899b735`+ and `565e218`.
- Menu at `1557748` (drawer only; the in-travel Menu screen NOT opened).
- Account details at `d5b52ec`: favourite added (Wynwood) → listed → on Home → books at $10.50.
  The Name editor was NOT exercised.
- Payment & Settlement at `dd56afe` against the local backend with Stripe TEST: saved Visa
  4242 listed → Set as default → Default; Add → Stripe sheet (TEST, Apple Pay, Link, saved
  card, New card, Bank) → Mastercard 5555…4444 saved → listed → Remove → gone. Left behind in
  Stripe TEST: Adrian's Customer has Visa 4242 as `default_payment_method`.
- Chad's screen recording (one-sheet flow) recorded from `565e218`.

**Not run this session:** the release-gate audit (`/american-rider-release-review`; last run
6 Sept: BLOCK, reported as 164 gates / 41 PASS / 94 FAIL / 29 NOT TESTED / 29 open P0 — but the
gates file defines 138 IDs, so that count is NOT VERIFIED); Firestore rules tests; physical
device; Android; web; `npm run parity` after the local-API build.

## 7. Live services (checked 15 Sept 13:10)

| Copy | State |
|---|---|
| Render backend `american-rider-server.onrender.com` | pre-9-Sept code (`/health`: `assistant: on`, no `regions`, stripe test, 6 operators / 0 dispatchable); `/payment-methods` → 404. **ASSUMED** `3483a1d`. |
| americanrider.app (served by that backend) | `/about` still "platform fee of $1.50, rising…" |
| Web app `american-rider.expo.app` | fingerprinted 13 Sept as pre-9-Sept (~`870ac9f`); NOT re-checked |
| TestFlight 36 | `7dae837` (parity, 14 Sept 14:30); 71+ commits behind; NOT re-checked |
| Local OTP `localhost:8080` | running (HTTP 200); no OTP on any server |
| Local backend `localhost:4242` | stopped after the Stripe test |

Consequence unchanged: the app's Terms link, quotes and charges on every production build go
through a server that still runs the old fee rule and lacks the payment-method routes.

## 8. Rejected or superseded approaches — do not repeat

- Apple Maps for the home/route map (cannot be recoloured); Google anywhere (ruled out).
- Four screens with Continue between them; a CTA that carries class and price
  ("Continue · Standard · $38.20"); a "default payment" row that decided nothing; a $0.00
  credits card; the transit card in the wallet; explanatory text where a control belongs.
- `RideContext.defaultPrefs` as the saved environment (never editable); use `cabinPrefs.ts`.
- Sending Chad an unstamped or dirty-tree screenshot: build the exact commit with
  `BUILD_REF=<sha>`, name files `<n>-<screen>-<sha7>.png`, caption names the build. Remove
  `~/AmericanRider-build-<sha>` after each stamped build (`git worktree remove --force`, then
  `rm -rf` if it resists) — Adrian was confused by four of them.
- Simulator tooling: a swipe that starts on the sheet's fixed footer does not scroll (start at
  y ≈ 130–560 pt); keystroke injection drops characters — type ≤ 4 characters per call;
  `inspect` was unavailable, use screenshots; never chain `git rm … && cat > file` — a failed
  pathspec skips every later command.
- Chad's stiff substitutes (see §3.8) and any 99% "Base Fare" wording.

## 9. Known defects and blockers

**P0 (open, unchanged in substance; IDs from `references/release-gates.md`):** BUILD-01/03 four
copies on four commits (TestFlight `7dae837`, web ~`870ac9f`, backend ~`3483a1d`, candidate
`dd56afe`); live money contradiction (§7); no routing/OTP on any server (straight-line × 1.3
fallback; Smart Travel unavailable in production); ECO-05/06/07/14 and MONEY-09 never verified
against a live charge; NAV-07; SAFE-02 (red controls beyond Call 911 — Sign Out and the cancel
confirm's "Yes, cancel" seen this session), SAFE-03, SAFE-05, MAP-03, AUTH-01/02 (rules tests
never run), OPS-03/04/05; MDAD/PortMiami permits not held.
**P1:** palette contrast (`muted` 3.24:1, `faint` 1.96:1 still on meta text and the
payment-mode note); Dynamic Type capped 1.3×; `toLocaleDateString('en-US')` ×16; government
fee names English-only; "Reserve Travel" on Home opens a search; web app/`site/` not deployed;
Checkr paperwork; fare has no time term; passkeys not built; Apple/Google sign-in have no
credentials (preview only).
**P2 / seen this session:** content scrolls under the status bar on every scrolling screen;
first booking after a fresh launch once showed no Additional Requests row (the account's
defaults load asynchronously) — seen once, not chased; `AGENTS.md` conflicts in §3.2–3.3; Apple
Maps still in pickup-map and LiveMap; `applePay` merchant provisioning in Apple's portal NOT
VERIFIED (the sheet showed the Apple Pay button in TEST on the simulator).

## 10. Assumptions and things not tested

- All translations written this session (es/fr/it/de) are mine; the gates prove coverage only.
- Apple Pay on a real device; any physical device; Android; web builds of this code.
- The Name editor on the profile; the in-travel Menu screen; Schedule from the new sheet; the
  pickup-pin path; a Smart Travel leg on the new sheet (code path exists, no OTP in production).
- Whether Adrian sent Chad the "Monday 7:00 PM" reply is UNKNOWN; the deliverables reached
  Chad the same day (he reviewed them), so the commitment was met in substance.
- The 6 Sept audit's "164 gates" figure (file has 138 IDs).

## 11. Promises and follow-ups

- To Chad (via Adrian's captions): held items are listed with reasons; "send the vehicle
  standard and the tier gate gets built"; the single-sheet merge was quoted ~2 days on 13 Sept
  and delivered 14 Sept; TestFlight 37 "Tuesday" was in the drafted 13 Sept reply — **status
  UNKNOWN whether promised; NOT done** (needs Chad's Apple account and the deploy below).
- To Adrian: one screenshots folder only (`send/American-Rider-Screens/`), commit in every
  filename, no stray build folders; push only on his word.

## 12. The exact recommended next action

1. **Rebuild both simulators for production** (`BUILD_REF=dd56afe SSO_PREVIEW=1 npm run
   build:sim`; remove the checkout after) so parity and the next capture are honest. Until
   then, Payment & Settlement on a production-pointed build reads "Saved payment methods could
   not be read" (routes not deployed) — correct, not a bug.
2. **The release cut, gated on the founders:** Adrian approves deploying the backend from this
   branch to Render (brings the 5% rule, Terms, About, regions, the withdrawn assistant and the
   payment-method routes live; set `OTP_URL` only when OTP is on a server), then the web deploy
   from the same commit, then Chad cuts TestFlight 37 from it (`docs/TESTFLIGHT-RUNBOOK.md`),
   then `npm run parity`. This closes BUILD-01/03 and the live money contradiction.
3. If the founders are not ready: re-run the release-gate audit so §9's P0 count is a verified
   number; then the docs sweep for the flat-fee wording (§2); then decide §3.2–3.3 conflicts.

## 13. Commands

```bash
git status --short && git log --oneline -8
npm run check && (cd backend && npx eslint . && npm test)
BUILD_REF=<sha> SSO_PREVIEW=1 npm run build:sim        # stamped; production API by default
EXPO_PUBLIC_API_URL=http://localhost:4242 BUILD_REF=<sha> SSO_PREVIEW=1 npm run build:sim   # local backend
git worktree remove --force ~/AmericanRider-build-<sha>; git worktree prune
xcrun simctl io E1B5D5C5-FCBB-4729-96DC-AFF1DE3D8778 screenshot send/American-Rider-Screens/<n>-<screen>-<sha7>.png
npm run parity                                          # queries EAS (~90 s)
curl -s https://american-rider-server.onrender.com/health
# local backend: .claude/launch.json "backend" (port 4242; Stripe TEST key in backend/.env)
```
