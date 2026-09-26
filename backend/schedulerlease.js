// Single-leader lease for clock-driven work.
//
// Every Render instance may run the same 60-second timer. Before this existed, horizontally
// scaling the service multiplied dispatch/reconciliation/sweep work by the number of instances.
// A Firestore transaction elects one instance for each tick; a crashed holder is replaced after
// the lease expires.
const crypto = require('node:crypto');
const { adminDb, adminStatus } = require('./firebase-admin');

const COLLECTION = 'system_leases';
// Sweeps include network/provider calls and can exceed one minute. A 55-second lease could
// expire while the holder was still working and let a second instance enter concurrently.
// Five minutes is the safety envelope; the holder renews while work is in progress.
const DEFAULT_LEASE_MS = 5 * 60_000;

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

async function renewLease(name, { owner, now = Date.now(), ttlMs = DEFAULT_LEASE_MS } = {}) {
  const db = adminDb();
  if (!db || !owner) return { ok: false, renewed: false, reason: !db ? adminStatus().reason : 'owner required' };
  const ref = db.collection(COLLECTION).doc(String(name));
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const cur = snap.exists ? (snap.data() || {}) : {};
      if (cur.owner !== owner || Number(cur.leaseUntil || 0) <= now) {
        return { ok: true, renewed: false, lost: true, owner: cur.owner || null, leaseUntil: Number(cur.leaseUntil || 0) };
      }
      const leaseUntil = now + Math.max(1_000, Number(ttlMs) || DEFAULT_LEASE_MS);
      tx.set(ref, { renewedAt: now, leaseUntil }, { merge: true });
      return { ok: true, renewed: true, owner, leaseUntil };
    });
  } catch (e) {
    return { ok: false, renewed: false, reason: e?.message || String(e) };
  }
}

async function releaseLease(name, { owner } = {}) {
  const db = adminDb();
  if (!db || !owner) return { ok: false, released: false, reason: !db ? adminStatus().reason : 'owner required' };
  const ref = db.collection(COLLECTION).doc(String(name));
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const cur = snap.exists ? (snap.data() || {}) : {};
      if (cur.owner !== owner) return { ok: true, released: false };
      tx.set(ref, { leaseUntil: 0, releasedAt: Date.now() }, { merge: true });
      return { ok: true, released: true };
    });
  } catch (e) { return { ok: false, released: false, reason: e?.message || String(e) }; }
}

module.exports = { COLLECTION, DEFAULT_LEASE_MS, acquireLease, renewLease, releaseLease };
