# ADR 0001 — One phone-first national operations engine

**Status:** Accepted founder requirements; verified implementation with further delegated-command work pending. **Recorded:** 2026-10-10.

## Context
A one-person transportation network cannot require monthly manual reviews per Operator, separate software per state, or county-by-county admin toil. National scope introduces different statutes, contracts, provider capabilities, tariffs and geographic boundaries.

## Decision
Operate from the founder's iPhone/iPad with one shared server-side qualification and market-admission engine. Select versioned jurisdiction policies from authoritative Operator/Travel geography. Reuse statewide evidence where actually applicable. Use deterministic checks and low-cost existing infrastructure; intervene on exceptions. Unknown legal/provider jurisdictions fail closed. Expansion planning is distinct from readiness and commercial activation. The founder previously authorized the South Florida tri-county opening **when** requirements are proven; no repeated business permission needed. Consequential commands require authenticated, auditable founder authority, not GitHub edits as a shortcut.

## Consequences
Reusable national architecture, less manual administration; real external provider/legislative evidence remains necessary. A future chat-command interface can call existing authenticated activation but cannot create evidence. Never add a paid provider merely for convenience without comparing a free/lowest-cost lawful alternative.

**Implementation:** `backend/regions.js`, `backend/markets.js`, `backend/market-readiness.js`, `backend/market-expansion.js`, `backend/qualification.js`. **Unfinished:** [issue #86](https://github.com/chadkhalil21-svg/American-Rider/issues/86), [#88](https://github.com/chadkhalil21-svg/American-Rider/issues/88).

**Guidance:** [Google SRE eliminating toil](https://sre.google/sre-book/eliminating-toil/); [GOV.UK cost-effective service design](https://www.gov.uk/service-manual/service-standard/point-11-choose-the-right-tools-and-technology).