# Distribution and Commissioning Runbook

This runbook starts from the exact green `release/current` candidate. It separates deterministic preflight from evidence that only signed devices and live providers can establish.

## Deterministic preflight
Run `npm ci` and then `npm run release:preflight`. The preflight executes the full code check and the commissioning trace. The trace verifies the authoritative modules and both mobile application identities. It is simulation only and never marks a production evidence gate passed.

## iOS / TestFlight
The iOS bundle identifier is `com.americanrider.app`; App Store Connect submission metadata is present in `eas.json`.

Build: `npx eas-cli build --platform ios --profile production`
Submit: `npx eas-cli submit --platform ios --profile production`

Record build number, EAS build ID, TestFlight build ID, candidate Git SHA and UTC time in the controlled evidence store.

## Android
The Android package is `com.americanrider.app`.

Build: `npx eas-cli build --platform android --profile production`

Install the signed artifact on a supported physical Android device and execute the same authority/state campaign used for iOS. Record EAS build ID, Android version/device, candidate SHA and evidence references.

Google Play submission is a separate credential boundary. Do not invent a service-account key or Play application record. Once the actual Play Console application and credentials exist, configure EAS Android submission and submit the exact validated candidate.

Google Pay is currently disabled in the Expo Stripe plugin. This does not block ordinary card-payment Android validation; enabling Google Pay is a separate product/payment configuration decision and must be validated before it is advertised.

## Physical-device campaign
Use `docs/COMMERCIAL-RELEASE-EVIDENCE.md` and `docs/LAUNCH-DEVICE-PROVIDER-VALIDATION.md`. Minimum matrix: two supported iPhones on different iOS versions and one supported Android device.

Classify failures as code defect, production configuration/provider defect, or expected fail-closed behavior. A code change creates a new SHA and requires the affected evidence to be rerun.

## Controlled live Travel
Only after production configuration reports operational readiness, execute a low-value controlled Travel with a qualified Operator and controlled Traveler. Reconcile quote, charge, Travel Number, Operator assignment, state progression, receipt, 99% fare settlement, toll/pass-through treatment where applicable, and idempotency/provider records.

Public commercial launch follows only when the evidence manifest validates for the exact deployed SHA and enabled launch scope.
