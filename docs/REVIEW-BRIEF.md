# American Rider — brief for an outside reviewer

Written for a second AI model (or any reviewer) asked to evaluate the app and return
findings. Paste this whole file alongside the link. It is kept in the repository rather
than in a chat so that it stays true as the code changes.

**The app:** https://american-rider.expo.app

---

## 1. How to see it

Open the link on a phone, or in a desktop browser narrowed to about 390px so it renders
at phone size.

- **Create Account** — any email, any password of 6+ characters.
- The verification step accepts **any six digits**. No SMS is sent; the screen says so.
- Then choose **Traveler** or **Operator**. Both roles live on one account and you can
  switch between them at any time from the menu.
- Nothing is charged. Payments are simulated throughout the test program.
- Language follows the browser and can be changed from the row on the front door, or
  Menu → Settings.

### What the web build cannot show you

The web build is compiled from the same source as the iOS build, but four capabilities
need real phone hardware and are stubbed on web. Do not report these as missing:

- push notifications
- background location (operator presence while the phone is pocketed)
- the Live Activity on the iOS lock screen
- Apple Pay

Three components also render a non-native variant on web — `LiveMap`, `FindMiguel` and
the pickup map. Every route exists on both platforms; the map drawing differs.

---

## 2. What the company is

A rideshare platform launching in Miami. The distinguishing claim is the economics:

