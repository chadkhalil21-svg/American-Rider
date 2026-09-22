# American Rider — The Legal Stuff, Plain English (Don't Panic)

**Read this first:** You do **not** have to become a legal expert, and you do **not** write
any of this yourself. The legal side is basically two things:
1. **A lawyer writes a few documents once** (Terms, Privacy, Operator Agreement).
2. **You sign up with vendors who handle the rest** (background checks, payments, insurance).

For the **demo** you're showing people right now, you need **none** of this. All of it is a
"before real strangers pay real money" checklist — normal, bounded, and mostly done by other people.

---

## The 5 buckets of "legal stuff" — and who actually handles each

### 1. Set up the company (one-time paperwork)
- **LLC** — a legal wrapper that keeps your personal stuff (house, savings) separate from the business if anything ever goes wrong. Recommended once real money moves.
- **EIN** (a tax ID for the business) + a **business bank account**.
- **Register as a TNC** (Transportation Network Company) with **Florida (DHSMV)** — a state form.
- **Who handles it:** you + a lawyer, or an online service (LegalZoom-type). A few hundred dollars. **Not the app.**

### 2. The documents every app has (a lawyer writes these once)
- **Terms of Service** — the rules riders agree to.
- **Operator Agreement** — the rules drivers agree to (incl. "you're an independent contractor" and "you carry your own insurance").
- **Privacy Policy** — how you handle people's data and location.
- **Who handles it:** a lawyer writes them (or a template + lawyer review). **The app just shows them + a checkbox.** We already have the "you agree to Terms & Privacy" line at sign-up; the real words get dropped in later.

### 3. Driver safety & eligibility (required by Florida law — HB 221)
- **Background check** — legally required. A vendor (**Checkr**, GoodHire) runs it; the driver pays via a link. ~$30–50.
- **Commercial "for-hire" insurance** — drivers need their own, because American Rider doesn't insure the trip. The app **verifies** it during sign-up.
- **Basics** — 18+, valid license, vehicle registration + inspection.
- **Who handles it:** the vendors + the drivers themselves. **The app has the onboarding/verification flow** (already built).

### 4. Handling the money
- **Stripe** (specifically **Stripe Connect**) is the licensed money-mover. Because you use Stripe, **Stripe carries the money-transmitter legal burden** — you don't become a bank, and you don't hold people's money.
- **Who handles it:** Stripe. You just connect it.

### 5. Consumer protection (mostly already handled *in the app*)
- **Transparent pricing** — one all-in price, no hidden fees. ✅ done.
- **Clear cancellation policy** — lives in Patron Support. ✅ done.
- **Accessibility** — wheelchair-accessible vehicle option + ADA-friendly design. ✅ mostly done.
- **Safety features** — share your trip, 911 button, "verify it's your car" word. ✅ done.

---

## What the app needs for legal — where we stand

| Item | In the app? |
|---|---|
| "I agree to Terms & Privacy" at sign-up | ✅ line is there (real documents dropped in later) |
| Driver document verification (license, registration, inspection, insurance, identity) | ✅ built |
| One transparent all-in price | ✅ done |
| Safety tools (share trip, 911, verification word) | ✅ done |
| Support / dispute-resolution flow | ✅ done |
| **About / Legal screen** to actually display Terms, Privacy, Licenses | ⭕ easy to add (lawyer fills the words) |
| **Background-check consent** step in driver sign-up (a checkbox + short explanation) | ⭕ add |
| **Location / data permission** prompt on first use | ⭕ add |
| Insurance step should confirm it's **commercial / for-hire** coverage (not just "has insurance") | ⭕ tighten wording |

The ⭕ items are small app additions — the *containers* are quick to build; the actual legal
*words* inside them come from your lawyer before launch.

---

## What YOU personally do about legal (the whole list)
1. Later — not now — **hire a lawyer once** to write the 3 documents and eyeball the money flow. (A few hundred to a couple thousand dollars.)
2. **Sign up with the vendors** (Stripe, a background-check company) — mostly filling out forms.
3. **File the company paperwork** (LLC + Florida TNC registration).
4. That's it. Everything else is the app (built) or the vendors (their job).

---

## Important
This is a plain-English explanation, **not legal advice.** A licensed lawyer confirms the
specifics for your exact situation before you launch for real. But nothing here is exotic —
it's the same checklist every rideshare company completes, and it's very doable in order.

---

## The partner's cost-cutting + compliance checklist (added 2026-07-10, from WhatsApp)

### Free or near-free — do these
- **Florida trademark** — $87.50 state filing. Common-law trademark rights are already active just by using the name.
- **DIY federal trademark filing** — can file without a lawyer.
- **"Independent contractor" language in the Operator Agreement/ToS** — standard and free. ⚠️ His caveat (correct): the words are *necessary but not sufficient* — actual day-to-day practices (drivers set own hours, own cars, can decline rides) matter more against misclassification claims than the sentence does.
- **Stripe PCI scope reduction** — a BUILD-TIME architecture choice, no extra cost: use Stripe's hosted fields (Elements/Checkout) so card numbers NEVER touch our servers — Stripe holds them. This keeps American Rider out of heavy card-security compliance scope. **→ Backend requirement: build payments this way from day one.**

