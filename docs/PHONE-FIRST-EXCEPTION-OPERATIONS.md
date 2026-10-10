# American Rider — Phone-First, Exception-Driven Operations

Reviewed against `release/current` at `17b46840ec6d8e54653f9acc48f0f828be523a54`, 10 October 2026.

## Operating principle
The founder's phone is an **oversight instrument**, not a processing queue for every Operator. Never add a task requiring repeated human action unless a dependable automated alternative has first been considered. Keep routine Operator document assessment, insurance-status refresh requests, screening expiry enforcement and dispatch eligibility on existing server-side deterministic flows. No AI subscription or new email platform is necessary for rules the backend can enforce directly.

## Insurance communications: what exists, what does not

Already implemented:
- Each authorized Operator can provide insurer/broker contact details, and the server can send a direct **one-use secure status-confirmation link** using existing transactional email. After a confirmed response from a previously authenticated provider contact, insurance status is updated automatically. Adverse or overdue coverage blocks duty/Travel.
- Recurrent 30-day verification and a limited five-day self-attestation window; routine responses do **not** require the founder to log into Operations. Insurers can say a portal or further authorization is necessary.
- Insurance contacts independently authenticated once can be reused for multiple Operators; the exception-only contact-verification form is on the existing console.

Not yet established:
- **Unsolicited email reply ingestion.** The connected Resend account had zero webhooks as of this audit. An interactive ChatGPT Gmail/Resend connection is not a constantly running server capable of monitoring a million inbox messages. Resend offers signed `email.received` webhooks, but implementing them requires a configured receiving domain/address, a signed handler, secret management and operational evidence.
- **Universal automatic source authentication.** SPF/DKIM/DMARC help authenticate email domains, not legal producer identity or whether a particular insurer/broker is authorized to confirm a specific policy. A one-use token sent to an Operator-supplied mailbox authenticates possession, not company identity. Do not automatically approve an unverified source.
- A free authoritative bulk verification process. Florida DFS publicly offers licensure data for businesses and licensees; Florida OIR offers a company directory. Those data sources must be evaluated for actual fields, freshness, licence class, mailbox linkage, safe ingestion and record matching. **A licence record alone cannot validate a specific policy**. Never assert an automated regulator connector exists until fully implemented and pilot-tested.

### Next automation design (future commissioning; not shipped by this PR)
1. Obtain published DFS/OIR data in a format that lawfully permits automated use, record provenance and freshness, and reconcile regulator entities with independently authenticable company domains.
2. Preserve DMARC-aligned provider message headers and verify webhook signatures when inbound processing is deliberately enabled.
3. For known authenticated provider channels, reuse trust to process routine **per-policy** confirmations without founder clicks.
4. For unknown identities, mismatched insured/VIN/policy, non-responses, disputed status, or adverse changes, automatically hold qualification and send a **single clear exception notice**. Allow correction self-service before founder escalation.
5. Batch failure notices to the founder when a configured **owner-authorized** destination exists; never send sensitive report copies or identity numbers to ordinary email. Evidence belongs in restricted systems. Confirm actual email quotas and throughput before million-Operator projections.

## National markets — one decision, many local gates
Use `/ops/markets` on an iPhone. The first screen asks only **which state or territory**. An optional collapsed control allows a particular imported county/city. A state plan is one intentional record, not a demand to enter every county or purchase additional geocoding.

A state plan is **not commercial launch**: the server still has to implement that jurisdiction's law, verified boundaries, pricing, routing and supporting infrastructure, and the separate commercial market-admission conditions for each opened area. Existing Florida statewide evidence should be reused across covered counties where genuinely valid; service-specific authority remains local. Do not add a new app or duplicated screening architecture for each county.

For existing three configured South Florida counties, detailed evidence forms and activation buttons remain but are collapsed by default. Their state remains authoritative. The administrator should open the detail only for an actual exception or to issue final authorization when independent evidence and infrastructure really pass.

## External standards consulted
- [UK Home Office, Automate to eliminate manual steps (2026)](https://engineering.homeoffice.gov.uk/principles/automate-to-eliminate-manual-steps/) — reduce operational toil and human-error cost.
- [GOV.UK Service Standard: simple to use](https://www.gov.uk/service-manual/service-standard/point-4-make-the-service-simple-to-use) and [cost-effective tools](https://www.gov.uk/service-manual/service-standard/point-11-choose-the-right-tools-and-technology).
- [Google email sender authentication guidance](https://support.google.com/mail/answer/81126).
- [Florida DFS insurance business licences: official bulk downloads](https://licenseesearch.fldfs.com/BulkDownload); [OIR official licensed company directory](https://companysearch.floir.gov/).
- [Resend receiving webhooks](https://resend.com/features/inbound) and [webhook signature verification guidance](https://github.com/resend/resend-skills/blob/main/skills/agent-email-inbox/references/webhook-setup.md).
- [NIST 800-63A-4 authoritative/credible source validation](https://pages.nist.gov/800-63-4/sp800-63a.html).

**This UX change alone does not commission the insurer-source registry or webhook ingestion.** It introduces no additional vendor, payment, coverage claim, jurisdictional permission or background screening approval.
