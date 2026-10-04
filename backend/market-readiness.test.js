const assert = require('node:assert/strict');
const M = require('./market-readiness');
const { markets } = require('./markets');
const { regionById } = require('./regions');
const market = markets().find((m) => m.id === 'fl-miami-dade');
const region = regionById(market.regionId);
const manifest = M.manifestFor(market, region);
assert.equal(manifest.sourceProblems.length, 0);
assert.equal(M.readinessFor({ market, region }).status, 'waitlist');
assert.equal(M.readinessFor({ market, region }).missing.length, M.REQUIRED_EVIDENCE.length);

const now = 1_800_000_000_000;
const evidence = Object.fromEntries(M.REQUIRED_EVIDENCE.map((id) => [id, {
  reference: `external-record-${id}`, issuer: 'Verified external authority',
  verifiedBy: 'named-ops', reviewedAt: now - 5_000, validUntil: now + 10_000,
}]));
const rec = { status: 'active', manifestVersion: manifest.version, evidence };
assert.equal(M.readinessFor({ market, region, record: rec, now }).status, 'active');
assert.equal(M.readinessFor({ market, region, record: rec, now: now + 10_001 }).status, 'waitlist', 'expired evidence stops offers');
assert.equal(M.readinessFor({ market, region, record: { ...rec, manifestVersion: 'old' }, now }).status, 'waitlist', 'source drift stops offers');
assert.equal(M.readinessFor({ market, region, record: rec, now, providerMissing: ['stripe_live_key'] }).status, 'waitlist');
assert.equal(M.readinessFor({ market: null, region: null, now }).status, 'waitlist');

function memoryDb() {
  const data = new Map(); const writes = [];
  const collection = (name) => ({ doc: (id) => {
    id ||= `audit-${writes.length + 1}`;
    const key = `${name}/${id}`;
    return { id, key, async get() { return { exists: data.has(key), data: () => data.get(key) }; } };
  } });
  return { data, writes, collection, async runTransaction(fn) {
    const tx = {
      get: (ref) => ref.get(),
      set: (ref, value, opts) => { data.set(ref.key, opts?.merge ? { ...data.get(ref.key), ...value } : value); writes.push(['set', ref.key]); },
      update: (ref, value) => { data.set(ref.key, { ...data.get(ref.key), ...value }); writes.push(['update', ref.key]); },
      create: (ref, value) => { assert.equal(data.has(ref.key), false); data.set(ref.key, value); writes.push(['create', ref.key]); },
    };
    return fn(tx);
  } };
}
(async () => {
  const db = memoryDb();
  assert.equal((await M.inspectMarket({ db, market, region, now })).status, 'waitlist');
  assert.equal((await M.activateMarket({ db, market, region, actor: 'named-ops', expectedVersion: manifest.version, now })).code, 'market_not_ready');
  for (const id of M.ONBOARDING_EVIDENCE) {
    const out = await M.recordEvidence({ db, market, domain: id, actor: 'named-ops', now,
      input: { reference: `external-record-${id}`, issuer: 'Independent issuer', validUntil: now + 10_000 } });
    assert.deepEqual(out, { ok: true, status: 'paused' });
  }
  const staged = await M.authorizeOnboarding({ db, market, region, actor: 'named-ops', expectedVersion: manifest.version, now });
  assert.equal(staged.status, 'onboarding');
  assert.equal((await M.inspectMarket({ db, market, region, now })).status, 'onboarding');
  assert.equal((await M.activateMarket({ db, market, region, actor: 'named-ops', expectedVersion: manifest.version, now })).code, 'market_not_ready');
  for (const id of M.REQUIRED_EVIDENCE.filter((domain) => !M.ONBOARDING_EVIDENCE.includes(domain))) {
    await M.recordEvidence({ db, market, domain: id, actor: 'named-ops', now,
      input: { reference: `external-record-${id}`, issuer: 'Independent issuer', validUntil: now + 10_000 } });
  }
  assert.equal((await M.inspectMarket({ db, market, region, now })).readyToActivate, true);
  assert.equal((await M.activateMarket({ db, market, region, actor: 'named-ops', expectedVersion: 'stale', now })).code, 'stale_manifest');
  assert.equal((await M.activateMarket({ db, market, region, actor: 'named-ops', expectedVersion: manifest.version, now, providerMissing: ['stripe'] })).code, 'market_not_ready');
  const activated = await M.activateMarket({ db, market, region, actor: 'named-ops', expectedVersion: manifest.version, now });
  assert.equal(activated.status, 'active');
  assert.equal((await M.inspectMarket({ db, market, region, now })).status, 'active');
  const paused = await M.pauseMarket({ db, market, actor: 'named-ops', reason: 'Carrier lapse in this market', now: now + 1 });
  assert.equal(paused.status, 'paused');
  assert.equal((await M.inspectMarket({ db, market, region, now })).status, 'waitlist');
  assert.equal(db.data.get('audit_log/audit-2')?.actor?.name, 'named-ops');
  console.log('PASS versioned market admission, expiry, production dependencies, audited evidence, activate and pause');
})().catch((error) => { console.error(error); process.exitCode = 1; });
