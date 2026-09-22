# Going live — the exact configuration, and what genuinely blocks it

Written 17 Aug 2026, the night Stripe approved the account.

**The fare model, confirmed against the code (rule updated 9 Sept 2026).** The operator keeps
99% of the travel fare. American Rider takes 1% of the fare (no cap) plus the traveler's platform
fee — the greater of $1.50 and 5% of the travel fare, rounded up to the cent (Chad, 9 Sept 2026;
Adrian in writing, 13 Sept) — and that fee is what covers Stripe's processing. The traveler sees
ONE amount — fare + platform fee — and no fee line anywhere. Verified: `backend/payments.js
platformFeeCents()` and `src/data.ts platformFee()` agree at every cent from $0 to $500
(`backend/payments.test.js`), and no traveler screen renders the fee as anything but part of a
total. The table was recomputed with `platformFeeCents()` on 15 Sept 2026.

| fare | traveler pays | operator gets | platform take |
|---|---|---|---|
| $9.80 | $11.30 | $9.71 (99.08%) | $1.59 |
| $24.50 | $26.00 | $24.26 (99.02%) | $1.74 |
| $42.80 | $44.94 | $42.38 (99.02%) | $2.56 |
| $120.00 | $126.00 | $118.80 (99.00%) | $7.20 |

---

## 1 · Environment variables

### Render → american-rider-server → Environment

| Variable | Value | Without it |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_…` or `rk_live_…` | Already set, currently a **test** key |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_…` — **new, required** | The app cannot show a card sheet at all |
| `FIREBASE_SERVICE_ACCOUNT` | the whole service-account JSON | No support case or emergency alert reaches anybody; operator payouts cannot be set up |
| `SUPPORT_EMAIL` | the inbox a person watches | No alert; the record exists but nobody is told |
| `RESEND_API_KEY` | from resend.com | Same |
| `PUBLIC_APP_URL` | `https://american-rider-server.onrender.com` | Stripe onboarding returns to a guessed URL |
| `ANTHROPIC_API_KEY` | already set | Patron Support cannot assess anything |

`STRIPE_PUBLISHABLE_KEY` must be from the **same mode** as the secret key. The app reads both
from `GET /config` precisely so they cannot drift apart — never bundle the publishable key
into the build.

The service-account JSON is read raw, not through `readKey()`, so its internal whitespace
survives. Paste it whole.

### Verify, in one command

```bash
curl -s https://american-rider-server.onrender.com/health
```

Ready for live money looks like:

```
"stripe": "live"
"support": { "canReachAHuman": true, "firestore": "on", "email": "on" }
```

Right now it reports `"stripe": "test"` and `"canReachAHuman": false`.

### Deploy the security rules — they have never been deployed

```bash
firebase deploy --only firestore:rules,storage
```

Until this runs, lost items, messages, scheduled travel, photos and ride status updates are
all rejected, and they fail silently because every one of those writes is best-effort.

---

## 2 · What is built and what is not

**Built tonight, ready for a live key:**

- Card collection through Stripe's PaymentSheet — the card is entered on the phone and never
  touches our server. This replaced `/charge-ride`, whose own comment said "LOCAL TEST ONLY"
  and which sent the test card `pm_card_visa`. That path would have failed on **every** travel
  the moment a live key was installed.
- Saved cards, via a Stripe Customer keyed to the traveler's Firebase uid.
- Refunds that verify ownership against Stripe's own record before a cent moves.
- Operator payout onboarding (Stripe Connect Express) — `/connect/onboard`, `/connect/status`,
  and the operator's **Getting Paid** screen. Stripe holds the identity check and bank
  details; American Rider never sees them.
- In live mode the server **refuses to charge** a travel with no operator payout account, and
  says so, rather than taking money it cannot split 99/1.
- Every payment sentence now reads the server's real key mode, so no screen can say "payments
  are simulated" while money moves, or the reverse.

**Not built, and each one blocks real money:**

1. **Dispatch does not know which operator can be paid.** The fleet in the `operators`
   collection is seeded and is not linked to operator accounts, so matching can still assign a
   travel to an operator with no payout account. In live mode the charge is then correctly
   refused — but the traveler has already asked to travel. This is
   [OPEN-DECISIONS §4](OPEN-DECISIONS.md) and it is now the top blocker.
2. **The Terms say payments are simulated.** "During the testing period every payment is a
   simulation — nothing is actually charged" becomes false on day one, and the Terms are still
   awaiting the Florida attorney.
3. **Render is on the free tier.** It sleeps after ~15 minutes; a traveler tapping Reserve
   Travel waits ~50 seconds or times out mid-payment. $7/month, and this is the moment it
   stops being optional.
4. **No real operators are recruited, insured, or background-checked.**
5. **Trademark clearance is unstarted** — EPG Media holds a federal registration on
   "AMERICAN RIDER".

---

## 3 · A pricing decision you should make before the key goes in

> **Resolved 9 Sept 2026.** Chad chose a rising fee — the greater of $1.50 and 5% of the travel
> fare — so no fare loses money on a US or an international card (the arithmetic is in
> docs/ECONOMICS-AND-INFRASTRUCTURE.md §2). The analysis below put the question and is kept as
> the record of why; "absorb it" and "raise the flat fee" were not chosen.

**Under the flat $1.50 fee, any card fare above $60.75 lost American Rider money.**

Stripe's card fee is 2.9% + 30¢ of the **total**; the take was 1% + a flat $1.50 of the **fare**. The
fee curve is steeper, so they cross. Two bookable combinations are already past it —
Fort Lauderdale Airport in Premium ($60.78) and Large Vehicle ($66.34) — and distance-based
pricing for real addresses has no ceiling at all. A $120 card fare nets **−$1.12**.

ACH is profitable at every fare ($1.50–$1.73), which is why bank is already the default and
sits first in the list.

Options, none of which I should pick for you:

- **Absorb it.** Long card travel is rare; short travel cross-subsidises it. Costs nothing to
  implement and keeps the one-price promise perfectly intact.
- **Raise the flat fee.** $1.50 → $2.00 moves the break-even to about $86. Simple, visible,
  and it raises the price of every short travel to fix a rare long one.
- **Bank-only above a threshold.** Keeps every price intact but removes a payment choice at
  exactly the moment a traveler is spending most.

My recommendation is **absorb it and watch it**, because the one-all-in-price promise is the
company's whole differentiation and 85¢ on a rare journey is a cheap way to keep it. But you
should decide that knowingly rather than discover it in a Stripe statement.

---

## 4 · The order I would do this in

1. **Roll the live key Chad sent over WhatsApp.** It costs nothing now, since nothing uses it.
   After go-live, rolling means an outage.
2. **Set `FIREBASE_SERVICE_ACCOUNT`, `SUPPORT_EMAIL`, `RESEND_API_KEY`.** With real money, a
   billing dispute must reach a person. Today it reaches nobody.
3. **Deploy the security rules.**
4. **Upgrade Render to the $7 tier.**
5. **Decide §4** — operator identity on the account. Everything else waits on it.
6. **Test the whole loop with `sk_test_` and Stripe's test card `4242 4242 4242 4242`**,
   including an operator completing Connect onboarding in Stripe's test mode.
7. **Rewrite the Terms and get the attorney's review.**
8. **Then** swap in the live keys, and watch `/health` say `live` and `canReachAHuman: true`.

Steps 1–4 are yours. 5 is a decision. 6 I can drive. 7 is the lawyer. 8 is two env vars.
