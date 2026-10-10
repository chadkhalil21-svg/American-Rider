'use strict';
// The provider-neutral screening handoff is a named Operations workflow.
// A case is not a provider request, and staff may not clear any Operator solely
// by checking the final adjudication form. Record independent contact and a
// genuinely authenticated report source first, preserving an immutable audit.
const CASE_RE = /^AR-C-[A-Za-z0-9-]{1,48}$/;
const REFERENCE_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{5,119}$/;
const CONTACT_CHANNELS = new Set(['verified_business_phone', 'verified_business_email', 'authenticated_agency_portal']);
const REPORT_CHANNELS = new Set(['authenticated_provider_portal', 'provider_verified_secure_transfer']);
const CASE_REASON_RE = /^Operator screening — review (existing|new) provider report$/;
const stages = Object.freeze(['claimed', 'agency_contacted', 'report_authenticated', 'dispute_open']);
const nameOf = (actor) => String(actor?.name || '');
const clean = (x) => String(x || '').trim();

function validNote(note) {
  const v = clean(note);
  // Minimize collection of SSNs and related report details. This rejects common
  // SSN formats; complete DLP and source storage still require separate controls.
  return v.length >= 12 && v.length <= 350 && !/\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/.test(v);
}

async function recordScreeningHandoff({ db, input, actor, now = Date.now() }) {
  const person = nameOf(actor);
  if (!db || !/^[A-Za-z0-9_-]{1,40}$/.test(person) || !actor?.session)
    return { ok: false, status: 401, error: 'A named Operations session is required.' };
  const uid = clean(input?.uid), caseNo = clean(input?.caseNo);
  const action = clean(input?.action), note = clean(input?.note);
  if (!uid || uid.length > 140 || !CASE_RE.test(caseNo) || !validNote(note) ||
      !['claim','agency_contacted','report_authenticated','dispute_open'].includes(action))
    return { ok: false, status: 400, error: 'Operator, case, action and a non-sensitive verification note are required.' };
  const contactReference = clean(input?.contactReference);
  const providerReference = clean(input?.providerReference);
  const contactChannel = clean(input?.contactChannel);
  const reportChannel = clean(input?.reportChannel);
  if (action === 'agency_contacted' &&
      (!CONTACT_CHANNELS.has(contactChannel) || !REFERENCE_RE.test(contactReference) ||
       input?.agencyIdentityVerified !== 'yes'))
    return { ok: false, status: 400, error: 'Record an independently verified CRA contact channel and non-sensitive contact reference.' };
  if (action === 'report_authenticated' &&
      (!REPORT_CHANNELS.has(reportChannel) || !REFERENCE_RE.test(providerReference) ||
       input?.sourceAuthenticated !== 'yes' || input?.reportOwnerMatched !== 'yes' ||
       input?.permissiblePurposeVerified !== 'yes'))
    return { ok: false, status: 400, error: 'Authenticated agency report, Operator match and permitted report use must all be verified.' };

  const userRef = db.collection('users').doc(uid);
  const caseRef = db.collection('support_tickets').doc(caseNo);
  const auditRef = db.collection('audit_log').doc();
  return db.runTransaction(async (tx) => {
    const [userSnap, caseSnap] = await Promise.all([tx.get(userRef), tx.get(caseRef)]);
    if (!userSnap.exists || !caseSnap.exists)
      return { ok: false, status: 404, error: 'Operator or screening case not found.' };
    const user = userSnap.data() || {}, ticket = caseSnap.data() || {};
    const prior = user.screening || {}, previous = ticket.screeningHandoff || {};
    if (ticket.uid !== uid || ticket.kind !== 'support' || ticket.status !== 'open' ||
        !CASE_REASON_RE.test(ticket.reason || '') || prior.transferCaseNo !== caseNo ||
        !['awaiting_agency','review'].includes(prior.decision) || !prior.consentAt)
      return { ok: false, status: 409, error: 'This is not an open Operator-authorized screening transfer.' };
    if (previous.owner && previous.owner !== person)
      return { ok: false, status: 409, error: 'The case has a different named reviewer. Request an audited reassignment.' };
    let nextStage = previous.stage || null, patch = {};
    if (action === 'claim') {
      if (previous.stage) return { ok: false, status: 409, error: 'Case is already claimed.' };
      nextStage = 'claimed';
    } else if (action === 'agency_contacted') {
      if (!['claimed','dispute_open'].includes(previous.stage))
        return { ok: false, status: 409, error: 'Claim the case or open a disputed-report recheck before logging CRA contact.' };
      nextStage = 'agency_contacted';
      patch = { agencyContact: { channel: contactChannel, reference: contactReference, verifiedAt: now, by: person },
        authenticatedReport: null };
    } else if (action === 'report_authenticated') {
      if (previous.stage !== 'agency_contacted' || !previous.agencyContact?.verifiedAt)
        return { ok: false, status: 409, error: 'Independent CRA contact must precede authenticated report receipt.' };
      nextStage = 'report_authenticated';
      patch = { authenticatedReport: { channel: reportChannel, reference: providerReference,
        verifiedAt: now, by: person, agency: prior.provider } };
    } else {
      if (previous.stage !== 'report_authenticated')
        return { ok: false, status: 409, error: 'Only a previously authenticated report can enter the disputed-report recheck.' };
      nextStage = 'dispute_open';
      patch = { authenticatedReport: null, dispute: { openedAt: now, by: person },
        agencyContact: null };
    }

    const summary = {
      claimed: 'Your screening case has been assigned for provider verification. No purchase or raw report email is required.',
      agency_contacted: 'American Rider has independently contacted the screening company and is awaiting verified report delivery.',
      report_authenticated: 'A report source has been authenticated. American Rider must still review statutory screening findings before clearance.',
      dispute_open: 'The screening report is being disputed or corrected. Eligibility remains on hold pending verified new evidence.',
    }[nextStage];
    tx.set(caseRef, { screeningHandoff: {
      ...previous, ...patch, owner: person, stage: nextStage, updatedAt: now,
      latestActionBy: person }, acknowledgedAt: previous.acknowledgedAt || now,
      acknowledgedBy: previous.acknowledgedBy || person,
    }, { merge: true });
    tx.set(userRef, { screening: {
      summary, ...(nextStage === 'dispute_open' ? { decision: 'review', reportId: null,
        recheckDue: null, conductedAt: null, externalVerification: null } : {}),
    } }, { merge: true });
    tx.set(auditRef, { subject: uid, at: now, action: 'screening_handoff_' + action,
      caseNo, actor: { name: person, session: actor.session, ip: actor.ip || null },
      provider: prior.provider || null, from: previous.stage || null, to: nextStage,
      ...(['agency_contacted','report_authenticated'].includes(action)
        ? { source: action === 'agency_contacted' ? contactChannel : reportChannel,
          reference: action === 'agency_contacted' ? contactReference : providerReference } : {}),
      note });
    return { ok: true, caseNo, stage: nextStage };
  });
}
module.exports = { recordScreeningHandoff, stages };
