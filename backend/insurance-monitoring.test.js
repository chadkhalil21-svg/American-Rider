const assert = require('assert');
const {
  STATUS_DUE_MS,
  STATUS_MAX_AGE_MS,
  initialMonitoringFromDocument,
  continuingStatus,
  applyOperatorAttestation,
  applyIndependentConfirmation,
} = require('./insurance-monitoring');

const now = Date.UTC(2026, 8, 26, 12);
const doc = {
  expiry: '2027-03-01',
  evidence: { insurance: { insurer: 'Example Commercial', policyNumber: 'ABC123', effectiveDate: '2026-03-01', expirationDate: '2027-03-01' } },
};

const initial = initialMonitoringFromDocument(doc, now);
assert.equal(initial.status, 'verified_active');
assert.equal(initial.operatorAttestedAt, null);
assert.equal(continuingStatus({ insuranceMonitoring: initial }, now).ok, true);
assert.equal(continuingStatus({ insuranceMonitoring: initial }, now).operatorActionRequired, false);

// At day 31, only if independent confirmation has not arrived, one tap can bridge the short grace.
const day31 = now + STATUS_DUE_MS + 1;
const due = continuingStatus({ insuranceMonitoring: initial }, day31);
assert.equal(due.ok, false);
assert.equal(due.code, 'insurance_attestation_due');
assert.equal(due.operatorActionRequired, true);

const attested = applyOperatorAttestation(initial, day31);
const grace = continuingStatus({ insuranceMonitoring: attested }, day31);
assert.equal(grace.ok, true);
assert.equal(grace.status, 'verification_due');

// Self-attestation never resets independent verification; after day 35 it still blocks.
const tooOld = continuingStatus({ insuranceMonitoring: attested }, now + STATUS_MAX_AGE_MS + 1);
assert.equal(tooOld.code, 'insurance_status_stale');

const cancelled = applyIndependentConfirmation(initial, { status: 'cancelled', source: 'broker', now });
assert.equal(continuingStatus({ insuranceMonitoring: cancelled }, now).code, 'insurance_cancelled');

const reverified = applyIndependentConfirmation(cancelled, { status: 'verified_active', source: 'carrier', now });
assert.equal(continuingStatus({ insuranceMonitoring: reverified }, now).ok, true);

console.log('insurance-monitoring tests passed');