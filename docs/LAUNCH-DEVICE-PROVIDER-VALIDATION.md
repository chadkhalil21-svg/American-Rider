# Launch Device and Provider Validation Matrix

Automated tests cannot establish OS scheduling, push delivery, bank payout timing or provider production behavior. These are release gates.

## Operator background-presence campaign

Run on at least two current iPhones and one supported Android device using release builds, not Expo Go.

For each case, put the Operator In Service, record the server `onlineAt`, then verify both sides of the invariant: genuine background location renews presence while permitted; when the OS/app can no longer provide trustworthy presence, dispatch stops after the five-minute server cutoff.

Cases: screen lock 15 min; background app 15 min; switch apps repeatedly; Wi-Fi→cellular; cellular→Wi-Fi; airplane mode 7 min then restore; low-power/battery-saver mode; revoke Always/background location; force-quit; reboot; app update/relaunch; loss of push permission; loss of precise location; 60-minute continuous operation. Force-quit/reboot are expected to fail closed rather than pretend presence survives.

Pass criteria: no stale Operator is matched; no active Travel is corrupted by a presence transition; returning to service requires fresh server-observed location; battery/OS permission failure is visible to the Operator.

## Stripe production/staged-money campaign

Use the production Connect account configuration before public launch with controlled low-value transactions. Verify one platform charge only; no `transfer_data` destination charge; exactly one transfer after completed Travel; transfer amount = 99% fare + toll; duplicate completion/retry produces no second transfer; failed transfer remains owed; refund/dispute after transfer creates explicit exposure record; payout.paid maps to the correct Operator active month; <20 completed Travels produces the separate monthly account-cost recovery; >=20 waives it.

Verify actual Connect invoice lines against the economic constants. If Stripe's contracted account/payout/routing pricing differs from public pricing, update `economics.js` before launch.

## Checkr production validation

Checkr staging does not support post-adverse action. Before launch, validate with Checkr the exact package slugs, report fields and adverse-action events used here. Confirm pre-adverse delivery, dispute pause, dispute completion/correction, cancellation on cleared evidence, post-adverse completion, undeliverable notice, duplicate webhook and delayed webhook. American Rider remains blocked on ambiguous evidence and never turns provider `consider` into its own refusal automatically.

## Infrastructure fault injection

Staging: temporarily deny Firestore writes to provider_events (webhook must return non-2xx); kill server after durable receipt (event must replay); run two server instances (one sweep leader); inject Stripe timeout; inject Checkr timeout; disable push; disable support email; routing timeout; Firestore quota/resource-exhausted response; restart during settlement; 100 simultaneous scheduled reservations; concurrent accept attempts; duplicate dispatch requests; out-of-order provider events.

Release requires a recorded pass/fail artifact for every row. A green unit-test workflow is necessary, not sufficient.