- The **operator keeps 99% of the travel fare.**
- American Rider takes a **1% coordination commission of the travel fare, with no cap.**
- Plus a **platform fee paid by the traveler on top of the fare.** It is **the greater of
  $1.50 and 5% of the travel fare, rounded up to the cent** (Chad, 9 Sept 2026: "five
  percent", relayed by Adrian). Below a $30 fare it is $1.50 exactly; at $30 the two halves
  meet, so it is continuous. There is no step and no cliff. **It is not a flat fee.**
- The platform fee also absorbs card processing. Processing is never added on top and
  never itemised to a traveler.
- **The traveler sees ONE all-in price** — fare plus that fee, as a single number. No
  itemised fee lines, no "processing" lettering, on any traveler screen.

`platformFee()` in `src/data.ts` and `platformFeeCents()` in `backend/payments.js` are the
two implementations of this, and `backend/payments.test.js` proves them equal to the cent
from $0 to $500. If any screen disagrees with them, the screen is wrong.

---

## 3. THE RUBRIC — the acceptance test for every screen and every string

> **"Is the design and language on this screen institutional, authoritative, and
> sophisticated?"**

This is not a mood. It is the test a screen has to pass before it ships, and it applies
to every screen and every string, not only the one being worked on.

Reference feeling: Apple, NASA, modern aviation systems, high-end financial software,
professional transportation infrastructure. **"Institutional" does not mean old-fashioned
government software.** It means modern, controlled, intentional and premium. And a screen
is not made institutional by being stiff — "Pursuant to your travel request" fails just as
hard. The traveler voice is plain English, precisely used.

### A screen fails the rubric if it

1. **Reassures.** "No surge", "no hidden fees", "price won't go up", "don't worry."
   Repeating that a price is trustworthy is what an app does when it expects to be
   doubted. State the price; let it carry itself.
2. **Editorialises.** "Quiet right now", "A little busy", "Great choice", "You're all
   set", "Almost there." Report the fact and stop.
3. **Apologises or chats.** "We couldn't work that out just now", "Let's go", exclamation
   marks, emoji, cute status text.
4. **Names a control after something other than what it does.** A "Travel ›" link that
   selects; a "Reserve Travel" button that reserves nothing; a chevron on a row that
   opens nothing.
5. **Shows a number without saying what it is.** An unlabelled amount; a bare "24 min"
   that could be journey time or operator ETA.
6. **Contradicts itself about money.** The single most serious defect there is. An amount
   and a doubt about that amount must never render together.
7. **Uses conversational shorthand where precision exists.** "MIA Airport" or "Miami
   Airport" where "Miami International Airport" is what the place is called.

### Language to avoid outright

Promotional, defensive, retail or startup register: "No hidden fees", "No surge pricing",
"Best prices", "Save more", "Ride smarter". Do not turn the economics into a marketing
claim — state them once, factually, where they are relevant.

### Two voices, one company

- **Traveler screens speak plain human English.** This is deliberate; it is called the
  "Friendly" decision.
- **Operator and internal screens use ARTS terminology** — Operator, Travel Number,
  Commissioned, In Service.
- **"Travel fare"** is the term for what a traveler pays. Not "trip fare", not "ride
  fare". "Travel Number" and transparent pricing appear on both sides.

---

## 4. The visual system

The reference is the founders' own web demo, matched hex for hex. Colours and radii live
in `src/theme.ts` and are never hardcoded at a call site.

| Token | Value | Use |
|---|---|---|
| paper | `#F7F7F5` | page ground |
| ink | `#14171F` | primary text, solid buttons |
| hairline | `#ECEBE6` | card borders, dividers |
| border | `#E3E2DC` | input borders |
| muted | `#8A8A82` | secondary text |
| faint | `#B4B3AB` | placeholders |
| blue | `#2E5FE0` | links only — "View profile ›", "See all", the step bar, tinted panels |

- **Cards:** white, radius 16, 1px hairline border, **no shadow.**
- **Buttons:** radius 13. Solid-ink primary, ghost secondary. **The only red button
  anywhere in the app is "Call 911".**
- **Type:** everything renders through `src/components/AppText.tsx`, never React Native's
  `Text` directly. It carries the demo's inherited letter-spacing and caps Dynamic Type
  scaling so iOS cannot resize a layout the demo cannot resize.
- **IBM Plex Mono is used ONLY for prices and trip/case numbers.** Everything else is the
  system font. Prices that sit in columns use tabular figures in the system font, not the
  mono.
- **Letterhead header on every screen:** hamburger · centred wordmark with the NATIONAL
  TRANSPORTATION tagline · thin person-outline icon. Never a filled initials circle.
- **Section labels:** quiet grey letterspaced uppercase — SUGGESTED TRAVEL, RECENT TRAVEL.
- **SUGGESTED TRAVEL is earned** from the traveler's real trips. It is never shown to a
  new account. No section exists as furniture.

### Avoid

Excessive rounded cards, unnecessary containers, gradients, glow, drop shadows, visual
clutter, gimmicky animation, cartoonish or overly playful UI, excessive icons, decoration
without function, generic SaaS design, marketing-scale typography inside an operational
interface, and any component that exists to fill empty space.

### Prefer

Strong typography, disciplined spacing, clear hierarchy, restrained borders, neutral
surfaces, 1px hairlines only where containment is genuinely needed, intentional
whitespace, precise alignment, meaningful motion, subtle state changes. Interfaces that
feel engineered rather than decorated.

**Every visible element must have a reason to exist.** If you cannot explain how an
element improves usability, hierarchy, comprehension, navigation, status awareness or
interaction, say so — it probably should not be there.

### Motion

The app should not feel static, but motion must be purposeful: explaining spatial
relationships and state changes, not decorating them. Sheets expanding from a logical
origin; information transitioning between states rather than disappearing; map elements
moving as travel progresses. Never animation for its own sake.

---

## 5. What is deliberately absent

Do not report these as gaps. Each was removed on purpose, and the reason matters:

- **The AI planner** ("Plan in your own words") — withdrawn 4 Sept 2026 by the founders.
  Not shipping at launch; possibly reintroduced later. The code survives in
  `src/withdrawn/` with no route.
- **Social sign-in** (Apple / Google) — removed for App Store review. Guideline 2.1
  rejects placeholder features, and 4.8 makes offering any third-party login oblige us to
  ship Sign in with Apple too.
- **Ratings** — no operator or traveler record carries a real rating, so every screen that
  displayed one was showing the same invented score to everybody. Removed until the data
  exists.
- **Surge pricing** — does not exist in the product, so it is not mentioned. The app does
  not advertise the absence of a thing it never had.
- **Vehicle inspection** — Florida does not require one, so it is not a qualification step.

---

## 6. What is genuinely not built yet

- Scheduled dispatch depends on a phone pinging the server; it needs an always-on
  scheduler.
- The fare model has never been validated against Uber or Lyft prices in Miami.
- The market is hardcoded to Miami in `src/data.ts`.
- The notification sound is the iOS default.
- The operator agreement has not been reviewed by a Florida attorney.

---

## 7. What we want from a review

Evaluate the app as a whole product, not screen by screen. Specifically:

1. **Flows, not just screens.** Where did the user come from, what are they trying to do,
   what is the primary action, what happens on failure, on empty, while loading, and if
   they change their mind? Where several screens should be one interaction — or one
   overloaded screen should be several steps — say so.
2. **The map.** It is a functional instrument, not wallpaper. Before matching, while
   matching, once an operator is assigned, during pickup, during travel and on arrival
   should not show the same furniture. Say what the map should be communicating at each
   stage.
3. **Every string against the rubric in §3.** Quote the offender and propose the
   replacement.
4. **Anything missing** that a complete, launchable transportation app needs and this one
   does not have — including things nobody here has thought to ask about.
5. **Anything that is wrong**, especially anything where two screens disagree with each
   other, and above all anything where two screens disagree about money.

Be specific. "This screen feels off" is not actionable; "this button is named for a thing
it does not do, and here is the name it should have" is.

If the instructions here are not precise enough to review against, say that too.
