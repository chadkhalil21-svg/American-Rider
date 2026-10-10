# American Rider — One National Insurance Verification Service

**Reviewed:** 10 October 2026. **Design constraint:** One phone for the founder, provider-neutral, operator-funded primary insurance, minimal founder intervention, no fabricated evidence, no exclusive insurer/agency, and no promised free service at a million Operators.

## Honest scope
The software has a national jurisdiction identity catalogue of 56 jurisdictions, a reusable policy-eligibility engine and a separately commissioned insurance-policy registry. This PR creates **one source-adapter interface**, not 56 integrations. Florida is the first adapter and the only commissioned state insurance policy. A new state can plug its legal, regulator and provider rules into the same interface **after real source verification**. An uncommissioned state must never borrow Florida's registry or silently qualify Operators.

A provider is 'recognized' only in the narrow sense of **current evidence of identity and relevant insurance licence/authority from a credible source**. Recognition is NOT membership in a commercial club, a preference for large firms, proof of an issued policy, proof of for-hire coverage, or a partnership. Small/new licensed agencies are welcome: use their authentic state directory or authenticated insurer portal. An absent or delayed regulator listing is **not a fraud verdict**. If evidence cannot be authenticated, qualification stays pending while the Operator chooses a supported proof path.

## National provider channels — use the least costly authenticated option actually supported

| Provider-supported channel | Suitable scale | What it can prove | Rule |
| --- | --- | --- | --- |
| Carrier signed cancellation/status event | Large portfolios | A changed policy status when bound to an exact insured/policy | **Preferred** if contract, auth key, event signatures and provider coverage are commissioned; not present automatically |
| Carrier/broker authenticated portal or consented verification API | Large to medium | Current status for an identified policy | Only treat as trustworthy with proven recipient permission, matching vehicle/limits/use and verified source |
| Insurer/agency batch acknowledgement | Large portfolios | Status for a consenting list of Operator policies | One supported batch rather than thousands of broker emails; requires actual provider agreement and secure channel |
| Existing one-use secure email confirmation | Early operations / low-volume agencies | A specific provider response concerning one identified policy | Retry appropriately. Officially recognized agency mailbox or independently verified source; no implicit future guarantee |
| Operator-managed alternate verification | New/small/unresponsive agencies | Help obtaining a verified source response or portal access | Self-service; do **not** assume fraud or ask the founder to sign off by default |

The system must route based on **provider capability** and verification of the underlying message. Do not pretend that an API, batch upload, signed event, or universal producer-licence subscription is connected until commissioned. Current actual production channel is secure one-use email; the other channels are the national design targets, not launched services. No provider-specific method may bypass the insurance qualification gate.

## Nonresponse, spam, and delivery failures
- A sent/accepted email is not proof it reached a human. SPF/DKIM/DMARC, consistent sender, Resend delivery/bounce events and good domain reputation help; they do not guarantee inbox delivery. The Resend account had **zero inbound webhooks** at this review, so no continuously processed incoming ordinary email channel should be claimed.
- Use a known, verified provider contact and a short plain-text message describing the policy and the one-use secure status link. If the provider requires a signed release or its own portal, offer that path.
- Escalate from delivery failure, repeated silence or agency mismatch to **Operator self-service correction**, not automatic founder work or a false 'cancelled' statement. Only exceptional unresolved cases require oversight.
- A current policy cannot be assumed valid forever merely because the insurer never replies. Current 30-day status refresh and bounded attestation grace expire according to the eligibility engine. Missing evidence means ineligible for new Travel once the allowed verification window ends; that is distinct from declaring the policy cancelled.
- Any active Travel crossing a newly discovered cancellation needs its own claims/emergency playbook; restricting **future** acceptance is not a substitute for the TNC's statutory insurance obligations.

## Capacity and costs (illustrative, not a purchase forecast)
One million individually mailed policies every 30 days is ~33,333 original emails per day and 1,000,000 per month, before reminders. The existing Resend Free tier allows 100 emails/day and 3,000/month. This is **not** a free million-Operator design. Its published paid tiers and per-1,000 overages may make email affordable at some scale, but do not solve spam, human response or actual insurance validation. Prevent provider email saturation by negotiating **batch/status-change interfaces** for high-volume carriers; use exact secure email for small agencies that prefer it. Build quotas, delivery/bounce feedback, and explicit provider-channel capabilities only when their live operational requirements are established.

The existing leased scheduler runs each minute and uses an indexed rotating cursor rather than repeatedly selecting the oldest 250 policies. This removes starvation but is not a proof of email or carrier response throughput at millions scale.

## Standards and sources
- [NAIC and NIPR producer licensing](https://content.naic.org/insurance-topics/producer-licensing) — multistate identity and licensing. [NIPR subscriber reports and alerts](https://nipr.com/industry-solutions/reports-and-alerts) are **not universally free** and are FCRA-purpose restricted.
- [NAIC directory of state insurance departments](https://content.naic.org/state-insurance-departments) — state-level authoritative sources for new and small firms.
- [Florida DFS published public business licence CSV](https://licenseesearch.fldfs.com/BulkDownload) — Florida adapter only; cannot automatically authorize a policy.
- [Google sender requirements](https://support.google.com/mail/answer/81126) — deliverability / bounce / reputation practices.
- [Resend transactional pricing](https://resend.com/pricing) — 3,000 monthly Free limit and paid volume costs.
- [GOV.UK Service Standard](https://www.gov.uk/service-manual/service-standard/point-11-choose-the-right-tools-and-technology) — reuse practical cost-effective tools and minimize unnecessary operator/admin interactions.
- [Florida 2026 TNC insurance statute](https://www.flsenate.gov/Laws/Statutes/2026/627.748) — separate residual statutory coverage; no audit/software code can waive obligations.

**Commissioning means real, authorized policy evidence.** Unit tests, state data retrieval, and simulated 100K/1M scale tests do not mean a provider has consented to batch/status webhooks or that any insurance contract or claims procedure has been established.
