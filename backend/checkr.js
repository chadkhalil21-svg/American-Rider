// Checkr — the wire itself. Ordering a check, proving a webhook is really theirs, and turning
// their report into the shape screening.js adjudicates.
//
// WHY THIS FILE EXISTS. Until 26 Aug 2026 there was no code that actually called Checkr:
// /operator/screening/order verified the payment, wrote `decision: 'ordered'`, and stopped.
// With CHECKR_API_KEY set the system would have CLAIMED checks were ordered while no
// invitation ever reached an operator and no report ever ran — failure dressed as success,
// which is the worst kind. Everything that talks to api.checkr.com now lives here.
//
// THE ONE RULE THAT SHAPES THE MAPPING. Checkr's payloads are theirs to change, and a webhook
// body is not a contract. So nothing here trusts a shape it cannot verify: every field is
// read defensively, and when a `consider` report yields NOTHING our parser can place, the
// decision is `review` — never `pass`. A report the screening company flagged and we could
// not read is a report a person looks at. (The pass-when-unreadable hole is exactly what this
// replaces: status `consider` with an unparsed body used to sail through adjudicate() as a
// pass, because empty records match no disqualifier.)

const crypto = require('crypto');
const { readKey } = require('./env');
const { adminDb } = require('./firebase-admin');
const { adjudicate, recordDecision, recordAdverseState } = require('./screening');
const { startProviderAdverseAction, activeProviderAdverseActions, cancelProviderAdverseActions } = require('./adverse');
const { fileTicket } = require('./tickets');
const { notify } = require('./push');

const BASE = 'https://api.checkr.com/v1';

// The package slugs, created once in the Checkr dashboard (Packages) to match the priced
// bundle in screening.js — Basic+ with the MVR add-on for the full $47.49 check, and an
// MVR-only package for the $17.50 top-up when an operator's existing report already covers
// the criminal half. Overridable from the environment so a dashboard rename is a config
// change, not a deploy.
const PACKAGE_FULL = () => readKey('CHECKR_PACKAGE') || 'american_rider_operator';
const PACKAGE_MVR_ONLY = () => readKey('CHECKR_PACKAGE_MVR') || 'american_rider_mvr_only';
const PACKAGE_CRIMINAL_ONLY = () => readKey('CHECKR_PACKAGE_BASIC') || 'american_rider_basic_only';

// WHICH PACKAGE, DECIDED BY NAME RATHER THAN BY PRICE.
//
// This used to be a boolean `mvrOnly`, and server.js derived it by comparing the stored fee
// to MVR_ONLY_FEE_CENTS — so the package ordered was inferred from a number of cents. Two
// tiers made that survivable; a third makes it a bug waiting to happen, and a mis-inferred
// package means an operator pays for one check and is sent to take another.
const packageFor = (tier) =>
  tier === 'mvr' ? PACKAGE_MVR_ONLY() : tier === 'criminal' ? PACKAGE_CRIMINAL_ONLY() : PACKAGE_FULL();

// Where the work is. §627.748 is Florida law and the launch market is Florida; the state
// also decides which DMV the MVR pulls from.
const WORK_STATE = () => readKey('CHECKR_WORK_STATE') || 'FL';

const ready = () => !!readKey('CHECKR_API_KEY');

/** Basic auth exactly as Checkr specifies: the API key as username, empty password. */
function authHeader() {
  return 'Basic ' + Buffer.from(readKey('CHECKR_API_KEY') + ':').toString('base64');
}

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = out?.error || (Array.isArray(out?.errors) ? out.errors.join('; ') : '') || res.statusText;
    throw new Error(`Checkr ${method} ${path} → ${res.status}: ${detail}`);
  }
  return out;
}

/**
 * Prove a webhook came from Checkr: HMAC-SHA256 of the EXACT raw bytes, hex, against
 * X-Checkr-Signature, compared in constant time.
 *
 * THE BUG THIS REPLACES: the old handler compared the header to the secret itself
 * (`req.get('x-checkr-signature') !== secret`). Checkr never sends the secret — it sends the
 * HMAC — so every genuine webhook was a 403 and no result could ever land. Like the Stripe
 * webhook above it in server.js, this needs the raw body, so the route must mount before
 * express.json(); that ordering is load-bearing there and it is load-bearing here.
 */
function verifySignature(rawBody, signatureHeader) {
  const secret = readKey('CHECKR_WEBHOOK_SECRET');
  if (!secret || !signatureHeader) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const got = String(signatureHeader);
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));
}

