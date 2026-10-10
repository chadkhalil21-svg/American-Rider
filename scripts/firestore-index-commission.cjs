'use strict';
// Firestore composite-index commission: AUDIT or ADD ONLY.
// This script has no index-delete path and never reads customer documents.
// Google Workload Identity Federation supplies a short-lived access token in CI.
const fs = require('node:fs');
const PROJECT = 'american-rider-35688';
const DATABASE = '(default)';
const API = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + encodeURIComponent(DATABASE);
const MODE = process.env.FIRESTORE_INDEX_ACTION || 'audit';
function normalize(index) {
  const collectionGroup = index.collectionGroup ||
    String(index.name || '').split('/collectionGroups/')[1]?.split('/')[0];
  const fields = (index.fields || []).map((f) => {
    const field = { fieldPath: f.fieldPath };
    if (f.order) field.order = String(f.order).toUpperCase();
    else if (f.arrayConfig) field.arrayConfig = String(f.arrayConfig).toUpperCase();
    else throw new Error('Unexpected index field mode in ' + collectionGroup);
    return field;
  });
  // Firestore automatically appends __name__, so compare explicit/implicit forms equally.
  if (fields.length > 1 && fields.at(-1).fieldPath === '__name__') {
    const previous = fields.at(-2);
    const expectedOrder = previous.order || 'ASCENDING';
    if (fields.at(-1).order === expectedOrder) fields.pop();
  }
  return JSON.stringify({
    collectionGroup,
    queryScope: index.queryScope || 'COLLECTION',
    fields,
  });
}
function summarize(index) {
  const value = JSON.parse(normalize(index));
  return value.collectionGroup + ' [' +
    value.fields.map((f) => f.fieldPath + ':' + (f.order || f.arrayConfig)).join(', ') + '] (' +
    value.queryScope + ')';
}
async function request(path, init = {}) {
  const token = process.env.FIRESTORE_ACCESS_TOKEN;
  if (!token) throw new Error('Missing short-lived Workload Identity token. Check GitHub OIDC provider trust and the dedicated service account.');
  const response = await fetch(API + path, {
    ...init,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = typeof error.error?.message === 'string'
      ? error.error.message.slice(0, 200) : 'Google API rejected request';
    throw new Error('Firestore index API HTTP ' + response.status + ': ' + message);
  }
  return response.json();
}
async function listIndexes(collection) {
  const parent = '/collectionGroups/' + encodeURIComponent(collection) + '/indexes';
  let pageToken = '';
  const indexes = [];
  const seenTokens = new Set();
  do {
    // The production Firestore Admin ListIndexes endpoint rejects nonzero pageSize
    // ("Only 0 is supported"). Omit pageSize entirely and follow nextPageToken.
    const path = pageToken ? parent + '?pageToken=' + encodeURIComponent(pageToken) : parent;
    const result = await request(path);
    indexes.push(...(result.indexes || []));
    const nextToken = result.nextPageToken || '';
    if (nextToken && seenTokens.has(nextToken)) {
      throw new Error('Firestore index pagination repeated a token; aborting incomplete audit.');
    }
    if (nextToken) seenTokens.add(nextToken);
    pageToken = nextToken;
  } while (pageToken);
  return indexes;
}
async function commission() {
  if (!['audit', 'create_missing'].includes(MODE)) throw new Error('Unsupported operation');
  if (MODE === 'create_missing' && process.env.FIRESTORE_CONFIRM_PROJECT !== PROJECT)
    throw new Error('Confirm the exact Firebase project ID before creating indexes.');
  const manifest = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8'));
  const indexes = manifest.indexes;
  if (!Array.isArray(indexes) || !indexes.length) throw new Error('Missing index manifest');
  const collections = [...new Set(indexes.map((i) => i.collectionGroup))];
  const liveByCollection = new Map();
  for (const collection of collections) liveByCollection.set(collection, await listIndexes(collection));
  const missing = [], ready = [], pending = [];
  for (const index of indexes) {
    const match = liveByCollection.get(index.collectionGroup)
      .find((item) => normalize(item) === normalize(index));
    if (!match) missing.push(index);
    else if (match.state === 'READY') ready.push(index);
    else pending.push({ index, state: match.state || 'UNKNOWN' });
  }
  console.log('Firebase index audit project=' + PROJECT + ' database=' + DATABASE);
  console.log('Declared=' + indexes.length + ' READY=' + ready.length +
    ' pending=' + pending.length + ' missing=' + missing.length);
  for (const p of pending) console.log('PENDING ' + summarize(p.index) + ' state=' + p.state);
  for (const i of missing) console.log('MISSING ' + summarize(i));
  if (MODE === 'audit') {
    if (missing.length || pending.length) {
      console.error('NOT READY: live composite indexes are missing or still building.');
      process.exitCode = 2;
    }
    return;
  }
  // Add only. No updates or deletes; no customer document read/writes.
  for (const i of missing) {
    const parent = '/collectionGroups/' + encodeURIComponent(i.collectionGroup) + '/indexes';
    const body = { queryScope: i.queryScope || 'COLLECTION', fields: i.fields };
    await request(parent, { method: 'POST', body: JSON.stringify(body) });
    console.log('CREATION ACCEPTED ' + summarize(i));
  }
  if (missing.length || pending.length) {
    console.warn('Indexes may take time to build. Re-run AUDIT until all are READY.');
    process.exitCode = 2;
  } else {
    console.log('READY: all repository composite indexes are already serving.');
  }
}
if (require.main === module) commission().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
module.exports = { normalize, summarize, listIndexes };
