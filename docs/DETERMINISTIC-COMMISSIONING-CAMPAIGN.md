# Deterministic Commissioning Campaign

This campaign increases release confidence without misrepresenting what source-code execution can prove.

Run:

```
npm run commission:deterministic
```

The command executes the repository's adversarial journey, payment, settlement, provider-queue, Smart Travel, transit, toll, scheduler and launch-failure suites as one commissioning campaign and emits a machine-readable artifact at `artifacts/commissioning/deterministic-commissioning.json`.

## Evidence boundary

A passing deterministic campaign establishes repeatable behavior of the candidate code for server-authoritative state transitions, invalid-transition rejection, payment idempotency, fare/fee/operator-share reconciliation, settlement recovery after client loss, durable provider-event replay after a simulated process failure, duplicate suppression, Smart Travel continuation reconstruction, multi-transaction economics, provider-failure handling represented by injected failures, and scheduler/concurrency invariants.

It does **not** establish native OS background execution, physical-device permission behavior, rendering on a particular handset, actual push delivery, production bank payout timing, or production-provider acceptance. Those claims require their corresponding live/device evidence.

## Live/public transit check

Where an authorized/public transit endpoint is reachable from the validation environment, execute the existing transit integration against that endpoint and retain the raw response (with secrets removed), timestamp, endpoint identity, candidate SHA and mapped result. Public-feed evidence is classified as `live/public integration`; saved OTP responses and stand-in fetches remain `automated deterministic`.

A live-feed outage does not become a fabricated pass. Record it as unavailable with timestamp and retain the deterministic provider-failure result separately.

## Kill/restart semantics

The campaign tests two distinct restart classes:
- Smart Travel continuation state is persisted and reconstructed after client process loss, but reconstructed client state does not create server authority.
- Provider events and completed unsettled Travel remain recoverable after backend worker/process loss; expired leases can be reclaimed and completed events are not processed twice.

## Accounting reconciliation

The campaign verifies canonical platform-fee calculations across domestic, international and unknown-card branches; 99% Operator fare share; government/toll pass-through treatment; Smart Travel two-transaction economics; keyed PaymentIntent creation; completed-Travel settlement; failed-transfer debt preservation; and duplicate-settlement prevention.

This artifact is supporting commissioning evidence. It does not replace production configuration, controlled live-money reconciliation, live-provider evidence, or device-only evidence where those gates are required.
