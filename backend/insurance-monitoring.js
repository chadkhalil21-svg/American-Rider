// Continuing commercial-insurance status for Operators.
//
// A declarations page proves what a policy says at the moment it is issued. It cannot prove that
// a carrier did not cancel the policy mid-term. This module keeps those two facts separate:
//   document compliance  -> backend/qualification.js
//   continuing status    -> this file
//
// The platform accepts evidence from any qualifying carrier/agent/broker. It is deliberately
// carrier-neutral: local commercial/livery markets, surplus-lines placements and national
// carriers are treated identically when the policy satisfies the jurisdiction's requirements.
//
// No AI model is allowed to invent "active". AI may read carrier/broker evidence; a deterministic
// state machine decides whether that evidence is fresh enough to permit service.
const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_INTERVAL_DAYS = 30;
const STATUS_GRACE_DAYS = 5;
const STATUS_MAX_AGE_MS = (STATUS_INTERVAL_DAYS + STATUS_GRACE_DAYS) * DAY_MS;

const ADVERSE = new Set([
  'pending_cancellation',
  'cancelled',
  'nonrenewed',
  'coverage_reduced',
  'vehicle_removed',
  'unverified',
]);

function cleanStatus(v) {
  const s = String(v || '').trim().toLowerCase();
  return [
    'verified_active',
    'pending_cancellation',
    'cancelled',
    'nonrenewed',
    'coverage_reduced',
    'vehicle_removed',
    'unverified',
  ].includes(s) ? s : 'unverified';
}

function policyIdentityFromDocument(doc = {}) {
  const i = doc?.evidence?.insurance || {};
  return {
    insurer: String(i.insurer || '').trim(),
    policyNumber: String(i.policyNumber || '').trim(),
    effectiveDate: String(i.effectiveDate || '').trim(),
    expirationDate: String(i.expirationDate || doc?.expiry || '').trim(),
  };
}

function initialMonitoringFromDocument(doc, now = Date.now()) {
  const p = policyIdentityFromDocument(doc);
  return {
    status: 'verified_active',
    source: 'onboarding_document',
    lastVerifiedAt: now,
    operatorAttestedAt: now,
    nextVerificationDueAt: now + STATUS_INTERVAL_DAYS * DAY_MS,
    statusMaxAgeDays: STATUS_INTERVAL_DAYS + STATUS_GRACE_DAYS,
    ...p,
  };
}

function continuingStatus(user, now = Date.now()) {
  const m = user?.insuranceMonitoring || null;
  if (!m) {
    return {
      ok: false,
      code: 'insurance_status_unverified',
      status: 'unverified',
      reason: 'Current insurance status has not been verified.',
      nextVerificationDueAt: null,
    };
  }

  const status = cleanStatus(m.status);
  if (ADVERSE.has(status)) {
    const reason = {
      pending_cancellation: 'The insurer or broker has reported a pending cancellation.',
      cancelled: 'The insurance policy is reported cancelled.',
      nonrenewed: 'The insurance policy is reported nonrenewed.',
      coverage_reduced: 'The policy changed and must be checked again before service.',
      vehicle_removed: 'The registered vehicle is no longer confirmed on the policy.',
      unverified: 'Current insurance status cannot be verified.',
    }[status];
    return { ok: false, code: `insurance_${status}`, status, reason, nextVerificationDueAt: m.nextVerificationDueAt || null };
  }

  const verifiedAt = Number(m.lastVerifiedAt) || 0;
  if (!verifiedAt || now - verifiedAt > STATUS_MAX_AGE_MS) {
    return {
      ok: false,
      code: 'insurance_status_stale',
      status: 'unverified',
      reason: 'Current policy status is due for re-verification before service can continue.',
      nextVerificationDueAt: m.nextVerificationDueAt || null,
    };
  }

  const attestedAt = Number(m.operatorAttestedAt) || 0;
  if (!attestedAt || now - attestedAt > STATUS_MAX_AGE_MS) {
    return {
      ok: false,
      code: 'insurance_attestation_due',
      status: 'unverified',
      reason: 'Confirm that your policy remains active and unchanged before entering service.',
      nextVerificationDueAt: m.nextVerificationDueAt || null,
    };
  }

  return {
    ok: true,
    code: null,
    status: 'verified_active',
    reason: null,
    source: m.source || null,
    lastVerifiedAt: verifiedAt,
    operatorAttestedAt: attestedAt,
    nextVerificationDueAt: m.nextVerificationDueAt || verifiedAt + STATUS_INTERVAL_DAYS * DAY_MS,
  };
}

function applyOperatorAttestation(monitoring, now = Date.now()) {
  const m = monitoring || {};
  return {
    ...m,
    operatorAttestedAt: now,
    operatorAttestation: {
      at: now,
      statement: 'Coverage remains active and unchanged; no cancellation, nonrenewal, vehicle removal, or material reduction has been received.',
    },
  };
}

function applyIndependentConfirmation(monitoring, {
  status = 'verified_active',
  source = 'broker',
  actor = null,
  note = null,
  now = Date.now(),
} = {}) {
  const s = cleanStatus(status);
  return {
    ...(monitoring || {}),
    status: s,
    source: String(source || 'broker').slice(0, 40),
    lastVerifiedAt: now,
    nextVerificationDueAt: now + STATUS_INTERVAL_DAYS * DAY_MS,
    confirmation: { at: now, source: String(source || 'broker').slice(0, 40), actor, note: note || null },
  };
}

function providerInstructions() {
  return {
    publicOperatorContact: 'relations@americanrider.app',
    insuranceEvidenceContact: 'insurance@americanrider.app',
    cadenceDays: STATUS_INTERVAL_DAYS,
    graceDays: STATUS_GRACE_DAYS,
    acceptedSources: [
      'carrier or managing general agent',
      'licensed insurance agent or broker',
      'commercial/livery insurance provider',
      'eligible insurance-monitoring network',
    ],
  };
}

module.exports = {
  DAY_MS,
  STATUS_INTERVAL_DAYS,
  STATUS_GRACE_DAYS,
  STATUS_MAX_AGE_MS,
  cleanStatus,
  policyIdentityFromDocument,
  initialMonitoringFromDocument,
  continuingStatus,
  applyOperatorAttestation,
  applyIndependentConfirmation,
  providerInstructions,
};