'use strict';
// Safety push receipt reconciliation. Expo "ticket ok" is acceptance by Expo,
// "receipt ok" is acceptance by APNs/FCM; NEITHER proves handset display.
// Publisher guidance: https://docs.expo.dev/push-notifications/sending-notifications/
// Bounded reads/network/writes. Runs through the existing cross-instance leased
// scheduler and its five-minute maintenance cadence. No secondary notification.
const { createHash } = require('node:crypto');
const { adminDb, adminStatus } = require('./firebase-admin');

const COLLECTION = 'push_receipts';
const RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const FIRST_CHECK_MS = 15 * 60_000;
const RECEIPT_EXPIRY_MS = 24 * 60 * 60_000;
const AUDIT_RETENTION_MS = 7 * 24 * 60 * 60_000;
const MAX_PER_SWEEP = 100;
const MAX_PURGE_PER_SWEEP = 100;
const NEVER_DUE_MS = Number.MAX_SAFE_INTEGER; // terminal entries must never precede due work
const VALID_KINDS = new Set(['check_in']); // safety only: no per-Travel marketing cost
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const ticketDocId = ticketId => hash('expo-receipt:' + ticketId);
const validString = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;
const receiptCode = value => String(value || 'unknown').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'unknown';

async function recordAcceptedTicket({
  db = adminDb(), uid, token, ticketId, kind, now = Date.now(),
} = {}) {
  if (!VALID_KINDS.has(kind)) return { ok:false, reason:'not a tracked safety notification' };
  if (!db || !validString(uid, 200) || !validString(token, 512) ||
      !validString(ticketId, 200) || !Number.isFinite(now))
    return { ok:false, reason:'receipt tracking unavailable' };
  const ref = db.collection(COLLECTION).doc(ticketDocId(ticketId));
  try {
    await ref.create({
      ticketId, uid, kind, tokenHash:hash(token),
      status:'pending', attempts:0, createdAt:now,
      nextAttemptAt:now+FIRST_CHECK_MS,
      expiresAt:now+RECEIPT_EXPIRY_MS,
      purgeAt:now+AUDIT_RETENTION_MS,
      providerStatus:'unverified', updatedAt:now,
    });
    return { ok:true };
  } catch (e) {
    // A duplicate ticket is already durably tracked; do not duplicate writes.
    if (e?.code===6 || /already exists/i.test(String(e?.message||''))) {
      // Amazon's "same request ID, different intent" rule: the already-used
      // ticket ID is valid only for the original person, token and kind.
      try {
        const existing=await ref.get();
        const old=existing.exists ? existing.data() : null;
        if (old?.uid===uid && old?.kind===kind &&
            old?.ticketId===ticketId && old?.tokenHash===hash(token))
          return {ok:true,duplicate:true};
      } catch { /* no optimistic duplicate success on unavailable Firestore */ }
      return {ok:false,reason:'safety push ticket conflicts with existing event'};
    }
    return {ok:false,reason:'safety push ticket not stored'};
  }
}

async function clearRejectedToken({db,uid,tokenHash}){
  if (!db || !validString(uid,200) || !/^[0-9a-f]{64}$/.test(String(tokenHash))) return false;
  const ref = db.collection('users').doc(uid);
  return db.runTransaction(async tx=>{
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data()?.pushToken : null;
    if (!validString(current,512) || hash(current)!==tokenHash) return false;
    tx.set(ref,{pushToken:null},{merge:true});
    return true;
  });
}
function later(row,now){
  const attempts = Math.min(20,Math.max(0,Number(row.attempts)||0)+1);
  const delay = Math.min(60*60_000,5*60_000*2**Math.min(attempts-1,5));
  return {attempts,nextAttemptAt:Math.min(row.expiresAt,now+delay),updatedAt:now};
}

