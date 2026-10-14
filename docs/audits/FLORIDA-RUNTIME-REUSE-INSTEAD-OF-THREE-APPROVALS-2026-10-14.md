# Florida opening: remove duplicate software approvals (2026-10-14)

## Founder directive
Modify American Rider's actual code to reduce unnecessary regional activation bureaucracy. Existing standing GitHub-command `founder-open-fl-southeast-20261013` is already reaching production and must be reused. Do not contact anyone or spend money without separate authorization.

## Real defect and remedy
`backend/market-readiness.js` asked for independent evidence for fourteen categories, **including three matters already decided and enforced by deployed configuration**. For each Miami-Dade, Broward and Palm Beach activation, it demanded new forms for: `jurisdiction_authority`, `operator_insurance_process`, and `screening_agreement`.

The new `backend/market-runtime-controls.js` acknowledges the existing, deployed Florida configuration for exactly those three repeated paperwork categories, and only when the configured Florida source manifests are intact and match the statute. **It does not create any fake records in Firestore.** The paid-Travel gate `activateRegion()` remains atomic and always recomputes the remaining independent evidence and live provider health. Unknown jurisdictions or invalid market source configurations fail closed.

- Florida §627.748(17) preempts extra ordinary county/city TNC licensing, and county boundaries/statute/fees are already verified in `regionAdmissionProblems()`. Airports/seaports and restricted facilities remain separate.
- Operator-funded primary qualifying TNC/commercial insurance is already enforced at online/dispatch/acceptance, including 24h expiry horizon and immediate adverse status. This does NOT establish an independently verified **company insurance** solution when the Operator's coverage fails. `company_insurance_bound` remains mandatory and missing; no policy purchased or alleged.
- Florida §627.748(12) obliges qualifying local/national criminal+sex offender and MVR checks, not a specific exclusive screening agreement. Provider-neutral `screeningCurrent()` and `screeningReady()` remain; if external production screening handoff isn't verified, the `provider:screening_provider` launch gate remains closed.
- The other eleven evidence domains remain, including independent real-money reconciliation, accessible service, qualified fleet, devices, emergency response and backup restoration. All release tests and real-world requirements are still required.

## Published source-based rationale
[Florida 2026 Statute §627.748](https://www.flsenate.gov/Laws/Statutes/2026/627.748), [Google SRE eliminating toil](https://sre.google/workbook/eliminating-toil/), [Google SRE principles: simplicity/reliability](https://sre.google/sre-book/part-II-principles/), [AWS Builders' Library safe idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-apis/). These are published principles, not personal endorsements.

## Verify or revert
The new 2-pass synthetic test covers all three counties, 3 former duplicate blocks, genuine external coverage and screening dependencies, missing Operator insurance, missing background decision, missing policy expiry, corrupted geography/unknown jurisdiction and no partial activation. Update historic regional tests to use mandatory independent company-insurance blocker rather than already-configured screening agreement. All six exact-commit CI campaigns must pass and all three Render services must show matching live SHA before declaring deployed. On production, observe founder command and cite its actual status, not a merge. This change is NOT authority to sell Travel without genuine external coverage, verified screening delivery and protected payment/safety prerequisites.
