const assert = require('node:assert/strict');
const M = require('./market-readiness');
const { markets } = require('./markets');
const { regionById } = require('./regions');
const market = markets().find((m) => m.id === 'fl-miami-dade');
const region = regionById(market.regionId);
const manifest = M.manifestFor(market, region);
assert.equal(manifest.sourceProblems.length, 0);
assert.equal(M.readinessFor({ market, region }).status, 'waitlist');
assert.deepEqual(M.readinessFor({ market, region }).missing.map(x=>x.id), [M.RELEASE_PACKET], 'one source record replaces 14 county filings');

const now = 1_800_000_000_000;
const evidence = Object.fromEntries(M.REQUIRED_EVIDENCE.map((id) => [id, {
  reference: `external-record-${id}`, issuer: 'Verified external authority',
  verifiedBy: 'named-ops', reviewedAt: now - 5_000, validUntil: now + 10_000,
  manifestVersion: manifest.version,
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
    const out = await M.recordEvidence({ db, market, region, domain: id, actor: 'named-ops',
      expectedVersion: manifest.version, now,
      input: { reference: `external-record-${id}`, issuer: 'Independent issuer', validUntil: now + 10_000 } });
    assert.deepEqual(out, { ok: true, status: 'paused' });
  }
  const staged = await M.authorizeOnboarding({ db, market, region, actor: 'named-ops', expectedVersion: manifest.version, now });
  assert.equal(staged.status, 'onboarding');
  assert.equal((await M.inspectMarket({ db, market, region, now })).status, 'onboarding');
  assert.equal((await M.activateMarket({ db, market, region, actor: 'named-ops', expectedVersion: manifest.version, now })).code, 'market_not_ready');
  for (const id of M.REQUIRED_EVIDENCE.filter((domain) => !M.ONBOARDING_EVIDENCE.includes(domain))) {
    await M.recordEvidence({ db, market, region, domain: id, actor: 'named-ops',
      expectedVersion: manifest.version, now,
      input: { reference: `external-record-${id}`, issuer: 'Independent issuer', validUntil: now + 10_000 } });
  }
  assert.equal(db.data.get(`market_admission/${market.id}`).fleetCleanupPending,true,
    'reviewing evidence while intake is enabled pauses intake and queues fleet cleanup');
  assert.equal((await M.inspectMarket({ db, market, region, now })).readyToActivate,false);
  // The dedicated market-fleet test exercises cleanup; only after that work may Ops reactivate.
  db.data.get(`market_admission/${market.id}`).fleetCleanupPending=false;
  assert.equal((await M.inspectMarket({ db, market, region, now })).readyToActivate, true);
  assert.equal((await M.activateMarket({ db, market, region, actor: 'named-ops', expectedVersion: 'stale', now })).code, 'stale_manifest');
  assert.equal((await M.activateMarket({ db, market, region, actor: 'named-ops', expectedVersion: manifest.version, now, providerMissing: ['stripe'] })).code, 'market_not_ready');
  const activated = await M.activateMarket({ db, market, region, actor: 'named-ops', expectedVersion: manifest.version, now });
  assert.equal(activated.status, 'active');
  assert.equal((await M.inspectMarket({ db, market, region, now })).status, 'active');
  const changedRegion = { ...region, timezone: 'America/New_York-v2' };
  const changed = M.manifestFor(market, changedRegion);
  assert.notEqual(changed.version, manifest.version);
  assert.equal((await M.inspectMarket({ db, market, region: changedRegion, now })).status, 'waitlist');
  assert.equal((await M.activateMarket({ db, market, region: changedRegion, actor: 'named-ops',
    expectedVersion: changed.version, now })).code, 'market_not_ready');
  assert.equal((await M.recordEvidence({ db, market, region: changedRegion, domain: 'company_insurance_bound',
    actor: 'named-ops', expectedVersion: manifest.version, now,
    input: { reference: 'old-manifest-review', issuer: 'Independent issuer', validUntil: now+10_000 } })).code, 'stale_manifest');
  const paused = await M.pauseMarket({ db, market, actor: 'named-ops', reason: 'Carrier lapse in this market', now: now + 1 });
  assert.equal(paused.status, 'paused');
  assert.equal(db.data.get(`market_admission/${market.id}`).fleetCleanupPending,true);
  assert.equal((await M.inspectMarket({ db, market, region, now })).status, 'waitlist');
  assert.equal(db.data.get('audit_log/audit-2')?.actor?.name, 'named-ops');
  // The new one-record path must demonstrably replace fourteen separate
  // attestations, without bypassing live dependencies or revision matching.
  // These fixtures are synthetic unit-test data and never production approval.
  const priorRenderSha = process.env.RENDER_GIT_COMMIT;
  process.env.RENDER_GIT_COMMIT = 'a'.repeat(40);
  try {
    const regionMarkets = markets().filter(m => m.regionId === region.id);
    const entries = regionMarkets.map(m => ({market:m,region}));
    const versions = Object.fromEntries(entries.map(e => [e.market.id, M.manifestFor(e.market,region).version]));
    const packetDb=memoryDb();
    const attestation={
      reference:'secure-release-evidence-file',issuer:'Independent reviewer',
      validUntil:now+10_000,releaseSha:'a'.repeat(40),
      packetDigest:'b'.repeat(64),allDomainsReviewed:true,allCountiesVerified:true,
    };
    const invalid=await M.recordRegionEvidence({db:packetDb,entries,
      domain:M.RELEASE_PACKET, input:{...attestation,packetDigest:'not-a-digest'},
      actor:'named-ops',expectedVersions:versions,now});
    assert.equal(invalid.code,'invalid_evidence');
    assert.equal(packetDb.writes.length,0,'no partial or invented attestation');
    const recorded=await M.recordRegionEvidence({db:packetDb,entries,
      domain:M.RELEASE_PACKET,input:attestation,actor:'named-ops',expectedVersions:versions,now});
    assert.equal(recorded.code,'region_evidence_recorded');
    assert.equal(recorded.marketIds.length,3);
    for(const e of entries){
      const state=await M.inspectMarket({db:packetDb,market:e.market,region,now});
      assert.deepEqual(state.missing,[],'single reviewed packet replaces all 14 filings');
      const proof=packetDb.data.get('market_admission/'+e.market.id).evidence[M.RELEASE_PACKET];
      assert.equal(proof.packetDigest,'b'.repeat(64));
      assert.equal(proof.releaseSha,'a'.repeat(40));
    }
    const blocked=await M.activateRegion({db:packetDb,entries,actor:'named-ops',
      expectedVersions:versions,providerMissing:['screening_provider'],now});
    assert.equal(blocked.code,'region_not_ready','real provider problems remain effective');
    assert.equal(blocked.missing[0].id,'provider:screening_provider');
    const opened=await M.activateRegion({db:packetDb,entries,actor:'named-ops',
      expectedVersions:versions,now});
    assert.equal(opened.code,'region_activated');
    assert.equal(opened.newlyOpened.length,3);
    const stale=packetDb.data.get('market_admission/'+entries[0].market.id);
    stale.evidence[M.RELEASE_PACKET].releaseSha='c'.repeat(40);
    assert.equal(M.readinessFor({market:entries[0].market,region,record:stale,now}).status,
      'waitlist','an incorrect candidate SHA does not certify paid bookings');
    assert.equal(M.readinessFor({market:entries[1].market,region,
      record:packetDb.data.get('market_admission/'+entries[1].market.id),
      now:now+10_001}).status,'waitlist','expired packet stops paid bookings');
  } finally {
    if (priorRenderSha===undefined) delete process.env.RENDER_GIT_COMMIT;
    else process.env.RENDER_GIT_COMMIT=priorRenderSha;
  }
  console.log('PASS single verified region packet, reject fabricated metadata, dependency and SHA checks');
  console.log('PASS versioned market admission, expiry, production dependencies, audited evidence, activate and pause');
})().catch((error) => { console.error(error); process.exitCode = 1; });
