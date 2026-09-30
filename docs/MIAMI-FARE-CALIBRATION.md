# Miami Standard Fare Calibration — 29 September 2026

Status: **research protocol; no production coefficient authority**.

## Governing doctrine

**American Rider should be competitively priced against the market distribution—not maximally
cheap and not mechanically tied to another platform's instantaneous price.**

Production remains governed by `backend/fares.js` and `backend/economics.js` until the protocol
below has enough independent/current evidence and passes production routing/economics tests.

## Correction to the first calibration pass

The first PR revision fitted 14 route-page historical averages published by one leading platform.
Those observations are useful secondary checks, but they are **not an acceptable primary calibration
dataset**. The numerical candidate produced from them ($7.026 + $0.883/mile + $0.142/minute) is
therefore withdrawn as a production candidate. It remains a diagnostic showing why the current
$1.00 base can materially underprice Travel; it is not a rate to deploy.

A platform's own historical-average webpage is neither independent evidence nor a contemporaneous
market distribution. American Rider will not build its national pricing system around it.

## Direct Doral → MIA validation panel

Founder-supplied screenshots on 28 September 2026 captured the same origin
(2050 NW 94th Ave, Doral) and destination (American Airlines Concourse D, MIA) at multiple times.
The ordinary Standard quotes visible were:

| screenshot time | Standard quote | displayed trip indication |
|---|---:|---:|
| 14:58 | $33.50 | 12 min |
| 15:10 | $28.94 | 11 min |
| 16:40 | $24.95 | 11 min |

Observed range: $24.95–$33.50. Arithmetic mean: $29.13. Low-to-high spread: about 34.3% of the
low quote. These are **validation observations**, not an American Rider price target. Airport Travel
also remains unavailable until the relevant permit is held, so this OD pair is excluded from
ordinary launch calibration.

The panel demonstrates why a live competitor-price peg would be poor product design: one OD pair
moves materially even within a short observation window.

## Independent evidence hierarchy

Calibration evidence is ranked, not mixed indiscriminately.

Tier A — public/independent transaction microdata:
government TNC/taxi trip records with actual trip distance, duration, timestamp and fare where
available. Examples include NYC TLC HVFHV records. These establish trip distributions and, where
fare fields are comparable, price distributions.

Tier B — independent controlled price audits:
matched OD/time quote studies such as NBER Working Paper 34441. Its February 2025 NYC audit used
2,238 matched trips selected to mirror actual TLC temporal/geographic trip patterns. Average
absolute cross-platform gap was about $3.50 / 14% of average fare, and differences exceeded $1
about 75% of the time. This is strong evidence for using distributions/medians rather than one
quote, but it is NYC evidence, not a Miami rate card.
https://www.nber.org/papers/w34441

Tier C — peer-reviewed trip-behavior datasets:
used to shape the distance/time basket and weight trip classes, not to transplant old/local prices
into another market. RideAustin research, for example, supplies useful trip-length/time evidence.

Tier D — founder/field contemporaneous quote panels:
excellent local validation and drift detection when route, time, class and date are recorded;
not independent and therefore not sufficient alone for coefficient fitting.

Tier E — platform-published route averages/rate cards:
secondary sanity checks only. Never the primary fit.

## National calibration architecture

There is **not one base dollar amount for every city**, and there should not be 50 hand-written
state formulas either.

The durable model has three layers:

### 1. National economic floor
One central `economics.js` answers the minimum Platform Fee required by payment/Connect costs,
provisions and required contribution. State/local statutory pass-throughs remain jurisdiction
records, not hidden coefficients.

### 2. Market Fare curve
A service market/metro receives a calibrated Standard curve:

```
Fare_base(market, serviceClass)
+ beta_distance(market) * routedMiles
+ beta_time(market) * expectedMinutes
```

The base is **estimated**, not chosen aesthetically. It is the intercept/minimum-compensation
component required for that market after fitting representative observed market Totals backward
through American Rider's own Platform Fee solver. It absorbs fixed trip economics that distance
and duration alone do not explain. It must be regularized and constrained by short-trip evidence;
an unconstrained regression intercept must never automatically become a production base.

A state is a regulatory jurisdiction; a market is an economic/transportation geography. Miami-Dade,
Broward and Palm Beach may ultimately share a South Florida coefficient family if evidence says
their price distributions are sufficiently similar. A rural Florida market should not inherit
Miami merely because it is in the same state.

### 3. Bounded spatiotemporal adjustment
Time/date/location effects are separate from the stable Fare curve. Academic ride-sourcing research
shows supply-demand imbalance is spatial and temporal. American Rider should therefore measure
service reliability (request pressure, available Operators, pickup ETA, acceptance/completion,
traffic and special-event conditions), but should not copy opaque competitor surge.

Launch doctrine: **no unconstrained dynamic multiplier**. Start with stable market coefficients.
After American Rider has enough own demand/supply data, introduce only a bounded, auditable
market-balance adjustment if required for service availability. Smooth it across adjacent zones and
time periods; cap it; log every adjustment; show the Traveler one Total.

Academic controls:
- Afifah & Guo, Transportation Research Part C (2022), spatial pricing and congestion:
  https://www.sciencedirect.com/science/article/pii/S0968090X22002078
- Battifarano & Qian, Transportation Research Part C (2019), surge is spatiotemporal and associated
  with traffic, built environment, events and recent surge state:
  https://www.sciencedirect.com/science/article/pii/S0968090X19301627
- Ma, Fang & Parkes, spatio-temporal pricing mechanism:
  https://arxiv.org/abs/1801.04015

## Market-reference estimator

For each market, define cells by:
- service class;
- routed-distance band;
- routed-duration band;
- broad daypart / weekday-weekend;
- ordinary vs special regulated location (airport/port separately).

For a sufficiently populated cell:

```
MarketReference = weighted median of comparable observed Traveler Totals
```

Prefer independent transaction/audit evidence. Use field observations and platform-published data
as validation, with source weights and freshness decay. Never allow one source, one OD pair, or one
instantaneous quote to set production.

A planning competitive band can be evaluated around 93–100% of the robust reference, but **93% is
not a production constant**. NBER's matched audit found ~14% average absolute cross-platform
dispersion, so false penny-level parity is neither necessary nor evidence-based.

## Required sample before a market is promoted

For an initial market:
- cover <3, 3–5, 5–10, 10–20 and 20+ mile bands;
- cover morning, midday, evening and late-night plus weekday/weekend;
- include high-demand and ordinary zones;
- retain airports/ports as a separate regulated-location stratum;
- seek at least two independent/public evidence families where available;
- use contemporaneous field quote panels only as validation unless independently collected;
- validate all fitted observations with American Rider's own production router.

Where local fare microdata do not exist, use hierarchical calibration: national/public datasets
inform trip-distribution priors; local independent controlled audits and field panels update the
market level. Do not fabricate local precision.

## Promotion gates

1. independent/current evidence adequate across short, medium and long Travel;
2. source concentration test passes;
3. production-router miles/minutes validated;
4. hold-out routes show acceptable median error and no systematic short-trip overpricing;
5. economics/payment/toll/government-fee/Smart Travel tests pass;
6. founder review of the resulting market distribution and Traveler Total behavior.

Only then may market coefficients become production authority.
