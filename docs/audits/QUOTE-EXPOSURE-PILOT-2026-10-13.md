# Pricing: visible quote to prepared booking — 13 October 2026

**Status: dark research pilot, OFF by default.** This work neither changes a fare nor authorizes any paid Travel, experiment or external supplier.

## Verified gap
`/fare-quote` has multiple callers, including background refresh and signed-out location search. A server quote is NOT necessarily a price a person saw. Existing `/travel/prepare` already records real server-calculated price and Travel status, but cannot supply the missing quote-view denominator. PR #171 added truthful prepared booking reports, not a conversion claim.

## Published institutional basis, reviewed before the candidate
- Google [Firestore best practices](https://firebase.google.com/docs/firestore/best-practices): random identifiers, bounded reads, minimal indexes/transactions. Google [TTL guidance](https://firebase.google.com/docs/firestore/ttl): storing `expiresAt` alone DOES NOT switch on deletion. Admin must configure TTL for `pricing_quote_views` and verify retention before enabling.
- Amazon [Idempotent API retries](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/): the same signed quote-view ID uses a create-only write; repeats return duplicate, never a second impression.
- NASA [SWE-055 requirements validation](https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695440/SWE-055%2B-%2BRequirements%2BValidation): source inspection and synthetic tests are not a real-iPhone/Android network interruption or money test.
- Stanford GSB [Marketplace interference research](https://www.gsb.stanford.edu/faculty-research/publications/interference-bias-variance-two-sided-marketplace-experimentation): observing a booking does not establish that price caused it; future pricing experiments must account for operator/traveler interference.
- Council: Ford reliability/scale, Rockefeller unit economics, Jobs simple user flow, service/design literature, operational transportation standards. These are **published reference lenses**, not direct conversations or endorsements.

## Implemented candidate
1. The authenticated standard, county-routed `/fare-quote` response may carry a random signed quote token. No database write or extra read occurs on quote computation.
2. Only when the correct standard fare is visible on the focused confirmation sheet does the mobile app best-effort post a view. No UI delay; an unavailable research endpoint NEVER prevents a Travel. Anonymous or Smart Travel are intentionally excluded.
3. Research-only server route uses Firebase authentication, per-account limit, short token expiry, identity-locked signature and a create-only Firestore record. No precise coordinates, labels, raw user ID, payment instrument, or token are stored. Stored: county ID, coarse mileage group, total shown, timestamp, expiry, optional prepared Travel ID. **The latter is linkable to personal account records**; it is NOT anonymous.
4. A later idempotent, server-repriced standard prepared booking can link only if the amount/county/distance band and identity-bound signature agree. It cannot change fare, policy, settlement or dispatch. If any research read fails, booking continues.
5. Founder-only `/ops/pricing-research` performs at most 120 document reads **only when opened**; it excludes views younger than one hour and explicitly does not call this paid conversion or causality. 120-record samples may be nonrepresentative.
6. Four fail-closed environment conditions: `PRICE_VIEWS_PILOT=1`, `PRICE_VIEWS_PRIVACY_OK=1`, `PRICE_VIEWS_TTL_READY=1`, isolated `PRICE_VIEWS_KEY` of at least 32 characters. All are intentionally UNSET. No user data collection commissioned by this PR.

## Validation and limits
Two-pass 20,000-case offline synthetic token/identity/expiry/market/amount test, duplicate-create test, link conflict test and bounded read test. Require six exact-HEAD GitHub checks before merge, six post-merge checks and exact SHA verified on Render. **Not yet validated on actual devices or with live users.** Pilot activation still requires documented lawful processing/notice, accessible opt-out or other applicable controls, research-record account deletion/retention review, actual Firestore TTL setup verification, abuse/cost monitoring and signed-in standard-fare screen walkthrough.

## Pricing roadmap
Gather genuine local quotes from a lawful independent source as allowed. Observe our own visible quotes and eventual paid/completed outcomes in a privacy-reviewed sample, not just prepared bookings. Use historical/voluntary external evidence only for independent cross-check; do not use self-reports to publish automatic fares. Maintain existing economic floors and no unauthorized price promotion.
