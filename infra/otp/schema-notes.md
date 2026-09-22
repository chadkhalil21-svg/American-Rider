# OpenTripPlanner 2.10.0 — GTFS GraphQL API notes for the backend

Verified against the running local server on 9 September 2026 (`introspection-planConnection.json`
in this directory is the raw introspection result; `example-*.graphql` / `example-response-*.json`
are real requests and their real answers).

## Endpoint

| | |
|---|---|
| URL | `POST http://localhost:8080/otp/gtfs/v1` (locally); on Render `http://american-rider-otp:8080/otp/gtfs/v1` |
| Headers | `Content-Type: application/json`; optional `OTPTimeout: 30000` (milliseconds) |
| Body | `{"query": "...", "variables": {...}}` |
| Health | `GET /otp/actuators/health` → `{"status":"UP"}` (HTTP 200) |
| Server info | `GET /otp/` → version, commit, `otpSerializationVersionId` |
| Debug UI | `GET /` (a browser page to try plans by hand) |
| Full schema | https://docs.opentripplanner.org/api/dev-2.x/graphql-gtfs/ (2.10.0 copy at `~/otp-data/schema-2.10.0.graphqls`) |

The old REST planner (`/otp/routers/default/plan`) was removed in OTP 2.8. `planConnection` is
the current query; `plan` still exists but is deprecated.

## Identifiers

Every id is `"<feedId>:<id-in-the-feed>"`. The feed ids are the ones declared in
`build-config.json`: **`MDT`** (Miami-Dade Transit, agency `MDT:DTPW305`) and **`SFRTA`**
(Tri-Rail, agency `SFRTA:SFRTA`). So Metrorail is route `MDT:31009`, the MIA Mover is
`MDT:14458`, the Tri-Rail mainline is `SFRTA:1`. `backend/transit-routes.json` already carries
the `gtfsId` form.

Modes as OTP reports them for these feeds: Metrorail = `RAIL` (the feed codes it route_type 2,
not 1, so it is never `SUBWAY`); Metromover and the MIA Mover = `TRAM`; every bus = `BUS`;
Tri-Rail = `RAIL`. Requesting `[SUBWAY, TRAM, RAIL, BUS]` covers everything present.

## `planConnection` arguments

```
planConnection(
  origin:      PlanLabeledLocationInput!   { label: String, location: { coordinate: { latitude, longitude } } }
  destination: PlanLabeledLocationInput!
  dateTime:    PlanDateTimeInput           { earliestDeparture: OffsetDateTime } or { latestArrival: OffsetDateTime } — omit for "now"
  searchWindow: Duration                   e.g. "PT2H"; omitted = OTP picks 40 min–3 h dynamically
  first: Int / after: String               forward paging (cursor from pageInfo.endCursor)
  last:  Int / before: String              backward paging
  modes:       PlanModesInput              see below
  preferences: PlanPreferencesInput        { transit: { filters: [...] }, street: {...}, accessibility: {...} }
  itineraryFilter: PlanItineraryFilterInput
  via: [PlanViaLocationInput!]
  locale: Locale
)
```

`OffsetDateTime` must carry an offset: `"2026-09-09T21:40:35-04:00"`. Miami is
`America/New_York`.

## Modes (`PlanModesInput`)

```
modes: {
  transitOnly: Boolean = false     true → never return a walk-only / car-only itinerary
  directOnly:  Boolean = false
  direct:      [PlanDirectMode!] = [WALK]
  transit: {
    access:   [PlanAccessMode!]  = [WALK]
    egress:   [PlanEgressMode!]  = [WALK]
    transfer: [PlanTransferMode!] = [WALK]
    transit:  [{ mode: TransitMode!, cost: { reluctance: Float! }, replacement: {...} }]  = all modes
  }
}
```

Enums:

- `PlanAccessMode`: BICYCLE, BICYCLE_PARKING, BICYCLE_RENTAL, CAR, **CAR_DROP_OFF**, CAR_PARKING, CAR_RENTAL, FLEX, SCOOTER_RENTAL, WALK
- `PlanEgressMode`: BICYCLE, BICYCLE_RENTAL, CAR, **CAR_PICKUP**, CAR_RENTAL, FLEX, SCOOTER_RENTAL, WALK
- `PlanTransferMode`: BICYCLE, CAR, WALK
- `PlanDirectMode`: BICYCLE, BICYCLE_PARKING, BICYCLE_RENTAL, CAR, CAR_PARKING, CAR_RENTAL, FLEX, SCOOTER_RENTAL, WALK
- `TransitMode`: AIRPLANE, BUS, CABLE_CAR, CARPOOL, COACH, FERRY, FUNICULAR, GONDOLA, MONORAIL, RAIL, SNOW_AND_ICE, SUBWAY, TAXI, TRAM, TROLLEYBUS

### The Smart Travel shape (car → transit → car) — what actually works

| access | egress | result |
|---|---|---|
| `[CAR_DROP_OFF]` | `[CAR_PICKUP]` | **rejected**: "For the time being, CAR_PICKUP needs to be combined with WALK mode for the same leg." |
| `[CAR_DROP_OFF]` | `[CAR_PICKUP, WALK]` | rejected, same message (the check applies to the drop-off side too) |
| `[CAR_DROP_OFF, WALK]` | `[CAR_PICKUP]` | rejected, same message |
| **`[CAR_DROP_OFF, WALK]`** | **`[CAR_PICKUP, WALK]`** | **works** — `example-plan-car.graphql` |
| `[CAR_DROP_OFF, WALK]` | `[WALK]` | works (car in, walk out) |
| `[CAR]` | `[CAR]` with transfer `[CAR]` | `NO_TRANSIT_CONNECTION` — that mode means park-and-ride and the graph has no car parks |

