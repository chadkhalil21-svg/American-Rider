# Platform economics and infrastructure at scale

Prepared 9 September 2026 for Adrian and Chad, extended 10 September with the answers to
Chad's follow-up (national scale, card origin, independent fare evidence, the hosting stack,
and what was built overnight). It answers Chad's questions of 9 September:
the platform fee and international cards; whether OpenTripPlanner is the right transit engine;
which maps to use at scale; how our fares compare with other platforms and what they should be
based on; and a line-by-line check of the cost tables Chad received from another assistant.
Every external figure below was read from the vendor's own page on 9 September 2026; where a
figure could not be confirmed it is marked as such.

## 1. Decisions taken today, and their state

| Decision | State on 9 Sept |
|---|---|
| Platform fee = the greater of $1.50 and 5% of the travel fare (Chad: "five percent") | Committed 10 Sept 2026 as `bba2b09` and pushed; confirmed in writing by Adrian 13 Sept. The live Render backend, website, TestFlight 36 and the deployed web app run the older rule until the release cut. |
| Smart Travel is real: OpenTripPlanner on Miami-Dade's timetable; two dispatched car travels around the transit leg; one platform fee per journey | Server adapter, plan screen, reservation flow and the one-fee rule committed 10 Sept 2026 (`0858f01`, `181605d`). OpenTripPlanner runs locally; it needs a server (§4). |
| Maps: no Google; MapLibre drawn in the palette on iPhone AND Android (Chad, 13 Sept 2026 — supersedes "Apple MapKit on iPhone"); self-hosted tiles; routing on our own OSRM | MapLibre on Home and Travel Confirmation since `110d934` (14 Sept); Apple Maps remains in the pickup pin and the in-travel map (docs/OPEN-DECISIONS.md §0). The public demo router was removed 10 Sept (`181605d`); a regional router still has to be provisioned before 28 Sept. |

## 2. The platform fee

**The premise, verified.** Stripe charges 2.9% + 30¢ on every successful card charge, plus 1.5%
on cards issued outside the United States, plus 1% where currency conversion applies. Apple Pay
and Google Pay cost the same as cards. Fees are not returned on refunds; a dispute costs $15
(stripe.com/pricing, read 9 Sept 2026). Visa alone carried 38.7% of the world's card purchase
transactions in the first half of 2024 and UnionPay 33.2%, the latter almost entirely inside
China (Nilson Report). Outside China, Visa and Mastercard are the cards a visitor to Miami
carries, and each of them costs us 4.4% + 30¢ to accept.

**Why a flat fee fails.** American Rider earns 1% of the fare plus the platform fee. Stripe's
cost is a percentage of the whole charge. On a US card a flat $1.50 loses money above a
$60.87 fare; on an international card above $33.35, which is airport territory. The rule in
the code until today, $1.50 up to $60.87 and a break-even floor above it, never lost on a US
card but earned two cents on a $60 travel and lost on every international card over $33.

**The rule now.** The platform fee is $1.50 or 5% of the travel fare, whichever is greater,
rounded up to the cent. Both halves equal $1.50 at a $30 fare, so there is no step. The
Operator's 99% of the travel fare is untouched at every price; every cent of protection comes
from the traveler's fee.

| Fare | Fee | Net per travel, US card | Net per travel, international card |
|---|---|---|---|
| $15 | $1.50 | $0.87 | $0.62 |
| $30 | $1.50 | $0.59 | $0.11 |
| $45 | $2.25 | $1.03 | $0.32 |
| $60 | $3.00 | $1.47 | $0.53 |
| $100 | $5.00 | $2.65 | $1.08 |
| $250 | $12.50 | $7.09 | $3.15 |

Net = 1% of fare + fee − Stripe's cost on the whole charge. At 4% an international card
loses up to 23¢ between $33 and $71; 5% is the smallest round rate with no loss anywhere,
including Stripe Connect's 0.25% payout cost. Refunds and disputes are not in the table; a
percentage fee funds them, a flat one does not.

**Language.** The Terms now read: "The platform fee is $1.50 or 5% of the travel fare,
whichever is greater. Payment processing is paid from that fee." The Operator's share is
stated as it always was: "Operators retain 99% of the travel fare." Traveler screens show one
Complete Travel Cost and no breakdown.

## 3. Fares: what they are based on, and whether they are competitive

