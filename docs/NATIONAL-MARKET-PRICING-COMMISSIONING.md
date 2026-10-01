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

Government/open trip records are preferred when they contain usable fare, time and geography fields. Known examples include Chicago TNP trip data and NYC TLC high-volume FHV trip records. California CPUC public TNC data is an eligible program but fields and availability must be verified for the relevant reporting period before fare use.

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
