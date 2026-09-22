# American Rider — The Game Plan (start here)

The single "here's everything" overview for Adrian & Chad. Read this first; the detailed
docs are linked at each step.

---

## Where we are today (2026-07-13)

✅ **The demo is complete.** A polished, clickable prototype that proves the entire product —
flow, design, the penny-accurate 99% money math, the logo, dark mode, and the differentiators
(Smart Travel, Find-My arrow, predictive routing). It's the blueprint the real app copies.

✅ **Stripe account created** (test mode) and the **core payment code written & verified** —
the 99% / 1% split and the platform fee (the greater of $1.50 and 5% of the travel fare,
since 9 Sept 2026) work to the penny (`backend/payments.js`).

The demo's job is done. Everything below is turning that proven demo into a real, launchable app.

---

## The path to live (7 stages)
*Full detail + who-does-what + time/cost in [ORDER-OF-OPERATIONS.md](ORDER-OF-OPERATIONS.md).*

0. **Setup** — free/cheap accounts (Stripe ✅, Firebase, Google Maps, Apple $99, Google Play $25) + the **LLC**.
1. **Real app + accounts** — turn the web demo into a real mobile app with real login.
2. **Payments** — Stripe Connect: charge, split 99/1, operator bank onboarding, payouts. *(started)*
3. **GPS & Maps** — real location, live tracking, and fares from **real distance + traffic**.
4. **Matching** — the dispatch engine that connects a nearby operator to a traveler live.
5. **AI layer** — predictive routing, Smart Travel planning, verification, translation, fraud checks.
6. **Public transit** — trip *planning* early; in-app *ticket buying* is a partnership-dependent fast-follow.

Then: **go-live gates → App Store review → launch one city (Miami), operators first.**

---

## The must-haves before the FIRST real ride (non-negotiable)
*Why these matter + costs in [LAUNCH-READINESS.md](LAUNCH-READINESS.md).*

- 🔴 **LLC** — the company; protects your personal assets.
- 🔴 **Rideshare (TNC) registration** — legally required to operate in most states (Florida included).
- 🔴 **Rideshare insurance** — the 3-period commercial policy (~$65–100/mo).
- 🔴 **Background checks + vehicle inspections** — real vendor screening before anyone drives.
- 🔴 **A cold-start plan** — one city, sign up operators *first*, then travelers.

*None of these block building/testing — you build in Stripe test mode with fake money first. They gate the switch to real money + real rides.*

---

## Who does what
- 🧑 **You / Chad** — own the accounts (Stripe, Apple, hosting), the LLC, insurance, and the launch decision. Chad is covering the $99 Apple fee.
- 🤖 **Claude / a developer** — writes the code (app + backend + Stripe + maps + matching).
- 🏢 **Services** — Stripe (payments), Firebase (accounts/backend), Google Maps (GPS), a transit-ticketing partner (fast-follow).

## What it costs
- **To start: almost nothing.** Stripe/Firebase/Maps are free at pilot volume; Apple $99, Google $25.
- **The real investment** is the **build** (developer time — weeks/months) + **insurance** + the **LLC**. Stripe/Maps only cost money once real rides flow, and the **platform fee is designed to cover them.**
- **Timeline: a few months** to a proper launch — mostly the build + the legal/insurance gates + the transit partnership. Not weeks.

---

## The full doc library
| Doc | What it covers |
|---|---|
| [ORDER-OF-OPERATIONS.md](ORDER-OF-OPERATIONS.md) | The stage-by-stage build path (who/time/cost) |
| [LAUNCH-READINESS.md](LAUNCH-READINESS.md) | Everything still to consider — legal, language, capabilities |
| [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) | Done / demo-only / needs-building for every piece |
| [PAYMENTS-PLAIN.md](PAYMENTS-PLAIN.md) | How Stripe payments actually work |
| [FARE-MODEL.md](FARE-MODEL.md) | The exact fare numbers and margins |
| [MAPS.md](MAPS.md) | How maps/GPS work and what they cost |
| [LEGAL-PLAIN.md](LEGAL-PLAIN.md) | Plain-English legal + the low-cost checklist |
| [ROADMAP-PLAIN.md](ROADMAP-PLAIN.md) | Stage 0–3 roadmap |
| [V1.0-SPEC.md](V1.0-SPEC.md) | Chad's institutional design spec |

---

## When you're ready to resume — the next 3 moves
1. 🧑 **File the LLC** (unblocks real money + protects you).
2. 🧑 **Create the free Firebase + Google Maps accounts** (send me the keys, test mode).
3. 🤖 **I scaffold the backend + a live fake-money test charge** you can watch in your Stripe dashboard.

Everything is proven, documented, and ready. The demo did its job — now it's the real build, one stage at a time, whenever you and Chad are ready to go.
