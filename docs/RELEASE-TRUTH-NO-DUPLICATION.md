# American Rider — Release Truth Ledger (No Duplicate Work)

**Reviewed:** 10 October 2026. **Code baseline:** `release/current` at `803e5ac33aa29016d81122a0c0f0e6951efa198b`.
This ledger distinguishes software already built, outside-provider evidence not obtained, and actual market activation. A successful GitHub build or Render deployment is **not** a legal commissioning certificate. It cannot read protected Firestore `market_admission` production records by itself.

## Why Miami-Dade, Broward and Palm Beach are not simply "unlocked"

- `backend/regions.js` lists `fl-southeast` and exactly those three counties in the active geographic set. `backend/markets.js` classifies geographic counties; it does NOT alone authorize paid Travel.
- `backend/market-readiness.js` requires a **version-bound, separately reviewed market-admission record** for each county plus shared live-service readiness. `backend/server.js` checks this durable state for consequential booking and duty actions.
- `/ops/markets` is the existing authorized market-commissioning interface. This is where the owner verifies **actual external evidence** and deliberately authorizes prelaunch intake or activates a county after independent checks.
- `/ops/screening` is the separate exception review queue for **individual cases**. It cannot activate Miami-Dade, Broward, or Palm Beach; everyday Operator qualification should be automated by code where trustworthy evidence permits, not personally approved one by one.

## Already built — do not duplicate

| Function | Existing source | Limits |
| --- | --- | --- |
| U.S. jurisdictions (50 states, DC, inhabited territories) | `backend/jurisdictions/us.json` | Identity catalog, **not** licensed markets |
| State policy registry; Florida live policy definition | `backend/screening-jurisdictions.js` | Other states are intentionally uncommissioned |
| Three South Florida county boundaries / market gates | `backend/regions.js`, `backend/markets.js` | Geographic `active` is not commercial `active` |
| County evidence, audit, onboarding, activation, pause | `backend/market-readiness.js`, `backend/market-readiness-ui.js`, `backend/market-fleet.js` | Requires genuine evidence, never self-certify |
| Operator existing/new screening request and persistent case | `backend/server.js`, `app/operator/background.tsx` | An intake request is **not** an order to the agency |
| Agency contact, report verification, human exceptions/adverse action | `backend/screening-handoff.js`, `backend/external-screening.js`, `backend/external-screening-adverse.js`, `backend/ops.js` | No universally commissioned secure provider channel |
| Screening expiry, reminders and dispatch enforcement | `backend/screening.js`, `backend/qualification.js` | Relies on verified original agency evidence |
| One-founder case triage | `backend/screening-case-triage.js` | Presentation only; not proof of automatic provider integration |

## Genuine obligations and the lowest-cost legitimate approach

1. **Agency-origin evidence:** Keep operator choice and agency-direct payment **where lawful and actually supported**. An existing report may **not** simply be forwarded across purposes/end-users. Obtain verified recipient-specific authorized report access and external terms. For routine safe automation, only implement a normalized trusted-agency interface (signed provider payload or mutually verified secure evidence channel) *after* an agency actually supports it. No generic public upload, emailed PDF, unverified checkbox, arbitrary web scraping, or automatic PASS based on self-declaration.
2. **Florida insurance:** Florida's [2026 §627.748(7)(d)](https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0600-0699/0627/Sections/0627.748.html) provides that when the driver's insurance lapses or fails the required limits, TNC-maintained insurance must respond from the first dollar and defend the claim. **A platform that supplies literally no insurance may not satisfy this law**, even if the app blocks known uninsured Operators. Do NOT delete `company_insurance_bound` to save money. Obtain qualified Florida insurance/counsel verification of the actual affordable policy/fallback arrangement before activating paid Travel.
3. **Florida compliance examination:** The same statute, §627.748(12)(e), requires an independent CPA examination report biennially on the statutory schedule, with cost borne by the TNC. Confirm any first-year filing or reporting obligation with qualified counsel. This is not a zero-cost software setting. Record evidence of the compliance plan in the existing jurisdiction authority and disclosure/retention records, and do not assert an examination was performed without a qualified CPA.
4. **Other external readiness:** Check verifiable operator insurance monitoring, Stripe payment/Connect/webhook/live-money reconciliation, qualified Operator supply, supported toll source and routing, airport/port handling, accessible services, physical-device behavior, and backup/restore. Existing market readiness domains encompass these; use them rather than creating parallel screens.
5. **Three-county cost control:** Florida law is statewide for the underlying TNC obligations, while individual airports/ports may impose specific facility rules. Avoid buying the same statewide policy, provider arrangement or legal opinion three times. Where a contract/document actually covers all three counties, the identical verified reference may be recorded under each county's independent manifest. **Do not copy evidence whose coverage or permission is narrower than the county**.
6. **National scaling:** Expand by state-specific legal screening and insurance policies plus service-region/county configuration and activation. Keep business rules in code/registries; avoid new per-state apps, duplicate onboarding products, unnecessary AI calls, or speculative paid integrations. Defer provider-specific automation until actual verifiable supplier terms exist.

