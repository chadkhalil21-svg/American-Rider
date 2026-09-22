---
name: american-rider-release-review
description: Two-layer release audit for American Rider — countable release gates plus an independent qualitative product and design review — applied to builds, changes, pull requests, TestFlight builds and releases. Explicit invocation only; never runs during ordinary work.
disable-model-invocation: true
---

# American Rider — Release Review

Invoke as `/american-rider-release-review`, optionally with a target:
`/american-rider-release-review <commit | branch | PR number | TestFlight build number>`.
With no target, review the current working tree at its exact `HEAD` commit.

This skill audits American Rider builds, changes, pull requests, TestFlight builds and
releases using **two separate layers**, and both must be completed before any recommendation
is made:

1. **Deterministic, countable release gates** — `references/release-gates.md`
2. **Independent qualitative product and design review** — `references/qualitative-review.md`

**Passing automated tests never replaces the qualitative review.** Design coherence, visual
hierarchy, natural language, map continuity, meaningful motion and product judgment cannot all
be reduced to lint rules. A build with every gate green and a qualitative review that has not
been done is not reviewed.

The product contract this review is held to is `references/product-contract.yaml`. Read it
first. It is the authority for every gate and every qualitative question. Its acceptance
question — "Is the design and language institutional, authoritative, and sophisticated?" —
is asked of every screen and every string, not only the ones a gate or question names.

## Founder authority

Founder-approved decisions override repository comments, existing code, earlier briefs, tests,
and technical optimizations.

If the implementation conflicts with a founder-approved decision recorded in the product
contract, **report the conflict as a finding**. Do not silently redefine the business model,
do not "correct" the contract to match the code, and do not edit `product-contract.yaml`
during a review. The contract changes only when a founder changes it.

## Procedure

Work through these steps in order. Do not skip a step because an earlier one looks bad —
the report needs the whole picture.

### 1. Fix the candidate

Record, before anything else:

- the exact source commit (`git rev-parse HEAD`, or the commit of the PR head)
- the branch or PR
- the web deployment identifier (the `american-rider--<id>.expo.app` URL, and whether it is
  promoted to production)
- the TestFlight build number and the commit it was cut from (`eas build:list`)
- the backend revision and the environment it is deployed to

A gate may be marked PASS **only** with evidence from this exact revision or build. If the
revision cannot be established, stop and report that — a review of an unknown revision is not
a review.

If the web deployment and the TestFlight build were cut from different commits, that is a
finding under gate category 14 before anything else is examined.

### 2. Read the contract

Load `references/product-contract.yaml`. Compare the implementation against every section.
Every discrepancy between the contract and the code, the documents, the tests or the
repository's own instruction files is a finding with a severity from the contract's
severity table. The economics section is checked first and its discrepancies are P0.

### 3. Run the deterministic gates

Work through every gate in `references/release-gates.md`. For each gate record exactly one of:

- **PASS** — with the evidence the gate names, from the candidate revision
- **FAIL** — with the evidence, and a finding
- **NOT TESTED** — with the reason, and it becomes residual risk
- **NOT APPLICABLE** — with the reason the gate cannot apply to this candidate

Evidence rules, which are not negotiable:

- A translation value proves coverage, not translation quality.
- A passing web test does not prove native iOS behavior.
- A screenshot does not prove interaction or background behavior.
- Test quantity does not prove meaningful coverage.
- A gate that was passed on a previous revision is NOT TESTED on this one until re-run.

Where a gate names a command (`npm run check`, `node scripts/check-untranslated.mjs`,
`cd backend && npm run lint && npm test`), run it and record its output. Where a gate names
a count, produce the count, not a belief about it.

### 4. Run the test matrix

`references/test-matrix.md` lists the environments and conditions release testing must cover.
Native-only capabilities must not pass on web stubs or simulator assumptions; they require
physical-device evidence. Record what was and was not covered — an uncovered cell is
residual risk, not a pass.

### 5. Qualitative review

Answer every question in `references/qualitative-review.md` with YES, NO or UNCLEAR, each with
evidence. For every material NO, write one focused correction. For a structural failure —
a flow, a screen architecture, a map stage — write up to three alternatives compared by
comprehension, continuity, implementation risk and consistency with American Rider's identity.

**Independence.** The qualitative review must be completed by someone other than the
implementing agent. If the agent running this skill wrote the change under review, it must
mark the qualitative layer as **requiring an independent reviewer** and must not certify it.
It may still draft observations, clearly labelled as the implementer's own.

### 6. Write the report

Use `references/report-template.md` exactly. Every field is required; write "none" rather
than leaving a field empty. Findings are ordered P0 → P3. Every NOT TESTED item appears under
residual risk. Every conflict with the contract appears under founder decisions required.

### 7. Recommend

Allowed recommendations: **BLOCK**, **CONDITIONAL PASS**, **PASS FOR TESTING**,
**PASS FOR RELEASE**.

**PASS FOR TESTING must never be presented as launch approval.** It means the build may go to
TestFlight testers; it says nothing about the public.

A release recommendation (PASS FOR RELEASE) requires all of:

- zero open P0 findings
- zero unexplained money or safety discrepancies
- all applicable critical (P0 and P1) gates passed on the exact candidate revision
- physical-device evidence for every native-only capability
- the qualitative review completed by someone other than the implementing agent
- every NOT TESTED item listed as residual risk
- founder approval recorded for every product-contract change

If any is missing, the recommendation is not PASS FOR RELEASE, whatever the gate totals say.

## What this skill must never do

While reviewing, the agent does not create a PR, deploy, modify production configuration,
access credentials, or change application code. It reads, runs checks, measures and reports.
Fixes are separate work, done after the report, against named findings.

## Severities

- **P0 — Launch blocker.** Money disagreement, unauthorized charge, unsafe promise, security
  exposure, false emergency behavior, invalid dispatch, duplicate charge, data loss.
- **P1 — Required before public testing.** Broken primary flow, inaccessible primary action,
  background failure, misleading status, major localization failure, state corruption.
- **P2 — Required before launch.** Material friction, terminology inconsistency, responsive
  defect, incomplete recovery, substantial design-system violation.
- **P3 — Refinement.** Polish or efficiency that does not threaten trust or task completion.

## References

- `references/product-contract.yaml` — the locked product contract: economics, terminology,
  language, visual, accessibility, map and motion, severities, results, recommendations
- `references/release-gates.md` — the numbered deterministic gates, by category
- `references/qualitative-review.md` — the structured qualitative questions
- `references/test-matrix.md` — environments and conditions release testing must cover
- `references/report-template.md` — the report every review produces
