# Whole-Platform Adversarial Trace — Operator and Traveler, Twice

This is a deterministic commissioning certification for the exact candidate SHA. It does not alter founder-locked UI. It exercises the authorities behind the entire application and inventories every route and server endpoint so surfaces cannot silently disappear from the audit.

## Fictional actors

**Operator:** Elena Marquez, a wholly fictional Operator. Her trace begins without qualification, market, documents, screening authority, insurance status, disclosure acknowledgement, payout readiness or duty status. Each prerequisite is established only through its authoritative path. Every premature or cross-account action is attacked.

**Traveler:** Alex Morgan, a wholly fictional Traveler. Alex begins with no active Travel authority. Quote, route, party, payment, dispatch, assignment, acceptance, progression, completion, receipt, support and optional systems are established in order. Client attempts to invent price, identity, assignment, state, settlement or provider success are attacked.

These names are test personas only.

## Operator trace

The Operator pass covers account/authentication and recovery boundaries; market/jurisdiction resolution; vehicle/document submission; screening and adverse-action semantics; insurance configuration/status/monitoring; disclosure; Connect/payout readiness; commissioning/qualification; online/offline duty authority; matching/assignment; acceptance; pickup; teen verification where applicable; messaging/voice; Travel progression; cancellation/return paths; completion; settlement; Operator fee treatment; revenue/withdrawal authority; inbox/support; and account closure.

For every stage the campaign attacks missing authentication, wrong role, wrong account, unsupported jurisdiction, missing/expired qualification evidence, premature duty, stale assignment, duplicate acceptance, illegal state reorder, duplicate progress, forged fare/payment/toll values, duplicate settlement, provider timeout/duplication, process loss and recovery.

## Traveler trace

The Traveler pass covers account/authentication; profile/account boundaries; places/preferences; route/quote/fare authority; payment methods; immediate and scheduled Travel; party identity; dispatch; matching; assignment; live Travel; messaging/voice/check-in; cancellation; completion/receipt; history/wallet; emergency; lost item; support; Family/Teen; Smart Travel/transit/tolls; notifications/follow links where represented by server authority; and account closure.

Attacks include unauthenticated and cross-account access, forged quote/payment inputs, stale/duplicate dispatch, wrong-party progression, duplicate provider callbacks, restart after authoritative writes, scheduled races, Smart Travel stale continuation, guardian/teen mismatch, lost-item wrong-party access and support isolation.

## Every screen and button

The executable campaign discovers all `app/**/*.ts(x)` route files from the candidate at runtime and records an explicit disposition for every one. It independently discovers every Express server endpoint from `backend/server.js` and records an authority disposition. The route inventory includes locked surfaces, which are exercised but not redesigned.

A static UI control can be visually present without being a server mutation. The certification therefore distinguishes route/control coverage from authoritative API/state coverage. The existing TypeScript, localization, product-decision, release-invariant and backend tests remain part of the ordinary Release Gate; this campaign adds the adversarial lifecycle composition.

## Pass 1 and Pass 2

Pass 1 runs the adversarial lifecycle suites from a clean process boundary. Pass 2 repeats the same complete suite set. The second execution is not decorative: it is intended to expose leaked global state, tests that only pass once, non-idempotent setup, duplicate side effects and restart assumptions.

Run:

```
npm run commission:whole-platform-twice
```

Machine-readable evidence is written to `artifacts/commissioning/double-whole-platform-adversarial-trace.json`.

A green result establishes deterministic behavior represented by the suites and completeness of the discovered route/API inventory. It does not establish physical-device rendering/native OS behavior, production provider acceptance, actual push receipt or live-money settlement.
