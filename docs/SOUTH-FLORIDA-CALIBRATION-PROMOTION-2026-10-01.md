# South Florida calibration promotion audit — 1 October 2026

Base: release/current 8a97acbab0d84718269bf25b74e415c7a039c81b.

## Finding

PR #21 already supplied the national, market-neutral calibration architecture. This audit does not replace it.

The 29 September South Florida basket used generic Uber route averages. Current Uber route pages now expose product-specific UberX monthly averages on many routes, and those values can differ materially from the generic route average. Example: Miami → Aventura is $30 generic route average but $40 UberX. Promotion from the old basket would therefore mix unlike evidence.

The new evidence file records only product-specific observations as fit/holdout rows and records independent market references separately. Lyft's public Miami/help pages confirm Standard service and the determinants of upfront pricing but do not expose a route-by-route historical Standard matrix; no Lyft route price is fabricated.

## Promotion contract

The calibrator now reports explicit gates:
- at least 8 ordinary fit observations;
- at least 3 ordinary holdouts;
- at least 2 source domains in route evidence;
- product-specific fit observations;
- nonnegative fitted base/mile/minute coefficients;
- holdout MAPE <= 15%;
- production-router validation;
- economics validation.

Passing these gates does not mutate production. A reviewed market-pricing record remains a separate explicit change.

## Current disposition

HOLD.

The current product-specific route basket has enough fit and holdout observations and uses a defined product, but route-level source diversity is not yet satisfied because public Lyft pages do not expose equivalent historical route observations. Production-router validation is also not evidenced by this web audit. The current evidence must therefore not be promoted by changing backend/market-pricing.js.

Independent context is retained from TaxiFare.org aggregated Miami/Cutler Bay observations, RideWise's standardized Miami Uber/Lyft comparison, Lyft's official pricing documentation, and Miami-Dade's official taxi tariff. Those references are validation context, not silently relabeled as exact route quotes.

## Required external capture to clear HOLD

Capture contemporaneous Lyft Standard upfront quotes for the same representative short/medium/long South Florida routes (with timestamp, endpoints, product, total and screenshot/export), and execute the basket against the configured production street router. Re-run the common economics and holdout gates. Only then create the explicit pricing-record promotion commit.
