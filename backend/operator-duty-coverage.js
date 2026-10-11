'use strict';

// A native background location task only sends position. The authenticated backend
// derives policy expiry from accepted server-side document evidence, never from
// an untrusted foreground form field or a stale fleet snapshot.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function dutyCoverageExpiry(user, now = Date.now()) {
  const document = user?.documents?.insurance;
  const verdict = document?.decision?.verdict || document?.verdict;
  if (verdict !== 'accept') return { ok: false, code: 'no_coverage_on_file' };
  const expiry = String(document?.decision?.expiry || document?.expiry || '').trim();
  if (!ISO_DATE.test(expiry)) return { ok: false, code: 'no_coverage_on_file' };
  const end = Date.parse(`${expiry}T23:59:59Z`);
  if (!Number.isFinite(end) || new Date(end).toISOString().slice(0, 10) !== expiry) {
    return { ok: false, code: 'no_coverage_on_file' };
  }
  if (end < now) return { ok: false, code: 'coverage_expired', expiry };
  return { ok: true, expiry };
}
module.exports = { dutyCoverageExpiry };
