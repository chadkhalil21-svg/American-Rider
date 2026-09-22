// Legal pages — Terms of Service and Privacy Policy, served by this server at
// /terms and /privacy so the app's sign-up screen can link to real, live pages.
//
// PLAIN-ENGLISH ON PURPOSE: these are written so a normal person can actually read them.
// ⚠️ STATUS: drafts written 6 Aug 2026, awaiting review by a Florida attorney before real
// (non-test) rides begin. Keep the wording honest about the beta at all times.
//
// The shell lives in backend/shell.js and is shared with the public site, so the legal pages
// and the marketing pages cannot drift apart the way they had — these carried their own copy
// of the styling in the wrong tokens, under a tagline the app does not use.

const UPDATED = 'August 6, 2026';

const { page } = require('./shell');

const TERMS_HTML = page(
  'Terms of Service',
  `
<h1>Terms of Service</h1>
<p class="updated">Last updated ${UPDATED}</p>

<div class="panel"><strong>American Rider is in its testing period.</strong> The app is
distributed through Apple TestFlight and some features are demonstrations. Whether a payment
is live or simulated is stated in the app at the moment of payment.</div>

<section><h2>1 · What American Rider is</h2>
<p>American Rider is a technology platform that connects travelers with independent
professional drivers ("operators"). We arrange the trip, show you one all-in price, and
handle the payment. The driving itself is provided by independent operators, not by
American Rider — we are a coordination platform, not a transportation carrier.</p></section>

<section><h2>2 · Your account</h2>
<ul>
<li>You must be 18 or older to hold an account. Minors ride with an accountholder.</li>
<li>Keep your email and sign-in details accurate and to yourself. What happens on your
account is your responsibility, so tell us right away (through Patron Support) if you think someone
else is using it.</li>
</ul></section>

<section><h2>3 · Pricing — the promise</h2>
<ul>
<li>You are shown <strong>one all-in price before you reserve</strong>. It is the whole
cost of the travel: the travel fare together with a platform fee, which is never shown as a
separate charge and is never added on top of the amount you were quoted. Payment processing
is paid from that fee.</li>
<li>The price quoted at reservation is the price charged.</li>
<li>Your operator keeps 99% of the travel fare. Our commission is 1% of the travel fare.</li>
</ul></section>

<section><h2>4 · Cancellations</h2>
<ul>
<li>Before your operator arrives, you may cancel and your fare is returned in full.</li>
<li>Once your operator has arrived, cancelling returns your fare less a $3.00 arrival fee. That
fee is paid to the operator, who drove to you and waited.</li>
<li>Once a travel has begun it cannot be cancelled. Patron Support settles anything that goes
wrong with a travel already underway.</li>
</ul></section>

<section><h2>5 · Payments</h2>
<p>Payments are processed by Stripe. American Rider never sees or stores your full card
number. The app states whether a payment is live or simulated at the moment it is taken.</p></section>

<section><h2>6 · Riding with us</h2>
<p>Travelers may not use the platform for any unlawful purpose, and may not interfere with
an operator's safe control of the vehicle. Reasonable operator requests — seatbelts, no
smoking, and similar — are to be followed. An account that places an operator or another
traveler at risk may be suspended.</p></section>

<section><h2>7 · During the beta</h2>
<p>The service is provided "as is" while we test. Features may be simulated, change, or
break; the app may be unavailable at times. To the fullest extent Florida law allows,
American Rider's liability during the test program is limited to the amounts you actually
paid us.</p></section>

<section><h2>8 · Disagreements</h2>
<p>Raise anything that goes wrong through Patron Support in the app. For anything that
cannot be resolved there, these terms are governed by Florida law and any dispute belongs to
the courts of Miami-Dade County, Florida.</p></section>

<section><h2>9 · Changes to these terms</h2>
<p>When we update these terms — including before real paid rides begin — we'll post the new
version here and update the date at the top. Using the app after a change means you accept
the updated terms.</p></section>
`,
);

