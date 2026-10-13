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
const MAX_BATCH = 200;
const MAX_TICK_EVENTS = 1200;
const MAX_PARALLEL = 8;
const MAX_TICK_MS = 25_000;
const MAX_ATTEMPTS = 12;

const safeId = (s) => String(s || '').replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 220);
const eventDocId = (provider, eventId) => safeId(`${provider}:${eventId}`);

// Amazon Builders' Library: a repeated idempotency key with DIFFERENT intent is
// an error, not a successful replay. Provider JSON may reorder object keys
// between decoders, so fingerprint the canonical semantic JSON recursively.
// The parser's depth is bounded to fail closed, avoiding hostile recursion.
// This fingerprint is stored with the durable inbox, not user-facing data.
function canonicalEvent(value, depth=0) {
  if(depth>64) throw Error('provider event nesting exceeds bounded identity depth');
  if(Array.isArray(value)) return value.map(v=>canonicalEvent(v,depth+1));
  if(value && typeof value==='object') {
    const result={};
    for(const key of Object.keys(value).sort()) result[key]=canonicalEvent(value[key],depth+1);
    return result;
  }
  return value;
}
function eventFingerprint(event) {
  const json=JSON.stringify(canonicalEvent(event));
  if(typeof json!=='string' || Buffer.byteLength(json,'utf8')>2_000_000)
    throw Error('invalid or oversized provider event identity');
  return crypto.createHash('sha256').update(json).digest('hex');
}


async function enqueueProviderEvent({ provider, event }) {
  const db = adminDb();
  if (!db) return { ok: false, reason: adminStatus().reason };
  if (!event?.id) return { ok: false, reason: 'provider event has no id' };
  if (typeof provider!=='string' || !provider || provider.length>100 ||
      typeof event.id!=='string' || !event.id || event.id.length>1024)
    return { ok:false, reason:'invalid provider event identity' };
  const id = eventDocId(provider, event.id);
  const ref = db.collection(COLLECTION).doc(id);
  try {
    const eventHash=eventFingerprint(event);
    await ref.create({
      provider: String(provider),
      eventId: String(event.id),
      eventHash,
      event,
      status: 'pending',
      attempts: 0,
      receivedAt: Date.now(),
      nextAttemptAt: 0,
      leaseUntil: 0,
      claimNonce: null,
      lastError: null,
    });
    return { ok: true, id, duplicate: false };
  } catch (e) {
    // A returned ALREADY_EXISTS may be an exact replay OR a different event
    // that normalizes/truncates to the same Firestore doc ID. Read only on
    // duplicates (not every provider event), fail closed on mismatch/outage.
    if (e && (e.code === 6 || e.code === 'already-exists' || e.code === 'ALREADY_EXISTS')) {
      try {
        const previous = await ref.get();
        const existing=previous.exists ? previous.data() : null;
        if (!existing || existing.provider !== provider ||
            existing.eventId !== event.id ||
            (existing.eventHash || eventFingerprint(existing.event))!==eventFingerprint(event))
          return {ok:false,reason:'provider event ID reused with conflicting payload'};
        return {ok:true,id,duplicate:true};
      } catch {
        return {ok:false,reason:'could not verify duplicate provider event'};
      }
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
    const claimNonce = crypto.randomUUID();
    tx.set(ref, {
      status: 'processing',
      attempts,
      workerId,
      claimedAt: now,
      leaseUntil: now + LEASE_MS,
      nextAttemptAt: now + LEASE_MS,
      claimNonce,
    }, { merge: true });
    return { ...x, attempts, claimNonce, id: ref.id };
  });
}

const backoffMs = (attempts) => Math.min(15 * 60_000, Math.max(5_000, 5_000 * 2 ** Math.min(8, Math.max(0, attempts - 1))));

// Amazon Builders' Library recommends spreading delayed retries rather than
// allowing a fleet of failed provider events to wake up at the same instant.
// A stable event+attempt hash needs no database reads, new vendor or random
// state; unique events naturally receive different bounded retry times.
// Never apply jitter to the immediate handling of an initial urgent event.
const jitteredBackoffMs = (attempts, eventId) => {
  const ceiling = backoffMs(attempts);
  const digest = crypto.createHash('sha256')
    .update(String(eventId || 'unknown') + ':' + String(attempts)).digest();
  const fraction = digest.readUInt32BE(0) / 0x1_0000_0000;
  return Math.max(1, Math.floor(ceiling * (0.5 + 0.5 * fraction)));
};


async function finishClaim(ref, rec, patch) {
  const db = adminDb();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().status !== 'processing' || snap.data().claimNonce !== rec.claimNonce) return false;
    tx.set(ref, patch, { merge: true });
    return true;
  });
}

