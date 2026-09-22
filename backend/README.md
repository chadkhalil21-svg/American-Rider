# American Rider — Server (plain-English guide)

This folder is the **server**: a small program that runs on a computer you control (not on
anyone's phone). Its whole job is to do the things the app is not allowed to do itself —
most importantly, **hold the Stripe secret key and charge cards**.

## Why the app can't just do payments itself

The secret key is like the master key to your Stripe account. If it were inside the app,
anyone who downloaded the app could dig it out and charge cards as you. So the rule (Stripe's
rule, everyone's rule) is: **the secret key lives only on the server.** The app asks the server
to start a payment; the server does the sensitive part.

## What's in here

- `server.js` — the server. Answers requests from the app.
- `payments.js` — the money math + the actual Stripe charge (99% to operator, 1% + the platform fee to us — the greater of $1.50 and 5% of the fare).
- `matching.js` — the operator-matching logic (already proven).
- `regions.js` — where the company operates: one record per service region (its box, its clock, its transit planner, its agency fares). The market gate, routing, Smart Travel and the fee ledger all read it; nothing else names a place.
- `fees.js` — government per-travel fees (an airport's or a port's per-pickup charge), fenced to a box and passed through whole to the public body; `remittance.js` sums what is owed to each for a month.
- `streets.js` — how a car actually gets from A to B: the region's OSRM if one is set, else its OpenTripPlanner street graph, else the straight line.
- `.env.example` — a template for your secret settings. **You copy this to `.env` and paste your key.**
- `.env` — your real secrets. **Never committed, never shared.** (git is set up to ignore it.)

## How to run it (first time)

1. **Add your key.** Copy `.env.example` to a new file called `.env` in this folder, then paste
   your Stripe **test** secret key (starts with `sk_test_`) after `STRIPE_SECRET_KEY=`.
2. **Install.** In this folder, run `npm install` (one time).
3. **Start.** Run `npm start`. You'll see:
   `American Rider server listening on http://localhost:4242  (Stripe: test)`

Leave it running while you test.

## What it can do

- `GET /health` — "am I alive?" (no charge)
- `POST /quote` — the price breakdown for a ride (no charge, just math)
- `POST /create-payment-intent` — the **real app flow**: starts a payment and hands it back to the
  app, which collects the card on the phone. Card details never touch this server.
- `POST /charge-ride` — a **test-only** shortcut that charges a fake Stripe test card straight from
  here, so we can prove payments work without needing a phone. The real app never uses this.

## Still to do before real money (honest list)

- **Verify the traveler.** Right now the endpoints trust whoever calls them. Before going live,
  the server must check the caller's Firebase login so only a signed-in traveler can be charged.
- **Onboard operators to Stripe.** The automatic 99% split needs each operator to have a Stripe
  connected account. Until then, a payment still works — it just isn't split yet.
- **Put the server online.** Right now it only runs on your computer. To work for real users it
  needs a home on the internet (a small monthly cost). That's a later step.
