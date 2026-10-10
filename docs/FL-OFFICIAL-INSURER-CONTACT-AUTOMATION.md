# Florida official-source agency recognition — low-cost pilot

**Baseline:** `release/current` at `6b9540377b7a7008c528e5a84b7edb356770d378`.

## Principle
Insurance checks must be **automatic and source-bound** wherever feasible, without expecting the founder to review thousands of monthly messages. A public licence is evidence of a business, **not evidence of coverage**. Keep the current 30-day carrier/broker status-request workflow, single-use secure confirmation links, policy-specific response, and fail-closed duty gates. Never auto-approve a reply from an arbitrary Operator-supplied mailbox.

## Added, with no new paid integration
- On an **affirmative** response from an insurer/agent/broker email for an Operator, try the existing named-MFA verified provider-contact cache first.
- For unfamiliar Florida contacts, download the publicly available Florida Department of Financial Services **All Valid Licenses – Business** CSV from the *fixed official state domain* using HTTPS. The download occurs only when needed, at most once per 24 hours per backend process; requests in flight are coalesced. Fail closed when unavailable; retry after 30 minutes, not on every message.
- Accept an email match **only when the full address is listed** under a qualifying current agency/general-lines/property/casualty/surplus licence, with a licence number and legal business name in a freshly downloaded, structurally valid file. Never match an arbitrary domain, display name, email header, guessed spelling or fuzzy company label.
- A recognizer match **does not itself** renew policy status. The licensed mailbox must then return an actual affirmative response through American Rider's existing single-use link, for the **same unchanged insured policy** for which the request was sent. The response is recorded with its official-source digest. Old requests for another policy and unmatched mailbox replies cannot renew coverage.
- Unknown or unsupported agencies remain held. The Operator is told to use the published agency email, update policy information or use the agency's own authorized portal. First failures are self-service, not automatic owner tasks; repeated unresolved requests are escalated. Any cancellation/coverage reduction continues to suspend eligibility promptly.
- No background chat agent, insurance provider subscription, extra paid scraper, inbound mailbox parser or external database introduced.
- Security regression tests cover untrusted mailbox, incorrect role, stale/replaced source, CSV quote handling, caching, and new-policy mismatch.
- CI includes a **nonblocking real-data smoke check**. An unsuccessful source check means official auto-recognition is **not commissioned**, even though fallback gates and previous named contacts remain safe.

## National-volume monitoring fairness
The previous scheduler always selected the oldest 250 due users. With over 250 stale or unresolved records, newer active Operators could be postponed indefinitely. The scheduler now persists a due-date/user-ID cursor in the existing Firestore database, walks the ordered due set in 250-record pages, and wraps at the end. This prevents starvation while keeping bounded memory and no paid queue. It does **not** establish throughput for millions of Operators: live stress, email budget, carrier participation, and protected indexes still require commissioning.

## Independent live-data compatibility evidence
On 2026-10-10, GitHub Actions job `114304913484` successfully retrieved the state's live business-licence CSV and parsed **55,915 distinct qualifying agency email contacts** after rejecting malformed rows. This is an observation about a public registry dataset, not insurer-partner onboarding, company authority to confirm a particular policy or evidence that any Operator is insured.

A dedicated GitHub workflow (`.github/workflows/fl-insurance-source-compat.yml`) repeats this source compatibility check weekly and on relevant changes. An official-source failure is a **failed check**, not a green advisory job. Production recognition fails closed when its own fresh source cannot be parsed. Do not treat stale/failed official snapshots as clearance.

## Important source limits
- [Florida DFS Bulk Downloads](https://licenseesearch.fldfs.com/BulkDownload) lists the Business licence CSV. Actual source: `https://www.myfloridacfo.com/downloads/AAS/LicenseeSearch/AllValidLicensesBusiness.csv`. This file is public but its live schema and endpoint availability must pass smoke verification before claiming real use.
- [Florida OIR Company Search](https://companysearch.floir.gov/index.aspx) identifies insurer companies and NAIC codes, but is not proof of a producer's access to an individual policy.
- [NIST 800-63A authoritative sources](https://pages.nist.gov/800-63-4/sp800-63a.html) supports credible source evidence; email-token possession alone does not certify legal authority.
- A valid DFS insurance agency licence is **not a binding policy, TNC endorsement, proof of a specific insurer appointment, proof that insurance is currently active or a guarantee against cancellation**.
- Regulatory source data can become stale, incomplete, or inaccurate; email domains and content are never solely trusted.

## Commissioning pilot
Before first commercial Travel with automated official-source recognition:
1. Demonstrate CI/live source retrieval succeeds and recognizes the authoritative CSV columns.
2. Locate one **genuine Operator-consented** insurer/broker contact in the official source. Do **not** substitute fictional or self-controlled email addresses.
3. Obtain permission and a real broker/carrier reply for a real policy; verify insured identity, vehicle, operating limits and intended TNC/livery use in its source documents.
4. Test active, changed-policy, cancelled, unknown-email, stale CSV, expired link and nonresponse cases on an actual device. Reconcile audit/event records.
5. Keep `company_insurance_bound` in the separate market readiness contract. Florida TNC-maintained coverage duties do not disappear merely because status verification is frequent.

**External pilot is not represented as complete by passing repository unit tests.**
