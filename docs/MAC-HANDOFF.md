# 👋 START HERE — Handoff for American Rider (new machine / new Claude session)

If you're a Claude session picking this project up fresh (e.g. on Adrian's new Mac), **read this
whole file first.** It's the catch-up briefing so you have the full story without the prior chat.

---

## ✅ STATUS UPDATE — 1 Aug 2026 (written on the Mac)

The Mac setup described below is **done**. What is and isn't true now:

**Done and verified on the Mac:**
- Repo cloned. Node 24.18.1 (via nvm, no admin rights needed), npm, GitHub CLI, EAS CLI 21.4.0.
- The Mac had **no shell profile at all** — `~/.zshenv` and `~/.zshrc` were created so `node`,
  `npm`, `eas` and `gh` resolve in a normal Terminal.
- `npm install` run in both the repo root and `backend/`. `npx tsc --noEmit` exits clean.
- App confirmed **running** via `npx expo start --web` (screenshot-verified, no console errors).
- Backend runs; `/health` returns `{"stripe":"test"}`.
- **Stripe TEST key** is in `backend/.env` and was verified with a real Stripe API call.
- **`.env.expo` (EXPO_TOKEN)** restored from Adrian's USB and verified against Expo's API.
- Logged in: GitHub (`redwolfgaming77`) and Expo (`redwolfgaming77`).

**⚠️ Correction to step 1 below: Xcode is NOT required.** EAS builds iOS in the cloud. Do not
send Adrian on a 17 GB App Store download. Xcode is only needed for local simulator runs.

- ✅ **The first iOS build SUCCEEDED (2 Aug).** Build `99621942-c3d3-407c-9578-e0b949346688`
  installs on Adrian's iPhone (UDID `00008140-001E752E34C2801C`). Read the Apple diagnosis
  below before touching Apple credentials again — the resolution is at the end of it.

---

## ✅ STATUS UPDATE — 3 Aug 2026: the app now works end to end

**On Adrian's iPhone, confirmed working by him:** real address search, distance-based prices,
**a real payment**, the AI trip planner, and a **real Apple Map** on the ride screen.

**Backend is LIVE** at `https://american-rider-server.onrender.com` (Render free tier,
auto-deploys from this repo's `main`). Both keys are set in Render's dashboard and were each
verified with a real API call — not just a "key is present" check.

- ⚠️ **Free tier sleeps after ~15 min idle; the next request takes ~20–50s.** Looks like the app
  has frozen. ~$7/mo removes it. Fine for testing, NOT fine once real travelers are booking.
- `EXPO_PUBLIC_API_URL` is set per build profile in `eas.json`; `src/config.ts` falls back to
  localhost for web testing. **Changing the backend address requires a rebuild** — it is baked in.

**The Anthropic key is no longer lost** — Adrian created a fresh one (the old one was never
recoverable; Anthropic shows a key once). Verified against the API. In Render + `backend/.env`.

### 🐛 Read this before debugging any "connection" error

Payments failed on the phone with *"An error occurred with our connection to Stripe. Request was
retried 2 times."* **It was not a network problem.** The key pasted into Render's dashboard had a
stray `›` (U+203A) on the end. Node then refuses to build the `Authorization` header, and the
Stripe SDK reports that as a connection failure — which sends you hunting for a network fault
that doesn't exist. Roughly an hour went into IPv6 theories before the real cause surfaced.

Tells that it is a bad key rather than a bad network: it fails in ~3s rather than timing out,
retries never help, and `/health` still says `"test"` (the prefix check tolerates junk).

Now hardened: `backend/env.js` `readKey()` strips whitespace and quotes from every key, and a bad
key produces a message naming the exact character and position (e.g. `position 107: U+203A`)
instead of blaming the connection. **`GET /health/stripe`** makes a real Stripe call plus a raw
DNS/HTTPS probe — hit that first, it separates "no key" / "bad key" / "cannot reach Stripe".

### Pricing is now distance-based — and still server-side

Any address can be booked. The phone sends **coordinates only**; the server computes miles and
sets the price (`backend/fares.js` → `fareCentsForCoords`). **Never let the app send an amount** —
that property is the whole reason a tampered client can't pay $1 for an airport run. The old named
place table is still there as a fallback for the demo destinations.

### Maps: Apple Maps, now the full experience (updated 4 Aug)

`src/components/LiveMap.ios.tsx` renders a real Apple Map (`expo-maps`). Metro serves it only
on iOS; `LiveMap.tsx` (hand-drawn SVG) still serves web and Android, needs no key, works offline.

What the traveler gets on iPhone now — all built and verified on Adrian's phone on 4 Aug:
- **Real street routing.** `POST /route` on the backend proxies OSRM's public server (South
  Florida only, so it can't be farmed as a free world proxy). The phone never talks to a
  routing provider directly — swap to Apple Maps Server API later by editing only
  `backend/routes.js` (needs a Maps key from Chad's developer portal; add it to his next
  TestFlight session). Null route = straight-line fallback; a ride never fails on routing.
- **The operator's car approaches on the map** from his real matched location (`MatchedOp`
  now carries lat/lng), camera following and tightening as he closes in. **The ride's demo
  timer only starts once an operator is matched** — before that fix, the approach animation
  was skipped because the timer outran dispatch.
