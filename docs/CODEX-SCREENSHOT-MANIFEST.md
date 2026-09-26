# Codex screenshot and device manifest

## Candidate identity

This manifest belongs to the final commit that contains this file. The exact immutable SHA is recorded in the audit completion report and pull request because a Git commit cannot contain its own SHA.

## Result

No route is marked as visually passed. This Linux audit environment did not provide signed iOS/Android release devices, Apple Simulator tooling, Android hardware, VoiceOver, or TalkBack. The source and exports can be checked here, but those checks are not substitutes for device evidence.

| Surface | Required states | Small viewport | Current iPhone | Android | Dynamic Type / font scale | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Traveler/account (24 routes) | default, loading, empty, error, offline, input, restart, terminal as applicable | Not rendered | Not rendered | Not rendered | Not exercised on device | PENDING |
| Smart Travel (1 route) | known/unknown fare, provider none/down, changed plan, each leg boundary, cancellation/restart | Not rendered | Not rendered | Not rendered | Not exercised on device | PENDING |
| Operator (21 routes) | onboarding, held/refused/accepted, duty, offer, presence loss, Travel progress, settlement | Not rendered | Not rendered | Not rendered | Not exercised on device | PENDING |
| Not-found recovery (1 route) | unknown route and return | Not rendered | Not rendered | Not rendered | Not exercised on device | PENDING |

## Required capture procedure

1. Install the signed release build whose SHA equals the final candidate.
2. Capture every material state in `docs/CODEX-ROUTE-STATE-INVENTORY.md` on the required device matrix.
3. Use overlapping frames for scrollable pages and join them with `scripts/stitch-screens.swift`.
4. Record device model, OS, build SHA, locale, text scale, permission state, UTC time, and state fixture with every artifact.
5. Compare representative 390 × 844 web renders with the founder demo by computed style and geometry. Do not pass by sight alone.
6. Review focus order, accessible names, roles, error announcements, reflow, touch targets, keyboard avoidance, reduced motion, and contrast with VoiceOver/TalkBack.

## External stop condition

The UX, visual, accessibility, physical-device, and production-provider gates remain pending until durable artifacts for the exact candidate SHA exist. No screenshot was fabricated.
