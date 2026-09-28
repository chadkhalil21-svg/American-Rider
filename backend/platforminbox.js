// Platform communications inbox.
//
// Travel chat is intentionally separate: it is between Traveler and Operator and belongs to a
// Travel. This inbox is American Rider -> account: qualification, insurance, screening,
// payout, policy and support notices. Firestore is the durable record; push/email are delivery
// channels, never the source of truth.

const { adminDb, adminStatus } = require('./firebase-admin');
const { notify } = require('./push');

const ALLOWED = new Set(['qualification','insurance','screening','payout','policy','support','operations']);

async function postPlatformMessage({ uid, category, title, body, action = null, required = true, now = Date.now() }) {
  const db = adminDb();
  if (!db) return { ok: false, reason: adminStatus().reason };
  if (!uid || !ALLOWED.has(String(category)) || !String(title || '').trim() || !String(body || '').trim()) {
    return { ok: false, reason: 'invalid platform message' };
  }
  const ref = db.collection('users').doc(String(uid)).collection('platform_messages').doc();
  const message = {
    category: String(category),
    title: String(title).trim().slice(0, 120),
    body: String(body).trim().slice(0, 3000),
    action: action || null,
    required: required !== false,
    createdAt: now,
    readAt: null,
  };
  await ref.create(message);
  // Best effort. The inbox already exists even if push delivery fails.
  await notify({
    uid, kind: 'platform_message', title: message.title, body: message.body.slice(0, 180),
    data: { screen: '/operator/inbox', messageId: ref.id },
  }).catch(() => {});
  return { ok: true, id: ref.id, message };
}

async function listPlatformMessages(uid, limit = 50) {
  const db = adminDb();
  if (!db) return { ok: false, reason: adminStatus().reason, messages: [] };
  const snap = await db.collection('users').doc(String(uid)).collection('platform_messages').get();
  const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a,b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, Math.min(100, Math.max(1, Number(limit) || 50)));
  return { ok: true, messages };
}

async function markPlatformMessageRead(uid, id, now = Date.now()) {
  const db = adminDb();
  if (!db) return { ok: false, reason: adminStatus().reason };
  const ref = db.collection('users').doc(String(uid)).collection('platform_messages').doc(String(id));
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, reason: 'not found' };
  // Read-once semantics: reopening a notice must not rewrite the evidence timestamp.
  if (!snap.data()?.readAt) await ref.set({ readAt: now }, { merge: true });
  return { ok: true };
}

module.exports = { ALLOWED, postPlatformMessage, listPlatformMessages, markPlatformMessageRead };
