# October 13 — Actual Traveler Total verification

Founder requirement: competitive nationwide pricing based on real matched local market evidence. The existing low Florida formula is a fallback, not an ideal commercial rate. The national comparison engine is built but a real current market quote feed is still missing. No price change is approved by this audit.

## Source defect
The backend already returns the full Total (`travelerPays`) including selected vehicle class, payment fee, tolls and government charges. The app previously disregarded it and reconstructed a lower or different amount locally; when a pickup moved, a class could be applied again. That is a real discrepancy risk between display and payment.

## Repair in PR #176
Use the backend Total in cents on all screens. Only print the currently selected class after the server quotes that class. On a route or class change, request another price. Have the booking server independently recompute the Total and reject a different amount *before* charging; return the Traveler to review. Existing 99%-of-Travel-Fare Operator proceeds and dynamic fee protections remain unchanged. Older app builds that omit accepted Total require separate device compatibility review.

## Sources and acceptance
[Stripe PaymentIntents](https://docs.stripe.com/api/payment_intents) uses integer cents; [Amazon safe API retries](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) stresses retry consistency; [NASA SWE-055](https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695440/SWE-055%2B-%2BRequirements%2BValidation) requires verification in actual operating conditions. Zero new Firestore queries, data collection, or external API calls. The automated tests simulate 20,000 economic examples in two passes, plus pass-throughs, domestic/foreign cards, an approved higher market target and split accounting. Still require real-device TestFlight validation and matching sandbox Stripe amounts.

Directional February 2026 estimates: [Miami](https://taxifare.org/us/miami) ~$27.73 for ~8mi/21min against our no-pass-through formula ~$13.45; [Cutler Bay](https://taxifare.org/us/cutler-bay) ~$30.74 for ~8.5mi/22min against ~$14.03; [FLL](https://taxifare.org/us/fll) ~$40.84 for ~16mi/33min against ~$22.05; [PBI](https://taxifare.org/us/pbi) ~$32.35 for ~13mi/22min against ~$17.85. These comparisons use a single third-party estimate provider, not exact route/date/class-matched quotes, and airport extras are excluded from our formula. They indicate risk of underpricing but cannot themselves authorize revised production fares.

Next: obtain authorized actual comparable consumer Totals in each county and proposed national market, compare actual route/time/class conditions, simulate calibrated prices and get founder approval before changing rates. Do not build more pricing research infrastructure as a substitute.
