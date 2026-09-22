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

// FLORIDA'S LIMIT, as the platform already states it (backend/site.js, Insurance): $1,000,000
// while carrying a traveler, §627.748(7)(b); $50,000 / $100,000 / $25,000 while available and
// unmatched, §627.748(7)(c). A single limit of $1,000,000 satisfies both, so the check is that
// the declarations page shows at least that figure. Lower figures alone are a refusal; no
// figure that can be read is an exception for a person.
const FL_CARRYING_LIMIT_DOLLARS = 1000000;

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

/**
 * What stands between one document and qualification, or null when nothing does.
 *
 * `d` is users/{uid}.documents[kind]: the reader's verdict, reasons and evidence, plus
 * `decision` when a person on /ops has decided it.
 */
function documentFinding(kind, d, now) {
  const Q = (k, code, reason) => finding('qualification', k, code, kind, reason);
  if (!d || !d.verdict) return Q('incomplete', 'document_missing', 'Not submitted.');
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
    const use = human ? human.commercialUse : ev.fields?.commercialUse;
    if (use === 'no') return Q('refused', 'insurance_personal_use', 'Personal-use policy; carrying passengers for hire needs commercial, livery or for-hire cover.');
    if (use !== 'yes') return Q('exception', 'insurance_use_unverified', 'Whether the policy covers carrying passengers for hire is not confirmed.');
    const limit = human ? Number(human.limitDollars) : Math.max(0, ...dollarFigures(ev.fields?.limits));
    if (!(limit > 0)) return Q('exception', 'insurance_limits_unreadable', 'The coverage limits could not be read.');
    if (limit < FL_CARRYING_LIMIT_DOLLARS) {
      return Q('refused', 'insurance_limits_insufficient', `Highest limit shown is $${limit.toLocaleString('en-US')}; Florida requires $1,000,000 while carrying a traveler.`);
    }
  }
  return null;
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
  if (u) for (const k of REQUIRED_DOCS) add(documentFinding(k, u.documents?.[k], now));

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
async function resolveDocument({ db, uid, kind, action, actor, note, expiry, commercialUse, limitDollars, now = Date.now() }) {
  if (!REQUIRED_DOCS.includes(kind)) return { ok: false, status: 400, error: 'Unknown document' };
  if (!['accept', 'refuse'].includes(action)) return { ok: false, status: 400, error: 'Unknown action' };
  const why = String(note || '').trim().slice(0, 500);
  if (!why) return { ok: false, status: 400, error: 'A note is required for every decision' };
  if (expiry && !ISO_DATE.test(String(expiry))) return { ok: false, status: 400, error: 'Expiry must be YYYY-MM-DD' };
  if (action === 'accept' && kind === 'insurance') {
    if (commercialUse !== 'yes') return { ok: false, status: 400, error: 'Confirm the policy covers carrying passengers for hire' };
    if (!(Number(limitDollars) > 0)) return { ok: false, status: 400, error: 'State the liability limit shown on the policy' };
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
      ...(kind === 'insurance' && action === 'accept' ? { commercialUse: 'yes', limitDollars: Number(limitDollars) } : {}),
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
  dollarFigures,
  documentFinding,
  assessOperator,
  assessAndRecord,
  resolveDocument,
  setSuspension,
};
