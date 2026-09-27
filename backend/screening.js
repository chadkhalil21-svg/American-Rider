// Operator screening — statutory adjudication, renewal and provider-neutral evidence review.
//
// Florida launch rule set: Fla. Stat. §627.748 requires the TNC to conduct or have conducted
// the specified criminal-background searches and to obtain/review driving history before
// authorization, with recurring checks every three years. Procurement is external; this
// module never treats payment, a vendor brand, or an Operator declaration as qualification.
//
// Other states must supply their own activated jurisdiction rule set before operation. Unknown
// jurisdictions fail closed elsewhere in the qualification/market gates.

const { readKey } = require('./env');
const { adminDb } = require('./firebase-admin');
const { fileTicket } = require('./tickets');

// Screening procurement is deliberately provider-neutral. American Rider does not collect a
// screening payment or sell a report. The approved CRA workflow is configured externally and
// the Operator pays that provider directly. Existing reports are never accepted from an
// Operator declaration alone; authoritative provider evidence must be reviewed first.
//
// Florida's three-year interval is the recurrence duty after a qualifying American Rider
// check. It is not treated as automatic portability for another end user's report.

const REQUIRED_ELEMENTS = [
  'nationwide_criminal', // §627.748(12)(a)2.a — Multi-State/Multi-Jurisdiction or similar
  'sex_offender',        // §627.748(12)(a)2.b — the National Sex Offender Public Website
  'driving_history',     // §627.748(12)(a)3   — the driving history research report
];

const YEAR = 365 * 24 * 60 * 60 * 1000;

/** Florida requires the whole check again every three years. */
const RECHECK_MS = 3 * YEAR;

// ---- THE STANDARD -------------------------------------------------------------------------
// Written from §627.748 and applied identically to everybody. An operator is refused if, in
// the stated window, the report shows any of these. Nothing here is discretionary, and nothing
// outside it disqualifies anybody: a record that is not on this list is not our business.
// CORRECTED 23 Aug 2026, against §627.748(12)(d) read in full. The first version of this list
// was written from memory and was WRONG IN TWO PLACES, both of them in the direction that lets
// somebody drive who may not:
//   - the violent-offence window was 3 years. The statute says FIVE. A battery conviction four
//     years old passed.
//   - driving on a suspended or revoked licence within 3 years was missing altogether.
// Both are now here, and every window below is quoted from the statute rather than recalled.
const DISQUALIFIERS = [
  // (12)(d)1. "A felony" — within 5 years.
  { id: 'felony', years: 5, test: (r) => r.type === 'felony' },
  // (12)(d)2. "A misdemeanor for driving under the influence of drugs or alcohol, for reckless
  // driving, for hit and run, or for fleeing or attempting to elude a law enforcement officer".
  {
    id: 'driving_misdemeanor',
    years: 5,
    test: (r) => r.type === 'misdemeanor' && /dui|driving under the influence|reckless|hit and run|hit-and-run|flee|eluding/i.test(r.charge || ''),
  },
  // (12)(d)3. "A misdemeanor for a violent offense or sexual battery, or a crime of lewdness or
  // indecent exposure under chapter 800". Five years, not three. Felonies of the same kind are
  // already caught above.
  {
    id: 'violent',
    years: 5,
    test: (r) => /assault|battery|homicide|murder|manslaughter|robbery|kidnap|sexual|rape|weapon|firearm|domestic violence|lewd|indecent exposure/i.test(r.charge || ''),
  },
  // (12)(d)4. "Has been convicted, within the past 3 years, of driving with a suspended or
  // revoked license." Its own window, and its own rule.
  {
    id: 'suspended_license',
    years: 3,
    test: (r) => /suspend|revok/i.test(r.charge || '') && /licen[sc]e|driving/i.test(r.charge || ''),
  },
];

