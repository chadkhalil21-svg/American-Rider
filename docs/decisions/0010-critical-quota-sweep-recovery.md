# ADR 0010 — Critical sweeps during quota outages

**2026-10-12; reviewed draft.**

## Problem found in deployed source
- The global Firestore quota timeout short-circuited the **entire scheduler** for 5–10 minutes. This unintentionally suspended the safety monitor, canceled-Travel refund recovery, settlements, scheduled departure and signed provider-event handling.
- The scheduled-work function assembled its per-job result but failed to **return** it. The outer scheduler then tried to inspect missing results; that exception could produce a failed timer/503 even when individual sweeps had executed.

## Preferred low-cost correction
- Restore a real structured result for every scheduled sweep.
- Keep expensive/discretionary work (market-price research, fleet maintenance, account-fee batch, account deletion) paused during quota recovery.
- Attempt to obtain the **existing cross-instance Firestore lease at most once per minute per process**, even while the long optional-work backoff is active. If Firestore is still unavailable, the failed lease stops everything; never launch full work against an exhausted database.
- On a successful leased recovery attempt, run **only** existing critical safety, travel, insurance, screening, provider and money-recovery tasks. Keep their idempotent logic and cross-instance lease unchanged. Once recovered, resume ordinary optional work on the following tick.
- Do not promise continued real-time monitoring **during** actual Firestore unavailability. Real driver/traveler safety must have available off-platform emergency paths; the scheduler must disclose degradation.
- The current shared lease lasts up to five minutes; if a prior release fails, takeover may wait for expiry. This draft does not guarantee a recovery service level. Explicitly measure in production.

## Primary engineering research
- [Google SRE service best practices](https://sre.google/sre-book/service-best-practices/): preserve essential service under overload and avoid recursive retries.
- [Firestore best practices](https://firebase.google.com/docs/firestore/best-practices): bound read/write operations and contention, gradual scaling.
- [AWS Builders Library: retries with backoff and jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/): avoid amplified load while allowing eventually healthy services to recover.
- [NASA SWE-029](https://swehb.nasa.gov/pages/viewpage.action?navigatingVersions=true&pageId=23200749): fault injection and real operating-environment validation.

## Verification and release constraints
- Synthetic 30-minute outage/recovery run twice; 10,000 repeated triggers/10,000 critical batches in-memory; ensure a failed safety monitor never prevents settlement/refund; no optional market-data import during quota backoff.
- Both exact-commit CI and Render deployment/build validation; no real passengers, money, refunds or provider calls from the tests.
- Remaining: live Firestore quota and billing monitoring, contention and lease expiry, 10k concurrently active journeys and cross-instance network fault injection, actual environmental safety controls.
