// Operator qualification and eligibility — ONE function, derived from authoritative state.
//
// WHAT THIS REPLACES. On 22 Sept 2026 an operator became "commissioned" when a person clicked
// Approve on /ops, and that stored `commission.status: 'approved'` was then read as proof of
// eligibility. Two faults: every clean operator waited on a routine click, and a stored flag
// said nothing about the present (an insurance policy that lapsed the next day left it
// standing). Now nothing stores the answer as authority. assessOperator() derives it from the
// records every time it is asked — at every document reading, every status check, every
// go-on-duty and 90-second renewal, and every travel acceptance.
//
// TWO KINDS OF GATE, one function.
//   qualification — what makes an operator fit to carry travelers at all: the three documents,
//                   the insurance cover, the background screening (live money), the account,
//                   and no suspension or unresolved hold. All pass → qualified, automatically.
//   duty          — what must also hold at the moment travel is taken: the §627.748(8)(a)
//                   disclosure in force, Stripe payouts, being on duty, the policy date the
//                   operator recorded. These are not qualification because the app reaches the
//                   payout and duty screens only after qualifying.
//
// THE AI READING IS EVIDENCE, NOT AUTHORITY. backend/documents.js returns a verdict and the
// structured fields it read. An `accept` is necessary and not sufficient: this file re-checks in
// code everything that can be checked in code — that the document is the one requested and
// legible, that it carries an expiry and it has not passed, and for insurance that it covers
// carrying passengers for hire at no less than Florida's limit.
//
// A PERSON DECIDES ONLY THE EXCEPTIONS. `review` from the reader, an insurance limit that cannot
// be read, a screening Checkr marks for review — those wait on /ops. A person's decision is
// recorded beside the reading (never over it), is authenticated and audit-logged (see
// resolveDocument / setSuspension), and still passes the same date and coverage checks.
const { disclosureCurrent } = require('./disclosure');
const { screeningCurrent } = require('./screening');
const { coverageLapsed } = require('./matching');

/**
 * The documents that gate an operator: the three the app asks for (app/operator/documents.tsx).
 * Not inspection — the founders removed it on 30 Aug 2026 because §627.748 requires none; one
 * filed anyway is read and gates nothing.
 */
const REQUIRED_DOCS = ['license', 'registration', 'insurance'];

// FLORIDA TNC INSURANCE, as configured rules the code applies to what the reader extracted.
// The reader never decides compliance; these numbers do. Figures as the platform already
// states them (backend/site.js, Insurance) and as §627.748(7) reads — CONFIRM WITH FLORIDA
// COUNSEL before launch, and change them here, in one place, if counsel differs.
const FL_TNC_INSURANCE = Object.freeze({
  statute: 'Fla. Stat. §627.748(7)',
  // (7)(b): engaged in a prearranged ride — $1,000,000 for death, bodily injury and property
  // damage. A combined figure is required; split limits alone are not read as meeting it.
  rideCombinedMinDollars: 1000000,
  // (7)(c): logged on, not engaged — $50,000 per person, $100,000 per incident, $25,000
  // property damage; a combined single limit must cover the per-incident and property figures
  // together ($125,000).
  loggedOn: { perPerson: 50000, perIncident: 100000, propertyDamage: 25000, combinedSingle: 125000 },
  // Personal injury protection, §627.736 minimum.
  pipMinDollars: 10000,
  // Uninsured / underinsured motorist "as required by s. 627.727", which lets a named insured
  // reject it in writing. Whether a rejected UM satisfies the TNC rule is a question for counsel:
  // until INSURANCE_UM_REJECTION_ACCEPTED is set, a rejection is an exception, not a pass.
  umRejectionAccepted: () => process.env.INSURANCE_UM_REJECTION_ACCEPTED === '1',
});

// Kept under its old name: the $1,000,000 check the platform has always made.
const FL_CARRYING_LIMIT_DOLLARS = FL_TNC_INSURANCE.rideCombinedMinDollars;

