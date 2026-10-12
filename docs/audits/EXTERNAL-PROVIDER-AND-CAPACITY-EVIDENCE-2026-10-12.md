# American Rider — Provider and Launch Evidence Audit, October 12, 2026

**Evidence scope:** Connected Stripe sandbox, Resend callback history, Render low-load metrics, repository release/current, official Google, Amazon, NASA, Stripe, Resend, IRS/BLS documentation. This is NOT a certification of live travel, finances, insured coverage or real emergency dispatch.

## Actual verified service observations (read-only; no live transactions initiated)

- **Stripe SANDBOX ONLY:** one succeeded USD 100.00 PaymentIntent, one USD 100.00 Connect transfer. No refunds or disputes returned. These test objects do not establish that they belong to a specific American Rider Travel, nor do they reconcile charge fees, taxes, ownership, payout, refund, transfer reversal or legal reserves. No live transaction was created.
- **Resend:** one enabled email delivery webhook configured for sent, delivered, delayed, bounced, failed, suppressed and complaints. Seven earlier synthetic webhook events are marked success; an independently inspected event timed out on first three attempts then returned HTTP 200 on later retry. That proves the callback recovery path accepted the event, not that emergency email reliably reaches a human or that a real inbox was staffed.
- **Render:** safety server has one instance; sampled low-load process memory around 110-130 MB and small CPU. This does NOT measure heavy dispatch, BLS extraction, provider calls, Firestore invoice or 10,000 simultaneous active Travels. Historical RESOURCE_EXHAUSTED logs predate PR #130; neither those logs nor idle low CPU establish recovery under a fresh quota outage.
- **BLS:** May 2025 OEWS and area-to-county definitions are official and freely published, but an unattended BLS wage source request previously returned HTTP 403 in CI. No permission to bypass publisher controls, no assumed wage values, no conflation of employment medians with actual independent Operator net pay.
- **Chicago:** research-only public historical TNC trip sample was fetched and source validated in PR #135; it is neither current live quote nor geographic coverage sufficient for national 10%-below-market claims.

## Research and Council standards applied

- **NASA SWE-055:** requirements must be validated against actual intended user and abnormal environment: https://swehb.nasa.gov/spaces/7150/pages/16449673/SWE-055%2B-%2BRequirements%2BValidation .
- **Google Firestore performance and billing:** https://firebase.google.com/docs/firestore/best-practices and https://firebase.google.com/docs/firestore/pricing . Safety scan currently reads each underway Travel once every minute. Do not cap coverage to save money, but do not assume unlimited free scans. Measure billed reads, indexes, retries and p95/p99 under actual controlled load.
- **Amazon retries and idempotency:** https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/ .
- **Resend's documented 24h idempotency:** https://resend.com/changelog/idempotency-keys . Same request/payload and key may be safely replayed within provider retention. It is NOT an unlimited permanent uniqueness guarantee, nor a delivery receipt.
- **Stripe payment state and webhooks:** https://docs.stripe.com/api/idempotent_requests and https://docs.stripe.com/webhooks .
- **Apple device accessibility and input:** https://developer.apple.com/design/human-interface-guidelines/ .
- **Council perspectives** are a published-principles review (Ford repeatable work, Rockefeller complete unit costs, Jobs/Apple coherent phone experience, universities' marketplace design); no real-world consultation or institutional endorsement is represented.

## Implemented/proposed changes in this PR

1. Route monitoring now passes a stable incident key to the already existing ticket service. A Firestore write failure followed by another sweep must not assign a completely new case identity to the same event. Failed ticket responses no longer count as successfully filed.
2. Support and first-location emails carry Resend idempotency headers, reducing duplicated provider submissions within the documented retention period. A distinct case gets a distinct key. No actual email is sent by synthetic tests.
3. Tests inject two quota-failed safety sweeps, a ticket replay, forged location update, duplicate provider call and independently verified finite read-volume mathematics.
4. A no-network capacity forecast calculates 10k/100k/1m REGISTERED-user scenarios separately from 1k/10k/100k continuously ACTIVE Travels. It never invents provider p99, Firestore invoice, CPU headroom or regulatory authority.

## Critical launch evidence still NOT proven

| Priority | Required outcome | Who or what establishes proof | Status |
|---|---|---|---|
| Immediate | Critical incident visible to real Traveler/Operator and to reachable staffed responder | Actual iOS/Android test pushes, receipts, human acknowledgment and 911 policy | NOT proven |
| Immediate | No lost paid Travel; charge, transfer, refund and dispute reconcile one-to-one | Stripe test-mode ledger for a dedicated American Rider synthetic Travel, real signed webhook test | NOT proven |
| Immediate | Carrier independently confirms active qualifying TNC/commercial policy including lapse scenarios and required company obligations | Licensed carrier or authorized broker; legal counsel for jurisdiction | NOT proven |
| Immediate | Phone-first founder can authorize/revoke region and Operator, inspect exceptions and stop service securely | Named founder authentication, iPhone physical acceptance with MFA | NOT proven |
| High | Database works at peak load and recovers safely without retry storm, missing safety or payment tasks | Staged Firestore emulator + bounded live proof, billing export, exact p95/p99 | NOT proven |
| High | Nationwide route, toll and transit references correct | Real road/route holdouts, official feeds, lawful API terms, device proof | NOT proven |
| High | Local Operator sustainable net and 90% of independent ordinary market price | Real BLS source, approved county definitions, insured operating expenses, legally reusable contemporaneous full Traveler totals | NOT proven |
| High | Airports and regulated facility pickup lawful | Written authority/permits and verified jurisdiction configuration | NOT proven |
| High | Teen/Family consent, messages, safety and revocation work on separate devices | Verified guardian/Teen test identities and actual device checks | NOT proven |

## Safe release rules

Zero real passengers; zero live payments; no unsanctioned insurer/airport messages, no charged vendor accounts, no new state authorizations. Simulations and bundle exports may certify a test contract only, never a real provider or license. Stop if a required exact-head CI test fails. Preserve live customer money and eligibility authorities unchanged.
