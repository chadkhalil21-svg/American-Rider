# ADR 0003 — Provider-neutral jurisdiction-based screening

**Status:** Accepted founder business policy; a production CRA pilot remains uncommissioned. **Recorded:** 2026-10-10.

## Context
A single exclusive screening supplier imposes unnecessary vendor lock-in and may not support every jurisdiction or every Operator's existing provider. A report cannot be treated as cleared for American Rider merely because the Operator uploaded it or obtained it for a different purpose.

## Decision
Use the national `backend/screening-jurisdictions.js` policy registry; commission the exact state checks and local rules before use. Operators may use qualifying licensed and authorized CRA sources. Seek Operator-direct payment when contractually and legally possible, but do not pretend it is always available. Require lawful permissible purpose, disclosure/authorization, authenticated CRA-to-platform report evidence, valid age, identity and jurisdiction match. Apply deterministically verifiable clear outcomes only where source proof and legally approved procedures genuinely support automation; otherwise follow an auditable exception, pre-adverse, dispute and final-action path. Current Florida case handoff/review is real software, **not yet an automated carrier-like signed CRA feed**.

## Consequences
A reusable screening engine for national growth, low vendor lock-in and privacy-by-design; real CRA agreements and an end-to-end commissioned pilot are required. The founder must not approve every clean Operator. The system must not silently accept unsupported providers or translate a Florida clearance into another state's authorization.

**Implementation:** `backend/screening-jurisdictions.js`, `backend/screening.js`, `backend/screening-handoff.js`, `backend/external-screening.js`, `backend/qualification.js`. **Commissioning:** [docs/SCREENING-PROVIDER-COMMISSIONING.md](../SCREENING-PROVIDER-COMMISSIONING.md), [FTC guidance](https://www.ftc.gov/business-guidance/resources/using-consumer-reports-what-employers-need-know).

## Founder reaffirmation — 14 October 2026
**No exclusive Checkr or other CRA signup.** Operators may obtain a new report from any qualifying source or request review of an existing report through `app/operator/background.tsx`. They authorize release to American Rider; the existing case number accompanies a source-authenticated agency portal/secure delivery review, which is recorded without saving the raw criminal report in Firestore. Existing-report eligibility for the requesting platform's purpose must be confirmed by the agency; a self-provided copy is a request, not clearance. The Florida searches and driving history, statutory disqualifiers, three-year renewal and adverse process are already coded. Do not rebuild this machinery or require a founder decision per routine clean case. A real report received and verified through this existing channel remains an independent commissioning fact; provider-neutral is not synonymous with no source validation. Prefer one privacy-preserving existing channel over signing a costly exclusive or building a new vendor integration.
