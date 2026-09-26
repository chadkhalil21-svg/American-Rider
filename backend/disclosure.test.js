// The §627.748(8)(a) disclosure gate, case by case. This decides whether somebody may accept
// travel, so every way of not having acknowledged it gets a test.
const path = require('path');
const ROOT = __dirname;
const { DISCLOSURE, DISCLOSURE_VERSION, disclosureFor, disclosureCurrent, disclosureReason } =
  require(path.join(ROOT, 'disclosure.js'));

const R = [];
const check = (l, c, d) => R.push({ l, ok: !!c, d });
const now = Date.now();

// ---- the gate -----------------------------------------------------------------------------
check('never acknowledged -> refused', !disclosureCurrent(null));
check('undefined -> refused', !disclosureCurrent(undefined));
check('acknowledged the current version -> allowed',
  disclosureCurrent({ version: DISCLOSURE_VERSION, at: now }));
check('acknowledged an OLD version -> refused, and asked again',
  !disclosureCurrent({ version: '2020-01-01.1', at: now }));
check('a version with no timestamp -> refused',
  !disclosureCurrent({ version: DISCLOSURE_VERSION }));
check('a timestamp with no version -> refused', !disclosureCurrent({ at: now }));

// ---- the reasons an operator is shown -----------------------------------------------------
check('never read: told to read it', /read and acknowledge/i.test(disclosureReason(null)));
check('stale version: told it CHANGED, not that they never read it',
  /has changed/i.test(disclosureReason({ version: 'old', at: now })));

// ---- the content the statute names --------------------------------------------------------
// (8)(a)1 — the coverage the TNC provides, with types and limits.
check('states what American Rider provides', !!DISCLOSURE.provided?.body);
check('never falsely states that American Rider provides no insurance',
  !/does not provide automobile|provides no insurance|there is no coverage/i.test(DISCLOSURE.provided.body), DISCLOSURE.provided.body);
check('without a bound-policy disclosure, the text says production is not enabled',
  process.env.TNC_INSURANCE_DISCLOSURE || /production operations are not enabled/i.test(DISCLOSURE.provided.body), DISCLOSURE.provided.body);

// (8)(a)2 — that the driver's own policy might not cover them.
check('warns the operator\'s own policy might not cover them',
  /might not provide any coverage/i.test(DISCLOSURE.ownPolicy.body), DISCLOSURE.ownPolicy.body);
check('names both periods the statute names for that warning',
  /logged on/i.test(DISCLOSURE.ownPolicy.body) && /carrying a traveler/i.test(DISCLOSURE.ownPolicy.body),
  DISCLOSURE.ownPolicy.body);

check('cites the statute it satisfies', DISCLOSURE.statute === 'Fla. Stat. §627.748(8)(a)', DISCLOSURE.statute);
check('the acknowledgement refers to platform coverage and keeps the own-policy warning',
  /coverage American Rider provides/i.test(DISCLOSURE.acknowledgement) &&
  /might not cover me/i.test(DISCLOSURE.acknowledgement), DISCLOSURE.acknowledgement);

// ---- the rubric ---------------------------------------------------------------------------
const allText = [DISCLOSURE.provided.body, DISCLOSURE.ownPolicy.body, DISCLOSURE.ownPolicyVerified.body,
  DISCLOSURE.required.body, DISCLOSURE.acknowledgement].join(' ');
check('no reassurance, no apology, no exclamation',
  !/don't worry|no need to worry|unfortunately|we're sorry|!|rest assured/i.test(allText), allText.slice(0, 80));

// ---- the two versions (Chad, 28 Aug) ------------------------------------------------------
// He called the first version nonsensical: American Rider requires commercial cover and
// verifies it, so telling an operator their policy might not cover them reads as an insult.
// Right about the effect, wrong about the cause — the sentence is about a PERSONAL policy. So
// the framing follows what we have verified, and the statutory fact survives in both.
const notYet = disclosureFor(false);
const insured = disclosureFor(true);

