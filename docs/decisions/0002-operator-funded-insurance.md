# ADR 0002 — Operator-funded qualifying auto insurance

**Status:** Accepted founder business policy; Florida TNC statutory sufficiency **unresolved**. **Recorded:** 2026-10-10.

## Founder-confirmed current position — October 12, 2026
**American Rider currently has no automobile/TNC insurance policy and does not itself provide, sell, purchase, or underwrite insurance for Operators or Travelers.** Operators are responsible for procuring and paying for their own qualifying commercial/TNC-use policies. This statement describes the founder-confirmed **present position** and the accepted business policy. It is **not an independently audited insurance-inventory certificate**, a legal conclusion that no company coverage is required, or a promise that a claim could never reach the TNC.

**Do not silently relabel American Rider as insured, invent an existing company policy, enroll it in a product, or change its business model.** The separate Florida 2026 §627.748(7)(d) TNC-maintained contingent coverage/duty-to-defend question remains unresolved. Because the company currently has no such confirmed coverage, do not mark `company_insurance_bound` or Florida commercial admission as fulfilled. Obtain a qualified legal determination and any required binding evidence or authorized change in company policy *before* opening paid operations; maintain the launch gate meanwhile.

## Context
Operators must have valid coverage appropriate to their state, vehicle, registered insured, TNC use and periods. Carrier cancellations may occur mid-term. The founder explicitly rejects American Rider providing, selling or purchasing Operator automobile insurance, and wants no recurring founder review or mass monthly broker emails.

## Decision
Require each Operator to procure suitable insurance. Enforce jurisdiction-specific terms and limits, independent first and continuing verification, exact policy-bound source authentication and adverse/expiry/unknown status lockout at qualification, duty and Travel acceptance. A declaration-page upload or self-attestation cannot establish first independent coverage. No insurer exclusivity, no mass email strategy. Prefer verified signed provider events/batches or authenticated portals *when actually available*; existing secure one-use email is a bounded fallback.

**No platform-insurance purchase or redesign is authorized.** Separately, do **not** assert that automatic lockout legally discharges the TNC's duties under Florida §627.748(7)(d). This question needs competent Florida legal review, not a code assumption or invented insurance contract. Preserve the decision and track the unresolved legal question transparently.

## Consequences
Scalable rule engine and fast insurer-adverse lockout without normal founder clicks; potential residual legal exposure cannot be dismissed by a 30-day cadence or immediate software gate. Unknown statuses fail closed until a lawful resolution. Never send new policy-purchase instructions without user authorization.

**Implementation:** `backend/insurance-jurisdictions.js`, `backend/insurance-monitoring.js`, `backend/insurance-official-source-router.js`, `backend/qualification.js`. **External reference:** [2026 Fla. Stat. §627.748](https://www.flsenate.gov/Laws/Statutes/2026/627.748); [commissioning guidance](../NATIONAL-INSURANCE-VERIFICATION-CHANNELS.md).