- **Pin-drop pickup** (`app/pickup-map.ios.tsx`), discoverable from both the reserve screen
  and a bold card on the ride screen, which flips to "Pickup pin set ✓ + address" once set.
  Pins reset on each new booking (they used to leak across trips).
- **Walk-to-your-car finder**: at "Miguel is here", a Find-My-style compass arrow (device
  GPS + heading via `expo-location`) points to the car with live distance; the ride HOLDS at
  that step until "I'm in the car" is tapped. Venue pickups (port, airport, stadium) show a
  meet-me note.

## 🚀 STATUS UPDATE — 6 Aug 2026: the app is AT APPLE (TestFlight upload done)

The store-signed build was **uploaded to App Store Connect** today. How, because the path was
not the runbook's path and the detours matter:

- **Expo free build quota ran out mid-call on 5 Aug** (15/15 iOS builds; resets Sep 1). Local
  `eas build --local` failed repeatedly at "Prepare credentials" — fastlane cannot import the
  distribution cert into a keychain from Claude's shell or the app's integrated terminal. Do
  not burn hours on this again; it's the environment, not the config.
- **Adrian subscribed to Expo Starter ($19/mo, his card, 6 Aug)** — intent is ONE month, cancel
  after; free quota returns Sep 1. Cloud production build then succeeded in ~6 min, unattended,
  using the banked credentials (Chad's cert + App Store profile YVXB33884P). No Apple login
  was needed — `--non-interactive` works for builds.
- **`eas submit` does NOT work non-interactively here.** It first wanted `ascAppId` (now in
  `eas.json`: **6798078543**, team `6Z24V6YD4A`), then demanded an ASC API *team* key, which
  this account can't make (Individual membership; Chad-only, and .p8 downloads on his account
  historically fail).
