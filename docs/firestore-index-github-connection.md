# Firestore index connection (Google Cloud → GitHub Actions)

This workflow is deliberately manual and **add-only**. It uses short-lived
Google Cloud credentials through Workload Identity Federation (WIF); it never
writes service-account JSON keys to source code or ChatGPT, never reads
customer documents, and has **no delete operation**.

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
3. In GitHub repository → Settings → Secrets and variables → Actions,
   create two repository secrets:
   - `FIRESTORE_WIF_PROVIDER` — full provider resource name, such as
     `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL/providers/PROVIDER`.
   - `FIRESTORE_INDEX_SA_EMAIL` — email address of the dedicated service
     account.
   Store the actual values in GitHub, **never in chat**.
4. Merge the reviewed workflow to `release/current`. In GitHub →
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

Current ChatGPT connector availability: GitHub and Render can inspect and
maintain this integration's source and deployments, but they cannot grant
Google Cloud IAM permissions or set GitHub Actions repository secrets
themselves. A Google Cloud owner must complete the above authorization.
