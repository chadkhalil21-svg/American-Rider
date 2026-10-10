# Operator screening — production commissioning gate

**Status (10 October 2026): NOT COMMISSIONED.** A public screening-provider URL is not evidence that background screening works. The production service must remain closed to paid Travel until an approved consumer-reporting agency (CRA) and the actual report-delivery/adjudication process have passed a documented end-to-end pilot. Florida launch requirements: https://www.flsenate.gov/Laws/Statutes/2026/627.748 (especially subsection (12)). Confirm all legal/FCRA/adverse-action handling with qualified counsel.

## Architecture and limitations observed
- The app at `app/operator/background.tsx` offers a provider URL (when configured) and a separate **existing report — review request**. That request opens a case only: an Operator declaration **never** approves them.
- `backend/screening.js` contains Florida screening adjudication, operator suspension, and 3-year expiry. Live qualification requires a real, current `pass`, not an onboarding checkbox.
- `backend/checkr.js` contains an old optional, provider-specific adapter, **but no active Checkr webhook is mounted in the current server**. Do not claim a Checkr pipeline is live merely because code or an API key exists.
- The system does **not** yet include a general provider-neutral authenticated report-intake workflow and staff review completion path. The provider-selection and integration step cannot be replaced with an arbitrary URL or a manually asserted success.
- Production `screeningReady()` now requires **both** `SCREENING_PROVIDER_URL` (HTTPS) and `SCREENING_PROVIDER_E2E_VERIFIED=true`, a release sign-off set **only after** demonstrated evidence. The flag is an owner attestation, not an automated independent verification. **Leave it unset/false until the whole process has been demonstrated.**
- All production matching calls demand screening independently of that setting. A missing provider must never weaken eligibility.

## Commissioning checklist — required before flipping readiness
1. **Procure:** Owner selects an accredited/appropriate CRA willing to screen TNC Operators. Confirm the permitted purpose, written contract, supported states, operator-paid vs company-billed policy, consent, and data processing/retention. Do **not** promise operator-direct payment until the provider confirms it.
2. **Package:** Obtain documented proof the CRA can perform: (a) a local/national criminal background search including commercially sourced nationwide database and primary source validation, (b) the DOJ national sex-offender database search, and (c) a driving history research report. Map disqualifiers and repeat every 3 years as required by Florida statute. Historical checks from other purposes require fresh CRA permission/provenance and a documented legal review—not automatic transfer.
3. **Intake:** Implement a secure authenticated route for the selected provider's signed result (or a secure authenticated staff-only case review process with verified CRA delivery and audit trail). Never accept a screenshot, user assertion, arbitrary webhook POST, or forwarded consumer copy as dispositive. Minimize PII and restrict access/retention.
4. **Adjudication and exceptions:** Verify source identity, operator identity, report issuance date, all required components, moving violations, unresolved/ambiguous records, individualized review and legally compliant notice/adverse-action sequence. Unreadable or disputed records stay **on hold**, never pass. Audit who acted and why.
5. **Realistic pilot:** With provider-issued staging or owner-approved test cases, demonstrate invitation/receipt or consented report transfer, vendor-signed delivery, full clear result, refusal/hold, adverse notice and dispute, retries/deduplication, wrong-operator isolation, and three-year expiration. Prove a current PASS on the server gates an actual eligible operator, and unscreened operators cannot go on duty or accept paid Travel. Keep the market on waitlist while testing.
6. **Release evidence:** Record the provider's identity, agreement, report package, direct-payment confirmation (if applicable), signed pilot evidence and production QA date. Only after passing should the owner set `SCREENING_PROVIDER_URL` and `SCREENING_PROVIDER_E2E_VERIFIED=true` in Render and verify `/health`, `/ops` and physical-device onboarding. **Do not enable the sign-off merely to clear `operationalMissing`.**

## Distinct responsibilities
- GitHub/ChatGPT can safely develop and test integration code and operational controls.
- The owner must authorize the CRA account, provider contract, and commercial payments, and approve the compliance workflow before it becomes live.
- Provider access tokens belong in Render secret configuration, **never** GitHub source, chat, screenshots or public app assets.

## Current safe posture
All South Florida markets remain waitlisted; no screening vendor has been commissioned. **Do not activate markets or charge Travelers** merely because the index audit is green. A backend health report saying `screening: off` or `operationalReady: false` is the correct state until the pilot and legal verification pass.