- **The workaround that WORKS: fastlane pilot with Adrian's INDIVIDUAL ASC API key.**
  Individual keys have no issuer ID, and fastlane accepts that (EAS doesn't). The key JSON
  lives at `~/.appstoreconnect/fastlane_api_key.json` (chmod 600, never in the repo), built
  from `AuthKey_GFNZTC695YE3.p8`. Full release recipe, no Chad, no interactivity:
  1. `eas build -p ios --profile production --non-interactive --no-wait`
  2. download the `.ipa` (URL from `eas build:list --json`)
  3. `fastlane pilot upload --ipa <file> --api_key_path ~/.appstoreconnect/fastlane_api_key.json
     --skip_waiting_for_build_processing --skip_submission`
  The same individual key also answers the ASC REST API directly (JWT with `sub: "user"`,
  no issuer) — that's how the app ID was found and how processing status is polled.
- **Render Starter upgrade ($7/mo) in progress** — Render requires a card on file before the
  instance-type change; Adrian was adding it when this was written. Verify the instance says
  Starter before telling testers the app is smooth.
- Money context that shaped today: Adrian has ~$347 to his name and is (rightly) wary of
  subscription bleed. Promises made: Expo gets canceled after this month; total ongoing spend
  is $7/mo Render; nothing usage-billed is enabled; and running costs are a Chad-split
  conversation. Honor these.

**Still to do when Apple finishes processing (10–30 min):** TestFlight tab → Internal group
"Founders" → add Adrian + Chad → paste the "What to Test" note from docs/TESTFLIGHT-RUNBOOK.md.

### Local simulator builds work (5 Aug) — and the folder name is a trap

Xcode 26.6 + the iOS 26.5 simulator runtime are installed; `npx expo run:ios` builds and runs
the app on a local simulator (iPhone 17, udid E1B5D5C5-FCBB-4729-96DC-AFF1DE3D8778). Claude can
drive it end-to-end without Adrian: screenshots via `xcrun simctl io <udid> screenshot`, taps and
typing via `idb` (Homebrew `facebook/fb/idb-companion` + pip `fb-idb`), simulated GPS via
`xcrun simctl location <udid> set lat,lng`. A sim-only test account exists:
`sim-rider@americanrider.dev`. Phone (EAS) builds are unaffected by any of this.

**The project folder name — "American Rider", with a space — breaks unquoted build scripts.**
Two patches make local builds work, and BOTH are regenerated-over: quoting fixes in
`node_modules/expo-constants/ios/EXConstants.podspec` (dies on `npm install`) and in the
"Bundle React Native code and images" phase of `ios/AmericanRider.xcodeproj` (dies on
`npx expo prebuild --clean`). If a local build ever fails with
`/Users/adriansmith/American: No such file or directory`, this is why — re-apply the quoting,
or rename the folder to something space-free and re-clone worries away for good.

### ⚠️ The bug pattern that ate 4 Aug — read before touching booking flows

**Every booking path must produce `tripCoords` (and price via the server).** The map, the
routing, the car, and distance pricing all key off `tripCoords`. It kept silently ending up
null, four separate ways: geocoding the label "Current location — Brickell" (not an address —
named places now carry baked lat/lng in `src/data.ts`); the airport Go card skipping the
pricing path entirely (showed the hardcoded $26 and set no coords — reserve now prices the
preset arrival on open, guarded against stale-quote races); stale pins/coords leaking between
trips; and the ride timer racing dispatch. If the live map ever shows the zoomed-out
whole-Miami fallback with no pins, **tripCoords is null again** — find which path skipped it.

### Still not done

- ❌ **The operator (driver) app does not exist.** Biggest remaining build. A rideshare is two apps;
  operators currently have nothing to accept rides on.
- ❌ **TestFlight.** Every new tester still costs a device registration + a rebuild, and Chad's
  Apple password each time his session expires. Setting up TestFlight ends that permanently.
- ❌ **Chad's iPhone still can't install** — his device is registered but the provisioning profile
  wasn't regenerated (that needs his password again). Spend his next login on TestFlight instead.
- ⚠️ **Apple account is Individual** → the App Store would list the seller as "Chad Khalil Dia",
  not American Rider. An Organization account needs a legal entity + D-U-N-S (days to weeks).
- ⚠️ **Stripe `charges_enabled: false`** — business activation incomplete, so no real money yet.
- ⚠️ **Insurance + Florida TNC registration** remain the true long pole to launch. See
  `docs/LAUNCH-READINESS.md`; nothing in the code shortens those.

### 🚧 The Apple blocker, diagnosed 1 Aug 2026 — RESOLVED 2 Aug (see resolution at end)

**Apple ID login now WORKS.** The Windows `.p8`-download blocker is gone. `eas build -p ios
--profile preview` gets through Apple ID + 2FA cleanly (`Valid code` → `Logged in and verified`),
and the password is saved in the Mac Keychain, so it will not be asked for again.

**It then fails with:** `Authentication with Apple Developer Portal failed! You have no team
associated with your Apple account, cannot proceed.`

**That message is misleading — Adrian IS on the team.** Verified in App Store Connect:
- Signed in as **Adrian Smith** under team **Chad Khalil Dia**
- **Role: Admin**; Developer ID `2fa282d5-2b2c-4820-8fe9-6928ac1e8d33` (matches this doc)
- Additional Resources granted: *Create Apps*, *Generate Individual API Keys*
- **NOT granted: "Access to Certificates, Identifiers & Profiles"** ← the actual problem

App Store Connect access and Apple Developer Portal access are **separate**. The build needs the
Developer Portal side to create a signing certificate. Being an ASC Admin does not include it.

**Confirmed independently via the App Store Connect API.** An Individual API Key was generated
(Key ID `GFNZTC695YE3`, stored at `~/.appstoreconnect/private_keys/AuthKey_GFNZTC695YE3.p8` —
outside the repo, chmod 600). Signing a JWT with `sub: "user"` (individual keys omit `iss`):

| Endpoint | Result |
|---|---|
| `/v1/apps` | **200 OK** — key is valid |
| `/v1/certificates` | 401 |
| `/v1/profiles` | 401 |
| `/v1/bundleIds` | 401 |

So the wall was hit **two independent ways**. Do not spend time re-diagnosing this, and do not
try to route around it — it is an account permission, not a tooling problem.

**⛔ That first guess was WRONG — there is no such checkbox to enable.** Chad went looking and
could not find it. The reason: `developer.apple.com` → Membership details shows
**`Enrolled as: Individual`** (Team ID **`6Z24V6YD4A`**, renewal 24 Jul 2027). Apple does **not**
allow certificate access for anyone except the account holder on an Individual membership, so no
permission could ever have been granted to Adrian. Do not send anyone hunting for that setting.

Also worth knowing: the `.p8` download bug from the Windows era is **still broken and is not
Windows-specific** — Chad hit "error, try again later" generating a Team API Key too. Do not
plan around getting a `.p8`.

**✅ HOW IT WAS ACTUALLY RESOLVED (2 Aug 2026):** Chad signed in as himself during
`eas build -p ios --profile preview` (Adrian ran the command, cleared his own Apple ID at the
prompt, and Chad typed his Apple ID `chadkhalil21@gmail.com`, password and 2FA code). Apple then
created the distribution certificate and provisioning profile under his team. **Those credentials
now live on Expo's servers against this project, so Chad should not need to be involved again.**
His password was removed from the Mac's login Keychain (`deliver.chadkhalil21@gmail.com`)
immediately afterwards.

**⚠️ STILL OPEN — an Individual account cannot ship this app properly.** On an Individual
membership the App Store seller name is the account holder's legal name, so American Rider would
publish as "Chad Khalil Dia". Shipping as a company needs an **Organization** account, which
requires a registered legal entity and a **D-U-N-S number** (free, but days-to-weeks to issue).
Start that early — it is a launch blocker, not a nice-to-have. Also: **auto-renew is OFF** on the
membership (renews 24 Jul 2027); if it lapses, published apps are removed from the App Store.
- ✅ RESOLVED 3 Aug (new key created, verified). Original note: **`ANTHROPIC_API_KEY` was lost.** It was NOT in the Windows `backend/.env` (checked
  the USB copy directly — that line was empty there too). Anthropic never re-displays a key, so
  it cannot be recovered. Adrian must create a new one. Until then `/health` reports
  `"assistant":"off"` and only the AI trip planner is affected.
- ✅ RESOLVED 3 Aug (live on Render, see the 3 Aug section above). Original note: **Backend is not hosted.** Prepared but not deployed: `render.yaml` (blueprint) and
  `docs/HOSTING-PLAIN.md` (Adrian's steps). `src/config.ts` no longer hardcodes localhost — it
  reads `EXPO_PUBLIC_API_URL` and falls back to localhost for web testing. **Once Render gives a
  URL, set it in `eas.json` per build profile.** Until this is done, a build installed on a real
  phone will open fine but every price/payment/assistant call will fail.
- ⚠️ Stripe account has `charges_enabled: false` — business activation is incomplete. Fine for
  test mode; blocks real money. Chad's lane.
- ⚠️ Render free tier sleeps after ~15 min idle (~50 s cold start). Fine for testing, not for
  real travelers. ~$7/mo fixes it.

---

## Who you're working with
**Adrian** — a **non-technical founder.** Do the coding *for* him, explain everything in plain
English (no jargon), and verify your work by actually running the app rather than asking him to
check. Be transparent about any change you make (he dislikes silent edits). His partner is
**Chad** (business/legal/operator side). Back work up to GitHub as you go.

## What American Rider is
A **Miami rideshare app** with a radical model: the **Operator keeps 99% of the travel fare.**
American Rider's revenue = a **1% commission of the travel fare (no cap) + the traveler's platform
fee, the greater of $1.50 and 5% of the travel fare** (Chad, 9 Sept 2026). The traveler sees
**ONE all-in price** (fare + platform fee); never imply "we only take 1%" (the platform fee is
real revenue that also absorbs card processing). iOS-first (TestFlight → App Store).

## Tech stack
- **App:** Expo SDK 57, React Native 0.86, React 19, **expo-router**. Lives in this repo root.
  ⚠️ Expo changed a lot in SDK 57 — read `https://docs.expo.dev/versions/v57.0.0/` before coding.
- **Backend:** Node/Express in `backend/` (CommonJS). Holds the secret keys. Endpoints: `/health`,
  `/quote`, `/create-payment-intent`, `/charge-ride`, `/assistant`.
- **Auth + DB:** Firebase Auth + Firestore (`src/firebase.ts`). Web config is NOT secret.
- **Payments:** Stripe Connect **destination charge** (test mode). Proven 99/1 split on Stripe.
- **AI trip assistant:** Anthropic Claude via `@anthropic-ai/sdk`, model **`claude-haiku-4-5`**
  (cheap, on purpose), in `backend/assistant.js`. Turns plain-English ("airport by 6, two of us")
  into a bookable trip. **LIVE and working.** Never market this as "AGI" — it's AI, not AGI.

## What's already built & working (all committed to GitHub)
Real auth, real dispatch (matches nearest Miami operator from Firestore), real trip history,
one all-in price everywhere, server-side pricing + Firebase-token auth on money endpoints,
proven Stripe 99/1 split, and the live AI assistant. See `git log` and the `docs/` folder.

## 🎯 THE IMMEDIATE MISSION: build for iPhone (TestFlight)
This is why Adrian got a Mac. On **Windows** the blocker was Apple's **App Store Connect API key
(.p8) download** — it errored for days (an Apple-side bug; the account's agreements are now all
cleared, DSA compliance done, but the `.p8` still wouldn't download reliably).

**On the Mac, take the easy road:** authenticate with the **Apple ID directly** (interactive
login) instead of the `.p8` key — or use **Xcode**. Either sidesteps the broken download entirely.
- Apple Developer account: **Chad Khalil Dia** is Account Holder (paid the $99). Adrian is an
  **Admin** on the team (Apple ID `adrianderksmith@gmail.com`). Team/Issuer ID:
  `2fa282d5-2b2c-4820-8fe9-6928ac1e8d33`. Bundle id: **`com.americanrider.app`**.
- Expo/EAS is set up: Expo account `redwolfgaming77`, project id
  `bf6e7e6a-079d-4d91-bc42-f21732f069cb` (in `app.json`). `eas.json` has `preview` + `production`.
- An Android EAS cloud build already SUCCEEDED (pipeline proven). iOS just needs Apple auth.

## 🔑 Secrets (gitignored — NOT in this repo; recreate on the Mac)
Adrian has all of these. **Never commit them or print them in chat.**
- `backend/.env` → `STRIPE_SECRET_KEY=sk_test_...`, `ANTHROPIC_API_KEY=sk-ant-...`, `PORT=4242`
  (template is in `backend/.env.example`).
- `.env.expo` → `EXPO_TOKEN=...` (Expo personal access token, for non-interactive EAS).

## Setup steps on the Mac
1. Install **Xcode** (Mac App Store — large, slow download), **Node** (LTS), and **git** (comes
   with Xcode command line tools). If you (Claude) can run commands, do this for him.
2. `git clone https://github.com/redwolfgaming77/American-Rider.git` (this repo).
3. `npm install` in the repo root, and again in `backend/`.
4. Recreate the two `.env` files above (Adrian pastes his keys — guide him, never handle them
   for him).
5. Verify: `npx tsc --noEmit` (keep clean) and `npx expo start --web` (app runs).
6. iOS build: `eas build -p ios --profile preview` and complete the **Apple ID login** when
   prompted (Adrian types his Apple credentials + the texted 2FA code — you never do).

## Design rules ("Friendly" style)
Colors/radii in `src/theme.ts` (navy `#14171F`, blue `#2E5FE0`) — never hardcode. IBM Plex Mono
(`Mono` component) ONLY for prices and trip numbers. Soft white cards on `#F6F5F1`, one clear
action per screen, human words (no "DEPARTURE/ARRIVAL" jargon). Everything Chad-facing "must be
aligned with our design and style preferences."

## Features Chad has asked for next (discuss before big builds)
1. **Add a stop mid-ride** — rider adds a stop during the trip; show an updated all-in price and
   confirm (keeps the "no surprises" promise). Not yet built.
2. **Recurring "routine" rides** — set e.g. weekday 7 AM Home→Work + 5 PM Work→Home, repeats
   until canceled. Extends the existing `app/schedule.tsx`.

## Legal / insurance (Chad's lane — honesty rules matter)
See `docs/LEGAL-PLAIN.md` and `docs/OPERATOR-INSURANCE-DISCLOSURE.md` (a DRAFT — do-not-use-until
the platform's $1M FL TNC policy is real + a lawyer finishes it). Florida law §627.748: during a
ride, **$1M** liability that the **platform** must carry; operators carry a cheap **rideshare
endorsement** for the app-on/waiting period. Never tell operators they're covered by a policy that
doesn't exist yet. Don't over-claim insurance or name competitors with legal accusations.

## Other decisions on record
- **Maps:** Apple Maps / MapKit for now (free, iOS-first); add Google/Mapbox for Android later.
- **Server hosting (planned, not done):** **Render** free tier (auto-deploys from this GitHub
  repo; set root dir = `backend`; keys as env vars; ~$7/mo when it needs to be always-on). Needed
  so the app can reach the backend from a real phone (localhost won't work on a phone).
- **Backups:** this GitHub repo (primary) + a OneDrive bundle. Keep pushing.

---
*Written on the Windows machine as a handoff to the Mac. When in doubt, read `git log`, the
`docs/` folder, and `AGENTS.md`.*
