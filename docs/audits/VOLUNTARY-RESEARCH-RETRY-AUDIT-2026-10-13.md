# Research intake and launch evidence audit — 2026-10-13

Baseline: PR #167 merged at `efbf286996ddf123957461dccab2527ac6532b66`. This is a targeted follow-up, not a declaration that every American Rider flow has passed physical-device testing.

## Primary institutional sources (research BEFORE repair)
- Amazon Builders Library, [making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/): uncertain outcomes must reuse the identical request ID and body; edits represent a new intent.
- [Google Firestore best practices](https://firebase.google.com/docs/firestore/best-practices) and [pricing](https://cloud.google.com/firestore/pricing): bound queries; minimize replays and reads; account for index costs; avoid false national-scale claims.
- [NASA SWE-055](https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695440/SWE-055%2B-%2BRequirements%2BValidation): demonstrate intended and adverse behavior in the real operating environment; synthetic tests alone are incomplete.
- [NIST SSDF](https://csrc.nist.gov/pubs/sp/800/218/final), [OWASP MASVS-PRIVACY](https://mas.owasp.org/MASVS/controls/MASVS-PRIVACY-1/) and [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/design-principles/): privacy minimization, secure errors, accessibility, recovery.
- [Florida Statutes 627.748](https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0600-0699/0627/Sections/0627.748.html): receipt obligations do not eliminate commercial data permissions or insurance obligations.
- `docs/COUNCIL-STANDARDS.md` applies Ford scale, Rockefeller economics, Jobs product coherence, published university service research and first-class hospitality as conceptual lenses—not personal endorsements.

## Direct code findings
1. Real retry bug: `market-research.tsx` regenerated `observedAt` on every press while retaining `observationId`. If an earlier write succeeded but the reply timed out, a subsequent attempt could receive a 409 conflict under the backend's correctly strict same-ID/different-payload rule.
2. React disabled-state only is not an atomic guard against a same-tick double tap.
3. The new screen used global `t` instead of subscribing to `LanguageContext`; backend error strings could be displayed verbatim to users.
4. **Unfixed launch privacy gate:** `backend/accountdeletion.js` removes the Firebase identity and `users` document without purging the new `market_price_research_submissions` pseudonymous records. Decide lawful data retention, user withdrawal, deletion and safe bounded cleanup before wide recruitment.
5. **Unfixed national cost gate:** `backend/monitor.js` reads every active Travel on each 60-second sweep. 10,000 continuously active Travels imply at least 14.4M returned-document reads per day; 1M implies 1.44B, before index costs or other work. Paging avoids omission but not enormous billing. Do not simply cap safety scans; design and verify event/due-time equivalence first.
6. **External blockers:** Issue #164 remains open for rights-cleared local market observations and independent holdout validation. Company insurance legal/evidence gate, real app-device tests, live market admission and current deployment revision must be separately verified.

## Candidate correction (no fare/promotional changes)
Keep the same canonical request after uncertain delivery; use a different ID for an edited observation, lock duplicate taps synchronously, reset consent after acknowledged submission, render error states in the currently selected language and do not reflect arbitrary backend strings. Add an additional 20,000-case synthetic client replay/edit regression (2 x 10,000), then require **six exact-HEAD green CI checks** before PR merge. Confirm live Render SHA separately. The existing backend 30,000-case synthetic validation remains independent; no real receipts, passengers, payment or supplier subscriptions touched.

## Independent acceptance needed after CI
Real iOS/Android interrupted-connectivity replay, screen-reader and language-switch walkthrough; verified GDPR/Florida/state privacy obligations for contributor data; exact live server revision; least-privilege Firebase research storage; commercially licensed or consented, representative current South Florida observations; economic holdout before any rate promotion. Never claim complete national certification from an offline synthetic suite.
