# Commercial Release Evidence Package

This package turns every non-code release condition into a binary, reviewable gate. It does not store secrets, card data, identity documents, insurance-policy PDFs or other sensitive artifacts in Git. The repository stores only the attestation metadata and evidence references.

## 1. TNC contingency insurance

**Pass only when all are true:** a policy/binder is actually bound and effective for American Rider's intended Florida TNC operations; the named insured/legal entity and applicable territory are confirmed; effective/expiration dates cover the release date; the broker/carrier has identified the coverage that satisfies the TNC's applicable statutory obligations, including the contingency that responds when required Operator coverage lapses/fails; the exact English Operator disclosure has been reviewed against the bound policy; ES/FR/IT/DE translations have been reviewed against that English wording; the deployed `TNC_INSURANCE_DISCLOSURE*` values reproduce the approved wording.

Record only carrier, policy/binder reference (redacted if necessary), effective/expiration dates, reviewer/broker, evidence location and approval date. Do not commit the policy itself unless counsel/operations deliberately approves doing so.

## 2. Production configuration/provider attestation

Capture the deployed revision and `/health` response with secrets absent/redacted. Production passes only when `deployment=production`, `operationalReady=true`, `operationalMissing=[]`, and the deployed SHA equals the candidate SHA.

Then prove provider behavior, not merely key presence: Stripe API connectivity + signed webhook delivery; Checkr production connectivity + signed webhook; Firebase Admin read/write; scheduler authenticated execution; HERE known-toll and no-toll responses; OTP current itinerary and realtime behavior where configured; receipt/support email delivery; phone verification; private document storage/read; named operations authentication; push delivery; platform calling if the call control is exposed.

For each provider record: environment, test identifier, UTC timestamp, expected result, observed result, provider-side identifier/log reference and American Rider-side identifier/log reference. Never put credentials in the evidence file.

## 3. Physical-device campaign

Use signed release builds. Minimum matrix: two current supported iPhones on different iOS versions and one supported Android device. Each device record must contain model, OS version, app build/SHA and permission state.

Run Operator presence under: foreground; 15-minute screen lock; 15-minute background; repeated app switching; Wi-Fi→cellular; cellular→Wi-Fi; 7-minute airplane mode then restore; low-power/battery-saver; precise-location loss; background-location revocation; force-quit; reboot; update/relaunch; 60-minute continuous service. Capture server `onlineAt`/dispatch evidence. **Pass:** fresh permitted background execution remains dispatchable; inability to provide trustworthy presence ages out and becomes undispatchable; recovery requires fresh server-observed location.

Run Traveler/Travel on physical devices: account creation/sign-in; payment method; quote; dispatch; accept; arrive; pickup verification where applicable; onboard; completion; receipt; cancellation at every supported phase; app kill/restart during each material Travel state; network loss/recovery; duplicate taps; support/emergency; follow link; Family/Teen guardian tracking and messaging.

## 4. Smart Travel live campaign

For every activated region, use real OTP/GTFS data and realtime data where the region supplies it. Record the exact itinerary/feed/agency identifiers.

Cases: ordinary itinerary; unknown/variable transit fare; changed transit after initial selection; missed connection; cancelled transit; realtime/planner outage; first car Travel completion → transit → second car continuation; cancellation/replanning; Family/Teen continuation; app termination/restart between legs; payment/receipt reconciliation for both car Travels.

**Pass:** American Rider never fabricates transit fare/service; changed/unverifiable service cannot dispatch a stale second leg; persisted journey/party survives restart; each actual car Travel has its own authoritative charge and settlement; receipts reconcile to provider records.

## 5. Controlled live-money reconciliation

Use authorized low-value production transactions. Record Travel Number and provider IDs, not PAN/card details. Prove exactly one Traveler charge per actual charged Travel, exactly one Operator transfer after completion, 99% of Travel Fare plus whole toll reimbursement, no commission on toll/government pass-through, retry idempotency, failed-transfer debt preservation, refund/dispute exposure accounting, and Operator account-cost recovery/waiver behavior.

## 6. Evidence manifest and sign-off

Copy `release-evidence.template.json` to an evidence file outside the public repository or in an access-controlled release system. Every gate requires `result: "pass"`, the exact candidate SHA, UTC execution time, executor/reviewer and at least one durable evidence reference. `npm run release:evidence -- /secure/path/evidence.json <candidate-sha>` validates completeness without inspecting the underlying sensitive artifact.

A missing artifact, a verbal assurance, a screenshot without an identifiable build/provider event, or a test performed against a different SHA is **not a pass**. PR #7 is mergeable only after CI is green and this manifest validates for the same candidate SHA.
