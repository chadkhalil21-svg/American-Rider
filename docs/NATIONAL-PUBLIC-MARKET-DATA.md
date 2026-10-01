# National public-first market-reference standard

American Rider prefers authoritative public evidence at zero acquisition cost. It does not assume equivalent public fare data exists in every U.S. market.

## Operating rule

For each proposed service market, search federal, state, city/county, taxi/FHV/TNC regulator, airport/port and local open-data catalogs. Register every authoritative source with its provenance, geographic scope, publication cadence, lag, fields, rounding/suppression, self-reporting status and regulator-review status.

A source is admitted only for the decisions its fields support:
- passenger charge + trip distance + trip duration -> candidate fare-reference evidence;
- distance/duration without passenger charge -> trip-shape evidence;
- trip counts -> demand evidence;
- statutory/regulatory rates -> regulatory/economic floor only.

No field inference is permitted. Driver pay is not Traveler fare. Aggregate fare collections are not a condition-matched individual fare. A statewide trip count is not a local price.

## Accuracy

Public does not mean exact. Preserve source caveats. Chicago rounds times to 15 minutes and fares to $2.50 and suppresses some geography; references built from it must retain those limitations. NYC says submitted trip records cannot be guaranteed complete/accurate, while TLC performs routine review. Such sources require cross-checks and may support structure without being sole production price authority.

Every stored observation retains source ID, timestamp and provenance. Source-native cadence controls freshness; monthly/annual data is never relabeled hourly.

## National coverage

The discovery layer applies to every market, but activation remains fail-closed. Where no public passenger-charge source exists, American Rider may use public trip/demand/regulatory evidence for the dimensions it supports while the existing locally verified production reference remains authoritative. A new market without enough fare-reference evidence does not inherit another market's coefficients.

Commercial gap-fill is deferred by founder decision. The registry should nevertheless make the precise public-data gap legible so a future procurement is narrow and evidence-driven.
