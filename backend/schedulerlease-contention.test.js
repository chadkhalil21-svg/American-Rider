'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const records = new Map();
const db = {
  collection(collection) {
    return { doc(id) { return { key: collection + '/' + id }; } };
  },
  async runTransaction(fn) {
    const writes = [];
    const tx = {
      async get(ref) {
        const saved = records.get(ref.key);
        return { exists: !!saved, data: () => saved || {} };
      },
      set(ref, value, options) {
        writes.push([ref.key, value, options?.merge]);
      },
    };
    const result = await fn(tx);
    for (const [key, value, merge] of writes) {
      records.set(key, merge ? { ...(records.get(key) || {}), ...value } : value);
    }
    return result;
  },
};
const sandbox = {
  module: { exports: {} },
  require(id) {
    if (id === 'node:crypto') return crypto;
    if (id === './firebase-admin') return {
      adminDb: () => db,
      adminStatus: () => ({ reason: 'mock failure' }),
    };
    throw new Error('Unexpected dependency ' + id);
  },
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'schedulerlease.js'), 'utf8'), sandbox);
const { acquireLease, renewLease, releaseLease } = sandbox.module.exports;

(async () => {
  const at = 1_000_000;
  const a = await acquireLease('operations_sweep', { owner: 'worker-a', now: at, ttlMs: 5_000 });
  assert.equal(a.acquired, true);
  const reentrant = await acquireLease('operations_sweep', { owner: 'worker-a', now: at + 1, ttlMs: 5_000 });
  assert.equal(reentrant.acquired, false, 'same worker cannot start another concurrent sweep');
  const competitor = await acquireLease('operations_sweep', { owner: 'worker-b', now: at + 1, ttlMs: 5_000 });
  assert.equal(competitor.acquired, false, 'other worker must also wait');
  assert.equal((await renewLease('operations_sweep', { owner: 'worker-b', now: at + 100 })).renewed, false);
  assert.equal((await renewLease('operations_sweep', { owner: 'worker-a', now: at + 1_000, ttlMs: 5_000 })).renewed, true);
  assert.equal((await releaseLease('operations_sweep', { owner: 'worker-b' })).released, false);
  assert.equal((await acquireLease('operations_sweep', { owner: 'worker-b', now: at + 2_000 })).acquired, false);
  assert.equal((await releaseLease('operations_sweep', { owner: 'worker-a' })).released, true);
  assert.equal((await acquireLease('operations_sweep', { owner: 'worker-b', now: at + 2_001, ttlMs: 5_000 })).acquired, true);
  assert.equal((await renewLease('operations_sweep', { owner: 'worker-a', now: at + 2_002 })).renewed, false);
  assert.equal((await acquireLease('operations_sweep', { owner: 'worker-a', now: at + 8_000, ttlMs: 5_000 })).acquired, true);
  console.log('PASS  lease reentrancy, ownership, renewal, release and expiry');
})().catch((e) => { console.error(e); process.exitCode = 1; });
