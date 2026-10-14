# South Florida synthetic staging admission

The staging branch runs the existing Founder-command implementation against an isolated in-memory database. It seeds the eleven required market-level evidence keys with clearly labeled SYNTHETIC_TEST_ONLY references. Only this isolated CI test process sets SCREENING_EVIDENCE_WORKFLOW_VERIFIED=true.

Do not deploy these seeds to the production Firebase project. Do not enable real Travel, live Stripe, or real dispatch on the basis of these test results.

For authentic production approval, each market_admission/<marketId>.evidence.<domain> requires reference, issuer, verifiedBy, reviewedAt (Unix milliseconds), validUntil (Unix milliseconds), and the current manifestVersion. The market record also needs manifestVersion and an authorized status. Production issuer fields must identify real reviewed evidence, not this fixture. The screening flag requires a demonstrated and reviewed external screening-agency-to-Operations workflow.

The synthetic CI test calls the actual sweepFounderMarketIntents function with the existing registered command, checks atomic activation for three counties, idempotency and fail-closed behavior, then repeats the campaign.
