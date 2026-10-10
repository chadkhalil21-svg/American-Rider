# American Rider — Operator Screening Journey & External Handoffs

**Last verified:** 10 October 2026. **Posture:** provider-neutral, **not commissioned for paid Travel**. This document is a service blueprint, not a claim of a contracted background-screening company or legally approved report-transfer arrangement.

## Operator experience (frontstage) — exact current behavior

| Step | Previously screened | Needs a new screening | Authority / next step |
|---|---|---|---|
| 0. County | Select a configured Florida operating county; waitlisted operators may prepare a screening request. | Same. | This is only preparation. County market admission and paid Travel remain closed. |
| 1. Background screen | Tap **Already screened?** | Tap **Need a new screening?** | App shows no working agency-booking or direct payment portal unless one has separately passed a pilot. |
| 2. Details | Enter name of actual screening company, report date and self-declared coverage of criminal/sex-offender/MVR checks. | Name the prospective CRA to be considered. | **Names and checked boxes are requests, NOT evidence or approval.** |
| 3. Operator release | Read instruction, check explicit report-release consent, tap **Request provider review**. | Same, with the provider's own standalone disclosure, authorization and service terms still needed before buying. | Authentic FCRA purpose and report-use rights are separately assessed by company/CRA. |
| 4. Confirmation | App returns a case number and **Awaiting agency**. | Same. | Case is persisted in `support_tickets` before success is shown. The app does not provide a verified secure inbound email address for reports. |
| 5. Agency handoff | American Rider needs to contact/verify the original CRA and determine whether it can furnish a report for this purpose. | American Rider must first validate agency scope, price, payment, consent, secure delivery and Florida requirements. | No provider calls or emails are **automatically sent** by merely opening the support case. A named human must manage this external handoff. |
| 6. Evidence | Authenticated CRA portal/verified secure transfer, never an Operator-submitted PDF, is the source of truth. | Same for the completed new check. | An Operator may supply a reference and authorize a transfer, not provide an authoritative clearance. |
| 7. Decision | Operations records authenticated evidence, required searches, issue date, statutory findings, report reference and audit; **clear** or **hold**. | Same. | Manual review is an attestation, not independent programmatic validation; no consumer-report payload is stored in Firestore. |
| 8. Progress | Operator sees `awaiting_agency`, `review` or `pass` next time the app fetches screening. | Same. | Additional disputed/adverse actions require a legally reviewed notice sequence. No automatic proactive update is established for all states. |
| 9. Service | Passed report contributes to qualification only if all remaining gates (insurance, documents, account, payouts, jurisdiction, market, duty) pass. | Same. | Paid service remains shut until separately commissioned. Screening refresh every three years. |

## Who contacts whom; where does the report go?

The Operator requests that **the named company** make the report available **to American Rider** for the stated purpose. The Operator does not forward a sensitive report or identity document via ordinary email.

`support@americanrider.app` is currently referenced in older code but **not a verified secure receiving destination**. On 10 Oct 2026 the connected Resend domain `americanrider.app` was verified for **sending**, with **receiving disabled** and **zero configured receiving webhooks**; the connected American Rider Gmail account showed routing tests for other domain aliases, **none for `support@`**. This does not prove a completely different mail host lacks an inbox. Until an end-to-end inbound delivery and secure-report workflow is demonstrated, neither Operators nor CRAs should be told to email any report there.

**Safe delivery model:** CRA-authenticated web portal or a verified encrypted provider-to-Operations transfer. Store only an audit reference and decision in the app's Firestore database; maintain any original report only under a separately approved, access-restricted retention policy. A case in `support_tickets` is an Operations work item, **not a request sent to a CRA**. Staff must make contact using verified business identity and document the handoff. No report must be sent before legal purpose, contract, consent and data-security requirements are established.

## Florida and consumer-report standards

- [Florida Statutes §627.748(12)](https://www.flsenate.gov/Laws/Statutes/2026/627.748): the TNC conducts or has a third party conduct a local/national criminal check with nationwide commercial database and primary-source validation, national sex-offender search and driving-history review; checks recur every three years. Separate statutory disqualifiers apply. It does **not** name a screening company or demand a specific API.
- [FTC guidance for employment/background checks](https://www.ftc.gov/business-guidance/resources/background-checks-what-employers-need-know): stand-alone FCRA disclosures, authorization when applicable, pre-adverse notice/report/rights, opportunity to dispute, final notice. Independent-contractor application must be reviewed with counsel.
- [CFPB permissible purpose guidance](https://www.consumerfinance.gov/rules-policy/final-rules/fair-credit-reporting-permissible-purposes-for-furnishing-using-and-obtaining-consumer-reports/): a consumer's instruction is not a blanket authorization to transfer a report from any existing end-user; verify recipient-specific lawful purpose and CRA transfer agreement.
- [NIST identity-proofing guidance](https://pages.nist.gov/800-63-4/sp800-63a.html): minimize sensitive identifiers and use primary/authenticated sources.
- [GOV.UK Service Manual](https://www.gov.uk/service-manual/design/introduction-designing-government-services) and [Nielsen Norman Group service blueprinting](https://www.nngroup.com/articles/service-blueprints-definition/): users need a clear next step; employees' backstage actions and support evidence must be mapped. Avoid premature claims of approval or automatic correspondence.

## Commissioning evidence still required (not waived by a code merge)

1. Confirm supported CRA(s) can conduct Florida-compliant checks for **American Rider's specified purpose**, securely release existing reports where permissible and accept new requests; get **written** detailed fixed/pass-through pricing and who may pay.
2. Verify a **private inbound mailbox** for ordinary inquiries *separately* from the secure CRA-report channel; test send, receive, reply, lost-message handling and staff access. Do not turn on Resend inbound MX/DNS without evaluating existing mail delivery.
3. Validate standalone legally compliant disclosure/authorization, notices, disputes, permissible purpose, applicant access and record retention with transportation/FCRA counsel. **Operator checkbox is a release request, not the entire FCRA workflow.**
4. Prove source identity, legal report reuse/validity and statutory adjudication with provider-controlled staging/consented cases. Test clean, incomplete, disqualifying, corrected, duplicate, expiration and no-answer flows. Document reference and timestamps, not personal criminal details.
5. Make the existing Operations case actionable with assigned owner, outreach, provider receipt proof, escalation deadline, and secure return channel. Track response and notify Operator when action is needed; **do not leave the Operator guessing or make them email unverified addresses**.
6. Demonstrate FCRA pre-adverse and final adverse processes with verified delivery of the report and summary of rights, opportunity to contest, and no unsafe auto-rejection.
7. Validate all five app languages and iOS/Android accessibility, links, back navigation, status persistence and network retries on real devices, with evidence belonging to the exact release SHA.
8. After successful pilot, the owner may deliberately attest `SCREENING_EVIDENCE_WORKFLOW_VERIFIED=true`; do **not** flip merely to clear health readiness. Follow the separate, independent market-admission checklist before enabling paid Travel.

## Market controls are not a geography-free switch

The Operations Console can record evidence and request **onboarding** or **commercial activation** for *configured regions*. The engine validates legal jurisdiction, policies, insurer, routing, vendor dependencies, priced Travel, government authority and readiness evidence. An unknown state or unsupported county must fail closed. The three South Florida counties are planned first; support for any other region requires configuration and verified local requirements. A staff action alone cannot lawfully activate an unsupported geography.
