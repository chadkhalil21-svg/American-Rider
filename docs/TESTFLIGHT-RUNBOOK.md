# TestFlight Run-Book — Chad's ten minutes, scripted

The app is ready for TestFlight (rider loop verified end to end; demo-payment wording made
honest on 5 Aug). The ONLY missing ingredient is Apple authentication that Adrian's account
cannot provide (Individual membership — see MAC-HANDOFF). That means **Chad, once, on a call.**
Everything below is arranged so his part is typing a password and reading out a 2FA code.

## Before the call (Adrian + Claude, no Chad needed)

- [ ] **Upgrade Render to Starter (~$7/mo).** dashboard.render.com → american-rider-server →
      Settings → Instance Type → Starter. This kills the ~30 s cold start that would make the
      app look broken to any unsupervised tester. Do this the same day as TestFlight, not later.
- [ ] Confirm the app record exists: appstoreconnect.apple.com → Apps → **American Rider**
      (created 4 Aug — do NOT touch "Add for Review"; TestFlight needs none of that form).
- [ ] `git status` clean, latest work pushed. Claude runs a fresh `npx tsc --noEmit`.
- [ ] Have this file open, and a terminal at the project.

## The call itself

### Step 1 — Store-signed build (~2 min of Chad, then 10 min unattended)

```bash
cd "/Users/adriansmith/American Rider" && eas build -p ios --profile production
```

- `Do you want to log in to your Apple account?` → **y**
- Apple ID: **clear Adrian's, Chad types his** (chadkhalil21@gmail.com) + password + 2FA code
- Certificate: **reuse** the existing distribution certificate (stored on EAS since 2 Aug)
- `Generate a new App Store provisioning profile?` → **Yes** (store profile ≠ the internal one;
  this is expected, not a re-do of the old problem)

The build then runs in the cloud. Chad's password work is DONE at this point — keep him on the
call only if attempting Step 4.

### Step 2 — Submit to TestFlight (after the build finishes)

```bash
eas submit -p ios --latest
```

- If it asks for Apple auth again, the session from Step 1 normally covers it. If it offers an
  App Store Connect API key path instead, skip it — interactive login is fine here.

### Step 3 — Flip the TestFlight switches (Adrian, in the browser)

1. appstoreconnect.apple.com → American Rider → **TestFlight** tab
2. The build appears after Apple processes it (10–30 min; refresh)
3. If asked the encryption question, it's already answered in the app
   (`ITSAppUsesNonExemptEncryption=false`) — accept/confirm
4. **Internal Testing** → create a group ("Founders") → add testers by their App Store Connect
   accounts: Adrian + Chad
5. Both get an email → install the **TestFlight app** from the App Store → accept → install
   American Rider. Updates arrive automatically from now on — no cables, no QR codes, no
   device registration, no Developer Mode.

### Step 4 — OPTIONAL, while Chad is still on the call: Apple Maps key

Routing currently uses OSRM's public demo server (works, no promises). The proper Apple route
needs a Maps key that only the developer portal can issue:

- developer.apple.com → Account → **Keys** (Certificates, Identifiers & Profiles) → create a
  key with **Maps** enabled → download the `.p8`, note Key ID + Team ID (6Z24V6YD4A)
- ⚠️ **This download has failed repeatedly on this account** ("error, try again later"), on two
  machines. Attempt it; if it errors again, drop it without burning call time — OSRM keeps
  working and only `backend/routes.js` changes whenever the key finally arrives.
- If it works: give the `.p8` to Adrian (AirDrop), store at `~/.appstoreconnect/private_keys/`,
  NEVER in the repo. Claude wires it into Render as env vars.

## The "What to Test" note (paste into TestFlight's test notes field)

> Welcome to American Rider! Real app, three pretend parts while we build:
> • Money is FAKE — test mode. Nothing you do charges anyone anything.
> • Your driver (Miguel) is simulated — the driver app is being built next. Rides run on a
>   fast-forward timer so you can see the whole flow in a minute.
> • Try: book to the airport, type any Miami address, drop a pin for your exact pickup spot,
>   watch the car drive to you, and ask the trip planner in plain English.
> Everything else — prices, maps, routes, receipts — is real. Tell us anything that confused
> you, however small. That is exactly what we want to hear.

## After the first time

**(Updated 6 Aug — this is the path that actually shipped build 1.)** `eas submit` can't run
non-interactively on this account (it demands a team ASC API key we can't get). Future releases
are Claude-driven, no Chad, no prompts:

```bash
eas build -p ios --profile production --non-interactive
```

then download the `.ipa` (`eas build:list --json` has the URL) and upload with fastlane using
Adrian's individual ASC key:

```bash
fastlane pilot upload --ipa AmericanRider.ipa --api_key_path ~/.appstoreconnect/fastlane_api_key.json --skip_waiting_for_build_processing --skip_submission
```

Cloud builds need either the paid Expo plan (subscribed 6 Aug, may be canceled) or free quota
(resets Sep 1). Internal-lane builds (`--profile preview`) still work for Adrian's own phone
any time.
