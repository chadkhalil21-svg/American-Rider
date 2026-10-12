# American Rider — targeted synthetic provider and safety verification
**Date:** 12 October 2026. **Method:** real Stripe SDK signature operations; American Rider's production provider queue and handler against a fake Firestore adapter; no external service requests, live money, passengers, dispatches or phones.

## Authority: consult before implementing
- [Stripe webhook signatures](https://docs.stripe.com/webhooks/signature): sign the exact raw event body and reject altered payloads and incorrect secrets. Event ordering and duplicate delivery must be safe; verify the test-mode provider endpoint separately.
- [Amazon Builders' Library, safe retries](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/): a repeat attempt must not create a second payment or support case.
- [Google Firestore emulator limitations](https://firebase.google.com/docs/emulator-suite/connect_firestore): emulators do not enforce all production concurrency or index rules; an in-memory double has still weaker guarantees. Continue real Firestore emulator testing in the Release Gate.
- [Expo push receipts](https://docs.expo.dev/push-notifications/sending-notifications/): Expo push ticket != receipt != observed on-phone display. A simulated push success cannot settle mobile-device commissioning.
- [NASA SWE-055](https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695440/SWE-055%2B-%2BRequirements%2BValidation): validate the real intended service environment separately.
- Founder-ratified council framework: Ford = repeatability, Rockefeller = bounded costs, Jobs/Apple = predictable user recovery, MIT/HBS/Stanford = measurable platform outcomes. These are published reference lenses and not actual consultation or endorsements.

## New combined synthetic campaign
`backend/synthetic-provider-chain.test.js` invokes actual installed Stripe SDK signature verification, actual production `backend/providerqueue.js` and `backend/webhook.js`, with synthetic event bodies and a serialized, transactional memory adapter. It exercises TWO independent passes, including:
- correct signing, raw-body tampering rejection, wrong signing-key rejection and Connect/general secret separation;
- provider duplicate callback, concurrent competing workers, durable accepted event, exactly one completed event;
- genuinely matching payment writes to correct fictional Travel, different successful PaymentIntent cannot overwrite it, stable support case for unmatched payment;
- valid refund success generates no *failure* ticket; failed refund under support outage is not acknowledged done; retry after recovery marks Travel and makes one issue; separate event type for same refund ID does not duplicate case; out-of-order eventual success cannot erase failed-refund review without explicit reconciliation;
- dispute creates correct case and Travel state; a restricted Connect account goes off duty;
- database outage refuses the event rather than giving false success.

The deterministic commissioning manifest also executes `backend/monitor.test.js` and `backend/push-acceptance.test.js` explicitly alongside the new chain. Those test urgent requests over congestion, lost case write/notification, uncertain Expo tickets and stale push tokens. Existing `backend/scale.test.js` runs 1M *economic calculations* and bounded mock matching; real 1,205-doc emulator page test is retained separately. No real thousand-user concurrency is implied.

**Result boundary:** tests only count after GitHub's exact-head results finish. Code-level passes cannot certify signed provider callback delivery into the production backend, payment metadata reconciliation from real Stripe, physical phone emergency behavior, staffing or measured cloud database peak capacity. The production render service must not be load-stressed in this test.

**Release policy:** only merge after full exact-head protected CI; verify Render SHA. The founder's Operator-funded insurance decision and platform commercial gates remain unchanged.
