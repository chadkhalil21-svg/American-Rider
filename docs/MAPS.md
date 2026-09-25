# American Rider — Maps and Routing

Plain English: a "map license" is **not** a legal thing and needs **no lawyer**. It's just
signing up for a maps company (free), getting an **API key** (a password-like code), putting
a card on file, and pasting the key into the app. Billed by usage, like an electric meter.

## The 4 pieces a rideshare app needs (one provider = all of them, one key)
1. **The map** — the streets the rider/operator sees (map tiles).
2. **Directions / routing** — turn-by-turn for the operator (Navigation / Routes API).
3. **Address search** — autocomplete when a rider types a destination (Places autocomplete).
4. **Distance + time** — to compute the fare and ETA (Distance Matrix / Route Matrix).

## Provider options
| Provider | Best for | Cost feel |
|---|---|---|
| **Google Maps Platform** | Best traffic + transit data — matters for Smart Travel + predictive traffic. Chad's rec. | Monthly free credit, then pay-per-SKU; priciest at scale. Minimize map calls. |
| **Mapbox** | Lean start — generous free tier (~50k map loads/mo), developer-friendly | Cheapest to begin |
| **Apple Maps (MapKit)** | Free, but iPhone-only | Free |
| OpenStreetMap + tile host | Cheapest/DIY, more work | ~Free data, you host |

**Current decision:** keep **MapLibre** as American Rider's visual renderer on iOS and Android.
The visual map is deliberately independent of the routing and traffic providers. Baseline street
routing is OSRM using OpenStreetMap-derived data, with OpenTripPlanner for multimodal/transit
planning. A commercial traffic feed is optional and server-side; Mapbox driving-traffic is the
first supported provider. If it is absent or unavailable, Travel falls back to OSRM/OTP.

Do not use the public OpenStreetMap tile servers as American Rider's production CDN. OpenStreetMap
data is open; the community-operated public tile service is not our infrastructure. At scale,
use a production tile service or American Rider-controlled tile delivery while retaining MapLibre.

## Cost reality (the reassuring part)
- **Launch / pilot (small volume): effectively free** — Google's monthly free credit and
  Mapbox's free tier both cover a handful of drivers doing real rides.
- **At scale: a real but small line item** — exactly what the **1% commission and the platform fee are designed to
  cover** (maps are a platform operating cost, like server hosting). Optimize by caching and
  minimizing unnecessary map/route calls (Google bills per SKU).

## Where it fits
**Stage 1 backend work.** Getting the key is a ~15-minute signup, not a project. The mobile application consumes American Rider route geometry rather than a provider-specific
route object. Provider credentials stay on the server. This lets traffic intelligence, routing,
and tile delivery evolve independently without changing the first-class MapLibre presentation.