**Today.** The server prices every travel from coordinates: $3.00 to begin, $1.80 per mile of
straight-line distance multiplied by 1.3 to approximate roads, minimum $9.00, then the class
multiplier (Premium 1.42, Large Vehicle 1.55, Shared 0.68, Pet +$3.00). There is no time
component, no demand pricing, no toll and no airport fee. The traveler pays that fare plus the
platform fee.

**A coordinate correction, first.** The app's "Miami International Airport" was a point on the
airfield 1.9 km from any road (25.7959, −80.2871). Every quote, route line and transit plan to
the airport was measured to it; OpenTripPlanner exposed it as a 25-minute walk. The
destination is now the terminal kerb (25.7953, −80.2789); the Brickell quote moves from
$19.13 to $17.97 and the website example is re-quoted to match.

**Against Uber, verified.** Uber publishes no rate card for Miami. Its own route pages give the
past month's averages: MIA to Brickell, UberX $25; MIA to South Beach, UberX $28, each
including a $2 airport fee (uber.com route pages, read 9 Sept 2026). Ours, quoted today:

| Route | American Rider, all in | UberX average | Operator receives (ours) |
|---|---|---|---|
| Brickell → MIA | $17.97 | $25 | $16.31 |
| MIA → South Beach | $26.89 | $28 | $25.14 |

An Uber driver receives roughly 55% to 70% of what the rider pays. Our Operator receives 99%
of the fare, which on these routes is 91% to 93% of what the traveler pays. The structural
fact: the platform's take is about 8% of the traveler's payment instead of 30% to 45%, so the
same traveler price pays the Operator materially more, or the same Operator pay costs the
traveler materially less.

**Three things the fare does not yet contain, and must.**

