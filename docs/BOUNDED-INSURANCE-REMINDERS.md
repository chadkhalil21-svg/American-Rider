# Bounded insurance reminders

Baseline inspected: `39da42eb0287ad8f00763e5231ee6728cc5614e5`, 10 October 2026.

## Proven defect and repair

The one-minute scheduler could notify the same overdue Operator on every cursor
cycle. It did not persist reminder attempts, and counted `notify({ok:false})` as a
reminder success. The shared push sender also returned success for HTTP failures
or responses without an Expo acceptance ticket.

Use the existing scheduler, Firestore user record and Expo transport. No new
provider, recurring AI call, subscription, queue service or founder action is
introduced. Each independently confirmed policy cycle has two reminder stages:

- **Due:** ask for the bounded attestation while independent verification proceeds.
- **Stale:** ask for independent confirmation; an attestation no longer restores service.

Each stage permits at most three send attempts, with a 15-minute then 60-minute
retry delay. An accepted stage is not sent again. The scheduler selects the
current stage only; it does not send missed historical reminders. Attestation
suppresses the due-stage message, but does not suppress the stale-stage message.
A new independent confirmation starts a new cycle. Cancellation and other
adverse states do not receive misleading attestation prompts.

`users/{uid}.insuranceReminder` stores only the current cycle digest and at most
two small stage records. Client writes are excluded by the existing user field
allowlist. Account removal deletes this record with the user. No policy number
is added to reminder bookkeeping. A transaction claims the attempt before any
network call and reads the current policy state again. Failed claim persistence
prevents an untracked send. A query snapshot with an accepted or backed-off
reminder incurs no additional reminder transaction.

The sender requires HTTP success and a valid Expo `status: ok` ticket with an ID.
Network I/O has a ten-second timeout. `reminded` counts Expo acceptances, never
device deliveries. Failures appear in the existing sweep report.

## Practical limits

A crash after Expo accepts but before the receipt is saved can cause a bounded
retry. This is not an exactly-once delivery guarantee. Push receipt reconciliation
and actual phone delivery testing remain separate work. A cancellation or policy
change after the transaction can race with the push; the notification never
grants authority and live eligibility remains authoritative.

These controls do not reduce the underlying due-policy query scan or batch
carrier emails. At a perfect 250 records each minute, one full pass across one
million due records takes 4,000 minutes (66 hours 40 minutes), before actual
Firestore/provider latency. This arithmetic is a ceiling for the present single
sweep, not measured throughput or million-Operator certification. Provider batch
and signed-event channels still require actual provider agreements and tests.

## Launch and founder authority

The founder authorized Miami-Dade, Broward and Palm Beach activation on
10 October 2026. Do not ask for that authorization again within this task.
Activation still requires the real current evidence already specified by
`market-readiness.js`, through named Operations authentication. A browser access
failure does not authorize direct database edits, weakened gates, fabricated
attestations or a new privileged endpoint.

PRs 73–83 implement the existing screening and insurance controls. This change
does not commission a provider, purchase coverage, adjudicate a screening report,
activate a county or replace required external evidence. The provider-neutral
screening handoff currently still includes human source authentication and review.
No automatic screening feed has been established by this change.

## Validation and guidance

Regression tests exercise repeated sweeps, parallel claim attempts, backoff,
failure accounting, renewed policies, attestation, stale grace and preserved
eligibility. They also reject HTTP errors, invalid JSON and missing push tickets.
These are local deterministic tests; they are not production delivery tests.

- [Expo push reliability and tickets](https://docs.expo.dev/push-notifications/sending-notifications/): acceptance and delivery differ; use bounded retries and check receipts.
- [GOV.UK Service Standard, point 11](https://www.gov.uk/service-manual/service-standard/point-11-choose-the-right-tools-and-technology): choose cost-effective technology and reuse suitable tools.
- [Google Cloud retry controls](https://docs.cloud.google.com/tasks/docs/configuring-queues): bound retries and use backoff. This is design guidance, not a new Cloud Tasks dependency.
