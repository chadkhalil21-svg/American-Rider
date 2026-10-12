# ADR 0008 — Bounded eligibility-filtered refund recovery

**Date:** 2026-10-11. **Status:** draft only. **No production mutation.**

## Decision
The platform shall query only **eligible cancelled refundPending Travels** inside the bounded recovery batch. Previously, `refundPending=true` included non-cancelled records that the processor skipped after retrieving them, allowing unrelated records to occupy all 100 read slots. This can delay a refund owed on a cancelled paid Travel without changing the state of the misleading record. The fix applies `status=cancelled` inside Firestore before the limit.

## Published engineering standard
- [AWS REL05 — limit queues, retry safely and fail fast](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/design-interactions-in-a-distributed-system-to-mitigate-or-withstand-failures.html).
- [Google Firestore query and index best practices](https://firebase.google.com/docs/firestore/best-practices).
- [Stripe idempotency and retry semantics](https://docs.stripe.com/api/idempotent_requests).
- [NASA verification matrix and intended-use validation](https://www.nasa.gov/reference/system-engineering-handbook-appendix/).
- [OWASP unrestricted resource consumption](https://api-security.owasp.org/editions/2023/en/0x11-t10/).

The applicable Council interpretations are Ford (do no pointless repeat work), Rockefeller (billable reads and refund liabilities), Jobs/Apple (Traveler never waits for an unrelated abandoned record), HBS service funding, and NASA verifiable source-to-test trace. These are researched reference frameworks, not actual endorsements.

## Changed files
- `backend/bookingrecovery.js`: conjunctive query; preserve `BATCH_LIMIT=100`, all present payment ownership and idempotent refund checks.
- No new composite index is required for the two equality predicates. Firestore's built-in single-field index merging supports conjunctive equality filters. Preserve the current index manifest; test the actual query after deployment and add a composite index only if Query Explain or measured high-volume performance requires it. Source: https://firebase.google.com/docs/firestore/query-data/index-overview#use_index_merging
- `backend/bookingrecovery.test.js`: faithful multi-where mock and adversarial 125 irrelevant flags preceding one real cancelled payment refund.
- `docs/audits/INSTITUTIONAL-WHOLE-PLATFORM-ASSURANCE-2026-10-11.md`: 24-category whole-platform standards and evidence matrix.

## Limitations
No real money used; no claim of verified production refund backlog or completed end-to-end physical-device test. This stops one starvation mechanism, not every problem under provider outages, index errors, or 1M accounts. Existing processing idempotency and legal coverage must remain intact. Monitor separate active-Travel read amplification and production billing evidence; do not trade safety-monitor completeness for a small bill.

**Release gate:** exact SHA six workflow suites including backend double stress and Firestore rules, query-behavior review, then controlled deployment and rollback verification. No Firestore index commission required for this equality-only change. Until then draft, no live action.
