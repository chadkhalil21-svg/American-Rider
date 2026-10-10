# American Rider — One-Founder, Provider-Neutral Screening Playbook

**Purpose:** A complete, auditable human-managed report verification service, not a new screening company, API integration, vendor exclusive, applicant billing system or promise of immediate commercial launch.

**Prepared 10 October 2026.** Source law: [Florida Statutes §627.748(12)](https://www.flsenate.gov/Laws/Statutes/2026/627.748), [FTC consumer-report guidance](https://www.ftc.gov/business-guidance/resources/using-consumer-reports-what-employers-need-know). Service and security standards: [Apple HIG feedback](https://developer.apple.com/design/human-interface-guidelines/feedback), [GOV.UK full-service design](https://www.gov.uk/service-manual/design/introduction-designing-government-services), [Nielsen Norman Group system status](https://www.nngroup.com/articles/visibility-system-status/), [NIST 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html), and [OWASP ASVS](https://github.com/OWASP/ASVS/blob/master/5.0/en/0x25-V16-Security-Logging-and-Error-Handling.md).

## Founder console — the practical next step

Sign in to the existing `/ops` with **one named MFA-backed account** and open `/ops/screening`. No second staff member is needed to claim or decide a case, but individual accountability and the independent agency-source checks remain mandatory.

The queue is **read-only until you explicitly record a real external action**. Each eligible case includes its number, chosen company, reviewer, stage, *next action*, who is waiting, and a suggested founder follow-up time. Time targets of 48 hours for first review/decision and 72 hours for agency response follow-up are **internal scheduling suggestions**, not statutory deadlines, purchased SLAs or promises made to Operators. They do not trigger a notice, a payment, a report order, a status change or a decision. A missing/inconsistent case is urgent and cannot be approved. The queue is bounded; the page explicitly warns when more than 50 pending cases exist.

**One-person operations cycle:**

1. **Claim** the Operator-authorized case under your own named MFA login. The request is not an actual order to any agency. Check that there is an existing-report release request or a proposed **new** screening request.
2. **Verify the original company's business identity independently**, not from an unverified link or a user-provided report. Ask whether it is able and legally permitted to prepare/furnish Florida TNC-compliant checks for this specific recipient and purpose. Confirm who pays, the full price, the report's authorized use, disclosures/authorizations, and a verified secure agency portal or approved encrypted transfer. Record a nonsensitive agency contact/case reference in the console. **Do not instruct anyone to buy a report until this is independently resolved.**
3. **Receive/authenticate the report in the company's verified secure channel.** Match the Operator and permitted purpose; verify Florida-required nationwide criminal primary-source validation, sex-offender search, and driver history. Record **only a nonsensitive source reference**, not SSNs, DOBs, criminal charges, consumer-report PDFs or identification in Firestore. Ordinary `support@` email is for coordination and case references only.
4. **Record a supported disposition.** A clean case may be marked CLEAR only after all governing statutory checks are verified. Unresolved or insufficient evidence becomes HOLD. An adverse proposal requires a separate legally reviewed pre-adverse notice/report/rights/dispute process and independent proof of delivery; software does not send notices.
5. **Return to duty only after independent qualification checks.** CLEAR alone never activates a county, turns on an Operator, establishes insurance, or authorizes paid Travel.

## Operator experience

A request gives a durable case number and the truth: American Rider will coordinate the verification. No vendor booking, payment or outbound message is automatically initiated. The Operator should not email the report to `support@`, and should not pay for an unconfirmed check. The app retains existing/new provider-neutral pathways; an old report **may** be considered only if original agency permission, purpose and statutory scope can be independently verified.

## Provider contact checklist — not an automatic email

Ask the Operator's chosen agency (through independently established business contact details):

- Can you provide a local/national criminal search with source validation, the DOJ national sex-offender check and an appropriate driving history for a Florida transportation network company?
- Can an existing report be **lawfully reissued or furnished specifically to American Rider**? If not, what additional checks are required? Never presume portability from a prior recipient.
- What FCRA and other disclosures, authorizations and certifications apply to our independent-Operator arrangement? Which party obtains and preserves them?
- Can you supply access through your own authenticated business portal or mutually approved secure transfer rather than forwarding a raw PDF to ordinary support mail?
- Does your business permit the Operator to pay you directly? What is the total cost and refund/noncompletion policy?
- Who responds to disputes and corrections, how does the Operator obtain their report and rights information, and what documentation of delivery is available?

Record answers as **non-sensitive business references** outside any consumer-report record. A completed Operator intake form is not itself proof that the agency supports the procedure.

## Legal and operational commissioning gates

The FCRA employer guidance is a critical reference, but Operators may be independent contractors. **Qualified U.S. FCRA/transportation counsel must confirm which employment-purpose or other consumer-report requirements apply to this exact arrangement**, along with any additional Florida rules. A checked Operator release instruction, an arbitrary agency name, or a success message from the app is not a substitute for the legally required disclosure, authorization and actual report-transfer agreement. Keep adverse actions held until signed-off notice/dispute delivery procedures are demonstrated.

Before the owner sets `SCREENING_EVIDENCE_WORKFLOW_VERIFIED=true`, preserve evidence of: real agency eligibility; recipient-specific lawful permission; consent and notices; reliable secure report access; independent CRA source verification; provider-neutral cost terms; a complete Operator-visible case; successful clean/hold/disputed/adverse pilot cases; physical iPhone/Android operation; and independent legal review. This configuration flag does **not** itself establish those conditions.

**Prohibitions:** No preferred exclusive CRA, no mandatory API, no screenshots of sensitive reports in normal support, no report stored in Firestore, no artificial automatic clearance, no provider-payment claim, no commercial market activation.

**Design doctrine:** Every displayed action is real, every status is grounded in a stored case, and no user is told to wait for an automatic action that has not been configured. The premium experience is the absence of needless steps, not a screen full of promises.
