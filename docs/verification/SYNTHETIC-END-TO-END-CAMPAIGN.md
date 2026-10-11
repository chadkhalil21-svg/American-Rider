# American Rider — Research-led synthetic end-to-end campaign

**Scope:** October 11, 2026. **Candidate:** branch/PR exact-head SHA only. **System:** one national engine, first service region `fl-southeast` (Miami-Dade, Broward, Palm Beach). **No production market activation.**

## Authority and acceptance rules

- [Google SRE Launch Coordination Checklist](https://sre.google/sre-book/launch-checklist/): topology, peak demand, dependency failure, E2E, backup/restore, instrumentation, security, change control and rollout.
- [Google SRE Reliable Product Launches](https://sre.google/sre-book/reliable-product-launches/): repeatable launch criteria and reliable evidence.
- [Firebase Local Emulator Suite](https://firebase.google.com/docs/emulator-suite) and [Auth emulator](https://firebase.google.com/docs/emulator-suite/connect_auth): use an isolated `demo-` Firebase project so an accidentally unmocked resource cannot reach production. Emulator accuracy is not production capacity certification. Firestore Admin SDK bypasses Security Rules and needs independent authorization tests.
- [Stripe payment testing](https://docs.stripe.com/testing), [Connect testing](https://docs.stripe.com/connect/testing) and [webhooks](https://docs.stripe.com/webhooks): test approved card/3DS/decline/refund/dispute/Connect states; verify raw-body signatures, retries, duplication and events arriving out of order. NEVER load-test Stripe's sandbox (use local provider stubs for volume). No test card numbers or keys in our repository or production variables.
- [Resend delivery test addresses](https://resend.com/docs/dashboard/emails/send-test-emails): delivered, bounced, complained and suppressed behavior; send only to documented provider-owned testing endpoints with an approved configured sender; capture provider event IDs. Provider-accepted is not proof of inbox receipt. Currently verified: sending domain enabled, zero Resend delivery webhooks; this remains an integration gap, not synthetic success.
- [FTC background report requirements](https://www.ftc.gov/business-guidance/resources/background-checks-what-employers-need-know): consent, valid purpose, consumer-report provenance, required pre-adverse and final adverse steps; synthetic reports never qualify a live Operator.
- [Expo SDK 57 Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/) and [Apple Core Location background delivery](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background): task scheduling and permission/termination must be verified on physical signed builds, not emulators.
- [2026 Florida TNC statute §627.748](https://www.flsenate.gov/Laws/Statutes/2026/627.748): Operator-funded primary insurance does NOT alone resolve the statutory TNC first-dollar response in subsection (7)(d) when Operator coverage lapses. Qualified insurance/legal sign-off is required. The 2026 SB 632 proposal **died in committee**; do not treat bill text as law.

The Founder-ratified Council is an **interpretive rubric, not literal consultation or endorsement**. Ford: repeatable complete cross-service journeys; Rockefeller: no wasted emails/queries and unit-cost forecasts; Jobs/Apple: physical user continuity and no fake statuses; institutions/Google SRE: reproducible releases and measured evidence; Emirates: graceful refusal, truthful recovery, no abandoned passenger or Operator.

## Evidence already established on preceding source

The existing exact-PR-head six workflows run typed build/i18n, backend and Firestore emulator checks, deterministic commissioning (19 scenarios), double whole-platform adversarial suites, twice-run scale stress and double exhaustive release campaigns. These are substantial **deterministic** evidence, but most invoked a module test in isolation. A complete user journey with authentic provider/webhook data, real iOS/Android permission flow and real settlement is NOT thereby proved.

## New continuous synthetic journey

`backend/synthetic-travel-lifecycle.test.js` uses the **actual** backend `acceptOffer`, `progressTravel`, `insurance-monitoring`, `market-readiness` and the same in-memory transactional records throughout an accepted, arrived, onboard and completed Travel. Test only: a fictitious paid PaymentIntent object, fictitious Operator and Traveler, fake DB, no network or provider effects.

Cases include wrong Operator, tampered payment amount, concurrent accepting requests, lost response and retry without new write, disabled payouts, illegal progress, stale/wrong-position GPS, Teen pickup without PIN, journey completion only near destination, payout-due only after completion, duplicate completion without payout double-write, plus independent cancellation/unverified/expired insurance, missing/expired screening, disabled Auth account, stale disclosure and restricted payouts. Three configured Florida counties independently reject missing/expired/mismatched admission proof, provider outage and changes to the manifest. Even valid-looking **synthetic** evidence is used only as a local positive control and must never be written to production.

Tests intentionally do **not** exercise a real HTTP process, mobile app UI, real Firestore transaction retries, Stripe API/webhooks, documents, provider CRA licensing/consent, mail reception, background GPS or bank payout; they are not called full real-world E2E.

## Remaining launch verification — classified, not assumed

| Journey | Deterministic | Provider sandbox / emulator | Real external / signed physical |
|---|---|---|---|
| Sign-up, login, OAuth and delete | Existing suites | Firebase demo Auth/Firestore | Real iPhone+Android, provider reauth/revocation |
| Operator documents, vehicle and insurance | Qualification, file, monitoring and reminder suites | Fake insurer events; no false approvals | Carrier/broker policy, limits, named insured, continuing status, Florida counsel |
| Background screening | CRA adapter, source and FCRA adverse tests | Provider-supported test webhooks/replay; explicit consent simulation | Actual authorized CRA report/purpose and adverse workflow |
| Email, invitations, receipts and support | Offline message/queue/template tests | Resend delivered/bounced/complained/suppressed addresses | Real recipient mailbox, signed inbound flow; no webhook installed yet |
| Payment/Connect/fee/refund/dispute | Existing accounting/idempotency/scheduler suites | Real Stripe sandbox objects+signed hooks, card declines, 3DS and account restrictions | Authorized low-value live-money reconciled with real bank/provider IDs |
| Dispatch, booking, decline, pickup, completion | New continuous backend journey + existing 53 suites | Firebase emulator HTTP+real app staging environment | Real app availability, push, lock/force-quit, locations and customer UI |
| Family/Teen and Smart Travel | Existing suites; new Teen PIN lifecycle | Sandbox GTFS/OTP/fault fixtures | Signed devices, current actual transit feeds and split-charge receipts |
| Regional opening, location & facilities | In-memory three-county admission proof/expiry | Full synthetic rehearsal with all gates disabled from commercial scope | Named MFA `market_admission`, airport permits, insured/qualified fleet, live audited activation |
| National capacity & costs | Stress twice, scenario modeling | Staging with simulated provider faults and database emulator | p50/p95/p99, quota/billing and charged provider limits on production-equivalent stack |

## Reproducibility and sign-off

Run all required workflows on the *exact head SHA*. No green build alone can establish launch. Record `source_sha`, `environment`, `actor` (fixture or verified provider), `started_at_utc`, `case`, `expected`, `observed`, `provider_object_id`, `server_correlation_id`, `pass/fail/untested`, `boundary` and `evidence_reference`. Never mark an unexecuted step `pass`. Simulated event delivery proves only the behavior of the simulation, not live insurer, CRA or bank records.

Readiness authority remains `docs/COMMERCIAL-RELEASE-EVIDENCE.md`. One complete manifest per exact candidate SHA is required; production database market admissions are independently versioned, audited and protected. Never store secrets, identity reports or live policy PDFs in public GitHub artifacts. **Do not activate Tri-County commercial Travel from this campaign.**
