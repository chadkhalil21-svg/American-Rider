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
const STATUS_DUE_MS = STATUS_INTERVAL_DAYS * DAY_MS;
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
    operatorAttestedAt: null,
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
  const age = verifiedAt ? now - verifiedAt : Number.POSITIVE_INFINITY;
  if (!verifiedAt || age > STATUS_MAX_AGE_MS) {
    return {
      ok: false,
      code: 'insurance_status_stale',
      status: 'unverified',
      reason: 'Current policy status is due for independent re-verification before service can continue.',
      nextVerificationDueAt: m.nextVerificationDueAt || null,
    };
  }

  // BEFORE DAY 30: no Operator action. Fresh carrier/broker/document evidence is enough.
  if (age <= STATUS_DUE_MS) {
    return {
      ok: true,
      code: null,
      status: 'verified_active',
      reason: null,
      source: m.source || null,
      lastVerifiedAt: verifiedAt,
      operatorAttestedAt: Number(m.operatorAttestedAt) || null,
      nextVerificationDueAt: m.nextVerificationDueAt || verifiedAt + STATUS_DUE_MS,
      operatorActionRequired: false,
    };
  }

  // DAYS 31–35: if independent confirmation has not arrived, one in-app attestation opens only
  // the short grace window while American Rider seeks fresh independent evidence. It does not
  // reset lastVerifiedAt and therefore cannot extend the grace indefinitely.
  const attestedAt = Number(m.operatorAttestedAt) || 0;
  if (!attestedAt || attestedAt < verifiedAt + STATUS_DUE_MS) {
    return {
      ok: false,
      code: 'insurance_attestation_due',
      status: 'verification_due',
      reason: 'Confirm that your policy remains active and unchanged while American Rider obtains fresh independent verification.',
      source: m.source || null,
      lastVerifiedAt: verifiedAt,
      operatorAttestedAt: attestedAt || null,
      nextVerificationDueAt: m.nextVerificationDueAt || verifiedAt + STATUS_DUE_MS,
      operatorActionRequired: true,
      graceUntil: verifiedAt + STATUS_MAX_AGE_MS,
    };
  }

  return {
    ok: true,
    code: null,
    status: 'verification_due',
    reason: 'Independent insurance confirmation is being refreshed.',
    source: m.source || null,
    lastVerifiedAt: verifiedAt,
    operatorAttestedAt: attestedAt,
    nextVerificationDueAt: m.nextVerificationDueAt || verifiedAt + STATUS_DUE_MS,
    operatorActionRequired: false,
    graceUntil: verifiedAt + STATUS_MAX_AGE_MS,
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

async function sweepInsuranceMonitoring({ db, requestConfirmation, notify, now = Date.now(), limit = 250 } = {}) {
  if (!db) return { ok: false, reason: 'no database', considered: 0, requested: 0, reminded: 0 };
  const report = { ok: true, considered: 0, requested: 0, reminded: 0, failed: [] };
  const requestWindow = now + 10 * DAY_MS;
  let snap;
  try {
    snap = await db.collection('users')
      .where('insuranceMonitoring.nextVerificationDueAt', '<=', requestWindow)
      .limit(Math.max(1, Math.min(500, Number(limit) || 250)))
      .get();
  } catch (e) {
    return { ok: false, reason: e.message, considered: 0, requested: 0, reminded: 0 };
  }

  for (const doc of snap.docs) {
    report.considered += 1;
    const u = doc.data() || {};
    const m = u.insuranceMonitoring || {};
    if (cleanStatus(m.status) !== 'verified_active') continue;
    const due = Number(m.nextVerificationDueAt) || 0;
    const lastRequest = Number(m.verificationRequestedAt) || 0;
    const contact = m.contact || null;
    const operatorName = String(u.legalName || u.name || 'the Operator').slice(0, 100);
    const policy = String(m.policyNumber || u.documents?.insurance?.evidence?.insurance?.policyNumber || '');
    const last4 = policy ? policy.slice(-4) : 'not shown';

    // Once a broker/agent/carrier address is known, American Rider initiates the refresh.
    // The Operator does not have to remember a monthly chore.
    const requestCount = Math.max(0, Number(m.verificationRequestCount) || 0);
    if (contact?.email && requestCount < 3 && (!lastRequest || now - lastRequest >= 5 * DAY_MS)) {
      try {
        const result = await requestConfirmation?.({
          uid: doc.id,
          user: u,
          contact,
          now,
          reason: due && now > due ? 'verification_due' : 'scheduled_refresh',
        });
        if (result?.ok) {
          report.requested += 1;
        } else {
          report.failed.push({ uid: doc.id, reason: result?.reason || 'request failed' });
        }
      } catch (e) {
        report.failed.push({ uid: doc.id, reason: e.message });
      }
    }

    // Only when independent verification is actually due do we ask the Operator to touch
    // anything. One tap opens the five-day grace; it never resets the independent clock.
    if (due && now > due && !(Number(m.operatorAttestedAt) >= due)) {
      try {
        await notify?.({
          uid: doc.id,
          kind: 'insurance_verification_due',
          title: 'Insurance status confirmation',
          body: 'Confirm that your commercial coverage is unchanged while American Rider refreshes it with your insurer or broker.',
          data: { screen: '/operator/insurance' },
        });
        report.reminded += 1;
      } catch {
        /* the status gate itself still protects service */
      }
    }
  }
  return report;
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
  STATUS_DUE_MS,
  STATUS_MAX_AGE_MS,
  cleanStatus,
  policyIdentityFromDocument,
  initialMonitoringFromDocument,
  continuingStatus,
  applyOperatorAttestation,
  applyIndependentConfirmation,
  providerInstructions,
  sweepInsuranceMonitoring,
};