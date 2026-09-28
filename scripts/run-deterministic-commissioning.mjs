import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const cases = [
  ['journey progression / adversarial transitions', 'backend/travelprogress.test.js'],
  ['dispatch and production fail-closed gates', 'backend/dispatchgate.test.js'],
  ['dispatch failure recovery', 'backend/dispatchfailure.test.js'],
  ['payment idempotency', 'backend/idempotency.test.js'],
  ['fare / charge reconciliation', 'backend/payments.test.js'],
  ['Travel money authority', 'backend/travelmoney.test.js'],
  ['settlement after client loss / restart', 'backend/settle.test.js'],
  ['provider durable receipt / crash replay', 'backend/providerqueue.durability.test.js'],
  ['provider queue retry / idempotency', 'backend/providerqueue.test.js'],
  ['refund exposure', 'backend/refundexposure.test.js'],
  ['Smart Travel economics', 'backend/smarttravel.test.js'],
  ['Smart Travel continuation / restart reconstruction', 'backend/smartcontinuity.test.js'],
  ['Smart Travel server authority', 'backend/smartauthority.test.js'],
  ['Smart Travel provider fallback', 'backend/smartfallback.test.js'],
  ['transit mapping / provider failure behavior', 'backend/transit.test.js'],
  ['toll authority / failure behavior', 'backend/tolls.test.js'],
  ['scheduler lease / concurrent sweeps', 'backend/schedulerlease.test.js'],
  ['cross-module launch failures', 'backend/launchfailure.test.js'],
  ['release invariants', 'backend/releaseinvariants.test.js'],
];

const startedAt = new Date().toISOString();
const results = [];
for (const [name, file] of cases) {
  const run = spawnSync(process.execPath, [file], { encoding: 'utf8', env: process.env });
  const ok = run.status === 0;
  results.push({ name, file, ok, exitCode: run.status, stdout: run.stdout, stderr: run.stderr });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  [${file}]`);
  if (!ok) {
    if (run.stdout) process.stdout.write(run.stdout);
    if (run.stderr) process.stderr.write(run.stderr);
  }
}
const failed = results.filter(x => !x.ok);
const report = {
  schema: 1,
  campaign: 'deterministic-commissioning',
  startedAt,
  completedAt: new Date().toISOString(),
  evidenceClass: 'automated-deterministic',
  scope: {
    proves: [
      'server-authoritative journey state transitions and rejection of adversarial transitions',
      'payment idempotency and fare/fee/operator-share reconciliation',
      'settlement recovery when the client is absent or restarted',
      'durable provider-event receipt, retry, lease recovery and duplicate suppression',
      'Smart Travel persistence/continuation authority and multi-charge economics',
      'transit/toll/provider failure behavior represented by deterministic fixtures or injected failures',
      'scheduler concurrency and production fail-closed invariants'
    ],
    doesNotProve: [
      'native OS background scheduling or location delivery',
      'physical-device permission behavior, rendering, thermal or battery behavior',
      'production provider acceptance, bank payout timing, push delivery or live carrier behavior',
      'a public transit feed is currently reachable unless the optional live integration campaign is separately executed'
    ]
  },
  result: failed.length ? 'fail' : 'pass',
  cases: results.map(({name,file,ok,exitCode}) => ({name,file,result:ok?'pass':'fail',exitCode}))
};
fs.mkdirSync('artifacts/commissioning', { recursive: true });
fs.writeFileSync('artifacts/commissioning/deterministic-commissioning.json', JSON.stringify(report,null,2)+'\n');
console.log(`\n${results.length-failed.length}/${results.length} deterministic commissioning cases passed`);
console.log('evidence: artifacts/commissioning/deterministic-commissioning.json');
process.exit(failed.length ? 1 : 0);