1. **Airport and port fees.** Miami-Dade Aviation charges transportation network companies
   $2.00 per pickup at MIA (Operational Directive 18-03, Exhibit F, 8 Dec 2025); PortMiami
   charges $2.00 per pickup (Terminal Tariff No. 010, 1 Oct 2025). Both require the company to
   hold a permit and remit monthly. Without the permit our Operators may not pick up at either;
   without the fee in the price the Operator or the company absorbs it. Proposed: a labelled
   government-fee line on the quote and receipt ("Airport fee · $2.00 · remitted to Miami-Dade
   Aviation"), neither fare nor platform fee. Founder decision required; the MDAD permit is an
   operational prerequisite for the busiest destination in the market.
2. **Time.** Distance-only pricing pays an Operator the same for five miles in twelve minutes
   and five miles in forty. Miami traffic makes that a real transfer from Operators to the
   platform's price competitiveness. Once routing runs on our own OSRM (§5) the quote has both
   distance and duration; the fare should be base + per mile + per minute, calibrated so the
   median travel price does not move.
3. **Tolls.** The Rickenbacker Causeway to Key Biscayne and every expressway toll come out of
   the Operator's 99% today. Uber and Lyft add tolls to the fare. The router knows which edges
   are tolled; the fare should carry the toll as a pass-through line.

**A statutory gap found while checking this, now closed.** Florida Statute 627.748(6)
requires the electronic receipt to list "the total time and distance of the ride" and "the
total fare paid". The receipt showed neither time nor distance. As of the evening of 9 Sept
every travel is dispatched with its road miles, the operator's app stamps boarding and
completion, and the receipt shows Distance and Duration, or "Not recorded" for a travel that
predates the fields. Subsection (4) is satisfied already: it requires the fare or its method
to be disclosed before the ride *or* an estimate to be offered, and the app quotes the exact
price before reservation.

## 4. The transit engine

**OpenTripPlanner is the right engine, verified.** OTP 2.10.0 was released 9 Sept 2026; it
requires Java 25 (since 2.9.0); its API is GraphQL at `/otp/gtfs/v1` (the REST API was removed
in 2025); it is LGPL-3.0 and runs in production for TriMet, MTA, LA Metro, MBTA and Sound
Transit (docs.opentripplanner.org). It plans car → transit → car directly: access mode
`CAR_DROP_OFF`, egress mode `CAR_PICKUP`, which is exactly Smart Travel.

**The alternatives.** MOTIS (MIT, C++, v2.11.2) routes the whole planet from one instance
and is the efficient answer at fifty cities, but its production evidence is one non-commercial
deployment (Transitous), whose hosted API forbids commercial use. Valhalla's transit routing
supports pedestrian access only. Navitia is being withdrawn. Google's Routes API bills transit
at $5 per 1,000 requests. Conclusion: OTP now, behind an adapter (`backend/transit.js`) so
MOTIS can be trialled when city three opens.

**Data, with corrected URLs.** Miami-Dade Transit's feed is at
`https://www.miamidade.gov/transit/googletransit/current/google_transit.zip` (8.4 MB, 123
routes: Metrorail as route type 2, Metromover and the MIA Mover as type 0, 119 bus routes);
the older `/transit/GIS/` address is dead. Tri-Rail: `https://gtfs.tri-rail.com/gtfs.zip`.
Brightline: `https://feed.gobrightline.com/bl_gtfs.zip`. Real-time positions for Miami-Dade
come from Swiftly with a key requested by form; the licence bars reselling and excessive
volume. The typed 23-station list is deleted.

**What runs where.** OTP needs one Java process with roughly 4 GB of memory for South
Florida. It does not need an account with anyone; it needs a server. Choices, all read 9 Sept
2026: Render Pro (4 GB) $85/month, Pro Plus (8 GB) $175/month; DigitalOcean 8 GB $48/month,
16 GB $96/month; Hetzner's US locations tripled in June 2026 ($73 for 8 GB), its German
locations remain $25 for 8 GB. Recommendation: one DigitalOcean 16 GB droplet in New York
carrying OTP, OSRM and the geocoder together, $96/month, replaced by a second when the first
is busy. Render is acceptable for the test program if a new account is unwelcome.

**What the founders must do.** Nothing today. When the server is chosen, Adrian creates the
account (Claude cannot), and the deploy is scripted in `infra/otp/`.

## 5. Maps at scale

**The principle: pay per server, never per call.** Verified prices per 1,000 calls, 9 Sept
2026: Google Routes $5.00, Google Geocoding $5.00, Google Dynamic Maps (web) $7.00, each with
10,000 free per month since 1 March 2025; Mapbox Directions $2.00 after 100,000 free, Mapbox
Geocoding $0.75 after 100,000 free, Mapbox mobile SDK $4.00 per 1,000 monthly active users
after 25,000, Mapbox Navigation $0.08 per trip after 1,000. A travel needs two routing calls
and about three address lookups, so at 2.5 million travels a month Mapbox alone is roughly
$10,000 a month and Google roughly $50,000. A 16 GB server running OSRM answers the same
questions for $96.

**The stack.**

| Need | iPhone | Android and web | Cost model |
|---|---|---|---|
| Map display | Apple MapKit (native, no published fee or quota) | MapLibre (BSD, free) with Protomaps tiles on Cloudflare R2 | R2: $0.015/GB-month, egress free; planet tiles ~120 GB, Florida a fraction |
| Routing, ETA, distance for pricing | our OSRM, server-side | our OSRM, server-side | per server |
| Address search | Apple on-device (MKLocalSearch, per-device throttling only) | our Photon or Pelias | per server |
| Transit | OTP | OTP | per server |

Apple's MapKit JS and Maps Server API share one quota of 25,000 service calls per day per
team, so Apple cannot be the server-side router at scale; native MapKit on the phone has no
such quota. The public OSRM demo router the backend calls today (`backend/routes.js`) permits
"reasonable, non-commercial use" at one request per second with no uptime promise. It must be
replaced before real Operators drive on 28 September.

**The cost line that actually grows.** Not maps: Firestore. Every dispatch reads the whole
`operators` collection to find the nearest car (`src/backend/dispatch.ts`, `backend/server.js`
/health). At 1,300 Operators and 250,000 travels a month that is 325 million document reads,
about $195 a month; at 65,000 Operators and 12.5 million travels it is 810 billion reads,
roughly $490,000 a month. Operator presence and matching move to a geo-indexed store (Redis or
PostGIS on the same server as the router) before Florida passes a few thousand Operators. This
is the one infrastructure item with a cliff, and it is ours, not a vendor's.

## 6. The cost tables Chad received, checked

The tables price a stack American Rider does not run. Netlify and Supabase are not in use (web
is on Expo's EAS Hosting, the server on Render, the database is Firestore); the "Claude AI"
line refers to the AI planner, withdrawn on 4 September. What they do get right:

- Mapbox's free tiers of 100,000 directions and 100,000 geocoding requests a month are real,
  so the correction to the earlier figures was warranted.
- $830 a month at 250,000 travels is the right order for Mapbox directions alone; adding
  geocoding brings it to about $1,300. Roughly $10,000 a month at 2.5 million travels is
  consistent with Mapbox's published tiers.
- "Infrastructure is not the constraint" is true of maps and hosting as a fraction of revenue.

What they get wrong:

- The traveler counts do not fit the travel counts: 7,500 travels from 300 travelers is 25
  travels per traveler per month; 250,000 from 3,500 is 71. Real rideshare users take a few a
  month. Either travelers are ten times more numerous or travels ten times fewer; hosting
  costs scale with travels, so the conclusion survives, but the user numbers should not be
  repeated.
- "Gross contribution" of $0.48 to $0.65 per travel is a net-of-Stripe figure under the old
  flat fee. Under the 5% rule the net per travel is $0.59 to $0.87 on typical fares and rises
  with the fare (§2).
- The Firestore dispatch cost (§5) is absent, and it is the only line that would become a
  constraint.
- The Mapbox enterprise range for millions of rides is quoted without a source; it is moot,
  because the plan is not to pay per call.

## 7. Open items, in order

1. Commit today's work as one release-candidate step once the founders have read this.
2. Provision the routing server (DigitalOcean 16 GB or Render Pro Plus); deploy OTP from
   `infra/otp/`; point the backend at it with `OTP_URL`; replace the demo router with OSRM on
   the same machine.
3. Founder decisions: airport and port fee as a labelled pass-through line; MDAD and PortMiami
   TNC permits; time component and tolls in the fare.
4. Receipt: add total time and distance (Fla. Stat. 627.748(6)); state the fare calculation
   in the Terms (627.748(4)).
5. Move Operator presence and matching off whole-collection reads before the fleet reaches
   the low thousands.

## 8. Answers to Chad's follow-up, 10 September

**What the 5% is.** It is the traveler's platform fee, never a share of the fare. The
Operator receives 99% of the travel fare at every price. The traveler pays the fare plus a
platform fee, and that fee is $1.50 until 5% of the fare exceeds $1.50, which happens at a
$30 fare. Below $30 nothing changed. Above it the fee grows with the fare so that no travel
loses money on any card.

**International cards.** Stripe reports a card's issuing country and its type (credit or
debit) the moment the traveler presents it, before any charge (Stripe PaymentMethod
`card.country`, `card.funding`). So the platform *can* tell. It may not price on it. Visa's
and Mastercard's rules allow a surcharge only on credit cards, capped at 3%, disclosed in
advance and on the receipt, applied uniformly to a brand; a surcharge by issuing country is
not a permitted category. Florida permits credit-card surcharges since *Dana's Railroad
Supply v. Attorney General* (11th Cir. 2015), but the network rules still govern. And the
quote is shown before the card is chosen, to a traveler who may hold several. One price for
everyone is the institutional answer and the lawful one; the uniform 5% carries the
international minority. The "$33 and $60" thresholds are cost facts about a flat fee, not
price rules; under the 5% rule there is one threshold, $30, for everyone.

**"Miami-Dade only", and thinking nationally.** The engine was never local; the data was.
The backend now has a region registry (`backend/regions.js`): a region is a name, its
counties, a bounding box, a timezone, its planner and router, and its transit feeds with
their fares. The first region is South Florida — Miami-Dade, Broward and Palm Beach — with
five feeds: Miami-Dade Transit, Broward County Transit, Palm Tran, Tri-Rail and Brightline.
The market gate, the map's routing, the transit planner, the bus allow-list and the fare
table all read the registry; nothing names a county in code any more. Opening a region is a
registry entry and a graph build; feeds are discoverable by bounding box from the Mobility
Database API (free with an account) or Transitland ($200/month for 200,000 requests).
Verified overnight on the five-feed graph: Fort Lauderdale to Brickell rides Brightline (car
7 min, train 38, car 8: 53 minutes against 100 by road); West Palm Beach to the airport rides
Tri-Rail. Under Chad's 15-minute rule no Broward bus qualifies and one Palm Tran route does,
so Smart Travel in those counties rides rail.

**OpenTripPlanner at national scale, verified.** Entur runs one OTP graph for the whole of
Norway: about 150 data parties, 60 timetable feeds, 900 million requests a month, serving
from about 4 GB of heap (NAPCORE 2023; OTP docs). Digitransit runs Finland and Estonia on
one router. OTP's own sizing: Finland a little over 10 GB, Germany 95 GB. New York State's
511NY runs a single OTP instance. So the national shape is one graph per state or metro
cluster, each a few gigabytes, on servers we own; fifty metros is fifty registry entries and
perhaps a dozen graphs. MOTIS (the engine behind Transitous, 1,800 feeds from 55 countries
on one instance) is the candidate for a single national graph later; the planner call is
behind an adapter so it can be trialled without touching the app. "Five US agencies" was a
sample from the deployments page, not the population; OTP is the most widely deployed
open-source trip planner there is.

**Fares, independently.** Uber's FY2025 10-K: Mobility revenue is 30.4% of Mobility gross
bookings. NELP (July 2025), from Gridwise and YipitData trip data: the companies keep about
40% of the rider's payment on average, Uber 42% since upfront pricing. Chicago's public trip
dataset (2 June 2026, 201,222 non-shared trips): average fare $19.87 for 8.31 miles, $2.39
a mile before tips. New York's minimum driver pay from 1 March 2026: $1.283 a mile plus
$0.681 a minute. Against that, our $1.80 a mile with a $3 base and no time term is at the
market's traveler price and pays the Operator 99% of it. The structural gap is time: every
regulator that sets driver pay sets it per minute as well as per mile, because congestion is
the Operator's cost. Recommendation, for founder approval: fare = $2.50 base + $1.05 a mile
+ $0.25 a minute of routed time, $9.00 minimum — calibrated so a 7.5-mile, 24-minute travel
still prices at $16.38 (today $16.47) while a 40-minute crawl over the same distance pays
the Operator $4 more. The router now returns both figures for every quote
(`quoteWithRoute`), so this can be modelled on real trips before any price changes.

**The three gaps, closed or configured.** Airport and port fees: a national, geofenced
registry (`backend/fees.js`) with verified entries for Miami International Airport ($2.00
per pickup, Miami-Dade Aviation Department) and PortMiami ($2.00 per pickup). The quote, the
confirmation and the receipt name the fee and its payee inside the one price; a remittance
ledger sums what is owed per authority. Verified fees to add as regions open: JFK, LGA and
EWR $3.50 per pickup and per drop-off (Port Authority 2026 budget), LAX $4.00 each way,
Chicago's ground transportation tax $1.13 a ride plus $5.00 at O'Hare and Midway, New York's
$2.75 congestion surcharge and 2.25% Black Car Fund, Seattle $0.42, Portland $0.76,
Massachusetts $0.20, California's $0.10 access fee and 0.1% of revenue, the District's 6% of
gross receipts. Fort Lauderdale ($3.00), Palm Beach ($3.50), Orlando ($7.00) and Tampa
($5.00) are reported by secondary sources and go in once the tariff documents are read.
Permits: MIA and PortMiami each require a company permit before pickups; that is Adrian's
action, with the documents named in the registry. Tolls: the router knows tolled roads; a
toll pass-through follows the same line design once the fare has a time term.

**Hosting.** The tables Chad received priced Netlify, Supabase and an "AI planner". The
planner was withdrawn on 4 September; its screen was already out of the router, and its
server route now answers 410 Gone. Web hosting: Expo's EAS Hosting today (100,000 requests
included, $2 per million after); Cloudflare Pages is free with no bandwidth cap and is the
cost-effective home for the static web build when the founders want to move it. Server:
Render Standard ($25) for the test program; Fly.io or DigitalOcean at $22–$96 a machine
when scaling. Database: keep Firebase Auth and Firestore for accounts and travel records
through the test program; move Operator presence and matching to a geo-indexed store before
the fleet reaches the low thousands — Upstash Redis with GEOSEARCH ($0.20 per 100,000
commands) or Supabase Postgres with PostGIS ($25 a month, Pro), the latter being the
long-term system of record. That migration is the one infrastructure project with a
deadline, and it is set by fleet size, not by revenue.

**Transit-only journeys.** When both ends of a journey are within walking distance of
transit, the plan has no car leg. It is shown, priced at the transit fare, with the note
"This journey needs no car travel" and nothing to reserve. Chad's answer of 10 September:
that is fine. It stays.

**Built, tested, and seen.** Five commits on the branch. Seen on the iPhone 17 simulator,
signed in, in Spanish, against the local backend and planner: Home, Destination, Travel
Options with the Smart Travel card, the Smart Travel screen, and Travel Confirmation for the
first car leg. Found and fixed from those screenshots: class names, the Continue button,
"from", "Pickup" and "Destination" in English inside Spanish screens; "paid at the station"
on a bus journey. Still open from the screenshots: sixteen dates formatted in US English
regardless of language; the section label scrolls under the status bar on long screens.