Consequences the backend must handle:

1. Because WALK has to be listed, OTP is free to return itineraries that **start or end with a
   walk instead of a car leg** (in the saved response, itinerary 3 walks 667 m to Brickell
   Station and only uses a car at the airport end). Read `legs[0].mode` and `legs[-1].mode`:
   `CAR` is the leg an Operator drives; `WALK` means OTP judged walking better. Decide per
   product rule whether to accept the walk, replace it with a car leg priced by the backend, or
   drop the itinerary.
2. The car leg ends at a **street-network point near the stop**, followed by a short WALK leg of
   0–150 m to the platform (e.g. "Northwest 12th Avenue → UHEALTH JACKSON STATION"). The
   drop-off point for the Operator is `legs[i].to` of the CAR leg (`lat`, `lon`, `name`); the
   boarding stop is `legs[i+2].from.stop.gtfsId`.
3. Car legs carry `distance` (m) and `duration` (s) from OTP's own street routing (default car
   reluctance 10, so OTP prefers short drives to reach frequent transit). Price them with the
   backend's own fare model, not with anything from OTP.
4. Every itinerary in the saved responses ends with a 1.9 km walk because the requested
   destination coordinate (25.7959, −80.2870) lies inside the airport grounds, away from any
   road. With the terminal kerb (25.7953, −80.2789) the same trip is 50 minutes and ends with a
   129 m walk. Geocode destinations to a street-reachable point.

## Restricting to specific routes or agencies

`preferences.transit.filters` is a list of `TransitFilterInput`; a trip is used when at least one
filter includes it and none excludes it. Each selector is `@oneOf`: either `routes` or
`agencies`, never both in one object. Empty lists are forbidden (omit the field instead).

```graphql
# Allow-list: only these routes (example-plan-filtered.graphql; tested, works)
preferences: { transit: { filters: [{ include: [{ routes: ["MDT:31009", "MDT:14458"] }] }] } }

# Allow-list by agency
preferences: { transit: { filters: [{ include: [{ agencies: ["MDT:DTPW305"] }] }] } }

# Everything except two routes (tested, works)
preferences: { transit: { filters: [{ exclude: [{ routes: ["MDT:31120", "MDT:14458"] }] }] } }

# All of one agency except one route
preferences: { transit: { filters: [{ include: [{ agencies: ["MDT:DTPW305"] }], exclude: [{ routes: ["MDT:31136"] }] }] } }
```

Filters are OR-ed across the list: `[{include: {routes: [A]}}, {include: {agencies: [B]}}]`
means "A or anything of B". When a filter leaves no usable trip the response is not an error but
`routingErrors: [{ code: NO_TRANSIT_CONNECTION_IN_SEARCH_WINDOW }]` with `edges: []`.

Restricting `modes.transit.transit` to `[{mode: RAIL}, {mode: TRAM}]` is the other lever: it
removes buses wholesale. Mode restriction and route filters combine.

## Reading the answer

```
planConnection {
  searchDateTime
  routingErrors { code description inputField }   # [] on success
  pageInfo { hasNextPage endCursor }
  edges { cursor node {                            # node is an Itinerary
    start end            # OffsetDateTime
    duration             # seconds
    numberOfTransfers walkDistance walkTime waitingTime generalizedCost
    legs {
      mode               # WALK | CAR | BUS | RAIL | TRAM | ...
      transitLeg         # true for BUS/RAIL/TRAM legs
      duration distance  # seconds, metres
      start { scheduledTime estimated { time delay } }   # estimated is null: no real-time feed is loaded
      end   { scheduledTime estimated { time delay } }
      from { name lat lon stop { gtfsId name } }
      to   { name lat lon stop { gtfsId name } }
      route { gtfsId shortName longName mode agency { gtfsId name } }
      trip { gtfsId tripHeadsign }
      headsign
      legGeometry { length points }                      # Google encoded polyline, precision 5
      stopCalls { ... }                                  # intermediate stops if needed
    }
  } }
}
```

`startTime`/`endTime` (epoch millis) and `intermediateStops` are deprecated; use `start`/`end`
and `stopCalls`.

Error codes seen: `NO_TRANSIT_CONNECTION` (no service can link the points at all),
`NO_TRANSIT_CONNECTION_IN_SEARCH_WINDOW` (none in the window — widen `searchWindow` or move
`dateTime`). Both come with `edges: []` and HTTP 200. Schema violations (a bad enum, the
CAR_PICKUP rule) come back in the top-level `errors` array, also HTTP 200.

Observed latency on this graph: 0.1–0.8 s per `planConnection` on a laptop.

## Other useful queries

```graphql
{ feeds { feedId agencies { gtfsId name } } }
{ routes { gtfsId shortName longName mode type agency { gtfsId } } }        # 125 routes
{ routes(feeds: ["MDT"], transportModes: [RAIL, TRAM]) { gtfsId shortName } }
{ stopsByRadius(lat: 25.7617, lon: -80.1918, radius: 500) { edges { node { distance stop { gtfsId name lat lon } } } } }
{ stop(id: "MDT:1016") { name lat lon routes { gtfsId shortName } } }     # Brickell Av & SE 12 St; unknown ids return null, not an error
```
