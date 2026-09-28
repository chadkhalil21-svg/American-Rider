# Final semantic current-state audit — 27 September 2026

## Baseline and method

This audit started from `release/current` at
`e993334b2b36851c2bd2b94ee13df92769e8b9b2`. The working branch is
`audit/final-semantic-current-state-2026-09-27`.

The review treated current code, executable tests, current decision records and the approved
baseline as authority. Older branches and PRs were evidence only. The review traced the Front
Door, authentication and recovery, account security and deletion, Traveler and Operator account
surfaces, qualification and screening, jurisdiction and insurance, duty and payout gates, fare
and settlement authority, immediate and scheduled dispatch, Smart Travel, Family/Teen Travel,
messaging and notifications, support, privacy, CORS, abuse controls, provider queues, background
presence, accessibility, localization, release evidence and generated website documents.

## Corrections made

1. **Stale public pricing formula.** The canonical economics engine uses the minimum whole-cent
   cost-funded Platform Fee. The Spanish, French, Italian and German Terms still published the
   retired `$1.50 or 5%` formula. The checked-in static English Terms and About pages also still
   contained that formula because they had not been regenerated. The translations now preserve
   the one-Total promise without publishing internal pricing arithmetic. The static legal site
   is regenerated from the server source. Tests now reject the retired formula in every language
   and reject drift between the server and static Terms/About documents.
2. **Stale current documentation.** Product, V1, launch, game-plan and backend overview documents
   still described the retired formula as current. They now point to `backend/economics.js` as
   the commercial fee authority. Historical analyses remain available only where they are
   expressly marked superseded.
3. **Profile information architecture.** The Profile implementation already omitted the 99%
   Operator proposition, but `AGENTS.md` and `docs/OPEN-DECISIONS.md` still instructed or implied
   that it belonged there. Both now record the latest decision: an ordinary Profile contains
   account information, not commercial promotion. A release invariant now prevents the 99%
   proposition or coordination commission from returning to `app/profile.tsx`.
4. **Stale release-history statements.** The evidence guide still described PR #7 as awaiting a
   merge, and the earlier audit result said it was not merged. Both now describe the consolidated
   baseline without instructing work on an obsolete PR state.
5. **Misleading internal fee comment.** The Operator Inbox client comment still described the
   5% schedule as current. It now states that the current fee varies with modeled transaction
   costs and that a historical flat subtraction is not authoritative.

## Semantic audit result by area

