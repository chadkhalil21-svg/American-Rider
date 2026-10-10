# Provider-neutral screening adverse-action procedure

**Software protection only — not an automatic FCRA compliance certification.**
This procedure supplements `docs/SCREENING-FULL-JOURNEY.md`. It applies to external-agency screening cases and keeps an Operator off duty throughout review. The CRA's original report and FCRA correspondence must be handled outside the app through an authenticated, access-controlled provider channel.

## Responsibilities and approved reviewer actions
- **Source confirmation:** An authorized named Operations reviewer verifies the case belongs to the Operator, that the agency report is authentic and can legally be furnished for American Rider's specified purpose, and that the adverse issue meets an actual statutory disqualifier. A free-text Operator declaration, uploaded PDF or automated `consider` flag is not enough.
- **Propose:** Staff select `Begin pre-adverse review`. This changes the case to `pre_adverse`; it is **not a final rejection**. It produces an audit record with non-sensitive statutory category and provider report reference. No notice is sent by the application.
- **Pre-adverse notice:** A qualified reviewer uses a separately verified channel to deliver required documents (a copy of the report, FCRA Summary of Rights, and appropriate pre-adverse notice, if applicable); the provider's legally compliant flow may administer delivery. The reviewer attests to completed delivery and enters a non-sensitive delivery evidence reference. The application records server time as the earliest start of its internal review interval.
- **Review interval:** The application sets a **conservative internal floor of seven calendar days** after verified pre-notice delivery. This is **not** a universal statutory deadline; consult counsel for what is reasonable in the applicable circumstances and for state-specific requirements. Time alone never creates a final refusal.
- **Dispute:** Operator may dispute an inaccurate report or request clarification by contacting `support@americanrider.app`. Staff mark `Record Operator dispute`; this blocks final refusal until the report is reverified. Detailed consumer reports must not be emailed to ordinary support.
- **Withdraw:** If the finding is corrected or the adverse case was mistaken, staff return it to `review`. This **never** marks a report PASS. A fresh authenticated provider review is still required to clear.
- **Finalize:** Only a named Operations reviewer may attest that the final adverse notice was **actually delivered** by the authorized external channel, the same agency facts still apply, no unresolved dispute exists, and the internal interval elapsed. An audited final decision closes the review case and leaves the Operator unavailable.
- **Reopen/rescreen:** A new screening request clears superseded adverse-action and report status, but leaves the Operator not dispatchable. Repeated evidence must still be independently authenticated and re-adjudicated.

## Nonnegotiable technical guarantees
- Transactional changes to user screening, availability, ticket, and audit records. No sensitive report documents stored in the operational Firestore database; only references, status, nonsensitive summary and named reviewer attestations.
- No direct `refuse` action before notice/dispute state transitions; no auto-rejection based on `consider`, an identity claim or time expiry.
- Duplicate replay, wrong UID/case ownership, missing user authorization and malformed references refuse writes.
- An uncommissioned CRA or correspondence channel is **never simulated as live**.
- The Operator's screen remains a status channel, **not a substitute** for actual disclosure, rights, notice or dispute delivery.

## Still must be completed before processing a real adverse case
1. Counsel approves the FCRA/Florida workflow, stand-alone disclosures and required notices and determines whether the relevant relationship is employment, contracting, or another permissible purpose.
2. Commission a real agency transfer and evidence-retention process, including secure private retrieval of the original report for staff and applicant copy; designate who sends notices and pays each vendor.
3. Verify delivery/read receipts or provider acknowledgments for test cases; test false hits, disputes, remediated findings, notice failure, after-final corrections and two simultaneous reviewer actions.
4. Verify case assignment/escalation and reply handling in the support inbox; maintain safe staff access, data minimization, and a documented retention/deletion program.
5. Only activate real screening with `SCREENING_EVIDENCE_WORKFLOW_VERIFIED=true` after the end-to-end pilot and sign-off; this flag is a management attestation, not independent machine verification.

## Primary sources
- [FTC: Background checks — what employers need to know](https://www.ftc.gov/business-guidance/resources/background-checks-what-employers-need-know)
- [CFPB: Rights to dispute errors in consumer reports](https://www.consumerfinance.gov/consumer-tools/credit-reports/answers/key-terms/#dispute)
- [Florida Statutes §627.748, TNC provisions](https://www.flsenate.gov/Laws/Statutes/2026/627.748)
