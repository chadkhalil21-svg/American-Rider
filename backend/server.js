// American Rider — payment + backend server.
//
// WHY THIS EXISTS: the app on a phone can NEVER hold the Stripe secret key — anyone could pull
// it out of the app. So the secret key lives ONLY here, on a server you control, and the app
// asks this server to start a payment. This is the standard, safe way every real app does it.
//
// To run it:
//   1. Copy .env.example to .env and paste your Stripe TEST secret key
//   2. npm install
//   3. npm start
// Then it listens on http://localhost:4242

require('dotenv').config();

// Prefer IPv4 when resolving hostnames. Kept as belt-and-braces for cloud hosts whose IPv6
// egress doesn't work; harmless everywhere else. NOTE: this was NOT the cause of the
// August 2026 payment failures — that turned out to be a stray character in the pasted
// Stripe key (see backend/env.js). Left in place, but don't let it mislead you.
require('node:dns').setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const {
  quote, createPaymentIntent, chargeRide, refundTravel,
  connectAccountFor, connectOnboardingLink, connectAccountStatus,
  transferToOperator, refundableFor, connectDashboardLink, pingStripe, probeNetwork,
  chargeTip, transferFixed, createScreeningIntent, operatorPayoutAccount,
  listPaymentMethods, createSetupIntent, setDefaultPaymentMethod, detachPaymentMethod,
  defaultCardCountry,
} = require('./payments');
const { readKey } = require('./env');
const { requireAuth, attachAuth, requireVerifiedEmail } = require('./auth');
const { perAccount, countOnly } = require('./ratelimit');

// ——— WHAT A THROWAWAY ACCOUNT MAY DO, AND HOW OFTEN ————————————————————————————
// Booking was never the exposure: a travel needs a payment method, and a card is far harder to
// get in volume than an email address. Stripe has been closing the expensive half of this all
// along. What had no limit of any kind was everything reachable with nothing but a sign-in.
const LIMITS = {
  // A model runs on each of these and a person may read it. Generous for anybody real: a
  // traveler with a bad day files two or three, not twenty.
  support: perAccount({ name: 'support', limit: 8, windowMs: 60 * 60 * 1000 }),
  lostItem: perAccount({ name: 'lost-item', limit: 6, windowMs: 60 * 60 * 1000 }),
  // COUNTED, NEVER REFUSED. See ratelimit.js — an alarm that answers "too many times" to
  // somebody in trouble has failed at the one thing it must not fail at.
  emergency: countOnly({ name: 'emergency', limit: 6, windowMs: 60 * 60 * 1000 }),
  // Each of these bills us for an SMS and puts a message on somebody's handset. Tight on
  // purpose: a real traveler verifies once, twice if the first is slow.
  verify: perAccount({ name: 'verify', limit: 5, windowMs: 60 * 60 * 1000 }),
};
const { fareCentsFor, fareCentsForCoords, applyTravelClass } = require('./fares');
const { outsideMarket, outsideMarketMessage } = require('./market');
const { governmentFeesFor, permitRequired, permitRequiredMessage } = require('./fees');
const { destinationsNear } = require('./places');
const { ready: voiceReady, reason: voiceReason, accessToken: voiceToken, connectTwiml } = require('./voice');
const { REGIONS, defaultRegion } = require('./regions');
const { presenceStale, coverageLapsed, matchOperator, etaMinutes } = require('./matching');
// DISCLOSURE IS IMPORTED FOR .statute, and leaving it out is how the acknowledge route below
// threw `DISCLOSURE is not defined` for a day — every operator who read the disclosure was
// refused when they said so, and could not go on duty. The 25 disclosure tests all passed:
// they exercise disclosure.js directly and never call this route. Same shape as the tip path
// and the screening gate — written at both ends, unwired at the point that consumes it.
const {
  DISCLOSURE, DISCLOSURE_VERSION, disclosureFor, disclosureCurrent, disclosureReason,
} = require('./disclosure');
const { translationFor, DISCLOSURE_LANGUAGES } = require('./disclosure-i18n');
const { issueFollowToken, travelForToken, followPage } = require('./follow');

// WHERE A SHARED LINK POINTS. The custom domain, because a contact opening
// american-rider-server.onrender.com in a moment of worry has no way to tell it from a
// phishing page. PUBLIC_ORIGIN overrides it for local work.
const PUBLIC_ORIGIN = (readKey('PUBLIC_ORIGIN') || 'https://americanrider.app').replace(/\/$/, '');
const { fetchRoute } = require('./routes');
const { planTrip } = require('./assistant');
const { resolveIssue, supportMessage, replySender, MAX_OUT_OF_POCKET_CENTS } = require('./support');
const { resolveOperatorIssue } = require('./operatorsupport');
const { fileTicket, updateTicketLocation, listTickets } = require('./tickets');
const { lostItemTicket, stampLostItemCase } = require('./lostitem');
const { adminDb, adminStatus } = require('./firebase-admin');
const { TERMS_HTML, PRIVACY_HTML, ABOUT_HTML, legalPage, LEGAL_LANGUAGES } = require('./legal');
const {
  HOME_HTML, OPERATE_HTML, SUPPORT_HTML, TRAVEL_HTML, SAFETY_HTML, SMART_HTML,
} = require('./site');
const { smartQuote } = require('./smart');
const { transitHealth } = require('./transit');
const { sweepScheduled, sweepSettlements } = require('./scheduler');
const { sweepMonitor, sweepAssignments } = require('./monitor');
const { notify } = require('./push');
const { handleEvent, webhookReady } = require('./webhook');
const { send, receiptEmail, emailReady: mailReady } = require('./email');
const {
  ready: verifyReady, startVerification, checkVerification, toE164,
} = require('./verify');
const { mount: mountOps } = require('./ops');
const { readDocument, documentsReady } = require('./documents');
const { page } = require('./shell');
const {
  screeningReady, evaluateExistingReport, screeningCurrent,
  SCREENING_FEE_CENTS, MVR_ONLY_FEE_CENTS, BASIC_ONLY_FEE_CENTS, sweepScreening,
  grossUpCents, screeningQuote,
} = require('./screening');
const checkr = require('./checkr');

const app = express();
app.use(cors()); // let the app (a different origin) call this server

// --- Stripe's webhook. MOUNTED BEFORE express.json(), and that order is load-bearing. -------
//
// A signature is computed over the EXACT bytes Stripe sent. Once express.json() has parsed and
// re-serialised the body, those bytes are gone and every event fails verification — which is
// the classic way this endpoint ends up either broken or, worse, "fixed" by skipping the check.
app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = readKey('STRIPE_WEBHOOK_SECRET');
  if (!secret) return res.status(503).json({ error: 'STRIPE_WEBHOOK_SECRET is not set' });

  let event;
  try {
    event = stripeClient().webhooks.constructEvent(
      req.body,
      req.get('stripe-signature'),
      secret,
    );
  } catch (e) {
    // 400, deliberately: Stripe stops retrying a 400 and shows it in the dashboard, which is
    // how a wrong secret gets noticed instead of quietly retrying forever.
    return res.status(400).json({ error: `Signature verification failed: ${e.message}` });
  }

  // ACKNOWLEDGE FIRST, WORK AFTER. Stripe retries anything that does not answer in seconds,
  // and the work here writes to Firestore and files cases — slow enough to be retried into
  // duplicates. The result is logged rather than returned; nothing is waiting for it.
  res.json({ received: true, type: event.type });
  handleEvent(event)
    .then((out) => console.log(`[stripe] ${event.type}: ${out.action || out.reason}`))
    .catch((e) => console.log(`[stripe] ${event.type} failed: ${e.message}`));
});

// --- Checkr's webhook. Same raw-body rule as Stripe's above, for the same reason: the -------
// signature is an HMAC-SHA256 over the EXACT bytes Checkr sent, and express.json() destroys
// them. (The previous handler compared the signature header to the secret itself — Checkr
// never sends the secret, so every genuine result was a 403 and none ever landed.)
app.post('/checkr/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!readKey('CHECKR_WEBHOOK_SECRET')) {
    return res.status(503).json({ error: 'CHECKR_WEBHOOK_SECRET is not set' });
  }
  if (!checkr.verifySignature(req.body, req.get('x-checkr-signature'))) {
    // 403 and no retry-forever loop: a wrong secret should surface in Checkr's dashboard.
    return res.status(403).json({ error: 'Bad signature' });
  }
  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Not JSON' });
  }
  // ACKNOWLEDGE FIRST, WORK AFTER — same as Stripe. The work fetches the report's screenings
  // from Checkr's API and writes decisions, which is slow enough to be retried into
  // duplicates if the 200 waited for it.
  res.json({ received: true, type: event?.type || 'unknown' });
  checkr.handleEvent(event)
    .then((out) => console.log(`[checkr] ${event?.type}: ${out.action}${out.decision ? ` (${out.decision})` : ''}`))
    .catch((e) => console.log(`[checkr] ${event?.type} failed: ${e.message}`));
});

app.use(express.json()); // parse JSON request bodies — everything BELOW the webhook

// WHICH WORLD IS THIS SERVER IN? Read from the key's own prefix, and cover all four forms
// Stripe issues — a RESTRICTED key (rk_live_ / rk_test_) is the safer thing to deploy, since
// it can be scoped to just PaymentIntents, refunds, balance and Connect transfers. The first
// version of this line checked only `sk_live_`, so a restricted live key would have run real
// money while /health reported "test" and the app told travelers nothing was being charged.
const KEY = readKey('STRIPE_SECRET_KEY');
const keyMode = /^(sk|rk)_live_/.test(KEY) ? 'live' : /^(sk|rk)_test_/.test(KEY) ? 'test' : 'no-key';

// Stripe, for signature verification only. The payment logic has its own client in
// payments.js; this avoids importing that whole module's state to check one header.
let _sigClient = null;
function stripeClient() {
  if (!_sigClient) _sigClient = require('stripe')(KEY || 'sk_test_placeholder');
  return _sigClient;
}

const positiveCents = (v) => Number.isInteger(v) && v > 0;

// Prices a ride from whatever the app told us about WHERE it is going — never from a price the
// app sends. Two ways in, both server-priced:
//   1. { destination: 'Wynwood' }                     -> the fixed FARES table (the demo places)
//   2. { pickup: {lat,lng}, dest: {lat,lng} }         -> distance-based (any real address)
// Coordinates win when both are present, because they describe a real trip rather than a label.
// Returns { travelCostCents, miles|null, pricedBy, governmentFees } or null if we cannot price it.
// `governmentFees` (fees.js) are fenced from THE SAME COORDINATES the price comes from — a fee
// computed from any other point would be a second opinion about where the travel is.
function priceRide(body) {
  // Travel class (Standard/Premium/…) multiplies the fare — applied HERE, never by the app.
  const withClass = (cents) => applyTravelClass(cents, body?.travelClass);

  // OUT OF MARKET IS ITS OWN ANSWER, and it must not fall through to the named-destination
  // table. Without this, a pickup in San Francisco fails the coordinate path and then quietly
  // gets priced as a Miami travel off the name — which is a different wrong number, delivered
  // with more confidence.
  const away = outsideMarket(body?.pickup, body?.dest);
  if (away) return { outsideMarket: away, reason: outsideMarketMessage(away) };

  // A PLACE WE ARE NOT PERMITTED TO SERVE IS AN ANSWER, NOT A PRICE, and it is checked with
  // the market gate for the same reason: both are "we cannot do this travel", and a refusal
  // that falls through to a quote becomes a booking we cannot honour. See fees.js
  // permitRequired() — MIA and PortMiami are declined at BOTH ends until the permit exists.
  const blocked = permitRequired(body?.pickup, body?.dest);
  if (blocked) return { permitRequired: blocked, reason: permitRequiredMessage(blocked) };

  const byCoords = fareCentsForCoords(body?.pickup, body?.dest);
  if (byCoords) {
    return {
      travelCostCents: withClass(byCoords.travelCostCents),
      miles: byCoords.miles,
      // The journey time this fare was computed from, and whether it was measured or assumed.
      // Home's SUGGESTED TRAVEL printed a time baked into the destination list — a time from
      // Brickell, shown to whoever was reading. A number on a screen must be true for the
      // person reading it (P2, on the known list since 16 Sept).
      minutes: byCoords.minutes,
      timedBy: byCoords.timedBy,
      pricedBy: 'distance',
      governmentFees: governmentFeesFor(body?.pickup, body?.dest),
    };
  }
  // A name cannot be fenced; the named-place path carries no government fee.
  const byName = fareCentsFor(body?.destination);
  if (byName != null) return { travelCostCents: withClass(byName), miles: null, pricedBy: 'table', governmentFees: [] };
  return null;
}

// --- Health check: prove the server is up, without touching Stripe. -----------------------
//
// `support` IS THE IMPORTANT LINE and it is why this check grew. Every escalated case and
// every emergency alert goes through fileTicket, which needs a durable record (Firestore) or
// an alert (email) to have reached anybody. Both were unconfigured — firebase-admin was not
// even installed — so fileTicket returned ok:false on every case since it shipped, and the
// only sign of it was the app correctly telling travelers their case had not been filed.
// A total outage looked like a considered edge case. Now it is one field on a URL.
// Long enough for an ordinary read, far below any sane watchdog timeout.
const FLEET_READ_TIMEOUT_MS = 2000;

// LIVENESS, AND NOTHING ELSE. This is what the platform's health check must call.
//
// THE DEFECT IT CLOSES (31 Aug 2026). Render's health check was pointed at /health, which
// reads the operator collection from Firestore. When the Firestore read quota was exhausted
// that read stopped answering, the check timed out after five seconds, and Render declared
// the instance unhealthy and restarted it — taking down dispatch, payments and webhooks
// because a DIAGNOSTIC FIELD could not be computed. The process was fine the whole time.
//
// A health check that does I/O reports the health of the I/O, not of the service. Worse, the
// remedy it triggers — restart the instance — cannot fix a database quota, so the failure
// loops: fail, restart, fail. This endpoint answers one question, "is this process serving
// HTTP", and it answers it without reaching anything that can be slow.
//
// /health keeps everything else. It is for people, not for a watchdog.
app.get('/healthz', (req, res) => res.json({ ok: true, service: 'american-rider-server' }));