check('an operator with no verified policy gets the warning',
  /might not cover you/i.test(notYet.ownPolicy.heading), notYet.ownPolicy.heading);
check('an operator WITH a verified policy is not told they may be uninsured',
  !/might not cover you/i.test(insured.ownPolicy.heading), insured.ownPolicy.heading);
check('  and is told what we hold for them instead',
  /policy you have provided/i.test(insured.ownPolicy.heading), insured.ownPolicy.heading);

// The statute is satisfied in BOTH — this is the test that stops the friendlier version
// quietly dropping the thing the law requires.
for (const [label, doc] of [['unverified', notYet], ['verified', insured]]) {
  check(`${label}: still carries §627.748(8)(a)2 — a personal policy might not cover them`,
    /personal/i.test(doc.ownPolicy.body) && /might not provide any coverage/i.test(doc.ownPolicy.body),
    doc.ownPolicy.body);
  check(`${label}: does not claim American Rider provides no insurance`,
    !/does not provide automobile|provides no insurance/i.test(doc.provided.body), doc.provided.body);
}
check('the verified version says coverage stops when the policy lapses',
  /lapse/i.test(insured.ownPolicy.body), insured.ownPolicy.body);
check('neither version leaks the unused variant to the operator',
  !('ownPolicyVerified' in notYet) && !('ownPolicyVerified' in insured));

// ---- THE DISCLOSURE IN OTHER LANGUAGES (4 Sept 2026) ---------------------------------------
//
// §627.748(8)(a) requires the disclosure to be MADE. A disclosure in a language the operator
// cannot read has not been made in any sense the statute would recognise — and Miami's
// operator pool is substantially Spanish-speaking. These tests exist because a translation
// that quietly drops a required sentence is worse than no translation at all: it looks
// compliant.
const { TRANSLATIONS, DISCLOSURE_LANGUAGES, translationFor } = require('./disclosure-i18n');

check('every language carries all four sections and the acknowledgement',
  Object.entries(TRANSLATIONS).every(([, t]) =>
    t.title && t.provided?.heading && t.provided?.body && t.ownPolicy?.heading &&
    t.ownPolicy?.body && t.ownPolicyVerified?.heading && t.ownPolicyVerified?.body &&
    t.required?.heading && t.required?.body && t.acknowledgement && t.governing),
  Object.keys(TRANSLATIONS).join(','));

check('English is offered alongside the translations, never replaced',
  DISCLOSURE_LANGUAGES[0] === 'en' && DISCLOSURE_LANGUAGES.length === Object.keys(TRANSLATIONS).length + 1);

// §627.748(8)(a)1 — translated policy terms are deployment data, not guessed source text.
check('a translation is unavailable until reviewed policy wording is configured',
  Object.keys(TRANSLATIONS).every((lang) => translationFor(lang) === null));

// §627.748(8)(a)2 — the personal-policy warning. This is the sentence a friendlier translation
// would be most tempted to lose, and the one the statute actually names.
check('every language keeps the personal-policy warning in BOTH variants',
  Object.entries(TRANSLATIONS).every(([, t]) =>
    /personal|personnelle|privat/i.test(t.ownPolicy.body) &&
    /PERSONAL|PERSONNELLE|PRIVATE/.test(t.ownPolicyVerified.body)));

check('every language states that the English governs',
  Object.entries(TRANSLATIONS).every(([, t]) =>
    /inglés|anglaise|inglese|englische/i.test(t.governing)));

check('the statute is cited unchanged in every language',
  Object.entries(TRANSLATIONS).every(([, t]) => t.required.body.includes('627.748(7)')));

check('an unknown language returns nothing rather than a half-translated document',
  translationFor('pt') === null && translationFor('') === null && translationFor(undefined) === null);

check('language codes remain unavailable without reviewed translated policy wording',
  translationFor('es-MX') === null && translationFor('ES') === null);

let bad = 0;
for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '\n      ' + r.d}`); }
console.log(`\n${R.length - bad}/${R.length} passed`);
process.exit(bad ? 1 : 0);