/** Every dollar figure in a limits string. Bare small numbers ("50/100/25") are not guessed at. */
function dollarFigures(text) {
  const out = [];
  const re = /(\$)?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(million|mm|m|thousand|k)?\b/gi;
  let m;
  while ((m = re.exec(String(text || '')))) {
    const [, dollar, digits, unit] = m;
    let n = Number(digits.replace(/,/g, ''));
    const u = (unit || '').toLowerCase();
    if (u === 'million' || u === 'mm' || u === 'm') n *= 1e6;
    else if (u === 'thousand' || u === 'k') n *= 1e3;
    else if (!dollar && !digits.includes(',')) continue; // "50/100/25": not read as dollars
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

function expiredOn(expiry, now) {
  const end = Date.parse(`${expiry}T23:59:59Z`);
  return !Number.isNaN(end) && end < now;
}

const finding = (gate, kind, code, item, reason) => ({ gate, kind, code, item: item || null, reason: reason || '' });

const top = (text) => Math.max(0, ...dollarFigures(text));
const surname = (x) => String(x || '').toLowerCase().replace(/[^a-z ]/g, ' ').trim().split(/\s+/).filter(Boolean).pop() || '';
const plateKey = (x) => String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const isoDate = (x) => (x && !Number.isNaN(Date.parse(`${x}T00:00:00Z`)) ? String(x) : '');

/**
 * The insurance evidence as one normalized record: what the reader extracted, overlaid by what
 * a person on /ops verified (decision.verified). A person's values are held to the same rules.
 */
function insuranceEvidence(d, human) {
  const ins = d.evidence?.insurance || null;
  const v = (human && human.verified) || {};
  const lim = (L) => ({
    perPerson: top(L?.bodilyInjuryPerPerson),
    perIncident: top(L?.bodilyInjuryPerIncident),
    propertyDamage: top(L?.propertyDamage),
    combinedSingle: top(L?.combinedSingleLimit),
  });
  const any = (L) => L.perPerson || L.perIncident || L.propertyDamage || L.combinedSingle;
  const loggedOnRead = lim(ins?.loggedOnLimits);
  const general = lim(ins?.generalLimits);
  return {
    structured: !!ins || !!human,
    insureds: [...(ins?.namedInsureds || []), ...(ins?.listedDrivers || [])],
    insuredConfirmed: v.insuredConfirmed === true,
    vehicles: ins?.vehicles || [],
    vehicleConfirmed: v.vehicleConfirmed === true,
    effective: isoDate(v.effectiveDate) || isoDate(ins?.effectiveDate),
    expiration: isoDate(ins?.expirationDate),
    tnc: v.tncUse === 'yes' ? 'yes' : ins?.tncEndorsement === 'yes' || ins?.forHireUse === 'yes' ? 'yes'
      : ins?.tncEndorsement === 'no' && ins?.forHireUse === 'no' ? 'no' : 'unknown',
    rideCombined: Number(v.rideCombinedDollars) || top(ins?.rideLimits?.combinedSingleLimit) || general.combinedSingle,
    loggedOn: Number(v.loggedOnCombinedDollars) ? { perPerson: 0, perIncident: 0, propertyDamage: 0, combinedSingle: Number(v.loggedOnCombinedDollars) }
      : any(loggedOnRead) ? loggedOnRead : general,
    pip: v.pipDollars ? { shown: 'yes', amount: Number(v.pipDollars) } : { shown: ins?.pip?.shown || 'not_shown', amount: top(ins?.pip?.amount) },
    um: v.uninsuredMotorist || ins?.uninsuredMotorist?.shown || 'not_shown',
  };
}

/** Every Florida TNC insurance rule, applied in code. Returns findings (possibly none). */
function insuranceFindings(d, human, ctx, now) {
  const R = FL_TNC_INSURANCE;
  const out = [];
  const F = (k, code, reason) => out.push(finding('qualification', k, code, 'insurance', reason));
  const e = insuranceEvidence(d, human);
  if (!e.structured) {
    F('exception', 'insurance_structured_evidence_missing', 'The policy has not been read in the structured form the Florida rules need.');
    return out;
  }
  // Who is insured: the account holder must be a named insured or listed driver.
  const who = surname(ctx.user?.legalName || ctx.user?.name);
  if (!e.insuredConfirmed) {
    if (!e.insureds.length) F('exception', 'insurance_insured_missing', 'No named insured or listed driver could be read.');
    else if (!who) F('exception', 'insurance_identity_unverified', 'The account has no name to compare with the policy.');
    else if (!e.insureds.some((n) => surname(n) === who)) F('exception', 'insurance_insured_mismatch', 'The account holder is not a named insured or listed driver on the policy.');
  }
  // Which vehicle: the registered vehicle must be on the policy.
  if (!e.vehicleConfirmed) {
    const reg = ctx.user?.documents?.registration?.evidence?.fields || {};
    const plate = plateKey(reg.plate);
    const vin = plateKey(reg.vin);
    if (!e.vehicles.length) F('exception', 'insurance_vehicle_missing', 'No covered vehicle could be read.');
    else if (!plate && !vin) F('exception', 'insurance_vehicle_unverified', 'The registration gives no plate or VIN to compare.');
    else if (!e.vehicles.some((x) => (vin && plateKey(x.vin) === vin) || (plate && plateKey(x.plate) === plate))) {
      F('exception', 'insurance_vehicle_mismatch', 'The registered vehicle is not listed on the policy.');
    }
  }
  // When: in force now.
  if (!e.effective) F('exception', 'insurance_effective_date_missing', 'The policy start date could not be read.');
  else if (Date.parse(`${e.effective}T00:00:00Z`) > now) F('incomplete', 'insurance_not_yet_effective', `The policy starts ${e.effective}.`);
  const exp = (human && human.expiry) || d.expiry;
  if (e.expiration && exp && e.expiration !== exp) F('exception', 'insurance_dates_inconsistent', 'The policy end date differs between two readings.');
  // For what: transportation network company or for-hire use must be stated.
  if (e.tnc === 'no') F('refused', 'insurance_no_tnc_use', 'The policy states no TNC or for-hire coverage.');
  else if (e.tnc !== 'yes') F('exception', 'insurance_tnc_use_unverified', 'TNC or for-hire coverage is not stated.');
  // How much, during a prearranged ride.
  if (!e.rideCombined) F('exception', 'insurance_ride_limit_unreadable', 'The limit during a prearranged ride could not be read.');
  else if (e.rideCombined < R.rideCombinedMinDollars) F('refused', 'insurance_ride_limit_insufficient', `$${e.rideCombined.toLocaleString('en-US')} during a ride; Florida requires $1,000,000.`);
  // How much, while logged on and not engaged.
  const L = e.loggedOn;
  const split = L.perPerson >= R.loggedOn.perPerson && L.perIncident >= R.loggedOn.perIncident && L.propertyDamage >= R.loggedOn.propertyDamage;
  const combined = L.combinedSingle >= R.loggedOn.combinedSingle;
  if (!(L.perPerson || L.perIncident || L.propertyDamage || L.combinedSingle)) {
    F('exception', 'insurance_logged_on_limits_unreadable', 'The limits while logged on and not on a ride could not be read.');
  } else if (!split && !combined) {
    // Readable, but a figure is missing or below. Refused only when every stated figure is read
    // and one is plainly short; a gap in what was read is a person's to check.
    const complete = L.combinedSingle || (L.perPerson && L.perIncident && L.propertyDamage);
    F(complete ? 'refused' : 'exception', complete ? 'insurance_logged_on_limits_insufficient' : 'insurance_logged_on_limits_incomplete',
      'The limits while logged on do not show $50,000 / $100,000 / $25,000.');
  }
  // PIP.
  if (e.pip.shown === 'no') F('refused', 'insurance_no_pip', 'The policy states no personal injury protection.');
  else if (e.pip.shown !== 'yes') F('exception', 'insurance_pip_not_shown', 'Personal injury protection is not shown.');
  else if (!e.pip.amount) F('exception', 'insurance_pip_amount_unreadable', 'The personal injury protection amount could not be read.');
  else if (e.pip.amount < R.pipMinDollars) F('refused', 'insurance_pip_insufficient', `PIP of $${e.pip.amount.toLocaleString('en-US')}; the minimum is $10,000.`);
  // Uninsured / underinsured motorist.
  if (e.um === 'rejected' || e.um === 'rejected_in_writing') {
    if (!R.umRejectionAccepted()) F('exception', 'insurance_um_rejected', 'Uninsured motorist coverage is rejected on the policy; whether that satisfies the TNC rule is awaiting counsel.');
  } else if (e.um !== 'yes') {
    F('exception', 'insurance_um_not_shown', 'Uninsured / underinsured motorist coverage is not shown.');
  }
  return out;
}

/**
 * What stands between one document and qualification: a list, empty when nothing does.
 *
 * `d` is users/{uid}.documents[kind]: the reader's verdict, reasons and evidence, plus
 * `decision` when a person on /ops has decided it. `ctx.user` is the whole account, for the
 * checks that compare documents (the insured's name, the registered vehicle).
 */
function documentFindings(kind, d, now, ctx = {}) {
  const Q = (k, code, reason) => [finding('qualification', k, code, kind, reason)];
  if (!d || !d.verdict) return Q('incomplete', 'document_missing', 'Not submitted.');
  if (d.reuploadRequired && !d.decision) return Q('incomplete', 'document_reupload_required', d.reuploadReason || 'Submit this document again.');
  const human = d.decision && ['accept', 'refuse'].includes(d.decision.verdict) ? d.decision : null;
  const verdict = human ? human.verdict : d.verdict;
  const reasons = (Array.isArray(d.reasons) ? d.reasons : []).join(' ');

  if (verdict === 'refuse') return Q('refused', 'document_refused', human?.note || reasons || 'Refused.');
  if (verdict !== 'accept') return Q('exception', 'document_review', reasons || 'Held for a person to check.');

  // ACCEPTED — now the parts code can check for itself.
  const ev = d.evidence || {};
  if (!human && (ev.isTheRequestedDocument !== true || ev.legible !== true)) {
    return Q('exception', 'document_evidence_inconsistent', 'The reading does not confirm the document type and legibility.');
  }
  const expiry = (human && human.expiry) || d.expiry;
  if (!expiry || Number.isNaN(Date.parse(`${expiry}T00:00:00Z`))) {
    return Q('exception', 'document_expiry_unknown', 'No expiry date is on record.');
  }
  if (expiredOn(expiry, now)) return Q('incomplete', 'document_expired', `Expired ${expiry}. Submit a current one.`);

  if (kind === 'insurance') {
    // The checks the platform has always made, unchanged: commercial use, and $1,000,000.
    const use = human ? human.commercialUse : ev.fields?.commercialUse;
    if (use === 'no') return Q('refused', 'insurance_personal_use', 'Personal-use policy; carrying passengers for hire needs commercial, livery or for-hire cover.');
    if (use !== 'yes') return Q('exception', 'insurance_use_unverified', 'Whether the policy covers carrying passengers for hire is not confirmed.');
    const limit = human ? Number(human.limitDollars) : Math.max(0, ...dollarFigures(ev.fields?.limits));
    if (!(limit > 0)) return Q('exception', 'insurance_limits_unreadable', 'The coverage limits could not be read.');
    if (limit < FL_CARRYING_LIMIT_DOLLARS) {
      return Q('refused', 'insurance_limits_insufficient', `Highest limit shown is $${limit.toLocaleString('en-US')}; Florida requires $1,000,000 while carrying a traveler.`);
    }
    // And the full Florida TNC rule set on the structured reading.
    return insuranceFindings(d, human, ctx, now);
  }
  return [];
}

/** The first finding for one document, or null — kept for callers that want one answer. */
function documentFinding(kind, d, now, ctx = {}) {
  return documentFindings(kind, d, now, ctx)[0] || null;
}

/**
 * Assess an operator.
 *
 * @param user      users/{uid} — authoritative; the app can write only its profile fields there
 * @param fleet     operators/{uid}, or null — server-written, no client writes at all
 * @param context   'qualify' (qualification gates only) | 'online' | 'accept' (both kinds)
 * @param liveMoney Stripe key is live. Background screening is required from then on, the same
 *                  line /operator/online has always drawn.
 * @param account   { disabled: true | false | null } — from Firebase Auth. null = cannot tell.
 * @param payouts   { enabled: boolean } — from Stripe. Required for 'online' and 'accept'.
 *
 * Returns { qualified, eligible, status, blockers[] }. `status` describes qualification:
 * suspended > refused > exception > incomplete > qualified. Never reads a stored approval.
 */
function assessOperator({ user, fleet = null, context = 'qualify', liveMoney = false, account, payouts, now = Date.now() }) {
  const blockers = [];
  const add = (f) => f && blockers.push(f);
  const u = user || null;

  // ---- qualification ---------------------------------------------------------------------
  if (!u) add(finding('qualification', 'incomplete', 'no_account', null, 'This account has no operator record.'));
  if (!account || account.disabled === true) {
    add(finding('qualification', 'suspended', 'account_disabled', null, 'This account is disabled.'));
  } else if (account.disabled !== false) {
    add(finding('qualification', 'incomplete', 'account_unverifiable', null, 'The account status could not be confirmed.'));
  }
  if (u?.suspension?.active) {
    add(finding('qualification', 'suspended', 'suspended', null, u.suspension.note || 'Suspended.'));
  }
  if (u) for (const k of REQUIRED_DOCS) documentFindings(k, u.documents?.[k], now, { user: u }).forEach(add);

  const s = u?.screening || null;
  if (s?.decision === 'refuse') {
    add(finding('qualification', 'refused', 'screening_refused', 'screening', s.summary || 'Background screening refused.'));
  } else if (s?.decision === 'review') {
    add(finding('qualification', 'exception', 'screening_review', 'screening', s.summary || 'Background screening needs a decision.'));
  } else if (fleet?.screeningBlocked) {
    // Set by a refusal or a hold (both handled above from the account record) and by the
    // three-year sweep, which leaves decision 'pass' in place: that one is a re-check owed.
    add(s?.decision === 'pass'
      ? finding('qualification', 'incomplete', 'screening_expired', 'screening', fleet.screeningReason || 'The background screening must be repeated.')
      : finding('qualification', 'refused', 'screening_blocked', 'screening', fleet.screeningReason || 'Background screening does not permit travel.'));
  }
  if (liveMoney && !blockers.some((b) => b.item === 'screening')) {
    if (!s) add(finding('qualification', 'incomplete', 'screening_required', 'screening', 'A background screening is required.'));
    else if (!screeningCurrent(s, now)) {
      add(finding('qualification', 'incomplete', 'screening_expired', 'screening', 'The background screening is more than three years old and must be repeated.'));
    }
  }

  // ---- duty ------------------------------------------------------------------------------
  if (context !== 'qualify') {
    const D = (code, reason) => finding('duty', 'duty', code, null, reason);
    if (u && !disclosureCurrent(u.insuranceDisclosure)) {
      add(D('disclosure_required', 'The insurance disclosure has changed. Read the current one before accepting travel.'));
    }
    if (!payouts || payouts.enabled !== true || fleet?.payoutsEnabled === false) {
      add(D('payouts_not_ready', 'Stripe has not cleared this account for payouts.'));
    }
    if (context === 'accept') {
      if (!fleet || fleet.available !== true) add(D('not_on_duty', 'You are not in service. Commence operations to accept travel.'));
      if (fleet && coverageLapsed(fleet)) add(D('coverage_expired', 'Your commercial coverage has expired.'));
      if (fleet?.documentBlocked) add(D('document_blocked', 'A document on file is not accepted.'));
    }
  }

  const q = blockers.filter((b) => b.gate === 'qualification');
  const rank = ['suspended', 'refused', 'exception', 'incomplete'];
  const status = rank.find((k) => q.some((b) => b.kind === k)) || 'qualified';
  // THE ORDER A PERSON IS TOLD: the most serious first.
  blockers.sort((a, b) => {
    const r = (x) => (x.gate === 'duty' ? 4 : rank.indexOf(x.kind));
    return r(a) - r(b);
  });
  return { qualified: q.length === 0, eligible: blockers.length === 0, status, blockers };
}

/**
 * Assess and record the result on the account, for /ops and for the app to read.
 *
 * THE RECORD IS A SNAPSHOT, NEVER AUTHORITY. Nothing reads `qualification` back to decide
 * anything; every gate calls assessOperator afresh. It exists so the exception queue can be
 * queried and the operator can be told where they stand.
 *
 * @param checks async (uid, user) => ({ account, payouts }) — the network half (Firebase Auth,
 *               Stripe), injected so this can run in a test.
 */
async function assessAndRecord({ db, uid, checks, context = 'qualify', liveMoney = false, now = Date.now() }) {
  const userRef = db.collection('users').doc(String(uid));
  const opRef = db.collection('operators').doc(String(uid));
  const [uSnap, oSnap] = await Promise.all([userRef.get(), opRef.get()]);
  const user = uSnap.exists ? uSnap.data() : null;
  const fleet = oSnap.exists ? oSnap.data() : null;
  const ext = await checks(uid, user);
  const a = assessOperator({ user, fleet, context, liveMoney, account: ext.account, payouts: ext.payouts, now });
  const prev = user?.qualification || {};
  if (user) {
    await userRef.set(
      {
        qualification: {
          status: a.status,
          qualified: a.qualified,
          blockers: a.blockers.filter((b) => b.gate === 'qualification'),
          evaluatedAt: now,
          qualifiedAt: a.qualified ? prev.qualifiedAt || now : null,
        },
      },
      { merge: true },
    );
  }
  // LOSS IS IMMEDIATE. An operator who stops qualifying leaves dispatch now, not at the next
  // renewal. Gaining it puts nobody on duty — only /operator/online does that.
  if (!a.qualified && fleet) await opRef.set({ available: false, commissioned: false, offDutyReason: a.blockers[0]?.code || null, offDutyAt: now }, { merge: true });
  return a;
}

// ---- the exception console's actions --------------------------------------------------------
//
// EVERY ONE IS AUTHENTICATED BY THE CALLER (backend/ops.js checks the /ops session) AND WRITES
// ITS OWN AUDIT ENTRY IN THE SAME TRANSACTION AS THE CHANGE — so there is no change without an
// entry and no entry without a change. `audit_log` is server-only (firestore.rules denies every
// client read and write by default).

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function auditEntry({ actor, action, uid, item, before, after, note, now }) {
  return {
    at: now,
    actor: { name: actor?.name || 'unknown', ip: actor?.ip || null, userAgent: actor?.userAgent || null, session: actor?.session || null },
    action,
    subject: String(uid),
    item: item || null,
    before: before === undefined ? null : before,
    after: after === undefined ? null : after,
    note,
  };
}

/**
 * A person decides one document — a held one, or reconsiders a refused one.
 *
 * An accept still passes every deterministic check in documentFinding: the person supplies the
 * expiry when the reading had none, and for insurance confirms commercial use and states the
 * limit they read, which is then held to Florida's figure like any other.
 */
async function resolveDocument({ db, uid, kind, action, actor, note, expiry, commercialUse, limitDollars, verified, now = Date.now() }) {
  if (!REQUIRED_DOCS.includes(kind)) return { ok: false, status: 400, error: 'Unknown document' };
  if (!['accept', 'refuse'].includes(action)) return { ok: false, status: 400, error: 'Unknown action' };
  const why = String(note || '').trim().slice(0, 500);
  if (!why) return { ok: false, status: 400, error: 'A note is required for every decision' };
  if (expiry && !ISO_DATE.test(String(expiry))) return { ok: false, status: 400, error: 'Expiry must be YYYY-MM-DD' };
  // A PERSON ACCEPTING INSURANCE STATES WHAT THEY READ, field by field, and the same rules then
  // judge it: they can resolve what the reader could not read, not waive a minimum.
  let verifiedIns = null;
  if (action === 'accept' && kind === 'insurance') {
    const v = verified || {};
    if (commercialUse !== 'yes') return { ok: false, status: 400, error: 'Confirm the policy covers carrying passengers for hire' };
    if (!(Number(limitDollars) > 0)) return { ok: false, status: 400, error: 'State the liability limit shown on the policy' };
    if (v.effectiveDate && !ISO_DATE.test(String(v.effectiveDate))) return { ok: false, status: 400, error: 'Policy start must be YYYY-MM-DD' };
    verifiedIns = {
      insuredConfirmed: v.insuredConfirmed === true,
      vehicleConfirmed: v.vehicleConfirmed === true,
      ...(v.effectiveDate ? { effectiveDate: String(v.effectiveDate) } : {}),
      ...(v.tncUse === 'yes' ? { tncUse: 'yes' } : {}),
      rideCombinedDollars: Number(v.rideCombinedDollars) || Number(limitDollars),
      ...(Number(v.loggedOnCombinedDollars) > 0 ? { loggedOnCombinedDollars: Number(v.loggedOnCombinedDollars) } : {}),
      ...(Number(v.pipDollars) > 0 ? { pipDollars: Number(v.pipDollars) } : {}),
      ...(['yes', 'rejected_in_writing'].includes(v.uninsuredMotorist) ? { uninsuredMotorist: v.uninsuredMotorist } : {}),
    };
  }
  const userRef = db.collection('users').doc(String(uid));
  const auditRef = db.collection('audit_log').doc();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const d = snap.exists ? snap.data().documents?.[kind] : null;
    if (!d) return { ok: false, status: 404, error: 'No such document' };
    const decision = {
      verdict: action,
      by: actor?.name || 'unknown',
      at: now,
      note: why,
      ...(expiry ? { expiry: String(expiry) } : {}),
      ...(kind === 'insurance' && action === 'accept' ? { commercialUse: 'yes', limitDollars: Number(limitDollars), verified: verifiedIns } : {}),
    };
    tx.set(userRef, { documents: { [kind]: { decision } } }, { merge: true });
    tx.set(auditRef, auditEntry({ actor, action: `document_${action}`, uid, item: kind, before: d.decision || { readerVerdict: d.verdict }, after: decision, note: why, now }));
    return { ok: true, decision };
  });
}

