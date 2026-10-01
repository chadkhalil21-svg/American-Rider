# National market pricing commissioning

American Rider uses one national method and market-specific evidence. There is no national fare curve.

For every service market, commissioning must establish:

1. authoritative geography and jurisdiction;
2. an explicit pricing record;
3. an explicit market-evidence plan with at least two independent evidence families;
4. lawful source adapters normalized through `market-evidence-ingest.js`;
5. a robust condition-matched market reference;
6. the national 90% positioning objective subject to the economics floor;
7. router, hold-out, source-diversity and economics gates;
8. continuous monitoring after launch.

## Evidence acquisition

Use the strongest evidence actually available in each market.

Government/open trip records are preferred only when the public schema actually contains usable passenger-fare, time and geography fields. Chicago TNP trip data currently satisfies that standard. NYC TLC high-volume FHV public records and Massachusetts reports are valuable structural evidence but are not assumed to provide Chicago-equivalent passenger-fare microdata. California CPUC reporting is free public evidence, but passenger-fare eligibility remains disabled until the relevant public-period schema is verified.

Where public data is absent or too stale/coarse, use an approved independent controlled audit and/or a commercially licensed national/metro dataset. Gridwise Analytics is identified as a candidate licensed source because it advertises national/metro customer-pricing and record-level rideshare data. A contract, permitted use, schema validation and credentials are required before its data may be treated as active.

Field observations are validation evidence. Platform-published route averages are secondary validation. Neither may silently become the sole primary production fit.

## Cold start

A new market does not inherit South Florida or any neighboring market. Before activation it must have a market-specific reference that passes admission. If the evidence is insufficient, the market remains unavailable.

After launch, American Rider's own completed Travels become an additional first-party source for service reliability and marketplace balance, not a substitute for external competitive reference evidence.

## Refresh

External observations may be collected/recomputed hourly where source cadence permits. Slow government datasets retain their actual publication cadence and are combined with fresher independent/licensed observations rather than falsely labeled real-time. Production reference promotion remains at most daily and evidence-gated.

The platform never promises hourly competitor prices when the underlying source updates weekly, monthly or later. Every observation retains its source and timestamp.

## Market expansion rule

Adding a state or metro is not a code fork. It is a commissioning package: geography + law + insurance + tolls + evidence plan + reference + pricing record + tests. Missing any package component fails closed.

## National zero-license-cost expansion template

The default U.S. commissioning path is public-first and requires no licensed market-data subscription. A new service market begins with the current independent public national rate-card layer (presently covering 312 U.S. cities across all 50 states), then adds any usable government passenger-fare microdata, independent observed-trip aggregates where available, and a controlled contemporaneous public-price panel. At least two independent evidence families must qualify before automatic production promotion.

This template is infrastructure, not permission to copy another city's price. Every market remains separately commissioned. Public national rate cards bootstrap discovery and sanity checking; they cannot alone become production authority. Government fare microdata receives the strongest evidentiary treatment where its schema is actually usable. Controlled public observations provide the direct contemporaneous layer where government fare data is absent. Licensed sources such as Gridwise remain optional gap-fill rather than a prerequisite.

State expansion therefore does not require a new fare engine. It requires a commissioning package: service-market geography, jurisdiction/insurance/toll rules, source adapters and provenance, representative route/time cells, evidence diversity, pricing record, and the existing router/hold-out/economics/promotion gates. Missing evidence fails closed rather than inheriting a neighboring market.