async function sweepPushReceipts({
  db=adminDb(),now=Date.now(),fetchFn=fetch,
}={}){
  const report={ok:true,scanned:0,checked:0,providerAccepted:0,
    providerRejected:0,unverified:0,pendingCount:0,purged:0};
  if (!db) return {...report,ok:false,reason:adminStatus().reason || 'Firestore unavailable'};
  try {
    // One automatically indexed field, no composite index deployment needed.
    // Completed records use a far-future numeric due time, so even a Firestore\n    // cross-type comparison cannot make old terminal records starve new due receipts.
    const snap=await db.collection(COLLECTION).where('nextAttemptAt','<=',now)
      .orderBy('nextAttemptAt').limit(MAX_PER_SWEEP).get();
    report.scanned=snap.size ?? snap.docs.length;
    const rows=snap.docs.map(doc=>({ref:doc.ref,...doc.data()}))
      .filter(row=>row.status==='pending');
    report.pendingCount=rows.length;
    const current=rows.filter(row=>Number(row.expiresAt)>now);
    const expired=rows.filter(row=>!(Number(row.expiresAt)>now));
    const changes=[];
    for(const row of expired){
      changes.push({ref:row.ref,update:{status:'unverified_expired',
        providerStatus:'unverified',nextAttemptAt:NEVER_DUE_MS,updatedAt:now}});
      report.unverified++;
    }
    if(current.length){
      let providerData=null;
      try {
        const response=await fetchFn(RECEIPTS_URL,{
          method:'POST',signal:AbortSignal.timeout(10000),
          headers:{'Content-Type':'application/json',Accept:'application/json'},
          body:JSON.stringify({ids:current.map(r=>r.ticketId)}),
        });
        if(!response.ok) throw Error('Expo receipt HTTP '+response.status);
        const result=await response.json();
        if(!result || !result.data || typeof result.data!=='object' ||
            Array.isArray(result.data) || (result.errors && result.errors.length))
          throw Error('Expo receipt payload invalid');
        providerData=result.data;
      } catch(e) {
        report.ok=false;
        report.reason='Expo receipt check unavailable';
      }
      for(const row of current){
        if(!providerData){
          changes.push({ref:row.ref,update:later(row,now)});
          report.unverified++;
          continue;
        }
        const result=providerData[row.ticketId];
        report.checked++;
        if(result?.status==='ok'){
          changes.push({ref:row.ref,update:{
            status:'provider_accepted',providerStatus:'accepted_by_APNs_or_FCM',
            nextAttemptAt:NEVER_DUE_MS,updatedAt:now,
          }});
          report.providerAccepted++;
        } else if(result?.status==='error'){
          const code=receiptCode(result.details?.error);
          changes.push({ref:row.ref,update:{
            status:'provider_rejected',providerStatus:'rejected',
            providerError:code,nextAttemptAt:NEVER_DUE_MS,updatedAt:now,
          }});
          report.providerRejected++;
          report.ok=false;
          if(code==='DeviceNotRegistered'){
            try { await clearRejectedToken({db,uid:row.uid,tokenHash:row.tokenHash}); }
            catch { report.reason='push-token cleanup deferred'; }
          }
        } else {
          // Missing receipt != success. Expo removes receipts after 24 hours.
          changes.push({ref:row.ref,update:later(row,now)});
          report.unverified++;
        }
      }
    }
    if(changes.length){
      const batch=db.batch();
      for(const change of changes)batch.set(change.ref,change.update,{merge:true});
      await batch.commit();
    }
    // Bound long-term storage even without a separately provisioned Firestore
    // TTL policy. This extra query costs at most one minimum billed read when empty.
    const old=await db.collection(COLLECTION).where('purgeAt','<=',now)
      .orderBy('purgeAt').limit(MAX_PURGE_PER_SWEEP).get();
    if(old.docs.length){
      const batch=db.batch();
      for(const doc of old.docs)batch.delete(doc.ref);
      await batch.commit();
      report.purged=old.docs.length;
    }
    if(report.providerRejected || report.unverified || !report.ok){
      // Aggregate only. Never log UID, Expo ticket IDs, phone tokens or Travel IDs.
      console.warn('[push-receipts] safety delivery not verified',JSON.stringify(report));
    }
    return report;
  } catch (e) {
    return {...report,ok:false,reason:String(e?.message||e).slice(0,120)};
  }
}
module.exports={recordAcceptedTicket,sweepPushReceipts,clearRejectedToken,
  FIRST_CHECK_MS,RECEIPT_EXPIRY_MS,MAX_PER_SWEEP,COLLECTION};
