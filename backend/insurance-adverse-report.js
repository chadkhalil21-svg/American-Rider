'use strict';
// A negative report is enough to STOP new Travel, never enough to establish
// insurance coverage. Operators can report a nonpayment/cancellation notice
// through their authenticated session without waiting for a monthly broker email.
const KINDS = new Set(['pending_cancellation', 'cancelled']);
function recordOperatorInsuranceRisk(monitoring, kind, now=Date.now()) {
  if (!KINDS.has(kind) || !Number.isSafeInteger(now) || now<=0) return null;
  const prior = monitoring || {};
  const priorTime = Number(prior.operatorAdverseReportedAt) || 0;
  const at = Math.max(now, priorTime);
  const adverseStatus = prior.status === 'cancelled' ? 'cancelled' : kind;
  return {
    ...prior,
    status: adverseStatus,
    operatorAdverseReportedAt: at,
    operatorAdverseKind: adverseStatus,
    operatorAttestedAt: null,
    verificationIssue: {
      kind: 'operator_reported_insurance_risk',
      at, note: 'Coverage may be cancelled for nonpayment or another reason. New Travel is paused until the insurer or licensed broker confirms current coverage.',
    },
  };
}
// An already-outstanding provider form may be answered after an Operator
// reports nonpayment: its older 'active' snapshot must NOT clear a new hold.
// A new, provider-authenticated, policy-bound request issued after the report
// can establish that the payment problem has been resolved.
function mayClearOperatorInsuranceRisk(monitoring, issuedAt) {
  const reportedAt = Number(monitoring?.operatorAdverseReportedAt);
  if (!Number.isSafeInteger(reportedAt) || reportedAt<=0) return true;
  return Number.isSafeInteger(issuedAt) && issuedAt > reportedAt;
}
module.exports={KINDS,recordOperatorInsuranceRisk,mayClearOperatorInsuranceRisk};