## Release and assurance sequence (no invented evidence)

**Software** — Run CI on the exact change, verify the merged SHA and corresponding Render deployments. *Complete only if tool evidence confirms each.*

**External commissioning** — Existing `/ops/markets` must show current blockers from real protected Firestore records. Obtain/verify evidence for each; a developer cannot invent legally adequate insurance or a CRA agreement in GitHub. Use this UI for county commissioning, not the case-review screen.

**Pilot** — One legally obtained, consented CRA report via an agency-authenticated secure channel, real document/insurance evidence, controlled device tests, cost reconciliation and failure-path verification. Hold adverse-action decisions until legally approved notice/dispute channels are demonstrably working.

**Then activation** — A single deliberately authorized administrative transition per approved county is reasonable. **Per-Operator approval by the founder is not the intended scaling model.** Routine screening may be processed without founder intervention only when the evidence comes from an authenticated, authorized source and the jurisdiction-specific adjudication is reliable; unsafe/uncertain cases remain held for human review.

## Public guidance actually consulted

- [2026 Florida TNC statute §627.748](https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0600-0699/0627/Sections/0627.748.html) — insurance contingency, criminal/MVR checks and CPA examinations.
- [FTC FCRA guidance](https://www.ftc.gov/business-guidance/resources/using-consumer-reports-what-employers-need-know), [FTC use limitation](https://www.ftc.gov/business-guidance/blog/2017/02/background-checks-dont-double-dip), [FTC 2026 FCRA](https://www.ftc.gov/legal-library/browse/statutes/fair-credit-reporting-act) — permissible purposes, report transfer and adverse-action safeguards. Counsel must confirm the proper treatment of independent Operators.
- [Apple Human Interface Guidelines, Design Principles (2026)](https://developer.apple.com/design/human-interface-guidelines/design-principles/) — clarity, immediate feedback, privacy and avoiding unnecessary steps.
- [Stanford d.school, Human-Centered Design Project Guide](https://dschool.stanford.edu/tools/design-project-guide) — validate actual user journeys instead of shipping invented integrations.
- [MIT Sloan, redesigning work for the age of AI](https://mitsloan.mit.edu/ideas-made-to-matter/how-to-redesign-work-age-ai) — build complete operating systems and keep appropriate human oversight.
- [Nielsen Norman Group, Service Blueprints](https://www.nngroup.com/articles/service-blueprints-definition/) — map entire customer/backstage process to find duplicates and gaps.
- [UK Government Service Standard: Cost-effective technology](https://www.gov.uk/service-manual/service-standard/point-11-choose-the-right-tools-and-technology) and [share/reuse](https://www.gov.uk/guidance/share-and-reuse-technology) — reuse technology and avoid unnecessary expenditure.

This file is an architectural control ledger for future conversations. It is **not an assertion** that any external contract, approval, report, test or payment reconciliation exists.
