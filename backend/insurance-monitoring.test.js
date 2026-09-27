const assert = require('assert');
const {
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
assert.equal(continuingStatus({ insuranceMonitoring: initial }, now).ok, true);

const stale = { ...initial, lastVerifiedAt: now - STATUS_MAX_AGE_MS - 1 };
assert.equal(continuingStatus({ insuranceMonitoring: stale }, now).code, 'insurance_status_stale');

const cancelled = applyIndependentConfirmation(initial, { status: 'cancelled', source: 'broker', now });
assert.equal(continuingStatus({ insuranceMonitoring: cancelled }, now).code, 'insurance_cancelled');

const reverified = applyIndependentConfirmation(cancelled, { status: 'verified_active', source: 'carrier', now });
assert.equal(continuingStatus({ insuranceMonitoring: reverified }, now).ok, true);

const attested = applyOperatorAttestation(initial, now + 1000);
assert.equal(attested.operatorAttestedAt, now + 1000);

console.log('insurance-monitoring tests passed');