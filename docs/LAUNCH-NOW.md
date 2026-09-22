# What stands between here and live

Everything below is built, tested and committed. None of it runs until the values in §1
exist. **`FIREBASE_SERVICE_ACCOUNT` is the one that matters most** — without it there is no
scheduled dispatch, no route monitoring, no notifications, no operations view, no Stripe
webhook handling and no support cases. The server will boot, serve pages, and do none of it.

`GET /health` reports every line below. Check it after every deploy.

---

## 1. Environment values — Render

| Key | What breaks without it | Where it comes from |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | **Everything server-side.** | Firebase console → Project settings → Service accounts → Generate new private key. Paste the whole JSON. |
| `STRIPE_SECRET_KEY` | All payments | Stripe dashboard. The **live** key when you are ready for real money. |
| `STRIPE_PUBLISHABLE_KEY` | The payment sheet | Same dashboard, same mode. **Must match the secret key's mode.** |
| `STRIPE_WEBHOOK_SECRET` | Disputes, failed ACH, restricted operators | Stripe → Developers → Webhooks → add endpoint `https://<server>/stripe/webhook` → copy the signing secret. |
| `RESEND_API_KEY` | Email receipts and support alerts | resend.com. Free tier is 3,000/month. |
| `MAIL_FROM` | Email receipts | e.g. `American Rider <receipts@americanrider.app>` — the domain must be verified in Resend. |
| `SUPPORT_EMAIL` | Case alerts reaching a person | Wherever you want cases to land. |
| `OPS_PASSWORD` | `/ops` | Choose a long one. It is the key to every traveler's route and every operator's earnings. |
| `CHECKR_API_KEY` | Operator screening | [checkr.com/pricing](https://checkr.com/pricing). **The account is free** — you pay per report, and the operator pays that. Until this key exists, screening reads `awaiting_provider` — **not** a pass, and not dispatchable. |
| `CHECKR_WEBHOOK_SECRET` | Screening results returning | Checkr dashboard → Developers → Webhooks. Point the webhook at `https://<server>/checkr/webhook`; the signature is an HMAC over the raw body and the server verifies it. |
| `CHECKR_PACKAGE` | Which screening bundle a full check orders | Optional. Defaults to `american_rider_operator` — create a package with that slug in Checkr → Packages containing Basic+ **and the MVR add-on** (the $47.49 bundle in screening.js). |
| `CHECKR_PACKAGE_MVR` | The $17.50 top-up when an existing report covers the criminal half | Optional. Defaults to `american_rider_mvr_only` — an MVR-only package with that slug. |
| `CHECKR_WORK_STATE` | Which state's DMV the MVR pulls from | Optional. Defaults to `FL`. |
| `ANTHROPIC_API_KEY` | The trip planner and monitoring's reading of operator answers | Already set. |

**Checkr setup, one time, in this order:** (1) credential the account — EIN, business address,
card; (2) create the two packages above in the dashboard; (3) register the webhook URL and copy
its secret into `CHECKR_WEBHOOK_SECRET`; (4) **run the whole pipeline against Checkr's test
environment first** — a test API key plus their fake candidates simulate `clear` and `consider`
end to end (`node backend/checkr.test.js` covers the adjudication side offline); (5) then the
founder's own real check before any operator's.
| `SCHEDULER_TOKEN` | Optional. Locks `/scheduled/sweep`. | Any long random string. |

**Which Stripe events to select on the webhook:** `charge.dispute.created`,
`charge.dispute.closed`, `charge.failed`, `payment_intent.payment_failed`,
`transfer.reversed`, `payout.failed`, `account.updated`.

## 2. The clock — the free way, step by step

Scheduled travel and route monitoring both run on a 60-second sweep. On Render's **free** tier
the instance sleeps when idle and the sweep sleeps with it — a 6:30 AM reservation will not
dispatch, and a stopped car will not be noticed.

**Already done, and free: the apps wake the server themselves.** An operator on duty is, by
definition, waiting to be dispatched to — so their phone pings every 60 seconds while they are
on duty, and the traveler app pings when it opens (`src/backend/heartbeat.ts`). The server is
awake exactly when there is somebody to dispatch to. **This needs no account and no money and
is already running.**

It does not cover every case: a 6:30 AM reservation with nobody on duty and nobody holding a
phone still needs one of the two below. Pick one of them as well.

**$7/month** — Render Starter never sleeps. Nothing else to do, ever.

**Free** — an outside pinger. Two minutes, but it needs your own email to sign up, so it is one
of the few things on this list I cannot do for you:

1. Go to **[cron-job.org](https://cron-job.org)** and create a free account.
2. **Create cronjob.**
3. **Title:** `American Rider sweep`
4. **URL:** `https://american-rider-server.onrender.com/scheduled/sweep`
5. **Schedule:** choose **Every 1 minute**. (The free plan allows this.)
6. Open **Advanced** and set **Request method** to `GET`. Leave everything else alone.
7. If you set `SCHEDULER_TOKEN` in §1, append it: `…/scheduled/sweep?token=YOUR_TOKEN`
8. **Create**, then press **Test run**. A healthy answer looks like:
   `{"scheduled":{"ok":true,…},"monitor":{"ok":true,…},"assignments":{"ok":true,…}}`
   Any `"ok":false` carries the reason with it — usually a missing value from §1.
9. Turn on **Notify on failure** so a dead clock reaches you rather than sitting quiet.

The free plan's minimum interval is one minute, which is exactly the resolution both features
are designed around. There is no reason to pay for this one.

**One thing to know either way:** free Render instances take ~30 seconds to wake. The first
sweep after an idle period is late by that much, which is inside the padding scheduled travel
already allows. It is not a reason to pay $7, but it is a reason to keep the pinger running
rather than switching it on at 6am.

## 3. The domain

`americanrider.app` — **$14.20/year** at Cloudflare, registration and renewal identical.
Needed for the website, for `support@` and `receipts@` addresses, and for Resend to send as
American Rider rather than as a stranger. Email routing on top is free and unlimited.

## 4. A build

**Current state (22 Sept 2026):** TestFlight build 40 exists (see CURRENT_HANDOFF.md); the fixes since then are in no build. A new build is needed. Two routes:

- **Free** — `npx expo run:ios` on Adrian's Mac builds and installs to a connected iPhone.
  Good for proving the whole loop with real money before anyone else sees it.
- **TestFlight / App Store** — EAS build (~$2 each), then submit. The App Store Connect app
  already exists (`ascAppId 6798078543`).

**App Review takes days, not hours.** The app can be finished today; being live on the App
Store today is not something we control. A first submission for a transportation app that
takes payments and reads location gets read carefully — expect questions about the
background-check policy and the insurance disclosure.

## 5. EVERYTHING STILL MISSING — full audit, 23 Aug 2026

Checked by CONSUMER, not by existence: a file that exports something nothing imports is not
built, it is written. That test is what caught `chargeTip` (exported by nobody, so the tip
path threw on its first line) and `site.js` (six finished pages, no route). Both had passed
every previous sweep because the code was there.

### Tier 1 — nobody can operate until these exist

| # | Missing | Consequence |
| --- | --- | --- |
| 1 | **A new build.** Build 40 predates the current fixes. | The current code has not run on a phone. |
| 2 | **Checkr account.** No `CHECKR_API_KEY`. | Every operator sits at `awaiting_provider` — not a pass, not dispatchable. **Nobody can be commissioned.** |
| 3 | **Live Stripe keys.** Still `test`. | No real money can move in either direction. |
| 4 | ~~Document review is simulated.~~ **REPLACED before 22 Sept 2026** by `src/backend/documentUpload.ts` → `POST /operator/document` → `backend/documents.js`; only an `accept` verdict marks a document verified. 22 Sept: `storage.rules` gained the missing `operator-documents/` rule (every upload was refused), and a person decides held documents on `/ops`. | — |
| 5 | ~~Commissioning review is simulated.~~ **DONE 22 Sept 2026.** A person approves on `/ops`, only over four accepted documents (`backend/commissioning.js`). `/operator/online` and dispatch refuse an operator without it. | — |

### Tier 2 — raised by the founders, not built

| # | Missing | Where it stands |
| --- | --- | --- |
| 6 | ~~The AI planner.~~ **WITHDRAWN** by the founders on 4 Sept 2026 (AGENTS.md). Not a launch item. `/health` reports `assistant: withdrawn`. | — |
| 7 | ~~Operator ↔ traveler messaging.~~ **BUILT.** Both sides read and write the `messages` collection (`src/backend/messages.ts`, `app/operator/communicate.tsx`). Needs a two-phone test. | — |
| 8 | ~~Live Activity / Dynamic Island.~~ **BUILT** with `expo-widgets` (`app.json`, `src/widgets/TravelActivity.tsx`, started/updated/ended in `RideContext`). Needs a test on a real device. | — |
| 9 | ~~§627.748(8)(a) disclosure screen.~~ **BUILT.** `app/operator/disclosure.tsx`; `/operator/online` refuses without the current version and dispatch (`matching.js disclosureStale`) skips a stale one. | — |

### Tier 3 — smaller, and each one a decision

| # | Missing |
| --- | --- |
| 10 | ~~No About page.~~ **BUILT.** `GET /about` in `backend/server.js`; `legal/about/`. |
| 11 | **`account.updated` needs a second Stripe destination** with Connected accounts scope. Without it, an operator Stripe restricts stays on duty. |
| 12 | ~~`app/audio.tsx` is orphaned.~~ **DONE.** The file is no longer in the tree; nothing refers to it. |

### Not defects, but real and unbudgeted

- **A legal entity and EIN.** Checkr's onboarding will ask.
- **The biennial CPA examination** required by §627.748(9), which the TNC pays for.
- **App Store review** — days, not hours, and a first submission for a transportation app that takes payments and reads location gets read closely.

## 6. Live Activity — the actual process

> **Superseded.** The Live Activity is built with `expo-widgets`, not `expo-live-activity` (deprecated — see AGENTS.md). The steps below are kept as history only.

The moving card on the lock screen and in the Dynamic Island. It is Apple's **ActivityKit**,
and it is not JavaScript: it is a separate native widget target written in SwiftUI, compiled
into the app. Expo can carry it, but only through a build of our own.

**The steps, in order:**

1. **A build must exist first** (§4). ActivityKit cannot run in Expo Go at all, so there is
   nothing to test against until then. This is the only reason it is not already done.
2. `npx expo install expo-live-activity` — the community config plugin that generates the
   widget target so we do not have to hand-edit an Xcode project on every build.
3. Add `"supportsLiveActivities": true` to `ios.infoPlist` in `app.json`.
4. Write the SwiftUI layout for the two states — the lock-screen card and the compact Dynamic
   Island. This is the design work: it is a American Rider surface and gets the same treatment
   as any screen, which means it goes to you both before it ships.
5. Start the activity when a travel is accepted, update it on each status change, end it at
   completion. The plumbing already exists — `watchRide` in `src/backend/dispatch.ts` is
   exactly the event stream it needs.
6. `npx expo prebuild --clean` then `npx expo run:ios` to build with the new target.

**No Apple entitlement or approval is needed** — Live Activities need only the Info.plist flag
and a real build. **Roughly a day's work**, most of it the SwiftUI layout, and none of it can
start before there is a build.

**Android has no equivalent.** Its notifications can be made to update in place, which is close
but not the same thing, and it is a separate piece of work.

## 7. What the operator screening costs, and why

**$47.49**, paid by the operator to American Rider, passed straight through at cost.

| | | |
| --- | --- | --- |
| Checkr Basic+ | **$29.99** | The nationwide criminal database and the National Sex Offender Public Website — §627.748(12)(a)2 |
| Checkr MVR add-on | **$9.50** | The driving history research report — §627.748(12)(a)3 |
| Florida DHSMV, 3-year record | **$8.00** | Passed through by Checkr at cost |

**The driving history is not an optional extra, and other platforms do not skip it.** §627.748(12)(a)3: *"The TNC must obtain and review, or
have a third party obtain and review, a driving history research report for the applicant."*
It is its own numbered requirement, separate from the criminal check. Without it we cannot
answer two of Florida's own disqualifying questions — more than three moving violations in
three years, and driving on a suspended or revoked licence — because a criminal database does
not hold driving records. We would also be unable to prove we applied the standard at the
biennial CPA examination §627.748(9) requires, and the company bears that cost too.

Three years rather than seven, deliberately: the statute's own test is *"the prior 3-year
period"*. The 7-year record costs $10 and answers a question nobody asked.

### The free route, which is the one most operators should take

**An operator screened elsewhere in the last THREE years pays nothing.** Not twelve months —
three years is the statute's own measure of how long a check stays current: §627.748(12)(b),
*"The TNC shall conduct the background check required under paragraph (a) for a TNC driver
every 3 years."*

| | |
| --- | --- |
| Complete, under three years old | **$0** |
| Missing only the driving history | **$17.50** |
| Older than three years, or they will not send it | **$47.49** |

**What makes a three-year window safe rather than slack:** the re-check clock runs from the
report's own date, not the day we accepted it. An operator arriving with a report two years and
eleven months old is accepted, and re-checked one month later. The older the report, the sooner
it is replaced — the blind spot and the re-check move together, and nobody gets three unwatched
years.

**Why it must come from the screening company and not the operator.** Two reasons, and the
second is the binding one. A PDF that passed through the hands of the person it is about is not
evidence about that person. And under the FCRA a report may only go to someone with a
permissible purpose — Uber's purpose was Uber's, and does not travel with the document. The one
lawful route is FCRA §604(a)(2): a screening company may release a report *"in accordance with
the written instructions of the consumer to whom it relates."* The operator instructs them; they
may lawfully comply.

**What we need from the operator** — and it is deliberately almost nothing, because their name
and date of birth are already on their application:

1. The name of the screening company.
2. Roughly when the screening was done.
3. Their signature on one line: *"I instruct the named screening company to release my most
   recent background screening report to American Rider."*

**What we then do:** send that instruction to the screening company with the operator's
identifying details and where to send the report. Today that is a person on our side sending an
email — the app opens the case for it automatically. It is not yet an API call, and no screening
company owes us a fast answer, so it is worth trying rather than guaranteed. If it does not
arrive, the operator takes the ordinary route and nothing has been lost but a few days.

## 8. Prove it before anyone rides

In order, on a real device, with real test money:

1. `/health` — every line `on`, `sweeping: true`.
2. Sign in as an operator, complete qualification, go on duty. Check `/ops` shows them.
3. Book travel from a second account. The operator's phone should **buzz** — that is the
   notification the loop rested on and did not have.
4. Accept, arrive, complete. The traveler should get "your operator has arrived" and a
   receipt by email.
5. Check Stripe: one charge, one transfer of 99% of the fare to the operator's account.
6. Reserve travel 20 minutes out. Wait. It should dispatch on its own, charge the card on
   file, and notify both.
7. Stop the car for seven minutes mid-travel. The operator should be asked; then the traveler.
8. Answer the operator check-in with "the passenger is unwell". Both phones should be pushed
   to the emergency screen.

Anything that does not do what it says here is a defect, not a setting.
