# TestFlight Runbook — Certified Release Candidate

This runbook is subordinate to `docs/COMMERCIAL-RELEASE-ACCEPTANCE.md` and `docs/COMMERCIAL-RELEASE-EVIDENCE.md`.
It must never be used to bypass a commercial-release gate.

## Source of truth

1. Merge only a candidate whose pull-request Release Gate and commissioning workflows are green.
2. Record the resulting full `release/current` SHA.
3. Require the post-merge workflows on that exact SHA to pass.
4. Build TestFlight only through `.github/workflows/submit-certified-ios-testflight.yml`, supplying that exact full SHA.
5. The workflow refuses to build if the supplied SHA is not the current `release/current` revision.

Do not use an old hard-coded SHA, `--latest`, a local uncommitted tree, or an arbitrary branch.

## Before submission

Confirm for the exact candidate SHA:
- Release Gate passes, including iOS export and Firestore rules.
- Deterministic Commissioning passes.
- Whole Platform Adversarial Trace passes.
- Scale Stress Twice passes.
- Exhaustive Release Campaign Twice passes.
- Live Firebase Auth Commissioning passes when authentication/configuration is in scope.
- Production configuration intended for the build is documented and no demo/test bypass is reachable.
- App Store Connect / EAS submission credentials required by the workflow are configured.

## Build and submission

Run the GitHub Actions workflow **Build and submit certified iOS candidate to TestFlight** and enter the exact current
`release/current` SHA as `certified_sha`. The workflow:
- checks out that SHA;
- verifies it equals the current `release/current`;
- selects the next unused App Store Connect build number;
- creates the production EAS build;
- submits that exact build to TestFlight.

Retain the workflow run, EAS build ID, App Store Connect build number and candidate SHA as release evidence.

## Physical-device acceptance

A successful TestFlight upload is not commercial approval. Install the signed candidate and execute the physical-device
campaign in `docs/LAUNCH-DEVICE-PROVIDER-VALIDATION.md`, including authentication/session restoration, Traveler and
Operator journeys, background presence, network/permission transitions, Family/Teen, Smart Travel where enabled,
support/emergency, accessibility/layout, and account deletion/provider reauthentication.

Commercial release remains blocked until `release-evidence.template.json` is completed with durable evidence for the
same candidate SHA and validates with:

`npm run release:evidence -- /secure/path/evidence.json <full-candidate-sha>`

## Historical note

Earlier demo instructions involving fake money, simulated Operators, public demo routing, or a named simulated driver are
retired and are not valid for the current American Rider release process.
