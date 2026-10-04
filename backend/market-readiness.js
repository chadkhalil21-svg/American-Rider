// One national admission engine. Geography is not permission to sell transportation.
// This module is deliberately independent of Express, Stripe and any provider network call.
const { createHash } = require('node:crypto');
const { regionAdmissionProblems } = require('./market-admission');
const { forState: insuranceForState } = require('./insurance-jurisdictions');

const SCHEMA_VERSION = 2;
const REQUIRED_EVIDENCE = Object.freeze([
  'jurisdiction_authority', 'company_insurance_bound', 'operator_insurance_process',
  'screening_agreement', 'disclosure_and_retention', 'pricing_and_taxes',
  'routing_and_toll_rights', 'payment_and_reconciliation', 'provider_contracts',
  'safety_coverage', 'accessible_service', 'qualified_operator_supply',
  'backup_restore_drill', 'device_and_release_tests',
]);
// Approval to spend on screening, document review and Connect is narrower than permission
// to sell Travel. Operator supply and device-release tests must be proven afterwards.
const ONBOARDING_EVIDENCE = Object.freeze([
  'jurisdiction_authority', 'company_insurance_bound', 'operator_insurance_process',
  'screening_agreement', 'disclosure_and_retention', 'provider_contracts', 'safety_coverage',
]);
const ONBOARDING_PROVIDERS = new Set(['stripe_live_key', 'screening_provider', 'firebase_admin', 'ops_auth']);
const COLLECTION = 'market_admission';

function manifestFor(market, region) {
  if (!market || !region || market.regionId !== region.id) return null;
  const source = {
    schemaVersion: SCHEMA_VERSION, marketId: market.id, regionId: region.id,
    countyFips: market.fips, timezone: region.timezone,
    jurisdiction: region.jurisdiction, geographyEvidence: region.geographyEvidence,
    tollPolicy: region.tollPolicy, marketFips: region.marketFips,
    insurance: insuranceForState(region.jurisdiction?.stateCode)?.source || null,
    requiredEvidence: REQUIRED_EVIDENCE,
  };
  const version = createHash('sha256').update(JSON.stringify(source)).digest('hex');
  const sourceProblems = regionAdmissionProblems(region);
  if (market.status !== 'active') sourceProblems.push(`${market.id}: geographic market is not configured active`);
  if (!region.activeMarketFips?.includes(market.fips)) sourceProblems.push(`${market.id}: county is not in the region activation set`);
  if (!region.timezone) sourceProblems.push(`${market.id}: time zone is absent`);
  return { ...source, version, sourceProblems };
}

function requirementsFor(manifest, record = {}, now = Date.now(), providerMissing = [], level = 'commercial') {
  if (!manifest) return [{ id: 'source', reason: 'No configured market or service region' }];
  const missing = manifest.sourceProblems.map((reason) => ({ id: 'source', reason }));
  if (record.fleetCleanupPending) missing.push({ id: 'fleet_cleanup', reason: 'Operator availability cleanup after a market pause has not completed' });
  for (const id of level === 'onboarding' ? ONBOARDING_EVIDENCE : REQUIRED_EVIDENCE) {
    const proof = record.evidence?.[id];
    if (!proof || typeof proof !== 'object' ||
        proof.manifestVersion !== manifest.version ||
        !String(proof.reference || '').trim() || !String(proof.issuer || '').trim() ||
        !String(proof.verifiedBy || '').trim() ||
        !Number.isFinite(Number(proof.reviewedAt)) || Number(proof.reviewedAt) <= 0 ||
        !Number.isFinite(Number(proof.validUntil)) || Number(proof.validUntil) <= now) {
      missing.push({ id, reason: `${id}: independently reviewed, current evidence is required` });
    }
  }
  for (const id of providerMissing) missing.push({ id: `provider:${id}`, reason: `Production dependency is unavailable: ${id}` });
  return missing;
}

function readinessFor({ market, region, record = {}, now = Date.now(), providerMissing = [] }) {
  const manifest = manifestFor(market, region);
  const missing = requirementsFor(manifest, record, now, providerMissing);
  const onboardingMissing = requirementsFor(manifest, record, now,
    providerMissing.filter((id) => ONBOARDING_PROVIDERS.has(id)), 'onboarding');
  const versionCurrent = record.manifestVersion === manifest?.version;
  const active = record.status === 'active' && versionCurrent && missing.length === 0;
  const onboarding = (record.status === 'onboarding' || record.status === 'active') &&
    versionCurrent && onboardingMissing.length === 0;
  return {
    marketId: market?.id || null, manifestVersion: manifest?.version || null,
    status: active ? 'active' : onboarding ? 'onboarding' : 'waitlist',
    storedStatus: record.status || 'waitlist', readyToOnboard: onboardingMissing.length === 0,
    readyToActivate: missing.length === 0, onboardingMissing, missing,
    evidenceCount: REQUIRED_EVIDENCE.length, fleetCleanupPending: !!record.fleetCleanupPending,
  };
}

async function inspectMarket({ db, market, region, providerMissing = [], now = Date.now() }) {
  if (!db || !market) return readinessFor({ market, region, providerMissing: ['database'], now });
  try {
    const snap = await db.collection(COLLECTION).doc(market.id).get();
    return readinessFor({ market, region, record: snap.exists ? snap.data() : {}, providerMissing, now });
  } catch {
    return readinessFor({ market, region, providerMissing: ['database'], now });
  }
}

