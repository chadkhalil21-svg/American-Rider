# American Rider — prelaunch Terms, Privacy, deletion and pricing disclosure audit
Date: 13 October 2026. Scope: actual site/app and live legal text, not legal sign-off.

## Why this changed
The publicly served English Terms had never been updated since 6 August 2026 despite server pricing consent changes and a Family/Teen booking program. All four translations still contained the RETIRED '$1.50 or 5% Platform Fee' formula, while backend/economics.js and the governing ledger now use a dynamically sufficient fee with a $2.50 minimum. Privacy said no children's information was collected and only a Traveler's location during booking or Travel, despite Family/Teen (ages 13–17), guardian trip tracking and Operator background location when on duty. Privacy directed deletion only through Patron Support even though backend/accountdeletion.js and app/delete-account.tsx already provide an in-app verified deletion process. These were concrete misrepresentations and Apple/Google submission risks.

## Original-source guidance
- Apple [App Review 5.1 Privacy](https://developer.apple.com/app-store/review/): state all data collected, purposes, third-party providers, retention and actual account deletion.
- Apple [Account deletion guideline 5.1.1(v)](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/): discoverable in-app account deletion, not merely deactivation; users receive accurate explanation of necessary retained lawful records.
- Google Play [Account deletion requirement](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en): in-app and out-of-app accessible request pathway; dedicated public URL for Play Console.
- FTC [Mobile app marketing and sensitive location](https://www.ftc.gov/business-guidance/resources/marketing-your-mobile-app-get-it-right-start): notice and meaningful informed consent for precise location, minimize collection.
- Florida [FIPA §501.171](https://www.flsenate.gov/Laws/Statutes/2026/501.171): reasonably protect personal information and use relevant breach notification requirements when triggered, without falsely representing guaranteed security.
- Florida [FDUTPA §501.204](https://www.flsenate.gov/Laws/Statutes/2026/0501.204): avoid misleading user-visible statements about money, service readiness or data handling.
- Harvard/Columbia/CMU [Spatio-Temporal Pricing for Ridesharing](https://pubsonline.informs.org/doi/10.1287/opre.2021.2178): may justify careful regional/daypart demand experiments once first-party evidence exists, not secret demographic pricing. No time-of-day multipliers are enabled; traffic affects routed minutes only.
- Google Firestore [billing](https://firebase.google.com/docs/firestore/pricing), Amazon [idempotency](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/), and NASA [SWE-055](https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695440/SWE-055%2B-%2BRequirements%2BValidation) remain governing privacy/data cost and end-to-end evidence discipline.

## Actual corrections
1. Terms English, Spanish, French, Italian, German describe a single confirmed Total containing all fees and a $2.50 minimum dynamically calculated Platform Fee. Operator receives 99% of Fare; a changed Total requires informed price consent before payment. NO stated or implied $1.50/5%.
2. Ordinary accounts are for 18+; separate guardian-authorized verified Teen accounts are for 13–17 and under-13 accounts are not allowed. Do NOT promise that minors always travel with the adult: the current Family/Teen program can permit independently authorized Teen journeys with guardian tracking.
3. Privacy now discloses precise route pickup/destination, operational Operator background location, screening/insurance evidence, family guardian permission and age data, emergency contacts, support/messages, payment vendors, and approximate lawful retention limitations. No fabricated absolute deletion time.
4. Account deletion exists from Account > Delete Account, with an external email request from the public GET /account-deletion page. The user is asked NOT to email passwords, card numbers or identity documents. This endpoint is unauthenticated for requesting deletion, NOT for unverified account changes. A link for Google Play Console: https://american-rider-server-3d7x.onrender.com/account-deletion. Publish this to Play Console (manual store setting) after deployment and verify external URL.
5. Locale translations preserve the English governing-language notice and no broken literal '\\n' enters displayed HTML. Backend legal regression tests cover platform minimum, no superseded formula, ages, signed total, deletion URL, retention exceptions, and complete provider disclosures.

## What has NOT happened
- These are attorney-review CANDIDATES, not signed legal advice or contracts. Real Florida transportation counsel must confirm state/federal waiver, fare adjustment, dispute resolution, Family/Teen, Operator independent-contractor, document retention, FCRA screening, statutory insurance and approved jurisdictional rider disclosures before broad consumer publication.
- Actual app-store privacy labels/Data Safety declarations must be completed in Apple and Google consoles; code cannot submit them automatically unless an authenticated store integration exists.
- No county was activated or disallowed based on the document alone; as verified from production GET /markets, all Miami-Dade/Broward/Palm Beach county statuses were 0/3 active at 2026-10-13 20:16 EDT. Thus "ready to launch" is different from "publicly operating".
- No real passengers charged, no route miles fabricated, no new insurer bound and no statutory review falsely marked complete.

## Council perspective (not meetings)
Ford: common accurate source for languages and checkout Total. Rockefeller: accurate fee and Operator model; no surprise liability. Jobs: meaningful plain English and a working data-deletion path, not dead legal links.

## App Store / Google Play minimal handoff
The mobile release must carry these updated links, display privacy policy before signup, ensure deletion in Account and external link in Play Console, check Apple/Google data declarations, and update beta/TOS wording appropriately at the instant of actual public release.
