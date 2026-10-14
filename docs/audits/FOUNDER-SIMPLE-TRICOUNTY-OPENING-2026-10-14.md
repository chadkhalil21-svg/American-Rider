# South Florida opening: simplify the existing system — source audit, 14 October 2026

## Outcome
The founder's GitHub-authenticated, versioned standing instruction `founder-open-fl-southeast-20261013` is **already running**. Do not ask the founder to reinstall a market command plugin, individually approve Miami-Dade/Broward/Palm Beach, or invent a second bridge. Production `sweepFounderMarketIntents` calls the single `activateRegion` atomic server transition. The command **is received** and historically returns `region_not_ready`. Exact production `market_admission` evidence is not established by the repository; the verified observed October 14 06:19 UTC log reported 14 `record_absent` and one `production_verification_missing` screening-provider indication, with no county activation.

### Council source review (published positions, not actual endorsements)
- MIT CISR, Jeanne W. Ross, *Your Business Is Too Complex to Be Digital*: remove non-value-adding variability / process layers rather than designing alongside them. https://cisr.mit.edu/index.php/publication/your-business-too-complex-be-digital
- Google SRE, *Eliminating Toil*: simplify the workflow **before** automating unnecessary repetitions and do not turn automation into new manual tickets. https://sre.google/workbook/eliminating-toil/
- Amazon Builders' Library, *Making retries safe with idempotent APIs*: one request safely retried without a second opening or inconsistent side effects. Our GitOps intent + transactional activateRegion uses this pattern. https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-apis/
- Microsoft Well-Architected, *Implementing automation*: automate repeatable procedural work but preserve human review for cases that need real-world judgment, preferably using existing services. https://learn.microsoft.com/en-us/power-platform/well-architected/operational-excellence/automate-tasks
- IBM Enterprise Design Thinking, Sponsor Users: solve real operator and customer outcomes, test and observe real users instead of guessing new functionality. https://www.ibm.com/design/research/sponsor-user-program/overview/
- Stanford d.school, Design Thinking: prototype and test with real people; a synthetic green run is not real-world validation. https://dschool.stanford.edu/s/Facilitators-Guide_Design-Thinking.pdf
- Harvard Business School, Frances Frei, *Service Excellence by Design*: deliver sustainable service attributes supported by actual financial and operational capacity. https://www.hbs.edu/faculty/Pages/item.aspx?research=7002
- Apple HIG, Design Principles: clarity, unobtrusive operation, visible result, measured interruptions. https://developer.apple.com/design/human-interface-guidelines/design-principles/
- GOV.UK Service Standard: end-to-end test on target devices; minimize rekeyed information and repeated forms. https://www.gov.uk/service-manual/service-standard/point-4-make-the-service-simple-to-use
- Firebase Firestore practices: bounded reads, read-before-write for transactions, eliminate redundant network work. https://firebase.google.com/docs/firestore/best-practices

### Exact 2026 Florida statute checked
Florida Statute §627.748(17) preempts additional county/municipal TNC licenses and operating rules for **ordinary prearranged TNC services**. Airports and seaports may collect reasonable pickup fees and designate staging/pickup areas. This is not proof that all state-level obligations are fulfilled and **does not bypass** local restricted-facility protection. Official source: https://www.flsenate.gov/Laws/Statutes/2026/627.748 . Under §627.748(7)(d), lapse of the driver's coverage engages specific TNC-insurance provisions; preventive automatic duty blocking cannot nullify those provisions. Section (12) additionally requires prescribed background/driving checks. Do not fabricate the company binder or authenticated screening provider.

## What already works
- One standing GitHub-to-live-server Founder intent, no second connector.
- One three-county atomic admission operation, all-or-nothing, idempotent recheck. No individual Founder steps.
- One region-level evidence source can be recorded for all three counties **only when its real scope has been checked** by the verified Operations control.
- Market status panel already groups 15 reported issues into four business areas. An absent record explicitly does not establish the work was never done.

## This change
**Do not touch `REQUIRED_EVIDENCE`, `readinessFor`, `activateRegion`, `founder-market-intents`, qualification, live charges, insurance, or screening gates.** Instead, derive a one-time source-based resolution plan from existing reported deficiencies (not a second approval system), merge duplicate counties for presentation, and show three source workstreams:
1. **Reconcile already-developed work:** existing statutory/geography configuration, Operator insurance handling, agreements/disclosure, pricing, routing/tolls. Review actual existing artifacts **once**, do not buy/build again.
2. **Confirm third-party arrangements:** company insurance position under statutory fallback, authenticated screening report chain, provider agreements and qualified Operator supply. An Ops record may link existing genuine sources, but cannot be forged from tests or Founder approval.
3. **Observe real-world behavior:** live-money reconciliation, safety/accessibility, restore drills and actual iPhone/Android tests. Synthetic tests reduce risk but do not prove physical-device, real insurer delivery, or money movement.

The Operations status has an optional, accessible 'Resolve the existing evidence once' view and points to the **already-existing** region evidence reuse form. It explains Florida's absence of separate county TNC permits without declaring any state obligations satisfied. The existing one-click open South Florida control and backend decision are unchanged. No extra collections, network integrations, new manual county ceremonies, new ongoing checks or cost.

## Proof of the distinction
Unit test `backend/market-founder-simplification.test.js` simulates 3 counties × 14 missing evidence records + shared screening-provider issue for two passes, asserts only 3 deduplicated source workstreams presented, all 3 counties remain protected and not active, no missing record automatically becomes a valid review, and the only regional opening action remains singular. Run exhaustive CI, stress twice, release-gate, Firebase and whole-platform tests on the exact head before merge. Do not claim actual activation because a release succeeds.

## What NOT to do
- Do not establish a new GitHub command bridge or ask the Founder to reapprove a decision already recorded.
- Do not pretend that a county government requires a general TNC operating license where §627.748 preempts it.
- Do not mark `company_insurance_bound`, `screening_agreement`, `provider:screening_provider` or controlled live-money evidence as true without verifiable underlying evidence.
- Do not confuse a source record missing from the admission collection with the absence of an actual completed task; search logs, provider records and prior proofs first.
- Do not declare TestFlight installed or physical-device validation from CI-only evidence.
- Do not bypass existing atomic admission, commercial safety, and incident support to produce a misleading OPEN label.
