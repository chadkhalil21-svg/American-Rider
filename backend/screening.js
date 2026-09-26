// Operator screening — ordering it, and deciding what the result means.
//
// THE LAW THIS IMPLEMENTS. Fla. Stat. §627.748 requires American Rider, as the TNC, to conduct
// or have conducted a criminal background check that includes a Multi-State/Multi-Jurisdiction
// Criminal Records Locator (or similar COMMERCIAL nationwide database, with any hit validated
// at the primary source) and the National Sex Offender Public Website, and to obtain and
// review a driving history report. Again every three years.
//
// WHY THE OPERATOR CANNOT SIMPLY BRING US ONE THEY ALREADY HAVE. Under the FCRA a screening
// company may release a report only to an end user with a permissible purpose FOR THAT REPORT.
// Uber's purpose was Uber's decision; it does not transfer, and Checkr's own agreement binds a
// report to "the end-user's exclusive one-time use". This is why Uber does not accept Lyft's
// check either. It is not the vendor being difficult; it is the statute.
//
// WHO PAYS (Chad, 23 Aug 2026 — pre-revenue, minimal funding). The operator does. AMERICAN
// RIDER STILL ORDERS IT, because it must: the account, the permissible purpose and the
// compliance record are ours, and an operator buying a consumer report about themselves does
// not satisfy the statute. So the fee is a PASS-THROUGH — the operator pays American Rider
// exactly what the screening costs, not a cent more, and American Rider pays the screening
// company. Never described as a fee American Rider charges, because it is not one.
//
// HOW MOST OF THEM ARE DECIDED IN A SECOND. Checkr returns `clear`, `consider` or `suspended`.
// `clear` passes instantly with nobody involved. `consider` is put through the statutory
// standard below, which is deterministic and resolves every case the authoritative data can
// place. American Rider adds no discretionary criminal-history exclusions beyond the statutory standard
// jurisdiction's rule set. If source data is missing, contradictory or under dispute, the
// operator remains blocked while the source is clarified; nobody is asked to guess. Human
// review is the last exception path for a genuine source conflict, not a routine approval step.
const { readKey } = require('./env');
const { adminDb } = require('./firebase-admin');
const { fileTicket } = require('./tickets');

// What the operator is charged, in cents. THE PASS-THROUGH, and it must equal what we are
// actually billed, to the cent. If a vendor price changes this changes the same day — a
// pass-through that has drifted is a margin nobody agreed to.
//
//   Checkr Basic+                      $29.99   the nationwide criminal database and the
//                                               National Sex Offender Public Website —
//                                               §627.748(12)(a)2.a and 2.b
//   Checkr MVR add-on                   $9.50   the driving history research report —
//                                               §627.748(12)(a)3, a SEPARATE requirement
//   Florida DHSMV, 3-year record        $8.00   passed through by Checkr at cost. Three years
//                                               because the statute's own test is "more than
//                                               three moving violations in the prior 3-year
//                                               period"; the 7-year record costs $10 and
//                                               answers a question nobody asked.
//                                     -------
//                                      $47.49
//
// THE MVR IS NOT AN EXTRA. §627.748(12)(a)3: "The TNC must obtain and review, or have a third
// party obtain and review, a driving history research report for the applicant." Basic alone
// cannot answer two of the statute's own disqualifying questions — more than three moving
// violations in three years, and driving on a suspended or revoked licence — because a
// criminal database does not hold driving records. Dropping it would leave us unable to apply
// the standard we are required to apply, and unable to prove we did at the biennial CPA
// examination §627.748(9) requires.
const SCREENING_FEE_CENTS = 4749;

// WHAT THE OPERATOR IS ASKED FOR, which is not the same number (Chad, 27 Aug 2026).
//
// American Rider does not absorb the card processing on a pass-through it earns nothing from.
// Stripe takes 2.9% + $0.30 of whatever is charged, so the charge is grossed up to leave the
// screening cost intact:  charge = (cost + $0.30) / (1 − 2.9%)
//
//   full screening        $47.49 cost  ->  $49.22 charged   (Stripe $1.73, we keep $0.00)
//   driving history only  $17.50 cost  ->  $18.34 charged   (Stripe $0.83, we keep $0.00)
//
// EVERY LINE OF THIS IS SHOWN TO THE OPERATOR. A person handing over $49.22 is entitled to see
// the $47.49, the $1.73, and the $0.00 — the whole point of the arrangement is that we take
// nothing, and a single undifferentiated figure hides exactly that.
const PROCESSING_PCT = 0.029;
const PROCESSING_FIXED_CENTS = 30;

/** What to charge so that `costCents` survives Stripe's cut intact. */
function withProcessing(costCents) {
  return Math.ceil((costCents + PROCESSING_FIXED_CENTS) / (1 - PROCESSING_PCT));
}

