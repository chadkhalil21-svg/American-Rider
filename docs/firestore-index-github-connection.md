# Firestore index connection (Google Cloud → GitHub Actions)

This workflow is deliberately manual and **add-only**. It uses short-lived
Google Cloud credentials through Workload Identity Federation (WIF); it never
writes service-account JSON keys to source code or ChatGPT, never reads
customer documents, and has **no delete operation**.

## Composite versus automatic indexes

The production index manifest has **12 required composite definitions**.
The previous 14-entry manifest also included `rides.status ASC` and
`operators.available ASC`, each followed only by the default `__name__ ASC`.
Those are **single-field** queries covered by Firestore automatic indexing;
Firestore's composite-index create API rejects them with HTTP 400 ("this index
is not necessary, configure using single field index controls"). The two
unnecessary composite definitions were removed from the manifest without
changing or deleting any live indexes. If the project ever disables automatic
single-field indexing for these fields, address that separately via Firestore
single-field configuration and a documented query test—not by POSTing a
composite definition. The commissioner now pre-validates the manifest to
prevent this incident recurring.

The first live `create_missing` run accepted creation of the composite
`support_tickets(status ASC, kind ASC, createdAt ASC)` before encountering the
single-field error. Subsequent runs detect any index already present (including
indexes still building), skip its creation, and create only genuinely absent
composite definitions. Always audit again until the **12 composite indexes**
report READY; separately validate single-field query behavior in the app.

## One-time connection, authorized by the Google Cloud project owner

Project: `american-rider-35688`, Firestore database: `(default)`.

1. In Google Cloud → IAM & Admin → Service Accounts, create a dedicated
   account, e.g. `firestore-index-deployer@american-rider-35688.iam.gserviceaccount.com`.
   Grant only **Cloud Datastore Index Admin** (`roles/datastore.indexAdmin`)
   on the project. Do not grant project Owner or Firestore data-writing roles.
2. In Google Cloud → Workload Identity Federation, configure a trusted
   **GitHub Actions** provider for repository
   `chadkhalil21-svg/American-Rider`; restrict accepted identities to
   this exact repository and its `release/current` manual-dispatch runs.
   Grant that identity `roles/iam.workloadIdentityUser` on the dedicated
   service account. Confirm a provider attribute condition restricting
   `assertion.repository` and `assertion.ref` before enabling access.
3. The project-owner-approved Google Cloud connection uses the **public**
   Workload Identity Provider resource name and dedicated service-account email
   in the committed workflow, without GitHub secrets or JSON service-account keys.
   These identifiers are **not** authentication credentials:
   - Provider:
     `projects/623854974930/locations/global/workloadIdentityPools/american-rider-github/providers/github`
   - Service account:
     `firestore-index-deployer@american-rider-35688.iam.gserviceaccount.com`
   Verify the provider's GitHub OIDC condition is bound to repository numeric ID
   `1382358737`, `refs/heads/release/current`, `workflow_dispatch`, and
   `.github/workflows/firestore-index-commissioning.yml`. The account should
   have only `roles/datastore.indexAdmin` on the project, while the WIF principal
   has `roles/iam.workloadIdentityUser` **on this service account only**.
4. After merging the reviewed workflow to `release/current`, open GitHub →
   Actions → **Firestore Composite Index Commissioning** →
   Run workflow, select `audit` first.
5. Review its list of live, READY, BUILDING and MISSING indexes. Then run
   `create_missing`, typing `american-rider-35688` into the confirmation.
   The script **only creates missing definitions in** `firestore.indexes.json`.
   It never updates/deletes others. Run `audit` again until all are READY.
6. Sign in to the live Operations Console and verify no degraded queues
   or failed preconditions. Record the exact production SHA and time.

The audit reports nonzero status for missing/building indexes; a deployment
request may also finish with a nonzero status while indexes are building.
This is deliberate: creation acknowledged is not the same as READY.

The GitHub connector can maintain this workflow and review runs, but does not
expose a manual workflow-dispatch or Google Cloud IAM management action. The
Google Cloud project owner performs IAM authorization; the user dispatches
the first audit/create_missing run through GitHub Actions, then shares its
logs so we can independently verify the results.