| Area | Result | Current-state finding |
| --- | --- | --- |
| Front Door, Sign In, Create Account, recovery and Account Security | TEST VERIFIED | Current role selection and authentication boundaries are present. Recovery is real, and deletion has provider-specific reauthentication tests. No obsolete prototype-only success path was found. |
| Home, drawer, Profile and subscreens | TEST VERIFIED after correction | Navigation and Profile contain account functions. The stale documentation that placed the 99% proposition on Profile is corrected and guarded. |
| Traveler and Operator account architecture | TEST VERIFIED | Roles share identity but retain separate authorized surfaces. The client does not commission or qualify an Operator. |
| Screening, qualification, commissioning, insurance and jurisdiction | TEST VERIFIED; EXTERNAL EVIDENCE REQUIRED | Server gates are jurisdiction-aware and fail closed for unknown, incomplete, expired, held or adverse states. No Florida fallback or manual destination-county authority was found. Florida legal, broker and insurance evidence is not created by this audit. |
| Duty, presence and payout readiness | TEST VERIFIED; PHYSICAL DEVICE EVIDENCE REQUIRED | Server duty and assignment gates recheck current account, disclosure, screening, insurance, payout and presence state. Stale presence is not dispatchable. Background behavior still requires the defined device campaign. |
| Fare authority, Stripe, Traveler Total, tolls and settlement | TEST VERIFIED after correction | The server owns fare and payment transitions. Stripe processes the result; it does not set policy. The Operator receives 99% of Travel Fare plus whole toll reimbursement. Travelers see one Total. Public legal copies now agree with the cost-funded fee engine. Live-money reconciliation remains external. |
| Immediate dispatch and scheduling | TEST VERIFIED | Matching and Travel progression are server-authoritative. Production posture disables demonstration Operators and refuses incomplete operational configuration. Scheduling preserves party authority and uses leased background work. |
| Smart Travel | TEST VERIFIED; PROVIDER CAMPAIGN REQUIRED | Each car leg is a real separately charged Travel. Continuation revalidates authoritative state and party identity. Unknown or unavailable transit data fails truthfully. Live OTP/realtime evidence remains external. |
| Family / Teen Travel | TEST VERIFIED; JURISDICTION/DEVICE EVIDENCE REQUIRED | Active guardian relationship, age-out, Teen identity, party freezing, pickup PIN, guardian tracking, notification, Travel-scoped messaging and Smart Travel continuity are present and fail closed. The code does not claim universal commercial enablement. |
| Messaging, notifications and support | TEST VERIFIED; PROVIDER EVIDENCE REQUIRED | Travel chat is server-authorized; Operator institutional messages are durable; support and lost-item actions have abuse controls and do not report filing when delivery fails. Email, push and calling need live-provider evidence. |
| Account lifecycle, privacy and security | TEST VERIFIED; EXTERNAL EVIDENCE REQUIRED | Account closure, authorization, CORS, durable account/IP abuse controls, provider-event persistence, idempotent money paths and Firestore boundaries are present. Provider token revocation and retained-record behavior require the defined live campaign. |
| Accessibility and Dynamic Type | CODE COMPLETE; PHYSICAL DEVICE EVIDENCE REQUIRED | Central text scaling and shared control semantics are present. VoiceOver, TalkBack, large-text reflow, contrast and physical touch behavior cannot be approved from source tests. |
| Localization | TEST VERIFIED | Five catalogues contain 1,079 used keys with no untranslated user-visible strings. Legal terms in all supported languages now use the current one-Total policy. |
| Website/app language consistency | TEST VERIFIED after correction | Server legal documents and checked-in static Terms/About exports now match. Historical prototype and handoff documents are not release authority. |
| Release evidence and production providers | BLOCKED | Only the template exists. No exact-SHA production manifest, credentials, provider approvals, provider traces, insurance instruments, legal sign-off, signed device campaign or App Store/TestFlight evidence is present. |

## Historical PR disposition

| PR | Disposition | Reason |
| --- | --- | --- |
| #7 | **incorporated** | Its head is an ancestor of the current baseline. The Stripe Connect webhook and release-gate intent are present. No merge or restoration is required. |
| #8 | **incorporated, with its final inventory-count commit superseded** | Its substantive Family, Smart Travel, economics, provider durability and audit work is present in the consolidated lineage. Commit `8741f3c` is not an ancestor, but its inventory counts and “PR #7 was not merged” snapshot were overtaken by later consolidated code and counts. Nothing was restored. |
| #9 | **incorporated** | Its head is an ancestor of the current baseline. Current Checkr, insurance monitoring and acceptance behavior retain its intent. |
| #10 | **superseded by later disclosure work** | Its statutory-disclosure intent is present, but later commits align the complete disclosure with the Operator-owned insurance model, fixed translations and acknowledgement date. Reapplying #10 would restore older wording. Nothing was restored. |
| #11 | **incorporated / baseline** | This is the consolidated integration at the required starting SHA. |

No reviewed historical item was intentionally excluded while still required. No historical PR
was merged, cherry-picked or restored during this audit.

## Release classification

- **CODE COMPLETE:** The reviewed source paths implement the current architecture.
- **TEST VERIFIED:** TypeScript, five-language gates, backend lint/tests, Firestore rules and
  platform exports must pass on the final commit before this record is complete.
- **CONFIGURED:** Repository configuration and fail-closed readiness checks exist. Production
  configuration is not attested by repository state.
- **EXTERNAL EVIDENCE REQUIRED:** Production provider behavior, controlled live money, legal and
  broker review, insurance instruments, signed physical-device behavior, background presence,
  accessibility, full screen review, TestFlight/App Store and production deployment evidence.
- **BLOCKED:** Commercial release remains blocked until a release-evidence manifest for the exact
  candidate SHA validates with durable references for every gate.

The branch is safe as a code candidate only if the final Release Gate passes. It is not safe to
represent as commercially releasable until the external evidence package passes for the same SHA.
