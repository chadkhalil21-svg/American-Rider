# American Rider — How Payments Will Actually Work (Plain English)

The demo *shows* money moving; nothing real happens yet. This is the plan for the real
thing — the **Stripe Connect** build that turns the demo into a business that can legally
charge travelers and pay operators. Written so you and Chad can both follow it.

Companion to [FARE-MODEL.md](FARE-MODEL.md) (the exact numbers) and
[LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) (where this sits in the plan).

> **Updated 15 Sept 2026:** the platform fee is no longer a flat $1.50. Since 9 Sept 2026 it is
> **the greater of $1.50 and 5% of the travel fare** (Chad; confirmed in writing by Adrian,
> 13 Sept) — so every example below, all at fares under $30, still comes to exactly $1.50, and a
> $100 fare carries a $5.00 fee. The 1% commission has no cap. Accounts, payments and receipts
> are built and running in Stripe test mode; `CURRENT_HANDOFF.md` has the current state.

---

## The big idea

**Stripe Connect** is the money engine built for exactly this — a *marketplace* where one
company (us) collects money from one group (travelers) and pays another group (operators),
keeping a cut. Uber, Lyft, DoorDash, and Airbnb all run on this same kind of setup.

We never hold the money ourselves in a bank we manage, and **we never see or store card
numbers** — Stripe does all of that. That keeps us safe and legal (it's called PCI
compliance; Stripe handles it so we don't have to).

---

## One-time setup (before anyone's first ride)

**The operator** — during sign-up:
1. Connects their **bank account** (where their 99% gets paid).
2. Passes an **identity check** — legal name, address, date of birth, sometimes SSN/photo ID.
   Stripe requires this by law before anyone can receive money (it's called **KYC** — "Know
   Your Customer" — anti-fraud/anti-money-laundering rules). No verification, no payouts.

**The traveler** — during sign-up or first ride:
- Adds a **card or bank account** in a secure Stripe form. We only ever see "Visa ••4417,"
  never the real number.

---

## What happens on a single ride

Say the travel cost is **$24.50**, so the traveler pays the all-in **$26.00**:

1. **Traveler taps "Confirm Travel."** Stripe charges their card **$26.00**. The money lands
   in our platform's Stripe account, not our bank.
2. **Stripe splits it automatically:**
   - **$24.26 (99% of the travel cost)** is earmarked for the **operator**.
   - **We keep $1.74** — the **1% commission ($0.24)** + the **$1.50 platform fee** (the
     greater of $1.50 and 5% of the travel fare; at $24.50 that is $1.50).
3. **The operator's balance goes up by $24.26** — the moment the ride completes. This is real
   money now sitting in *their* Stripe balance, waiting to be paid out.
4. **Out of our $1.74, Stripe takes its processing fee** (roughly a card fee of ~2.9% + 30¢).
   That's what the **platform fee is designed to absorb** — see ECONOMICS-AND-INFRASTRUCTURE §2 for the exact margins
   (thin on card, healthy on bank/ACH).

The traveler always sees **one price ($26.00)** — never the split. The operator always keeps
**99% of the travel cost** — untouched by fees.

---

## Withdrawals (the operator getting paid)

The operator's earned balance can reach their bank two ways:
- **Standard payout** — free, arrives in ~1–2 business days. Can be automatic (daily) or
  on-demand.
- **Instant payout** — arrives in minutes, small fee (this is the demo's "$0.50 instant" line).

When they tap **"Withdraw"** in the real app, Stripe moves the money from their Stripe balance
to their real bank account. (In the demo today, that button just sets a number to zero — no
money moves.)

---

## When something goes wrong

- **Refunds** — if a traveler is overcharged or a ride goes wrong, we refund through Stripe;
  the money returns to their card. We decide our refund policy (e.g., wrong route → refund the
  difference).
- **Disputes / chargebacks** — if a traveler tells their bank "I didn't authorize this,"
  Stripe manages the dispute process. We need a simple way to respond with the trip record.
- **Failed charges** — card declined, insufficient funds → the ride doesn't start, traveler is
  asked to fix their payment method.

---

## Taxes (don't forget this one)

Operators are independent contractors, so at year-end we (via Stripe) issue them a **1099** and
an in-app **earnings summary**. Stripe Connect can generate these automatically — one less thing
to build by hand.

---

## What we actually need to build

| Piece | Plain English |
|---|---|
| Stripe Connect account | Our platform account + turning on "Connect" |
| Operator onboarding | The bank-connect + ID-verification flow (Stripe provides ready-made screens) |
| Traveler card entry | Secure Stripe card form (never touches our servers) |
| Charge on confirm | Charge the all-in price when a ride is confirmed |
| Auto-split | Route 99% to operator, keep 1% + the platform fee |
| Payouts | Standard + instant withdrawal to the operator's bank |
| Refunds & disputes | Buttons + a simple back-office to handle them |
| Receipts + 1099s | Emailed receipts; year-end tax forms |

---

## Effort & cost

- **Effort:** This is the single biggest real-build job — realistically a few weeks for an
  experienced developer to do properly (onboarding + charging + splitting + payouts + refunds +
  testing). It's the heart of the business, so it's worth doing carefully.
- **Cost to us:** No monthly fee to use Stripe — they take a **per-transaction cut** (the
  processing fee the platform fee is built to cover). At small volume it's effectively pay-as-you-go.
- **Order:** Build this right after (or alongside) **accounts** — it needs a logged-in operator
  with a verified bank before payouts can work.

---

## One paragraph for Chad

> Payments run on **Stripe Connect** — the same rails Uber and DoorDash use. Travelers pay one
> all-in price; Stripe charges the card, auto-splits **99% to the operator** and our **1% + the
> platform fee** to us, and pays operators out to their own bank (after a required identity + bank
> verification). We never see card numbers, so we stay PCI-safe. The platform fee is built to absorb
> Stripe's processing fee. It's a few weeks of real build, it's the core of the business, and
> the demo already proves the exact flow and the math it needs to reproduce.
