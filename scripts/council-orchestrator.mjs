import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const protocol = JSON.parse(fs.readFileSync('council/agent-protocol.json', 'utf8'));
const roles = JSON.parse(fs.readFileSync('council/roles.json', 'utf8'));
const inventoryPath = 'artifacts/council/inventory.json';
if (!fs.existsSync(inventoryPath)) {
  console.error('Council inventory is required before an institutional run.');
  process.exit(1);
}
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
if (inventory.candidateSha !== sha) {
  console.error('Inventory SHA does not match candidate SHA.');
  process.exit(1);
}
const runId = 'council-' + sha.slice(0, 12);
const claims = protocol.commissioningCases.map((c) => ({
  claimId: c.caseId,
  candidateSha: sha,
  proposition: c.proposition,
  domain: 'commissioning',
  producer: 'orchestrator',
  status: 'PROPOSED',
  evidence: [],
  counterEvidence: [],
  dependencies: c.requiredTraces,
  purpose: c.purpose
}));
const graph = {
  schemaVersion: '0.1',
  runId,
  candidateSha: sha,
  createdAt: new Date().toISOString(),
  organization: roles.organization,
  protocolVersion: protocol.version,
  phase: 'GROUND_TRUTH_READY',
  roleCount: roles.roles.length,
  roles: roles.roles.map((r) => r.id),
  denominators: inventory.counts,
  claims
};
fs.mkdirSync('artifacts/council', { recursive: true });
fs.writeFileSync('artifacts/council/run.json', JSON.stringify(graph, null, 2) + '\n');
console.log(JSON.stringify({ runId, candidateSha: sha, phase: graph.phase, roleCount: graph.roleCount, claimCount: claims.length }, null, 2));