/**
 * Create the candidate and send the invitation — the operator gets Checkr's email, opens
 * Checkr's hosted flow, and enters their own SSN/licence/consent there. Their PII never
 * touches this server, which is the point of the hosted flow.
 *
 * THE UID TRAVELS TWO WAYS, BELT AND BRACES. It is written to Checkr as the candidate's
 * custom_id AND recorded in our own screeningOrders/{candidateId} document. The webhook
 * resolves operators through OUR record first — a payload shape Checkr controls is a poor
 * place to keep the only copy of who a report is about.
 */
async function invite({ uid, email, tier = 'full' }) {
  const db = adminDb();
  const candidate = await api('POST', '/candidates', {
    email,
    custom_id: String(uid),
    work_locations: [{ country: 'US', state: WORK_STATE() }],
  });
  const invitation = await api('POST', '/invitations', {
    candidate_id: candidate.id,
    package: packageFor(tier),
    work_locations: [{ country: 'US', state: WORK_STATE() }],
  });
  if (db) {
    await db.collection('screeningOrders').doc(String(candidate.id)).set({
      uid: String(uid),
      email,
      invitationId: invitation.id || null,
      package: packageFor(tier),
      tier,
      createdAt: Date.now(),
    }, { merge: true });
  }
  return {
    candidateId: candidate.id,
    invitationId: invitation.id || null,
    invitationUrl: invitation.invitation_url || null,
    expiresAt: Date.parse(invitation.expires_at || '') || null,
  };
}

/** Re-send an invitation for a candidate we already created (link expired, same payment). */
async function reinvite({ candidateId, tier = 'full' }) {
  const invitation = await api('POST', '/invitations', {
    candidate_id: candidateId,
    package: packageFor(tier),
    work_locations: [{ country: 'US', state: WORK_STATE() }],
  });
  return {
    invitationId: invitation.id || null,
    invitationUrl: invitation.invitation_url || null,
    expiresAt: Date.parse(invitation.expires_at || '') || null,
  };
}

/** The operator a Checkr object is about: our own record first, Checkr's custom_id second. */
async function uidForCandidate(candidateId) {
  if (!candidateId) return null;
  const db = adminDb();
  if (db) {
    try {
      const snap = await db.collection('screeningOrders').doc(String(candidateId)).get();
      if (snap.exists && snap.data().uid) return String(snap.data().uid);
    } catch { /* fall through to the API */ }
  }
  if (ready()) {
    try {
      const c = await api('GET', `/candidates/${candidateId}`);
      if (c?.custom_id) return String(c.custom_id);
      if (c?.metadata?.uid) return String(c.metadata.uid);
    } catch { /* resolved below as null */ }
  }
  return null;
}

// ---- Turning Checkr's report into adjudicate()'s input -----------------------------------

/** 'felony' | 'misdemeanor' | whatever else Checkr called it, lowercased. */
function normalizeType(classification) {
  const c = String(classification || '').toLowerCase();
  if (c.includes('felony')) return 'felony';
  if (c.includes('misdemeanor')) return 'misdemeanor';
  return c || 'record';
}

function firstDate(...candidates) {
  for (const c of candidates) {
    const t = Date.parse(String(c || ''));
    if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  }
  return null;
}

/**
 * Flatten one criminal search's records into adjudicate()'s `{ type, charge, disposition,
 * date }` rows. Checkr nests charges inside records inside searches; every layer is optional
 * here because every layer has been optional in practice.
 */
function chargesFrom(search) {
  const rows = [];
  for (const record of (Array.isArray(search?.records) ? search.records : [])) {
    const charges = Array.isArray(record?.charges) && record.charges.length ? record.charges : [record];
    for (const ch of charges) {
      rows.push({
        type: normalizeType(ch.classification || record.classification),
        charge: ch.charge || ch.description || ch.offense || record.description || '',
        disposition: ch.disposition || record.disposition || '',
        date: firstDate(ch.offense_date, ch.disposition_date, ch.date, record.filing_date, record.date),
      });
    }
  }
  return rows;
}

/**
 * Assemble adjudicate()'s input from the report plus its fetched screenings.
 *
 * MVR violations are ALSO mapped into `records` (type 'violation'): §627.748(12)(d)4 —
 * driving on a suspended or revoked licence — usually surfaces on the driving record, and
 * the suspended-licence disqualifier matches on wording, not on type. DUI convictions reach
 * the criminal search as well, so nothing relies on the MVR alone for (12)(d)2.
 */