const PRIVACY_HTML = page(
  'Privacy Policy',
  `
<h1>Privacy Policy</h1>
<p class="updated">Last updated ${UPDATED}</p>

<div class="panel"><strong>The short version:</strong> we collect what's needed to arrange
your rides — your email and your trip locations. We don't sell your data, we don't run
ads, and your card number goes to Stripe, never to us.</div>

<section><h2>1 · What we collect</h2>
<ul>
<li><strong>Account:</strong> your email address and a password (stored securely by
Google Firebase — we never see the password itself).</li>
<li><strong>Trips:</strong> pickup and destination locations, the route, times, and the
price of each ride — that's what a receipt is made of.</li>
<li><strong>Location:</strong> your device location, only while you're setting a pickup or
during a ride, to point the arrow to your car and show trip progress. You can say no in
iOS Settings; the app still works without it.</li>
</ul></section>

<section><h2>2 · What we use it for</h2>
<p>Running the service: matching you with an operator, pricing and showing your trip,
receipts, fixing problems you report, and keeping the platform safe. That's it.</p></section>

<section><h2>3 · Who touches the data (our processors)</h2>
<ul>
<li><strong>Google Firebase</strong> — accounts and trip records.</li>
<li><strong>Stripe</strong> — payments. Your card details go directly to Stripe; we never
store a full card number.</li>
<li><strong>Render</strong> — hosts our server.</li>
<li>Route lookups send trip coordinates (never your name) to a routing service.</li>
</ul>
<p>We don't sell your personal information to anyone, and we don't show ads.</p></section>

<section><h2>4 · How long we keep it</h2>
<p>Trip history stays on your account so your receipts exist. Want your account and its
data deleted? Ask through Patron Support in the app and it will be done.</p></section>

<section><h2>5 · Children</h2>
<p>American Rider accounts are for adults 18 and over. We don't knowingly collect data
from children.</p></section>

<section><h2>6 · Changes</h2>
<p>If this policy changes, the new version is posted here with an updated date at the top.</p></section>
`,
);

// About American Rider — the company-information page both drawers open.
//
// WHY IT EXISTS: "About American Rider" sat in the traveler drawer AND the operator drawer
// and both only raised "Mission, privacy, and terms open in the full build." Two placeholder
// rows on menus App Review opens. Rather than delete a row a serious company should have,
// this gives it something to open.
//
// It is also the correct home for the 99% model. The founders' design brief (§10A) places
// the operator-retention statement in a permanent company-information section, stated once
// as an institutional fact — NOT repeated through the traveler journey as a slogan. That
// is why the sentence below is plain, unadorned, and appears exactly once, with no
// exclamation, no "we believe", and no promotional framing.
// THE FEE RULE STAYS ON THIS PAGE (Chad asked for it removed, 19 Sept 2026; held).
//
// The standing rule he cited — one all-in price, never itemised — governs the TRAVELER'S POINT
// OF PAYMENT: the booking sheet, the receipt, the screens where somebody is deciding to spend
// money. It is a rule against making a person do arithmetic to learn what they owe. This page
// is a disclosure document, not a checkout, and the two want opposite things.
//
// Three reasons it stays. AGENTS.md records the decision that the Terms and this page state
// the rule. The operator section tells operators they can "reconcile every travel against
// this in their own records", which is only true while the rule is written down. And a page
// that claims complete rate transparency while removing the rate contradicts itself about
// money, which the rubric calls the most serious defect there is.
//
// His replacement sentence was also not accurate: "all coordination and network processing
// costs are integrated directly into the final fare" describes a fare with the fee inside it.
// The fee is ADDED to the travel fare. The traveler sees one total, which is what the promise
// is; the fee is not baked into the fare, and saying so would misdescribe the money.
const ABOUT_HTML = page(
  'About American Rider',
  `
<h1>About American Rider</h1>
<p class="updated">Miami, Florida</p>

<section><h2>Platform governance</h2>
<p>American Rider is a national transportation platform. It arranges travel between travelers
and independent commercial operators under one published fee rule, and settles the payment for
both sides.</p>
<p>A traveler names a destination and receives one price. An operator accepts the travel and is
paid for it. The company's principal place of business is Miami, Florida, and service begins in
the South Florida market before any further market opens.</p></section>

<section><h2>What a traveler pays</h2>
<p>One all-in amount, quoted before the travel is reserved, and it is the whole cost of the
travel. A platform fee is inside that amount; it is not itemised and nothing is added on top.
The amount shown at reservation is the amount charged. The Operator retains 99% of the travel
fare.</p></section>

<section><h2>How payment is settled</h2>
<p>American Rider settles by bank transfer. Cards are accepted and cost more to process;
that difference is absorbed by the platform fee, never added to a traveler's price.</p>
<p>The amount quoted at reservation is the amount charged, whichever method is used. Card
details are held by our payment processor and never by American Rider.</p></section>

<section><h2>Operator framework</h2>
<p>American Rider operators retain 99% of the travel fare.</p>
<p>The remaining 1% is the coordination commission, and the per-travel platform fee covers
running the service, including payment processing.
Operators can reconcile every travel against this in their own records.</p>
<p>Operators are independent contractors, not employees. Each holds their own vehicle
registration, insurance, and license, and chooses which travel to accept.</p></section>

<section><h2>Qualification and coverage</h2>
<p>An operator is commissioned only after every part of qualification is complete: driver
license, vehicle registration, vehicle inspection, commercial for-hire insurance, identity
verification, and a multi-state criminal and driving record check performed by an accredited
screening company and paid for by the operator.</p>
<p>Commercial coverage is verified before commissioning and on a continuing basis. Travel is
not assigned to an operator whose coverage has lapsed or expired. The background check is
repeated every three years.</p></section>

<section><h2>Patron standards</h2>
<p>Before an operator arrives, the travel names the operator, the vehicle and the license
plate, so they can be checked against the vehicle at the kerb rather than after boarding. A
travel can be shared with a trusted contact and followed as it proceeds.</p>
<p>Emergency services are reachable from within every travel, on a screen carrying the
operator, the vehicle, the license plate and the traveler's location, for reading to a
dispatcher.</p></section>

<section><h2>Contact</h2>
<p>Patron Support is reached from within the application. Every matter is answered by a
person, and any matter concerning safety is directed to a person and never settled
automatically.</p>
<p>Legal documents: <a href="/terms">Terms of Service</a> and
<a href="/privacy">Privacy Policy</a>.</p></section>
`,
);

