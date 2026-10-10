# American Rider — National Operator Screening Policy Registry

**Baseline:** PR #76, release/current commit `370f0f20b3c2703a95221ebeb2b4e7f7a5126de1` (10 October 2026).

## Why this exists

The national identity registry (`backend/jurisdictions/us.json`) identifies the 50 states,
District of Columbia and five inhabited territories. It is **not** a set of approved TNC
screening laws, and it never activates a commercial market.

`backend/screening-jurisdictions.js` is the separate screening policy registry. Today
**Florida is the only implemented entry**. The existing Florida adjudication and provider-neutral
Operations handoff remain in force. A county being waitlisted does not authorize paid Travel.

## Three separate permissions

| Action | Gate | Current result |
| --- | --- | --- |
| Express interest, select future area | Identity and geography / waitlist | National intention; service-region selectors appear only where geography is ingested |
| Open an existing-report or new-report screening review case | Signed-in Operator's **server-stored** county + mapped region + configured state screening policy | Florida configured counties, including prelaunch waitlist |
| Qualify, go on duty or accept paid Travel | Independent jurisdiction rules, commercial market admission, commissioned screening evidence workflow, documents, insurance, payments and dispatch | Nothing is activated by this change |

The preparatory route no longer compares a state literal to `'FL'`. Instead it checks
`screeningPreparationFor(market,region)`. The binding includes the review policy
identifier, jurisdiction and selected county in the Operator's pending review state.
The support case records the policy and market as nonsensitive provenance.
An existing Florida case predating the registry can continue its original Florida review.

**Positive and adverse review must never be generalized from Florida to another state.**
External CRA review and adverse-action actions require an implemented policy and the
specific Florida adjudicator. Qualification also checks that the cleared report's state
policy matches the Operator's selected market. Market activation fails if the screening
policy is unavailable, has mismatched cadence, or the region's state code is inconsistent.

## What it takes to commission another state

1. Verify applicable state, municipal and TNC authority requirements with qualified counsel:
   criminal-history searches, driver history, disqualifiers and lookback windows,
   reporting cadence, disclosure, consent, data handling and adverse action.
2. Build that state's reviewed and versioned screening policy; implement **its own**
   adjudication and renewal engine. Do **not** copy Florida rules or simply mark the
   U.S. identity record as `configured`.
3. Validate licensed/appropriate CRA source, permissible purpose, company-specific
   report rights, secure transfer, named MFA-backed Operations review and dispute access.
4. Bind the review case, provenance, clearance and future renewals to that state/policy.
   Define interstate operator changes and rechecks explicitly rather than treating a
   prior state's report as automatically portable.
5. Supply the state's service geography, insurance/disclosure requirements, pricing,
   routing/toll/permit evidence and controlled live physical-device tests.
6. Have counsel and Operations approve a separate commercial activation decision.
   No software flag or passing test substitutes for that evidence.

## Deliberate limits

- This change neither selects/contracts a CRA, sends a consumer report, orders a check,
  sends regulated notices, accepts payments, nor activates an operating market.
- Florida's underlying `screening.js`, `external-screening.js` and
  `external-screening-adverse.js` contain the **Florida-specific** eligibility rules.
  New-state work must implement additional vetted reviewers and state-specific
  renewal/notice rules before adding the new policy to the registry.
- The `SCREENING_EVIDENCE_WORKFLOW_VERIFIED` production readiness flag must **remain
  false** until independent external proof and an authorized end-to-end pilot exist.
- A personal declaration or uploaded consumer report never establishes clearance.
- Tests cover missing state policy, forged or inconsistent county/region identities,
  wrong review policy ID, legacy Florida cases, and commercial admission separation.

This is an architecture and safety correction, **not a national legal compliance certification**
and **not a commercial-launch authorization**.
