# American Rider — Source-first provider-recovery and Stripe signature audit, 12 October 2026

**Status: proposed code and synthetic tests. Not external provider or commercial launch certification.**

## Decisions respected

- The canonical `PROJECT-LEDGER.md` and ADR 0002 state the founder's current position: American Rider has **no automobile/TNC insurance and provides none**; Operators independently obtain/pay for qualifying insurance. No insurance purchase/terms changes in this branch. Florida's separate insurer-duty question remains in issue #51, and commercial admission remains locked while it is unresolved.
- PRs #146 and #147 are live at SHA `52255b65`: verified-Charge refund balance, refund-failure support case; do not rebuild them. PR #148 is a checked, **open** ledger-documentation change whose merge was blocked by an action safety check. The released ledger already states the current no-insurance position but still needs its snapshot refreshed.
- The connected Stripe sandbox has only an untagged $100 successful intent and transfer with zero refunds/disputes and no registered sandbox webhook endpoint. Production notifications are configured, but actual signed provider delivery under failure and end-to-end Travel monetary reconciliation remain unverified. Do not point a sandbox test destination at production money handlers or reuse real secrets.

## Governing original institutional sources

1. Google Cloud Firestore best practices: https://firebase.google.com/docs/firestore/best-practices — gradual capacity ramp, cursor-based paging, prevent hotspotting, measure actual reads and query latencies before peak-load claims.
2. Amazon Builders' Library: https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/ and https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/ — use an event identity to prevent repeated side effects, bounded retries, and jitter to avoid synchronized retry storms.
3. NASA SWE-055 Requirements Validation: https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695440/SWE-055%2B-%2BRequirements%2BValidation — verify normal and off-normal customer operating conditions with objective evidence; synthetic tests alone cannot prove live phone/user/provider behavior.
4. Stripe documentation: https://docs.stripe.com/webhooks and https://docs.stripe.com/testing — verify exact request bytes and signing secret, reject replay/tampering, simulate partial/asynchronous failed refunds in **isolated test mode**, never move live money for commission tests.

## Reviewed source and corrected failure behavior

- `backend/providerqueue.js` already acknowledged signed provider events only after durable Firestore storage, used create-only event identity, bounded 12 retries and 15-minute maximum backoff, a lease for concurrent workers, and dead-letter recovery. **Actual uncovered failure:** every event at the same retry attempt waited the same interval, creating synchronized retry waves under a common outage.
- Added a deterministic 50–100% hash-jitter factor keyed to `provider:eventId:attempt`; it changes only failed-event retry schedules, not first receipt, signature check, leasing, permanent deduplication, dead-letter ceiling or Stripe payouts. It requires no vendor, database read or hidden random state. Test twice using 2,000 distinct concurrent failure identities, repeated attempts and bounds. Note: hash jitter distributes schedules; it is *not* live throughput proof.
- `backend/stripe-signed-webhook-contract.test.js` exercises actual installed Stripe SDK signing/verification wholly offline. It must accept a valid raw `refund.failed` event and reject altered bytes, the wrong Connect/general secret, stale timestamp and invalid signature. Static safeguards ensure Express parses Stripe routes as raw bytes BEFORE global JSON middleware. This is SDK/route-contract proof, not an external network delivery test.

## Remaining original critical commissioning gates

- Confirm the sandbox-isolated signed webhook receiver and fresh tagged test-mode PaymentIntent, Connect transfer, partial/full refund, transfer reversal rules, dispute, and delayed failure with provider delivery tracking and real Firestore receipt. See issue #143.
- Independently demonstrate live iOS/Android Stripe payment sheets, notifications and emergency human escalation without real passengers or 911 test calls. See issue #138.
- Obtain lawful Florida company/Operator insurance determination and binding proof if legally required. Do not assert coverage. See issue #51.
- Measure Firestore billed read/write load, retries, alert/event queue age and latency at realistic 10k, 100k and 1m registered-user arrival distributions. Existing synthetic capacity forecasts do not certify provider capacity.
- Complete national local Operator net, official wage geography and current independent route-matched ordinary Traveler fare evidence before changing prices.

**Release rule:** All exact-head protected workflows (including the two exhaustive runs) must pass before merge; Render deployment SHA must be checked independently afterward. No fare, insurance, jurisdiction or financial transaction change in this patch.
