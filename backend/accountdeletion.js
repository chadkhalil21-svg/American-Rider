const { closeOperationalAccount } = require('./accountclosure');

const RETRY_MS = 60_000;
const PAGE = 25;

// The mobile account owner reauthenticates before calling this function. The HTTP route
// independently verifies Firebase auth_time and revocation. Never delete Auth while an
// operationally active Travel or an in-flight scheduled charge still exists.
async function finalizeAccountDeletion({ db, auth, uid, now = Date.now() }) {
  if (!db || !auth || !uid) return { ok: false, code: 'account_verification_unavailable' };
  const closed = await closeOperationalAccount({ db, uid, now });
  if (!closed.ok) return closed;
  const fence = db.collection('account_closures').doc(uid);
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(fence);
    if (!snap.exists || snap.data()?.state === 'deleting' || snap.data()?.state === 'auth_deleted') return false;
    tx.update(fence, { state: 'deleting', deleteStartedAt: now, nextCheckAt: now + RETRY_MS });
    return true;
  });
  if (!claimed) return { ok: false, code: 'account_delete_in_progress' };
  try {
    await auth.deleteUser(uid);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') {
      await fence.set({ state: 'failed', nextCheckAt: now + RETRY_MS }, { merge: true });
      return { ok: false, code: 'auth_delete_failed' };
    }
  }
  // Auth has been removed. If Firestore is temporarily unavailable, the same durable
  // server-only fence persists for the leased cleanup worker. Never report that the
  // profile was deleted when only the identity was deleted.
  try {
    await db.collection('users').doc(uid).delete();
    await fence.delete();
    return { ok: true, profileRemoved: true };
  } catch (error) {
    await fence.set({ state: 'auth_deleted', nextCheckAt: now + RETRY_MS }, { merge: true }).catch(() => {});
    return { ok: true, profileRemoved: false, profileCleanupPending: true };
  }
}

// This does not delete Auth accounts on its own. It only cleans data after Firebase
// independently says the identity no longer exists; a live/unknown Auth account remains
// fenced and must retry or be reviewed by a named privacy operator.
async function sweepAccountDeletion({ db, auth, now = Date.now() }) {
  if (!db || !auth) return { ok: false, reason: 'auth_or_database_unavailable' };
  const query = await db.collection('account_closures')
    .where('nextCheckAt', '<=', now).orderBy('nextCheckAt').limit(PAGE).get();
  let cleaned = 0, pending = 0, failed = 0;
  for (const snap of query.docs) {
    const fence = snap.ref;
    let missing = false;
    try { await auth.getUser(snap.id); }
    catch (error) {
      if (error?.code === 'auth/user-not-found') missing = true;
      else {
        failed++;
        await fence.set({ nextCheckAt: now + RETRY_MS }, { merge: true }).catch(() => {});
        continue;
      }
    }
    if (!missing) {
      const old = snap.data();
      // A request that died before deleting Auth can be retried after the original request
      // can no longer plausibly still be in flight; no sweep ever deletes a live identity.
      const stalled = old.state === 'deleting' && now - Number(old.deleteStartedAt || now) > 5 * RETRY_MS;
      await fence.set({ nextCheckAt: now + (stalled ? RETRY_MS : 60 * RETRY_MS),
        ...(stalled ? { state: 'failed' } : {}) }, { merge: true });
      pending++;
      continue;
    }
    try {
      await db.collection('users').doc(snap.id).delete();
      await fence.delete();
      cleaned++;
    } catch (error) {
      failed++;
      await fence.set({ state: 'auth_deleted', nextCheckAt: now + RETRY_MS }, { merge: true }).catch(() => {});
    }
  }
  return { ok: failed === 0, considered: query.size, cleaned, pending, failed,
    saturated: query.size >= PAGE };
}

module.exports = { finalizeAccountDeletion, sweepAccountDeletion };
