# American Rider — Provider-Neutral Screening Commissioning and National Market Expansion

**Baseline:** release/current at `bac9095dcfbe5cbd4a1c317384178a7fbf297f9b`, 10 October 2026.

## Already completed — do not reconstruct

- National U.S. jurisdiction **identity** list: 50 states, D.C. and five territories (`backend/jurisdictions/us.json`).
- Actual imported county boundaries: `backend/markets/fl-counties.json`; Florida counties beyond South Florida exist geographically but do **not** have configured service regions.
- South Florida: Miami-Dade, Broward and Palm Beach are geographic candidates in `backend/regions.js`, but not commercially commissioned merely by being in the source list.
- Commercial market evidence, versioned approval, pause, and fail-closed Stripe/qualification/dispatch gates: `backend/market-readiness.js`, `backend/server.js`, `backend/market-fleet.js`.
- Provider-neutral Operator screening request, contact/consent, authenticated CRA handoff, review, adverse process, expiry/renewal warnings and dispatch enforcement: `backend/screening*.js`, `backend/external-screening*.js`, `backend/qualification.js`, `backend/ops.js`.

## New: plan any state without opening Travel

In **Operations → Market readiness → Plan another market**, the founder can:
- Select any U.S. state or listed territory.
- Select an **imported** county for that state, if available. All imported Florida counties are selectable, not just three. A city can be named as a focus of that county's plan, not as an unsupported separate statutory jurisdiction.
- Propose an entire state when official county geometry has not yet been imported (e.g. California or Texas). For city-level staging in such a state, import the applicable U.S. Census county boundary first.
- View existing plans without duplicating a new entry every time the same county is proposed.

`backend/market-expansion.js` stores plans exclusively in `market_expansion_plans`. **It cannot write `market_admission`, alter `MARKET_STATUS`, add state screening/insurance rules, enable a service region, qualify an Operator, or take a fare.** The UI deliberately labels the state as *Proposed — not commissioned*.

The production market-admission gates remain the authoritative mechanism. Moving a plan to service requires: verified county geography, a jurisdiction-specific screening and insurance policy, lawful coverage and permits, pricing/routing/toll rules, payment reconciliation, accessibility and device tests, applicable airport/port requirements, independently reviewed evidence, and explicit owner activation. Another Florida county reuses valid Florida statewide legal/insurance/screening arrangements **where their actual terms permit**, not the South Florida regional evidence blindly. Cities are usually geospatial subareas of their counties in the Florida market framework; special destinations and facilities can still require separate policy and fees. Never invent authority for a city simply because its county is planned.

## Insurance decision — verified prior work vs unresolved contract

The settled policy is that Operators procure qualifying insurance, American Rider requires authoritative verification and automatically blocks expired/lapsed/insufficient coverage. These controls have already been built, tested and must not be reconstructed.

The distinct **unverified** question is the actual TNC-maintained fallback in Fla. Stat. §627.748(7)(d), if driver coverage lapses or does not provide required coverage, and its duty to defend. Florida law also requires biennial independent CPA examination under §627.748(12)(e). These obligations were **previously identified** in the project and cannot be solved by checking a box or claiming software blocks a lapse. This change does not alter the founder's Operator-pays-first preference. It also does not remove lawful platform obligations or claim an unverified policy has been bound. The affordable lawful arrangement requires actual insurer/broker terms and Florida counsel verification.

Source: [2026 Florida statute, official legislature](https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0600-0699/0627/Sections/0627.748.html).

## Screening commissioning without exclusive vendor or speculative expense

1. An Operator may identify a qualified CRA; American Rider **does not prescribe an exclusive vendor** or purchase a report automatically.
2. The Operator's declaration is **not a clearance**; existing reports may not be simply reused for a new purpose/recipient.
3. An authorized, independently identified CRA must be willing to furnish a Florida-compliant report to American Rider for its lawful purpose, with relevant disclosure/authorization, business credentialing and an authenticated portal or secure delivery method.
4. The existing Operations review and case audit are the **manual fallback and first pilot path**. This works without a custom vendor API but still requires a person to verify the external report.
5. **Routine automated qualification cannot be commissioned merely by code:** the eventual input must be a mutually supported, authenticated structured result with proven permissible purpose, completeness, Operator match, freshness and state-specific rules. The state-specific evaluator may auto-clear only genuinely verified and legally approved all-clear results, while mismatched/incomplete/ambiguous/adverse cases go to an exception or legally required notice/dispute workflow. A universal free signed feed from *every* arbitrary CRA does not exist as a proven dependency here.
6. Do not build a new paid AI adjudicator or proprietary integration by default. Use the existing Firestore and hosting, normalize supplier messages behind an adapter **only when a participating CRA provides a supported method**, and protect consumer reports outside general Firestore/support email. No purchase or new subscription has been commissioned by this PR.

Sources: [FTC consumer-report obligations](https://www.ftc.gov/business-guidance/resources/using-consumer-reports-what-employers-need-know), [FTC prohibition on reused purpose](https://www.ftc.gov/business-guidance/blog/2017/02/background-checks-dont-double-dip), [CFPB permissible purpose](https://www.consumerfinance.gov/rules-policy/final-rules/fair-credit-reporting-permissible-purposes-for-furnishing-using-and-obtaining-consumer-reports/).

## Design and efficiency rubric

The Council is **a comparative guidance framework**, not an actual advisory board: Ford (standardization), Rockefeller (unit economics), Jobs/Apple (clarity), plus leading business schools, design firms, safety institutions and hospitality service standards. Current public guidance used here includes [GOV.UK service ownership and reuse](https://www.gov.uk/government/publications/government-functional-standard-govs-005-digital/government-functional-standard-govs-005-digital-html), [Nielsen Norman Group service blueprints](https://www.nngroup.com/articles/service-blueprints-definition/) and [Apple's Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines). The principle is one complete national workflow with different configured jurisdiction rules and no duplicate per-county app or agreement when actual coverage is statewide.

### Evidence of completion vs launch

- **Code/CI/Render**: verify exact SHA after PR merge.
- **Expansion plans**: stored and viewable; **not authorization**.
- **Real partner evidence**: must come from actual CRA/broker/authority; cannot be supplied by repository tests.
- **Commercial activation**: only through existing versioned market-readiness checks, with no manual falsification.
