# ADR 0015 — Know which release is actually running
Date: 2026-10-14
Status: review candidate

## Proven problem
Connected Render production server and web apps deploy from `chadkhalil21-svg/American-Rider` (`release/current`), LIVE commit `854774bef619b01202004a53888dde43dc50a4a6`.
The county-admission cleanup merged to independent repository `chadkhalil21-svg/American-Rider-Commercial` at `b731a80891e2491c1d247f06041fa50a7a6559dc`; the new code does not automatically become production. Issue #207 records integration and rollback work.

## Decision
Add one protected, read-only `GET /ops/release-provenance` response. It reads Render-supplied `RENDER_GIT_REPO_SLUG`, `RENDER_GIT_BRANCH`, and `RENDER_GIT_COMMIT` and checks whether the source repository and branch match the existing production release path. No network, provider call, Firebase read, mutation, or additional launch approval is required. Unavailable environment data means `unverified`, never falsely `matches`; an independent repo or wrong branch means `mismatch`. Actual commit is reported for comparison to GitHub and Render, not accepted solely because its format is valid.

Source identification does not certify commercial readiness, insurance, law, Operator screening, actual payments, device function, or scale. In particular the endpoint must not enable paid bookings in currently blocked markets.

## Primary references
- Render default environment identifiers: https://render.com/docs/environment-variables
- NASA intended-use verification: https://www.nasa.gov/reference/system-engineering-handbook-appendix/
- Google Firestore minimizing reads and hotspotting: https://docs.cloud.google.com/firestore/native/docs/best-practices
- Amazon safe retries: https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/

## Exact-SHA evidence
`backend/release-provenance.test.js` is deterministic and runs twice. This is an instrumentation-only PR and must pass full CI before merge; after merge, query the authenticated route and compare actual Render LIVE deploy SHA. It is not a substitute for integrating the separate Commercial release, physical-device tests, real insurance/provider attestations, or controlled payment reconciliation.
