# American Rider — Live Firestore index commissioning

The Operations board uses ten **bounded** Firestore queries. Source tests prove that
the query code and index manifest exist; tests using local mocks or emulator rules
**do not prove** that the corresponding composite indexes have been deployed into
the production Firestore database. A single missing index previously failed the entire
Operations dashboard after successful named/MFA authentication.

## Required live console checks

Project: `american-rider-35688`. Open Firebase Console → Databases & Storage →
Firestore Database → Indexes (Composite). Select the **actual database used by the
production Admin SDK** (normally `(default)`).

For the Operations board and its cases view, confirm these **collection-scope**
composite indexes exist with status `Enabled` / `READY`:

| Collection ID | Field order |
|---|---|
| `support_tickets` | `status ASC`, `createdAt DESC` |
| `scheduled_rides` | `status ASC`, `atMs ASC` |
| `support_tickets` | `status ASC`, `kind ASC`, `createdAt ASC`, `__name__ ASC` |

Verify indexes actually match the `FAILED_PRECONDITION` link if another query fails;
do not assume the three above exhaust all active routes. `firestore.indexes.json`
also records indexes for payouts, Family/Teen, geospatial dispatch, and provider
events; commission those for the applicable launch pathways.

If an index is missing, use Firebase's prepopulated create-index link from the actual
error or the manual Indexes editor. Do not blindly deploy a repository index file:
first compare the **entire live index list** with the repository manifest. Deploying
a differing manifest may propose deletion of existing live indexes. Reconcile them
first, approve changes, and only then use a targeted Firebase CLI index deployment
(`firebase deploy --only firestore:indexes --project american-rider-35688`).
Wait until every needed index reads `Enabled`; CLI submission alone is not proof
that building has finished.

## Exact release gate (record evidence)

1. Capture source SHA, running Render SHA, Firebase project, database ID, and UTC time.
2. Enumerate **live composite indexes and their build states**; compare against manifest
   and every composite query reached by launch traffic.
3. Sign in with a named Operations account and actual MFA; prove `GET /ops` renders
   the board **without** `unavailable` sections, `FAILED_PRECONDITION`, or
   raw database errors.
4. Exercise /ops/cases and market, support, dispatch, provider and monitoring
   queries in a controlled production-equivalent campaign, checking permissions and
   all required indexes.
5. Record per-endpoint pass/fail in the exact-SHA release evidence package. A green
   GitHub Actions run is not live-index evidence.

The UI is deliberately degraded rather than blank if an individual query fails,
and its warnings must **never** be treated as a green operational status.