app.get('/health', async (req, res) => {
  const tickets = adminStatus();

  // WHO IS ACTUALLY ON DUTY. Counts only — no name, no position, nothing about a person.
  //
  // WHY IT IS HERE. On 29 Aug 2026 a traveler was dispatched to an operator who did not
  // exist, and answering "what is in the fleet?" took four separate attempts because the only
  // view of it was behind the ops password. `available` is what an operator's phone claims;
  // `dispatchable` is what dispatch will actually accept after presence, coverage and
  // screening. The gap between those two numbers is the interesting one: a fleet reporting
  // eight available and one dispatchable is a fleet of ghosts, and that should be legible
  // from a URL rather than from reading matching.js.
  let fleet = { operators: null, available: null, dispatchable: null, reason: tickets.reason };
  if (tickets.ok) {
    try {
      // TIME-BOUNDED, because this endpoint is read by people during an incident — the moment
      // the database is least likely to answer. A diagnostic that hangs when things are broken
      // is a diagnostic that is never available when it is needed.
      const snap = await Promise.race([
        adminDb().collection('operators').get(),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error('fleet read timed out')), FLEET_READ_TIMEOUT_MS).unref(),
        ),
      ]);
      const ops = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      fleet = {
        operators: ops.length,
        available: ops.filter((o) => o.available).length,
        dispatchable: ops.filter(
          (o) => o.available && !presenceStale(o) && !coverageLapsed(o) && !o.screeningBlocked,
        ).length,
        reason: null,
      };
    } catch (e) {
      fleet = { operators: null, available: null, dispatchable: null, reason: e.message };
    }
  }

  const emailReady = !!(readKey('SUPPORT_EMAIL') && readKey('RESEND_API_KEY'));
  // The transit planner behind Smart Travel. `ok: false` means every Smart Travel quote is
  // answering 503 — the card says the planner is down — and that should be legible here
  // before it is legible in a traveler's screenshot. Time-bounded like the fleet read.
  // ONE LINE PER REGION (Chad, 9 Sept 2026: "think nationally"). Each region names its own
  // planner; a planner that is down greys Smart Travel in that region alone, and this is where
  // that is legible. `transit` keeps the first region's answer for anything reading the old key.
  const regionHealth = await Promise.all(
    REGIONS.map(async (r) => {
      const h = await transitHealth({ region: r });
      return {
        id: r.id,
        name: r.name,
        counties: r.counties,
        otp: { configured: !!r.otpUrl, ok: h.ok, version: h.version || null, reason: h.reason || null },
        // Which street router the live map is drawn from: the region's OSRM, else its OTP
        // (only while that OTP answers), else the straight line.
        streets: r.osrmUrl ? 'osrm' : h.ok ? 'otp' : 'none',
      };
    }),
  );
  const firstRegion = regionHealth[0];
  res.json({
    ok: true,
    service: 'american-rider-server',
    // Which commit is answering. Render sets RENDER_GIT_COMMIT on every deploy; without it the
    // live backend's revision was ASSUMED in three handoffs running (16 Sept 2026), and a deploy
    // that changed no health field could not be told from the one before it.
    commit: (process.env.RENDER_GIT_COMMIT || '').slice(0, 7) || null,
    stripe: keyMode,
    transit: {
      configured: !!defaultRegion().otpUrl,
      ok: firstRegion.otp.ok,
      version: firstRegion.otp.version,
      reason: firstRegion.otp.reason,
    },
    regions: regionHealth,
    assistant: 'withdrawn', // founders, 4 Sept 2026; the route answers 410
    // The clock behind scheduled travel. `firestore: off` means reservations are being taken
    // and NOTHING will dispatch them — which is exactly the state this shipped in for weeks,
    // invisibly, so it is now a field on a URL.
    // Stripe can reach us, and we can reach a traveler's inbox. Both were absent and both
    // were invisible; a field on a URL is how that stops happening.
    webhook: webhookReady() ? 'on' : 'off',
    receipts: mailReady() ? 'on' : 'off',
    // NO PROVIDER MEANS NOBODY CAN BE COMMISSIONED. Every operator sits at
    // `awaiting_provider`, which is deliberately not a pass and not dispatchable — so an
    // empty fleet on launch day would otherwise look like nobody had applied.
    screening: screeningReady() ? 'on' : 'off',
    // Reading an operator's licence, registration, inspection and insurance. `off` means every
    // document falls to 'review' — never to 'accept'.
    documents: documentsReady() ? 'on' : 'off',
    insuranceDisclosure: DISCLOSURE_VERSION,
    // Phone verification. `off` means sign-up cannot check a number, and the app is told so
    // rather than showing a step that answers 503.
    phoneVerification: verifyReady() ? 'on' : 'off',
    // Calling between a traveler and their operator over WiFi or data. Reported for the same
    // reason as everything else here: a call button that silently does nothing is worse than
    // no call button, and the only way to know is to ask the server.
    platformCalling: voiceReady() ? 'on' : 'off',
    // WHICH LANGUAGES THE BINDING DOCUMENTS EXIST IN, on a URL, for the same reason the fleet
    // counts are. "Is the disclosure available in Spanish?" is a compliance question with a
    // yes/no answer, and reading it off /health beats reading it off a source file.
    languages: {
      disclosure: DISCLOSURE_LANGUAGES,
      legal: LEGAL_LANGUAGES,
    },
    fleet,
    scheduledTravel: {
      sweeping: tickets.ok,
      reason: tickets.ok ? null : tickets.reason,
      lastSweepAt: lastSweep.at || null,
      lastSweep: lastSweep.report,
    },
    support: {
      // false here means Patron Support and the emergency screen cannot reach a human AT ALL.
      canReachAHuman: tickets.ok || emailReady,
      firestore: tickets.ok ? 'on' : 'off',
      firestoreReason: tickets.reason,
      email: emailReady ? 'on' : 'off',
    },
  });
});

// --- What the app needs to know to take a payment. ----------------------------------------
//
// The publishable key is NOT secret — it is designed to ship inside the app. It is served
// from here rather than baked into the build so it can NEVER disagree with the secret key's
// mode: a test publishable key against a live secret key fails at the worst possible moment,
// with a card already typed in. One server, one pair, always matched.
//
// `mode` is what the app's payment copy reads, so no screen can claim payments are simulated
// while real money is moving, or the reverse.
app.get('/config', (req, res) => {
  res.json({
    stripePublishableKey: readKey('STRIPE_PUBLISHABLE_KEY') || null,
    mode: keyMode,
    // false means the app must not offer to charge anybody.
    canTakePayment: keyMode !== 'no-key' && !!readKey('STRIPE_PUBLISHABLE_KEY'),
  });
});

// --- Legal pages: linked from the app's sign-up screen ("By continuing, you agree…"). ------
// Served here so they are real, live web pages with no separate hosting to manage.
// --- The public website. -------------------------------------------------------------------
//
// THE DEFECT THIS CLOSES, and it is the same one as chargeTip. backend/site.js was written,
// reviewed and committed with six finished pages on it — and nothing ever required the file.
// Only /terms and /privacy were served, so americanrider.app answered a bare Express 404 while
// a nine-page site sat in the repo. Written is not shipped.
//
// Every href in shell.js and site.js has a route here. A public page that links to a 404 fails
// the rubric before anybody reads a word of it.
app.get('/', (req, res) => res.type('html').send(HOME_HTML));
app.get('/travel', (req, res) => res.type('html').send(TRAVEL_HTML));
app.get('/operate', (req, res) => res.type('html').send(OPERATE_HTML));
app.get('/safety', (req, res) => res.type('html').send(SAFETY_HTML));
app.get('/support', (req, res) => res.type('html').send(SUPPORT_HTML));
app.get('/smart-travel', (req, res) => res.type('html').send(SMART_HTML));
// ABOUT was written, exported from legal.js, and never mounted — like the rest of the site.
// Three screens in the app link to it (`${LEGAL_URL}/about`), so it has been a dead link
// everywhere it appears.
app.get('/about', (req, res) => res.type('html').send(ABOUT_HTML));
// ?lang=es serves the Spanish document. Apple opens these links by hand during review and a
// traveler opens them from sign-up; both get English unless they ask otherwise, and asking for
// a language we do not have returns English rather than a half-translated page.
// FOLLOWING A TRAVEL. Public by construction — a worried contact should not need an account
// at the moment they are worried. The token is the authorisation; see backend/follow.js for
// why that is the right trade and what keeps it safe.
app.get('/follow/:token', async (req, res) => {
  const r = await travelForToken(req.params.token);
  res.type('html').send(followPage(r));
});