/** Suspend (fraud, safety, administrative) or reinstate. Suspension ends duty at once. */
async function setSuspension({ db, uid, active, actor, note, now = Date.now() }) {
  const why = String(note || '').trim().slice(0, 500);
  if (!why) return { ok: false, status: 400, error: 'A note is required for every decision' };
  const userRef = db.collection('users').doc(String(uid));
  const opRef = db.collection('operators').doc(String(uid));
  const auditRef = db.collection('audit_log').doc();
  return db.runTransaction(async (tx) => {
    const [snap, opSnap] = await Promise.all([tx.get(userRef), tx.get(opRef)]);
    if (!snap.exists) return { ok: false, status: 404, error: 'No such operator' };
    const before = snap.data().suspension || null;
    const after = { active: !!active, by: actor?.name || 'unknown', at: now, note: why };
    tx.set(userRef, { suspension: after }, { merge: true });
    if (active && opSnap.exists) tx.set(opRef, { available: false, commissioned: false, offDutyReason: 'suspended', offDutyAt: now }, { merge: true });
    tx.set(auditRef, auditEntry({ actor, action: active ? 'suspend' : 'reinstate', uid, before, after, note: why, now }));
    return { ok: true };
  });
}

module.exports = {
  REQUIRED_DOCS,
  FL_CARRYING_LIMIT_DOLLARS,
  FL_TNC_INSURANCE,
  dollarFigures,
  documentFinding,
  documentFindings,
  insuranceFindings,
  assessOperator,
  assessAndRecord,
  resolveDocument,
  setSuspension,
};
