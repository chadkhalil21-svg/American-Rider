# Market Calibration and Toll Resolution Architecture

Status: scale architecture; production fare coefficients remain unchanged until promotion gates pass.

## Market-neutral pricing

American Rider has one pricing engine. Geography selects evidence/configuration; geography does not
select bespoke application code.

Flow:

```
pickup geolocation
  -> active service market / regulatory jurisdiction
  -> market calibration record
  -> routed distance + expected duration + service class
  -> Travel Fare
  -> universal economics solver
  -> jurisdictional pass-throughs
  -> Traveler Total
```

A state is primarily a regulatory jurisdiction. A pricing market is an economically coherent
transportation geography. City/town/village boundaries do not automatically create fare cliffs.

Miami/South Florida is the first launch evidence file, not the architecture. New markets use the
same schema and `scripts/calibrate-market-fares.mjs`. Where evidence is sparse, the market remains
unpromoted or inherits an explicitly approved regional prior; the server never fabricates local
precision.

Production promotion requires representative short/medium/long routes, dayparts, hold-out
validation, production-router validation, source-diversity checks and full economics tests.

## Toll resolution: cheapest trustworthy source first

Tolls are pass-throughs. American Rider must neither silently assume zero nor call a paid provider
when its own route can establish that no toll facility is used.

Resolution order:

1. Self-hosted OSRM/OSM route. The OSRM car profile exposes OSM road classes including `toll`.
   A definitive OSRM route with no toll class is clear at zero marginal provider cost.
2. If the route is toll-relevant, consult jurisdiction/authority-maintained toll-rate data when
   American Rider has a current, versioned official record for the traversed facilities.
3. If price remains unresolved, use HERE toll pricing as the exceptional verifier.
4. If still unresolved, status remains `unknown`; never coerce it to $0.

Official toll records are configuration/data, not Florida-specific code. Florida's Turnpike/SunPass
is one authority source; subsequent jurisdictions plug into the same authority-registry interface.

The current implementation adds stage 1 immediately. Stage 2 requires facility-level official-rate
records before it may answer a price. Until those records exist, toll-relevant/indeterminate routes
fall through to HERE rather than guessing.

## Scale invariants

- no provider-specific live competitor dependency in production pricing;
- no city-specific branching in the pricing engine;
- no nationwide single coefficient assumed without evidence;
- no paid toll query for a route our own authoritative router identifies as non-tolled;
- no unknown toll converted to zero;
- no market promoted without evidence and hold-out tests;
- economics solver remains centralized and identical across markets except explicit
  jurisdictional pass-throughs/configuration.


## Market-admission contract

A market is not made ACTIVE by geography alone. Before activation it must have, at minimum:

- an explicit pricing record with dated local evidence; no national/default fare coefficients;
- production-router validation and short/medium/long route hold-outs;
- jurisdiction law/disclosure configuration and the correct screening cadence;
- Operator/TNC insurance architecture for that jurisdiction;
- corporate/regulatory assessments classified as fixed, percentage-of-revenue, per-Travel, or pass-through;
- airport/seaport/other authority-controlled places default-denied until permits and fees are verified;
- toll authority/fallback coverage;
- the common unit-economic invariant re-run over the local fare distribution.

Texas example: statewide TNC authority does not make Austin/Dallas/Houston one economic pricing
market. The state supplies the regulatory jurisdiction; economically coherent local geographies
supply fare evidence. California likewise may have multiple pricing markets under one regulatory
jurisdiction.

Activation is atomic. Missing local pricing, insurance, screening, regulatory-cost or permit
evidence means WAITLIST/UNAVAILABLE, never inheritance from South Florida.