// The traveler asks for a link to share. Theirs only, and only while a travel is underway.
app.post('/travel/follow-link', requireAuth, async (req, res) => {
  try {
    const token = await issueFollowToken({
      rideId: String(req.body?.rideId || ''),
      travelerUid: req.uid,
    });
    if (!token) return res.status(409).json({ error: 'That travel cannot be shared right now' });
    res.json({ ok: true, url: `${PUBLIC_ORIGIN}/follow/${token}` });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/terms', (req, res) => res.type('html').send(legalPage('terms', req.query?.lang)));
app.get('/privacy', (req, res) => res.type('html').send(legalPage('privacy', req.query?.lang)));

// --- Deep health check: proves this server can actually TALK to Stripe. --------------------
// /health only reports whether a key is present. This one makes a real call, so it tells the
// difference between "no key", "bad key", and "this host cannot reach Stripe".
app.get('/health/stripe', async (req, res) => {
  if (keyMode === 'no-key') return res.json({ ok: false, reason: 'no-key' });
  const [stripe, network] = await Promise.all([pingStripe(), probeNetwork()]);
  res.json({ ...stripe, network });
});

// --- Patron Support: resolve an issue, or put it in front of a person. --------------------
// body: { description, trip }
//
// Replaces the old client-side `escalate`, which flipped a variable and told the traveler a
// specialist was responding while notifying nobody. Every case now ends in one of three real
// outcomes: an answer, a credit inside a server-enforced cap, or a filed ticket a human sees.
// A ticket is ALWAYS filed on escalation — if filing fails we say so rather than claim help
// is coming.
app.post('/support', requireAuth, requireVerifiedEmail, LIMITS.support, async (req, res) => {
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  if (!description) return res.status(400).json({ error: 'description is required' });
  const trip = req.body?.trip && typeof req.body.trip === 'object' ? req.body.trip : {};
  // The traveler's language, so every word they read from here is in it; and the matter they
  // filed under, which the server now enforces for Safety (backend/support.js).
  const language = typeof req.body?.language === 'string' ? req.body.language : 'en';
  const category = typeof req.body?.category === 'string' ? req.body.category.slice(0, 40) : null;

  let decision;
  try {
    decision = await resolveIssue({ description, trip, language, category });
  } catch (e) {
    decision = { action: 'escalate', message: supportMessage('forced', language), reason: `resolver failed: ${e.message}`, forced: true };
  }

  // A CREDIT IS NOT A DECISION, IT IS A REFUND. The model saying "credit" used to be the
  // whole of it — the traveler read an amount and the words "credited to your payment
  // method" while no money moved. Issue it against the real PaymentIntent; if that cannot
  // be done, this is a person's job and the case falls through to the escalation below.
  if (decision.action === 'credit') {
    const refund = await refundTravel({
      paymentIntentId: trip?.paymentIntentId,
      amountCents: decision.credit_cents,
      // The request body cannot be trusted to say whose payment this is. refundTravel
      // checks the id against Stripe's own record of who paid before a cent moves.
      expectUid: req.uid,
    });
    // THE EXPOSURE CAP, WHICH IS NOT THE SAME AS THE CREDIT CAP. The credit cap measures what
    // a traveler might reasonably be owed; this measures what the company actually pays for
    // it, and the two diverge because the operator's 99% has already left. refundTravel()
    // returns the true cost; a case that costs more than we can absorb automatically reaches a
    // person, who may still refund it with their eyes open.
    if (refund.ok && typeof refund.outOfPocketCents === 'number' && refund.outOfPocketCents > MAX_OUT_OF_POCKET_CENTS) {
      // Nothing is reversed: the money has gone back to the traveler and it should have. What
      // changes is that the case is recorded rather than closed silently at that cost.
      await fileTicket({
        uid: req.uid, email: req.email, description, trip,
        reason: `Automatic refund of ${decision.credit_cents}c cost ${refund.outOfPocketCents}c out of pocket, above the ${MAX_OUT_OF_POCKET_CENTS}c limit.`,
        category: 'Refund exposure',
      });
    }
    if (refund.ok) {
      return res.json({ ...decision, refunded: true, refundId: refund.refundId });
    }
    decision = {
      action: 'escalate',
      message: decision.message,
      reason: `Credit of ${decision.credit_cents}c approved but not issued: ${refund.error}`,
      forced: true,
    };
  }

  if (decision.action === 'escalate') {
    const filed = await fileTicket({
      uid: req.uid, email: req.email, description, trip, reason: decision.reason, category,
    });
    // Never promise a person is coming unless the ticket actually exists.
    return res.json({
      ...decision,
      caseNo: filed.caseNo,
      filed: filed.ok,
      message: supportMessage(filed.ok ? 'filed' : 'notFiled', language, { email: req.email, from: replySender() }),
    });
  }

  res.json(decision);
});

// GET /support/cases — the signed-in traveler's own filed cases, newest first: their record of
// what they have asked us. Nothing about how we are handling a case, because that is tracked
// nowhere a screen could state truthfully (every ticket is 'open' from the day it is filed).
// POST /operator/support — an operator's own problems, answered by the platform rather than by
// nobody. Until 20 Sept 2026 this did not exist in any form: Patron Support had resolved
// travelers' cases with an AI since 16 August, and an operator whose traveler never appeared,
// or whose fare looked wrong, had no path at all.
//
// THE REMEDY IS A PAYMENT, NOT A REFUND, which is why it is a separate resolver and a separate
// endpoint. Money goes OUT to the operator and it is ours; a completed fare is never taken back
// from a traveler to settle an operator's complaint. If that were the right remedy it is a
// person's decision, and the resolver is told so.
app.post('/operator/support', requireAuth, requireVerifiedEmail, LIMITS.support, async (req, res) => {
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  if (!description) return res.status(400).json({ error: 'description is required' });
  const travel = req.body?.travel && typeof req.body.travel === 'object' ? req.body.travel : {};
  const language = typeof req.body?.language === 'string' ? req.body.language : 'en';

  let decision;
  try {
    decision = await resolveOperatorIssue({ description, travel, language });
  } catch (e) {
    decision = { action: 'escalate', message: null, reason: `resolver failed: ${e.message}`, forced: true };
  }

  // A PAYMENT IS NOT A DECISION, IT IS A TRANSFER — the same lesson the traveler's side learned
  // when "credited to your payment method" was printed while no money moved. Pay it against the
  // operator's real Connect account; if that cannot be done, this is a person's job and it
  // falls through to the escalation below rather than being reported as settled.
  if (decision.action === 'pay') {
    let paid = { ok: false, error: 'no payout account' };
    try {
      const account = await operatorPayoutAccount(req.uid);
      if (account) paid = await transferFixed({ account, amountCents: decision.pay_cents, reason: 'operator_support' });
      else paid = { ok: false, error: 'This account is not cleared for payouts yet.' };
    } catch (e) {
      paid = { ok: false, error: e && e.message ? e.message : String(e) };
    }
    if (paid.ok) {
      return res.json({ ...decision, paid: true, transferId: paid.transferId || null });
    }
    decision = {
      action: 'escalate',
      message: decision.message,
      reason: `Payment of ${decision.pay_cents}c approved but not issued: ${paid.error}`,
      forced: true,
    };
  }

  if (decision.action === 'escalate') {
    const filed = await fileTicket({
      uid: req.uid, email: req.email, description, trip: travel, reason: decision.reason, category: 'Operator',
    });
    return res.json({
      ...decision,
      caseNo: filed.caseNo,
      filed: filed.ok,
      message: supportMessage(filed.ok ? 'filed' : 'notFiled', language, { email: req.email, from: replySender() }),
    });
  }

  res.json(decision);
});

app.get('/support/cases', requireAuth, async (req, res) => {
  try {
    const cases = await listTickets(req.uid);
    return res.json({ cases });
  } catch (e) {
    return res.status(502).json({ error: 'Your cases could not be read', detail: String(e && e.message || e) });
  }
});

// --- OPERATOR PAYOUTS: Stripe Connect onboarding. -----------------------------------------
//
// The operator's connected account id is stored on THEIR OWN account document in Firestore
// (`users/{uid}.stripeAccountId`), read here with admin credentials. That is deliberately the
// resolution of docs/OPEN-DECISIONS.md §4 for the payout case: an id that lives only in
// device storage would mean an operator who changes phones stops being payable, and a payout
// destination is not something that may depend on which handset somebody is holding.
//
// Nothing here trusts the app for an account id. The app says "onboard me"; the server
// decides which account that means, from the caller's verified uid.

async function operatorRecord(uid) {
  const db = adminDb();
  if (!db) return null;
  const snap = await db.collection('users').doc(String(uid)).get();
  return snap.exists ? snap.data() : {};
}

// POST /connect/onboard — start or resume Stripe-hosted onboarding for the signed-in operator.
app.post('/connect/onboard', requireAuth, async (req, res) => {
  if (keyMode === 'no-key') return res.status(500).json({ error: 'No Stripe key configured' });
  const db = adminDb();
  if (!db) {
    return res.status(503).json({
      error: 'Operator payouts need the server database. ' + adminStatus().reason,
      code: 'no_admin_db',
    });
  }
  try {
    const existing = (await operatorRecord(req.uid))?.stripeAccountId || null;
    const account = await connectAccountFor({
      uid: req.uid,
      email: req.email,
      existingAccountId: existing,
    });
    await db.collection('users').doc(String(req.uid)).set(
      { stripeAccountId: account.id, stripeAccountAt: Date.now() },
      { merge: true },
    );
    const base = readKey('PUBLIC_APP_URL') || `${req.protocol}://${req.get('host')}`;
    const link = await connectOnboardingLink({
      accountId: account.id,
      returnUrl: `${base}/connect/done`,
      refreshUrl: `${base}/connect/done`,
    });
    res.json({ url: link.url, accountId: account.id });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// GET /connect/status — can this operator actually be paid?
app.get('/connect/status', requireAuth, async (req, res) => {
  if (keyMode === 'no-key') return res.json({ exists: false, payoutsEnabled: false, due: [] });
  const db = adminDb();
  if (!db) return res.json({ exists: false, payoutsEnabled: false, due: [], reason: adminStatus().reason });
  try {
    const accountId = (await operatorRecord(req.uid))?.stripeAccountId || null;
    res.json(await connectAccountStatus(accountId));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// POST /connect/dashboard — a link into the operator's OWN Stripe account.
//
// American Rider never holds an operator's money. Their 99% is transferred to their connected
// account as each travel completes, and Stripe pays it out to their bank on its own schedule —
// including instant payouts, which they can take there and pay Stripe's fee for themselves.
//
// So the honest place to see and control payouts is Stripe's own dashboard, not a screen of
// ours pretending to move money we do not hold. Single-use and short-lived.
app.post('/connect/dashboard', requireAuth, async (req, res) => {
  if (keyMode === 'no-key') return res.status(500).json({ error: 'No Stripe key configured' });
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  try {
    const accountId = (await operatorRecord(req.uid))?.stripeAccountId || null;
    if (!accountId) {
      return res.status(409).json({ error: 'No payout account yet', code: 'not_onboarded' });
    }
    const link = await connectDashboardLink(accountId);
    res.json({ url: link.url });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Where Stripe returns the operator after onboarding. A plain page; the app polls /status.
app.get('/connect/done', (req, res) =>
  res
    .type('html')
    .send(
      '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<body style="margin:0;background:#F7F7F5;color:#14171F;font-family:-apple-system,' +
        'BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;display:flex;align-items:center;' +
        'justify-content:center;height:100vh;text-align:center"><div>' +
        '<div style="font-size:13px;font-weight:600;letter-spacing:4px">AMERICAN RIDER</div>' +
        '<div style="font-size:10.5px;font-weight:600;letter-spacing:2px;color:#8A8A82;' +
        'margin-top:7px">NATIONAL TRANSPORTATION</div>' +
        '<p style="margin-top:28px;font-size:16px">You can return to the app.</p>' +
        '<p style="font-size:13.5px;color:#8A8A82">Your payout details are checked by Stripe. ' +
        'American Rider never sees them.</p></div></body>',
    ),
);

// --- OPERATOR GOES ON DUTY: join the dispatchable fleet. ----------------------------------
//
// THE GAP THIS CLOSES. Nothing ever wrote the `operators` collection, so loadFleet() always
// fell through to three hardcoded demo drivers (op1 Miguel D., op2 Sofia R., op3 Nina P.).
// Being "Commissioned" was a flag in phone storage that no other device could see. So every
// travel in the product was assigned to somebody who does not exist and cannot be paid, and a
// real operator who finished Stripe onboarding still never received a single trip.
//
// An operator joins the fleet HERE, through the server, rather than by writing Firestore from
// the app — the collection stays read-only to clients, so no phone can invent a colleague or
// move one across town. Two conditions, both verified server-side:
//   1. Stripe says payouts_enabled — no fare is dispatched to somebody it cannot be paid out to
//   2. the document id IS their Firebase uid — which is what makes the payout lookup at
//      settlement a direct read instead of a guess
//
// This is docs/OPEN-DECISIONS.md §4 answered for the payout case: operator identity is the
// account, not the handset.
app.post('/operator/online', requireAuth, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  try {
    const rec = (await operatorRecord(req.uid)) || {};
    const status = await connectAccountStatus(rec.stripeAccountId || null);
    if (!status.payoutsEnabled) {
      return res.status(409).json({
        code: 'payouts_not_ready',
        error:
          'Stripe has not cleared this account for payouts yet, so travel cannot be assigned. ' +
          'A fare we cannot pay out is a fare we will not take.',
        due: status.due || [],
      });
    }
    const b = req.body || {};

    // COVERAGE, CHECKED HERE AS WELL AS ON THE PHONE. American Rider carries no automobile
    // policy, so an operator's own commercial coverage is the only coverage a travel has. A
    // date that has passed is a travel with nothing behind it, and a gate that exists only in
    // the app is a gate that runs on a device we do not control.
    // ---- THE SCREENING GATE. ---------------------------------------------------------
    //
    // THE DEFECT THIS CLOSES, and it is the worst one left. This route checked Stripe payouts,
    // an insurance expiry date and a position — and never once asked whether the operator had
    // passed a background screening. The whole apparatus behind that question existed:
    // Florida's standard encoded in screening.js, the Checkr pipeline, the adjudication, the
    // three-year clock, twenty-eight tests. None of it was consulted at the only moment it
    // decides anything. An operator who had never been screened could carry a passenger
    // provided they had a Stripe account and had typed a date into a box.
    //
    // Built at both ends and not wired at the gate — the same shape as the tip path, the
    // website, and the AI planner. It is why "the code exists" is no longer evidence here.
    //
    // WHY IT IS GATED ON LIVE MODE rather than always. dispatch.ts already draws this line:
    // demonstration stand-ins are acceptable while no real traveler is carried, and never once
    // money is real. Refusing every operator today would stop the founders testing their own
    // product before Checkr is credentialed. In test mode the travel is a demonstration; in
    // live mode a stranger gets into a car.
    //
    // The unscreened case is STAMPED either way, so /ops shows who is on duty without a
    // screening rather than letting it pass unrecorded.
    let screening = null;
    try {
      const snap = await db.collection('users').doc(String(req.uid)).get();
      screening = snap.exists ? snap.data().screening || null : null;
    } catch {
      // Unreadable is not the same as absent, and neither is a reason to let somebody drive
      // in live mode.
    }
    // §627.748(8)(a) — "Before a TNC driver is allowed to accept a request for a prearranged
    // ride... the TNC must disclose in writing". A disclosure nobody read is not a disclosure,
    // so it is a precondition of going on duty rather than a page in a menu. Unlike the
    // screening gate this applies in TEST MODE TOO: it costs nothing, blocks nobody who has
    // read one screen, and there is no version of "we told them" that is true tomorrow and
    // false today.
    let disclosure = null;
    try {
      const snap = await db.collection('users').doc(String(req.uid)).get();
      disclosure = snap.exists ? snap.data().insuranceDisclosure || null : null;
    } catch {
      /* unreadable is not acknowledged */
    }
    if (!disclosureCurrent(disclosure)) {
      return res.status(409).json({ code: 'disclosure_required', error: disclosureReason(disclosure) });
    }

    const screened = screeningCurrent(screening);
    if (!screened && keyMode === 'live') {
      const why = !screening
        ? 'A background screening is required before you can accept travel.'
        : screening.decision === 'pass'
          ? 'Your background screening is more than three years old and must be repeated.'
          : screening.summary || 'Your background screening is not complete.';
      return res.status(409).json({ code: 'not_screened', error: why });
    }

    const expiry = String(b.insuranceExpiry || '').trim();
    const expiryMs = expiry ? Date.parse(`${expiry}T23:59:59Z`) : NaN;
    if (!expiry || Number.isNaN(expiryMs)) {
      return res.status(409).json({
        code: 'no_coverage_on_file',
        error: 'Record the expiry date of your commercial policy before going available.',
      });
    }
    if (expiryMs < Date.now()) {
      return res.status(409).json({
        code: 'coverage_expired',
        error:
          'Your commercial coverage expired on ' + expiry + '. Travel cannot be assigned ' +
          'until it is renewed and the new date is on file.',
      });
    }

    const lat = Number(b.lat);
    const lng = Number(b.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'A position is required to be dispatchable' });
    }
    // ABSENT IS NOT EMPTY, and treating it as empty would have been a live defect the moment
    // background presence shipped (5 Sept 2026). A renewal from the locked-phone task carries a
    // position and nothing else — it runs outside React and has no access to the provider's
    // state — so `String(b.car || '')` would have blanked the operator's vehicle every sixty
    // seconds. The traveler's screen would then have named a car with no make and no plate,
    // on a record that had been correct until the operator put their phone in their pocket.
    //
    // These four are IDENTITY, not telemetry: they change when an operator edits their vehicle,
    // never on a heartbeat. So a renewal that omits them leaves what is stored alone, and only
    // an explicit value replaces it. Position and timestamps are the opposite — always fresh,
    // always written — which is the whole point of a renewal.
    const identity = {};
    if (b.name !== undefined || !rec.name) {
      identity.name = String(b.name || rec.displayName || 'Operator').slice(0, 60);
    }
    if (b.car !== undefined) identity.car = String(b.car).slice(0, 60);
    if (b.plate !== undefined) identity.plate = String(b.plate).slice(0, 16);
    if (Array.isArray(b.classes) && b.classes.length) identity.classes = b.classes.slice(0, 6);

    await db.collection('operators').doc(String(req.uid)).set(
      {
        uid: String(req.uid),
        ...identity,
        // Stored on the fleet record so dispatch can drop an operator whose policy runs out
        // during a shift, without waiting for them to go off duty and back on.
        insuranceExpiry: expiry,
        // AND THE DISCLOSURE THEY AGREED TO, for exactly the same reason. The gate above
        // refuses to let anyone on duty under an old version; this is what lets dispatch drop
        // an operator already on duty when the version moves mid-shift. Written from the
        // acknowledgement that was just checked, never from DISCLOSURE_VERSION directly —
        // stamping the current version here would record agreement that was never given.
        disclosureVersion: disclosure?.version || null,
        // Visible on /ops. In test mode an unscreened operator may go on duty; nobody should
        // have to read code to discover that one has.
        screened,
        screeningCheckedAt: Date.now(),
        lat,
        lng,
        available: b.available !== false,
        onlineAt: Date.now(),
      },
      { merge: true },
    );
    res.json({ ok: true, operatorId: String(req.uid), available: b.available !== false });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Off duty. Stays in the collection (so a finished travel can still name who drove it) but
// stops being matchable.
app.post('/operator/offline', requireAuth, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  try {
    await db.collection('operators').doc(String(req.uid)).set(
      { available: false, offlineAt: Date.now() },
      { merge: true },
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// POST /operator/settle-pending — pay out anything this operator is still owed.
//
// Settlement is attempted once, when a travel completes. Plenty of ordinary things make that
// attempt fail: the money is still clearing, the operator had not finished Stripe onboarding
// yet, the network dropped between the phone and here. Every one of those left the fare
// sitting in the platform balance with `payoutPending` on the travel and nothing that would
// ever try again — the operator simply did not get paid, and only somebody reading the
// database would find out.
//
// The operator asks for their own money, which is the right party to be driving this. Scoped
// to travels dispatched to the caller; it can pay nobody else and can be called as often as
// the app likes, because each transfer is still guarded by the travel's own transferId.
app.post('/operator/settle-pending', requireAuth, async (req, res) => {
  if (keyMode === 'no-key') return res.status(500).json({ error: 'No Stripe key configured' });
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });

  try {
    const uid = String(req.uid);
    const { accountId } = await operatorPayoutAccount(db, uid);
    if (!accountId) {
      return res.json({ ok: false, code: 'not_payable', settled: 0, reason: 'no payout account' });
    }

    const snap = await db.collection('rides').where('operatorId', '==', uid).get();
    const owed = [];
    snap.forEach((d) => {
      const x = d.data() || {};
      if (x.status === 'completed' && !x.transferId && x.paymentIntentId) {
        owed.push({ rideId: d.id, ...x });
      }
    });

    let settled = 0;
    let centsPaid = 0;
    const stillOwed = [];
    for (const ride of owed) {
      const out = await transferToOperator({
        paymentIntentId: ride.paymentIntentId,
        operatorStripeAccount: accountId,
        // The payment belongs to the TRAVELER; that is whose uid is stamped on the intent.
        expectedUid: String(ride.travelerUid),
        expectedTripNo: ride.tripNo || null,
        rideId: ride.rideId,
      });
      if (out.ok) {
        settled += 1;
        centsPaid += out.amountCents;
        await db.collection('rides').doc(ride.rideId).set(
          {
            transferId: out.transferId,
            operatorPaidCents: out.amountCents,
            payoutPending: false,
            payoutBlockedReason: null,
            settledAt: Date.now(),
            ...(out.paidWith ? { paidWith: out.paidWith } : {}),
          },
          { merge: true },
        );
      } else {
        stillOwed.push({ tripNo: ride.tripNo || null, reason: out.error || out.code });
        await db.collection('rides').doc(ride.rideId).set(
          {
            payoutPending: true,
            payoutBlockedReason: out.error || out.code,
            payoutCheckedAt: Date.now(),
            ...(out.paidWith ? { paidWith: out.paidWith } : {}),
          },
          { merge: true },
        );
      }
    }
    res.json({ ok: true, settled, centsPaid, stillOwed });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// --- A TIP: charged, and passed to the operator whole. -----------------------------------
//
// body: { rideId, tipCents }
//
// Travel Complete has always collected a tip and written it to the ride document, where
// nothing read it. The traveler was not charged and the operator was not paid, under a line
// reading "The operator keeps 100% of every tip". This is the mechanism that sentence needs.
//
// The amount is taken from the REQUEST rather than from a record, because a tip is the one
// figure the traveler alone decides — so it is bounded here instead of trusted. The ceiling is
// the greater of $100 or the fare itself: generous for any real gratuity, and low enough that
// a malformed or hostile request cannot empty a card.
const TIP_CEILING_CENTS = 10000;

app.post('/travel/tip', requireAuth, async (req, res) => {
  if (keyMode === 'no-key') return res.status(500).json({ error: 'No Stripe key configured' });
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });

  const rideId = String(req.body?.rideId || '');
  const tipCents = Math.floor(Number(req.body?.tipCents || 0));
  if (!rideId || !(tipCents > 0)) {
    return res.status(400).json({ error: 'rideId and a positive tipCents are required' });
  }

  try {
    const rideRef = db.collection('rides').doc(rideId);
    const snap = await rideRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'No such travel' });
    const ride = snap.data();
    if (String(ride.travelerUid) !== String(req.uid)) {
      return res.status(403).json({ error: 'That travel belongs to another traveler' });
    }
    if (ride.tipChargedCents) {
      return res.json({ ok: true, alreadyTipped: true, chargedCents: ride.tipChargedCents });
    }
    // A tip belongs to a travel that happened.
    if (String(ride.status) !== 'completed') {
      return res.status(409).json({ error: 'That travel is not complete', code: 'not_complete' });
    }
    const ceiling = Math.max(TIP_CEILING_CENTS, Number(ride.costCents || 0));
    if (tipCents > ceiling) {
      return res.status(400).json({ error: 'That tip exceeds the permitted amount', code: 'tip_too_large' });
    }

    const { accountId } = await operatorPayoutAccount(db, ride.operatorId);
    if (!accountId) {
      // Not charged. Taking a tip we cannot pass on would be American Rider keeping a
      // gratuity meant for somebody else.
      return res.status(409).json({
        ok: false,
        code: 'operator_not_payable',
        error: 'That operator cannot receive a tip yet, so nothing has been charged.',
      });
    }

    const out = await chargeTip({
      uid: req.uid,
      email: req.email,
      operatorStripeAccount: accountId,
      amountCents: tipCents,
      tripNo: ride.tripNo || null,
    });
    if (!out.ok) return res.status(402).json(out);

    await rideRef.set(
      {
        tipChargedCents: out.chargedCents,
        tipPaymentIntentId: out.paymentIntentId,
        tipTransferId: out.transferId,
        tipPending: !out.forwarded,
        tipBlockedReason: out.forwardError,
        tippedAt: Date.now(),
      },
      { merge: true },
    );
    res.json(out);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// --- CANCELLING: give the money back. ------------------------------------------------------
//
// THE DEFECT THIS CLOSES, and it is the worst one in the product. The traveler is charged at
// confirmation, before an operator has moved. Cancelling cleared the screen, wrote
// status:'cancelled', and stopped — no refund, anywhere, ever. So booking, paying $19.29 and
// cancelling left American Rider holding the full fare for a journey that never happened,
// with nothing on any screen saying so. The ride screen meanwhile said "Free to cancel", which
// was not true of the money, and offered a "$3 fee ... it goes to them, not us" that was never
// charged and never paid — a promise made to the operator in the Terms and kept for nobody.
//
// A cancelled travel is refunded IN FULL. Stripe keeps its processing fee on a refund, so
// this costs American Rider real money on every cancellation; that cost is correct. Taking a
// fare for a journey nobody took is not a revenue model, and the company's whole claim is
// that the money is honest.
//
// NO CANCELLATION FEE IS CHARGED. The $3 was meant to pay an operator who had already driven
// to the pickup, which is right in principle — but nothing tells this server that an operator
// arrived. The operator app does not report it. A fee we cannot substantiate is a fee we must
// not take, so the claim is removed from the app and the Terms until arrival is a fact the
// server holds. See docs/OPEN-DECISIONS.md.
app.post('/travel/cancel', requireAuth, async (req, res) => {
  if (keyMode === 'no-key') return res.status(500).json({ error: 'No Stripe key configured' });
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });

  const rideId = String(req.body?.rideId || '');
  const paymentIntentId = String(req.body?.paymentIntentId || '');
  if (!rideId) return res.status(400).json({ error: 'rideId is required' });

  try {
    const rideRef = db.collection('rides').doc(rideId);
    const snap = await rideRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'No such travel' });
    const ride = snap.data();
    if (String(ride.travelerUid) !== String(req.uid)) {
      return res.status(403).json({ error: 'That travel belongs to another traveler' });
    }
    // Already refunded — say so rather than refunding twice.
    if (ride.refundId) {
      return res.json({ ok: true, alreadyRefunded: true, refundId: ride.refundId, amountCents: ride.refundedCents || 0 });
    }
    // Settled travels are finished journeys; cancelling one is a support matter, not this route.
    if (ride.transferId) {
      return res.status(409).json({ error: 'That travel has already been completed and paid out', code: 'already_settled' });
    }

    // ── THE LOOPHOLE THIS CLOSES ──────────────────────────────────────────────────────────
    // Cancellation refunded the fare IN FULL at any point before completion. A traveler could
    // therefore be carried the whole way and cancel a moment before the operator marked the
    // travel complete: full refund, and the operator drove them for nothing. "Cancel any time
    // before it is completed, refunded in full" is a free journey with extra steps.
    //
    // The operator now reports where the travel actually is — accepted, arrived, onboard — so
    // this can be answered on facts rather than on trust:
    //
    //   before arrival   the operator has driven toward the traveler but nothing has begun
    //                    → refunded in full
    //   after arrival    the operator is at the kerb and has spent the journey there
    //                    → refunded less a $3 arrival fee, which is paid to the operator
    //   once onboard     the travel is happening; cancelling is not the right control
    //                    → refused, and directed to Patron Support
    //
    // The $3 was removed on 18 August because nothing could substantiate that an operator had
    // arrived. The operator app reports it now, so the fee is real, earned, and paid to the
    // person who earned it.
    const stage = String(ride.status || '');
    if (stage === 'onboard' || stage === 'completed') {
      return res.status(409).json({
        code: 'travel_underway',
        error:
          'This travel is already underway and cannot be cancelled. Patron Support can settle ' +
          'anything that went wrong with it.',
      });
    }
    const ARRIVAL_FEE_CENTS = 300;
    const arrivalFee = stage === 'arrived' ? ARRIVAL_FEE_CENTS : 0;

    await rideRef.set({ status: 'cancelled', statusAt: Date.now() }, { merge: true });

    // Nothing was charged (the traveler closed the sheet, or cancelled before paying).
    if (!paymentIntentId) {
      return res.json({ ok: true, refunded: false, reason: 'no payment was taken' });
    }

    const { cents: refundable, reason } = await refundableFor({
      paymentIntentId,
      expectUid: String(req.uid),
    });
    if (refundable <= 0) return res.json({ ok: true, refunded: false, reason });

    // The arrival fee is withheld from the refund, never charged separately — the traveler has
    // already paid, so taking it a second time would be a second charge for one cancellation.
    const withheld = Math.min(arrivalFee, refundable);
    const out = await refundTravel({
      paymentIntentId,
      amountCents: refundable - withheld,
      expectUid: String(req.uid),
    });
    if (!out.ok) {
      await rideRef.set({ refundPending: true, refundBlockedReason: out.error }, { merge: true });
      return res.status(502).json({ ok: false, error: out.error });
    }
    await rideRef.set(
      {
        refundId: out.refundId,
        refundedCents: out.amountCents,
        arrivalFeeCents: withheld,
        refundPending: false,
        refundedAt: Date.now(),
      },
      { merge: true },
    );

    // Pay the arrival fee to the operator who was standing there. Best effort and never
    // blocking: the traveler's refund has already gone through, and a fee we cannot forward
    // yet is recorded as owed rather than quietly kept.
    if (withheld > 0) {
      const { accountId } = await operatorPayoutAccount(db, ride.operatorId);
      if (accountId) {
        const paid = await transferFixed({
          paymentIntentId,
          operatorStripeAccount: accountId,
          amountCents: withheld,
          reference: `arrival fee ${ride.tripNo || rideId}`,
        });
        await rideRef.set(
          paid.ok
            ? { arrivalFeeTransferId: paid.transferId, arrivalFeePaidAt: Date.now() }
            : { arrivalFeePending: true, arrivalFeeBlockedReason: paid.error },
          { merge: true },
        );
      } else {
        await rideRef.set({ arrivalFeePending: true, arrivalFeeBlockedReason: 'no payout account' }, { merge: true });
      }
    }

    res.json({
      ok: true,
      refunded: true,
      amountCents: out.amountCents,
      arrivalFeeCents: withheld,
      status: out.status,
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// GET /operator/me — what the platform believes about the signed-in operator.
//
// Exists because an operator on duty seeing no travel has three very different causes that
// look identical from the phone: they are not in the fleet, they are in it but marked
// unavailable, or travels are being assigned to a different id than the one their app is
// watching. The app cannot tell these apart; the server can, and support will need to.
//
// Read-only and scoped to the caller. Returns no other operator's data and no traveler's.
app.get('/operator/me', requireAuth, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  try {
    const uid = String(req.uid);
    const fleetDoc = await db.collection('operators').doc(uid).get();
    const fleet = fleetDoc.exists ? fleetDoc.data() : null;
    // Travels dispatched TO this operator, newest first, statuses only.
    const rides = await db.collection('rides').where('operatorId', '==', uid).get();
    const byStatus = {};
    const recent = [];
    rides.forEach((d) => {
      const x = d.data() || {};
      const st = x.status || '(none)';
      byStatus[st] = (byStatus[st] || 0) + 1;
      recent.push({ rideId: d.id, tripNo: x.tripNo || null, status: st, createdAt: x.createdAt || 0 });
    });
    recent.sort((a, b) => b.createdAt - a.createdAt);
    res.json({
      uid,
      inFleet: !!fleet,
      available: fleet ? fleet.available === true : false,
      fleetName: fleet ? fleet.name || null : null,
      assignedToMe: rides.size,
      byStatus,
      recent: recent.slice(0, 5),
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// --- SETTLEMENT: send the operator their 99% once the travel is done. ---------------------
//
// body: { rideId, paymentIntentId }
//
// Called by the traveler's app when a travel completes. That sounds like the wrong party to
// trigger a payout, and it would be if this route trusted any of it. It does not:
//   · the ride document must name THIS caller as the traveler
//   · the PaymentIntent must carry this caller's uid, stamped by us at creation
//   · the amount comes off Stripe's record of the fare, never off the request
//   · the destination is looked up from the operator's own account, never sent by a phone
// So the worst a hostile caller can do is settle their own completed travel — which is
// precisely what is supposed to happen anyway.
//
// Idempotent by the ride document: once `transferId` is written, a second call is a no-op.
// Stripe's idempotency key covers the same-instant double tap; this covers next week.

app.post('/travel/settle', requireAuth, async (req, res) => {
  if (keyMode === 'no-key') return res.status(500).json({ error: 'No Stripe key configured' });
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });

  const rideId = String(req.body?.rideId || '');
  if (!rideId) return res.status(400).json({ error: 'rideId is required' });

  try {
    const rideRef = db.collection('rides').doc(rideId);
    const snap = await rideRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'No such travel' });
    const ride = snap.data();

    // The traveler's app names the payment it made; a SCHEDULED travel was paid for by the
    // server while nobody was holding the phone, so the app never saw an intent to name. Fall
    // back to the one stored on the travel itself. Reading it from our own record is not a
    // loosening: the ownership check below still runs, and transferToOperator re-checks the
    // uid against Stripe's own metadata before a cent moves.
    const paymentIntentId = String(req.body?.paymentIntentId || ride.paymentIntentId || '');
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'No payment is recorded for this travel' });
    }

    if (String(ride.travelerUid) !== String(req.uid)) {
      return res.status(403).json({ error: 'That travel belongs to another traveler' });
    }
    if (ride.transferId) {
      return res.json({ ok: true, alreadySettled: true, transferId: ride.transferId });
    }

    const { accountId, reason } = await operatorPayoutAccount(db, ride.operatorId);
    if (!accountId) {
      // The traveler has paid and the travel happened. We simply cannot forward the 99% yet,
      // so it stays in the platform balance and is recorded as owed. NOT an error to the
      // traveler — their part is complete — and never a reason to have refused the booking.
      await rideRef.set(
        { payoutPending: true, payoutBlockedReason: reason, payoutCheckedAt: Date.now() },
        { merge: true },
      );
      return res.json({ ok: false, code: 'operator_not_payable', owed: true, reason });
    }

    const out = await transferToOperator({
      paymentIntentId,
      operatorStripeAccount: accountId,
      expectedUid: req.uid,
      expectedTripNo: ride.tripNo || null,
      rideId,
    });

    if (!out.ok) {
      await rideRef.set(
        {
          payoutPending: true,
          payoutBlockedReason: out.error || out.code,
          payoutCheckedAt: Date.now(),
          // STORED SO A RETRY CAN FIND IT. Settlement was attempted exactly once, at
          // completion, with the PaymentIntent supplied by the traveler's app. If it failed
          // there was no way to try again: nothing recorded which payment the travel was owed
          // out of, so an operator was owed money indefinitely and only a person reading
          // Firestore would ever know.
          paymentIntentId,
          // The payment succeeded even though the transfer did not; what paid is known now.
          ...(out.paidWith ? { paidWith: out.paidWith } : {}),
        },
        { merge: true },
      );
      // Retryable means the money is still clearing — that is a wait, not a fault.
      return res.status(out.retryable ? 202 : 502).json(out);
    }

    await rideRef.set(
      {
        paymentIntentId,
        transferId: out.transferId,
        operatorPaidCents: out.amountCents,
        platformTakeCents: out.platformTake,
        payoutPending: false,
        payoutBlockedReason: null,
        settledAt: Date.now(),
        // WHAT PAID, as Stripe recorded the charge, so the receipt and the Travel Log can name
        // the card that was charged rather than the method the phone has selected today.
        ...(out.paidWith ? { paidWith: out.paidWith } : {}),
      },
      { merge: true },
    );

    // THE RECEIPT, BY EMAIL. Until now a traveler completed a journey, was charged, and
    // received nothing they could keep — the Travel Receipt existed only inside the app, on
    // the phone that took the journey. Sent once: `receiptSentAt` is checked so a repeated
    // settle call cannot send a second copy of the same receipt.
    if (!ride.receiptSentAt) {
      const mail = receiptEmail({ ...ride, completedAt: Date.now() });
      const sent = await send({ to: req.email, ...mail });
      if (sent.ok) {
        await rideRef.set({ receiptSentAt: Date.now() }, { merge: true });
      } else {
        // RECORDED ON THE TRAVEL, not only in a log line nobody reads. This failed on every
        // travel for weeks — `req.email` was undefined, so send() answered "no address for this
        // account" and the log scrolled past while /health went on reporting receipts "on".
        // A receipt that did not send is now visible on the record it belongs to and on /ops.
        await rideRef.set(
          { receiptFailed: sent.reason || 'unknown', receiptFailedAt: Date.now() },
          { merge: true },
        );
        console.log(`[receipt] ${ride.tripNo || rideId}: ${sent.reason}`);
      }
    }

    res.json(out);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// --- Lost item: put the report in front of a person. --------------------------------------
// body: { itemId, tripNo, travels, description, photoUrl, operators }
//
// The report itself is a Firestore document the app writes (src/backend/lostitem.ts), and
// that document names the operators it concerns. But naming an operator is not telling them:
// the operator app has no lost item queue and cannot have one until an operator has an
// account identity (docs/OPEN-DECISIONS.md §4). Until it does, a person is the only path a
// lost bag actually has, so every report is also filed as a case — and the app only says a
// specialist is following it up when this returned ok.
app.post('/lost-item', requireAuth, requireVerifiedEmail, LIMITS.lostItem, async (req, res) => {
  // The shape lives in lostitem.js, where lostitem.test.js can hold it to account.
  const ticket = lostItemTicket(req.body);
  if (ticket.error) return res.status(400).json({ error: ticket.error });

  const filed = await fileTicket({ uid: req.uid, email: req.email, ...ticket });
  // The case number goes onto the report too, so a report opened again later still reads
  // which case carries it (ownership checked inside).
  if (filed.ok) {
    await stampLostItemCase({ itemId: (req.body || {}).itemId, uid: req.uid, caseNo: filed.caseNo });
  }
  res.json({ ok: filed.ok, caseNo: filed.caseNo });
});

// --- Emergency: a traveler has opened the emergency screen. ------------------------------
// body: { trip, operator, vehicle, plate, address, coords }
//
// No model runs here and nothing is assessed. This files a case marked `emergency` and
// reports whether that actually happened, because the screen it answers is being read by
// someone who may be reading a plate number to a 911 dispatcher. The one thing it must
// never do is return a comforting `ok` it has not earned.
// NO requireVerifiedEmail AND NO REFUSAL HERE, DELIBERATELY. Somebody in trouble does not stop
// to check their inbox, and "you have done that too many times" is not an answer an alarm may
// give. The burst is recorded on the case so a person can see it; it is never a reason to
// refuse one.
app.post('/emergency', requireAuth, LIMITS.emergency, async (req, res) => {
  const b = req.body || {};
  const trip = b.trip && typeof b.trip === 'object' ? b.trip : {};
  const emergency = {
    operator: String(b.operator || '').slice(0, 120) || null,
    vehicle: String(b.vehicle || '').slice(0, 120) || null,
    plate: String(b.plate || '').slice(0, 32) || null,
    address: String(b.address || '').slice(0, 300) || null,
    coords:
      b.coords && Number.isFinite(b.coords.lat) && Number.isFinite(b.coords.lng)
        ? { lat: b.coords.lat, lng: b.coords.lng }
        : null,
    openedAt: Date.now(),
    // A burst of alarms from one account in an hour. Recorded so a person reading the case can
    // see it — it may be somebody in real trouble pressing repeatedly, or it may be abuse, and
    // that is a judgement for a person and never for a counter.
    burst: req.rateBurst ? `${req.rateBurst.count} in the last hour` : null,
  };

  const filed = await fileTicket({
    uid: req.uid,
    email: req.email,
    kind: 'emergency',
    emergency,
    trip,
    reason: 'Traveler opened the emergency screen.',
    description:
      `Emergency screen opened during travel ${trip?.no || '—'}.\n` +
      `Operator: ${emergency.operator || '—'}\n` +
      `Vehicle: ${emergency.vehicle || '—'} · plate ${emergency.plate || '—'}\n` +
      `Location: ${emergency.address || '—'}` +
      (emergency.coords ? ` (${emergency.coords.lat}, ${emergency.coords.lng})` : ''),
  });

  res.json({ ok: filed.ok, caseNo: filed.caseNo, stored: filed.stored, emailed: filed.emailed });
});

// --- Emergency: the vehicle has moved. ----------------------------------------------------
// body: { caseNo, address, coords }
app.post('/emergency/location', requireAuth, async (req, res) => {
  const b = req.body || {};
  const out = await updateTicketLocation({
    caseNo: b.caseNo,
    uid: req.uid,
    address: typeof b.address === 'string' ? b.address.slice(0, 300) : null,
    coords:
      b.coords && Number.isFinite(b.coords.lat) && Number.isFinite(b.coords.lng)
        ? { lat: b.coords.lat, lng: b.coords.lng }
        : null,
  });
  res.json(out);
});

// --- AI trip assistant: plan a ride from a plain-English message (requires login). ---------
// body: { message }
// WITHDRAWN (founders, 4 Sept 2026; confirmed 10 Sept). The AI planner has no entry point in
// the app; this route answered anyway to any signed-in caller. It now says it is gone. The
// code stays in assistant.js and src/withdrawn/plan.tsx should it ever be refined and
// reintroduced.
app.post('/assistant', requireAuth, (req, res) => {
  res.status(410).json({ error: 'The trip planner has been withdrawn.' });
});
app.post('/assistant-withdrawn-original', requireAuth, async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) return res.status(400).json({ error: 'message is required' });
  try {
    const plan = await planTrip({ message });
    res.json(plan);
  } catch (e) {
    if (String(e.message).includes('ANTHROPIC_API_KEY')) {
      return res.status(503).json({ error: "The AI assistant isn't switched on yet." });
    }
    res.status(502).json({ error: e.message });
  }
});

// --- Quote: the money breakdown for a ride. Pure math, no Stripe call. --------------------
// body: { travelCostCents: 2450 }
app.post('/quote', (req, res) => {
  const cents = Number(req.body?.travelCostCents);
  if (!positiveCents(cents)) {
    return res.status(400).json({ error: 'travelCostCents must be a positive whole number of cents' });
  }
  res.json(quote(cents));
});

// --- The driving route for the live map. ---------------------------------------------------
// body: { pickup: {lat,lng}, dest: {lat,lng} }
// Returns { coords, durationSec, distanceMeters, provider } following real streets, or 404
// when the trip can't be routed — the app then keeps its straight-line fallback. Like
// /fare-quote this is unauthenticated (it reveals nothing private), but it only answers inside
// a served region (regions.js), so it can't be farmed as a free worldwide routing proxy.
app.post('/route', async (req, res) => {
  const route = await fetchRoute(req.body?.pickup, req.body?.dest);
  if (!route) return res.status(404).json({ error: 'No route for that trip' });
  res.json(route);
});

// --- Smart Travel: car → transit → car, planned by OpenTripPlanner, priced per leg, ONE fee. --
// body: { pickup: {lat,lng}, dest: {lat,lng} }
// Three answers, and the status code is part of the answer (Chad, 9 Sept 2026):
//   200 { status: 'ok', ...plan }     a transit route exists; the plan, with its numbers, always
//   200 { status: 'none' }            no transit route exists — the app shows Smart Travel greyed
//   503 { status: 'unavailable' }     the planner is not answering — the app says so
// This used to 404 when rail "did not win", and the app read 404 as "do not show". That gate
// is withdrawn: the server reports; the client decides emphasis.
app.post('/smart-quote', async (req, res) => {
  // OLDER APPS GET THE OLDER ANSWER. TestFlight build 36 reads any 200 as a plan and would
  // render `{ status: 'none' }` as a card reading "Save $NaN", then crash on its legs. An app
  // that does not name the new contract (header X-AR-Smart: 2) is answered the way the old
  // server answered it: 404 and no card. Removable once every tester is on a newer build.
  const speaksV2 = req.get('x-ar-smart') === '2';
  const out = await smartQuote(req.body?.pickup, req.body?.dest);
  if (!speaksV2) return res.status(404).json({ error: 'Smart Travel needs the current app' });
  if (out.status === 'unavailable') return res.status(503).json({ status: 'unavailable' });
  if (out.status !== 'ok') return res.json({ status: 'none' });
  res.json(out.plan);
});

// --- Where can I go from here? The app asks; the server answers for the REGION. -----------
// query: ?lat=25.77&lng=-80.19  (&limit=5)
//
// WHY THIS IS A ROUTE AND NOT A LIST IN THE APP. Until 20 Sept 2026 the bookable destinations
// were hardcoded in src/data.ts and shown to every first-time traveler wherever they stood. A
// traveler in Fort Lauderdale — inside our market, served — was offered five Miami-Dade places
// twenty-five miles away, with journey times computed from Brickell. Opening a new city meant
// editing the app and shipping a build through App Review.
//
// NO LOGIN, for the same reason /fare-quote needs none: somebody must be able to see whether
// we serve their city before they will make an account.
//
// AN EMPTY LIST IS A CORRECT ANSWER. Outside every region the answer is nothing, and the
// screen says we do not operate there yet — which is true, and better than five destinations
// in a city the traveler is not in.
app.get('/destinations', (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }
  res.json(destinationsNear({ lat, lng }, limit));
});

// --- What does THIS trip cost? The app asks; the server decides. --------------------------
// body: { pickup: {lat,lng}, dest: {lat,lng} }  OR  { destination: 'Wynwood' }
// Returns the ONE all-in price the traveler sees, plus the split behind it. `feeLines` names
// any government fee inside that price (name, payee, cents) so a screen can say what it is;
// `travelerPays` already contains it — nothing is added on top of the number shown.
// No login needed: this only reveals pricing, and a traveler must see the price before booking.
app.post('/fare-quote', attachAuth, async (req, res) => {
  const priced = priceRide(req.body);
  if (priced?.outsideMarket) {
    return res.status(409).json({ error: priced.reason, code: 'outside_market', where: priced.outsideMarket });
  }
  if (priced?.permitRequired) {
    return res.status(409).json({
      error: priced.reason,
      code: 'permit_required',
      where: priced.permitRequired.end,
      place: priced.permitRequired.id,
    });
  }
  if (!priced) {
    return res.status(400).json({ error: 'Need either pickup+dest coordinates or a known destination' });
  }
  // WHICH FEE SCHEDULE, DECIDED HERE AND NOWHERE ELSE. The fee depends on the issuing country
  // of the traveler's default card (Chad, 20 Sept 2026), and the ONE place that can be read
  // without the price moving later is before the quote is given. A traveler with nothing on
  // file, or nobody signed in, is quoted domestic — see isDomesticCard() in payments.js.
  const cardCountry = req.uid ? await defaultCardCountry({ uid: req.uid, email: req.email }) : null;
  res.json({
    ...quote(priced.travelCostCents, undefined, priced.governmentFees, cardCountry),
    travelCostCents: priced.travelCostCents,
    miles: priced.miles,
    pricedBy: priced.pricedBy,
  });
});

// --- REAL APP FLOW: start a payment and return its client secret to the app. ---------------
// The app collects the card on the phone and confirms it there.
// body: { travelCostCents, operatorStripeAccount? }
// THE REAL FLOW. The app asks for an intent, Stripe's PaymentSheet collects the card ON THE
// PHONE, and the card never touches this server. Replaces /charge-ride, which was labelled
// "LOCAL TEST ONLY" and defaulted to the test card `pm_card_visa` — a payment method that
// does not exist in live mode, so the app's only payment path would have failed outright the
// moment a live key was installed.
// ——— SAVED PAYMENT METHODS — the traveler's own, read from and written to their Stripe
// Customer record. Without a key there is nothing to read, and the app is told so plainly
// rather than shown an empty list it might mistake for "none saved".
app.get('/payment-methods', requireAuth, async (req, res) => {
  if (keyMode === 'no-key') return res.json({ methods: [], unavailable: 'no-key' });
  try {
    const methods = await listPaymentMethods({ uid: req.uid, email: req.email });
    return res.json({ methods });
  } catch (e) {
    return res.status(502).json({ error: 'Saved payment methods could not be read', detail: String(e && e.message || e) });
  }
});

app.post('/payment-methods/setup-intent', requireAuth, async (req, res) => {
  if (keyMode === 'no-key') return res.status(500).json({ error: 'No Stripe secret key configured' });
  try {
    const setup = await createSetupIntent({ uid: req.uid, email: req.email });
    return res.json(setup);
  } catch (e) {
    return res.status(502).json({ error: 'A payment method cannot be added right now', detail: String(e && e.message || e) });
  }
});

app.post('/payment-methods/default', requireAuth, async (req, res) => {
  if (keyMode === 'no-key') return res.status(500).json({ error: 'No Stripe secret key configured' });
  try {
    const r = await setDefaultPaymentMethod({ uid: req.uid, email: req.email, paymentMethodId: req.body && req.body.paymentMethodId });
    if (!r.ok) return res.status(r.code === 'bad_id' ? 400 : 403).json({ error: r.code });
    return res.json({ ok: true, methods: await listPaymentMethods({ uid: req.uid, email: req.email }) });
  } catch (e) {
    return res.status(502).json({ error: 'The default could not be changed', detail: String(e && e.message || e) });
  }
});

app.delete('/payment-methods/:id', requireAuth, async (req, res) => {
  if (keyMode === 'no-key') return res.status(500).json({ error: 'No Stripe secret key configured' });
  try {
    const r = await detachPaymentMethod({ uid: req.uid, email: req.email, paymentMethodId: req.params.id });
    if (!r.ok) return res.status(r.code === 'bad_id' ? 400 : 403).json({ error: r.code });
    return res.json({ ok: true, methods: await listPaymentMethods({ uid: req.uid, email: req.email }) });
  } catch (e) {
    return res.status(502).json({ error: 'The payment method could not be removed', detail: String(e && e.message || e) });
  }
});

app.post('/create-payment-intent', requireAuth, async (req, res) => {
  if (keyMode === 'no-key') {
    return res.status(500).json({ error: 'No Stripe secret key configured. Add STRIPE_SECRET_KEY to backend/.env' });
  }
  // Price the ride on the server — by coordinates when we have them, else the fare table.
  // Never from a client-sent amount.
  const priced = priceRide(req.body);
  if (priced?.outsideMarket) {
    return res.status(409).json({ error: priced.reason, code: 'outside_market', where: priced.outsideMarket });
  }
  if (!priced) {
    return res.status(400).json({ error: 'Need either pickup+dest coordinates or a known destination' });
  }

  // THE 99% IS A PROMISE, NOT A PREFERENCE — and it is kept at /travel/settle, not here.
  //
  // This used to read an `operatorStripeAccount` straight out of the request body and hand it
  // to Stripe as the transfer destination. Two defects in one line: any signed-in caller could
  // name their OWN connected account and be sent 99% of a fare they did not drive, and nothing
  // in the app ever sent the field at all — so the live-mode guard below it rejected every
  // booking with a 409. The app could not have taken a single real payment.
  //
  // The destination is no longer the client's to name, or ours to know yet. The fare is
  // collected in full and split when the travel completes and the operator is known.
  // A SMART TRAVEL JOURNEY PAYS ONE PLATFORM FEE. When this travel is the last car leg of a
  // journey, the app names the first leg's Travel Number. The first leg is looked up here —
  // it must be THIS traveler's and must have been paid — and its fare is handed to the
  // quote, which charges only the fee the combined car fare adds. Anything that does not
  // check out is simply not a journey: the standard fee applies and nothing is refused.
  let journey = null;
  const journeyNo = String(req.body?.journeyNo || '').slice(0, 24);
  if (journeyNo) {
    const db = adminDb();
    if (db) {
      try {
        const snap = await db
          .collection('rides')
          .where('travelerUid', '==', req.uid)
          .where('tripNo', '==', journeyNo)
          .limit(1)
          .get();
        const leg1 = snap.docs[0]?.data();
        if (leg1 && leg1.paymentIntentId && leg1.status !== 'cancelled' && leg1.costCents > 0) {
          journey = { journeyNo, leg1FareCents: Number(leg1.costCents) };
        }
      } catch (e) {
        console.error('[pay] could not read journey leg', journeyNo, e.message);
      }
    }
  }

  try {
    const result = await createPaymentIntent({
      travelCostCents: priced.travelCostCents,
      journey,
      // Fenced from the same coordinates as the price, above. Stamped on the intent and the
      // travel; remittance.js reads it back by the month.
      governmentFees: priced.governmentFees,
      // Stamped onto the PaymentIntent so a later refund can prove who paid.
      uid: req.uid,
      email: req.email,
      tripNo: req.body?.tripNo || null,
      // Display only — the PRICE still comes from priceRide above, never from the body. These
      // two are what put the route on the traveler's receipt and bank statement.
      //
      // `departure` and `destination` are the NAMES. Not `req.body.dest`, which is the
      // destination's coordinates and would have printed "[object Object]" on every receipt.
      dep: String(req.body?.departure || '').slice(0, 60) || null,
      dest: String(req.body?.destination || '').slice(0, 60) || null,
    });

    // WRITE THE PAYMENT ONTO THE TRAVEL, HERE, BEFORE THE TRAVELER IS ASKED FOR A CARD.
    //
    // Until 29 Aug 2026 the only record that a travel had been paid for lived in the phone's
    // memory (RideContext's paidIntentRef) and was posted to /travel/settle at the end. So
    // settlement depended on one app staying alive from payment to completion. It did not
    // have to crash: matchedOp going null detaches the status watcher, so 'completed' never
    // arrived, finishTravel never ran, and trySettle returned silently on a null ref.
    //
    // /operator/settle-pending exists to recover exactly this, and could not: it looks for
    // `paymentIntentId` on the travel, which nothing wrote for an in-app payment. A recovery
    // path that cannot fire on the only case it was built for.
    //
    // AR-2109-MIA is what that costs. The traveler was charged $19.44, Marcus Reyes drove it
    // and completed it, and there was no transfer and no receipt — the money sat in the
    // platform balance with nothing left anywhere to connect it to the journey.
    //
    // Written by the SERVER because the server is the only party guaranteed to be present.
    // Never fatal: a traveler must still be able to pay if this write fails, and settlement
    // has the app's own copy as a second route.
    const rideId = String(req.body?.rideId || '');
    if (rideId && result.paymentIntentId) {
      const db = adminDb();
      if (db) {
        try {
          await db.collection('rides').doc(rideId).set(
            {
              paymentIntentId: result.paymentIntentId,
              paidAt: Date.now(),
              // What is held for a public body on this travel, and for whom — the record the
              // monthly remittance ledger (remittance.js) is summed from.
              governmentFeeCents: result.breakdown.governmentFeeCents,
              feeLines: result.breakdown.feeLines,
            },
            { merge: true },
          );
        } catch (e) {
          console.error('[pay] could not record intent on travel', rideId, e.message);
        }
      }
    }
    res.json({ ...result, feeLines: result.breakdown.feeLines, mode: keyMode });
  } catch (e) {
    res.status(502).json({ error: e.message, code: e.raw?.code || e.raw?.type || null });
  }
});

// --- LOCAL TEST ONLY: charge a Stripe test card server-side, to prove the flow from a terminal.
// Not used by the real app. body: { travelCostCents, operatorStripeAccount?, travelerPaymentMethod? }
// A TEST-ONLY ROUTE, AND IT IS NOW REFUSED IN LIVE MODE.
//
// THE DEFECT. This took `operatorStripeAccount` straight out of the request body and handed it
// to Stripe as `transfer_data.destination`, then confirmed the charge in the same call. So any
// signed-in traveler could name their OWN connected account and be sent 99% of a fare they did
// not drive — with real money, the moment live keys are installed.
//
// That is the identical defect I removed from /create-payment-intent, whose comment describes
// it in those words. I fixed it there and left it standing here, on a route the app has never
// called and whose own comment says "NOT used by the real app". Found 27 Aug 2026 by auditing
// which routes take money and where their inputs come from.
//
// Kept, because proving a charge end to end from a terminal is genuinely useful — but only
// where a test key means no real money can move, and never with a destination the caller named.
app.post('/charge-ride', requireAuth, async (req, res) => {
  if (keyMode === 'no-key') {
    return res.status(500).json({ error: 'No Stripe secret key configured. Add STRIPE_SECRET_KEY to backend/.env' });
  }
  if (keyMode !== 'test') {
    return res.status(403).json({
      error: 'This route exists only for test-mode verification and is disabled with live keys.',
    });
  }
  // Price the ride on the server — never from a client-sent amount.
  const priced = priceRide(req.body);
  if (priced?.outsideMarket) {
    return res.status(409).json({ error: priced.reason, code: 'outside_market', where: priced.outsideMarket });
  }
  if (!priced) {
    return res.status(400).json({ error: 'Need either pickup+dest coordinates or a known destination' });
  }
  try {
    const result = await chargeRide({
      travelCostCents: priced.travelCostCents,
      // NOT FROM THE BODY. The destination is never the caller's to name — see above. Left
      // null: this route proves a charge, and the operator's 99% moves at settlement, from a
      // destination the server looks up itself (POST /travel/settle).
      operatorStripeAccount: null,
      travelerPaymentMethod: req.body?.travelerPaymentMethod || null,
      uid: req.uid,
      tripNo: req.body?.tripNo || null,
      governmentFees: priced.governmentFees,
    });
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message, code: e.raw?.code || e.raw?.type || null });
  }
});

// --- Scheduled travel: the clock. ---------------------------------------------------------
//
// Two ways in, because one of them is not reliable on free hosting. The interval below is the
// real mechanism; the endpoint exists so an outside pinger can drive it, which on a free
// Render instance is also what wakes the process up. GET as well as POST: most free cron
// services send GET and cannot be told otherwise.
//
// UNAUTHENTICATED BY DESIGN, unless SCHEDULER_TOKEN is set. The endpoint takes no parameters
// and can only do what the clock would do a minute later on its own — it cannot be aimed at a
// traveler, an amount, or an operator. Set SCHEDULER_TOKEN in the environment to require one
// anyway, and give the same value to the pinger as ?token=.
let lastSweep = { at: 0, report: null };

/**
 * One tick of everything the platform does on a clock.
 *
 * Both jobs run on the same tick and neither may take the other down — a route monitor that
 * throws must not stop travel being dispatched, and vice versa. Promise.allSettled, not
 * Promise.all.
 */
async function runAllSweeps() {
  const [scheduled, monitor, assignments, screening, settlements] = await Promise.allSettled([
    sweepScheduled(),
    sweepMonitor(),
    sweepAssignments(),
    sweepScreening(),
    // Money owed to operators for work already done. Last, and never allowed to fail the
    // others — Promise.allSettled, like the rest.
    sweepSettlements(),
  ]);
  const unwrap = (r) => (r.status === 'fulfilled' ? r.value : { ok: false, reason: String(r.reason) });
  return {
    scheduled: unwrap(scheduled),
    monitor: unwrap(monitor),
    assignments: unwrap(assignments),
    screening: unwrap(screening),
    settlements: unwrap(settlements),
  };
}

async function runSweep(req, res) {
  // THE TOKEN NOW DECIDES WHAT COMES BACK, NOT WHETHER THE SWEEP RUNS.
  //
  // Found in the pre-launch sweep, 19 Sept 2026: this endpoint is open on production, by
  // design — free cron services send an unauthenticated GET and cannot be told otherwise, and
  // the sweep takes no parameters, so it cannot be aimed at a traveler, an amount or an
  // operator. That reasoning covers what the endpoint DOES. It did not cover what it SAYS.
  //
  // The report is operational state: how many travels are waiting, how many operators are
  // moving, settlements and `centsPaid` — and, when they are not empty, `emergencies`,
  // `cases`, `stranded` and `dispatched`, which carry identifiers. Anyone on the internet
  // could read all of it, once every ten seconds, including whether an emergency had just
  // happened. That is the disclosure, and it is worst on exactly the quietest day, when one
  // non-empty array is the whole story.
  //
  // Failing CLOSED was the wrong fix: no token is set on Render today, so refusing the call
  // would stop scheduled travel being dispatched and settlements being paid. The clock must
  // keep running for anyone. Only the detail is held back.
  const want = readKey('SCHEDULER_TOKEN');
  const got = String(req.query?.token || req.get('x-scheduler-token') || '');
  const trusted = !!want && got === want;
  // One real sweep per ten seconds. Protects against a pinger set too fast and against a
  // manual sweep landing on top of the interval — the claim transaction makes that safe, but
  // there is no reason to make Stripe and Firestore absorb it.
  const now = Date.now();
  if (now - lastSweep.at < 10000 && lastSweep.report) {
    return res.json(sweepBody({ ...lastSweep.report, cached: true, ageMs: now - lastSweep.at }, trusted));
  }
  const report = await runAllSweeps();
  lastSweep = { at: Date.now(), report };
  res.json(sweepBody(report, trusted));
}

/**
 * What a caller is allowed to read back from a sweep.
 *
 * With the token: everything, which is what makes `GET /scheduled/sweep` the fastest way to
 * see what the platform is doing (docs/SCHEDULED-TRAVEL.md). Without it: that the sweep ran
 * and whether each pass succeeded, which is all a cron service needs in order to alert on a
 * failing job — and no counts, no amounts and no identifiers.
 */
function sweepBody(report, trusted) {
  if (trusted) return report;
  const ran = {};
  for (const [pass, result] of Object.entries(report)) {
    if (result && typeof result === 'object' && 'ok' in result) ran[pass] = { ok: !!result.ok };
  }
  return { ok: true, swept: true, passes: ran, detail: 'set SCHEDULER_TOKEN and pass ?token= to read it' };
}

// --- Reading an operator's documents. ------------------------------------------------------
//
// body: { kind, imageUrl }
//
// FIRST-PARTY ONLY, and that is what makes it lawful without a screening licence. The operator
// hands US their own document; we read it and cross-check it against what we already hold about
// them. FCRA §603(d)(2)(A)(i) excludes from "consumer report" anything containing solely
// information about transactions or experiences between the consumer and the report-maker.
// Nothing here is looked up about the person — see the header of backend/documents.js for the
// other edge of that line, which is CFPB Circular 2024-06.
app.post('/operator/document', requireAuth, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });

  const kind = String(req.body?.kind || '');
  const imageUrl = String(req.body?.imageUrl || '');
  if (!kind || !imageUrl) return res.status(400).json({ error: 'kind and imageUrl are required' });
  // The upload must be OURS. A caller could otherwise hand us any URL on the internet and have
  // the server fetch it — and an operator could point at somebody else's licence.
  if (!/^https:\/\/firebasestorage\.googleapis\.com\//.test(imageUrl)) {
    return res.status(400).json({ error: 'That document was not uploaded to American Rider' });
  }
  if (!imageUrl.includes(`operator-documents%2F${req.uid}%2F`) &&
      !imageUrl.includes(`operator-documents/${req.uid}/`)) {
    return res.status(403).json({ error: 'That document belongs to another account' });
  }

  try {
    // WHAT WE ALREADY BELIEVE, for cross-checking — all of it first-party, all of it something
    // the operator told us themselves.
    const [userSnap, opSnap] = await Promise.all([
      db.collection('users').doc(String(req.uid)).get(),
      db.collection('operators').doc(String(req.uid)).get(),
    ]);
    const u = userSnap.exists ? userSnap.data() : {};
    const o = opSnap.exists ? opSnap.data() : {};
    const expect = {
      name: u.legalName || u.name || o.name || req.email || '',
      plate: o.plate || '',
      vehicle: o.car || '',
    };

    const out = await readDocument({ kind, imageUrl, expect });
    if (!out.ok) return res.status(502).json({ error: out.error });

    // RECORDED WHATEVER THE ANSWER. A refusal is the operator's record too — they are entitled
    // to know what was read and why, and a person reviewing a held document needs the same.
    await db.collection('users').doc(String(req.uid)).set(
      {
        documents: {
          [kind]: {
            verdict: out.verdict,
            reasons: out.reasons,
            summary: out.summary,
            expiry: out.expiry,
            imageUrl,
            readAt: Date.now(),
          },
        },
      },
      { merge: true },
    );

    // A document that is not accepted must not leave the operator dispatchable on the strength
    // of an earlier one. Taken off duty rather than deleted; the record stands.
    if (out.verdict !== 'accept') {
      await db.collection('operators').doc(String(req.uid)).set(
        { available: false, documentBlocked: true, documentReason: out.summary || '' },
        { merge: true },
      );
    }

    res.json({
      verdict: out.verdict,
      reasons: out.reasons,
      summary: out.summary,
      expiry: out.expiry,
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// --- The §627.748(8)(a) insurance disclosure. -----------------------------------------------
//
// Served from the server rather than written into the app, so the words an operator agreed to
// and the words we can produce later are the same words — which is the whole point of a
// statute saying "in writing".
// ONE FUNCTION, BECAUSE TWO WOULD DRIFT. The GET renders the disclosure and the POST records
// what was agreed to; if they built the text separately, the record would eventually quote
// words the operator never saw — which is precisely the failure §627.748(8)(a) is meant to
// prevent, dressed up as a record.
//
// A LANGUAGE WE DO NOT HAVE FALLS BACK TO ENGLISH ENTIRELY. Never half-translated: an operator
// cannot tell which half of a mixed document they agreed to, and neither could we afterwards.
function disclosureInLanguage(insured, lang) {
  const base = disclosureFor(insured);
  const tr = translationFor(lang);
  if (!tr) return { ...base, lang: 'en', governing: null };
  return {
    ...base,
    lang: String(lang).slice(0, 2).toLowerCase(),
    title: tr.title,
    provided: tr.provided,
    // The verified variant is chosen on the SAME condition as the English, so a Spanish
    // operator with a commercial policy on file reads the same one their English counterpart
    // would — not the stricter wording because the translation happened to carry one version.
    ownPolicy: insured ? tr.ownPolicyVerified : tr.ownPolicy,
    required: tr.required,
    acknowledgement: tr.acknowledgement,
    // The English is controlling, and the operator is told so on the document itself.
    governing: tr.governing,
  };
}

app.get('/operator/disclosure', requireAuth, async (req, res) => {
  const db = adminDb();
  let ack = null;
  let user = null;
  if (db) {
    try {
      const snap = await db.collection('users').doc(String(req.uid)).get();
      user = snap.exists ? snap.data() : null;
      ack = user?.insuranceDisclosure || null;
    } catch {
      /* an unreadable record is not an acknowledgement */
    }
  }
  // WHICH VERSION THEY READ DEPENDS ON WHAT WE HAVE VERIFIED ABOUT THEM. An operator who has
  // already provided a commercial policy is not told their policy might not cover them — see
  // backend/disclosure.js. The statutory sentence about a PERSONAL policy survives in both.
  const insured = !!(user?.insuranceVerifiedAt || user?.operatorInsuranceExpiry);
  res.json({
    disclosure: disclosureInLanguage(insured, req.query?.lang),
    languages: DISCLOSURE_LANGUAGES,
    acknowledged: disclosureCurrent(ack),
    acknowledgedAt: disclosureCurrent(ack) ? ack.at : null,
  });
});

app.post('/operator/disclosure/acknowledge', requireAuth, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  try {
    // Which of the two they were shown, so the stored text is the text they actually read.
    // A record of a disclosure that quotes different words from the ones on their screen is
    // not a record of anything.
    let insuredAtAck = false;
    try {
      const snap = await db.collection('users').doc(String(req.uid)).get();
      const u = snap.exists ? snap.data() : null;
      insuredAtAck = !!(u?.insuranceVerifiedAt || u?.operatorInsuranceExpiry);
    } catch {
      /* default to the stricter wording */
    }
    // THE TEXT IS STORED WITH THE ACKNOWLEDGEMENT, not just its version. A regulator asking
    // what this operator agreed to on this date should be answerable from the record itself,
    // without reconstructing it from a git history.
    // THE LANGUAGE IS PART OF THE RECORD. Storing only the English while a Spanish-speaking
    // operator read Spanish would make the record a translation of what they agreed to rather
    // than a copy of it. The body names the language shown; the stored text is that document.
    const shown = disclosureInLanguage(!!insuredAtAck, req.body?.lang);
    await db.collection('users').doc(String(req.uid)).set(
      {
        insuranceDisclosure: {
          version: DISCLOSURE_VERSION,
          at: Date.now(),
          statute: DISCLOSURE.statute,
          lang: shown.lang,
          text: JSON.stringify(shown),
          acknowledgement: shown.acknowledgement,
          // The English remains controlling, so it is kept alongside rather than replaced.
          englishAcknowledgement: disclosureFor(insuredAtAck).acknowledgement,
          insuranceVerifiedAtAcknowledgement: insuredAtAck,
        },
      },
      { merge: true },
    );
    res.json({ ok: true, version: DISCLOSURE_VERSION, lang: shown.lang });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// --- Operator screening. -------------------------------------------------------------------
//
// WHO PAYS AND WHO ORDERS ARE DIFFERENT QUESTIONS, and getting them confused is the whole
// trap here. The OPERATOR pays (Chad, 23 Aug — pre-revenue). AMERICAN RIDER ORDERS, because
// the statute requires the TNC to conduct or arrange the check and the FCRA permissible
// purpose belongs to whoever the report is for. An operator who buys a consumer report about
// themselves has not satisfied either. So the fee is a pass-through: the operator pays us
// exactly what the screening costs, we pay the screening company.
app.get('/operator/screening', requireAuth, async (req, res) => {
  const db = adminDb();
  // The quote is ITEMIZED (Chad, 27 Aug): cost + card processing = total. The operator sees
  // all three numbers; the app never shows a total whose parts it cannot name.
  const out = { feeCents: SCREENING_FEE_CENTS, quote: screeningQuote(SCREENING_FEE_CENTS), provider: screeningReady() ? 'checkr' : null };
  if (!db) return res.json({ ...out, screening: null, reason: adminStatus().reason });
  try {
    const snap = await db.collection('users').doc(String(req.uid)).get();
    const screening = snap.exists ? snap.data().screening || null : null;
    // A PARTIAL TIER IS QUOTED AT ITS OWN PRICE. Both directions: the MVR alone when the
    // criminal half is already in hand, and Basic alone when the driving record is.
    const cost = Number(screening?.feeCents);
    if (cost === MVR_ONLY_FEE_CENTS || cost === BASIC_ONLY_FEE_CENTS) {
      out.feeCents = cost;
      out.quote = screeningQuote(cost);
    }
    res.json({ ...out, screening });
  } catch (e) {
    res.json({ ...out, screening: null, reason: e.message });
  }
});

/**
 * An operator who has already been screened elsewhere.
 *
 * They name the company and sign an instruction; FCRA §604(a)(2) makes a consumer's own written
 * instruction a permissible purpose, so that company may lawfully send the report to us. The
 * operator pays nothing if it is complete and recent, or $17.50 if only the driving history is
 * missing — which is the common case, because several gig platforms buy the criminal half alone.
 *
 * NOTHING IS ACCEPTED ON THIS REQUEST. It records the declaration and opens a case to chase the
 * screening company; the report is only ever adjudicated when it arrives FROM them.
 */
app.post('/operator/screening/existing', requireAuth, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });

  const agency = String(req.body?.agency || '').slice(0, 120).trim();
  const issuedAt = Number(req.body?.issuedAt || 0);
  const elements = Array.isArray(req.body?.elements) ? req.body.elements.slice(0, 6) : [];
  const consent = req.body?.consent === true;
  if (!agency || !consent) {
    return res.status(400).json({ error: 'The company name and your written instruction are required' });
  }

  // Priced as though it arrives from the agency, because that is what we are asking them to do.
  const verdict = evaluateExistingReport({ source: 'agency', issuedAt, elements });

  try {
    // A real place to send it and a reference to put on it — "ask them to send it to us"
    // was an instruction with no address (Chad, 27 Aug). The agency emails the report to
    // the screening inbox citing the case number; support matches it by that number.
    const transferTo = 'support@americanrider.app';
    await db.collection('users').doc(String(req.uid)).set(
      {
        screening: {
          decision: 'awaiting_agency',
          provider: agency,
          transferTo,
          declaredIssuedAt: issuedAt || null,
          declaredElements: elements,
          // The instruction itself, stamped. This is the permissible purpose, so it is a
          // record we keep rather than a checkbox we forget.
          consentAt: Date.now(),
          consentText:
            'I instruct the named screening company to release my most recent background ' +
            'screening report to American Rider.',
          feeCents: verdict.feeCents,
          // WHICH PACKAGE THIS BUYS, stored alongside the price rather than re-derived from
          // it later. See the note at the order route.
          tier: verdict.tier || 'full',
          partial: !!verdict.partial,
          summary: verdict.reason,
        },
      },
      { merge: true },
    );
    const filed = await fileTicket({
      uid: req.uid,
      email: req.email,
      kind: 'support',
      reason: 'Operator screening — request an existing report',
      description:
        `Operator ${req.uid} has instructed ${agency} to release their screening report to ` +
        `American Rider (FCRA §604(a)(2), written instruction on file, stamped ` +
        `${new Date().toISOString()}).
` +
        `Declared issue date: ${issuedAt ? new Date(issuedAt).toISOString().slice(0, 10) : 'not given'}
` +
        `Declared contents: ${elements.join(', ') || 'not given'}
` +
        `If it arrives complete and under twelve months old, the operator pays nothing. If only ` +
        `the driving history is missing, they pay ${(MVR_ONLY_FEE_CENTS / 100).toFixed(2)}.
` +
        `NOTHING IS ACCEPTED FROM THE OPERATOR — it must arrive from ${agency} directly.`,
    });
    const caseNo = filed?.caseNo || null;
    if (caseNo) {
      await db.collection('users').doc(String(req.uid)).set(
        { screening: { transferCaseNo: caseNo } },
        { merge: true },
      );
    }
    res.json({ ok: true, feeCents: verdict.feeCents, note: verdict.reason, transferTo, transferCaseNo: caseNo });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.post('/operator/screening/intent', requireAuth, async (req, res) => {
  if (keyMode === 'no-key') return res.status(500).json({ error: 'No Stripe key configured' });
  try {
    // The operator may be paying the full screening or only the driving history, depending on
    // what an existing report already covered. Read from OUR record, never from the request:
    // a client that could name its own price would name a smaller one.
    const db = adminDb();
    let costCents = SCREENING_FEE_CENTS;
    if (db) {
      const snap = await db.collection('users').doc(String(req.uid)).get();
      const declared = snap.exists ? Number(snap.data()?.screening?.feeCents) : NaN;
      // Both partial tiers, read from OUR record — never from the request.
      if (declared === MVR_ONLY_FEE_CENTS || declared === BASIC_ONLY_FEE_CENTS) {
        costCents = declared;
      }
    }
    // The CHARGE is the itemized total: cost + card processing (see screening.js for the
    // gross-up math). The stored feeCents stays the COST — it decides which package is
    // ordered; what Stripe collects is that cost plus exactly its own fee.
    const out = await createScreeningIntent({
      amountCents: grossUpCents(costCents),
      uid: req.uid,
      email: req.email,
    });
    res.json(out);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

/**
 * Order the check, once it has been paid for.
 *
 * WITHOUT A PROVIDER KEY THIS RECORDS THE ORDER AND SAYS SO. It does not simulate a pass. An
 * operator marked clear by a screening that never happened is the single worst thing this
 * codebase could contain, so the absent case is 'awaiting_provider' — which is not a pass, is
 * not dispatchable, and is visible on /ops until a key exists.
 */
app.post('/operator/screening/order', requireAuth, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  const paymentIntentId = String(req.body?.paymentIntentId || '');
  if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId is required' });

  try {
    // The fee must actually have been paid, and by this person. Checked against Stripe rather
    // than believed from the request.
    const paid = await refundableFor({ paymentIntentId, expectUid: req.uid });
    if (!paid.ok) return res.status(402).json({ error: 'That payment cannot be verified', detail: paid.error });

    const userRef = db.collection('users').doc(String(req.uid));
    const snap = await userRef.get();
    const existing = snap.exists ? snap.data().screening || {} : {};

    // ORDERING TWICE MUST NOT SCREEN TWICE. A double-tap, a retried request, or an app that
    // lost the response and asked again all land here — and each Checkr invitation is a real
    // report and a real charge. An order already in flight is returned, not repeated.
    if (existing.invitationId && ['invited', 'in_progress', 'ordered'].includes(existing.decision)) {
      return res.json({
        ok: true,
        ordered: true,
        alreadyOrdered: true,
        invitationUrl: existing.invitationUrl || null,
      });
    }

    // WITHOUT A PROVIDER KEY THIS RECORDS THE ORDER AND SAYS SO. It does not simulate a pass.
    // An operator marked clear by a screening that never happened is the single worst thing
    // this codebase could contain, so the absent case is 'awaiting_provider' — not a pass,
    // not dispatchable, visible on /ops until a key exists.
    if (!screeningReady()) {
      await userRef.set(
        {
          screening: {
            decision: 'awaiting_provider',
            orderedAt: Date.now(),
            paymentIntentId,
            provider: null,
            summary: 'Paid. American Rider will order this as soon as screening is live.',
          },
        },
        { merge: true },
      );
      return res.json({ ok: true, ordered: false });
    }

    // The actual order: candidate + invitation at Checkr. The operator gets Checkr's email
    // and enters their own SSN/licence/consent in Checkr's hosted flow — their PII never
    // touches this server. The MVR-only package covers the $17.50 top-up path, where an
    // existing report already satisfied the criminal half (see evaluateExistingReport).
    // THE TIER IS READ, NOT INFERRED. This compared the stored fee against
    // MVR_ONLY_FEE_CENTS to decide which package to order — deriving a package from a number
    // of cents. Adding the criminal-only tier made two prices map to two different packages
    // and one comparison; evaluateExistingReport now states the tier and it is stored with
    // the record. `full` for anything written before this existed.
    const tier = existing.tier || 'full';
    const order = await checkr.invite({ uid: req.uid, email: req.email, tier });

    await userRef.set(
      {
        screening: {
          decision: 'invited',
          orderedAt: Date.now(),
          paymentIntentId,
          provider: 'checkr',
          candidateId: order.candidateId,
          invitationId: order.invitationId,
          invitationUrl: order.invitationUrl,
          invitationExpiresAt: order.expiresAt,
          tier,
          summary: 'Check your email for the screening link from Checkr. Results usually return within a day of finishing it.',
        },
      },
      { merge: true },
    );
    res.json({ ok: true, ordered: true, invitationUrl: order.invitationUrl });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

/**
 * A new link for a paid screening whose invitation expired unfinished.
 *
 * The money was taken when the first link was sent; letting it dead-end there would make an
 * expired email a kept fee, which it is not. No new payment, same candidate, fresh
 * invitation. Only reachable from the states where it is true — paid, and not completed.
 */
app.post('/operator/screening/reinvite', requireAuth, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  if (!screeningReady()) return res.status(503).json({ error: 'Screening is not live yet' });

  try {
    const userRef = db.collection('users').doc(String(req.uid));
    const snap = await userRef.get();
    const s = snap.exists ? snap.data().screening || {} : {};

    if (!s.paymentIntentId) return res.status(402).json({ error: 'No paid screening on this account' });
    const expired = s.decision === 'expired'
      || (s.decision === 'invited' && Number(s.invitationExpiresAt || 0) > 0 && Number(s.invitationExpiresAt) < Date.now());
    if (!expired) return res.status(409).json({ error: 'The current screening link is still usable', decision: s.decision || null });

    const order = s.candidateId
      ? { candidateId: s.candidateId, ...(await checkr.reinvite({ candidateId: s.candidateId, tier: s.tier || 'full' })) }
      : await checkr.invite({ uid: req.uid, email: req.email, tier: s.tier || 'full' });

    await userRef.set(
      {
        screening: {
          decision: 'invited',
          candidateId: order.candidateId,
          invitationId: order.invitationId,
          invitationUrl: order.invitationUrl,
          invitationExpiresAt: order.expiresAt,
          summary: 'A new screening link is in your email. Nothing more to pay.',
        },
      },
      { merge: true },
    );
    res.json({ ok: true, invitationUrl: order.invitationUrl });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// The screening company's result arrives on /checkr/webhook — mounted ABOVE express.json()
// with the Stripe webhook, because its signature is an HMAC over the raw bytes. The event
// handling itself (fetch the report's screenings, adjudicate by the statutory standard,
// record the decision, handle expired invitations) lives in checkr.js.

// --- The operations view. -----------------------------------------------------------------
mountOps(app, express);

app.get('/scheduled/sweep', runSweep);
app.post('/scheduled/sweep', runSweep);

// --- Telling the other party something happened. ------------------------------------------
//
// body: { rideId, event }  where event is 'assigned' | 'arrived' | 'completed'
//
// WHY AN ENDPOINT AND NOT A SWEEP. Dispatch and the operator's progress are both written to
// Firestore from a phone, so the server does not otherwise learn of them until the next tick.
// A traveler finding out sixty seconds late that their operator has arrived is a worse product
// than one that costs a round trip. The sweep still catches anything this misses — see the
// backstop in the monitor pass — so a lost request delays a notification rather than losing it.
//
// The caller may only announce a travel they are party to, and only ever TO THE OTHER PARTY:
// nobody can use this to send themselves, or anybody else, a message of their choosing. The
// wording is fixed here and takes nothing from the request body.
// --- Dispatch. ----------------------------------------------------------------------------
//
// body: { pickup: {lat,lng}, dep, dest, cls, tripNo, costCents, miles?, feeLines?, excludeIds? }
//
// THE PHONE USED TO DO THIS. It read the whole `operators` collection, ran the match itself,
// and wrote rides/{id} with the operator it had chosen; firestore.rules accepted the write on
// one condition, that `travelerUid` was the signed-in user. Nothing checked the operator.
//
// Three things followed. The screening, insurance and disclosure gates in matching.js guarded
// only the re-offer sweep and scheduled travel — never the booking a traveler actually makes.
// Every operator's live position, plate, insurance expiry and screening status was readable by
// every signed-in account. And each dispatch attempt read every operator document, which is
// billed per read and does not survive a real fleet.
//
// Found in the pre-launch sweep, 19 Sept 2026 (docs/SWEEP-2026-09-19.md, F-A).
//
// The match now happens here, once, against the fleet read with admin access, through the same
// matchOperator every other caller uses — so a gate added to that function protects every path
// at once, which is the whole reason it is a function.
app.post('/travel/dispatch', requireAuth, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });

  const b = req.body || {};
  const pickup = { lat: Number(b.pickup?.lat), lng: Number(b.pickup?.lng) };
  if (!Number.isFinite(pickup.lat) || !Number.isFinite(pickup.lng)) {
    return res.status(400).json({ error: 'A pickup position is required to dispatch.' });
  }
  const tripNo = String(b.tripNo || '').slice(0, 24);
  if (!tripNo) return res.status(400).json({ error: 'A Travel Number is required.' });

  let fleet;
  try {
    const snap = await db.collection('operators').get();
    fleet = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    // "We could not read the fleet" and "nobody is on duty" are different answers and must not
    // render the same — the client draws a retry for one and a wait for the other.
    return res.status(502).json({ error: e.message, code: 'fleet_unreadable' });
  }

  // THE DEMONSTRATION FLEET LIVES HERE NOW, not on the phone.
  //
  // It used to be a constant in src/backend/dispatch.ts, handed out when the collection came
  // back empty. That was the last reason the phone had to write a travel itself — and while
  // any path writes travels from a phone, firestore.rules cannot be closed, and F-A stays
  // open. Moving it here costs three records and closes the argument.
  //
  // EMPTY COLLECTION ONLY, AND NEVER WITH LIVE KEYS. A stand-in is for a database with nobody
  // in it, which is a development environment and a founder demonstration. The moment real
  // money is in play there is no such thing as a stand-in operator.
  if (!fleet.length && keyMode !== 'live') {
    const at = Date.now();
    fleet = [
      { id: 'op1', name: 'Miguel D.', lat: 25.768, lng: -80.1955, car: 'Gray Toyota Camry', plate: 'KTR 4821', classes: ['Standard', 'Pet Friendly'] },
      { id: 'op2', name: 'Sofia R.', lat: 25.776, lng: -80.193, car: 'White Honda Accord', plate: 'LMN 3092', classes: ['Standard'] },
      { id: 'op3', name: 'Nina P.', lat: 25.7654, lng: -80.2196, car: 'Blue Kia Telluride', plate: 'PQR 7741', classes: ['Standard', 'Large Vehicle'] },
    ].map((o) => ({
      ...o,
      available: true,
      // Stamped present, screened and current so they pass the same gates as anybody else.
      // They are stand-ins for somebody on duty, so they have to look like somebody on duty —
      // and only here, where a live key is already excluded.
      onlineAt: at,
      screeningCheckedAt: at,
      disclosureVersion: DISCLOSURE_VERSION,
      demo: true,
    }));
  }

  // Operators who have already declined this travel are never offered it twice.
  const excluded = new Set((Array.isArray(b.excludeIds) ? b.excludeIds : []).map(String));
  const eligible = excluded.size ? fleet.filter((o) => !excluded.has(String(o.id))) : fleet;

  const best = matchOperator(eligible, pickup, String(b.cls || 'Standard'), {
    requireScreening: screeningReady(),
  });
  // NOT AN ERROR. Nobody being free is an ordinary answer and the app has a screen for it.
  if (!best) return res.json({ matched: null });

  const op = best.operator;
  const now = Date.now();
  const ride = {
    travelerUid: String(req.uid),
    travelerName: String(b.travelerName || '').slice(0, 60),
    tripNo,
    // WRITTEN FROM THE SERVER'S OWN MATCH, never from the request. This is the line the whole
    // endpoint exists for.
    operatorId: String(op.id),
    operatorName: op.name || '',
    operatorCar: op.car || '',
    operatorPlate: op.plate || '',
    operatorLat: Number(op.lat),
    operatorLng: Number(op.lng),
    operatorEtaMin: etaMinutes(best.miles),
    operatorMiles: best.miles,
    operatorDemo: !!op.demo,
    dep: String(b.dep || '').slice(0, 60),
    dest: String(b.dest || '').slice(0, 60),
    // The sweep that rescues an unanswered travel searches from here. Leaving it out silently
    // disabled that path once before.
    pickupLat: pickup.lat,
    pickupLng: pickup.lng,
    travelClass: String(b.cls || 'Standard'),
    costCents: Number(b.costCents) || 0,
    miles: Number(b.miles) || null,
    feeLines: Array.isArray(b.feeLines) ? b.feeLines.slice(0, 8) : [],
    status: 'assigned',
    createdAt: now,
    statusAt: now,
  };

  try {
    const ref = await db.collection('rides').add(ride);
    res.json({
      rideId: ref.id,
      matched: {
        id: String(op.id),
        name: op.name || '',
        car: op.car || '',
        plate: op.plate || '',
        lat: Number(op.lat),
        lng: Number(op.lng),
        etaMin: etaMinutes(best.miles),
        miles: best.miles,
        demo: !!op.demo,
      },
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// --- Who can bring a lost item back. -------------------------------------------------------
//
// body: { operatorId?, point: {lat,lng}, excludeId? }
//
// THE LAST REASON A PHONE READ THE FLEET. src/backend/dispatch.ts exported availableOperator
// and nearestAvailable for the lost-item return, and both called loadFleet() — which pulled
// every operator document to the phone: position, plate, insurance expiry, screening status,
// for every operator, to answer a question about one.
//
// The decision is made here now and the answer carries a name, a position and nothing else.
// The position is returned because the return travel is priced from it, and it is one
// operator the traveler is already dealing with rather than the fleet.
// POST /voice/token — permission to join the call on ONE travel, for the party who is on it.
//
// THE GATE IS THE WHOLE POINT OF THIS ROUTE. Twilio will connect anybody holding a valid
// token, so the question "may this person call this person" is answered HERE, against the
// travel record, before a token exists. A signed-in stranger asking for a travel number they
// are not on gets nothing.
//
// AND ONLY WHILE THE TRAVEL IS LIVE. A completed travel's parties stop being able to ring each
// other — the lost-item path is how somebody reaches an operator afterwards, and it goes
// through us. A call channel that outlives the journey is a way to contact a stranger whose
// car you once sat in, which is not a feature.
app.post('/voice/token', requireAuth, async (req, res) => {
  if (!voiceReady()) return res.status(503).json({ error: voiceReason(), code: 'voice_not_configured' });
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });

  const tripNo = String(req.body?.tripNo || '').trim();
  if (!tripNo) return res.status(400).json({ error: 'tripNo is required' });

  let ride;
  try {
    const snap = await db.collection('rides').doc(tripNo).get();
    if (!snap.exists) return res.status(404).json({ error: 'No such travel', code: 'no_travel' });
    ride = snap.data() || {};
  } catch (e) {
    return res.status(502).json({ error: e.message, code: 'travel_unreadable' });
  }

  // Which side is asking — decided from the record, never from the request body.
  const side =
    String(ride.travelerUid || '') === String(req.uid) ? 'traveler'
      : String(ride.operatorUid || ride.operatorId || '') === String(req.uid) ? 'operator'
        : null;
  if (!side) return res.status(403).json({ error: 'You are not on that travel', code: 'not_your_travel' });

  const LIVE = ['assigned', 'accepted', 'arrived', 'onboard'];
  if (!LIVE.includes(String(ride.status || ''))) {
    return res.status(409).json({ error: 'That travel is not underway', code: 'travel_not_live' });
  }

  const out = voiceToken({ tripNo, side });
  if (!out.ok) return res.status(503).json({ error: out.error, code: out.code });
  return res.json({ token: out.token, identity: out.identity, side });
});

// POST /voice/connect — the TwiML Twilio fetches when a party places the call.
//
// TWILIO POSTS WHATEVER THE DEVICE DIALLED AND IT IS IGNORED. The destination is derived from
// the travel and the caller's own identity, so a tampered app cannot dial an arbitrary number
// through our account — which would be our telephone bill and somebody else's harassment.
app.post('/voice/connect', (req, res) => {
  const from = String(req.body?.From || '');
  // 'ar_AR-2048-MIA_traveler' — the identity the token was minted with, which Twilio supplies
  // and the device cannot choose.
  const m = /^(?:client:)?ar_(.+)_(traveler|operator)$/.exec(from);
  if (!m) return res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>');
  return res.type('text/xml').send(connectTwiml({ tripNo: m[1], side: m[2] }));
});

app.post('/travel/return-operator', requireAuth, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });

  const b = req.body || {};
  const point = { lat: Number(b.point?.lat), lng: Number(b.point?.lng) };
  const originalId = String(b.operatorId || '');

  let fleet;
  try {
    const snap = await db.collection('operators').get();
    fleet = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    return res.status(502).json({ error: e.message, code: 'fleet_unreadable' });
  }

  // The operator who drove the travel is tried first, and is held to the same gates as
  // anybody else — a lost item does not entitle somebody to dispatch an operator whose
  // insurance has lapsed or whose disclosure has moved on.
  const strip = (o, miles) => ({
    id: String(o.id), name: o.name || '',
    lat: Number(o.lat), lng: Number(o.lng),
    ...(miles == null ? {} : { miles }),
  });

  if (originalId) {
    const still = matchOperator(
      fleet.filter((o) => String(o.id) === originalId),
      Number.isFinite(point.lat) ? point : { lat: Number(fleet[0]?.lat) || 0, lng: Number(fleet[0]?.lng) || 0 },
      'Standard',
      { requireScreening: screeningReady() },
    );
    if (still) return res.json({ path: 'original-operator', operator: strip(still.operator) });
  }

  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    return res.json({ path: null, operator: null });
  }
  const next = matchOperator(
    fleet.filter((o) => String(o.id) !== originalId),
    point,
    'Standard',
    { requireScreening: screeningReady() },
  );
  if (!next) return res.json({ path: null, operator: null });
  res.json({ path: 'any-operator', operator: strip(next.operator, next.miles) });
});

// --- Verifying a mobile number. ------------------------------------------------------------
//
// POST /verify/start  { phone }          -> { ok } | { error, code }
// POST /verify/check  { phone, code }    -> { ok, phone } | { error, code }
//
// AUTHENTICATED, DELIBERATELY. A traveler verifies their OWN number after signing in, which is
// what makes this cheap to protect: an open endpoint that sends an SMS on request is somebody
// else's phone bill and a way to harass a stranger's handset.
//
// THIS COMMENT USED TO END "Twilio rate-limits per number; requireAuth rate-limits per
// account." THE SECOND HALF WAS FALSE. requireAuth authenticates and does nothing else, so
// one signed-in account could ask for unlimited SMS — each one billed to us at about six
// cents, and each one a message somebody did not ask for. A comment asserting a control that
// does not exist is the most dangerous shape a comment can take: it answers the question
// nobody then goes and checks.
//
// Twilio does rate-limit per number, which is real and is the half that was true. The per
// account limit now exists as well, and it is deliberately tight — a real traveler verifies
// once, twice if the first message is slow.
//
// THE RESULT IS WRITTEN BY THE SERVER, never by the phone. `users/{uid}.phoneVerified` is
// exactly the shape of field that firestore.rules now refuses a client (see the users block
// there, and docs/SWEEP-2026-09-19.md F-D): a value the gated party could write is not a gate.
app.post('/verify/start', requireAuth, LIMITS.verify, async (req, res) => {
  if (!verifyReady()) {
    return res.status(503).json({ error: 'Phone verification is not configured.', code: 'not_configured' });
  }
  const out = await startVerification(req.body?.phone);
  if (!out.ok) {
    if (out.detail) console.error('[verify] start', out.code, out.detail);
    return res.status(out.code === 'bad_number' ? 400 : 502).json({ error: out.reason, code: out.code });
  }
  res.json({ ok: true });
});

app.post('/verify/check', requireAuth, LIMITS.verify, async (req, res) => {
  if (!verifyReady()) {
    return res.status(503).json({ error: 'Phone verification is not configured.', code: 'not_configured' });
  }
  const out = await checkVerification(req.body?.phone, req.body?.code);
  if (!out.ok) {
    if (out.detail) console.error('[verify] check', out.code, out.detail);
    return res.status(out.code === 'wrong_code' || out.code === 'expired' ? 400 : 502)
      .json({ error: out.reason, code: out.code });
  }

  // RECORDED AGAINST THE ACCOUNT, in the normalised form. Storing what the person typed would
  // mean two records of the same number in different shapes, and the one an operator rings
  // would be whichever was written last.
  const db = adminDb();
  if (db) {
    try {
      await db.collection('users').doc(String(req.uid)).set(
        { mobile: out.to, phoneVerified: true, phoneVerifiedAt: Date.now() },
        { merge: true },
      );
    } catch (e) {
      // The number IS verified — Twilio said so. Failing to write that down is our problem to
      // log, not a reason to tell the traveler their correct code was wrong.
      console.error('[verify] could not record verification', e.message);
    }
  }
  res.json({ ok: true, phone: out.to });
});

app.post('/travel/announce', requireAuth, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });

  const rideId = String(req.body?.rideId || '');
  const event = String(req.body?.event || '');
  if (!rideId || !['assigned', 'arrived', 'completed'].includes(event)) {
    return res.status(400).json({ error: 'rideId and a known event are required' });
  }

  try {
    const ref = db.collection('rides').doc(rideId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'No such travel' });
    const ride = snap.data();
    if (String(ride.travelerUid) !== String(req.uid) && String(ride.operatorId) !== String(req.uid)) {
      return res.status(403).json({ error: 'That travel is not yours' });
    }

    const trip = ride.tripNo || '';
    let sent;
    if (event === 'assigned') {
      // To the OPERATOR. This is the notification the whole operator loop rested on and did
      // not have: an operator with the app in their pocket had no way to learn a travel had
      // been dispatched to them, and the request declined itself after fifteen seconds.
      sent = await notify({
        uid: ride.operatorId,
        kind: 'travel_assigned',
        title: 'Travel assigned',
        body: `${ride.dep || 'Pickup'} to ${ride.dest || 'destination'}. Open to accept.`,
        data: { screen: '/operator', rideId, tripNo: trip },
      });
      await ref.set({ notifiedOperatorAt: Date.now() }, { merge: true });
    } else if (event === 'arrived') {
      sent = await notify({
        uid: ride.travelerUid,
        kind: 'operator_arrived',
        title: 'Your operator has arrived',
        body: `${ride.operatorName || 'Your operator'} is at ${ride.dep || 'your pickup'}.`,
        data: { screen: '/ride', rideId, tripNo: trip },
      });
    } else {
      sent = await notify({
        uid: ride.travelerUid,
        kind: 'travel_complete',
        title: 'Travel complete',
        body: `${ride.dest || 'Your destination'}. Your receipt is ready.`,
        data: { screen: '/receipt', rideId, tripNo: trip },
      });
    }
    res.json({ ok: true, delivered: !!sent?.ok, reason: sent?.reason || null });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// --- Route monitoring: the answer to a check-in. -------------------------------------------
//
// body: { rideId, reply }
//   an OPERATOR sends free text — why the vehicle is stopped — which the monitor reads.
//   a TRAVELER sends 'ok' or 'help', and nothing else. A traveler being asked whether they are
//   alright must be able to answer in one tap, and a free-text box in that moment is a worse
//   question than no question. 'help' opens a case on the next tick without waiting.
//
// Written HERE rather than from the phone because these fields decide whether a case is
// opened. Firestore rules keep them unwritable from either app, so neither party can clear a
// concern raised about the other.
app.post('/travel/check-in', requireAuth, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });

  const rideId = String(req.body?.rideId || '');
  const reply = String(req.body?.reply || '').slice(0, 600).trim();
  if (!rideId || !reply) return res.status(400).json({ error: 'rideId and reply are required' });

  try {
    const ref = db.collection('rides').doc(rideId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'No such travel' });
    const ride = snap.data();

    const isOperator = String(ride.operatorId) === String(req.uid);
    const isTraveler = String(ride.travelerUid) === String(req.uid);
    if (!isOperator && !isTraveler) {
      return res.status(403).json({ error: 'That travel is not yours' });
    }

    const m = ride.monitor || {};
    if (isOperator) {
      // Cleared so the monitor reads THIS answer rather than skipping it as already read.
      await ref.set(
        { monitor: { ...m, operatorReply: reply, operatorReplyAt: Date.now(), operatorReplyReadAt: null } },
        { merge: true },
      );
    } else {
      const answer = reply === 'help' ? 'help' : 'ok';
      await ref.set(
        { monitor: { ...m, travelerReply: answer, travelerReplyAt: Date.now() } },
        { merge: true },
      );
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// --- A page that is not there. ---------------------------------------------------------------
//
// Express's own 404 is 139 bytes of black text reading "Error". On americanrider.app that is
// the first thing some people will ever see of this company. It gets the letterhead, the same
// card and the same voice as every other page — and it states what happened without apologising
// for it.
//
// LAST, deliberately, so it can only catch what nothing above matched. JSON for anything that
// is not a browser asking for a page, so an app calling a wrong endpoint still gets an error it
// can read.
app.use((req, res) => {
  if (req.method !== 'GET' || !(req.get('accept') || '').includes('text/html')) {
    return res.status(404).json({ error: 'No such endpoint', path: req.path });
  }
  res.status(404).type('html').send(
    page(
      'Page not found',
      `<h1>Page not found</h1>
       <p class="lede">There is nothing at ${String(req.path).replace(/[<>&"]/g, '')}.</p>
       <section>
         <h2>Where to go</h2>
         <p><a href="/">American Rider</a> · <a href="/travel">Travel</a> ·
            <a href="/operate">Operate</a> · <a href="/safety">Safety</a> ·
            <a href="/support">Support</a></p>
       </section>`,
    ),
  );
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`American Rider server listening on http://localhost:${PORT}  (Stripe: ${keyMode})`);
  // Started AFTER the port is open: a sweep that runs while the process is still booting can
  // take the whole thing down before it has ever answered /health.
  //
  // SIXTY SECONDS is the resolution of both features. A reservation is served at most a minute
  // after its ideal dispatch moment, which is inside the arrival padding; a stopped vehicle is
  // noticed at most a minute after six, which is inside the margin of "a long light".
  // `unref()` so the interval never holds a test process open.
  const tick = setInterval(() => {
    runAllSweeps()
      .then((r) => {
        lastSweep = { at: Date.now(), report: r };
      })
      .catch(() => {});
  }, 60 * 1000);
  if (typeof tick.unref === 'function') tick.unref();
  console.log('Scheduled travel + route monitoring: sweeping every 60s (also GET /scheduled/sweep)');
});