function mapReport(report, { criminal = [], sexOffender = null, mvr = null } = {}) {
  const status =
    report?.status === 'suspended' || report?.status === 'dispute'
      ? 'suspended'
      : String(report?.result || report?.assessment || report?.status || 'consider').toLowerCase();

  const records = [];
  for (const search of criminal) records.push(...chargesFrom(search));

  const violations = Array.isArray(mvr?.violations) ? mvr.violations : [];
  const YEAR = 365 * 24 * 60 * 60 * 1000;
  let movingViolations3y = 0;
  for (const v of violations) {
    const when = Date.parse(String(v.issued_date || v.conviction_date || v.date || ''));
    if (!Number.isNaN(when) && Date.now() - when <= 3 * YEAR) movingViolations3y += 1;
    records.push({
      type: 'violation',
      charge: v.description || v.type || 'moving violation',
      disposition: v.disposition || '',
      date: firstDate(v.issued_date, v.conviction_date, v.date),
    });
  }

  const ls = String(mvr?.license_status || '').toLowerCase();
  const license = mvr
    ? { valid: ls ? ls === 'valid' : undefined, state: mvr.license_state || null }
    : {};

  return {
    status: ['clear', 'consider', 'suspended'].includes(status) ? status : 'consider',
    records,
    sexOffender: Array.isArray(sexOffender?.records) && sexOffender.records.length > 0,
    license,
    movingViolations3y,
  };
}

/**
 * Fetch the report's screenings from the API. The webhook body alone is NOT adjudicated —
 * it does not reliably carry findings, and adjudicating an empty shape is how a `consider`
 * used to pass. Every fetch failure degrades to `null`, and mapReport + adjudicate()'s
 * consider-with-nothing rule turn null into `review`, which is the safe direction.
 */
async function fetchReportDetails(reportId) {
  const report = await api('GET', `/reports/${reportId}`);
  const get = async (path) => {
    try { return await api('GET', path); } catch { return null; }
  };
  const criminalIds = [
    report.national_criminal_search_id,
    ...(Array.isArray(report.county_criminal_search_ids) ? report.county_criminal_search_ids : []),
    ...(Array.isArray(report.state_criminal_search_ids) ? report.state_criminal_search_ids : []),
  ].filter(Boolean);
  const [sexOffender, mvr, ...criminal] = await Promise.all([
    report.sex_offender_search_id ? get(`/sex_offender_searches/${report.sex_offender_search_id}`) : null,
    report.motor_vehicle_report_id ? get(`/motor_vehicle_reports/${report.motor_vehicle_report_id}`) : null,
    ...criminalIds.map((id) => get(`/national_criminal_searches/${id}`)),
  ]);
  return { report, details: { criminal: criminal.filter(Boolean), sexOffender, mvr } };
}

// ---- The webhook's work, after the signature has been proved ------------------------------

/**
 * One verified Checkr event. server.js durably stores the verified event before HTTP 2xx;
 * this handler may therefore fail and be retried from the provider-event inbox without losing
 * the provider notification.
 */
