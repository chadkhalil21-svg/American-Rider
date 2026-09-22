# Open decisions — waiting on Adrian + Chad

Written down so they survive a compacted conversation, a restart, or a brand-new session.
Each EAS build costs Adrian about $2, so **batch whatever is approved into one build**
rather than shipping each.

Sections 1–6 are decisions, not work: nothing in them is built. The dated sections at the
bottom record work that IS built, and what it still needs from you — start with **BUILD
QUEUE — BUILT 16 Aug 2026**.

Last updated: 19 Sept 2026 (§0.8 corrected — the backend DID deploy 16 Sept; §0.10 added for
the register of Chad's screen-27 vocabulary; §0.6 answered 18 Sept). Section 0 was added 15 Sept. Sections 1–6 and the 16 Aug build queue are
historical — the blue question in §1 was settled 11 Aug ("the blue stays"), with Chad's 13–14 Sept
exceptions recorded in AGENTS.md.

---

## 0. Open after Chad's design reviews of 13–14 Sept 2026 (all else from them is built)

Everything Chad asked for that the app can say truthfully is built and pushed (commits
`110d934`…`dd56afe`; see `CURRENT_HANDOFF.md` and memory `session-2026-09-14-design-reviews`).
These need a founder's word before anything moves:

1. **Vehicle tiers** — "Executive Sedan / Executive SUV / Companion Tier", silhouettes, luggage
   counts. Needs a vehicle standard, a model-year floor and a qualification gate; operators
   drive their own cars. Send the standard and the gate gets built.
2. **The two Apple maps left** — `app/pickup-map.ios.tsx` and `LiveMap.ios.tsx` still use
   Apple Maps while Home and the sheet are MapLibre. Move them (about a day, the live map's
   animated car included) or accept two engines for now.
3. **Self-hosted tiles** — the map reads OpenFreeMap ("as is", no billing) until the
   Protomaps/MapLibre tile server exists (`docs/ECONOMICS-AND-INFRASTRUCTURE.md`).
4. **Control names Chad offered two of** — "Confirm Itinerary" / "Final Reservation Review" for
   the sheet; "Request Operator" / "Authorize & Dispatch Operator" for the button; "Travel
   Ledger", "Conclude Session", "Security Protocols", "Platform Governance & Philosophy". The
   existing true, translated names stayed; each is a one-string change if a founder picks one.
5. **The 99% statement** — the brief (§10A) puts it in About and on the receipt, once; Chad
   asked for it in the menu and on the profile. It is on the profile (once, "travel fare"), not
   in the menu. Confirm or reverse.
6. **The last blue control — ANSWERED, 18 Sept 2026.** Chad listed "‹ Back" among the blue
   controls to take the colour off, in his review of the operator qualification flow. The
   shared `BackLink` is ink on all nine screens that use it (`a332664`). AGENTS.md's "until a
   founder says" is satisfied; nothing further is open here.
7. **Not built, asked for** — honorifics/tiers, portraits, corporate/personal billing profiles,
   retainers, monthly statements, expense-system forwarding, "Tax Receipts", passkeys, a
   payment instrument shown before Stripe's sheet, exact cabin temperatures, a full-screen
   member drawer or bottom dock. Each is a feature decision with a cost, not copy.
8. **Deploy — PARTLY DONE, corrected 19 Sept 2026.** The backend deployed on 16 Sept
   (`3483a1d..d2cccc7`, `origin/main` now `dcccfe3`): the 5 % fee wording, the payment-method
   routes and `GET /support/cases` are live and verified. What is still undeployed is the
   disclosure version `2026-09-18.1` and the 43 commits since `dcccfe3`. The web deploy is
   WITHDRAWN (Adrian, 17 Sept: no public web app). TestFlight 37 is blocked on Chad ticking
   Sign In with Apple on `com.americanrider.app`.
9. **"Operator notified" on the Lost Item ladder (16 Sept 2026)** — the rung turns green when the
   report names the operator, and the thread opens with "<name> has your report." No operator app
   reads either yet (no operator queue until operators have account identity, §4). The note
   under the rung says what is true; the label and the thread line say more. Options: rename the
   rung ("Operator named" / "Report filed against the travel") until a queue exists, or keep the
   label and accept the note as the qualifier. One string each, five languages.
10. **The register of Chad's screen-27 vocabulary (19 Sept 2026)** — his Notifications review
   specified "Dispatch & Notification Preferences", "Transit Departure Advisories", "Arrival &
   Stationing Alerts", "Travel Completion Summaries". It is BUILT, exactly as he wrote it
   (`15ae931`, five languages). It is flagged here because it is a stiffer register than the
   traveler voice `AGENTS.md` describes — "plain English, precisely used", with the explicit
   warning that a screen "is NOT made institutional by being stiff". Two readings are open and
   only a founder can settle which: either this register is now the traveler standard and the
   rest of the app should follow it, or screen 27 is the exception and nothing else moves.
   Related and equally unsettled: "Invitations" → "Extend Patronage" and "Safety" → "Passenger
   Security", kept from 18 Sept, both reversing earlier decisions.

---

## 1. Blue — A or B (the big one)

Two founder rules contradict each other and I have been silently resolving the collision:

- **8 Aug, both founders:** "NO BLUE, anywhere. The accent is ink." Written into `AGENTS.md`;
  it is why `colors.blue` in `src/theme.ts` literally resolves to `#14171F` (black).
- **8–10 Aug, Chad:** "everything exactly as it is in the web demo version."

The demo uses blue (`#2E5FE0`) in roughly fifteen places — "View profile ›", "Travel ›",
"Add a contact", "Set default", "See all", tinted panels.

- **Option A — the demo wins:** restore blue everywhere the demo uses it. The app becomes
  genuinely identical. The no-blue rule retires.
- **Option B — no-blue wins:** stays ink; ~15 small spots will never match the demo,
  permanently and on purpose, and that is documented rather than treated as a bug.

**Status: undecided.** Until decided, the app stays as-is (ink).

---

## 2. The number font — SF Mono or IBM Plex Mono

Same shape of contradiction, found 12 Aug:

- The demo uses **`SF Mono`** for prices and trip numbers.
- The app uses **`IBM Plex Mono`**, because the project's own earlier design rules said so.

**Status: undecided.** Small change; batch with #1.

---

## 3. Smart Travel — three questions

1. **Per-leg prices.** The demo shows minutes on the three route rows; we show dollars
   (minutes moved to the subline). Showing per-leg prices arguably breaks the "one all-in
   price" promise. Recommendation: match the demo (minutes), keep the single total.
2. **The four "When" chips on Travel Confirmation** — demo has Travel now / In 1 hour /
   Tonight 7 PM / Tomorrow 8 AM. We built a full scheduling screen instead.
   Recommendation: add the chips AND keep the calendar.
3. **The Metrorail ticket wording.** ~~Wallet says "Purchased automatically … ready to scan
   at the gate"~~ — **COPY FIXED 16 Aug** (the QR mark and the green "Ticket ✓" are gone).
   But the sweep found the real problem underneath it: the $2.25 fare is charged inside the
   Smart Travel price while no ticket is issued, so the traveler pays it twice. See
   **NEEDS A FOUNDERS' ANSWER #1** at the bottom of this file.

---

## 4. Operator identity lives on the phone, not the account — a real bug

`ar:role`, `ar:operator-commissioned`, documents, and revenue are all in device storage.
A commissioned operator who signs in on a NEW phone appears un-qualified and would have to
redo all six documents. Fine for the test program (qualification is simulated); unacceptable
with real operators.

Recommendation (needs approval): store role + operator status on the account in Firestore,
and send commissioned operators to the operator side on sign-in. Optionally show the demo's
"Select Account" screen at sign-in for accounts holding both roles.

---

## 5. App Store rejection risks still open

- **The fake sign-in buttons.** "Continue with Apple" and "Continue with Google" show a
  "coming soon" alert. Non-functional buttons are a rejection; and offering Google sign-in
  REQUIRES offering Sign in with Apple. Fix = make both real, or remove both.
- **"Test program" labels** throughout the app tell a reviewer this is a beta.
- (Account deletion — DONE, build 29.)

---

## 6. Founder/business track (Chad)

- FLHSMV confirmation call — Florida appears to have NO separate TNC permit (verified
  against §627.748 + a Florida business-law analysis); confirm directly.
- The 25+ / under-25 operator policy — insurance tiers vs. including younger operators.
- Sole proprietorship + bank account → activates Stripe live mode.
- Commercial insurance verification, background-check account (operator-paid, ~$30–45,
  three-year re-check clock already built).
- Lawyer review of the Terms of Service and Privacy Policy drafts.
- **Trademark clearance opinion (~$300–800) before any public App Store listing** —
  EPG Media holds a federal registration on "AMERICAN RIDER" for motorcycle magazines
  (Serial 97015191) and owns americanrider.com. Different class (publishing vs.
  transportation) is a strong argument, not a guarantee.
- Recruiting real, qualified, insured operators — likely the true launch bottleneck.

---

## Billing facts (so no future session gets these wrong)

- Expo Starter **cancelled**; service ends 6 Sep 2026, final bill ~$3, then $0 and the free
  tier (15 iOS builds/month). Total Expo spend: $19 + ~$3.
- Render: still free tier (server sleeps after ~15 min idle; $7/mo fixes it — deferred).
- Apple Developer: paid on Chad's account through 24 Jul 2027.

---

## RESOLVED 11 Aug 2026

**Blue — SETTLED.** Chad: "we'll keep the blue as it is in the web demo." `colors.blue`
is `#2E5FE0` again and AGENTS.md no longer carries the 8 Aug no-blue rule. Closed.

## NEW — needs a founders' answer

**1. Dynamic Type vs exactness (Claude's call so far: exactness).**
iPhones let a traveler enlarge all text (Settings › Display & Brightness › Text Size).
React Native obeys that by default; the web demo cannot. So on a phone with larger text
the app could never match the demo. `AppText` now pins the app to the demo's sizes.

The cost: a traveler who enlarges text for a reason — Adrian's "elderly or non-technical
person" — no longer gets larger text in our app. The middle option is a cap: allow growth
up to ~20% so the layout still holds. One line in `src/components/AppText.tsx`.

- **A — Pinned (shipped now).** Always identical to the demo. No accessibility scaling.
- **B — Capped at 1.2.** Mostly matches; grows for travelers who need it.
- **C — Fully dynamic.** Best accessibility; will not match the demo on many phones.

**2. Bold Text is not ours to control.** iOS Accessibility › Bold Text re-weights the
system font for every app; there is no opt-out. If either founder has it on, our app will
look heavier than the demo forever and no code change fixes it. Worth each of us checking
our own phone before calling a weight difference a bug.

**3. The home-screen welcome block is app-only.** "Welcome to American Rider / Your driver
keeps 99% of the fare… / Got it" does not exist on the demo's home screen. It is a
first-run explainer that dismisses. Keep it, or cut it for exactness? Product call.

## Bank settlement — built 16 Aug, one step still blocked on Stripe

Chad asked how to move travelers onto bank payment, since ACH costs ~$0.21 on a $26.00
travel against ~$1.05 for a card — the platform keeps roughly double. Four steps agreed;
three are done.

1. DEFAULT TO BANK ✓ already true — `RideContext` opens at `pay: 'ach'`. This is the
   single strongest lever and it needs no copy: most people never change a default.
2. ORDER IT FIRST ✓ already true — `PAY_ORDER = ['ach','apple','gpay','card']`.
3. REMOVE THE FRICTION — **BLOCKED ON STRIPE**. Typing a routing and account number is
   why people fall back to cards; it is friction, not preference. Fix with **Stripe
   Financial Connections**, which links a bank by logging into it in a few taps. Build
   this the moment the Stripe account is verified — it is the step that decides whether
   the default actually holds.
4. STATE IT ONCE, FACTUALLY ✓ — in Wallet under the payment card, and as a "How payment
   is settled" section on the live About page: "American Rider settles by bank transfer.
   Cards are accepted and cost more to process; that difference is absorbed by the
   platform fee, never added to your price."

NOT DONE, DELIBERATELY: a discount for paying by bank. Two prices for one journey
contradicts the one-all-in-price promise (brief §7) and turns the interface into a
negotiation. There is also a legal distinction worth a lawyer's ten minutes if it is ever
revisited — a DISCOUNT for bank payment is broadly permitted, a SURCHARGE on cards is
restricted and banned outright in some states, and the two are the same money framed
differently. The margin difference is ~85c per travel; the one-price promise is the
company's whole differentiation. Absorb it.

Also removed: the "Preferred" sub-label on the bank row. It asserted a preference without
a reason, and when a traveler switched to a card the row read "Preferred / Set default"
simultaneously.

## Patron Support is now real — one thing left before launch

FOUND 16 Aug: `escalate` was `setIssueState('escalated')`. One line, client-side. The
screen then told the traveler "A specialist is responding · You will be contacted shortly
· typically under five minutes" while no message was sent, no ticket existed and no person
was notified. Someone overcharged at midnight was told help was coming and waited for a
specialist who never knew they existed. Worst defect this app has had, and it survived the
placeholder sweep because it LOOKED implemented.

BUILT (founders' shape: AI handles the majority, everything else reaches a human):
- `backend/support.js` — Claude (Sonnet, not Haiku: this one reads a money complaint from
  an unhappy person and decides whether to pay them) returns explain / credit / escalate.
- `backend/tickets.js` — files the case to Firestore and emails it.
- `POST /support` on the server, replacing the client-side flag.

THE SAFETY DESIGN, which is the part worth preserving: **the model proposes, the server
decides.** A cap written into a prompt is a suggestion; a cap written in code is a cap.
  - Auto-credit ceiling $45.00, enforced in JS — and never more than the travel cost.
  - ALWAYS_HUMAN categories (accident, injury, assault, harassment, weapons, intoxication,
    police/legal, discrimination, unlawful confinement) are matched against the traveler's
    words BEFORE the model runs AND against the model's output after — so neither a
    confused model nor a persuasive message can route them away from a person. 9/9 on test
    cases.
  - Any model error, timeout or malformed answer becomes an escalation. The one outcome
    that must never happen is a traveler told nothing.
  - The traveler is told a person has their case ONLY if the ticket actually filed.
    Otherwise they get the support email address and their travel number.

STILL REQUIRED BEFORE REAL TRAVEL — set in backend/.env:
  SUPPORT_EMAIL   the inbox a human actually watches
  RESEND_API_KEY  (or another mail provider)
Without these, `fileTicket` falls back to the Firestore write alone, which means somebody
must watch the `support_tickets` collection by hand. A record nobody reads is not support.

NOT DONE: the app still calls the old client-side `escalate`. Wiring app/issues.tsx to
POST /support is the next step — the backend is ready and waiting.

## BUILD QUEUE — BUILT 16 Aug 2026. What is real, and what still needs a founders' answer.

All four items are built. The spec that produced them is kept below, unedited, because it is
the clearest statement of the standard: **a screen may not state an outcome it has not
reached.** Every claim below is now backed by a call, a write or a notification, and where
one fails the screen says so instead of comforting the traveler.

### BUILT

1. **EMERGENCY** — `app/emergency.tsx`, reached from Safe Travels' Call 911. Holds the live
   reverse-geocoded street address (re-derived as the car moves, coordinates when the
   geocoder cannot answer), the vehicle and PLATE at 34px, the operator, and the Travel
   Number. Opening the screen files an emergency case (`POST /emergency`) — the alert does
   not wait for a second tap, because a traveler who dials 911 and never returns to the app
   would otherwise never have been reported. `POST /emergency/location` keeps the open case
   current every 15 seconds. Trusted contacts now store a NUMBER (`src/contacts.ts`, old
   name-only lists migrated), so "Text my location" opens Messages addressed to them with
   the address, plate, operator, Travel Number and a map link.
2. **LOST ITEM** — `app/lost.tsx` + `src/backend/lostitem.ts`. Which travel (the day's list,
   plus an "I'm not sure which" row that names every operator in the window on the report),
   describe it with an optional photo (uploaded to Firebase Storage, not left as a `file://`
   URI only the traveler's phone can open), a message thread scoped to that travel, and the
   return with both paths — original operator when still available, nearest operator
   otherwise, priced by the same `/fare-quote` that prices every travel. The status ladder
   has no rung called Resolved.
3. **/support IS WIRED** — the five canned resolutions in `src/data.ts` are gone. A category
   now opens a box the traveler writes in; the server reads it against the recorded travel
   and answers, refunds, or files a case. **A "credit" decision now issues a real Stripe
   refund** (`refundTravel`); if it cannot — no PaymentIntent on that travel, or Stripe
   refuses — the case escalates to a person rather than announcing money that never moved.
4. **DEFECT SWEEP** — see the list below.

### FOUND IN THE SWEEP AND FIXED

- **Travel Complete added an untaken tip to a row labelled "Total Charged".** Selecting $10
  changed a charged amount to one that had never been charged. Rating and tip were also
  thrown away on Complete. Both are now written to the travel record; Total Charged shows
  the charge, and the tip is its own labelled line.
- **The Metrorail ticket.** Wallet showed a QR mark and "Purchased automatically with Smart
  Travel — ready to scan at the gate"; the live Smart Travel screen showed a green
  "Ticket ✓". No transit integration exists. The QR and the check mark are gone.
- **Scheduled travel was memory only** and promised "We'll match you with an operator
  automatically and notify you before pickup". Nothing matched, nothing notified, and the
  reservation vanished on the next launch. It is now a record on the account
  (`src/backend/scheduled.ts`), read back when the app opens, and the splash claims only
  that.
- **Invite Friends offered $10 with no redemption path anywhere** — the code is registered
  nowhere, sign-up never asks for one, and the credits balance was a typed string. The offer
  is removed; the code and share sheet, which are real, remain.
- **Notifications said "Delivered to your phone with your chosen sound."** The app registers
  for no push notifications at all.
- **Sign-up said "A 6-digit code was sent"** next to "enter any 6 digits", and "Resend code"
  answered "New code sent" having sent nothing.
- **Safe Travels' "Contact a Specialist"** raised an alert reading "Connecting you to an
  American Rider specialist — any hour" and connected nobody. It opens Patron Support.
- **Adding a trusted contact was iOS-only**; on Android the button explained that editing
  opens on a screen that does not exist.
- **The messaging screen's scripted operator reply** now fires only on the simulated live
  ride, never on a lost item thread.
- **Operator side:** "Transfer initiated · on its way to your bank" printed above "transfers
  are simulated"; "you will be notified the moment you are cleared" notifies nobody.
- **The always-human safety guard had a hole.** "he grabbed my arm" matched none of the
  patterns, so a physical assault could be routed to the model. Contact, sexual-conduct and
  minor-in-the-car wording added; 18/18 on the widened test set.

### REVIEW OF dc73ce8 — six defects in my own work, all fixed

The commit went in unreviewed and asked for exactly this. Reviewing it turned up six, two of
them serious:

1. **`/support` would refund against any PaymentIntent the phone named.** `trip.paymentIntentId`
   came straight out of the request body. A signed-in traveler could name a STRANGER'S payment
   and have us refund up to $45 against it — they gain nothing, the company loses the money,
   once per request, for as long as they keep asking. Fixed: the uid is stamped into Stripe
   metadata when the charge is made, `refundTravel` retrieves the intent and refuses unless
   the metadata uid matches the caller, and the ceiling now comes from the intent's own
   remaining refundable amount instead of a number the client sent.
2. **The emergency email reached a human with no location in it.** The alert fires the moment
   the screen opens — correct, a traveler who dials 911 and never returns must still be
   reported — but at that instant the phone has not resolved its position, so the email said
   "Location: —". Every fix after that only patched Firestore, which nobody re-reads. The one
   screen whose purpose is answering "where are you" was telling our own team nothing. Fixed:
   the first location to land on an emergency case now sends a second email with the address,
   coordinates and a map link.
3. **The rules I wrote to fix silent write failures could have caused them.** Three clauses
   used `'status' in <affectedKeys>`; `in` is documented for List and Map, not for the Set
   `affectedKeys()` returns, and a rules expression that will not evaluate denies the write
   rather than failing loudly. Rewritten with `hasAny()`.
4. **A lost item return could be dispatched to an operator with no connection to the item.**
   On an "I'm not sure which" report `arrangeReturn` took `notifiedOperatorIds[0]` — first of
   however many, ordered by nothing — and told the traveler "the operator who drove your
   travel" was bringing it back. Fanned-out reports now wait for an operator to confirm.
5. **An abandoned support case resolved into the store after the traveler left**, so a later
   visit could open on a stale answer. Cases now carry a generation. (A refund that really
   happened is still recorded either way — the money moved.)
6. **Photo uploads would have been rejected by my own storage rule.** A Blob from a `file://`
   URI often has an empty `type`, and the rule requires `image/*`. Content type is now stated
   on upload.

Also swept the operator side, which the first pass only glanced at: "Renewal alerts are
automatic" (nothing alerts anyone, and an operator whose insurance lapses waiting for it
loses their livelihood), "Playing · Operator Playlist" (no audio integration exists), and the
messaging gap below.

**Not machine-verified:** the rules files. There is no Java runtime on this Mac, so the
Firestore emulator cannot run. `firebase deploy --only firestore:rules,storage` compiles them
server-side and rejects invalid syntax loudly — that deploy is the verification.

### THE OPERATOR SIDE IS NOW THE BINDING CONSTRAINT — and it traces to §4

Two things cannot be finished, and both stop at the same place: **an operator has no account
identity.** Role and commissioning live in device storage (`ar:role`,
`ar:operator-commissioned`), which is §4 above, still awaiting approval.

- **Lost item cannot leave "Operator notified".** An operator queue would have to be scoped
  to *their* travels; without an identity to scope it to, every commissioned device would see
  every traveler's description, photo and pickup location.
- **Traveler and operator messaging are two different threads.** The traveler's messages go to
  Firestore keyed by Travel Number; the operator's screen reads a local array and answers
  itself after 1.5 seconds. Neither person's words reach the other, and both screens were
  telling their reader otherwise. The operator screen now says so plainly.

**What I did instead, so a lost bag is not stranded waiting for §4:** every lost item report
is also filed as a support case (`POST /lost-item`), because until the operator queue exists
a person is the only route the item actually has. The status rung shows the case number when
that succeeded and the support address when it did not.

**Approving §4 unblocks both.** The work after it is small: give each message an `operatorId`
beside `travelerUid` and widen the rule to either party; scope the lost item queue by the same
id.

### 17 Aug, ON THE SIMULATOR — the emergency screen works, and support has never worked

Ran the app on a real iPhone 17 simulator with a simulated Miami position, because the
emergency screen had only ever been seen in a browser with location denied — so the *only*
path anyone had watched execute was its failure state.

**The screen does what it was built to do.** Coordinates 25.7615, −80.1930 resolved to
**"1333 S Miami Ave · Miami, FL, 33130"**, beside the plate at 34px, the operator and the
Travel Number. That is a dispatcher's first question, answered, on a device.

**And then it said "Not reached from this device" — correctly.** Chasing that produced the
worst finding of the build:

> **`firebase-admin` was never a dependency of the backend.** `backend/tickets.js` required
> it inside a try/catch that swallowed the error, so `db()` returned false permanently and
> `fileTicket` returned `{ ok:false }` for **every case it was ever given, in production,
> since the day it shipped.** No support escalation and no emergency alert has ever been
> recorded anywhere.

**A correction to what this document said two days ago.** It claimed the missing piece was
email, and that without it "`fileTicket` falls back to the Firestore write alone, which means
somebody must watch the `support_tickets` collection by hand." That was wrong in a way worth
naming: there is no Firestore write. Nobody was watching that collection because nothing has
ever been in it.

What made this invisible is worth more than the bug. The app reported the failure *honestly*
at every step — "We could not open your case automatically", "Not reached from this device" —
and a truthful failure message made a total outage look like a considered edge case. **Proving
a screen tells the truth when a mechanism fails is not the same as proving the mechanism
works.** I verified the first and called the second done.

FIXED: `backend/firebase-admin.js` initializes properly from a service account (modular API —
the first attempt used `require('firebase-admin').apps`, which is undefined in current
versions and reported a null-property error instead of the real problem); `firebase-admin` is
now an actual dependency; and **`/health` reports it**, so this can never hide again:

```
curl -s https://american-rider-server.onrender.com/health
```

`support.canReachAHuman: false` means Patron Support and the emergency screen cannot reach a
person at all. It is `false` right now.

**STILL NEEDS YOU — this is the release blocker, not a nice-to-have.** Set on Render *and* in
`backend/.env`:
  - `FIREBASE_SERVICE_ACCOUNT` — the whole service account JSON (Firebase console → Project
    settings → Service accounts → Generate new private key). A real secret; never in the repo.
  - `SUPPORT_EMAIL` and `RESEND_API_KEY` — the inbox a person actually watches.
One gives the durable record, the other the alert. Until at least one exists, an emergency
alert reaches nobody.

### NEEDS A FOUNDERS' ANSWER

1. **THE METRORAIL FARE IS CHARGED TWICE.** `backend/smart.js` puts the real $2.25 Miami-Dade
   fare inside the Smart Travel price (`RAIL_FARE_CENTS`), and American Rider issues no
   ticket — so the traveler pays us for the fare and pays again at the gate. The screens now
   say so plainly, which is honest and uncomfortable, and that is the point: it is a pricing
   decision, not a copy fix. Three ways out — issue real tickets (needs a Miami-Dade
   agreement), stop charging for the leg while still counting it in the savings comparison,
   or keep charging and state it as a bundled convenience. **Recommendation: stop charging
   for it** until tickets exist; $2.25 a journey is not worth the one-price promise.
2. **The operator side is the ceiling on Lost Item.** "Item located / Not found" can only be
   set by an operator, and the operator app is not built. Until it is, a report reaches
   `operator-notified` and stops there honestly. This is the strongest argument yet for
   M3.2.
3. **Tips are recorded, not paid.** There is no payout path, so Travel Complete says
   "recorded, not yet charged". It becomes real with Stripe Connect payouts.
4. **Referral credits.** Restoring the $10 needs three things: a code registered
   server-side, a redemption at sign-up, and a credits balance that is read rather than
   typed. Worth building, or drop the screen?
5. **THE SECURITY RULES MUST BE DEPLOYED OR NONE OF THIS WORKS.** `firestore.rules` carried
   `allow update: if false` on rides while `setRideStatus` had been calling `updateDoc` on
   them all along — so completed-vs-cancelled was being written by code the database was
   silently refusing. Both rule files are rewritten (`firestore.rules`, and a new
   `storage.rules` for the lost item photo) and neither takes effect until deployed:

   ```
   firebase deploy --only firestore:rules,storage
   ```

6. **`SUPPORT_EMAIL` and `RESEND_API_KEY` are still unset.** Without them an escalated case
   is a Firestore row somebody must watch by hand — and an EMERGENCY case is the same row.
   This is the single most important item on the list before real travel.
7. **A live tracking link for trusted contacts was deliberately NOT built.** It would mean an
   unauthenticated page on the Render free tier, which sleeps after 15 minutes and takes
   ~50 seconds to wake — in an emergency. The message carries the address, coordinates and a
   map link instead, which is instant and needs no server. Revisit with the $7/mo plan.

---

## THE ORIGINAL SPEC — kept for the standard it sets

## BUILD QUEUE — specced 16 Aug, in this order

Both defects found so far share one signature, and it is the thing to hunt for:
**a screen that states an outcome with no mechanism behind it.** Escalation said "a
specialist is responding" and notified nobody. Lost Item says RESOLVED before the item is
found. Neither was caught by the placeholder sweep because both LOOK implemented — the
give-away is not the wording, it is that no network call, no write and no notification
happens anywhere behind them.

### 1. EMERGENCY — build first
The only gap with a real-world cost tonight; everything else is money or inconvenience.
Safe Travels has a Call 911 button that dials and nothing else. A person in a moving car
in a city they do not know cannot tell a dispatcher where they are.

The screen must hold, while the call connects, in large type, readable at arm's length:
  - the vehicle: make, model, colour, PLATE
  - the operator's name
  - the Travel Number
  - the CURRENT street address, updating as the car moves (reverse-geocoded from the live
    position, not the pickup address)
Plus: notify American Rider support in the same action, and share live location with the
traveler's trusted contacts ('ar:trusted-contacts' already exists).
The dispatcher's first question is "where are you". The app knows. Put it on the screen.

### 2. LOST ITEM — both return paths, founders 16 Aug
Current flow says "RESOLVED · Operator notified" while notifying nobody, and says "your
operator" without ever asking which one.

  a. WHICH TRAVEL — never guess. List the day's travels (destination + time) and let the
     traveler choose. Include an explicit "I'm not sure which" row that notifies every
     operator in the window; someone who cannot remember must not be stuck.
  b. DESCRIBE IT — free text plus an optional photo. The operator is searching a car in a
     parking lot: "black backpack, back seat, driver's side" is actionable, "my bag" is not.
  c. TALK TO THE OPERATOR — REQUIRED (founders 16 Aug). A message thread scoped to that
     travel, so the operator sees which journey it concerns. Use the existing messaging
     screen. NEVER expose phone numbers in either direction — masked in-app only, which
     protects the operator as much as the traveler.
  d. RETURN — BOTH paths, platform chooses, traveler is not asked to negotiate:
       1. ORIGINAL OPERATOR returns it when their next travel already passes nearby.
          No cost, best case, try this first.
       2. ANY OPERATOR carries it, dispatched like a small delivery — whoever is closest,
          paid the same 99%. This is the answer when the original operator has finished
          for the day or left the area, and it is the case the model handles better than
          anyone else: the item is a passenger with no opinions, and the operator who left
          is not penalised for having finished.
     Either way it is a real dispatched travel: tracked, priced, one amount to the traveler.
  e. STATUS THAT IS TRUE: Reported → Operator notified → Item located / Not found →
     Return arranged. Never "Resolved" until it is back in the traveler's hands.

### 3. WIRE THE APP TO /support
Backend is built and tested (backend/support.js, backend/tickets.js, POST /support). The
app still calls the old client-side `escalate`. Until this is wired, in-app support does
not exist end to end and email remains the only real channel.

### 4. DEFECT SWEEP — the outcome-without-mechanism pattern
Open app/issues.tsx ISSUES first: five static resolutions, three still unexamined.
**Safety is the one to open first** — if that tells someone reporting a safety issue that
it is "Resolved", it is the worst instance of this pattern in the app. Then sweep every
screen for the same signature: a stated outcome with no call, write or notification behind
it.