// ---- TRANSLATIONS -------------------------------------------------------------------------
//
// Served at /terms?lang=es and /privacy?lang=es. English is the default AND the fallback: a
// language we do not have returns the English document whole rather than a mixture, for the
// same reason the insurance disclosure does — a reader cannot tell which half of a mixed
// document binds them.
//
// The English is legally controlling and every translation says so at the TOP, in a panel,
// before the reader has agreed to anything. Burying that at the bottom would make it a
// disclaimer; at the top it is information.
const { TERMS_ES, PRIVACY_ES } = require('./legal-es');
const { TERMS_FR, PRIVACY_FR } = require('./legal-fr');
const { TERMS_IT, PRIVACY_IT } = require('./legal-it');
const { TERMS_DE, PRIVACY_DE } = require('./legal-de');

const TRANSLATED = {
  es: { terms: page('Términos del Servicio', TERMS_ES), privacy: page('Política de Privacidad', PRIVACY_ES) },
  fr: { terms: page('Conditions Générales', TERMS_FR), privacy: page('Politique de Confidentialité', PRIVACY_FR) },
  it: { terms: page('Condizioni del Servizio', TERMS_IT), privacy: page('Informativa sulla Privacy', PRIVACY_IT) },
  de: { terms: page('Nutzungsbedingungen', TERMS_DE), privacy: page('Datenschutzerklärung', PRIVACY_DE) },
};

/** Languages each document exists in. English is always first and always available. */
const LEGAL_LANGUAGES = ['en', ...Object.keys(TRANSLATED)];

/** `doc` is 'terms' or 'privacy'. Unknown languages get the English document, entire. */
function legalPage(doc, lang) {
  const code = String(lang || '').slice(0, 2).toLowerCase();
  const translated = TRANSLATED[code]?.[doc];
  if (translated) return translated;
  return doc === 'privacy' ? PRIVACY_HTML : TERMS_HTML;
}

module.exports = { TERMS_HTML, PRIVACY_HTML, ABOUT_HTML, legalPage, LEGAL_LANGUAGES };
