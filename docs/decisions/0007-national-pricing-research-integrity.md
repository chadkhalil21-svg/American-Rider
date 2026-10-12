# ADR 0007 — National pricing research integrity and bounded operations

**Date:** 2026-10-11
**Status:** Proposed, draft PR #124; not merged/deployed.
**Scope:** Every present/future American Rider service market; separate from legal market admission and traveler consent.

## Council basis — published material, not personal consultation
- [Stanford GSB / Operations Research, Bimpikis–Candogan–Saban](https://gsbpreserve.stanford.edu/view/43576): locations are heterogeneous and supply responds to Operator compensation; one universal rate without local calibration is economically unreliable.
- [MIT Sloan, Freund / van Ryzin](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3931844): excessively frequent price changes can induce inefficient marketplace oscillations.
- [Harvard Business School, Frei](https://www.hbs.edu/faculty/Pages/item.aspx?research=7002): first-class service needs an explicit funding and operational delivery mechanism.
- [Uber engineering: simulated marketplace](https://www.uber.com/us/en/blog/simulated-marketplace/): validate marketplace outcomes with simulated demand/supply before a real roll-out.
- [Google SRE production practices](https://sre.google/sre-book/service-best-practices/) and [Cloud Firestore billing](https://firebase.google.com/docs/firestore/pricing): bound recurring work and measure reads/writes; avoid testing capacity from nominal user counts.
- [Amazon Builders' Library on jitter/backoff](https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter%20%C2%B7%20Like%20%C2%B7%20Reply.%201%20Reaction.%20See%20more%20...): repeated retries on transient provider/quota errors amplify failures.
- [NASA Software Engineering Handbook SWE-055](https://swehb.nasa.gov/spaces/7150/pages/16449673/SWE-055%2B-%2BRequirements%2BValidation): use objective test evidence and distinguish verification from validation.

**No university or company endorses our chosen 90% target.** Ford / Rockefeller / Jobs are historical strategic reference lenses only; none can personally counsel this project.

## Actual pre-change hazards confirmed in source
1. Uncommissioned Chicago did not fetch. *But if later admitted*, an unchanged imported sample could be re-fetched every hourly maintenance pass: no updated state timestamp was persisted for an unchanged source.
2. An ordinary research recomputation wrote a fresh `promotion:{status:'candidate'}` into the same `market_reference_snapshots/<market>` document previously used by an approved snapshot. A data update could therefore replace an approved live price reference, contrary to controlled promotion.
3. The observation writer did not ensure the returned `marketId`, `sourceId` and `sourceType` actually belonged to the queried source and market.
4. Earlier draft #124 had a one-document-per-quote snapshot read and a fare-vs-full-Total toll/tax reconciliation error; both already addressed in this draft.
5. No verified nationwide source of real full Traveler Totals is integrated. Standardized Census geography, BLS wages and AAA driving costs support **cost bounds**, not market-price evidence. Proposed regional estimates cannot certify a 10% actual competitive discount.

## Selected implementation
- Existing service-market admission, county boundaries and state compliance requirements remain hard gates. New geography gets no silent production Fare.
- Keep the normal quotation engine independent of commercial pricing providers. Only separately promoted, source-diverse, condition-matched and recently observed **full passenger Totals** can affect approved pricing.
- Research imports now write `market_reference_candidates`. Runtime only reads `market_reference_snapshots`, which this collector cannot overwrite. No automatic new promotion.
- Research scheduler checks at most daily by default; Chicago historical trips at most once in seven days, with durable per-source check time. A zero-change check incurs one bounded durable checkpoint when actually performed (not hourly). New licensed adapters must declare evidence, usage rights and appropriate source cadence; this does not grant future providers usage rights.
- Reject batches if normalized market/source/type mismatch before any observation write.
- In-memory reference cache remains bounded (30 s / 128 markets / single flight); multi-instance invalidation delay can last up to TTL, so do not treat a promoted snapshot update as instant authorization/revocation. Critical market legal eligibility remains checked separately.
- Unknown regions and sparse-evidence profiles fail closed for competitive claims; no automatic national service activation.
- Minimum 20 matched cell observations is a safety gate, **not** proof of statistical representativeness. Real holdout and independent calibration audits remain required.
- Prefer alerting on research source failures rather than retry storms. Do not disable critical money/compliance workflows to cap research spend.

## Test plan and limits
- New synthetic `market-reference-sweep-integrity.test.js`: reproduce stale-source hourly call pattern, test week-based durable checkpoint and no repeated writes, cross-market/source-type injection, and candidate/live separation. Run twice and under double full-platform CI.
- Existing draft tests: 10,000 price comparisons over 50 synthetic markets, 100,000 cached quote lookups over 50 hypothetical markets, all-in toll/fees against domestic/international card calculations, five historical geographic examples, restricted market gates.
- CI exact-head: application/test suite, deterministic commissioning, whole platform adversarial twice, scale stress twice, exhaustive twice, release gate, live Firebase Auth commissioning.
- These verify offline implementation and cost-count invariants; they DO NOT provide a statistical model fitted to independent actual fares in every town, a licensed supplier, real-world Operator acceptance, audited real money, or authorization to operate anywhere outside existing legal markets.
- No transaction/API import, real charge, new market admission, company policy or production deployment is authorized by this ADR.

**Next independent commissioning evidence:** Obtain legally reusable market datasets, verify countrywide/cross-metro coverage and price/sampling rights, then do real holdouts on South Florida with fees/tolls, pickup burden, payout cadence, actual marketing and corporate costs. Only separately approved snapshots/coefficient promotions become production.
