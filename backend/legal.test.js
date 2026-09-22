// The legal pages, and the one thing a translation must never do: bind somebody to words they
// did not read. English is the source and is controlling; a translation exists to be
// understood, and says so at the top rather than the bottom.
const assert = require('node:assert');
const results = [];
const check = (label, ok, detail) => results.push({ label, ok: !!ok, detail });

const { TERMS_HTML, PRIVACY_HTML, ABOUT_HTML, legalPage, LEGAL_LANGUAGES } = require('./legal');
const LANGS = {
  es: { ...require('./legal-es'), terms: 'TERMS_ES', privacy: 'PRIVACY_ES' },
  fr: { ...require('./legal-fr'), terms: 'TERMS_FR', privacy: 'PRIVACY_FR' },
  it: { ...require('./legal-it'), terms: 'TERMS_IT', privacy: 'PRIVACY_IT' },
  de: { ...require('./legal-de'), terms: 'TERMS_DE', privacy: 'PRIVACY_DE' },
};
const docsOf = (l) => [LANGS[l][LANGS[l].terms], LANGS[l][LANGS[l].privacy]];

check('English is first and always available', LEGAL_LANGUAGES[0] === 'en');
check('all four translations are offered',
  ['es', 'fr', 'it', 'de'].every((l) => LEGAL_LANGUAGES.includes(l)), LEGAL_LANGUAGES.join(','));

// A language we do not have must return the ENGLISH DOCUMENT WHOLE. Never a mixture: a reader
// cannot tell which half of a mixed document binds them, and afterwards neither could we.
check('an unknown language returns the English terms entire', legalPage('terms', 'pt') === TERMS_HTML);
check('an unknown language returns the English privacy entire', legalPage('privacy', 'pt') === PRIVACY_HTML);
check('no language given returns English', legalPage('terms', undefined) === TERMS_HTML);
check('regional codes resolve — es-MX, fr-CA, de-AT',
  legalPage('terms', 'es-MX') === legalPage('terms', 'es') &&
  legalPage('terms', 'fr-CA') === legalPage('terms', 'fr') &&
  legalPage('terms', 'de-AT') === legalPage('terms', 'de'));
check('every translation actually differs from the English',
  ['es', 'fr', 'it', 'de'].every((l) => legalPage('terms', l) !== TERMS_HTML &&
    legalPage('privacy', l) !== PRIVACY_HTML));

// THE GOVERNING-LANGUAGE NOTICE IS THE LOAD-BEARING SENTENCE. Without it a translation is a
// second set of terms rather than a reading aid — and it must be read BEFORE the substance,
// which is why its position is tested and not only its presence.
for (const l of Object.keys(LANGS)) {
  const g = LANGS[l].GOVERNING;
  const [terms, privacy] = docsOf(l);
  check(`${l}: both documents state that the English governs`,
    terms.includes(g) && privacy.includes(g));
  check(`${l}: the notice names English specifically`,
    /inglés|anglaise|inglese|englische/i.test(g), g.slice(0, 40));
  check(`${l}: the notice precedes every substantive section`,
    terms.indexOf(g) < terms.indexOf('<section>') &&
    privacy.indexOf(g) < privacy.indexOf('<section>'));
}

// The commercial promises must survive translation EXACTLY. These are the numbers somebody
// decides on; a translation that rounds or softens one is a different offer, not a translation.
for (const l of Object.keys(LANGS)) {
  const [terms, privacy] = docsOf(l);
  check(`${l}: the 99/1 split survives`, /99 ?%/.test(terms) && /\b1 ?%/.test(terms));
  // The fee is the greater of $1.50 and 5% of the travel fare (Chad, 9 Sept 2026). Both halves
  // must survive, and the wording it replaced — a fee that "rises on larger fares" — must not.
  check(`${l}: the $1.50-or-5% platform fee survives`, /1[.,]50 USD/.test(terms) && /\b5 ?%/.test(terms));
  check(`${l}: the superseded rising-fee wording is gone`,
    !/aumenta en trayectos|augmentent sur les courses|aumenta sulle corse|steigt bei höheren/.test(terms));
  check(`${l}: the $3.00 arrival fee survives`, /3[.,]00 USD/.test(terms));
  check(`${l}: Miami-Dade jurisdiction survives`, /Miami-Dade/.test(terms));
  check(`${l}: the beta status is disclosed`,
    /pruebas|test|prova|Testphase/i.test(terms));
  check(`${l}: "we do not sell your data" survives`,
    /no vendemos|ne vendons|non vendiamo|verkaufen .* nicht/i.test(privacy));
  check(`${l}: the processors are still named`,
    ['Firebase', 'Stripe', 'Render'].every((n) => privacy.includes(n)));
  check(`${l}: the 18+ rule survives`, /18/.test(privacy));
  // The rubric applies in every language.
  check(`${l}: no exclamation marks`, !terms.includes('!') && !privacy.includes('!'));
}

check('About page still served', typeof ABOUT_HTML === 'string' && ABOUT_HTML.length > 0);

// THE RULE IS NO LONGER QUOTED TO THE TRAVELER, AND THAT IS THE POINT (Chad, 20 Sept 2026):
// "we do not want to say $1.50 'OR' 5% of the fare — the language must always be that the
// operator retains 99% of the fare; the fees are separate, however the traveler does not see
// them itemized; the traveler always only sees one total travel cost."
//
// These assertions used to require the formula verbatim. They now require the opposite, and
// they are kept rather than deleted because the formula reappearing is exactly the regression
// worth catching: there are two schedules since 20 September, so a page that names one of them
// is not merely off-message, it is wrong for half the travelers who read it.
const flat = (html) => html.replace(/\s+/g, ' ');
for (const [name, html] of [['Terms', TERMS_HTML], ['About page', ABOUT_HTML]]) {
  check(`the ${name} does not quote a fee formula at the traveler`,
    !/\$1\.50 or 5%|whichever is greater|greater of \$1\.50/i.test(flat(html)));
  check(`the ${name} promises one all-in price`, /one all-in/i.test(flat(html)));
  check(`the ${name} says the platform fee is not added on top of the quote`,
    /never added on top|nothing is added on top/i.test(flat(html)));
}
check('the About page states the 99% in the same breath as what a traveler pays',
  /Operator retains 99% of the travel fare/.test(flat(ABOUT_HTML)));
check('the Terms still say the operator keeps 99%',
  /keeps 99% of the travel fare/.test(flat(TERMS_HTML)));
check('the English no longer describes a fee that rises on larger fares',
  !/rises on larger|rising on larger/.test(TERMS_HTML) && !/rises on larger|rising on larger/.test(ABOUT_HTML));

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.ok ? '' : '  <-- ' + (r.detail || '')}`);
console.log(failed.length ? `\n${failed.length} FAILED of ${results.length}` : `\nall ${results.length} passed`);
assert.equal(failed.length, 0);
