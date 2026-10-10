# American Rider — Low-Cost Insurance Confirmation, No False Source Authentication

## Already built and retained
- Operator buys qualifying commercial/TNC insurance. The app validates driver/vehicle/limits/periods and records monitored policy status.
- Every 30 days (with a bounded 5-day attestation grace in the current design), existing scheduled monitoring requests a carrier/agent/broker confirmation from `insurance@americanrider.app`, via a time-limited single-use email link.
- Carrier-confirmed cancellation, nonrenewal, reduction or vehicle removal blocks duty and new Travel; eligibility is checked server-side. A current document expiration date **is not proof** of ongoing paid-up status.
- No new insurance provider API, AI inference of coverage, monitoring vendor, scheduler, email sender or subscription is added.

## Initial proof must come from an insurer or broker
Before this correction an accepted scanned document itself initialized `verified_active` and a fresh 30-day clock. This confused evidence that a policy **was represented on a document** with independent confirmation it is in force today. The new initial state is `unverified`: no first Travel until the already implemented insurer/broker confirmation is genuine. Routine *subsequent* checks use the low-cost monthly automation below. An Operator's paper document and an email that the Operator controls are not independent sources.

## Fixed trust boundary (October 2026)
The old verification-request route allowed an Operator to supply **any mailbox**, which received a valid capability link. If that mailbox replied `verified_active`, the 30-day verification timestamp previously renewed with no independent proof it belonged to a real carrier/broker.

Now:
1. Operator supplies their chosen licensed insurer/broker's email. This remains an **unverified lead**.
2. Once per **genuine provider contact**, a named MFA-backed founder can verify the mailbox through an independently found official company directory and phone callback, insurance-regulator licence lookup plus independent callback, or authenticated provider agreement. The founder records its nonsensitive source reference, method and review note under **Operations → Verify an insurance company or broker contact once**.
3. That exact verified email is stored as a reusable provider contact, scoped to Florida and expiring after 365 days. It is reusable for multiple Operators; a new state requires independently commissioned rules. This reduces founder review effort without assuming identical legal rules nationwide.
4. A `verified_active` reply from a previously vetted, still-current mailbox can renew the Operator's monitored status automatically; the responding mailbox must also match the Operator's current stored contact.
5. A `verified_active` reply from an unvetted, expired, or mismatched mailbox is recorded as **held for independent source review**, creating an Operations case. It does **not** renew the verified status clock or erase previously reported adverse insurance status. The automated email link alone is not a licensed-agent credential.
6. Adverse statuses (reported cancellations, nonrenewals, coverage reductions) continue to stop operations without waiting for positive trust verification. Treat provider source disagreement as an incident, not a clearance.

The one-year contact-vetting period is an **internal operating default, not a legal safe harbor**. The monthly coverage check is separate from the contact's identity review. This process does not guarantee insurers will reply; some will require their own signed authorization or authenticated portal, which remains a supported hold/escalation path.

## Scope of this correction
No user can turn on a market, disable statutory screening, create insurance coverage, supply a consumer report, or approve an Operator with an arbitrary email response. No requests have been sent to insurers. The initial legal duty of American Rider to secure TNC-maintained fallback under [Florida 2026 §627.748(7)(d)](https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0600-0699/0627/Sections/0627.748.html) **does not disappear** because monitoring is frequent. Do not remove the separate `company_insurance_bound` market-admission gate until verified legally compliant evidence exists.

Reference: [ACORD 25 certificate](https://ogs.ny.gov/system/files/documents/2021/09/acord-25-6.15.20.pdf) distinguishes certificate evidence from legal insurance coverage and cancellation rights. [Florida DFS](https://www.myfloridacfo.com/division/ica/fraudandscams) recommends verifying insurer and agent identity with official licence sources.

## Before commercial launch
Perform one legitimate insured-Operator test using a real insurer/broker contact independently verified from official sources, with documented permission. Confirm the company actually accepts monthly status requests by the supplied route, and run: (i) active, (ii) cancelled, (iii) unverified address, (iv) expired request, (v) decline/requires portal, (vi) insurance change mid-trip, (vii) no answer.

The same vendor-neutral monthly mechanism can then work for many Operators using the same broker contact without per-Operator founder review *provided each actual policy receives authenticated and policy-matched verification*.
