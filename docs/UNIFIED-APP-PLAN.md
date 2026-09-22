# American Rider — One App, Two Roles (unified plan)

Source: architecture + UX assessment, 2026-07-07. The rider app (App 1) and driver
app (App 2) merge into ONE app with a login + role system. Both specialists confirmed
it's feasible with no blocking risks.

## Verdict
- The two apps share ~85–90% of their design and the **identical fee math** (rider
  "keeps $24.26" == driver "you keep $24.26", both `floor(min(1%, $1))`). They are two
  views of one ride, not two products.
- Build the unified app in the **real RN/Expo app** (`american-rider/`), not a merged
  HTML file. The rider half exists; the driver half is a medium port; auth/role is the
  only genuinely new work. Keep the HTML demos as shareable marketing views only.

## Account model (single account, two profiles)
```
Account: id, name, email, phone, roles: ['traveler'|'operator'...],
         activeMode: 'rider'|'driver',
         verificationStatus: 'none'|'pending'|'commissioned'|'suspended'
Traveler Profile: saved places, payment methods, comfort prefs, history, rating, safety, music
Operator Profile: 5 qualification docs (license, registration, inspection, insurance, identity)
                  each {state, expiresAt}, vehicle, Revenue balance, payout method, safety score
```
`activeMode` decides which experience renders. A "both" account has both profiles.

## Critical technical rule
**Operator revenue must be COMPUTED once, never stored twice.** One `computeFare(cost, pay)`
that both the rider receipt and driver earnings call — so the 99% number can never disagree.
(Today `opRev: 24.26` is hardcoded in seeds; replace with computed.)

## Onboarding flow (screen-by-screen)
1. Welcome → Get started / Log in. 99% pitch shown up front.
2. Create account (name, email, phone) — same for everyone. Confirm code.
3. **Role fork:** "I need rides" vs "I want to drive" (driver card shows the 99% pitch).
   Quiet "just set up rides" escape.
4. **Rider path:** basically done — payment can wait — land on "Where are you headed?"
5. **Driver path = Operator Qualification hub:** 5 documents, do in any order, save place.
   - Basics; License (front/back capture); Registration; Inspection;
   - Insurance ("verify, never sell" + provider links: Progressive/State Farm/Insurify/MoneyGeek);
   - Identity (selfie matched to license).
   - Submit → "Under review" (can look around as a rider while waiting) → "Operator
     Commissioned" badge → driver dashboard.
6. **Upgrade path (rider→driver):** the existing "Drive with American Rider" links become
   the on-ramp → same qualification hub (Basics pre-filled) → commissioned → unlocks driver.
7. **The switch:** once "both," a `Rider | Driver` toggle in the header (only shown for
   dual-role accounts). Guards: can't switch to Rider while online/mid-operation; a
   passenger ride keeps running with a banner when in Driver mode.

## Edge cases to handle
Doc rejected (friendly "retake" banner, never a wall) · expired doc post-commission
(blocks going online, rider unaffected) · insurance lapse (same) · switch mid-trip
(guarded) · pending driver can still ride · new-device login routes to activeMode ·
suspended operator (Driver side "Paused", rider mode fine).

## Build order (effort)
1. Foundation — confirm theme/UI/LiveMap cover driver classes; add `.nav` bottom tabs;
   make `computeFare` the single source of truth. **Small.**
2. Port 9 driver screens from `operator-demo.html` into `app/(driver)/*`. **Medium.**
3. Driver state (extend RideContext or DriverContext); unify the live Trip. **Medium.**
4. Auth + role-based route gate (expo-router route groups (auth)/(rider)/(driver)/(shared)).
   **Medium — the only new surface.**
5. Upgrade + verification intake + mode toggle. **Medium.**

No blocking risks. Trickiest judgment call: who owns live-ride state once one Trip drives
both sides (in production: driver actions + backend; in demo: one simulator).