function validEvidenceInput(domain, input) {
  if (!REQUIRED_EVIDENCE.includes(domain)) return null;
  const reference = String(input?.reference || '').trim().slice(0, 500);
  const issuer = String(input?.issuer || '').trim().slice(0, 120);
  const validUntil = Number(input?.validUntil);
  if (reference.length < 8 || issuer.length < 3 || !Number.isSafeInteger(validUntil)) return null;
  return { reference, issuer, validUntil };
}

// A named, MFA-authenticated Operations user may register an externally verified reference.
// Recording evidence pauses an active market; a separate readiness check and activation is needed.
async function recordEvidence({ db, market, region, domain, input, actor, expectedVersion, now = Date.now() }) {
  const proof = validEvidenceInput(domain, input);
  const manifest = manifestFor(market, region);
  if (!db || !manifest || !actor || !proof || proof.validUntil <= now) return { ok: false, code: 'invalid_evidence' };
  if (expectedVersion !== manifest.version) return { ok: false, code: 'stale_manifest' };
  const ref = db.collection(COLLECTION).doc(market.id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref); const prior = snap.exists ? snap.data() : {};
    tx.set(ref, {
      evidence: { ...(prior.evidence || {}), [domain]: { ...proof, manifestVersion: manifest.version,
        verifiedBy: actor, reviewedAt: now } },
      status: 'paused', updatedAt: now, updatedBy: actor,
      ...(prior.status === 'active' || prior.status === 'onboarding'
        ? { fleetCleanupPending: true, fleetCleanupCursor: null } : {}),
    }, { merge: true });
    tx.create(db.collection('audit_log').doc(), {
      at: now, action: 'market_evidence_recorded', marketId: market.id,
      domain, manifestVersion: manifest.version,
      actor: { name: actor, method: 'named_ops_mfa' }, reference: proof.reference,
    });
    return { ok: true, status: 'paused' };
  });
}

async function activateMarket({ db, market, region, actor, expectedVersion, providerMissing = [], now = Date.now() }) {
  if (!db || !market || !actor || !expectedVersion) return { ok: false, code: 'invalid_request' };
  const manifest = manifestFor(market, region);
  if (!manifest || expectedVersion !== manifest.version) return { ok: false, code: 'stale_manifest' };
  const ref = db.collection(COLLECTION).doc(market.id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref); const prior = snap.exists ? snap.data() : {};
    const checked = readinessFor({ market, region, record: prior, providerMissing, now });
    if (!checked.readyToActivate) return { ok: false, code: 'market_not_ready', ...checked };
    tx.set(ref, { status: 'active', manifestVersion: manifest.version,
      activatedAt: now, activatedBy: actor, updatedAt: now }, { merge: true });
    tx.create(db.collection('audit_log').doc(), {
      at: now, action: 'market_activated', marketId: market.id, manifestVersion: manifest.version,
      actor: { name: actor, method: 'named_ops_mfa' },
    });
    return { ok: true, status: 'active', manifestVersion: manifest.version };
  });
}

async function authorizeOnboarding({ db, market, region, actor, expectedVersion, providerMissing = [], now = Date.now() }) {
  if (!db || !market || !actor || !expectedVersion) return { ok: false, code: 'invalid_request' };
  const manifest = manifestFor(market, region);
  if (!manifest || expectedVersion !== manifest.version) return { ok: false, code: 'stale_manifest' };
  const ref = db.collection(COLLECTION).doc(market.id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref); const prior = snap.exists ? snap.data() : {};
    const checked = readinessFor({ market, region, record: prior, providerMissing, now });
    if (!checked.readyToOnboard) return { ok: false, code: 'onboarding_not_ready', ...checked };
    if (checked.status === 'active') return { ok: false, code: 'already_active' };
    tx.set(ref, { status: 'onboarding', manifestVersion: manifest.version,
      onboardingAt: now, onboardingBy: actor, updatedAt: now }, { merge: true });
    tx.create(db.collection('audit_log').doc(), { at: now, action: 'market_onboarding_authorized',
      marketId: market.id, manifestVersion: manifest.version,
      actor: { name: actor, method: 'named_ops_mfa' } });
    return { ok: true, status: 'onboarding', manifestVersion: manifest.version };
  });
}

async function pauseMarket({ db, market, actor, reason, now = Date.now() }) {
  if (!db || !market || !actor || String(reason || '').trim().length < 8) return { ok: false, code: 'reason_required' };
  const ref = db.collection(COLLECTION).doc(market.id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || !['active', 'onboarding'].includes(snap.data().status)) return { ok: false, code: 'not_active' };
    tx.update(ref, { status: 'paused', pausedAt: now, pausedBy: actor, pauseReason: String(reason).slice(0, 500),
      fleetCleanupPending: true, fleetCleanupCursor: null });
    tx.create(db.collection('audit_log').doc(), {
      at: now, action: 'market_paused', marketId: market.id,
      actor: { name: actor, method: 'named_ops_mfa' }, reason: String(reason).slice(0, 500),
    });
    return { ok: true, status: 'paused' };
  });
}

module.exports = { SCHEMA_VERSION, REQUIRED_EVIDENCE, ONBOARDING_EVIDENCE,
  manifestFor, requirementsFor, readinessFor, inspectMarket, recordEvidence,
  activateMarket, authorizeOnboarding, pauseMarket };
