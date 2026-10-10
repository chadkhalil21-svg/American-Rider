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

**Verified 10 October 2026:** `support@americanrider.app` is a working *ordinary email coordination alias*. Independent-sender testing (from a separate Gmail account) delivered a message through Cloudflare Email Routing into the American Rider Communications Gmail inbox; the original from-the-same-account test was deduplicated by Gmail and Cloudflare explained the behavior. **Resend sending enabled / receiving disabled** is not an email-routing failure: Cloudflare, not Resend, receives and forwards this domain's aliases.

**Security boundary:** The successful support-mail test does **not** approve plain email as a delivery channel for consumer reports, government IDs, criminal findings or other sensitive screening records. Staff may use `support@` to coordinate a case reference and arrange an authenticated agency portal or an agreed secure transfer. Providers must not send raw background reports to this general-purpose alias.

**Safe delivery model:** CRA-authenticated web portal or a verified encrypted provider-to-Operations transfer. Store only an audit reference and decision in the app's Firestore database; maintain any original report only under a separately approved, access-restricted retention policy. A case in `support_tickets` is an Operations work item, **not a request sent to a CRA**. Staff must make contact using verified business identity and document the handoff. No report must be sent before legal purpose, contract, consent and data-security requirements are established.

## Named Operations handoff (verified case lifecycle)

The `/ops/screening` console is now a bounded queue with a strict case lifecycle:

1. **Claim screening case:** A named, MFA-backed reviewer takes responsibility. Another staff account cannot silently assume the case.
2. **Contact verified agency:** The reviewer independently establishes the CRA's authentic business contact (verified phone, business email, or authenticated agency portal), records a non-sensitive contact reference and time, and asks about the permissible purpose and whether a report can be reissued. The act of clicking this button does **not** send a message to the CRA.
3. **Authenticate report receipt:** After obtaining the report by the agency's authenticated portal or approved secure transfer, the reviewer verifies the agency source, Operator match and lawful receipt, then records only a non-sensitive report reference. Staff **do not upload the report into the Operations form**.
4. **Adjudicate separately:** The `Clear / Hold` form is hidden until the verified handoff is recorded. A **Clear** operation server-side requires the matching report reference, receipt method and same named reviewer. The statutory search results and driving-history thresholds must be reviewed independently. Clearance does **not** put an Operator on duty.
5. **Hold / dispute:** Holding a report requires further agency clarification before a new clearance; disputing an authenticated report similarly discards that report as current authority. An auditable recontact and newly authenticated receipt is required.
6. **Adverse notices:** PR #74 added a manual pre-adverse, delivered-notice, dispute, withdrawal and final-decision evidence ledger. The software **does not send** the report, rights summary or notices, and seven days is an internal minimum review interval, not a universally mandated FCRA waiting period. A `propose` action now also requires the already-authenticated report and matching case reference. Disputed and withdrawn evidence is invalidated for new adjudication, so staff must contact the CRA and authenticate corrected evidence. Test actual secure notice delivery and review legal applicability with qualified counsel before any real adverse case.

The ticket stores accountable stage transitions and non-sensitive references. The actual CRA verification, report handling, outbound notice and report retention remain external human-controlled responsibilities until provider contracts and a compliant secure intake process are commissioned. Tests cover case ownership, ordering, wrong-Operator isolation, idempotency on closed cases, dispute rechecks, no auto-dispatch and audit trail.

**Do not equate an Operations attestation with externally verified provider infrastructure.** The `SCREENING_EVIDENCE_WORKFLOW_VERIFIED` launch flag must remain false unless there is independently documented production evidence and legal review.

## Florida and consumer-report standards

- [Florida Statutes §627.748(12)](https://www.flsenate.gov/Laws/Statutes/2026/627.748): the TNC conducts or has a third party conduct a local/national criminal check with nationwide commercial database and primary-source validation, national sex-offender search and driving-history review; checks recur every three years. Separate statutory disqualifiers apply. It does **not** name a screening company or demand a specific API.
- [FTC guidance for employment/background checks](https://www.ftc.gov/business-guidance/resources/background-checks-what-employers-need-know): stand-alone FCRA disclosures, authorization when applicable, pre-adverse notice/report/rights, opportunity to dispute, final notice. Independent-contractor application must be reviewed with counsel.
- [CFPB permissible purpose guidance](https://www.consumerfinance.gov/rules-policy/final-rules/fair-credit-reporting-permissible-purposes-for-furnishing-using-and-obtaining-consumer-reports/): a consumer's instruction is not a blanket authorization to transfer a report from any existing end-user; verify recipient-specific lawful purpose and CRA transfer agreement.
- [NIST identity-proofing guidance](https://pages.nist.gov/800-63-4/sp800-63a.html): minimize sensitive identifiers and use primary/authenticated sources.
- [GOV.UK Service Manual](https://www.gov.uk/service-manual/design/introduction-designing-government-services) and [Nielsen Norman Group service blueprinting](https://www.nngroup.com/articles/service-blueprints-definition/): users need a clear next step; employees' backstage actions and support evidence must be mapped. Avoid premature claims of approval or automatic correspondence.

## Commissioning evidence still required (not waived by a code merge)

1. Confirm supported CRA(s) can conduct Florida-compliant checks for **American Rider's specified purpose**, securely release existing reports where permissible and accept new requests; get **written** detailed fixed/pass-through pricing and who may pay.
2. **Ordinary inbound delivery VERIFIED** from an independent sender to `support@` through Cloudflare forwarding. Confirm reply-from behavior, staff access and lost-message handling; independently commission a **secure CRA-report channel**. Do not alter Resend inbound MX/DNS or interfere with working Cloudflare routing.
3. Validate standalone legally compliant disclosure/authorization, notices, disputes, permissible purpose, applicant access and record retention with transportation/FCRA counsel. **Operator checkbox is a release request, not the entire FCRA workflow.**
4. Prove source identity, legal report reuse/validity and statutory adjudication with provider-controlled staging/consented cases. Test clean, incomplete, disqualifying, corrected, duplicate, expiration and no-answer flows. Document reference and timestamps, not personal criminal details.
5. Make the existing Operations case actionable with assigned owner, outreach, provider receipt proof, escalation deadline, and secure return channel. Track response and notify Operator when action is needed; **do not leave the Operator guessing or make them email unverified addresses**.
6. Demonstrate FCRA pre-adverse and final adverse processes with verified delivery of the report and summary of rights, opportunity to contest, and no unsafe auto-rejection.
7. Validate all five app languages and iOS/Android accessibility, links, back navigation, status persistence and network retries on real devices, with evidence belonging to the exact release SHA.
8. After successful pilot, the owner may deliberately attest `SCREENING_EVIDENCE_WORKFLOW_VERIFIED=true`; do **not** flip merely to clear health readiness. Follow the separate, independent market-admission checklist before enabling paid Travel.

## Market controls are not a geography-free switch

The Operations Console can record evidence and request **onboarding** or **commercial activation** for *configured regions*. The engine validates legal jurisdiction, policies, insurer, routing, vendor dependencies, priced Travel, government authority and readiness evidence. An unknown state or unsupported county must fail closed. The three South Florida counties are planned first; support for any other region requires configuration and verified local requirements. A staff action alone cannot lawfully activate an unsupported geography.
