// The legacy document migration: re-read where the original exists, idempotent, audited, and
// never in an inactive market. Run: node backend/migration.test.js
const { migrateDocuments } = require('./migrate-documents');
const { READER_VERSION } = require('./documents');

const R = [];
const check = (l, c, d) => R.push({ l, ok: !!c, d });

function fakeDb(seed) {
  const data = JSON.parse(JSON.stringify(seed));
  let n = 0;
  const merge = (a, b) => {
    const out = { ...(a || {}) };
    for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' ? merge(out[k], v) : v;
    return out;
  };
  const snap = (col, id) => ({ id, exists: !!data[col]?.[id], data: () => (data[col]?.[id] ? JSON.parse(JSON.stringify(data[col][id])) : undefined) });
  const write = (col, id, f, o) => { data[col] = data[col] || {}; data[col][id] = o?.merge ? merge(data[col][id], f) : { ...f }; };
  return {
    data,
    collection: (col) => ({
      get: async () => ({ docs: Object.keys(data[col] || {}).map((id) => snap(col, id)) }),
      doc: (id) => {
        const key = id ?? `auto${++n}`;
        return { col, id: key, get: async () => snap(col, key), set: async (f, o) => write(col, key, f, o) };
      },
    }),
    async runTransaction(fn) {
      const w = [];
      const out = await fn({ get: async (r) => snap(r.col, r.id), set: (r, f, o) => w.push(() => write(r.col, r.id, f, o)), update: (r, f) => w.push(() => write(r.col, r.id, f, { merge: true })) });
      w.forEach((x) => x());
      return out;
    },
  };
}

const oldDoc = (url) => ({ verdict: 'accept', expiry: '2028-01-31', imageUrl: url, readerVersion: undefined });
const seed = () => ({
  users: {
    // Operating in Miami-Dade, three old readings, one original missing.
    a: { name: 'Ana Operator', operatingMarket: { id: 'fl-miami-dade' }, documents: { license: oldDoc('https://x/a-l'), registration: oldDoc('https://x/a-r'), insurance: oldDoc(null) } },
    // Declared a waitlist county: nothing is read.
    b: { name: 'Bo', operatingMarket: { id: 'fl-orange' }, documents: { license: oldDoc('https://x/b-l') } },
    // No declaration; fleet record places them in Broward.
    c: { name: 'Cy', documents: { license: oldDoc('https://x/c-l') } },
    // Already current.
    d: { name: 'Di', operatingMarket: { id: 'fl-broward' }, documents: { license: { ...oldDoc('https://x/d-l'), readerVersion: READER_VERSION } } },
    // A traveler with no documents.
    t: { name: 'Tr' },
  },
  operators: { c: { lat: 26.1224, lng: -80.1373 } },
});

const reads = [];
const read = async ({ kind, imageUrl }) => {
  reads.push(imageUrl);
  if (imageUrl === 'https://x/c-l') return { ok: false, error: 'could not fetch the upload (403)' };
  return { ok: true, verdict: 'accept', reasons: [], summary: `${kind} read`, expiry: '2028-01-31', evidence: { isTheRequestedDocument: true, legible: true, fields: {} } };
};
const checks = async () => ({ account: { disabled: false }, payouts: { enabled: true } });

(async () => {
  const db = fakeDb(seed());
  const dry = await migrateDocuments({ db, read, checks, apply: false });
  check('dry run: no model calls', reads.length === 0);
  check('dry run: nothing written', !db.data.audit_log && !db.data.users.a.documents.license.readerVersion);
  check('dry run: counts what it would do', dry.reread === 3 && dry.unavailable === 1 && dry.skippedInactiveMarket === 1 && dry.current === 1, JSON.stringify(dry));

  const out = await migrateDocuments({ db, read, checks, apply: true, now: () => 1000 });
  check('apply: re-reads only originals that exist, in active markets', reads.length === 3 && !reads.includes('https://x/b-l') && !reads.includes('https://x/d-l'), JSON.stringify(reads));
  check('apply: the re-read carries the current reader version', db.data.users.a.documents.license.readerVersion === READER_VERSION && db.data.users.a.documents.license.migratedAt === 1000);
  check('apply: the original link is kept', db.data.users.a.documents.license.imageUrl === 'https://x/a-l');
  check('apply: a missing original asks for that document only', db.data.users.a.documents.insurance.reuploadRequired === true && !db.data.users.a.documents.license.reuploadRequired);
  check('apply: an unreadable original asks for that document', db.data.users.c.documents.license.reuploadRequired === true);
  check('apply: a waitlist-market operator is untouched', !db.data.users.b.documents.license.readerVersion && !db.data.users.b.documents.license.reuploadRequired);
  const audit = Object.values(db.data.audit_log || {});
  check('apply: one audit entry per document changed, by "migration"', audit.length === 4 && audit.every((e) => e.actor.name === 'migration'), JSON.stringify(audit.map((e) => e.action)));
  check('apply: the audit records before and after', audit.some((e) => e.action === 'document_reprocess' && e.before.readerVersion === 1 && e.after.readerVersion === READER_VERSION));
  check('apply: operators are re-assessed', !!db.data.users.a.qualification && db.data.users.a.qualification.status !== undefined);
  check('apply: the re-upload shows as a machine-readable finding',
    (db.data.users.a.qualification.blockers || []).some((b) => b.code === 'document_reupload_required' && b.item === 'insurance'), JSON.stringify(db.data.users.a.qualification));
  check('apply: report', out.reread === 2 && out.unavailable === 2 && out.skippedInactiveMarket === 1, JSON.stringify(out));

  const before = reads.length;
  const again = await migrateDocuments({ db, read, checks, apply: true });
  check('idempotent: a second run reads nothing and writes no audit entries', reads.length === before && Object.values(db.data.audit_log).length === 4 && again.reread === 0 && again.unavailable === 0, JSON.stringify(again));

  let bad = 0;
  for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  — ' + (r.d || '')}`); }
  console.log(`\n${R.length - bad}/${R.length} passed`);
  process.exit(bad ? 1 : 0);
})();