/**
 * Decide a report.
 *
 * @param report {
 *   status,               'clear' | 'consider' | 'suspended'
 *   records: [{ type, charge, disposition, date }],
 *   sexOffender: bool,
 *   license: { valid, state },
 *   movingViolations3y: number,
 * }
 *
 * Returns { decision: 'pass'|'refuse'|'review', reasons: [], summary }.
 *
 * `review` is deliberately rare and always safe: nobody drives on a `review`.
 */
function adjudicate(report, { now = Date.now() } = {}) {
  const reasons = [];

  // The two absolute bars. Both are stated in the statute without a time window.
  if (report.sexOffender) {
    reasons.push('Listed on the National Sex Offender Public Website.');
  }
  if (report.license && report.license.valid === false) {
    reasons.push('No valid driver license.');
  }
  // More than three moving violations in the previous three years.
  if (Number(report.movingViolations3y) > 3) {
    reasons.push(`${report.movingViolations3y} moving violations in the previous three years.`);
  }

  const records = Array.isArray(report.records) ? report.records : [];
  const unplaceable = [];

  for (const r of records) {
    // A charge that did not result in a conviction is not a conviction. The statute
    // disqualifies on what a check "reveals" as an offence; a dismissal reveals none.
    if (/dismiss|nolle|acquit|not guilty|expunge|seal/i.test(r.disposition || '')) continue;

    const when = Date.parse(r.date || '');
    if (Number.isNaN(when)) {
      // No date means the rules cannot place it in a window. NOT waved through and NOT
      // refused — this is exactly what `review` is for.
      unplaceable.push(r);
      continue;
    }
    const yearsAgo = (now - when) / YEAR;
    for (const d of DISQUALIFIERS) {
      if (yearsAgo <= d.years && d.test(r)) {
        reasons.push(
          `${r.charge || d.id} (${r.type || 'record'}), ${yearsAgo.toFixed(1)} years ago.`,
        );
        break;
      }
    }
  }

  if (reasons.length) {
    return {
      decision: 'refuse',
      reasons,
      summary: `Does not meet Florida's requirements for a transportation network operator.`,
    };
  }
  if (report.status === 'suspended') {
    return {
      decision: 'review',
      reasons: ['The screening company suspended the report.'],
      summary: 'The screening could not be completed.',
    };
  }
  // A provider may flag a report even when the normalized findings are unavailable. Never turn
  // an unreadable flagged result into a pass.
  if (report.status === 'consider' && records.length === 0) {
    return {
      decision: 'review',
      reasons: ['The screening company flagged this report, but its findings could not be read by the standard.'],
      summary: 'Flagged by the screening company; authoritative findings are unavailable. Source clarification is required before qualification can continue.',
    };
  }
  if (unplaceable.length) {
    return {
      decision: 'review',
      reasons: unplaceable.map((r) => `${r.charge || 'record'} — no date on the record.`),
      summary: 'A record on this report has no usable date and cannot be placed in a statutory window. Source clarification is required.',
    };
  }
  return { decision: 'pass', reasons: [], summary: 'Meets Florida’s requirements.' };
}

/**
 * Record a decision against the operator, and set the three-year clock.
 *
 * A REFUSAL IS NOT A DELETION. The record stands, with its reasons, because the FCRA requires
 * us to be able to tell the person what the report said and to give them a chance to dispute
 * it — and because "we simply do not have you" is not an answer anybody can act on.
 */
/**
 * @param issuedAt when the REPORT was produced. Absent for one we ordered ourselves, since
 *                 that is now. Present for one an operator brought from another company — and
 *                 it is what the three-year clock runs from, not the day we read it. A report
 *                 conducted two years ago is two years into its life, not starting one.
 */
