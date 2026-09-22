// Re-read operators' existing documents with the current structured reader.
//
// WHY. Documents read before READER_VERSION 2 carry no structured insurance evidence, so the
// Florida insurance rules (backend/qualification.js) cannot pass them. Asking every operator to
// upload everything again would be the lazy answer. The originals are in Firebase Storage; this
// reads them again and re-assesses. Only where the original is gone, or the new reading shows the
// document expired, unreadable or incomplete, does the operator have to act — and then the
// qualification findings already tell them which document and why.
//
// SAFE TO RUN TWICE. A document already read by the current reader is skipped, and one already
// found unavailable is not tried again for this reader version. Every change writes an
// audit_log entry (actor "migration") in the same transaction as the change.
//
// NOT IN INACTIVE MARKETS. Re-reading is a paid model call. An operator whose operating market
// is not ACTIVE — declared, or failing that where their fleet record last placed them — is
// skipped and reported.
//
// Run:
//   node backend/migrate-documents.js            dry run: counts only, no model calls, no writes
//   node backend/migrate-documents.js --apply    re-read and record
//   node backend/migrate-documents.js --apply --limit 25
const { REQUIRED_DOCS, assessAndRecord } = require('./qualification');
const { READER_VERSION } = require('./documents');
const { marketFor, markets } = require('./markets');

/** Is this operator's operating market active, from what the server holds? */
function marketActive(user, fleet) {
  const id = user?.operatingMarket?.id;
  if (id) return markets().find((m) => m.id === id)?.status === 'active';
  const lat = Number(fleet?.lat);
  const lng = Number(fleet?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && marketFor({ lat, lng })?.status === 'active';
}

/**
 * @param read    async ({ kind, imageUrl, expect }) => readDocument's result. Injected.
 * @param checks  the network half of an assessment, as server.js qualificationChecks.
 */
async function migrateDocuments({ db, read, checks, apply = false, limit = Infinity, liveMoney = false, now = () => Date.now() }) {
  const report = { apply, readerVersion: READER_VERSION, operators: 0, reread: 0, unavailable: 0, current: 0, skippedInactiveMarket: 0, failed: [], requalified: 0 };
  const snap = await db.collection('users').get();
  let done = 0;
  for (const docSnap of snap.docs) {
    const uid = docSnap.id;
    const user = docSnap.data() || {};
    const docs = user.documents || {};
    const stale = REQUIRED_DOCS.filter((k) => docs[k] && docs[k].readerVersion !== READER_VERSION && docs[k].reuploadCheckedVersion !== READER_VERSION);
    if (!stale.length) {
      if (REQUIRED_DOCS.some((k) => docs[k])) report.current++;
      continue;
    }
    if (done >= limit) break;
    const fleetSnap = await db.collection('operators').doc(uid).get();
    if (!marketActive(user, fleetSnap.exists ? fleetSnap.data() : null)) {
      report.skippedInactiveMarket++;
      continue;
    }
    report.operators++;
    done++;
    for (const kind of stale) {
      const d = docs[kind];
      if (!apply) {
        if (d.imageUrl) report.reread++;
        else report.unavailable++;
        continue;
      }
      let out = null;
      if (d.imageUrl) {
        try {
          out = await read({ kind, imageUrl: d.imageUrl, expect: { name: user.legalName || user.name || '' } });
        } catch (e) {
          out = { ok: false, error: e.message };
        }
      }
      const at = now();
      const userRef = db.collection('users').doc(uid);
      const auditRef = db.collection('audit_log').doc();
      const actor = { name: 'migration', ip: null, userAgent: null, session: `reader-v${READER_VERSION}` };
      if (out && out.ok) {
        const after = {
          verdict: out.verdict,
          reasons: out.reasons || [],
          summary: out.summary || '',
          expiry: out.expiry || null,
          evidence: out.evidence || null,
          readerVersion: READER_VERSION,
          readAt: at,
          migratedAt: at,
          reuploadRequired: false,
          reuploadReason: null,
        };
        await db.runTransaction(async (tx) => {
          // The reading is replaced; a person's decision on the document stays beside it.
          tx.set(userRef, { documents: { [kind]: after } }, { merge: true });
          tx.set(auditRef, {
            at, actor, action: 'document_reprocess', subject: uid, item: kind,
            before: { verdict: d.verdict || null, readerVersion: d.readerVersion || 1 },
            after: { verdict: after.verdict, readerVersion: READER_VERSION },
            note: 'Re-read with the structured reader.',
          });
        });
        report.reread++;
      } else {
        const reason = d.imageUrl
          ? 'The original could not be read again. Submit this document again.'
          : 'The original is not on file. Submit this document again.';
        await db.runTransaction(async (tx) => {
          tx.set(userRef, { documents: { [kind]: { reuploadRequired: true, reuploadReason: reason, reuploadCheckedVersion: READER_VERSION } } }, { merge: true });
          tx.set(auditRef, {
            at, actor, action: 'document_reupload_required', subject: uid, item: kind,
            before: { verdict: d.verdict || null, readerVersion: d.readerVersion || 1 },
            after: { reuploadRequired: true },
            note: out?.error ? `Re-read failed: ${String(out.error).slice(0, 200)}` : reason,
          });
        });
        report.unavailable++;
        if (out?.error) report.failed.push({ uid, kind, error: String(out.error).slice(0, 200) });
      }
    }
    if (apply) {
      const a = await assessAndRecord({ db, uid, checks, liveMoney, now: now() });
      if (a.qualified) report.requalified++;
    }
  }
  return report;
}

module.exports = { migrateDocuments, marketActive };

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const apply = args.includes('--apply');
    const li = args.indexOf('--limit');
    const limit = li >= 0 ? Number(args[li + 1]) || Infinity : Infinity;
    const { adminDb, adminStatus, accountDisabled } = require('./firebase-admin');
    const { readDocument, documentsReady } = require('./documents');
    const { connectAccountStatus } = require('./payments');
    const { readKey } = require('./env');
    const db = adminDb();
    if (!db) throw new Error(adminStatus().reason);
    // Without a key the reader returns "review" with no evidence — worse than what is stored.
    if (apply && !documentsReady()) throw new Error('ANTHROPIC_API_KEY is not set; refusing to re-read.');
    const checks = async (uid, user) => ({
      account: { disabled: await accountDisabled(uid) },
      payouts: { enabled: !!(await connectAccountStatus(user?.stripeAccountId || null)).payoutsEnabled },
    });
    const liveMoney = /^(sk|rk)_live_/.test(readKey('STRIPE_SECRET_KEY') || '');
    const report = await migrateDocuments({ db, read: readDocument, checks, apply, limit, liveMoney });
    console.log(JSON.stringify(report, null, 2));
  })().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
