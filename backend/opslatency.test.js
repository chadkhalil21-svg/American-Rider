'use strict';
const assert = require('node:assert/strict');
const { withinDeadline, OPS_MFA_DEADLINE_MS, OPS_BOARD_DEADLINE_MS } = require('./opslatency');
(async () => {
  assert.equal(OPS_MFA_DEADLINE_MS, 8000);
  assert.equal(OPS_BOARD_DEADLINE_MS, 8000);
  assert.equal(await withinDeadline(async () => 'response', 100), 'response');
  await assert.rejects(withinDeadline(async () => { throw new Error('database rejected'); }, 100), /database rejected/);
  const began = Date.now();
  const unresolved = new Promise(() => {});
  await assert.rejects(withinDeadline(() => unresolved, 20), e => e.code === 'OPS_STORAGE_TIMEOUT');
  assert.ok(Date.now() - began < 250, 'timeout must not wait for a Firestore SDK retry');
  assert.throws(() => withinDeadline(() => 0, 0), /Invalid Operations deadline/);
  assert.throws(() => withinDeadline(() => 0, 70000), /Invalid Operations deadline/);
  // Delayed underlying operations are not interpreted as success by the caller;
  // live sign-in logic must not issue sessions from the timed-out result.
  console.log('PASS Operations authentication and dashboard deadlines fail fast');
})().catch(e => { console.error(e); process.exitCode = 1; });