/** The processing portion of a charge — shown as its own line, never folded in. */
function processingOn(costCents) {
  return withProcessing(costCents) - costCents;
}

// If the operator brings a screening that already covers the criminal half but not the
// driving half — common, since some gig platforms buy the database check alone — this is all
// they pay. Checkr's MVR add-on plus Florida's own 3-year record fee.
const MVR_ONLY_FEE_CENTS = 1750;

// AND THE MIRROR CASE, which was missing until 29 Aug 2026 and Chad found it.
//
// An operator may arrive with the DRIVING half already done and the criminal half not — a
// courier platform buys the MVR, a former employer ran one, an insurer required one. The
// adjudication handled the opposite case ($17.50 for the MVR alone) and sent this one to the
// full $47.49, which charges them a second time for the very MVR they had just given us.
// "We do not want to force a package that is not required, ever" (Chad, 27 Aug) applies in
// both directions or it is not a rule.
//
// $29.99 is Checkr Basic+: the multi-state criminal database search AND the National Sex
// Offender Public Website, which are §627.748(12)(a)2.a and 2.b — the whole criminal half.
// No Florida DMV fee, because no driving record is being pulled.
const BASIC_ONLY_FEE_CENTS = 2999;

/** The criminal half of the statutory check: everything except the driving record. */
const CRIMINAL_ELEMENTS = ['nationwide_criminal', 'sex_offender'];

// WHY THIS TIER EXISTS AT ALL. Several gig platforms buy the criminal half of a screening and
// skip the driving record. An operator who brings one of those has already satisfied two of
// Florida's three requirements, and charging them for all three would be selling them
// something they demonstrably do not need.

// ---- WHAT THE OPERATOR IS ACTUALLY CHARGED (Chad, 27 Aug 2026) ---------------------------
//
// The screening cost is a pass-through, and the card processor's cut is now passed through
// TOO — itemized, never hidden. Stripe keeps 2.9% + 30¢ of whatever is charged, so charging
// the bare cost meant American Rider quietly lost ~$1.68 per screening; absorbing it was one
// option, and Chad chose the other: the operator sees the true, complete cost —
//
//   background check        $47.49   (what the screening company bills, to the cent)
//   payment processing       $1.73   (Stripe's 2.9% + $0.30, computed, never hardcoded)
//   ------------------------------
//   total                   $49.22
//
// THE MATH, because it is easy to get wrong by a dime: the processor takes its percentage
// of the CHARGED amount, not of the cost, so the break-even gross is
//     G = (cost + fixed) / (1 - pct)
// and anything computed as cost x 1.029 + 0.30 overshoots — at $49.32 American Rider would
// MAKE ten cents per check, which is margin nobody agreed to, in the other direction.
// Math.ceil keeps the rounding penny on our side of honesty (we may lose a cent, never gain).
const STRIPE_PCT = 0.029;
const STRIPE_FIXED_CENTS = 30;

/** The gross charge whose net, after Stripe's cut, equals the cost. */
function grossUpCents(costCents) {
  return Math.ceil((costCents + STRIPE_FIXED_CENTS) / (1 - STRIPE_PCT));
}

/** One quote, itemized: what it costs, what collection costs, what the operator pays. */
function screeningQuote(costCents) {
  const totalCents = grossUpCents(costCents);
  return { costCents, processingCents: totalCents - costCents, totalCents };
}

// How old a report we already have may be. THREE YEARS — and this is not a guess, it is the
// statute's own measure of how long a check stays current. §627.748(12)(b): "The TNC shall
// conduct the background check required under paragraph (a) for a TNC driver every 3 years."
//
// I had this at twelve months, which was more cautious than the law and cost operators money
// for no legal reason. Chad's instruction (23 Aug) is to hold to what the law requires and
// nothing more, and the law's number is three years.
//
// WHAT MAKES IT SAFE RATHER THAN SLACK. The re-check clock runs from the REPORT'S OWN DATE,
// not from the day we accepted it — see recordDecision. So an operator arriving with a report
// two years and eleven months old is accepted and re-checked one month later, at our cost of
// nothing and their cost of the ordinary fee. The blind spot and the re-check move together;
// the older the report, the sooner it is replaced. Nobody gets three unwatched years.
const ACCEPT_EXISTING_MAX_AGE_MS = 3 * 365 * 24 * 60 * 60 * 1000;

