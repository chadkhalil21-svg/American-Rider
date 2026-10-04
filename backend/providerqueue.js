// Durable provider-event inbox.
//
// A webhook is acknowledged only AFTER the verified event is written here. Processing may then
// happen after the HTTP response, because a process crash cannot erase the event: the periodic
// sweep claims it again. Claims use a Firestore transaction and a short lease so several server
// instances may race without processing the same event concurrently.
const crypto = require('node:crypto');
const { adminDb, adminStatus } = require('./firebase-admin');

const COLLECTION = 'provider_events';
const LEASE_MS = 90_000;
const MAX_BATCH = 40;
const MAX_ATTEMPTS = 12;

const safeId = (s) => String(s || '').replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 220);
const eventDocId = (provider, eventId) => safeId(`${provider}:${eventId}`);

async function enqueueProviderEvent({ provider, event }) {
  const db = adminDb();
  if (!db) return { ok: false, reason: adminStatus().reason };
  const id = eventDocId(provider, event?.id);
  if (!event?.id) return { ok: false, reason: 'provider event has no id' };
  const ref = db.collection(COLLECTION).doc(id);
  try {
    await ref.create({
      provider: String(provider),
      eventId: String(event.id),
      event,
      status: 'pending',
      attempts: 0,
      receivedAt: Date.now(),
      nextAttemptAt: 0,
      leaseUntil: 0,
      lastError: null,
    });
    return { ok: true, id, duplicate: false };
  } catch (e) {
    // Firestore ALREADY_EXISTS: provider retries are normal and are acknowledged as duplicates.
    if (e && (e.code === 6 || e.code === 'already-exists' || e.code === 'ALREADY_EXISTS')) {
      return { ok: true, id, duplicate: true };
    }
    return { ok: false, reason: e?.message || String(e) };
  }
}

async function claim(ref, workerId, now = Date.now()) {
  const db = adminDb();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const x = snap.data() || {};
    if (x.status === 'done' || x.status === 'dead') return null;
    if (Number(x.nextAttemptAt || 0) > now) return null;
    if (x.status === 'processing' && Number(x.leaseUntil || 0) > now) return null;
    const attempts = Number(x.attempts || 0) + 1;
    tx.set(ref, {
      status: 'processing',
      attempts,
      workerId,
      claimedAt: now,
      leaseUntil: now + LEASE_MS,
      nextAttemptAt: now + LEASE_MS,
    }, { merge: true });
    return { ...x, attempts, id: ref.id };
  });
}

const backoffMs = (attempts) => Math.min(15 * 60_000, Math.max(5_000, 5_000 * 2 ** Math.min(8, Math.max(0, attempts - 1))));

async function failEvent(ref, rec, error) {
  const dead=rec.attempts>=MAX_ATTEMPTS;
  await ref.set({status:dead?'dead':'pending',leaseUntil:0,
    nextAttemptAt:dead?0:Date.now()+backoffMs(rec.attempts),
    ...(dead?{deadAt:Date.now()}:{}),
    lastError:String(error||'provider handler failed').slice(0,1000)}, {merge:true});
  return {ok:false,reason:error,dead};
}

async function processProviderEvent({ id, handlers, workerId }) {
  const db = adminDb();
  if (!db) return { ok: false, reason: adminStatus().reason };
  const ref = db.collection(COLLECTION).doc(String(id));
  const rec = await claim(ref, workerId);
  if (!rec) return { ok: true, skipped: true };
  const handler = handlers?.[rec.provider];
  if (typeof handler !== 'function') {
    return failEvent(ref,rec,`no handler for provider ${rec.provider}`);
  }
  try {
    const result = await handler(rec.event);
    if (result && result.ok === false) throw new Error(result.reason || 'provider handler returned failure');
    await ref.set({
      status: 'done',
      doneAt: Date.now(),
      leaseUntil: 0,
      nextAttemptAt: 0,
      lastError: null,
      result: result || null,
    }, { merge: true });
    return { ok: true, result };
  } catch (e) {
    return failEvent(ref,rec,e?.message || String(e));
  }
}

async function sweepProviderEvents({ handlers, workerId = crypto.randomUUID(), limit = MAX_BATCH } = {}) {
  const db = adminDb();
  if (!db) return { ok: false, reason: adminStatus().reason };
  const size=Math.min(MAX_BATCH,Math.max(1,Number(limit)||MAX_BATCH));
  const now=Date.now();
  const pendingLimit=Math.max(1,Math.ceil(size*0.75));
  const expiredLimit=Math.max(0,size-pendingLimit);
  const pending=await db.collection(COLLECTION).where('status','==','pending')
    .where('nextAttemptAt','<=',now).orderBy('nextAttemptAt').limit(pendingLimit).get();
  const expired=expiredLimit ? await db.collection(COLLECTION).where('status','==','processing')
    .where('leaseUntil','<=',now).orderBy('leaseUntil').limit(expiredLimit).get() : {docs:[]};
  const docs=[...pending.docs,...expired.docs];
  const out = [];
  for (const doc of docs) {
    // processProviderEvent/claim() skips a processing record while its lease is live and
    // reclaims it after the lease expires. This is the crash-recovery path.
    out.push(await processProviderEvent({ id: doc.id, handlers, workerId }));
  }
  return {
    ok: true,
    considered: docs.length,
    processed: out.filter((x) => x.ok && !x.skipped).length,
    failed: out.filter((x) => !x.ok).length,
    dead: out.filter((x) => x.dead).length,
    saturated: pending.docs.length>=pendingLimit || expired.docs.length>=expiredLimit && expiredLimit>0,
  };
}

async function replayDeadEvent({id,actor}) {
  const db=adminDb();if(!db)return {ok:false,reason:adminStatus().reason};
  if(!actor||!id)return {ok:false,reason:'Named Operations actor and event id required'};
  return db.runTransaction(async(tx)=>{
    const ref=db.collection(COLLECTION).doc(String(id));const snap=await tx.get(ref);
    if(!snap.exists||snap.data()?.status!=='dead')return {ok:false,reason:'Event is not dead-lettered'};
    const audit=db.collection('audit_log').doc();
    tx.set(ref,{status:'pending',attempts:0,nextAttemptAt:0,leaseUntil:0,
      replayedAt:Date.now(),replayBy:String(actor).slice(0,80),deadAt:null},{merge:true});
    tx.create(audit,{at:Date.now(),subject:String(id),actor:String(actor).slice(0,80),
      action:'provider_event_replay',provider:String(snap.data().provider||'').slice(0,80)});
    return {ok:true};
  });
}

module.exports = {
  COLLECTION, LEASE_MS, MAX_ATTEMPTS, eventDocId, backoffMs,
  enqueueProviderEvent, processProviderEvent, sweepProviderEvents,replayDeadEvent,
};
