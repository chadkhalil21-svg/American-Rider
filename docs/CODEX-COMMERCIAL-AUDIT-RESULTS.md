# Codex commercial audit results

## Verdict

**AUTOMATED GATES PASS — EXTERNAL EVIDENCE PENDING.** The complete source gate, Firestore rules suite, and web/iOS/Android exports passed after the repairs. This document does not declare commercial release readiness.

## Scope and method

The audit enumerated all 47 Expo Router route identities and inspected all 49 route source modules, 1,005 localized strings in each of five catalogues, backend authority and provider modules, Firestore rules, and 74 tracked test files. It traced Traveler, Operator, Family/Teen, Smart Travel, payments, qualification, screening, insurance, scheduling, messaging, support, cancellation, recovery, offline/restart, provider-failure, and administrative paths. `docs/CODEX-ROUTE-STATE-INVENTORY.md` records route-level coverage.

Static inspection included direct React Native `Text` imports, untranslated literals, placeholder/demo language, hard-coded color use, route inventory, client writes, and button/accessibility semantics. Automated suites provide the behavioral authority evidence. Static source assertions are not treated as substitutes for provider or device evidence.

## Defects found and repaired

| Severity | Finding and reproduction | Repair | Regression evidence |
| --- | --- | --- | --- |
| P1 | `npm run check` failed in `backend/smarttravel.test.js`. Its two-car fixture used endpoints inside the walk threshold, so it produced zero car legs while claiming to test two. It also read the removed `quote.total` field, which produced `NaN`. | Moved both endpoints beyond the walk threshold and asserted the authoritative `travelerPays` fields. | `node backend/smarttravel.test.js` exercises two real car legs and reconciles the preview with both charges. |
| P1 | A failed Family invitation acceptance retried automatically after every rejected promise. The effect depended on `accepting`; the `finally` update caused an unbounded provider-request loop. | Added a stable request-attempt identity. A failure now stops and offers an explicit retry. | Typecheck plus source/state review; device interaction remains pending. |
| P1 | Family record reads converted every network/auth/provider failure into two empty arrays. The screen could state that no authorizations existed when the records were unreadable. | Kept the last authoritative state, added explicit loading/failure states, and added a retry action. | Typecheck and five-language gates. |
| P1 | Family invitation creation allowed duplicate taps while the first request was in flight. Family message send also remained enabled with empty text or during delivery. | Added input and in-flight disable gates. | Typecheck and state review. |
| P1 | Teen Travel showed a bare identifier with no label. | Added the localized `Travel Number` label and the shared `Mono` identifier style. | Typecheck and i18n gates. |
| P1 | Family relationship status rendered raw server enum values in all locales. | Mapped every server status to explicit EN/ES/FR/IT/DE catalogue entries. | `npm run i18n` reports all five catalogues complete and all keys used. |
| P1 | Operator chat contained an English-only interpolated placeholder and hard-coded fallback noun. | Routed both strings through existing localized keys. | Untranslated-string gate and catalogue completeness gate. |
| P2 | Saved-place entry exposed a Miami-specific English example on a national surface. | Replaced it with a neutral translated street-address instruction in all five languages. | i18n gates. |
| P2 | Operator chat used hard-coded white for outgoing messages and its send control. | Replaced it with the established `colors.solidFg` token. | Typecheck. |

## Deterministic gate record

The final report and pull request record the exact commands and final SHA. The focused Smart Travel test, complete source gate (TypeScript, all three localization checks, backend lint, and all backend tests), Firestore emulator rules suite, and web/iOS/Android exports passed. Signed native compilation and device behavior are not inferred from JavaScript exports.

## Unresolved code findings

No known code-remediable P0/P1 defect remains after the final automated gate. Some presentation comments still use the word “demo” to identify the founder design reference or explicitly gated demonstration fleet. Production readiness tests require production posture to disable that fleet. Those comments are not a production-visible claim.

P2 visual consistency work remains possible: some older screens use literal white in styles or SVG art instead of `colors.solidFg`, and native inputs do not all declare explicit accessibility labels. React Native derives names from visible text in many cases, but only a device accessibility campaign can decide the actual focus/name result. These items must be recorded during the required physical-device review and fixed if the signed build does not meet the acceptance standard.

## External and manual gates

All items below remain **PENDING** for the exact final candidate SHA:

1. Bound Florida TNC contingency policy/binder and broker/counsel review of English and translated disclosures.
2. Production deployment SHA and `/health` attestation.
3. Live Stripe, Checkr, Firebase, scheduler, HERE, OTP/realtime, email/support, phone verification, private document storage, operations authentication, push, and exposed calling evidence.
4. Signed-release physical-device campaign on two supported iPhones with different iOS versions and one supported Android device.
5. Operator background presence, connectivity transitions, permission revocation, force-quit, reboot, update, and 60-minute service campaign.
6. Complete Traveler, Operator, Family/Teen, Smart Travel, safety, support, cancellation, duplicate-action, offline, and restart device journeys.
7. Live multi-region Smart Travel campaign with known, unknown, changed, missed, cancelled, and unavailable transit cases.
8. Controlled production money reconciliation for charge, transfer, 99% share, tolls, retries, debt, refunds/disputes, and Operator account-cost recovery.
9. Independent screen-by-screen UX, localization, visual, accessibility, text-scale, and small/large layout review with complete screenshots.
10. Legal/compliance, provider, insurance, and independent human sign-off in a validated release-evidence manifest.

## Release status

- **CODE-READY:** YES.
- **COMMERCIAL-RELEASE-READY:** NO.
- Exact failed commercial gates: every pending external/manual gate listed above and every `pending` gate in `release-evidence.template.json`.
- PR #7 was not merged.
