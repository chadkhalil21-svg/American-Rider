# American Rider — a concrete, no-supplier South Florida starting-price proposal
**13 October 2026 | Research-only PR; no active fare or paid passenger changed**

## The decision in plain English
Published local no-surge estimates indicate the current South Florida fare formula is materially cheaper than other leading platforms in routine journeys. The founder's objective is competitive pricing, **not 30% discounts**. We can choose a specific, no-API starting candidate, but must not present estimates as actual checked live prices, nor imply that 99% of Fare ensures good *shift-level* Operator earnings.

**Exact proposal for STANDARD, before separately verified tolls or government fees:**
- Base **$1.00**
- **$0.95 per road mile**
- **$0.32 per routed minute**
- Existing **$3 minimum Fare** and the dynamically sufficient **minimum $2.50 Platform Fee** remain; 99% of Fare to Operator, full tolls and government fees passed through, no new market permissions or payment changes.
- Three existing launch counties share the same Miami–Fort Lauderdale–West Palm Beach metro wage series, but route and supply outcomes must eventually justify county-level calibration; never assume prices elsewhere in the country.

**Transparent example, domestic-card, no toll or government fee:**

| Ordinary routed Travel | Existing all-in Traveler Total | Candidate all-in Total | Candidate Operator Fare proceeds |
| --- | ---: | ---: | ---: |
| 3 road miles / 10 minutes | $7.55 | $9.55 | $6.98 |
| 5 road miles / 15 minutes | $10.00 | $13.05 | $10.45 |
| 8 road miles / 21 minutes | $13.45 | $17.82 | $15.17 |
| 10 road miles / 25 minutes | $15.75 | $21.00 | $18.32 |

All totals are mathematical scenarios under the existing fee solver. Actual routed miles, minutes, vehicle class, different card costs, government fees, tolls, Smart Travel and promotions can change a quote. No airport/port passage is assumed authorized.

## Why this is a defensible *candidate*, not proven commercial optimization
- [Published independent RideWise comparison](https://getridewise.com/compare) identifies June 2026 estimated, non-surge ordinary full customer totals of about **$20.15–$21.20** for a 10mi/25min Miami example (pre-toll/airport/tip). The candidate **$21.00** lies within this modeled range. Its 5mi/15min rate cards also suggest around $12–$13 and the candidate is $13.05. But these are **rate-card estimates**, not actual verified contemporaneous offered prices; later publisher updates conflict with some earlier pages. Do not import vendor tables to a commercial data feed without rights.
- [Miami-Dade's official taxi resolution](https://www.miamidade.gov/govaction/matter.asp?file=true&fileAnalysis=false&matter=221434&yearFolder=Y2022) fixes a **5-mile meter-only** local standard taxi reference of **$20.40 before waiting or tips** under its regulated maximum tariff. Taxicabs are a different service and cannot be substituted as TNC market quotes, but they provide public, licensed-free context. Conflicting older website blurbs of $0.40 versus current $0.55 per additional sixth mile must not be copied without checking this legal resolution.
- The [Bureau of Labor Statistics' May 2025 national taxi driver median](https://www.bls.gov/ooh/transportation-and-material-moving/taxi-drivers-and-chauffeurs.htm) is **$42,100/year**, equivalent to $20.24/hour if divided by 2,080 hours; OEWS employee wage is an **occupation comparator**, NOT actual self-employed driver take-home. BLS metro statistics [Miami–Fort Lauderdale–West Palm Beach](https://www.bls.gov/regions/southeast/news-release/occupationalemploymentandwages_miami.htm) span all three initial counties; do not present a national number as measured individual local Operator compensation.
- [IRS published July–December 2026 standard business mileage rate](https://www.irs.gov/tax-professionals/standard-mileage-rates) of **$0.76/mile** can serve as a *sensitivity proxy* for total vehicle burden. It is not the actual marginal expense, and insurance for TNC/livery may differ. For 10 paid miles/25 min, 20% extra empty miles and that proxy, the Operator's hypothetical remaining amount is **$9.20 after vehicle allowance**, or **$22.08 per passenger-carrying hour**. At only 65% occupied duty time it would be ~**$14.35 per on-duty hour**, before any excluded business costs, tax and insurance delta; cannot claim $20/hour all shift from this quote.
- [UC Berkeley's shift-based study](https://laborcenter.berkeley.edu/gig-passenger-and-delivery-driver-pay-in-five-metro-areas/) finds unpaid time and vehicle expenses crucial to real earnings. Ergo: control market-entry supply and pickup burden, give realistic pickup ETAs and route matching, improve completed Travels per Operator-hour, and measure actual Operator earnings. Do NOT pretend 99% share alone resolves idle time.
- [Stanford GSB's spatial pricing research](https://www.gsb.stanford.edu/faculty-research/publications/spatial-pricing-ridesharing-networks) and [Columbia's iterative network-pricing research](https://arxiv.org/abs/2311.08392) emphasize origin/destination supply and learning from **real** outcomes. Do not enable experimental weekly changes until sufficient actual quote impressions, cancellations, dispatch acceptance, and completed Travels exist.

**Council perspectives, not personal endorsements:** Ford—standardized route- and time-based Fare without extra research services. Rockefeller—economic viability and 99% split verified, not artificial volume. Jobs—one accurate, stable all-in Traveler Total.

## What this does and does not authorize

* Test the exact 3/5/8/10/20 mile candidate, international card and fees, split, driver sensitivity, emergency/outage and route failure, and synthetic 10K/100K/1M scaling twice under existing CI. Use already deployed pricing infrastructure, no new checkout or source collector.
* Do **NOT** merge a live change to `backend/market-pricing.js` just because simulated arithmetic agrees; confirming public median and fresh real observed prices for three counties, Operator actual livery and insurance cost, live TestFlight payment-consent compatibility, physical routing, protected-facility legal clearance, and founder's approval of new money amounts remain release gates.
* A cost-sustainable fully paid **shift** for an Operator with 35% utilization can require **far higher per-trip fares** than ordinary competing options permit. Fleet utilization/demand is a business problem, not a reason to multiply customer prices arbitrarily. No platform should claim profitable trips or sustainable shift earnings without data.

**Release mechanism when approved:** One code change to the single existing Florida pricing record from (100,85,15) to (100,95,32), no new frameworks. The same server function already recomputes actual Fare when booking and verifies agreed Total, subject to old-client caveat. Run all six exact-head campaigns and real paid-route/physical-device acceptance before live release. National expansion still requires a state-specific pricing record, wage/insurance/permit compliance and explicit market admission.
