# American Rider — Maps (Stage 1 build note)

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

**Recommendation:** because the differentiators (predictive traffic, Metrorail stitching in
Smart Travel) lean on rich traffic/transit data, **Google Maps Platform** is the strongest fit
and is Chad's stack pick. If keeping early costs rock-bottom matters more, **start on Mapbox**
and switch later — the app abstracts the provider so swapping is cheap if done cleanly.

## Cost reality (the reassuring part)
- **Launch / pilot (small volume): effectively free** — Google's monthly free credit and
  Mapbox's free tier both cover a handful of drivers doing real rides.
- **At scale: a real but small line item** — exactly what the **1% commission and the platform fee are designed to
  cover** (maps are a platform operating cost, like server hosting). Optimize by caching and
  minimizing unnecessary map/route calls (Google bills per SKU).

## Where it fits
**Stage 1 backend work.** Getting the key is a ~15-minute signup, not a project. The current
**demo uses a hand-drawn vector map on purpose** — no key, no cost, works offline. Plug in a
real provider when the backend is built (alongside Stripe, GPS, accounts).