async function failEvent(ref, rec, error) {
  const dead=rec.attempts>=MAX_ATTEMPTS;
  const saved = await finishClaim(ref, rec, {status:dead?'dead':'pending',leaseUntil:0,claimNonce:null,
    nextAttemptAt:dead?0:Date.now()+jitteredBackoffMs(rec.attempts,rec.id),
    ...(dead?{deadAt:Date.now()}:{}),
    lastError:String(error||'provider handler failed').slice(0,1000)});
  if (!saved) return {ok:false,skipped:true,superseded:true,reason:'provider claim expired or was superseded'};
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
    const saved = await finishClaim(ref, rec, {
      status: 'done',
      doneAt: Date.now(),
      leaseUntil: 0,
      nextAttemptAt: 0,
      claimNonce: null,
      lastError: null,
      result: result || null,
    });
    return saved ? { ok: true, result } : { ok: false, skipped: true, superseded: true };
  } catch (e) {
    return failEvent(ref,rec,e?.message || String(e));
  }
}

async function sweepProviderEvents({ handlers, workerId = crypto.randomUUID(), limit = MAX_TICK_EVENTS } = {}) {
  const db = adminDb();
  if (!db) return { ok: false, reason: adminStatus().reason };
  const totalLimit=Math.min(MAX_TICK_EVENTS,Math.max(1,Number(limit)||MAX_TICK_EVENTS));
  const started=Date.now(),out=[];
  let duePages=0,oldestDueAgeMs=0,fullPage=false;
  while(out.length<totalLimit && Date.now()-started<MAX_TICK_MS) {
    const size=Math.min(MAX_BATCH,totalLimit-out.length);
    const pendingLimit=Math.max(1,Math.ceil(size*0.75));
    const expiredLimit=Math.max(0,size-pendingLimit);
    const now=Date.now();
    const pending=await db.collection(COLLECTION).where('status','==','pending')
      .where('nextAttemptAt','<=',now).orderBy('nextAttemptAt').limit(pendingLimit).get();
    const expired=expiredLimit ? await db.collection(COLLECTION).where('status','==','processing')
      .where('leaseUntil','<=',now).orderBy('leaseUntil').limit(expiredLimit).get() : {docs:[]};
    const docs=[...pending.docs,...expired.docs];
    if (!docs.length) {fullPage=false;break;}
    duePages++;
    oldestDueAgeMs=Math.max(oldestDueAgeMs,...docs.map((d)=>Math.max(0,now-Number(d.data()?.receivedAt||now))));
    fullPage=pending.docs.length>=pendingLimit || expired.docs.length>=expiredLimit && expiredLimit>0;
    for(let start=0;start<docs.length;start+=MAX_PARALLEL) {
      const group=docs.slice(start,start+MAX_PARALLEL);
      const results=await Promise.all(group.map(async(doc)=>{
        try { return await processProviderEvent({id:doc.id,handlers,workerId}); }
        catch(e) { return {ok:false,reason:e?.message||String(e)}; }
      }));
      out.push(...results);
    }
    if (!fullPage) break;
  }
  return {
    ok: true,
    considered: out.length,
    processed: out.filter((x) => x.ok && !x.skipped).length,
    failed: out.filter((x) => !x.ok).length,
    dead: out.filter((x) => x.dead).length,
    duePages,oldestDueAgeMs,
    saturated: fullPage || out.length>=totalLimit || Date.now()-started>=MAX_TICK_MS,
  };
}

async function replayDeadEvent({id,actor}) {
  const db=adminDb();if(!db)return {ok:false,reason:adminStatus().reason};
  if(!actor||!id)return {ok:false,reason:'Named Operations actor and event id required'};
  return db.runTransaction(async(tx)=>{
    const ref=db.collection(COLLECTION).doc(String(id));const snap=await tx.get(ref);
    if(!snap.exists||snap.data()?.status!=='dead')return {ok:false,reason:'Event is not dead-lettered'};
    const audit=db.collection('audit_log').doc();
    tx.set(ref,{status:'pending',attempts:0,nextAttemptAt:0,leaseUntil:0,claimNonce:null,
      replayedAt:Date.now(),replayBy:String(actor).slice(0,80),deadAt:null},{merge:true});
    tx.create(audit,{at:Date.now(),subject:String(id),actor:String(actor).slice(0,80),
      action:'provider_event_replay',provider:String(snap.data().provider||'').slice(0,80)});
    return {ok:true};
  });
}

module.exports = {
  COLLECTION, LEASE_MS, MAX_ATTEMPTS, MAX_BATCH, MAX_TICK_EVENTS, MAX_PARALLEL,
  eventDocId, backoffMs, jitteredBackoffMs,
  enqueueProviderEvent, processProviderEvent, sweepProviderEvents,replayDeadEvent,
};
