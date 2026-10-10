'use strict';
const assert = require('node:assert/strict');
const { singleFlight } = require('./sweep-singleflight');

(async () => {
  let executions = 0;
  let finish;
  const gate = new Promise((resolve) => { finish = resolve; });
  const run = singleFlight(async () => {
    executions++;
    await gate;
    return { ok: true, completed: true };
  });
  const first = run();
  const competing = await Promise.all(Array.from({ length: 1000 }, () => run()));
  assert.equal(executions, 1, 'only one sweep may enter');
  assert.ok(competing.every((x) => x.skipped === 'same-instance sweep already running'));
  finish();
  assert.equal((await first).completed, true);
  assert.equal((await run()).completed, true);
  assert.equal(executions, 2, 'guard must reopen after completion');

  let attempts = 0;
  const retry = singleFlight(async () => {
    if (++attempts === 1) throw new Error('simulated sweep failure');
    return 'recovered';
  });
  await assert.rejects(retry(), /simulated sweep failure/);
  assert.equal(await retry(), 'recovered', 'guard must reopen after rejection');
  console.log('PASS  same-instance 1000-way contention, completion and failure recovery');
})().catch((e) => { console.error(e); process.exitCode = 1; });