async function handleEvent(event) {
  const type = String(event?.type || '');
  const object = event?.data?.object || {};

  // Provider-hosted adverse-action lifecycle. The provider sends the notices; American Rider
  // records state and keeps the Operator blocked until the process either clears the report or
  // reaches final adverse action.
  if (type.startsWith('adverse_action.')) {
    const reportId = object.report_id || object.reportId || null;
    let report = null;
    try { if (reportId && ready()) report = await api('GET', `/reports/${reportId}`); } catch {}
    const uid = await uidForCandidate(report?.candidate_id || object.candidate_id);
    if (!uid) return { ok: true, action: 'adverse action not mapped to operator' };

    if (type === 'report.post_adverse_action' || type === 'adverse_action.completed') {
      await recordAdverseState({
        uid, state: 'final', actionId: object.id || null, reportId, final: true,
        note: 'The provider completed the adverse-action notice process.',
      });
      return { ok: true, action: 'adverse action finalized', uid, decision: 'refuse' };
    }
    if (type === 'adverse_action.notice_not_delivered') {
      await recordAdverseState({
        uid, state: 'delivery_exception', actionId: object.id || null, reportId,
        note: 'The provider could not deliver an adverse-action notice.',
      });
      await fileTicket({
        uid, kind: 'support', reason: 'Adverse-action notice delivery failed',
        description: `Checkr could not deliver adverse-action notice ${object.id || '—'} for report ${reportId || '—'}. Resolve delivery before final action.`,
      });
      return { ok: true, action: 'adverse delivery exception', uid };
    }
    const state =
      (type === 'adverse_action.paused' || type === 'report.pre_adverse_action') ? 'pre_adverse' :
      type === 'adverse_action.canceled' ? 'canceled' :
      type === 'adverse_action.resumed' ? 'pre_adverse' :
      'pre_adverse';
    await recordAdverseState({ uid, state, actionId: object.id || null, reportId });
    return { ok: true, action: `adverse state ${state}`, uid };
  }

  if (type === 'report.pre_adverse_action' || type === 'report.post_adverse_action') {
    const reportId = object.id || object.report_id || null;
    const uid = await uidForCandidate(object.candidate_id);
    if (!uid) return { ok: true, action: 'adverse report event not mapped to operator' };
    if (type === 'report.post_adverse_action') {
      await recordAdverseState({
        uid, state: 'final', reportId, final: true,
        note: 'Checkr sent the post-adverse action notice.',
      });
      return { ok: true, action: 'adverse action finalized', uid, decision: 'refuse' };
    }
    await recordAdverseState({ uid, state: 'pre_adverse', reportId });
    return { ok: true, action: 'pre-adverse notice recorded', uid };
  }

  // A completed dispute is re-adjudicated from fresh provider data. If the corrected report
  // clears the statutory rules, any pending adverse action is canceled automatically.
  if (type === 'report.dispute_completed') {
    const reportId = object.id;
    if (!reportId) return { ok: true, action: 'ignored', reason: 'no report id' };
    let report, details;
    try { ({ report, details } = await fetchReportDetails(reportId)); }
    catch (e) { return { ok: false, action: 'retry', reason: e.message }; }
    const uid = await uidForCandidate(report.candidate_id || object.candidate_id);
    if (!uid) return { ok: false, action: 'retry', reason: 'no uid for disputed report' };
    const decided = adjudicate(mapReport(report, details));
    if (decided.decision === 'pass') {
      await cancelProviderAdverseActions({ reportId, api });
      const out = await recordDecision({
        uid, ...decided, reportId, provider: 'checkr',
        issuedAt: Date.parse(report.completed_at || '') || null,
      });
      return { ok: out.ok, action: 'dispute cleared operator', uid, decision: 'pass', reason: out.reason };
    }
    if (decided.decision === 'refuse') {
      const active = await activeProviderAdverseActions({ reportId, api });
      let adverse = active[0] ? { ok: true, actionId: active[0].id, status: active[0].status } : null;
      if (!adverse) adverse = await startProviderAdverseAction({ reportId, reasons: decided.reasons, api });
      if (!adverse.ok) {
        await recordDecision({
          uid, decision: 'review',
          reasons: adverse.unmapped || decided.reasons,
          summary: 'The corrected report still contains a statutory issue, but the provider items could not be mapped automatically.',
          reportId, provider: 'checkr', issuedAt: Date.parse(report.completed_at || '') || null,
        });
        return { ok: true, action: 'dispute requires source mapping', uid, decision: 'review' };
      }
      const out = await recordDecision({
        uid, ...decided, reportId, provider: 'checkr',
        issuedAt: Date.parse(report.completed_at || '') || null,
        adverseAction: { state: 'pre_adverse', actionId: adverse.actionId || null, reportId, updatedAt: Date.now() },
      });
      return { ok: out.ok, action: 'dispute remains pre-adverse', uid, decision: out.decision, reason: out.reason };
    }
    const out = await recordDecision({
      uid, ...decided, reportId, provider: 'checkr',
      issuedAt: Date.parse(report.completed_at || '') || null,
    });
    return { ok: out.ok, action: 'dispute needs clarification', uid, decision: out.decision, reason: out.reason };
  }

  // A dispute in progress is a blocked, non-final state. Do not overwrite it with a generic
  // "review" result merely because the report is temporarily suspended.
  if (type === 'report.disputed') {
    const reportId = object.id;
    let report = object;
    try { if (ready() && reportId) report = await api('GET', `/reports/${reportId}`); } catch {}
    const uid = await uidForCandidate(report.candidate_id || object.candidate_id);
    if (!uid) return { ok: true, action: 'ignored', reason: 'no uid' };
    const active = reportId ? await activeProviderAdverseActions({ reportId, api }).catch(() => []) : [];
    await recordAdverseState({
      uid, state: 'disputed', actionId: active[0]?.id || null, reportId,
      note: 'The Operator disputed information in the screening report. Qualification remains on hold while the provider investigates.',
    });
    return { ok: true, action: 'dispute recorded', uid };
  }

  // A finished (or suspended) report: fetch the findings, apply American Rider's statutory
  // rules, then initiate provider-hosted adverse action only when those rules actually refuse.
  if (type === 'report.completed' || type === 'report.suspended') {
    const reportId = object.id;
    if (!reportId) return { ok: true, action: 'ignored', reason: 'no report id' };

    let report = object;
    let details = { criminal: [], sexOffender: null, mvr: null };
    if (ready()) {
      try { ({ report, details } = await fetchReportDetails(reportId)); }
      catch (e) {
        console.log(`[checkr] could not fetch report ${reportId}: ${e.message}`);
        return { ok: false, action: 'retry', reason: e.message };
      }
    }

    const uid = await uidForCandidate(report.candidate_id || object.candidate_id);
    if (!uid) {
      await fileTicket({
        kind: 'support',
        reason: 'Checkr report with no operator',
        description: `Report ${reportId} (candidate ${report.candidate_id || 'unknown'}) completed but no operator maps to it.`,
      });
      return { ok: false, action: 'retry', reason: 'no uid for candidate' };
    }

    const decided = adjudicate(mapReport(report, details));
    let adverseAction = null;
    if (decided.decision === 'refuse') {
      // Queue replay/crash recovery may deliver report.completed more than once. Checkr rejects
      // a second active adverse action, so reuse the provider's durable action when one exists.
      const active = await activeProviderAdverseActions({ reportId, api }).catch(() => []);
      const adverse = active[0]
        ? { ok: true, actionId: active[0].id, status: active[0].status, postNoticeScheduledAt: active[0].post_notice_scheduled_at || null }
        : await startProviderAdverseAction({ reportId, reasons: decided.reasons, api });
      if (!adverse.ok) {
        const out = await recordDecision({
          uid, decision: 'review',
          reasons: adverse.unmapped || decided.reasons,
          summary: 'The statutory result could not be mapped confidently to the provider adverse-action items. Qualification remains blocked pending source clarification.',
          reportId, provider: 'checkr', issuedAt: Date.parse(report.completed_at || '') || null,
        });
        return { ok: out.ok, action: 'adverse mapping exception', uid, decision: out.decision, reason: out.reason };
      }
      adverseAction = {
        state: 'pre_adverse',
        actionId: adverse.actionId || null,
        reportId,
        postNoticeScheduledAt: adverse.postNoticeScheduledAt || null,
        updatedAt: Date.now(),
      };
    }

    const out = await recordDecision({
      uid, ...decided, reportId, provider: 'checkr',
      issuedAt: Date.parse(report.completed_at || '') || null,
      adverseAction,
    });
    return { ok: out.ok, action: 'decided', uid, decision: out.decision, recorded: out.ok, reason: out.reason };
  }

  if (type === 'invitation.completed' || type === 'report.created') {
    const uid = await uidForCandidate(object.candidate_id);
    if (!uid) return { ok: true, action: 'ignored', reason: 'no uid' };
    const db = adminDb();
    if (db) {
      await db.collection('users').doc(uid).set(
        { screening: { decision: 'in_progress', summary: 'Checkr is running the report. Results usually return within a day.' } },
        { merge: true },
      );
    }
    return { ok: true, action: 'in_progress', uid };
  }

  if (type === 'invitation.expired' || type === 'invitation.canceled') {
    const uid = await uidForCandidate(object.candidate_id);
    if (!uid) return { ok: true, action: 'ignored', reason: 'no uid' };
    const db = adminDb();
    if (db) {
      await db.collection('users').doc(uid).set(
        { screening: { decision: 'expired', summary: 'The background-check link expired before it was finished. Get a new link from the screening screen — there is nothing more to pay.' } },
        { merge: true },
      );
    }
    await notify({
      uid, kind: 'screening_expired', title: 'Your background check link expired',
      body: 'Open American Rider to get a new link. You will not be charged again.',
    });
    await fileTicket({
      uid, kind: 'support', reason: 'Screening invitation expired',
      description:
        `Operator ${uid} paid for a screening but the Checkr invitation ${object.id || ''} expired unfinished.\n` +
        'They have been told to request a new link with no extra charge.',
    });
    return { ok: true, action: 'expired', uid };
  }

  return { ok: true, action: 'ignored', reason: `unhandled type ${type}` };
}

module.exports = {
  ready,
  invite,
  reinvite,
  verifySignature,
  handleEvent,
  mapReport,
  uidForCandidate,
  PACKAGE_FULL,
  PACKAGE_MVR_ONLY,
  fetchReportDetails,
};
