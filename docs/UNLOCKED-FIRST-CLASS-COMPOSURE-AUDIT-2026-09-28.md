# Unlocked-Surface First-Class Composure Audit — 28 September 2026

## Scope and lock boundary
The founder-approved surfaces in `docs/APPROVED-UI-BASELINES.md` are excluded from visual/copy modification. This pass covers the remaining reachable application surfaces and shared experience around them. Locked baselines remain the authority for Front Door, Sign In, Create Account, authentication recovery, Home / Arrange Travel, drawer, Profile / Account Details / Saved Places / Cabin Environment / Traveler Safety, Sign-in & Security, Operator Screening, and Operator Qualification / Commissioning.

## Decision rubric
Every unlocked surface is judged by three primary questions:
1. Does the mark and hierarchy feel assured rather than oversized?
2. Do controls feel refined rather than heavy?
3. Does the screen read as one calm composition rather than stacked components?

Secondary requirements: selective richness rather than indiscriminate subtraction; restrained warmth; useful language; formal but human ownership; familiar platform patterns; accessible sizing and hit areas; provider-brand compliance; authoritative money/safety/legal language; accent color reserved for genuine navigation, choice or status.

## Verified external guidance
- Apple HIG Branding (Sep. 2026): distinct voice/tone; judicious accent color; familiar components; branding defers to content; system/body fonts favor legibility.
- Apple HIG Layout / Buttons: adaptable safe-area layout and Dynamic Type; minimum usable hit regions; distinguish preferred actions by style rather than arbitrary size; limit prominent actions.
- Apple account guidance: explain account value briefly and use accurate provider/authentication terminology.
- HBS service-design guidance: curate rather than indiscriminately augment; minimize friction while preserving elements that create service value; design for emotional as well as functional needs.
- Stanford d.school: care, service, human-centered observation, experimentation and strategic guardrails.

These sources are guidance, not endorsements of American Rider.

## Screen inventory — unlocked surfaces reviewed
Traveler/support system: Not Found; Travel Complete; Delete Account terminal flow; Operate / economics explainer; Emergency Assistance; Family; Family Travel; Travel History; Invite; Patron Support / Issues; Language; Lost Item; Travel messaging; Notifications; pickup-map iOS/fallback; Receipt; Travel Confirmation / Reserve; Live Travel; Schedule Travel; Smart Travel; Wallet; Settings where not governed by an approved account baseline.

Operator system outside approved Screening and Qualification / Commissioning: Commissioned; Communications; Travel Complete; Guidelines; Institutional Inbox; Operations; Pickup; Operator Profile presentation outside locked qualification facts; Revenue; Support; active Travel; Vehicle presentation; Withdrawal.

## Findings and applied direction
### Scale and proportion
The principal outliers were legacy display/status sizes of 26–32 pt on operational screens. These made ordinary state screens read like promotional landing pages. Reduced only the unlocked outliers: Operator Operations 32→28; Live Travel 22→20 and 23→21; Schedule confirmation 26→23; Operator Commissioned / Complete / Revenue 26→23; Pickup 22→20; Vehicle / Withdrawal 27→23. Body text and touch targets are not reduced.

### Color
The existing `colors.accent = #36516F` is the correct restrained slate-navy direction. Do not globally recolor the product or remove color. Keep electric legacy blue from expanding; use the slate-navy deliberately for navigation/choice where a screen is subsequently touched. Green remains success/positive status; red remains consequential error/safety; neutral ink carries ordinary hierarchy.

### Language and hospitality
Revised unlocked English recovery/service copy away from terse system language and toward calm ownership: dispatch unavailability, delayed matching, scheduling after a time has passed, lost-item return failures, empty Travel history, Operator ready-state language, and Operator Support. The same semantic refinements are carried into ES/FR/IT/DE so the supported-language experience does not split into different service registers.

### What is deliberately not softened
Emergency instructions, safety controls, statutory/insurance requirements, payment truth, cancellation consequences, provider-authentication labels and qualification failures remain direct. First Class cannot trade clarity for ceremony.

## Screen-level disposition
- **Live Travel / matching:** refine hierarchy and recovery language; preserve strong state visibility, safety and cancellation authority.
- **Schedule Travel:** reduce confirmation-display dominance; preserve calendar/touch sizing; make expired-time recovery polite and actionable.
- **Operator Operations:** reduce promotional display scale; replace commission-like “commence operations” tone with account-ready hospitality; preserve duty authority.
- **Operator Pickup / active Travel / completion:** reduce oversized status headings where present; preserve route/identity/payment prominence.
- **Operator Revenue / Withdrawal / Vehicle:** reduce oversized display treatment; retain numerical clarity and provider truth.
- **Patron/Operator Support:** use ownership language (“a member of our team will take care of…”) without promising outcomes the record cannot support.
- **Lost Item:** preserve useful detail and status ladder; improve return/retry ownership rather than deleting explanatory context.
- **Emergency:** retain direct 911-first hierarchy and location/Travel facts; no luxury euphemism.
- **Smart Travel:** retain explanatory richness because multiple transport legs and separate charges require context; no fabricated transit certainty.
- **Receipt / Wallet / History:** preserve documentary calm; empty states explain what will appear rather than sounding like errors.
- **Notifications / Language / Invite / Family:** retain familiar list/form patterns; avoid ornamental brand repetition.
- **Not Found:** brand context is acceptable because the route has lost normal navigation context; no additional logo furniture.
- **Maps:** route/pickup controls remain utilitarian and subordinate to the Travel decision; provider branding/attribution must not be obscured where required.

## Final council check
Ford lens: remove friction, not information that prevents a mistake.
Rockefeller lens: authority and trust must remain visible where consequences exist.
Jobs lens: the person sees the decision and outcome, not implementation plumbing.
First-Class lens: the interface should feel attended to. Calm language, precise hierarchy, useful reassurance and dignified recovery are service features.

The desired result is not minimalism; it is composure. Not brevity; economy. Not coldness; restrained warmth. Not luxury decoration; quiet authority.
