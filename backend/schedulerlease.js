// Single-leader lease for clock-driven work.
//
// Every Render instance may run the same 60-second timer. Before this existed, horizontally
// scaling the service multiplied dispatch/reconciliation/sweep work by the number of instances.
// A Firestore transaction elects one instance for each tick; a crashed holder is replaced after
// the lease expires.
const crypto = require('node:crypto');
const { adminDb, adminStatus } = require('./firebase-admin');

const COLLECTION = 'system_leases';
const DEFAULT_LEASE_MS = 55_000;

async function acquireLease(name, { owner = crypto.randomUUID(), now = Date.now(), ttlMs = DEFAULT_LEASE_MS } = {}) {
  const db = adminDb();
  if (!db) return { ok: false, acquired: false, reason: adminStatus().reason };
  const ref = db.collection(COLLECTION).doc(String(name));
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const cur = snap.exists ? (snap.data() || {}) : {};
      if (Number(cur.leaseUntil || 0) > now && cur.owner && cur.owner !== owner) {
        return { ok: true, acquired: false, owner: cur.owner, leaseUntil: cur.leaseUntil };
      }
      const leaseUntil = now + Math.max(1_000, Number(ttlMs) || DEFAULT_LEASE_MS);
      tx.set(ref, { owner, acquiredAt: now, leaseUntil }, { merge: true });
      return { ok: true, acquired: true, owner, leaseUntil };
    });
  } catch (e) {
    return { ok: false, acquired: false, reason: e?.message || String(e) };
  }
}

module.exports = { COLLECTION, DEFAULT_LEASE_MS, acquireLease };