async function recordDecision({ uid, decision, reasons, summary, reportId, provider, issuedAt, adverseAction = null }) {
  const db = adminDb();
  if (!db) return { ok: false, reason: 'no database' };
  const now = Date.now();
  const conductedAt = Number(issuedAt) > 0 ? Number(issuedAt) : now;
  const storedDecision = decision === 'refuse' ? 'pre_adverse' : decision;
  try {
    await db.collection('users').doc(String(uid)).set(
      {
        screening: {
          decision: storedDecision,
          proposedDecision: decision === 'refuse' ? 'refuse' : null,
          reasons: reasons || [],
          summary: summary || '',
          reportId: reportId || null,
          provider: provider || 'checkr',
          checkedAt: now,
          conductedAt,
          // §627.748(12)(b), from the date the check was actually conducted.
          recheckDue: conductedAt + RECHECK_MS,
          ...(adverseAction ? { adverseAction } : {}),
        },
      },
      { merge: true },
    );
    // A refused or held operator must not be dispatchable, whatever else is true of them.
    if (storedDecision !== 'pass') {
      await db.collection('operators').doc(String(uid)).set(
        { available: false, screeningBlocked: true, screeningReason: summary || '' },
        { merge: true },
      );
    } else {
      await db.collection('operators').doc(String(uid)).set(
        { screeningBlocked: false, screeningReason: null, screeningCheckedAt: now },
        { merge: true },
      );
    }

    if (decision === 'review') {
      await fileTicket({
        uid,
        kind: 'support',
        reason: 'Operator screening needs source clarification',
        description:
          `A screening result could not be placed by the statutory standard.\n${summary}\n` +
          `${(reasons || []).join('\n')}\nReport ${reportId || '—'}. Nobody drives until the ` +
          `authoritative source is clarified or the exception is resolved.`,
      });
    }
    return { ok: true, decision: storedDecision, proposedDecision: decision === 'refuse' ? 'refuse' : null };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

async function recordAdverseState({ uid, state, actionId = null, reportId = null, final = false, note = null }) {
  const db = adminDb();
  if (!db) return { ok: false, reason: 'no database' };
  const now = Date.now();
  await db.collection('users').doc(String(uid)).set({
    screening: {
      adverseAction: { state, actionId, reportId, updatedAt: now, ...(note ? { note } : {}) },
      ...(final ? { decision: 'refuse', proposedDecision: null, finalizedAt: now } : {}),
    },
  }, { merge: true });
  await db.collection('operators').doc(String(uid)).set({
    available: false,
    screeningBlocked: true,
    screeningReason: note || 'Background screening is not cleared.',
  }, { merge: true });
  return { ok: true };
}

/**
 * A screening the operator already has, brought from another company.
 *
 * WHY THIS IS LAWFUL, and it is the one route that is. A report cannot be handed to us by the
 * platform that bought it — their permissible purpose was theirs, and Checkr's agreement binds
 * a report to "the end-user's exclusive one-time use". But FCRA §604(a)(2) gives a permissible
 * purpose "in accordance with the written instructions of the consumer to whom it relates". So
 * the operator instructs THEIR screening company to send the report to American Rider, and the
 * screening company may lawfully do so.
 *
 * TWO CONDITIONS THAT ARE NOT NEGOTIABLE:
 *   1. It arrives FROM THE SCREENING COMPANY, never from the operator. A PDF that passed
 *      through the hands of the person it is about is not evidence about that person.
 *   2. It contains all three things the statute names. Many gig checks buy the criminal half
 *      and skip the driving history, which cannot answer two of Florida's own disqualifiers.
 *
 * Returns what it would cost the operator to proceed: nothing when the report is complete,
 * the MVR alone when only the driving half is missing, the full fee otherwise.
 */
function evaluateExistingReport({ source, issuedAt, elements }) {
  const has = new Set(Array.isArray(elements) ? elements : []);
  const missing = REQUIRED_ELEMENTS.filter((e) => !has.has(e));
  if (source !== 'agency') {
    return { accept: false, review: true, missing, reason: 'The authoritative report must come from the screening provider.' };
  }
  if (!Number.isFinite(Number(issuedAt)) || Number(issuedAt) <= 0) {
    return { accept: false, review: true, missing, reason: 'The provider report date must be verified before it can be evaluated.' };
  }
  return {
    accept: false,
    review: true,
    missing,
    reason: missing.length
      ? 'Preserve every qualifying component and obtain only the components still required by the active jurisdiction.'
      : 'All declared components are present, but the provider report still requires provenance, permissible-purpose, jurisdiction and freshness review before qualification.',
  };
}

/** Whether an operator's screening is current. Read at dispatch, not only at onboarding. */
function screeningCurrent(screening, now = Date.now()) {
  if (!screening || screening.decision !== 'pass') return false;
  return Number(screening.recheckDue || 0) > now;
}

/** Is a screening provider configured? `/health` and /ops report it. */
const screeningReady = () => /^https:\/\//i.test(String(readKey('SCREENING_PROVIDER_URL') || '').trim());

// How far ahead of the three-year deadline the operator is warned. Thirty days: enough to
// pay and complete a new check without losing a single day on the road, short enough that
// the warning still feels like it is about something.
const RECHECK_WARN_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The recheck clock, actually operated. §627.748(12)(b) requires the whole check again every
 * three years, and screeningCurrent() already stops dispatch the day the clock runs out —
 * but a stop with no warning is an operator who silently fell off the road and does not know
 * why. One sweep tick:
 *
 *   - inside the 30-day window and not yet warned  → push, once, marked so it stays once
 *   - past the deadline and not yet acted on       → dispatch flag set, push, case filed
 *
 * Both writes are idempotent by marker (recheckWarnedAt / recheckExpiredAt), so the sweep
 * can run every minute without repeating itself.
 */
async function sweepScreening({ now = Date.now() } = {}) {
  const db = adminDb();
  if (!db) return { ok: false, reason: 'no database' };
  const { notify } = require('./push'); // required here, not at top: push has no reason to load for adjudication-only callers
  let warned = 0;
  let expired = 0;
  try {
    const snap = await db
      .collection('users')
      .where('screening.recheckDue', '<=', now + RECHECK_WARN_MS)
      .limit(200)
      .get();
    for (const doc of snap.docs) {
      const s = doc.data().screening || {};
      if (s.decision !== 'pass') continue; // refused/held operators already cannot drive
      const uid = doc.id;
      if (Number(s.recheckDue) <= now && !s.recheckExpiredAt) {
        await db.collection('operators').doc(uid).set(
          { available: false, screeningBlocked: true, screeningReason: 'Background check expired — Florida requires a new one every 3 years.' },
          { merge: true },
        );
        await doc.ref.set({ screening: { recheckExpiredAt: now } }, { merge: true });
        await notify({
          uid,
          kind: 'screening_due',
          title: 'Your background check has expired',
          body: 'Florida requires a new check every 3 years. Renew it in the app to keep driving.',
        });
        await fileTicket({
          uid,
          kind: 'support',
          reason: 'Operator screening expired — 3-year recheck due',
          description: `Operator ${uid}'s screening passed ${new Date(Number(s.conductedAt || 0)).toISOString().slice(0, 10)} and expired ${new Date(Number(s.recheckDue)).toISOString().slice(0, 10)}. Dispatch is blocked until a new check passes.`,
        });
        expired += 1;
      } else if (Number(s.recheckDue) > now && !s.recheckWarnedAt) {
        await doc.ref.set({ screening: { recheckWarnedAt: now } }, { merge: true });
        await notify({
          uid,
          kind: 'screening_due',
          title: 'Background check renewal due soon',
          body: `Florida requires a new check every 3 years — yours is due ${new Date(Number(s.recheckDue)).toLocaleDateString('en-US')}. Renew in the app to avoid any pause.`,
        });
        warned += 1;
      }
    }
    return { ok: true, warned, expired, scanned: snap.size };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

module.exports = {
  adjudicate,
  evaluateExistingReport,
  REQUIRED_ELEMENTS,
  recordDecision, recordAdverseState,
  screeningCurrent,
  screeningReady,
  sweepScreening,
  RECHECK_MS,
  RECHECK_WARN_MS,
  DISQUALIFIERS,
};