### The one place to actually spend money (his "one non-negotiable line item")
- **Business Owner's Policy (BOP)** — bundles general liability + cyber in one policy. For a two-person, low-revenue startup: **~$65–100/month combined**; general liability alone can be as low as $30–43/mo, cyber as low as $35/mo for a low-data-exposure early-stage business. A real "pilot phase" cost — cheap, not thousands-per-year. His framing: this is the ONE non-negotiable spend; everything else on the list is legitimately reducible or deferrable. Reasoning (sound): the scenario that ends the business is a real injury claim against an unfunded, undocumented company — this is the cheap protection against exactly that.
- Note: this BOP is the *company's* coverage (slip-and-fall, data breach, general business liability). It does NOT replace the drivers' own commercial for-hire auto insurance — that stays a driver requirement, verified at onboarding.

### Backend build requirements (bake in from day one — cost ≈ $0 if done at build time)
1. **Approval audit log** — every driver-approval decision gets logged: timestamp, what the background check returned, what the insurance check returned, what the AI/rule decided. Protects against any challenged decision ("documented, consistent process" vs. "we can't say why"). **Build into the verification pipeline BEFORE launch, not after.**
2. **Encryption in transit (TLS/HTTPS)** — free; Netlify already serves the demo over HTTPS by default ✅ (confirmed — the live link is https://). For the real backend, same default on any modern host.
3. **Encryption at rest** — a checkbox on modern hosted databases (Supabase / cloud Postgres), not an engineering project. Turn it on.
4. **MFA on admin/company accounts** — baseline.
- Bonus effect: encryption + MFA are what cyber insurers require for competitive quotes — doing them makes the insurance line item CHEAPER.

---

## Coverage & Compliance — the hard gate + how to talk about it (added 2026-07-23)

Came out of a call: Chad flagged that another rideshare app is in serious legal trouble over
insurance. The name is uncertain and doesn't matter — the **pattern** is what counts, and it
cuts two ways for us.

### The real mechanism (why "your personal assets could be at risk" is a true fear)
A normal **personal** auto policy usually **excludes driving for money.** The moment an operator
picks up a paying rider, a personal policy can deny the claim. If they crash while not carrying
proper **commercial / for-hire** coverage, the injured party can come after the operator
**personally** — their savings, car, assets. That is exactly the exposure a sketchy platform
leaves its operators in. It's a real risk, not a scare tactic.

### American Rider's honest position (what's TRUE and safe to say)
- We do **not** insure the ride ourselves. The **operator carries their own commercial for-hire
  insurance, and the app verifies it at sign-up** (already the onboarding model — see bucket #3).
- The protection we offer operators is **requiring and verifying real coverage** — so they're
  operating legally and aren't the one left holding the bag after an accident.
- The **company** carries its own **Business Owner's Policy** for *its* liability (see the
  checklist above) — separate from the operators' auto coverage.

### Say this / not that (operator-facing copy)
- ✅ "American Rider requires and verifies commercial for-hire insurance, so you're covered the
  way the law expects — not exposed under a personal policy."
- ✅ "Ask any platform whether they actually check that you carry real commercial coverage.
  Driving for money on a personal policy is how operators end up personally on the hook."
- ❌ "American Rider insures you / covers your rides." — **We don't.** The operator's policy does.
- ❌ "[Competitor] has no insurance, so your assets can be seized." — Don't name a competitor with
  a specific legal claim: legally risky, and possibly inaccurate. Educate; don't accuse.
- ❌ Anything implying coverage we don't have **yet.** State company-level coverage only once real.

(This is the coverage sibling of the fee-messaging rule: be accurate, don't over-claim, don't
mislead. Same discipline, different topic.)

### The hard gate — no real rides until this is true
No real money / real rides until BOTH:
1. **The company's own compliance is in place** — BOP insurance, **Florida TNC registration**, **LLC**.
2. **The operator-insurance verification step is live and actually enforced** — not just a checkbox.

The competitor currently in legal trouble is the live example of what skipping this costs. The
only reason American Rider isn't in that same ditch today is that no real rides have happened yet.
Once coverage + compliance are real, **"fully insured operators, state-compliant platform" becomes
a genuine, truthful selling point** — the version of Chad's instinct that sells *and* keeps us out
of the headlines.

### Written operator insurance disclosure (added 2026-07-29)
Florida (§ 627.748) requires the platform to give each operator a **written** insurance
disclosure **before their first ride**: (1) the coverage the platform provides, and (2) a warning
that their personal policy may not cover them while driving. A plain-English **draft** now lives at
`docs/OPERATOR-INSURANCE-DISCLOSURE.md` — marked DO-NOT-USE-YET, with the platform's $1M policy
details left as blanks until that policy actually exists and a lawyer + FL broker finish it.
Coverage periods (verified): **Period 1** (app on, waiting) = $50k/$100k injury + $25k property +
PIP/UM, carried by the operator (rideshare endorsement); **Periods 2–3** (accepted ride →
drop-off) = **$1,000,000 primary**, carried by the platform.
