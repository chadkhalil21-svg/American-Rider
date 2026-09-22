# American Rider — Launch Checklist (Demo → Real Product)

Plain-English shared to-do list for Adrian & Chad. Each item is marked:

- ✅ **DONE** — built and working in the demo
- 🟡 **DEMO-ONLY** — looks real, but it's simulated; needs the real version built
- 🔴 **NEEDS BUILDING** — doesn't exist yet

The demo is the **storefront**. This checklist is the **engine** behind it.
The short version: *we've built the cockpit; now we need the plane.*

---

## STAGE 1 — Make it actually work (the engine)
*Nothing about the business is real until these five exist. This is the priority.*

| Item | Status | Plain English | Tool |
|---|---|---|---|
| **Design & flow** | ✅ DONE | The whole look, feel, screens, navigation, dark mode, language | — |
| **Fare math** | ✅ DONE | 1% of the travel fare + the platform fee (the greater of $1.50 and 5% of the fare, since 9 Sept 2026), operator keeps 99%, penny-accurate | — |
| **Accounts / login** | 🔴 NEEDS BUILDING | Sign up once, it remembers you. Right now nothing is saved. | Firebase Auth |
| **Payments** | 🔴 NEEDS BUILDING | Actually charge the traveler, actually pay the operator 99%. **This IS the business.** | Stripe Connect |
| **Maps + GPS** | 🟡 DEMO-ONLY (hand-drawn map) | Real location, real routing, real ETA, fare from *actual* miles/minutes | Google Maps |
| **Live matching** | 🟡 DEMO-ONLY (on a timer) | The system that finds a nearby operator and connects you live. The heart of a rideshare. | Backend + Firebase |
| **A real app** | 🔴 NEEDS BUILDING | On the App Store / Google Play, with working push notifications | Flutter / Expo |

---

## STAGE 2 — Trust, safety & legal
*What makes a stranger comfortable getting in the car — and keeps us out of trouble.*

| Item | Status | Plain English |
|---|---|---|
| **Operator verification** | 🟡 DEMO-ONLY (badge only) | Real ID + background check + license/insurance upload before anyone can drive |
| **Insurance** | 🔴 NEEDS BUILDING | The ~$65–100/mo policy Chad called non-negotiable |
| **Legal entity (LLC)** | 🔴 NEEDS BUILDING | The company itself, so contracts and bank accounts are in its name |
| **Terms of Service + Privacy Policy** | 🔴 NEEDS BUILDING | The fine print every real app needs |
| **Independent-contractor agreement** | 🔴 NEEDS BUILDING | Protects the "operators keep their autonomy" model (the whole point) |
| **Emergency / safety path** | 🟡 DEMO-ONLY | Share-ETA and Safe Travels exist as screens; the 911 button must really work |
| **Complaints / refunds / lost items** | 🔴 NEEDS BUILDING | A real way to handle it when something goes wrong |

---

## STAGE 3 — The back office
*The part riders never see, but you cannot run a marketplace without it.*

| Item | Status | Plain English |
|---|---|---|
| **Admin dashboard** | 🔴 NEEDS BUILDING | Where you & Chad approve operators, watch for fraud, issue refunds, and see what's happening. **A marketplace can't run blind.** |
| **Data security** | 🔴 NEEDS BUILDING | Encryption + never touching card numbers ourselves (Stripe handles cards) |

---

## STAGE 4 — Professional polish
*Fast wins once the engine exists.*

| Item | Status | Plain English |
|---|---|---|
| **Spanish** | 🔴 NEEDS BUILDING | Chad said today's operators are Spanish speakers — do this first |
| **Other languages** | 🔴 NEEDS BUILDING | French, German, Arabic (right-to-left), Mandarin |
| **Larger-text accessibility** | 🔴 NEEDS BUILDING | For elderly / low-vision travelers |
| **Real emailed receipts** | 🟡 DEMO-ONLY | Receipt screen exists; needs to actually send |
| **Persistent ratings** | 🟡 DEMO-ONLY | Stars show, but don't yet save or affect matching |
| **Notification sounds + dark mode** | ✅ DONE (traveler) 🟡 (operator) | Traveler side done; rolling onto operator + unified next |

---

## Suggested order (what to build first)

1. **Accounts** → **Payments** → **Maps** → **Matching** — the four that make it real. Build them in this order; each one leans on the last.
2. **Turn it into a real phone app** (App Store / Google Play).
3. **Verification + insurance + LLC + terms** — before the first real paid ride with a stranger.
4. **Admin dashboard** — the moment there's more than a handful of operators.
5. **Spanish + accessibility** — as soon as the core works.

---

## One honest sentence for Chad

> The demo proves the product and the pricing. Stage 1 (accounts, payments, maps, matching) is the real build — everything else is polish and paperwork that can happen alongside it.
