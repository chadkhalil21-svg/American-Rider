# American Rider — Demo → Live: Order of Operations (one page)

How we get from the clickable demo to a real app in the App Store. Each stage lists **what it
is**, **who does it** (🧑 you/Chad · 🤖 me/dev · 🏢 a service), and **rough time/cost**.
Stages overlap; the honest total to a proper launch is **a few months**, not weeks.

Companion to [PAYMENTS-PLAIN.md](PAYMENTS-PLAIN.md), [MAPS.md](MAPS.md),
[LAUNCH-READINESS.md](LAUNCH-READINESS.md).

---

### Stage 0 — Setup (a few days · ~$130 total)
- 🧑 Create accounts (mostly free): **Stripe** (free), **Firebase** (free), **Google Maps**
  (free credit), **Apple Developer** ($99), **Google Play** ($25 one-time, optional).
- 🧑 **LLC** — can wait through the build, but needed before real money/real rides. Cheap.
- 🤖 I need from you: Stripe **test** keys, the Firebase project, the Maps API key.

### Stage 1 — Real app + accounts (build)
- 🤖 Turn the demo into a real **mobile app** (the App Store won't take the web demo) with real
  **sign-up/login** that remembers people (Firebase).
- 🧑 Test it on your phone via **TestFlight** (free) — you + Chad + a few operators.

### Stage 2 — Payments (Stripe Connect — test mode first)
- 🤖 Charge the traveler, **auto-split 99% to the Operator / 1% + the platform fee to American Rider**, operator bank + ID setup (KYC),
  payouts, refunds — all in **test mode (fake money)** so we prove it at zero cost/risk.
- 🧑 Flip to **real money** once the LLC + insurance are in place.

### Stage 3 — GPS & Maps  ← *your "GPS" question*
- 🤖 The operator's **phone GPS + Google Maps** give real location, the moving car on the map,
  turn-by-turn, live ETA, and — importantly — **the fare calculated from the REAL distance and
  time**, not the placeholder numbers. This is where "the price is set by length + traffic"
  becomes true.
- 🏢 Google Maps (free at pilot volume; the platform fee covers it at scale).

### Stage 4 — Matching engine (dispatch)
- 🤖 Find the nearest available operator, offer the ride, connect the two live. This is the
  heart of a rideshare.

### Stage 5 — The AI layer  ← *your "AI" question*
Honest version: at launch, "AI" = **smart use of live data + our logic**, not magic. Concretely:
- 🤖 **Predictive traffic & routing** — reads Google's live traffic to route around jams and
  quote honest ETAs.
- 🤖 **Smart Travel planning** — stitches car → rail → car into one trip (see Stage 6).
- 🤖 **Operator verification** — checks IDs/documents at onboarding.
- 🤖 **Auto-translating chat + support** — traveler and operator each in their own language.
- 🤖 **Fraud checks** — flags fake rides, GPS spoofing, stolen cards.
- *Deeper custom AI (better matching, demand prediction) layers in later, once we have real ride
  data to learn from. You can't train it before you have rides.*

### Stage 6 — Public transit access  ← *your "public transportation" question*
This is the standout feature, and it has **two parts** with very different difficulty:
- 🤖 **Planning + schedules** (show the car→rail→car route and times) — doable earlier using
  public transit schedule data (Google Transit / GTFS feeds).
- 🏢 **Buying the ticket in-app** (the QR pass in the Wallet) — this needs a **partnership with
  the transit agency's ticketing provider** (Token Transit / Masabi + e.g. Miami Metrorail).
  It depends on *them* saying yes, not just our code — so it's realistically a **fast-follow
  (v1.1)** after the core rideshare is live, not day one.

### Go-live gates (before the first real ride)
- 🧑 **LLC + insurance + background checks + rideshare (TNC) registration** — legally required
  to put strangers in cars; Apple may ask to see them.
- 🏢 **App Store review** — a few days, extra scrutiny for rideshare apps.
- 🧑 Launch **one city (Miami), operators first** — seed the supply side before travelers.

---

## The three you asked about, in one line each
- **AI** — mostly live-data + logic at launch (traffic, planning, verification, translation);
  custom ML comes after we have ride data. Built across Stages 3–5.
- **GPS** — the operator's phone + Google Maps; turns on real tracking, ETAs, and real-distance
  fares. Stage 3.
- **Public transit** — *planning* comes early; *in-app ticket buying* is a partnership-dependent
  fast-follow. Stage 6.

## One line for Chad
> Path is: set up accounts (mostly free) → build the real app + accounts → payments in test mode
> → GPS/maps → matching → the AI & transit differentiators → legal gates → App Store → launch
> Miami. A few months done right; the demo already proves every screen and the math.