// What an accepted report must contain, because the statute names all three.
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
  // A `consider` the parser got NOTHING out of. Checkr says something appeared on this
  // report; if our mapping produced zero records to test, the something was not read — and
  // "not read" must never become "pass". This closes the hole where a consider with an
  // unparsed body matched no disqualifier and sailed through adjudication. A consider whose
  // records WERE parsed and all fall outside the statute still passes, exactly as designed:
  // dismissals and aged-out offences are not ours to hold against anybody.
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
function evaluateExistingReport(
  { source, issuedAt, elements },
  // mvrOnlyAvailable: whether an MVR-only package actually exists at the screening company.
  // Checkr's self-serve package builder cannot make one (confirmed 27 Aug 2026 — the wizard's
  // floor is Basic+), so until their support provisions it, CHECKR_PACKAGE_MVR is unset and
  // the driving-history-only price MUST NOT be quoted: a $17.50 fee the order endpoint cannot
  // place is a paid dead end, which is the exact shape of hole this file exists to prevent.
  {
    now = Date.now(),
    mvrOnlyAvailable = !!readKey('CHECKR_PACKAGE_MVR'),
    // Basic+ is Checkr's own self-serve default package, so this one is available as soon as
    // any package is — unlike MVR-only, which their wizard cannot build.
    criminalOnlyAvailable = !!readKey('CHECKR_PACKAGE_BASIC'),
  } = {},
) {
  const has = new Set(Array.isArray(elements) ? elements : []);
  const missing = REQUIRED_ELEMENTS.filter((e) => !has.has(e));
  const age = now - Number(issuedAt || 0);

  if (source !== 'agency') {
    return {
      accept: false,
      tier: 'full',
      feeCents: SCREENING_FEE_CENTS,
      reason:
        'A screening must reach American Rider from the screening company itself. Ask them to ' +
        'send it to us directly.',
    };
  }
  if (!Number.isFinite(Number(issuedAt)) || age > ACCEPT_EXISTING_MAX_AGE_MS) {
    return {
      accept: false,
      tier: 'full',
      feeCents: SCREENING_FEE_CENTS,
      reason: 'That screening is more than three years old. Florida requires a new one.',
    };
  }
  if (missing.length === 1 && missing[0] === 'driving_history') {
    if (!mvrOnlyAvailable) {
      return {
        accept: false,
        tier: 'full',
        feeCents: SCREENING_FEE_CENTS,
        partial: true,
        reason:
          'The criminal record check is accepted, but the driving history cannot yet be ' +
          'ordered on its own — a full screening is needed for now.',
      };
    }
    return {
      accept: false,
      tier: 'mvr',
      feeCents: MVR_ONLY_FEE_CENTS,
      partial: true,
      reason: 'The criminal record check is accepted. Only the driving history is still needed.',
    };
  }
  // THE MIRROR CASE. The driving record is in hand and some or all of the criminal half is
  // not, so only the criminal half is bought — never the MVR again.
  if (missing.length && missing.every((e) => CRIMINAL_ELEMENTS.includes(e))) {
    if (!criminalOnlyAvailable) {
      return {
        accept: false,
        tier: 'full',
        feeCents: SCREENING_FEE_CENTS,
        partial: true,
        reason:
          'The driving history is accepted, but the criminal record check cannot yet be ' +
          'ordered on its own — a full screening is needed for now.',
      };
    }
    return {
      accept: false,
      tier: 'criminal',
      feeCents: BASIC_ONLY_FEE_CENTS,
      partial: true,
      reason: 'The driving history is accepted. Only the criminal record check is still needed.',
    };
  }
  if (missing.length) {
    return {
      accept: false,
      tier: 'full',
      feeCents: SCREENING_FEE_CENTS,
      reason: 'That screening does not include everything Florida requires.',
    };
  }
  return { accept: true, tier: 'none', feeCents: 0, reason: 'Accepted in full. Nothing to pay.' };
}

/** Whether an operator's screening is current. Read at dispatch, not only at onboarding. */
function screeningCurrent(screening, now = Date.now()) {
  if (!screening || screening.decision !== 'pass') return false;
  return Number(screening.recheckDue || 0) > now;
}

/** Is a screening provider configured? `/health` and /ops report it. */
const screeningReady = () => !!readKey('CHECKR_API_KEY');

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
  withProcessing,
  processingOn,
  PROCESSING_PCT,
  PROCESSING_FIXED_CENTS,
  evaluateExistingReport,
  MVR_ONLY_FEE_CENTS,
  BASIC_ONLY_FEE_CENTS,
  CRIMINAL_ELEMENTS,
  ACCEPT_EXISTING_MAX_AGE_MS,
  REQUIRED_ELEMENTS,
  recordDecision, recordAdverseState,
  screeningCurrent,
  screeningReady,
  sweepScreening,
  grossUpCents,
  screeningQuote,
  SCREENING_FEE_CENTS,
  RECHECK_MS,
  RECHECK_WARN_MS,
  DISQUALIFIERS,
};
