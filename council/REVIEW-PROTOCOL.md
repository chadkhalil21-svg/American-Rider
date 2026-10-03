# Council Review Protocol

Council reviews the exact candidate SHA. Never substitute memory, a prior branch, or a prior report.

## Phase A — Ground truth
Run `node scripts/council-inventory.mjs`. Reconcile the tracked-file count with `git ls-files`. Preserve `artifacts/council/inventory.json`.

## Phase B — Surface reconstruction
1. Reconcile every `app/` route with all navigation targets and deliberate withdrawals.
2. For every reachable route, enumerate material states: initial, loading, populated, empty, validation failure, provider/server failure, offline/timeout, denied/revoked permission, unauthorized/ineligible, destructive confirmation, success, stale/deep-link state, and role/jurisdiction variants where applicable.
3. Enumerate every interactive control at runtime. Reconcile runtime controls with the static control seed. A difference is an investigation, not an automatic defect.
4. Trace each control to its handler, client bridge, endpoint/provider call, persistence effect, and resulting UI state.
5. Reconcile all backend endpoint registrations with clients, webhooks, scheduler/monitor sweeps, operations surfaces, and tests. Orphaned endpoints and client calls without endpoints are investigated.
6. Reconcile every user-visible string with localization and the Language/Hospitality review. Server-generated prose and HTML are included.
7. Reconcile every requirement in release-gates.md and test-matrix.md with evidence from this SHA.

## Phase C — Independent specialist review
Each domain reviewer receives the candidate SHA, Constitution, inventory, applicable source files, runtime evidence, and current authoritative external standards. Reviewers return structured findings conforming to `council/evidence.schema.json`. They may not silently change the candidate.

UX/Design and Language/Hospitality review EVERY reachable screen, not a sample. For each screen they explicitly evaluate hierarchy, spacing, proportion, typography, color, iconography, terminology, natural English, quiet authority, first-class hospitality, and the institutional/authoritative/sophisticated rubric.

Standards Research records URL, publisher, retrieval date, applicable version/jurisdiction, and proposition. Prefer primary sources. Distinguish law/regulation, provider requirement, accessibility/security standard, industry practice, and American Rider house standard.

## Phase D — Adversarial falsification
The adversarial reviewer receives prior findings but not their authors' reasoning. It attempts to falsify VERIFIED claims, searches for missing screens/states/controls/requirements, and specifically challenges historical defects that may be stale. No historical issue is reopened without current-SHA evidence.

## Phase E — Repair and re-verification
Repair occurs only on a branch. The repair agent cites finding IDs. After repair, affected inventories and tests rerun. An independent reviewer verifies the repair against the new SHA. Evidence tied only to the old SHA becomes stale unless explicitly demonstrated invariant.

## Exhaustive completion gate
Council cannot use "exhaustive" unless:
- tracked files classified = tracked files;
- reachable routes classified = reachable routes;
- material screen states classified = material screen states discovered;
- runtime controls classified = runtime controls discovered;
- backend endpoints/jobs/callbacks classified = discovered denominator;
- user-visible strings/locales classified = discovered denominator;
- applicable release requirements classified = applicable requirements;
- every P0/P1 finding is VERIFIED, NOT_APPLICABLE with reason, or an explicit EXTERNAL_BLOCKER/NOT_TESTED that prevents release certification;
- the adversarial pass finds no unaccounted denominator item;
- all evidence identifies the exact candidate SHA and environment.

The Evidence Arbiter reports denominator counts and residual uncertainty. It does not replace missing evidence with judgment.
