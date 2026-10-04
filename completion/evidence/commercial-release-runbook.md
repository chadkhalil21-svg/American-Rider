# American Rider — release, recovery and exception runbook

**Decision now: NO-GO for any commercial Travel**, including the limited adult South Florida non-facility fallback. This is an evidence decision, not a preference to shrink the product. The objective remains the complete product; the [Completion Ledger](../ledger.json) states why each capability is withheld and what unlocks it. Draft [integration PR #59](https://github.com/chadkhalil21-svg/American-Rider/pull/59) is **not** a release candidate, merge authorization, deploy request, credential provisioning or insurer sign-off.

## Owners and non-delegable decisions

| Gate | Required independent owner/evidence | Current state |
|---|---|---|
| Legal entity, statewide/market TNC authorization, Florida §627.748 duties, ADA, payroll/tax/records and documented insurer/CPA obligations | Executive, specialist counsel, licensed broker/carrier, CPA; effective documents and dates | NOT TESTED; no paper record supplied |
| Company and Operator coverage, vehicle/CRA/checks, payout eligibility, appeals and facility endorsements | Carrier, credentialed Operations/Safety, CRA and market authorities | NOT TESTED; facility markets remain denied |
| Transport, custody, minor and recurring-charge policies | Safety/legal/insurer/merchant approvers, documented terms and consent version | NOT TESTED; do not enable independent Teen, Courier or recurrence |
| Credentialed hosted infrastructure, deploy provenance, Firestore rules/indexes, PITR/backup, R2 retention and provider contracts | Engineering/SRE, privacy and vendor owners, signed deployed SHA and restore logs | NOT TESTED; local tests are insufficient |
| Staffed 24/7 emergency, customer complaints, refunds, accidents and human escalation | Named duty officer, pager, backup, drill logs and response ownership | NOT TESTED; stored case and accepted email are not an answered page |
| Native payment/delivery and accessibility | iOS + Android device leads, real test accounts and approved low-value provider budget | NOT TESTED; unauthenticated Expo Web screenshots prove only login fit |

## Pre-deployment controls

1. Protect `release/current`. Keep PR #59 draft. Review the entire diff and inventory, independently approve the exact source commit, pinned lockfiles and licenses. Run check-only CI on that SHA and record failures; never treat a prior commit's green badge as the final SHA.
2. Provision environment-scoped secrets **outside Git** through approved systems: Firebase Admin, Stripe server/webhook/Connect, HERE, R2, Resend, Expo/APNs/FCM, region-specific OTP feed, screening provider and retained Anthropic support/monitoring key. `TEEN_PIN_SECRET`, named `OPS_USERS` TOTP secrets and independent `OPS_SESSION_SECRET` are required for those protected paths; do not rotate the Teen secret while an active Teen Travel depends on it. Twilio is not a mobile feature until native SDK/credential/device proof exists.
3. Deploy the exact Firestore security rules and composite indexes **before** enabling scheduled, Family and provider-queue workers; verify index build status and actual query results. Demonstrate network isolation, privacy logs, least privilege, staff MFA and limited retention.
4. Establish source-of-truth accounting per PaymentIntent, charge, refund, transfer, payout and bank settlement. A pending or processing refund is a debt, not success. Reconcile orphan charges and charged-but-unmatched Travels daily; record idempotency keys, actual balances, fee/toll payees, dispute reserves and owner sign-off.
5. Name staffed safety and financial exception rota; rehearse alert delivery failure, offline device, underage/custody dispute, inaccessible pickup, accident, service animal, discrimination complaint, carrier lapse and cancellation after payment. The emergency screen offers **device dialing 911**; neither a case nor a push call dispatches help by itself.

## Real-world acceptance campaign, after written authorization

Use low-value staged charge test accounts or an expressly approved live pilot and qualified insured staff. Retain case/travel/Stripe/refund IDs and timestamped logs; no personal secrets in the dossier. For each intended market and app platform:

- On-demand: quote both endpoints/permits/tolls, confirm a server-priced amount, take PaymentSheet result, independently verify provider success, reserve exactly one Operator, accept/decline/reoffer **the same** Travel, arrive/board/complete, receipt/payout and bank match. Simulate lost HTTP response after provider success, simultaneous two-Travel offer, lost phone, stale location, revoked user, missing provider and no Operator; prove refunds reach terminal provider/bank state.
- Scheduled: compare booking timestamp/quote to dispatch-time route/toll, off-session payment mandate, due-ordered Firestore index, overlapping worker leases, card decline, delayed success, abandoned prepared booking, provider webhook failure, recovery sweep, cancellation/refund, Guardian permission and staff handling.
- Family/Teen: test an authorized/unauthorized Guardian, revoked link during offer, PIN retrieval without push, lockout, no replay, custody/ID handoff, lost phone and practical child-safety response. Carrier/legal sign-off is separate from source test results.
- Smart Travel: test actual regional OTP and licensed GTFS/RT, fare-unknown display, both paid car legs, disrupted transfer, wrong stop, fee alignment, restart and cancellation. Agency fare is separate from American Rider charges.
- Return, Android, national markets, airport/port, native calling, Courier and recurring series each require their own Ledger release-later evidence; do not let a passing adult ride silently turn them on. National **search** is not national permission to sell.
- Repeat accessible flows with VoiceOver/TalkBack, large text, offline conditions, language switching and real native background/notification permissions. A screenshot of the unauthenticated web shell is not an authenticated or native test.

## Monitoring, incident and recovery

- Monitor queue age, due counts, failed/dead provider events, paid/unassigned Travel age, refund pending age, stale Operator assignments, monitoring overflow, 5xx/provider timeouts and offline alert receipts. The new `GET /ops/provider-events/dead` returns bounded metadata; named MFA Operations may `POST /ops/provider-events/:id/replay` only after checking provider state/ownership. The replay is audited and **may duplicate side effects if the handler is not idempotent**; never blindly replay money or emergency notifications.
- Keep the privileged Ops and safety duty roster current. For a reported emergency: prioritize caller's direct 911 action, timestamp the case, page staffed safety, verify someone acknowledged, preserve route/location/vehicle evidence and initiate insurer/regulator notice as required; do not infer human acknowledgement from an accepted email/push.
- Configure and rehearse Firestore scheduled backups/PITR restoration into a separate database, index/rule reapplication and an R2 document-restore/delete drill. Verify restored Auth/ride/provider-event references and bank ledger against Stripe. Firebase backup/PITR is an available product feature, **not evidence it has been enabled**.
- If a source/deploy mismatch, unexplained funds, uninsured Operator, failed screening, permit gap or unstaffed safety desk appears: freeze new offers in the affected market, preserve pending refunds and unaltered audit records, keep emergency access and already-running Travel support, page the responsible humans and roll back only to a known signed SHA after invariant checks. A Git revert alone does not reverse Stripe or Firestore transactions.

## Expansion and stop criteria

At 10k/100k/1m completed adult Travels per month, gather actual p95/p99 and unit bills before raising load. The present 40-event/min queue and 500-active-Travel monitoring cap cannot certify 1m/month; scheduled due ordering repairs a starvation defect but not nationwide capacity. Approve additional market packets individually (insurer, law, accessible fleet, tariff, facility, staffing, provider quotas, rollback). **Founder approval before any merge into `release/current` is still mandatory.**
