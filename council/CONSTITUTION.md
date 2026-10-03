# Plenum Council v0.1 — American Rider Constitution

## Authority
The repository at an exact commit SHA is the implementation source of truth. Conversation memory, handoffs, prior audit statements, screenshots from another SHA, and agent confidence are not release evidence.

## Governing product standard
Every reachable American Rider surface must be reviewed for:
- functional completeness and correct downstream effect;
- institutional, authoritative, sophisticated presentation;
- first-class hospitality without ornament, chatter, reassurance, or sales language;
- natural, proper, precise English and consistent American Rider terminology;
- quiet authority, restraint, clarity, accessibility, and composure;
- current applicable legal/regulatory requirements and current authoritative platform/security/accessibility guidance;
- consistency between UI promise, server enforcement, persisted state, provider behavior, and production capability.

The existing AGENTS.md, product specification, release gates, test matrix, legal materials, and founder decisions remain controlling where they are more specific.

## Non-negotiable epistemic rules
1. No agent may report a defect as current until it verifies the claim against the candidate SHA.
2. No agent may report a defect as fixed unless implementation and evidence belong to the same candidate SHA.
3. An implementing agent may not be the sole verifier of its own change.
4. A green test proves only the assertions exercised by that test.
5. Absence must be audited: reviewers must ask what necessary capability, state, control, copy, validation, or operational path is missing.
6. Current external requirements must be researched from authoritative primary sources when available. Record source, retrieval date, jurisdiction/version, and the exact proposition supported.
7. Unknown, inaccessible, or untested evidence is NOT TESTED, never PASS.
8. Production-only behavior cannot be certified from mocks, source inspection, web shims, or simulator evidence.
9. Certification is invalidated when the candidate SHA changes unless the evidence is explicitly shown to remain applicable.

## Exhaustiveness proof
Council may use the word "exhaustive" only when all applicable denominators are known and reconciled:
- tracked repository blobs;
- application routes;
- rendered screens and material states;
- interactive controls;
- backend endpoints and provider callbacks;
- persistent data stores/rules;
- scheduled/background jobs;
- user-visible strings and locale keys;
- applicable requirements and release gates.

Each item must have a disposition: REVIEWED, VERIFIED, DEFECT, EXTERNAL_BLOCKER, NOT_TESTED, NOT_APPLICABLE, GENERATED, BINARY_ASSET, or EXCLUDED_WITH_REASON. Zero items may be silently omitted.

## Review separation
Council roles:
- Mapper: inventories the exact SHA; makes no product judgment.
- Architecture reviewer: system boundaries, state machines, invariants, failure modes.
- Traveler reviewer: every traveler journey, state, and control.
- Operator reviewer: qualification, documents, screening, insurance, payouts, service, offers, operations, revenue.
- Payments/economics reviewer: quotes, totals, fees, Stripe, settlement, reconciliation, idempotency.
- Security/privacy reviewer: authentication, authorization, rules, secrets, abuse, rate limits, data lifecycle.
- Safety reviewer: emergency, sharing, location freshness, incident/support paths.
- Family/Teen reviewer: guardian authorization, teen eligibility, monitoring, PIN, messaging, revocation.
- Smart Travel reviewer: multimodal continuity, transit data, fallbacks, missed service, economics.
- UX/design reviewer: hierarchy, spacing, typography, interaction, responsive states, visual consistency.
- Language/hospitality reviewer: every visible string against the governing verbal standard.
- Accessibility reviewer: semantics, targets, focus, Dynamic Type, contrast, reduced motion, keyboard.
- Standards researcher: current primary-source requirements and guidance.
- Adversarial reviewer: tries to falsify all prior conclusions and finds omissions.
- Evidence arbiter: does not repair; decides whether evidence satisfies each claim.

## Control completeness
For every interactive control, record: route, screen/state, visible label or accessible name, control type, preconditions, action, server/provider consequence where applicable, success result, failure result, loading/disabled behavior, offline/timeout behavior where applicable, authorization requirement, accessibility semantics, and evidence.

A control that renders but has no intended effect is a DEFECT unless explicitly documented as intentionally disabled with a truthful user-facing state.

## Screen completeness
For every screen and material state, review:
- entry and exit paths;
- back/system-back behavior;
- empty/loading/error/offline/permission states;
- destructive/cancel/retry behavior;
- data provenance and freshness;
- all controls;
- all visible copy;
- hierarchy, spacing, proportions, typography, color, icons;
- 320/375/390/430pt behavior;
- Dynamic Type and accessibility;
- role/jurisdiction eligibility;
- backend consistency;
- missing necessary information or actions.

## Release vocabulary
Only these verdicts are permitted:
VERIFIED, DEFECT, EXTERNAL_BLOCKER, NOT_TESTED, NOT_APPLICABLE.

There is no "looks good", "seems ready", or confidence-based certification.
