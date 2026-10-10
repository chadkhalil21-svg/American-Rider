'use strict';
const assert = require('node:assert/strict');
const firebasePath = require.resolve('./firebase-admin');
const previous = require.cache[firebasePath];
let dropped = false;
require.cache[firebasePath] = { id: firebasePath, filename: firebasePath, loaded: true, exports: {
  adminDb: () => ({ collection: () => ({ doc: () => ({
    get: async () => ({ exists: true, data: () => ({ pushToken: 'SYNTHETIC-TOKEN' }) }),
    set: async () => { dropped = true; },
  }) }) }),
} };
const { notify } = require('./push');
const originalFetch = global.fetch;
async function send(status, body) {
  global.fetch = async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal, 'network call must have a timeout signal');
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return notify({ uid: 'synthetic', kind: 'insurance_verification_due', title: 'Test', body: 'Test' });
}
async function main() {
  for (const status of [400, 429, 500, 503]) {
    assert.equal((await send(status, { data: { status: 'ok', id: 'invalid-http-ticket' } })).ok, false);
  }
  for (const body of [{}, { errors: [{ message: 'Rejected' }] }, { data: {} },
    { data: { status: 'ok' } }, { data: { status: 'ok', id: ' ' } },
    { data: [{ status: 'ok', id: 'unexpected-array' }] }]) {
    assert.equal((await send(200, body)).ok, false);
  }
  assert.deepEqual(await send(200, { data: { status: 'ok', id: 'valid-ticket' } }),
    { ok: true, id: 'valid-ticket' });
  assert.equal((await send(200, { data: { status: 'error', details: { error: 'DeviceNotRegistered' } } })).ok, false);
  assert.equal(dropped, true);
  global.fetch = async () => { throw new Error('timeout'); };
  assert.equal((await notify({ uid: 'synthetic', kind: 'insurance_verification_due' })).ok, false);
  global.fetch = async () => ({ ok: true, status: 200, json: async () => { throw new Error('invalid JSON'); } });
  assert.equal((await notify({ uid: 'synthetic', kind: 'insurance_verification_due' })).ok, false);
  console.log('PASS: push HTTP/schema rejection, acceptance tickets, timeouts and invalid-device handling');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => {
  global.fetch = originalFetch;
  if (previous) require.cache[firebasePath] = previous;
  else delete require.cache[firebasePath];
});
