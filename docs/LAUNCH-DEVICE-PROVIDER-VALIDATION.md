# Device and Provider Validation Matrix

The executable release contract is `docs/COMMERCIAL-RELEASE-EVIDENCE.md`; record final results in a copy of `release-evidence.template.json` and validate it with `npm run release:evidence -- <evidence.json> <full-candidate-sha>`. This matrix supplies the detailed procedures. A result against another SHA does not release the candidate.

Automated tests cannot establish OS scheduling, push delivery, bank payout timing or provider production behavior. These are release gates. Record each execution with date, build SHA, environment, executor, evidence link, result and any incident/corrective-action reference. A row without evidence is not a pass.

## Operator background-presence campaign

**Owner:** mobile engineering / operations. **Environment:** signed release builds on physical devices. **Evidence:** device/OS version, permission state, server `onlineAt` timestamps, dispatch result and screen recording/log extract.

Run on at least two current iPhones and one supported Android device using release builds, not Expo Go.

For each case, put the Operator In Service, record the server `onlineAt`, then verify both sides of the invariant: genuine background location renews presence while permitted; when the OS/app can no longer provide trustworthy presence, dispatch stops after the five-minute server cutoff.

Cases: screen lock 15 min; background app 15 min; switch apps repeatedly; Wi-Fi→cellular; cellular→Wi-Fi; airplane mode 7 min then restore; low-power/battery-saver mode; revoke Always/background location; force-quit; reboot; app update/relaunch; loss of push permission; loss of precise location; 60-minute continuous operation. Force-quit/reboot are expected to fail closed rather than pretend presence survives.

Pass criteria: no stale Operator is matched; no active Travel is corrupted by a presence transition; returning to service requires fresh server-observed location; battery/OS permission failure is visible to the Operator.

## Stripe production/staged-money campaign

**Owner:** payments / operations. **Environment:** production Connect configuration with controlled low-value transactions. **Evidence:** Travel Number, PaymentIntent/charge/transfer/payout identifiers, ledger entries and relevant Stripe invoice line.

Use the production Connect account configuration in production validation with controlled low-value transactions. Verify one platform charge only; no `transfer_data` destination charge; exactly one transfer after completed Travel; transfer amount = 99% fare + toll; duplicate completion/retry produces no second transfer; failed transfer remains owed; refund/dispute after transfer creates explicit exposure record; payout.paid maps to the correct Operator active month; <20 completed Travels produces the separate monthly account-cost recovery; >=20 waives it.

Verify actual Connect invoice lines against the economic constants. If Stripe's contracted account/payout/routing pricing differs from public pricing, update `economics.js` before production use.

## Screening-provider production validation

**Owner:** compliance / operations. **Environment:** approved consumer-reporting-agency production validation using controlled test identities/events permitted by the provider. **Evidence:** report/case/adverse-action identifiers where applicable, event timestamps, persisted American Rider screening state and notice outcome.

Before production use, validate the approved provider's exact report fields, authoritative delivery mechanism and any adverse-action events used by American Rider. Confirm ambiguous or incomplete evidence remains blocked, duplicate/delayed provider events are idempotent, and statutory qualification decisions are made from authoritative evidence rather than an Operator-uploaded copy. Where adverse-action procedures apply, validate notice, dispute and correction handling against the provider's actual production workflow.

## Infrastructure fault injection

**Owner:** backend engineering / operations. **Environment:** staging or isolated production-validation environment; never inject destructive faults into ordinary Traveler or Operator activity. **Evidence:** fault start/end, affected request/event IDs, server/provider logs, recovery state and confirmation that money/Travel state remained idempotent.

Staging: temporarily deny Firestore writes to provider_events (webhook must return non-2xx); kill server after durable receipt (event must replay); run two server instances (one sweep leader); inject Stripe timeout; inject Checkr timeout; disable push; disable support email; routing timeout; Firestore quota/resource-exhausted response; restart during settlement; 100 simultaneous scheduled reservations; concurrent accept attempts; duplicate dispatch requests; out-of-order provider events.

Release requires a recorded pass/fail artifact for every row. A green unit-test workflow is necessary, not sufficient.


## Production configuration attestation

**Owner:** deployment administrator / operations. Record the deployed revision and independently verify: production Firebase project; restricted Stripe secret key; Stripe webhook signing secret; approved screening-provider production configuration and authoritative report/event delivery; non-empty `SCHEDULER_TOKEN`; operations authentication; support-email delivery; private document/object storage; production routing/toll providers; Firebase authorized domains; Apple and Google sign-in provider configuration; push credentials; and absence of test/demo bypasses. Capture `/health` with secrets redacted and confirm `scheduler: authenticated` plus each required provider readiness signal.

## Toll-route campaign

**Owner:** routing / operations. Select controlled routes containing known toll facilities and routes with no tolls. Record route geometry, provider response, toll amount, quote, final charge and Operator reimbursement. A tolled route must not proceed on an assumed zero toll when the toll provider is unavailable or uncertain; non-tolled routes must not incur a toll line.

## Evidence register

| Gate | Build SHA | Environment/device | Executor | Evidence | Result | Corrective action |
| --- | --- | --- | --- | --- | --- | --- |
| Background presence |  |  |  |  | Pending |  |
| Stripe money movement |  |  |  |  | Pending |  |
| Screening provider |  |  |  |  | Pending |  |
| Infrastructure faults |  |  |  |  | Pending |  |
| Production configuration |  |  |  |  | Pending |  |
| Toll routes |  |  |  |  | Pending |  |
