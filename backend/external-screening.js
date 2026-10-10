// Provider-neutral screening: Operations verifies a CRA-origin report *outside* this app.
// The report itself is never uploaded to a Traveler-facing endpoint or copied to Firestore.
// A named operator reviewer records a narrow, audited attestation against a pre-existing
// Operator request. An unverified/self-supplied report can never qualify an Operator.
'use strict';
const { RECHECK_MS } = require('./screening');
const { reviewPolicyFor } = require('./screening-jurisdictions');

const CASE_RE = /^AR-C-[A-Za-z0-9-]{1,48}$/;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{5,119}$/;
const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const TRUSTED_CHANNELS = new Set(['authenticated_provider_portal', 'provider_verified_secure_transfer']);
const clean = (value, limit = 200) => String(value || '').trim().slice(0, limit);
const allowedName = (actor) => /^[A-Za-z0-9_-]{1,40}$/.test(String(actor?.name || ''));

/** No raw consumer report details, SSNs, DOBs or criminal charge narratives are accepted. */
function validateReview(input, now = Date.now()) {
  const uid = clean(input.uid, 140), caseNo = clean(input.caseNo, 80);
  const provider = clean(input.provider, 120), providerReference = clean(input.providerReference, 120);
  const note = clean(input.note, 400), action = clean(input.action, 12);
  const channel = clean(input.channel, 48);
  const issuedOn = clean(input.issuedOn, 20);
  if (!uid || !CASE_RE.test(caseNo)) return { ok: false, error: 'A valid Operator and screening case are required.' };
  if (!/^[A-Za-z0-9][A-Za-z0-9 .&'-]{2,119}$/.test(provider))
    return { ok: false, error: 'Enter the verified consumer reporting agency name, not an arbitrary website.' };
  if (!REF_RE.test(providerReference)) return { ok: false, error: 'A non-sensitive agency report reference (6–120 characters) is required.' };
  if (!TRUSTED_CHANNELS.has(channel)) return { ok: false, error: 'Confirm how the agency report was authenticated.' };
  if (input.sourceAuthenticated !== 'yes' || input.reportOwnerMatched !== 'yes' || input.permissiblePurposeVerified !== 'yes')
    return { ok: false, error: 'Verify agency identity, report-to-Operator match and permitted report disclosure.' };
  if (!['clear','hold'].includes(action)) return { ok: false, error: 'Choose clear or hold for review.' };
  if (note.length < 12) return { ok: false, error: 'Document the verification and decision with a meaningful note.' };
  if (!DATE_RE.test(issuedOn)) return { ok: false, error: 'Enter the date the report was conducted (YYYY-MM-DD).' };
  const issuedAt = Date.parse(issuedOn + 'T12:00:00Z');
  if (!Number.isFinite(issuedAt) || new Date(issuedAt).toISOString().slice(0,10) !== issuedOn ||
      issuedAt > now || issuedAt + RECHECK_MS <= now)
    return { ok: false, error: 'The report date must be valid and within the three-year interval.' };
  if (action === 'clear') {
    const required = ['nationwideChecked','primarySourceValidated','sexOffenderChecked','drivingHistoryChecked',
      'noDisqualifyingCriminalRecords','sexOffenderClear','licenseValid','registrationVerified'];
    if (required.some(k => input[k] !== 'yes'))
      return { ok: false, error: 'All required statutory searches, results and source checks must be verified before clearance.' };
    const moving = String(input.movingViolations3y ?? '').trim();
    if (!/^[0-9]+$/.test(moving) || Number(moving) > 3)
      return { ok: false, error: 'A verified driving-history report must show at most three moving violations in three years.' };
  }
  return { ok: true, uid, caseNo, provider, providerReference, note, channel, issuedOn, issuedAt, action,
    movingViolations3y: action === 'clear' ? Number(input.movingViolations3y) : null };
}

async function recordExternalReview({ db, input, actor, now = Date.now() }) {
  if (!db || !allowedName(actor)) return { ok: false, status: 401, error: 'Named Operations authentication required.' };
  const checked = validateReview(input, now);
  if (!checked.ok) return { ...checked, status: 400 };
  const { uid, caseNo, provider, providerReference, note, channel, issuedAt, action, movingViolations3y } = checked;
  const userRef = db.collection('users').doc(uid);
  const fleetRef = db.collection('operators').doc(uid);
  const caseRef = db.collection('support_tickets').doc(caseNo);
  const auditRef = db.collection('audit_log').doc();
  return db.runTransaction(async tx => {
    const [userSnap, caseSnap, fleetSnap] = await Promise.all([tx.get(userRef), tx.get(caseRef), tx.get(fleetRef)]);
    if (!userSnap.exists || !caseSnap.exists) return { ok: false, status: 404, error: 'Operator or screening case not found.' };
    const u = userSnap.data() || {}, ticket = caseSnap.data() || {};
    const prior = u.screening || {};
    // The Florida adjudicator cannot clear a report for an unconfigured state.
    // Pre-registry pending cases are Florida-only and remain under that engine.
    const policy = reviewPolicyFor(prior);
    if (!policy || policy.reviewEngine !== 'florida_627748_v1')
      return { ok: false, status: 409, error: 'No implemented screening adjudication policy for this case jurisdiction.' };
    if (prior.transferCaseNo !== caseNo || ticket.uid !== uid ||
        ticket.kind !== 'support' || ticket.status !== 'open' ||
        !/^Operator screening — review (existing|new) provider report$/.test(ticket.reason || ''))
      return { ok: false, status: 409, error: 'This case is not an open Operator-authorized screening transfer.' };
    if (!['awaiting_agency','review'].includes(prior.decision) || !prior.consentAt)
      return { ok: false, status: 409, error: 'An active written Operator release instruction is required.' };
    if (clean(prior.provider).toLowerCase() !== provider.toLowerCase())
      return { ok: false, status: 409, error: 'The reporting company differs from the Operator authorization.' };
    if (action === 'clear' || action === 'hold') {
      const handoff = ticket.screeningHandoff || {};
      const report = handoff.authenticatedReport || {};
      if (handoff.stage !== 'report_authenticated' || handoff.owner !== actor.name ||
          !report.verifiedAt || report.by !== actor.name ||
          report.reference !== providerReference || report.channel !== channel ||
          clean(report.agency).toLowerCase() !== provider.toLowerCase()) {
        return { ok: false, status: 409,
          error: 'Claim the case, verify direct agency contact and log authenticated report receipt before clearance.' };
      }
    }
    const result = action === 'clear' ? 'pass' : 'review';
    const recorded = {
      decision: result,
      jurisdictionCode: policy.stateCode, policyId: policy.id,
      summary: result === 'pass' ? 'Independently verified screening meets the configured Florida TNC checks.' : 'Provider screening held for additional verification.',
      reasons: result === 'pass' ? [] : ['Operations requested clarification; screening is not cleared.'],
      provider, reportId: providerReference, checkedAt: now, conductedAt: issuedAt,
      recheckDue: issuedAt + RECHECK_MS,
      transferCaseNo: caseNo,
      // A new independently verified decision supersedes any withdrawn prior
      // adverse consideration; historical actions remain in audit_log.
      adverseAction: null, proposedDecision: null, finalizedAt: null,
      externalVerification: {
        source: channel, actor: actor.name, at: now, caseNo, agencyReference: providerReference,
        nationwideAndPrimarySource: result === 'pass', sexOffender: result === 'pass',
        drivingHistory: result === 'pass', movingViolations3y,
        // Proof of a reviewer attestation, not automated verification of the CRA.
        attested: true,
      },
      // No consumer report payload, criminal record particulars or SSN stored in Firestore.
    };
    tx.set(userRef, { screening: recorded }, { merge: true });
    if (fleetSnap.exists) {
      tx.set(fleetRef, { available: false, commissioned: false,
        screeningBlocked: result !== 'pass',
        screeningReason: result !== 'pass' ? 'External background screening requires further review.' : null,
        screeningCheckedAt: result === 'pass' ? now : null,
        offDutyReason: 'screening_review_updated', offDutyAt: now }, { merge: true });
    }
    if (result === 'pass') {
      tx.set(caseRef, { status: 'closed', closedAt: now, closedBy: actor.name,
        closeNote: 'Authenticated external report reviewed; see restricted screening audit.' }, { merge: true });
    } else {
      tx.set(caseRef, { acknowledgedAt: now, acknowledgedBy: actor.name,
        acknowledgementNote: 'Screening held; provider clarification required.',
        screeningHandoff: { ...(ticket.screeningHandoff || {}), owner: actor.name,
          stage: 'clarification_needed', authenticatedReport: null, updatedAt: now },
      }, { merge: true });
    }
    tx.set(auditRef, { at: now, subject: uid, action: result === 'pass' ? 'screening_external_cleared' : 'screening_external_held',
      actor: { name: actor.name, ip: actor.ip || null, session: actor.session || null },
      caseNo, provider, providerReference, channel, conductedAt: issuedAt,
      previously: { decision: prior.decision || null, reportId: prior.reportId || null },
      after: { decision: result, recheckDue: issuedAt + RECHECK_MS, movingViolations3y },
      note });
    return { ok: true, decision: result, caseNo };
  });
}
module.exports = { validateReview, recordExternalReview };
