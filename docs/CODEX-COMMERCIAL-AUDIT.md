# Codex execution brief — commercial-release mechanical audit

## Mission
Audit the current American Rider candidate mechanically and exhaustively. Do not redesign the product. Treat `AGENTS.md` and `docs/COMMERCIAL-RELEASE-ACCEPTANCE.md` as binding, and read relevant decision history before changing an existing behavior.

## Scope
1. Enumerate every Expo Router route and every reachable material state: default, loading, empty, populated, error, offline/provider-unavailable, permission-denied, long-content, keyboard/input, interrupted/restart and completed states.
2. Build the app and run `npm run check`, Firestore emulator rules, web export, iOS export and Android export. Fix deterministic failures.
3. Generate a route/state inventory and screenshot evidence at representative small and current iPhone/Android viewport sizes wherever the environment can render them. Never call an unrendered state visually passed.
4. Audit every user-visible string in EN/ES/FR/IT/DE for the American Rider contract: Operator/Traveler/Travel terminology; institutional, authoritative, sophisticated register; complete sentences where appropriate; no consumer-gig slang; no test/demo/simulation copy in operational states; no mechanism exposure; no invented reassurance.
5. Audit visual conformity to the repository source of truth: typography, palette, spacing, cards, hierarchy, navigation, button priority, overflow/clipping and safe areas.
6. Audit accessibility mechanically: labels/roles, focusability, touch target sizing where inferable, text scaling/overflow, keyboard handling and contrast where tokens permit calculation.
7. Exercise critical journeys from fresh account through terminal state: Traveler immediate Travel, scheduled Travel, Smart Travel, Family/Teen Travel, Operator onboarding/qualification/duty/accept/progress/settlement, Inbox, support/safety, cancellation/refund.
8. For each transition, attack stale state, duplicate taps/requests, process restart, network failure, provider timeout, malformed response, unauthorized identity, another user's IDs, out-of-order events and retry.
9. Smart Travel specifically: test OTP unavailable/none/changed itinerary fixtures, unknown transit fare, first car Travel completion, cancelled first leg, leg-2 authority, Family/Teen party preservation, persisted restart continuation, two-charge preview/actual reconciliation, settlement and receipts.
10. Produce evidence, not confidence statements. A PASS must name the test/screenshot/build output and exact commit SHA. Anything requiring a physical OS behavior, production credential, live provider, insurance/counsel or human visual judgment that the environment cannot supply is PENDING, never inferred.

## Change constraints
- Search before changing. A later explicit founder decision supersedes an older one.
- Preserve server authority for price, identity, qualification, assignment, Travel state, institutional messages and money.
- Never introduce a second pricing formula.
- Never make transit agency money appear to be collected by American Rider.
- Never weaken a fail-closed gate to make a test pass.
- Do not change the established visual language into generic rideshare UI.
- Do not merge the release PR.

## Deliverables
- `docs/CODEX-ROUTE-STATE-INVENTORY.md`: every route/state and evidence.
- `docs/CODEX-COMMERCIAL-AUDIT-RESULTS.md`: findings by severity with file/line, reproduction, fix, test and residual risk.
- `docs/CODEX-SCREENSHOT-MANIFEST.md`: screenshot/state matrix and exact candidate SHA.
- Bounded code/test fixes on the audit branch.
- Final verdict must be one of: `AUTOMATED GATES PASS — EXTERNAL EVIDENCE PENDING`, `NO-GO — deterministic defects remain`, or `READY FOR FINAL COMMERCIAL RELEASE REVIEW`. Never declare commercial GO solely from this mechanical audit.
