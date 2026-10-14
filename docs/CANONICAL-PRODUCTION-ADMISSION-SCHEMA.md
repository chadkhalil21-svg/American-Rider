# Canonical Production Market Admission Schema

Status: operational interface documented, not a certification of production readiness.
Source: backend/market-readiness.js, backend/market-evidence-diagnosis.js, backend/screening.js, backend/server.js.
Staging benchmark: PR #205, branch release/staging-synthetic-20261014 (isolated CI; no real Travel).

## Storage and authoritative evaluation

One document per county in the Firestore collection \`market_admission\`:

- \`market_admission/fl-miami-dade\`
- \`market_admission/fl-broward\`
- \`market_admission/fl-palm-beach\`

Every county document has \`status\` and \`manifestVersion\`, and an \`evidence\` map. Only the existing authenticated admission engine changes \`status\` to \`active\`. The final Founder command is \`founder-open-fl-southeast-20261013\`, registered in \`backend/founder-market-intents.json\`.

Exactly eleven still-required evidence map keys for South Florida:

1. \`evidence.company_insurance_bound\` — valid company-insurance binder, real carrier, insured entity, Florida territorial coverage and contingent lapse-response verification.
2. \`evidence.disclosure_and_retention\` — proved delivery, retention and retrieval procedures.
3. \`evidence.pricing_and_taxes\` — tested fare, tax and lawful pass-through handling.
4. \`evidence.routing_and_toll_rights\` — provider permission, verified routing and toll access.
5. \`evidence.payment_and_reconciliation\` — documented live settlement, charges, refunds and payout reconciliation.
6. \`evidence.provider_contracts\` — actual authorized arrangements and provider terms.
7. \`evidence.safety_coverage\` — operational incident response, support and coverage demonstration.
8. \`evidence.accessible_service\` — accessibility process and operational service evidence.
9. \`evidence.qualified_operator_supply\` — real reviewed regional supply/qualification evidence; no requirement for pre-created individual Operator rows.
10. \`evidence.backup_restore_drill\` — completed backup restoration evidence and recovery timings.
11. \`evidence.device_and_release_tests\` — actual device, network, release and recovery tests.

Each verified record has the following exact minimum stored shape:

\`\`\`json
{
  "reference": "<real-document-or-provider-evidence-reference>",
  "issuer": "<real-issuing-organization>",
  "verifiedBy": "<named-MFA-Operations-reviewer>",
  "reviewedAt": 0,
  "validUntil": 0,
  "manifestVersion": "<current-manifest-version>"
}
\`\`\`

\`reviewedAt\` and \`validUntil\` are Unix epoch milliseconds; values of zero and angle-bracket placeholders are INVALID and appear only to describe the schema. Ingestions set \`verifiedBy\`, \`reviewedAt\` and \`manifestVersion\` server-side. The API requires a real source \`reference\`, \`issuer\`, future \`validUntil\`, and the current manifest hash. If one source is independently verified for all counties, a region-wide record also includes \`scope: "verified_complete_region"\` and \`coveredMarkets: ["fl-broward","fl-miami-dade","fl-palm-beach"]\`. The reviewer must confirm actual county coverage; do not infer it from a policy name.

Example complete county document SHAPE, not production data (all entries intentionally invalid):

\`\`\`json
{
  "status": "waitlist",
  "manifestVersion": "<current-manifest-version>",
  "evidence": {
    "company_insurance_bound": {"reference":"<real-reference>","issuer":"<real-issuer>","verifiedBy":"<named-reviewer>","reviewedAt":0,"validUntil":0,"manifestVersion":"<current-manifest-version>"},
    "disclosure_and_retention": {"reference":"<real-reference>","issuer":"<real-issuer>","verifiedBy":"<named-reviewer>","reviewedAt":0,"validUntil":0,"manifestVersion":"<current-manifest-version>"},
    "pricing_and_taxes": {"reference":"<real-reference>","issuer":"<real-issuer>","verifiedBy":"<named-reviewer>","reviewedAt":0,"validUntil":0,"manifestVersion":"<current-manifest-version>"},
    "routing_and_toll_rights": {"reference":"<real-reference>","issuer":"<real-issuer>","verifiedBy":"<named-reviewer>","reviewedAt":0,"validUntil":0,"manifestVersion":"<current-manifest-version>"},
    "payment_and_reconciliation": {"reference":"<real-reference>","issuer":"<real-issuer>","verifiedBy":"<named-reviewer>","reviewedAt":0,"validUntil":0,"manifestVersion":"<current-manifest-version>"},
    "provider_contracts": {"reference":"<real-reference>","issuer":"<real-issuer>","verifiedBy":"<named-reviewer>","reviewedAt":0,"validUntil":0,"manifestVersion":"<current-manifest-version>"},
    "safety_coverage": {"reference":"<real-reference>","issuer":"<real-issuer>","verifiedBy":"<named-reviewer>","reviewedAt":0,"validUntil":0,"manifestVersion":"<current-manifest-version>"},
    "accessible_service": {"reference":"<real-reference>","issuer":"<real-issuer>","verifiedBy":"<named-reviewer>","reviewedAt":0,"validUntil":0,"manifestVersion":"<current-manifest-version>"},
    "qualified_operator_supply": {"reference":"<real-reference>","issuer":"<real-issuer>","verifiedBy":"<named-reviewer>","reviewedAt":0,"validUntil":0,"manifestVersion":"<current-manifest-version>"},
    "backup_restore_drill": {"reference":"<real-reference>","issuer":"<real-issuer>","verifiedBy":"<named-reviewer>","reviewedAt":0,"validUntil":0,"manifestVersion":"<current-manifest-version>"},
    "device_and_release_tests": {"reference":"<real-reference>","issuer":"<real-issuer>","verifiedBy":"<named-reviewer>","reviewedAt":0,"validUntil":0,"manifestVersion":"<current-manifest-version>"}
  }
}
\`\`\`

Other statutory domains are already enforced in code; never remove those runtime checks.

## Separate screening production dependency

**Environment key**: \`SCREENING_EVIDENCE_WORKFLOW_VERIFIED\` (read by \`backend/screening.js\` through \`readKey\`). Value \`true\` means the *real* signed and authenticated external screening-provider-to-Operations report pilot, FCRA handling and independent review have been completed. The key is not an \`evidence\` document field and is not the same as Operator 24-hour screening renewal enforcement. The Operator request endpoint \`POST /operator/screening/existing\` begins a request; it is NOT a signed CRA-report delivery endpoint, not proof of provider integration.

Record the account reference, signed delivery event reference, Operations case/report reference and independent review in private compliance records. Signing secrets never go in Git or these payloads. Do not turn the flag on from a mock test or a Founder policy decision.

## Production ingestion process (existing API, no parallel write engine)

CLI: \`node scripts/ingest-market-admission.cjs --input <evidence.json>\`

- Default is local validation-only; no network access or database writes.
- Provide actual independently reviewed evidence, effective/current coverage and correct county scope.
- To submit, use \`--submit\` with an existing named/MFA Operations session supplied privately to the local process as \`AR_OPS_SESSION_COOKIE\`. Never share session tokens or credentials in a ChatGPT message, CLI argument, Git commit or workflow log.
- The CLI fetches current manifest hashes from \`GET /ops/markets/:id/readiness\` at submission time, then POSTs to the existing signed-session Operations route with \`x-ar-ops-action: 1\` and JSON body.
- Shared, verified three-county evidence uses \`POST /ops/markets/regions/fl-southeast/evidence\` with \`domain\`, \`reference\`, \`issuer\`, \`validUntil\`, \`allCountiesVerified: true\`, and \`manifestVersions\` (county -> actual hash).
- Individual-county evidence uses \`POST /ops/markets/:id/evidence\` with \`domain\`, \`reference\`, \`issuer\`, \`validUntil\`, and \`manifestVersion\`.
- Server records the authenticated reviewer and transaction audit. Each evidence update pauses affected markets, may require a fleet-cleanup sweep, and does NOT itself reopen commercial Travel. The standing Founder command will retry opening only when all current independent proofs pass. An explicit Operations pause after the Founder instruction cannot be overridden by the standing command.

Illustrative input FILE format for an authentic insurance binder (the placeholders will be rejected):

\`\`\`json
{
  "kind": "market_evidence",
  "regionId": "fl-southeast",
  "marketIds": ["fl-miami-dade", "fl-broward", "fl-palm-beach"],
  "allCountiesVerified": true,
  "domain": "company_insurance_bound",
  "reference": "<real-carrier-reference>",
  "issuer": "<real-carrier>",
  "validUntil": 0,
  "independentReview": {
    "sourceChecked": true,
    "reviewer": "<named-person>",
    "reviewedAt": "<actual-ISO8601-time>",
    "evidenceLocation": "<protected-document-reference>"
  },
  "policy": {
    "carrier": "<actual-carrier>",
    "binderReference": "<actual-binder-id>",
    "namedInsured": "<actual-insured-company>",
    "territory": ["FL"],
    "effectiveAt": "<actual-ISO8601-time>",
    "expiresAt": "<actual-ISO8601-time>",
    "tncContingentResponseVerified": true
  }
}
\`\`\`

The CLI requires real, reviewable inputs. This sample cannot be submitted. For other domains, use the same base fields without \`policy\`. For a source limited to one county, set exactly one \`marketIds\` entry and omit \`allCountiesVerified\`.

The CLI also accepts \`kind: "screening_handoff"\` in **dry-run only**, requiring real provider account ID, signed webhook receipt reference, Operations report reference, FCRA review and pilot confirmation. It explicitly does not flip \`SCREENING_EVIDENCE_WORKFLOW_VERIFIED\`: authorized review of provider proof and production configuration is a separate step.

## Staging benchmark kept intact

PR #205 stays in draft on \`release/staging-synthetic-20261014\`. Its two successful isolated in-memory runs produced \`region_activated\` for all three counties. Those are **simulated only**, not live Render staging or proof of commercial readiness. No fixture credentials, sample insurance references or fake CRA receipts may be promoted to the production database.
