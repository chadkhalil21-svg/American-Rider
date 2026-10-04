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
  quote, createPaymentIntent, resumePaymentIntent, verifiedTravelPayment, cancelUnpaidIntent, chargeRide, refundTravel,
  connectAccountFor, connectOnboardingLink, connectAccountStatus,
  transferToOperator, refundableFor, connectDashboardLink, pingStripe, probeNetwork,
  transferFixed, operatorPayoutAccount,
  listPaymentMethods, createSetupIntent, setDefaultPaymentMethod, detachPaymentMethod,
  defaultCardCountry, chargeOperatorAccountFee,
} = require('./payments');
const { readKey } = require('./env');
const { requireAuth, requireFreshAuth, attachAuth, requireVerifiedEmail } = require('./auth');
const { perAccount, countOnly, perIp } = require('./ratelimit');
const { marketFor, servesPoint, listMarkets, markets: allMarkets } = require('./markets');
const { forMarket: insuranceForMarket, publicConfig: publicInsuranceConfig } = require('./insurance-jurisdictions');
const { manifestFor, inspectMarket, recordEvidence, activateMarket, authorizeOnboarding, pauseMarket } = require('./market-readiness');
const { setAdmittedFleetOnline, deactivateMarketFleet, sweepPausedMarketFleet } = require('./market-fleet');
const { marketChecklistPage } = require('./market-readiness-ui');

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
  // COST CONTROLS (22 Sept 2026). Each of these calls something that costs money or reaches a
  // third party: screening support workflow, Stripe, push notifications; document OCR runs locally,
  // the routers. The client cannot be trusted to hold back, so the server does. Generous for a
  // real person — nobody photographs a licence 20 times an hour — and a hard stop for a loop.
  document: perAccount({ name: 'document', limit: 20, windowMs: 60 * 60 * 1000 }),
  screening: perAccount({ name: 'screening', limit: 10, windowMs: 60 * 60 * 1000 }),
  payments: perAccount({ name: 'payments', limit: 60, windowMs: 60 * 60 * 1000 }),
  connect: perAccount({ name: 'connect', limit: 20, windowMs: 60 * 60 * 1000 }),
  dispatch: perAccount({ name: 'dispatch', limit: 30, windowMs: 60 * 60 * 1000 }),
  announce: perAccount({ name: 'announce', limit: 60, windowMs: 60 * 60 * 1000 }),
  voice: perAccount({ name: 'voice', limit: 30, windowMs: 60 * 60 * 1000 }),
  market: perAccount({ name: 'market', limit: 20, windowMs: 60 * 60 * 1000 }),
  // Each status check asks Firebase Auth and Stripe; the review screen polls every 30 seconds.
  qualification: perAccount({ name: 'qualification', limit: 240, windowMs: 60 * 60 * 1000 }),
  waitlist: perAccount({ name: 'waitlist', limit: 5, windowMs: 24 * 60 * 60 * 1000 }),
  quoteIp: perIp({ name: 'quote', limit: 300, windowMs: 60 * 60 * 1000 }),
  routeIp: perIp({ name: 'route', limit: 300, windowMs: 60 * 60 * 1000 }),
  placeSearchIp: perIp({ name: 'place-search', limit: 600, windowMs: 60 * 60 * 1000 }),
};
const { authoritativeFare } = require('./fareauthority');
const { outsideMarket, outsideMarketMessage } = require('./market');
const { permitRequired, permitRequiredMessage } = require('./fees');
const { destinationsNear } = require('./places');
const { searchPlaces } = require('./place-search');
const { ready: voiceReady, reason: voiceReason, accessToken: voiceToken, connectTwiml } = require('./voice');
const { REGIONS, defaultRegion } = require('./regions');
const { presenceStale, coverageLapsed, matchOperator, etaMinutes } = require('./matching');
const { encodeGeohash, nearbyOperatorCandidates } = require('./geooperators');
// DISCLOSURE IS IMPORTED FOR .statute, and leaving it out is how the acknowledge route below
// threw `DISCLOSURE is not defined` for a day — every operator who read the disclosure was
// refused when they said so, and could not go on duty. The 25 disclosure tests all passed:
// they exercise disclosure.js directly and never call this route. Same class of wiring defect as an orphaned backend path
// and the screening gate — written at both ends, unwired at the point that consumes it.
const {
  DISCLOSURE, DISCLOSURE_VERSION, disclosureFor, disclosureCurrent,
} = require('./disclosure');
const { translationFor, DISCLOSURE_LANGUAGES } = require('./disclosure-i18n');
const { issueFollowToken, travelForToken, followPage } = require('./follow');

// WHERE A SHARED LINK POINTS. The custom domain, because a contact opening
// american-rider-server.onrender.com in a moment of worry has no way to tell it from a
// phishing page. PUBLIC_ORIGIN overrides it for local work.
const PUBLIC_ORIGIN = (readKey('PUBLIC_ORIGIN') || 'https://americanrider.app').replace(/\/$/, '');
const { fetchRoute } = require('./routes');
const { resolveIssue, supportMessage, replySender, MAX_OUT_OF_POCKET_CENTS } = require('./support');
const { resolveOperatorIssue } = require('./operatorsupport');
const { fileTicket, updateTicketLocation, listTickets, resolveTicket } = require('./tickets');
const { lostItemTicket, stampLostItemCase, notifyLostItemOperators, operatorLostItem, respondLostItem } = require('./lostitem');
const { adminDb, adminStatus, accountDisabled } = require('./firebase-admin');
const { closeOperationalAccount } = require('./accountclosure');
const { acceptOffer } = require('./eligibility');
const { bookingId, prepareBooking, paymentMatches, assignPaidTravel } = require('./booking');
const { progressTravel } = require('./travelprogress');
const { payForTravel, cancelTravel: cancelTravelFor, settleTravel: settleTravelFor } = require('./travelmoney');
const { authorizeVoiceTravel, lostItemTravel, authorizeAnnouncement, claimAnnouncement } = require('./trustboundaries');
const { TERMS_HTML, PRIVACY_HTML, ABOUT_HTML, legalPage, LEGAL_LANGUAGES } = require('./legal');
const {
  HOME_HTML, OPERATE_HTML, SUPPORT_HTML, TRAVEL_HTML, SAFETY_HTML, SMART_HTML,
} = require('./site');
const { smartQuote, revalidateTransit } = require('./smart');
const { transitHealth } = require('./transit');
const { sweepScheduled, sweepSettlements } = require('./scheduler');
const { sweepBookingRecovery } = require('./bookingrecovery');
const { sweepMonitor, sweepAssignments } = require('./monitor');
const { notify } = require('./push');
const { handleEvent, webhookReady } = require('./webhook');
const { enqueueProviderEvent, processProviderEvent, sweepProviderEvents, replayDeadEvent } = require('./providerqueue');
const { acquireLease, renewLease, releaseLease, DEFAULT_LEASE_MS } = require('./schedulerlease');
const { sweepOperatorAccountFees } = require('./operatorfees');
const crypto = require('node:crypto');
const WORKER_ID = crypto.randomUUID();
const { send, receiptEmail, emailReady: mailReady } = require('./email');
const { mount: mountOps, opsAuthMode, signedIn: opsSignedIn, actorOf: opsActorOf } = require('./ops');
const { readDocument, documentsReady, READER_VERSION } = require('./documents');
const { ready: r2Ready, uploadUrl: r2UploadUrl, readUrl: r2ReadUrl, owns: r2Owns } = require('./r2');
const { assessOperator, assessAndRecord } = require('./qualification');
const {
  STATUS_DUE_MS, STATUS_MAX_AGE_MS,
  initialMonitoringFromDocument, continuingStatus, applyOperatorAttestation, applyIndependentConfirmation,
  providerInstructions, sweepInsuranceMonitoring,
} = require('./insurance-monitoring');
const { normalizeParty, operatorPartyView } = require('./travelparty');
const family = require('./family');
const { provisionTeenPin, verifyTeenPin, teenPinReady, pinForRide } = require('./teenpickup');
const { listPlatformMessages, markPlatformMessageRead } = require('./platforminbox');
const { page } = require('./shell');
const { screeningReady, screeningCurrent, sweepScreening } = require('./screening');
const { runMarketReferenceSweep, firestoreReady: marketReferenceReady } = require('./market-reference-service');
const { configuredCollectors: marketReferenceCollectors } = require('./market-evidence-collectors');

const app = express();

// Reuse the same signed, named Operations session as the /ops console. This route changes
// support-case state, so ordinary Firebase authentication is not sufficient authority.
function requireOps(req, res, next) {
  const name = opsSignedIn(req);
  if (!name) return res.status(401).json({ error: 'Operations sign-in required' });
  req.opsUser = name;
  req.opsActor = opsActorOf(req);
  return next();
}
// One proxy in front (Render). Makes req.ip the caller rather than the proxy, which the
// per-address limits in ratelimit.js need.
app.set('trust proxy', 1);
// --- Stripe's webhook. MOUNTED BEFORE express.json(), and that order is load-bearing. -------
//
// A signature is computed over the EXACT bytes Stripe sent. Once express.json() has parsed and
// re-serialised the body, those bytes are gone and every event fails verification — which is
// the classic way this endpoint ends up either broken or, worse, "fixed" by skipping the check.
const PROVIDER_HANDLERS = { stripe: handleEvent };

async function acceptDurableProviderEvent(provider, event, res) {
  const queued = await enqueueProviderEvent({ provider, event });
  // No durable write means no acknowledgement. The provider will retry instead of us losing
  // an event in a process crash or Firestore outage.
  if (!queued.ok) return res.status(503).json({ error: queued.reason || 'event queue unavailable' });
  res.json({ received: true, type: event?.type || 'unknown', duplicate: !!queued.duplicate });
  processProviderEvent({ id: queued.id, handlers: PROVIDER_HANDLERS, workerId: WORKER_ID })
    .then((out) => console.log(`[${provider}] ${event?.type}: ${out.result?.action || out.reason || (out.skipped ? 'already claimed' : 'processed')}`))
    .catch((e) => console.log(`[${provider}] ${event?.type} failed: ${e.message}`));
}

app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = readKey('STRIPE_WEBHOOK_SECRET');
  if (!secret) return res.status(503).json({ error: 'STRIPE_WEBHOOK_SECRET is not set' });
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(req.body, req.get('stripe-signature'), secret);
  } catch (e) {
    return res.status(400).json({ error: `Signature verification failed: ${e.message}` });
  }
  return acceptDurableProviderEvent('stripe', event, res);
});

app.post('/stripe/connect-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = readKey('STRIPE_CONNECT_WEBHOOK_SECRET');
  if (!secret) return res.status(503).json({ error: 'STRIPE_CONNECT_WEBHOOK_SECRET is not set' });
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(req.body, req.get('stripe-signature'), secret);
  } catch (e) {
    return res.status(400).json({ error: `Signature verification failed: ${e.message}` });
  }
  return acceptDurableProviderEvent('stripe', event, res);
});


app.use(express.json()); // parse JSON request bodies — everything BELOW the webhook

// WHICH WORLD IS THIS SERVER IN? Read from the key's own prefix, and cover all four forms
// Stripe issues — a RESTRICTED key (rk_live_ / rk_test_) is the safer thing to deploy, since
// it can be scoped to just PaymentIntents, refunds, balance and Connect transfers. The first
// version of this line checked only `sk_live_`, so a restricted live key would have run real
// money while /health reported "test" and the app told travelers nothing was being charged.
const KEY = readKey('STRIPE_SECRET_KEY');
const keyMode = /^(sk|rk)_live_/.test(KEY) ? 'live' : /^(sk|rk)_test_/.test(KEY) ? 'test' : 'no-key';
const DEPLOYMENT_MODE = String(readKey('DEPLOYMENT_MODE') || 'development').toLowerCase();
const declaredProduction = DEPLOYMENT_MODE === 'production';
// A live Stripe credential is itself a production posture. This prevents an omitted or mistyped
// DEPLOYMENT_MODE from allowing real-money operation around the full readiness gate.
const productionMode = declaredProduction || keyMode === 'live';
const operationalMode = productionMode;

// Native apps do not depend on browser CORS. Browser clients do, so production permits only
// American Rider's own web origins. Development remains open for Expo/local tooling.
const CORS_ORIGINS = new Set(
  String(readKey('CORS_ORIGINS') || 'https://americanrider.app,https://www.americanrider.app')
    .split(',').map((s) => s.trim()).filter(Boolean),
);
app.use(cors({
  origin(origin, callback) {
    if (!productionMode || !origin || CORS_ORIGINS.has(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  },
}));

function productionReadiness() {
  const missing = [];
  if (!['development', 'production'].includes(DEPLOYMENT_MODE)) missing.push('deployment_mode');
  if (keyMode !== 'live') missing.push('stripe_live_key');
  if (!readKey('STRIPE_PUBLISHABLE_KEY')) missing.push('stripe_publishable_key');
  if (!readKey('STRIPE_WEBHOOK_SECRET')) missing.push('stripe_webhook_secret');
  if (!readKey('STRIPE_CONNECT_WEBHOOK_SECRET')) missing.push('stripe_connect_webhook_secret');
  if (!screeningReady()) missing.push('screening_provider');
  if (!readKey('HERE_API_KEY')) missing.push('toll_provider');
  if (!readKey('SCHEDULER_TOKEN')) missing.push('scheduler_token');
  if (!adminStatus().ok) missing.push('firebase_admin');
  if (!marketReferenceReady()) missing.push('market_reference_store');
  if (opsAuthMode() !== 'named') missing.push('ops_auth');
  return { ready: !productionMode || missing.length === 0, missing };
}

function requireOperationalReadiness(req, res, next) {
  const state = productionReadiness();
  if (!state.ready) return res.status(503).json({
    error: 'American Rider production services are not operationally ready.',
    code: 'production_not_ready',
    missing: state.missing,
  });
  return next();
}

// Every consequential new booking checks the durable market admission document. This is
// intentionally NOT cached: a carrier lapse or Operations pause must prevent new money.
// Existing emergency, cancellation, refund, settlement and already-running Travels stay open.
async function admittedMarket(market) {
  const region = market?.regionId ? REGIONS.find((r) => r.id === market.regionId) : null;
  return inspectMarket({ db: adminDb(), market, region, providerMissing: productionReadiness().missing });
}
async function requireAdmittedPickup(req, res, next) {
  if (!productionMode) return next();
  const point = req.body?.pickup;
  const market = marketFor(point);
  if (!market || market.status !== 'active') return res.status(409).json({ code: 'market_waitlist', error: 'Travel is not available in this market yet.' });
  const state = await admittedMarket(market);
  if (state.status !== 'active') return res.status(409).json({ code: 'market_waitlist', error: 'Travel is not available in this market yet.', marketId: market.id });
  return next();
}
async function requireAdmittedTravel(req, res, next) {
  if (!productionMode) return next();
  const db = adminDb();
  if (!db) return res.status(503).json({ code: 'market_admission_unavailable' });
  try {
    const snap = await db.collection('rides').doc(String(req.body?.rideId || '')).get();
    if (!snap.exists || String(snap.data().travelerUid || '') !== String(req.uid)) return res.status(404).json({ code: 'no_travel' });
    const ride = snap.data();
    const market = marketFor({ lat: ride.pickupLat, lng: ride.pickupLng });
    const state = await admittedMarket(market);
    if (state.status !== 'active') return res.status(409).json({ code: 'market_waitlist', error: 'New charges and offers are paused in this market.' });
    return next();
  } catch {
    return res.status(503).json({ code: 'market_admission_unavailable' });
  }
}

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
//   1. { destination: '<configured place>' }          -> the fixed FARES table (development fixtures)
//   2. { pickup: {lat,lng}, dest: {lat,lng} }         -> distance-based (authoritative operational path)
// Coordinates win when both are present, because they describe a real trip rather than a label.
// Returns { travelCostCents, miles|null, pricedBy, governmentFees } or null if we cannot price it.
// `governmentFees` (fees.js) are fenced from THE SAME COORDINATES the price comes from — a fee
// computed from any other point would be a second opinion about where the travel is.
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
  const readiness = productionReadiness();

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
      // Aggregation counts do not download every Operator document. Dispatchable eligibility
      // is intentionally not approximated here: it is a per-Operator authority decision.
      const [allCount, availableCount] = await Promise.race([
        Promise.all([
          adminDb().collection('operators').count().get(),
          adminDb().collection('operators').where('available', '==', true).count().get(),
        ]),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error('fleet count timed out')), FLEET_READ_TIMEOUT_MS).unref(),
        ),
      ]);
      fleet = {
        operators: allCount.data().count,
        available: availableCount.data().count,
        dispatchable: null,
        reason: 'dispatchable count is evaluated at bounded geographic dispatch, not by scanning the fleet',
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
    deployment: DEPLOYMENT_MODE,
    operationalReady: readiness.ready,
    operationalMissing: readiness.missing,
    scheduler: readKey('SCHEDULER_TOKEN') ? 'authenticated' : 'off',
    tolls: readKey('HERE_API_KEY') ? 'on' : 'off',
    marketReference: marketReferenceReady() ? 'scheduler-on' : 'off',
    receipts: mailReady() ? 'on' : 'off',
    // NO PROVIDER MEANS NOBODY CAN BE COMMISSIONED. Every operator sits at
    // `awaiting_provider`, which is deliberately not a pass and not dispatchable — so an
    // empty fleet would otherwise look like nobody had applied.
    screening: screeningReady() ? 'on' : 'off',
    // Reading an operator's licence, registration, inspection and insurance. `off` means every
    // document falls to 'review' — never to 'accept'.
    documents: documentsReady() ? 'on' : 'off',
    insuranceDisclosure: DISCLOSURE_VERSION,
    // How /ops is signed in to: 'named' is the production answer.
    opsAuth: opsAuthMode(),
    // Where travel is sold and operators are onboarded (backend/markets.js).
    markets: await publicMarkets(),
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
app.get('/config', async (req, res) => {
  const readiness = productionReadiness();
  const activeMarkets = (await publicMarkets()).some((m) => m.status === 'active');
  res.json({
    stripePublishableKey: readKey('STRIPE_PUBLISHABLE_KEY') || null,
    mode: keyMode,
    // Managing a saved method is a Stripe capability, not a whole-platform capability.
    // Screening, HERE, scheduler, market-reference and Ops readiness must never disable Wallet.
    // A Travel charge remains stricter: create-payment-intent is still protected by
    // requireOperationalReadiness below.
    canManagePaymentMethods: keyMode !== 'no-key' && !!readKey('STRIPE_PUBLISHABLE_KEY'),
    // Charging/reserving remains fail-closed on the complete operational gate.
    canTakePayment: readiness.ready && activeMarkets && keyMode !== 'no-key' && !!readKey('STRIPE_PUBLISHABLE_KEY'),
    operationalReady: readiness.ready,
  });
});

// Stop all future operational work before the phone deletes the Firebase login. This route
// deliberately does not delete retained transport or payment records: their retention needs a
// policy. It does cancel scheduled Travel and remove an Operator from service, so account
// deletion cannot cause a later dispatch or charge under a login that no longer exists.
app.post('/account/close', requireAuth, async (req, res) => {
  try {
    const out = await closeOperationalAccount({ db: adminDb(), uid: req.uid });
    if (!out.ok) {
      const status = out.code === 'active_travel' ? 409 : 503;
      return res.status(status).json({
        code: out.code,
        error: out.code === 'active_travel'
          ? 'Complete or cancel the current Travel before closing this account.'
          : 'Account closure is not available at this time.',
      });
    }
    return res.json(out);
  } catch (e) {
    console.error('[account] close failed:', e.message);
    return res.status(503).json({ code: 'account_close_failed', error: 'Account closure is not available at this time.' });
  }
});

// --- Legal pages: linked from the app's sign-up screen ("By continuing, you agree…"). ------
// Served here so they are real, live web pages with no separate hosting to manage.
// --- The public website. -------------------------------------------------------------------
//
// THE DEFECT THIS CLOSES, and it is the same class as an unwired money path. backend/site.js was written,
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
app.post('/travel/follow-link', requireAuth, LIMITS.announce, async (req, res) => {
  try {
    const token = await issueFollowToken({
      rideId: String(req.body?.rideId || ''),
      travelerUid: req.uid,
      guardianUid: req.uid,
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
    // A refund is bound to an authoritative Travel, not merely to *some* Stripe payment owned
    // by this Traveler. Otherwise a caller with Travels A and B could file about A while
    // supplying B's PaymentIntent. The phone supplies only rideId; ownership and payment id
    // come back out of Firestore.
    const db = adminDb();
    const rideId = String(req.body?.rideId || trip?.rideId || '');
    let refundRide = null;
    let refundRideRef = null;
    if (db && rideId) {
      refundRideRef = db.collection('rides').doc(rideId);
      const snap = await refundRideRef.get();
      const r = snap.exists ? snap.data() || {} : null;
      if (r && String(r.travelerUid || '') === String(req.uid)) refundRide = r;
    }
    if (!refundRide?.paymentIntentId) {
      decision = {
        action: 'escalate',
        message: decision.message,
        reason: 'Automatic credit approved but no authoritative owned Travel payment could be verified.',
        forced: true,
      };
    } else {
    const refund = await refundTravel({
      paymentIntentId: refundRide.paymentIntentId,
      amountCents: decision.credit_cents,
      expectUid: req.uid,
      idempotencyKey: `ar_support_refund_${rideId}`,
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
      if (refundRideRef) await refundRideRef.set({ supportRefundId: refund.refundId, supportRefundedCents: refund.amountCents, supportRefundedAt: Date.now() }, { merge: true });
      return res.json({ ...decision, refunded: true, refundId: refund.refundId });
    }
    decision = {
      action: 'escalate',
      message: decision.message,
      reason: `Credit of ${decision.credit_cents}c approved but not issued: ${refund.error}`,
      forced: true,
    };
    }
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

// Operations closes a human case only after the work is actually complete. The Traveler
// sees this stored status through /support/cases; there is no client-side “resolved” switch.
app.post('/ops/support/cases/:caseNo/resolve', requireOps, async (req, res) => {
  const out = await resolveTicket({
    caseNo: req.params.caseNo,
    resolution: req.body?.resolution,
    actor: req.opsUser || req.user?.email || 'operations',
  });
  return res.status(out.ok ? 200 : out.reason === 'not found' ? 404 : 400).json(out);
});

app.get('/ops/provider-events/dead', requireOps, async(req,res)=>{
  const db=adminDb();if(!db)return res.status(503).json({error:adminStatus().reason});
  try{
    const snap=await db.collection('provider_events').where('status','==','dead').orderBy('deadAt','desc').limit(50).get();
    return res.json({events:snap.docs.map((d)=>({id:d.id,provider:d.data().provider,
      eventId:d.data().eventId,attempts:d.data().attempts,lastError:d.data().lastError,
      receivedAt:d.data().receivedAt,deadAt:d.data().deadAt})),saturated:snap.docs.length===50});
  }catch{return res.status(503).json({error:'Dead-letter inbox is unavailable'});}
});
app.post('/ops/provider-events/:id/replay',requireOps,async(req,res)=>{
  try{const out=await replayDeadEvent({id:req.params.id,actor:req.opsUser});
    return res.status(out.ok?200:409).json(out);
  }catch{return res.status(503).json({error:'Provider event replay is unavailable'});}
});

// Family / Teen Travel: guardian-created relationship, accepted by the teen account.
app.get('/family', requireAuth, async (req,res)=>{const out=await family.listFamilyLinks({uid:req.uid});return res.status(out.ok?200:503).json(out);});
app.get('/family/travels', requireAuth, async (req,res)=>{
 const out=await family.listGuardianActiveTravels({guardianUid:req.uid});if(!out.ok)return res.status(503).json(out);
 const travels=[];for(const r of out.travels){const token=await issueFollowToken({rideId:r.id,travelerUid:req.uid,guardianUid:req.uid});travels.push({...r,followUrl:token?`${PUBLIC_ORIGIN}/follow/${token}`:null});}
 return res.json({ok:true,travels});
});
app.post('/family/invite', requireAuth, requireVerifiedEmail, async (req,res)=>{
  const b=req.body||{};
  const out=await family.createFamilyInvite({guardianUid:req.uid,guardianName:req.name||b.guardianName,teenName:b.teenName,teenEmail:b.teenEmail,teenDob:b.teenDob});
  if(!out.ok)return res.status(400).json(out);
  // The token travels only through the addressed mailbox and into the app deep link. The
  // Family screen never asks a person to copy an opaque identifier or security token.
  const link=`americanrider://family?invite=${encodeURIComponent(out.id)}&token=${encodeURIComponent(out.inviteToken)}`;
  const delivery=await send({
    to:String(b.teenEmail||'').trim().toLowerCase(),
    subject:'American Rider · Family invitation',
    text:`AMERICAN RIDER — NATIONAL TRANSPORTATION\n\n${req.name||'Your guardian'} has invited you to join their American Rider Family account for Teen Travel.\n\nOpen this invitation on the device where American Rider is installed:\n${link}\n\nThe invitation expires in seven days and can be accepted only while signed in to the verified account at this email address.\n`,
    html:`<p><strong>American Rider · Family</strong></p><p>You have been invited to join a Family account for Teen Travel.</p><p><a href="${link}">Accept Family Invitation</a></p><p>This invitation expires in seven days and can be accepted only while signed in to the verified account at this email address.</p>`,
  });
  if(!delivery.ok)return res.status(502).json({ok:false,reason:'The Family invitation could not be delivered. No invitation code is shown in the app.',id:out.id});
  return res.json({ok:true,id:out.id,delivered:true});
});
app.post('/family/invite/:id/accept', requireAuth, requireVerifiedEmail, async (req,res)=>{const out=await family.acceptFamilyInvite({id:req.params.id,inviteToken:req.body?.inviteToken,teenUid:req.uid,teenEmail:req.email,emailVerified:req.emailVerified});return res.status(out.ok?200:400).json(out);});
app.post('/family/:id/revoke', requireAuth, async (req,res)=>{const out=await family.revokeFamilyLink({id:req.params.id,guardianUid:req.uid});return res.status(out.ok?200:403).json(out);});

// --- Platform inbox: durable American Rider -> Operator/account communications. -----------
app.get('/operator/inbox', requireAuth, async (req, res) => {
  const out = await listPlatformMessages(req.uid, req.query?.limit);
  res.status(out.ok ? 200 : 503).json(out);
});
app.post('/operator/inbox/:id/read', requireAuth, async (req, res) => {
  const out = await markPlatformMessageRead(req.uid, req.params.id);
  res.status(out.ok ? 200 : out.reason === 'not found' ? 404 : 503).json(out);
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
app.post('/connect/onboard', requireAuth, LIMITS.connect, requireActiveOperatingMarket, async (req, res) => {
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
app.post('/connect/dashboard', requireAuth, LIMITS.connect, async (req, res) => {
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
app.post('/operator/online', requireAuth, requireFreshAuth, requireOperationalReadiness, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });

  // A REFUSAL TAKES THE OPERATOR OUT OF DISPATCH NOW. This route is also the 90-second renewal,
  // and a refused renewal used to leave the fleet record `available` until presence went stale
  // five minutes later. Dispatch reads only that record, so for those minutes an operator whose
  // document had expired, or whose account had been disabled, could still be sent travel.
  // Only an existing record: a first attempt that fails must not invent a fleet entry.
  const refuse = async (body) => {
    try {
      const ref = db.collection('operators').doc(String(req.uid));
      if ((await ref.get()).exists) {
        await ref.set({ available: false, offDutyReason: body.code, offDutyAt: Date.now() }, { merge: true });
      }
    } catch {
      /* the presence timeout still applies */
    }
    return res.status(409).json(body);
  };

  try {
    // A DISABLED ACCOUNT KEEPS A VALID SIGN-IN FOR UP TO AN HOUR (requireAuth checks the token
    // locally), so Firebase is asked directly. "Cannot tell" is not "enabled".
    if ((await accountDisabled(req.uid)) !== false) {
      return refuse({ code: 'account_disabled', error: 'This account cannot accept travel.' });
    }
    const rec = (await operatorRecord(req.uid)) || {};
    if (productionMode) {
      const point = { lat: Number(req.body?.lat), lng: Number(req.body?.lng) };
      const selected = operatingMarketOf(rec) || marketFor(point);
      const physical = marketFor(point);
      const [selection, location] = await Promise.all([admittedMarket(selected), admittedMarket(physical)]);
      if (selection.status !== 'active' || location.status !== 'active') {
        return refuse({ code: 'market_waitlist', error: 'New Operator offers are paused in this market.' });
      }
    }
    const status = await connectAccountStatus(rec.stripeAccountId || null);
    if (!status.payoutsEnabled) {
      return refuse({
        code: 'payouts_not_ready',
        error:
          'Stripe has not cleared this account for payouts yet, so travel cannot be assigned. ' +
          'A fare we cannot pay out is a fare we will not take.',
        due: status.due || [],
      });
    }
    const b = req.body || {};

    // COVERAGE, CHECKED HERE AS WELL AS ON THE PHONE. The Operator's qualifying commercial
    // coverage is a mandatory eligibility condition. A
    // date that has passed is a travel with nothing behind it, and a gate that exists only in
    // the app is a gate that runs on a device we do not control.
    // ---- THE SCREENING GATE. ---------------------------------------------------------
    //
    // THE DEFECT THIS CLOSES, and it is the worst one left. This route checked Stripe payouts,
    // an insurance expiry date and a position — and never once asked whether the operator had
    // passed a background screening. The whole apparatus behind that question existed:
    // Florida's standard encoded in screening.js, the screening-provider pipeline, the adjudication, the
    // three-year clock, twenty-eight tests. None of it was consulted at the only moment it
    // decides anything. An operator who had never been screened could carry a passenger
    // provided they had a Stripe account and had typed a date into a box.
    //
    // Built at both ends and not wired at the gate — the same class as an unwired backend path, the
    // website, and the AI planner. It is why "the code exists" is no longer evidence here.
    //
    // WHY IT IS GATED ON LIVE MODE rather than always. dispatch.ts already draws this line:
    // demonstration stand-ins are acceptable while no real traveler is carried, and never once
    // money is real. Refusing every operator today would stop the founders testing their own
    // product before a screening provider is configured. In test mode the travel is a demonstration; in
    // live mode a stranger gets into a car.
    //
    // The unscreened case is STAMPED either way, so /ops shows who is on duty without a
    // screening rather than letting it pass unrecorded.
    // ---- EVERY OTHER GATE, FROM ONE ASSESSMENT. ------------------------------------------
    //
    // backend/qualification.js assessOperator, context 'online': the documents and what code
    // can check on them (type, legibility, expiry, Florida's insurance limit), background
    // screening (required from the moment money is live — in test mode the travel is a
    // demonstration; in live mode a stranger gets into a car), suspension, the account, the
    // §627.748(8)(a) disclosure (test mode too: "we told them" cannot be true tomorrow and false
    // today), and Stripe. The same function runs at every travel acceptance.
    //
    // Nothing stored is read as approval. This replaced `commission.status === 'approved'`,
    // which a person set on /ops and which stayed true whatever happened afterwards.
    let user = null;
    let fleetNow = null;
    try {
      const [uSnap, oSnap] = await Promise.all([
        db.collection('users').doc(String(req.uid)).get(),
        db.collection('operators').doc(String(req.uid)).get(),
      ]);
      user = uSnap.exists ? uSnap.data() : null;
      fleetNow = oSnap.exists ? oSnap.data() : null;
    } catch {
      /* unreadable is not qualified */
    }
    const assessment = assessOperator({
      user,
      fleet: fleetNow,
      context: 'online',
      liveMoney: operationalMode,
      account: { disabled: false }, // checked above
      payouts: { enabled: true }, // checked above, with Stripe's list of what is still due
    });
    if (!assessment.eligible) {
      const first = assessment.blockers[0];
      return refuse({ code: first.code, error: first.reason, status: assessment.status, blockers: assessment.blockers });
    }
    const disclosure = user?.insuranceDisclosure || null;
    const screened = screeningCurrent(user?.screening || null);

    const expiry = String(b.insuranceExpiry || '').trim();
    const expiryMs = expiry ? Date.parse(`${expiry}T23:59:59Z`) : NaN;
    if (!expiry || Number.isNaN(expiryMs)) {
      return refuse({
        code: 'no_coverage_on_file',
        error: 'Record the expiry date of your commercial policy before going available.',
      });
    }
    if (expiryMs < Date.now()) {
      return refuse({
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
    // IN SERVICE ONLY WHERE WE OPERATE. An operator is dispatched from where they are, so this
    // one reads the position; their declared market must be active too.
    // An operator qualified before markets existed has declared none; their duty position
    // declares it, once, and is recorded as such.
    if (!user?.operatingMarket?.id) {
      const here = marketFor({ lat, lng });
      if (here) {
        const operatingMarket = { id: here.id, via: 'duty-position', at: Date.now() };
        await db.collection('users').doc(String(req.uid)).set({ operatingMarket }, { merge: true });
        user = { ...(user || {}), operatingMarket };
      }
    }
    const marketGate = operatingMarketGate(user);
    if (marketGate) return refuse(marketGate);
    if (!servesPoint({ lat, lng })) {
      return refuse({ code: 'outside_active_market', error: 'You are outside the counties American Rider operates in.' });
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

    const fleetRef = db.collection('operators').doc(String(req.uid));
    const fleetUpdate = {
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
        // Stamped from the assessment above, at every renewal, so dispatch can read it
        // without a second collection. Never written true anywhere else.
        commissioned: true,
        documentBlocked: false,
        // Visible on /ops. In test mode an unscreened operator may go on duty; nobody should
        // have to read code to discover that one has.
        screened,
        // ONLY A CURRENT SCREENING IS STAMPED. This wrote Date.now() for everybody, and
        // matchOperator's requireScreening reads this field as "passed a screening" — so with a
        // provider configured, every operator who went on duty in test mode passed that gate
        // without one. Cleared, not left, when not screened: a marker from a screening that has
        // since expired must not keep passing it either.
        screeningCheckedAt: screened ? Date.now() : null,
        lat,
        lng,
        geohash: encodeGeohash(lat, lng),
        marketId: marketFor({ lat, lng })?.id || null,
        available: b.available !== false,
        onlineAt: Date.now(),
    };
    if (productionMode) {
      const physical = marketFor({ lat, lng });
      const selected = operatingMarketOf(rec) || physical;
      if (!physical || !selected) return refuse({ code: 'market_waitlist', error: 'No admitted market at this position.' });
      const saved = await setAdmittedFleetOnline({ db, operatorId: req.uid, fleetUpdate,
        markets: [physical, selected], providerMissing: productionReadiness().missing });
      if (!saved) return refuse({ code: 'market_waitlist', error: 'Operator duty was paused in this market.' });
    } else {
      await fleetRef.set(fleetUpdate, { merge: true });
    }
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
app.post('/travel/cancel', requireAuth, LIMITS.payments, requireFreshAuth, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  // The refund comes from the travel's OWN payment (backend/travelmoney.js); a paymentIntentId in
  // the request is ignored. Stages, the $3 arrival fee and its payment to the operator unchanged.
  try {
    const out = await cancelTravelFor({
      db,
      uid: req.uid,
      rideId: req.body?.rideId,
      stripeConfigured: keyMode !== 'no-key',
      deps: { refundableFor, refundTravel, cancelUnpaidIntent, transferFixed, operatorPayoutAccount },
    });
    res.status(out.status).json(out.body);
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

app.post('/travel/settle', requireAuth, requireFreshAuth, async (req, res) => {
  if (keyMode === 'no-key') return res.status(500).json({ error: 'No Stripe key configured' });
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  // Only a COMPLETED travel of the caller's settles, and only out of the travel's OWN payment
  // (backend/travelmoney.js). A paymentIntentId in the request is ignored.
  try {
    const out = await settleTravelFor({
      db,
      uid: req.uid,
      rideId: req.body?.rideId,
      deps: {
        operatorPayoutAccount,
        transferToOperator,
        // THE RECEIPT, BY EMAIL, once. A failure is recorded on the travel and visible on /ops.
        sendReceipt: async (ride) => {
          const sent = await send({ to: req.email, ...receiptEmail(ride) });
          if (!sent.ok) console.log(`[receipt] ${ride.tripNo || req.body?.rideId}: ${sent.reason}`);
          return sent;
        },
      },
    });
    res.status(out.status).json(out.body);
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
  // A named Operator is not a notified Operator. Create a durable inbox message (with push
  // as a delivery channel) and advance the status only after at least one message exists.
  const operatorDelivery = await notifyLostItemOperators({
    itemId: (req.body || {}).itemId,
    uid: req.uid,
  }).catch(() => ({ ok: false, delivered: 0 }));
  res.json({
    ok: filed.ok || operatorDelivery.ok,
    caseNo: filed.caseNo,
    operatorNotified: !!operatorDelivery.ok,
    operatorDeliveryCount: Number(operatorDelivery.delivered || 0),
  });
});

// --- Lost-item Operator recovery: a report is actionable, not merely named. ----------------
app.get('/operator/lost-item/:id', requireAuth, async (req, res) => {
  const out = await operatorLostItem({ itemId: req.params.id, operatorUid: req.uid });
  if (!out.ok) return res.status(out.status || 500).json(out);
  // Authorization above proves this authenticated Operator is named on this report. Only then
  // mint a short-lived read URL for the Traveler's private lost-item photograph.
  let photoUrl = null;
  if (out.item?.photoObjectKey) {
    try { photoUrl = await r2ReadUrl(out.item.photoObjectKey); } catch { photoUrl = null; }
  }
  return res.json({ ...out, item: { ...out.item, photoUrl } });
});
app.post('/operator/lost-item/:id/respond', requireAuth, async (req, res) => {
  const out = await respondLostItem({
    itemId: req.params.id,
    operatorUid: req.uid,
    outcome: req.body?.outcome,
    tripNo: req.body?.tripNo || null,
  });
  return res.status(out.ok ? 200 : out.status || 500).json(out);
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
    idempotencyKey: String(b.requestId || ''),
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

  res.json({ ok: filed.stored && filed.emailed, caseNo: filed.caseNo,
    stored: filed.stored, emailed: filed.emailed, repeated: filed.repeated === true });
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
app.post('/assistant-withdrawn-original', requireAuth, (req, res) => {
  res.status(410).json({ error: 'The trip planner has been withdrawn.' });
});

// --- Quote: the money breakdown for a ride. Pure math, no Stripe call. --------------------
// body: { travelCostCents: 2450 }
app.post('/quote', LIMITS.quoteIp, (req, res) => {
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
app.post('/route', LIMITS.routeIp, requireAdmittedPickup, async (req, res) => {
  // No routing for a pickup that is not in an active market: nothing can be booked from there.
  if (!servesPoint(req.body?.pickup)) return res.status(409).json({ error: outsideMarketMessage('pickup'), code: 'outside_market', where: 'pickup' });
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
app.post('/smart-quote', LIMITS.routeIp, requireOperationalReadiness, requireAdmittedPickup, async (req, res) => {
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

app.post('/smart-revalidate', LIMITS.routeIp, requireOperationalReadiness, async (req, res) => {
  const plan = req.body?.plan;
  const out = await revalidateTransit(plan);
  if (out.status === 'unavailable') return res.status(503).json(out);
  return res.json(out);
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
app.get('/destinations', LIMITS.quoteIp, async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }
  if (productionMode && (await admittedMarket(marketFor({ lat, lng }))).status !== 'active') return res.json([]);
  res.json(destinationsNear({ lat, lng }, limit));
});

// --- National place discovery. Search is NOT a market gate. ------------------------------
app.get('/place-search', LIMITS.placeSearchIp, async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) return res.json({ suggestions: [] });
  const lat = Number(req.query.lat); const lng = Number(req.query.lng);
  const near = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  const limit = Math.min(8, Math.max(1, Number(req.query.limit) || 6));
  const suggestions = await searchPlaces(q, near, limit);
  res.json({ suggestions });
});

// --- What does THIS trip cost? The app asks; the server decides. --------------------------
// body: { pickup: {lat,lng}, dest: {lat,lng} }  OR  { destination: 'Wynwood' }
// Returns the ONE all-in price the traveler sees, plus the split behind it. `feeLines` names
// any government fee inside that price (name, payee, cents) so a screen can say what it is;
// `travelerPays` already contains it — nothing is added on top of the number shown.
// No login needed: this only reveals pricing, and a traveler must see the price before booking.
app.post('/fare-quote', attachAuth, LIMITS.quoteIp, requireOperationalReadiness, requireAdmittedPickup, async (req, res) => {
  const priced = await authoritativeFare({
    body: req.body, uid: req.uid, email: req.email, db: adminDb(), cardCountryFor: defaultCardCountry,
  });
  if (priced?.invalidJourney) return res.status(409).json({ error: priced.reason, code: 'invalid_smart_journey' });
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
  if (String(priced.pricedBy || '').endsWith('-distance') && priced.tollStatus === 'unknown') {
    return res.status(503).json({ error: 'Toll cost could not be verified for this route.', code: 'toll_unavailable' });
  }
  // WHICH FEE SCHEDULE, DECIDED HERE AND NOWHERE ELSE. The fee depends on the issuing country
  // of the traveler's default card (Chad, 20 Sept 2026), and the ONE place that can be read
  // without the price moving later is before the quote is given. A traveler with nothing on
  // file, or nobody signed in, is quoted domestic — see isDomesticCard() in payments.js.
  res.json({
    travelerPays: priced.travelerPays, operatorGets: priced.operatorGets,
    platformTake: priced.platformTake, commission: priced.commission, appFee: priced.appFee,
    governmentFeeCents: priced.governmentFeeCents, tollCents: priced.tollCents || 0, tollStatus: priced.tollStatus, feeLines: priced.feeLines,
    travelCostCents: priced.travelCostCents, miles: priced.miles, minutes: priced.minutes,
    timedBy: priced.timedBy, pricedBy: priced.pricedBy,
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

app.post('/payment-methods/setup-intent', requireAuth, LIMITS.payments, async (req, res) => {
  if (keyMode === 'no-key') return res.status(500).json({ error: 'No Stripe secret key configured' });
  try {
    const setup = await createSetupIntent({ uid: req.uid, email: req.email });
    return res.json(setup);
  } catch (e) {
    return res.status(502).json({ error: 'A payment method cannot be added right now', detail: String(e && e.message || e) });
  }
});

app.post('/payment-methods/default', requireAuth, LIMITS.payments, async (req, res) => {
  if (keyMode === 'no-key') return res.status(500).json({ error: 'No Stripe secret key configured' });
  try {
    const r = await setDefaultPaymentMethod({ uid: req.uid, email: req.email, paymentMethodId: req.body && req.body.paymentMethodId });
    if (!r.ok) return res.status(r.code === 'bad_id' ? 400 : 403).json({ error: r.code });
    return res.json({ ok: true, methods: await listPaymentMethods({ uid: req.uid, email: req.email }) });
  } catch (e) {
    return res.status(502).json({ error: 'The default could not be changed', detail: String(e && e.message || e) });
  }
});

app.delete('/payment-methods/:id', requireAuth, LIMITS.payments, async (req, res) => {
  if (keyMode === 'no-key') return res.status(500).json({ error: 'No Stripe secret key configured' });
  try {
    const r = await detachPaymentMethod({ uid: req.uid, email: req.email, paymentMethodId: req.params.id });
    if (!r.ok) return res.status(r.code === 'bad_id' ? 400 : 403).json({ error: r.code });
    return res.json({ ok: true, methods: await listPaymentMethods({ uid: req.uid, email: req.email }) });
  } catch (e) {
    return res.status(502).json({ error: 'The payment method could not be removed', detail: String(e && e.message || e) });
  }
});

app.post('/create-payment-intent', requireAuth, LIMITS.payments, requireFreshAuth, requireOperationalReadiness, requireAdmittedTravel, async (req, res) => {
  if (keyMode === 'no-key') {
    return res.status(500).json({ error: 'No Stripe secret key configured. Add STRIPE_SECRET_KEY to backend/.env' });
  }
  // The travel is authorized against the database before anything is charged.
  if (!adminDb()) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
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
  // THE TRAVEL IS PROVED BEFORE ANY CHARGE EXISTS (backend/travelmoney.js payForTravel): the
  // ride must exist, be this traveler's and still be live, or no PaymentIntent is created. The
  // intent then carries the ride's OWN Travel Number and id — never the request's — and is
  // recorded on that ride with an update, which cannot create a ride that does not exist.
  // Written before the app is given the client secret, so a paid travel always names its
  // payment; that record is what cancellation refunds and settlement pays out of.
  try {
    const out = await payForTravel({
      db: adminDb(),
      uid: req.uid,
      rideId: req.body?.rideId,
      create: ({ tripNo, rideId, ride }) =>
        createPaymentIntent({
          travelCostCents: ride.travelCostCents,
          journey: ride.journey || null,
          // Fenced from the same coordinates as the price. Stamped on the intent and the travel;
          // remittance.js reads it back by the month.
          governmentFees: ride.feeLines,
          cardCountry: ride.cardCountry || null,
          tollCents: Math.max(0, Number(ride.tollCents) || 0),
          // Stamped onto the PaymentIntent so a later refund can prove who paid, and for which
          // travel.
          uid: req.uid,
          email: req.email,
          tripNo,
          rideId,
          // Display only — the names that put the route on the receipt and bank statement.
          dep: String(ride.dep || '').slice(0, 60) || null,
          dest: String(ride.dest || '').slice(0, 60) || null,
        }),
      // A retry of the same unpaid payment continues the existing intent — a retrieve, never a
      // second create. Anything else on an already-paid travel is refused before Stripe is asked.
      resume: (paymentIntentId, ride) =>
        resumePaymentIntent({
          paymentIntentId,
          uid: req.uid,
          rideId: String(req.body?.rideId || ''),
          email: req.email,
          travelCostCents: ride.travelCostCents,
          journey: ride.journey || null,
          governmentFees: ride.feeLines,
          cardCountry: ride.cardCountry || null,
          tollCents: Math.max(0, Number(ride.tollCents) || 0),
        }),
    });
    if (out.status !== 200) return res.status(out.status).json(out.body);
    const result = out.body;
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
// Kept because proving a charge end to end from a terminal is useful. The current test helper
// ignores destination splitting entirely; settlement is tested through the same explicit
// separate-transfer architecture as production.
app.post('/charge-ride', requireAuth, LIMITS.payments, requireOperationalReadiness, async (req, res) => {
  if (keyMode === 'no-key') {
    return res.status(500).json({ error: 'No Stripe secret key configured. Add STRIPE_SECRET_KEY to backend/.env' });
  }
  if (keyMode !== 'test' || productionMode) {
    return res.status(403).json({
      error: 'This route exists only for test-mode verification and is disabled with live keys.',
    });
  }
  // Price the ride on the server — never from a client-sent amount.
  const priced = await authoritativeFare({ body: req.body, uid: req.uid, email: req.email, cardCountryFor: defaultCardCountry });
  if (priced?.invalidJourney) return res.status(409).json({ error: priced.reason, code: 'invalid_smart_journey' });
  if (priced?.outsideMarket) {
    return res.status(409).json({ error: priced.reason, code: 'outside_market', where: priced.outsideMarket });
  }
  if (!priced) {
    return res.status(400).json({ error: 'Need either pickup+dest coordinates or a known destination' });
  }
  if (String(priced.pricedBy || '').endsWith('-distance') && priced.tollStatus === 'unknown') {
    return res.status(503).json({ error: 'Toll cost could not be verified for this route.', code: 'toll_unavailable' });
  }
  try {
    const result = await chargeRide({
      travelCostCents: priced.travelCostCents,
      travelerPaymentMethod: req.body?.travelerPaymentMethod || null,
      uid: req.uid,
      tripNo: req.body?.tripNo || null,
      governmentFees: priced.feeLines,
      cardCountry: priced.cardCountry,
      tollCents: Math.max(0, Number(priced.tollCents) || 0),
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
// AUTHENTICATED OPERATIONAL CONTROL. The endpoint takes no workload parameters and can only
// invoke the same leased sweep the process clock invokes. SCHEDULER_TOKEN is mandatory; callers
// without the configured token fail closed before any operational work begins.
let lastSweep = { at: 0, report: null };

/**
 * One tick of everything the platform does on a clock.
 *
 * Both jobs run on the same tick and neither may take the other down — a route monitor that
 * throws must not stop travel being dispatched, and vice versa. Promise.allSettled, not
 * Promise.all.
 */
async function runAllSweeps() {
  const marketStatuses = new Map();
  const checkMarket = async (pickup) => {
    const market = marketFor(pickup);
    if (!market) return 'waitlist';
    if (!marketStatuses.has(market.id)) marketStatuses.set(market.id, admittedMarket(market).then((state) => state.status));
    return marketStatuses.get(market.id);
  };
  const [scheduled, monitor, assignments, screening, settlements, bookingRecovery, providerEvents, operatorFees, familyAgeOut, insuranceMonitoring, marketReference, marketFleet] = await Promise.allSettled([
    sweepScheduled({ checkMarket: async (pickup) => {
      const market = marketFor(pickup);
      return market ? (await admittedMarket(market)).status : 'waitlist';
    } }),
    sweepMonitor(),
    sweepAssignments({ checkMarket }),
    sweepScreening(),
    sweepSettlements(),
    sweepBookingRecovery({ db: adminDb(), stripeConfigured: keyMode !== 'no-key',
      deps: { refundableFor, refundTravel, cancelUnpaidIntent, verifiedTravelPayment,
        transferFixed, operatorPayoutAccount } }),
    sweepProviderEvents({ handlers: PROVIDER_HANDLERS, workerId: WORKER_ID }),
    sweepOperatorAccountFees({
      charge: ({ uid, email, month, amountCents }) =>
        chargeOperatorAccountFee({ uid, email, month, amountCents }),
      cardCountryFor: async (uid) => defaultCardCountry({ uid }),
    }),
    family.sweepFamilyAgeOut(),
    sweepInsuranceMonitoring({ db: adminDb(), requestConfirmation: issueInsuranceConfirmationRequest, notify }),
    runMarketReferenceSweep({ collectors: marketReferenceCollectors() }),
    sweepPausedMarketFleet({ db: adminDb(), marketById: (id) => allMarkets().find((m) => m.id === id) }),
  ]);
  const unwrap = (r) => (r.status === 'fulfilled' ? r.value : { ok: false, reason: String(r.reason) });
  return {
    scheduled: unwrap(scheduled),
    monitor: unwrap(monitor),
    assignments: unwrap(assignments),
    screening: unwrap(screening),
    settlements: unwrap(settlements),
    bookingRecovery: unwrap(bookingRecovery),
    providerEvents: unwrap(providerEvents),
    operatorFees: unwrap(operatorFees),
    familyAgeOut: unwrap(familyAgeOut),
    insuranceMonitoring: unwrap(insuranceMonitoring),
    marketReference: unwrap(marketReference),
    marketFleet: unwrap(marketFleet),
  };
}

async function runLeasedSweeps() {
  const name = 'operations_sweep';
  const lease = await acquireLease(name, { owner: WORKER_ID, ttlMs: DEFAULT_LEASE_MS });
  if (!lease.ok) return { ok: false, reason: lease.reason || 'scheduler lease unavailable' };
  if (!lease.acquired) return { ok: true, skipped: 'another server owns this sweep', leaseUntil: lease.leaseUntil };

  // Renew well before expiry while provider/network work is still running. If this process
  // dies, renewal dies with it and another instance can take over after the lease expires.
  const heartbeat = setInterval(() => {
    renewLease(name, { owner: WORKER_ID, ttlMs: DEFAULT_LEASE_MS })
      .then((x) => { if (!x.renewed) console.error('[scheduler] lease renewal lost', x); })
      .catch((e) => console.error('[scheduler] lease renewal failed', e?.message || e));
  }, Math.max(15_000, Math.floor(DEFAULT_LEASE_MS / 3)));
  heartbeat.unref?.();
  try {
    return await runAllSweeps();
  } finally {
    clearInterval(heartbeat);
    await releaseLease(name, { owner: WORKER_ID }).catch(() => {});
  }
}

async function runSweep(req, res) {
  // Operational sweeps can dispatch reserved travel, re-offer assignments, block expired
  // screenings, open safety cases and move money owed to operators. They are therefore an
  // authenticated operational control, not a public health endpoint. The process already
  // runs the same sweep internally every sixty seconds; external schedulers are optional.
  //
  // Previous behavior deliberately let an unauthenticated caller execute the sweep and merely
  // hid the detailed response. That still exposed a public resource-amplification endpoint:
  // an attacker could force repeated Firestore/Stripe work every ten seconds. Fail closed.
  const want = readKey('SCHEDULER_TOKEN');
  const got = String(req.query?.token || req.get('x-scheduler-token') || '');
  if (!want || got !== want) {
    return res.status(401).json({ error: 'scheduler authorization required' });
  }

  const now = Date.now();
  if (now - lastSweep.at < 10000 && lastSweep.report) {
    return res.json({ ...lastSweep.report, cached: true, ageMs: now - lastSweep.at });
  }
  const report = await runLeasedSweeps();
  lastSweep = { at: Date.now(), report };
  return res.json(report);
}


// --- Private file storage. -----------------------------------------------------------------
// The mobile app may request a five-minute upload URL only for its own namespace. R2 remains
// private; credentials never leave this server. Object keys, not public URLs, are persisted.
app.post('/storage/upload-url', requireAuth, LIMITS.document, requireFreshAuth, requireActiveOperatingMarket, async (req, res) => {
  if (!r2Ready()) return res.status(503).json({ error: 'Private storage is not configured.', code: 'storage_not_configured' });
  const purpose = String(req.body?.purpose || '');
  const kind = String(req.body?.kind || '');
  const contentType = String(req.body?.contentType || 'image/jpeg').toLowerCase();
  try {
    const out = await r2UploadUrl({ uid: req.uid, purpose, kind, contentType, id: require('node:crypto').randomUUID() });
    if (!out.ok) return res.status(out.code === 'unsupported_type' ? 415 : 400).json({ error: out.code, code: out.code });
    return res.json({ key: out.key, uploadUrl: out.url });
  } catch (e) { return res.status(502).json({ error: e.message, code: 'storage_sign_failed' }); }
});

app.get('/storage/object', requireAuth, LIMITS.document, requireFreshAuth, async (req, res) => {
  const key = String(req.query?.key || '');
  const purpose = String(req.query?.purpose || '');
  if (!r2Owns(key, req.uid, purpose)) return res.status(403).json({ error: 'That file belongs to another account' });
  try { return res.json({ url: await r2ReadUrl(key) }); }
  catch (e) { return res.status(502).json({ error: e.message }); }
});

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
app.post('/operator/document', requireAuth, LIMITS.document, requireFreshAuth, requireActiveOperatingMarket, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });

  const kind = String(req.body?.kind || '');
  const objectKey = String(req.body?.objectKey || '');
  if (!kind || !objectKey) return res.status(400).json({ error: 'kind and objectKey are required' });
  // Trust an opaque R2 key only after proving it is inside this authenticated operator's
  // namespace. The reader receives a five-minute signed GET URL generated server-side.
  if (!r2Owns(objectKey, req.uid, 'operator-document')) {
    return res.status(403).json({ error: 'That document belongs to another account' });
  }

  try {
    const imageUrl = await r2ReadUrl(objectKey);
    if (!imageUrl) return res.status(503).json({ error: 'Private storage is not configured.' });
    // WHAT WE ALREADY BELIEVE, for cross-checking — all of it first-party, all of it something
    // the operator told us themselves.
    const [userSnap, opSnap] = await Promise.all([
      db.collection('users').doc(String(req.uid)).get(),
      db.collection('operators').doc(String(req.uid)).get(),
    ]);
    const u = userSnap.exists ? userSnap.data() : {};
    const o = opSnap.exists ? opSnap.data() : {};

    // ONLY IN AN ACTIVE MARKET. Reviewing a document starts a
    // regulated workflow; an operator whose declared operating market is on the waitlist gets
    // neither. See POST /operator/market.
    const gate = operatingMarketGate(u);
    if (gate) return res.status(409).json(gate);

    // THE SAME UPLOAD IS READ ONCE. A retry, a double tap or a loop that re-sends one file gets
    // the stored reading back instead of consuming another OCR/human-review slot.
    const prior = u.documents?.[kind];
    if (prior && prior.objectKey === objectKey && prior.evidence && prior.readerVersion === READER_VERSION) {
      return res.json({ verdict: prior.verdict, reasons: prior.reasons || [], summary: prior.summary || '', expiry: prior.expiry || null, repeated: true });
    }
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
            objectKey,
            readAt: Date.now(),
            // THE STRUCTURED READING, kept as evidence. backend/qualification.js re-checks it in
            // code — document type, legibility, and for insurance commercial use and limits —
            // rather than taking the verdict on trust.
            evidence: out.evidence || null,
            readerVersion: READER_VERSION,
            // A fresh upload answers any earlier "submit this again".
            reuploadRequired: false,
            reuploadReason: null,
            reuploadCheckedVersion: null,
            // A new document starts a new reading; a person's decision on the old one does
            // not carry over to it.
            decision: null,
          },
        },
      },
      { merge: true },
    );

    // INSURANCE IS VERIFIED TWICE, FOR TWO DIFFERENT QUESTIONS. The document reader and
    // qualification rules answer "does this policy satisfy the standard today?" This record
    // starts the continuing-status clock that answers "has it since been cancelled or changed?"
    // It is refreshed only by fresh evidence, never merely by the passage of time.
    if (kind === 'insurance' && out.verdict === 'accept') {
      const monitoringDoc = {
        verdict: out.verdict,
        expiry: out.expiry,
        evidence: out.evidence || null,
      };
      await db.collection('users').doc(String(req.uid)).set(
        { insuranceMonitoring: initialMonitoringFromDocument(monitoringDoc) },
        { merge: true },
      );
    }

    // A document that is not accepted must not leave the operator dispatchable on the strength
    // of an earlier one. Taken off duty rather than deleted; the record stands.
    if (out.verdict !== 'accept') {
      await db.collection('operators').doc(String(req.uid)).set(
        { available: false, documentBlocked: true, documentReason: out.summary || '' },
        { merge: true },
      );
    }

    // QUALIFICATION FOLLOWS FROM THE READING, with no one to click anything. Reported, not
    // required: a failure here is re-assessed at the next status check and at every gate.
    let qualification = null;
    try {
      const a = await assessAndRecord({ db, uid: req.uid, checks: qualificationChecks, liveMoney: operationalMode });
      qualification = { status: a.status, qualified: a.qualified };
    } catch (e) {
      console.error('[qualification] after document', e.message);
    }

    res.json({
      verdict: out.verdict,
      reasons: out.reasons,
      summary: out.summary,
      expiry: out.expiry,
      qualification,
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// --- Markets: where travel is sold and operators are onboarded. ----------------------------
//
// backend/markets.js holds the counties and their status. Two uses here:
//   travel     — authorized by the PICKUP (and destination) the traveler asks for, wherever
//                the traveler happens to be standing. Priced routes check it (market.js); so
//                does dispatch.
//   operators  — the costly and regulated steps (document reading, screening, Stripe Connect,
//                going on duty) run only for an operator whose declared operating market is
//                ACTIVE. The market's CURRENT status is read each time, so switching a county
//                to WAITLIST stops new work there at once.

/** The operator's declared operating market as it stands now, or null. */
function operatingMarketOf(user) {
  const id = user?.operatingMarket?.id;
  return id ? allMarkets().find((m) => m.id === id) || null : null;
}

/** null when the operator may proceed; else the refusal body. */
function operatingMarketGate(user) {
  const m = operatingMarketOf(user);
  if (m && m.status === 'active') return null;
  return {
    code: 'market_waitlist',
    error: m
      ? `American Rider does not operate in ${m.name} yet. Your interest is recorded.`
      : 'Choose the county you will operate in before continuing.',
    market: m ? { id: m.id, name: m.name, status: m.status } : null,
  };
}

const marketBody = (m) => (m ? { id: m.id, name: m.name, status: m.status, regionId: m.regionId } : null);

// Public discovery may use a short cache; actual charges and offers always read durable state.
let publicMarketCache = { until: 0, value: null, pending: null };
async function publicMarkets() {
  if (!productionMode) return listMarkets();
  if (publicMarketCache.value && Date.now() < publicMarketCache.until) return publicMarketCache.value;
  if (publicMarketCache.pending) return publicMarketCache.pending;
  publicMarketCache.pending = (async () => {
    const items = await Promise.all(allMarkets().filter((m) => m.regionId).map(async (m) => {
      if (m.status !== 'active') return marketBody(m);
      const state = await admittedMarket(m);
      return { ...marketBody(m), status: state.status === 'active' ? 'active' : 'waitlist' };
    }));
    publicMarketCache = { until: Date.now() + 15_000, value: items, pending: null };
    return items;
  })();
  try { return await publicMarketCache.pending; }
  catch { publicMarketCache = { until: 0, value: null, pending: null }; return []; }
}
function invalidatePublicMarkets() { publicMarketCache = { until: 0, value: null, pending: null }; }
function listedMarket(market, listed) {
  if (!market) return null;
  return listed.find((item) => item.id === market.id) ||
    { ...marketBody(market), status: productionMode ? 'waitlist' : market.status };
}
async function operatorMarketOptions() {
  if (!productionMode) return listMarkets();
  return Promise.all(allMarkets().filter((m) => m.regionId).map(async (m) => {
    if (m.status !== 'active') return marketBody(m);
    const state = await admittedMarket(m);
    return { ...marketBody(m), status: state.status };
  }));
}

/** Express middleware: the signed-in operator's declared operating market must be ACTIVE. */
async function requireActiveOperatingMarket(req, res, next) {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  try {
    const snap = await db.collection('users').doc(String(req.uid)).get();
    const gate = operatingMarketGate(snap.exists ? snap.data() : null);
    if (gate) return res.status(409).json(gate);
    if (productionMode) {
      const market = operatingMarketOf(snap.data());
      const admitted = await admittedMarket(market);
      if (!['onboarding', 'active'].includes(admitted.status)) return res.status(409).json({ code: 'market_waitlist', error: 'Operator onboarding is not authorized in this market.', marketId: market.id });
    }
    next();
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}

// Public: one cached status per configured county, never evidence or confidential references.
app.get('/markets', LIMITS.quoteIp, async (req, res) => {
  const lat = Number(req.query?.lat);
  const lng = Number(req.query?.lng);
  const available = await publicMarkets();
  const nearby = Number.isFinite(lat) && Number.isFinite(lng) ? marketFor({ lat, lng }) : null;
  res.json({
    active: available.filter((m) => m.status === 'active'),
    here: listedMarket(nearby, available),
  });
});

function opsMarket(req, res) {
  const m = allMarkets().find((item) => item.id === String(req.params.id || ''));
  if (!m) res.status(404).json({ code: 'unknown_market' });
  return m;
}
function requireOpsMutation(req, res, next) {
  if (req.get('x-ar-ops-action') !== '1' || !req.is('application/json')) {
    return res.status(403).json({ code: 'ops_action_header_required' });
  }
  return next();
}
app.get('/ops/markets', requireOps, async (req, res) => {
  const markets = allMarkets().filter((m) => m.regionId);
  const items = await Promise.all(markets.map(async (market) => ({ market, state: await admittedMarket(market) })));
  res.type('html').send(marketChecklistPage(items, { production: DEPLOYMENT_MODE === 'production' && keyMode === 'live' }));
});
app.get('/ops/markets/:id/readiness', requireOps, async (req, res) => {
  const market = opsMarket(req, res);
  if (!market) return;
  const region = REGIONS.find((r) => r.id === market.regionId);
  return res.json({ ...await admittedMarket(market), manifest: manifestFor(market, region) });
});
app.post('/ops/markets/:id/evidence', requireOps, requireOpsMutation, async (req, res) => {
  const market = opsMarket(req, res);
  if (!market) return;
  if (opsAuthMode() !== 'named') return res.status(403).json({ code: 'named_ops_required' });
  try {
    const region = REGIONS.find((r) => r.id === market.regionId);
    const out = await recordEvidence({ db: adminDb(), market, region, domain: req.body?.domain,
      input: req.body, actor: req.opsUser, expectedVersion: req.body?.manifestVersion });
    if (!out.ok) return res.status(400).json(out);
    invalidatePublicMarkets();
    let fleetCleanup;
    try { fleetCleanup = await deactivateMarketFleet({ db: adminDb(), market, maxPages: 2 }); }
    catch (e) { fleetCleanup = { ok: false, reason: e.message, done: false }; }
    return res.json({ ...out, fleetCleanup });
  } catch { return res.status(503).json({ code: 'market_evidence_unavailable' }); }
});
app.post('/ops/markets/:id/onboard', requireOps, requireOpsMutation, async (req, res) => {
  const market = opsMarket(req, res);
  if (!market) return;
  if (DEPLOYMENT_MODE !== 'production' || keyMode !== 'live' || opsAuthMode() !== 'named') {
    return res.status(409).json({ code: 'production_authority_required' });
  }
  const region = REGIONS.find((r) => r.id === market.regionId);
  try {
    const out = await authorizeOnboarding({ db: adminDb(), market, region, actor: req.opsUser,
      expectedVersion: req.body?.manifestVersion, providerMissing: productionReadiness().missing });
    if (out.ok) invalidatePublicMarkets();
    return res.status(out.ok ? 200 : 409).json(out);
  } catch { return res.status(503).json({ code: 'market_onboarding_unavailable' }); }
});
app.post('/ops/markets/:id/activate', requireOps, requireOpsMutation, async (req, res) => {
  const market = opsMarket(req, res);
  if (!market) return;
  if (DEPLOYMENT_MODE !== 'production' || keyMode !== 'live' || opsAuthMode() !== 'named') {
    return res.status(409).json({ code: 'production_authority_required' });
  }
  const region = REGIONS.find((r) => r.id === market.regionId);
  try {
    const out = await activateMarket({ db: adminDb(), market, region, actor: req.opsUser,
      expectedVersion: req.body?.manifestVersion, providerMissing: productionReadiness().missing });
    if (out.ok) invalidatePublicMarkets();
    return res.status(out.ok ? 200 : 409).json(out);
  } catch { return res.status(503).json({ code: 'market_activation_unavailable' }); }
});
app.post('/ops/markets/:id/pause', requireOps, requireOpsMutation, async (req, res) => {
  const market = opsMarket(req, res);
  if (!market) return;
  try {
    const out = await pauseMarket({ db: adminDb(), market, actor: req.opsUser, reason: req.body?.reason });
    if (!out.ok) return res.status(409).json(out);
    invalidatePublicMarkets();
    let fleetCleanup;
    try { fleetCleanup = await deactivateMarketFleet({ db: adminDb(), market, maxPages: 2 }); }
    catch (e) { fleetCleanup = { ok: false, reason: e.message, done: false }; }
    return res.json({ ...out, fleetCleanup });
  } catch { return res.status(503).json({ code: 'market_pause_unavailable' }); }
});

// The operator names the county they will operate in — or sends a position and it is derived.
// A WAITLIST county is recorded (and joins the waitlist) and unlocks nothing costly.
app.post('/operator/market', requireAuth, LIMITS.market, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  const b = req.body || {};
  let m = null;
  let via = null;
  if (b.marketId) {
    m = allMarkets().find((x) => x.id === String(b.marketId)) || null;
    via = 'declared';
    if (!m) return res.status(400).json({ error: 'Unknown market', code: 'unknown_market' });
  } else if (Number.isFinite(Number(b.lat)) && Number.isFinite(Number(b.lng))) {
    m = marketFor({ lat: Number(b.lat), lng: Number(b.lng) });
    via = 'position';
  } else {
    return res.status(400).json({ error: 'marketId or a position is required' });
  }
  try {
    const now = Date.now();
    if (m) {
      await db.collection('users').doc(String(req.uid)).set({ operatingMarket: { id: m.id, via, at: now } }, { merge: true });
    }
    const available = await operatorMarketOptions();
    const selected = listedMarket(m, available);
    if (!selected || selected.status === 'waitlist') {
      await db.collection('waitlist').doc(String(req.uid)).set(
        { role: 'operator', marketId: m?.id || null, at: now },
        { merge: true },
      );
    }
    res.json({ market: selected, active: available.filter((x) => x.status === 'active'),
      onboarding: available.filter((x) => x.status === 'onboarding') });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/operator/market', requireAuth, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  try {
    const snap = await db.collection('users').doc(String(req.uid)).get();
    const market = operatingMarketOf(snap.exists ? snap.data() : null);
    const available = await operatorMarketOptions();
    res.json({
      market: listedMarket(market, available),
      active: available.filter((x) => x.status === 'active'),
      onboarding: available.filter((x) => x.status === 'onboarding'),
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Lightweight interest from anywhere. Nothing costly starts; one record per account.
app.post('/waitlist', requireAuth, LIMITS.waitlist, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  const b = req.body || {};
  const role = b.role === 'operator' ? 'operator' : 'traveler';
  const m = b.marketId
    ? allMarkets().find((x) => x.id === String(b.marketId)) || null
    : Number.isFinite(Number(b.lat)) && Number.isFinite(Number(b.lng))
      ? marketFor({ lat: Number(b.lat), lng: Number(b.lng) })
      : null;
  try {
    await db.collection('waitlist').doc(String(req.uid)).set({ role, marketId: m?.id || null, at: Date.now() }, { merge: true });
    res.json({ ok: true, market: marketBody(m) });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

async function issueInsuranceConfirmationRequest({ uid, user, contact, now = Date.now(), reason = 'manual' }) {
  const db = adminDb();
  if (!db) return { ok: false, reason: adminStatus().reason || 'no database' };
  const m = user?.insuranceMonitoring || {};
  if (!m?.statusAuthorization?.acceptedAt) {
    return { ok: false, reason: 'Operator authorization is required before requesting policy status.' };
  }
  const email = String(contact?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, reason: 'Invalid insurer or broker email.' };

  const sameContact = String(m.contact?.email || '').trim().toLowerCase() === email;
  const priorAttempts = sameContact ? Math.max(0, Number(m.verificationRequestCount) || 0) : 0;
  if (priorAttempts >= 3) {
    const issue = {
      kind: 'delivery_attempts_exhausted',
      at: now,
      source: String(contact?.type || 'broker').slice(0, 20),
      contactEmail: email,
      note: 'Three delivery attempts to this verification contact have failed or remained unresolved.',
    };
    await db.collection('users').doc(String(uid)).set({
      insuranceMonitoring: { ...m, verificationIssue: issue },
    }, { merge: true });
    await db.collection('audit_log').add({
      at: now,
      subject: String(uid),
      actor: { name: 'American Rider', method: 'insurance_monitor' },
      action: 'insurance_verification_delivery_exhausted',
      contactEmail: email,
      attempts: priorAttempts,
      resultingEligibility: continuingStatus({ ...(user || {}), insuranceMonitoring: { ...m, verificationIssue: issue } }, now),
    }).catch(() => {});
    await fileTicket({
      uid: String(uid),
      email: user?.email || null,
      description: `Insurance status verification could not be delivered after ${priorAttempts} attempts to ${email}. Operator Relations must verify the contact or use the carrier/broker's required process.`,
      trip: null,
      reason: 'insurance verification delivery exhausted',
      kind: 'support',
      category: 'operator-insurance',
    }).catch(() => {});
    return { ok: false, operational: true, reason: 'Insurance verification delivery requires Operator Relations.' };
  }

  const attempt = priorAttempts + 1;
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = now + 14 * 24 * 60 * 60 * 1000;
  const policy = String(m.policyNumber || user?.documents?.insurance?.evidence?.insurance?.policyNumber || '');
  const last4 = policy ? policy.slice(-4) : 'not shown';
  const operatorName = String(user?.legalName || user?.name || 'the Operator').slice(0, 100);
  const url = `${PUBLIC_ORIGIN}/insurance/status-confirmation?token=${encodeURIComponent(token)}`;
  const requestRef = db.collection('insurance_status_requests').doc(tokenHash);

  await requestRef.set({
    uid: String(uid),
    email,
    contactName: String(contact?.name || '').slice(0, 100),
    contactType: String(contact?.type || 'broker').slice(0, 20),
    createdAt: now,
    expiresAt,
    usedAt: null,
    reason,
    policyLast4: last4,
    attempt,
    deliveryStatus: 'pending',
  });
  await db.collection('audit_log').add({
    at: now,
    subject: String(uid),
    actor: { name: 'American Rider', method: 'insurance_monitor' },
    action: 'insurance_verification_request_created',
    requestId: tokenHash,
    contactEmail: email,
    attempt,
    reason,
  }).catch(() => {});

  const sent = await send({
    from: 'American Rider Insurance Verification <insurance@americanrider.app>',
    replyTo: 'insurance@americanrider.app',
    to: email,
    subject: 'American Rider · Insurance status confirmation',
    text:
      'AMERICAN RIDER — NATIONAL TRANSPORTATION\n\n' +
      'Insurance Status Confirmation\n\n' +
      `The insured has authorized American Rider to request limited policy-status information for eligibility purposes. Please confirm whether the commercial automobile policy for ${operatorName}, policy ending ${last4}, remains active and unchanged for transportation-network / for-hire passenger operations.\n\n` +
      'Use the secure confirmation link below. It asks only for current status and does not request premium, claims, payment method, or unrelated policy information.\n\n' +
      url + '\n\n' +
      'If your organization requires its own authorization form, reply to insurance@americanrider.app and American Rider will use that process instead.\n',
  });

  const nextMonitoring = {
    ...m,
    contact: { name: String(contact?.name || '').slice(0, 100), email, type: String(contact?.type || 'broker') },
    verificationRequestedAt: now,
    verificationRequestedTo: email,
    verificationRequestReason: reason,
    verificationRequestCount: attempt,
  };

  if (!sent.ok) {
    const issue = attempt >= 3 ? {
      kind: 'delivery_attempts_exhausted',
      at: now,
      source: String(contact?.type || 'broker').slice(0, 20),
      contactEmail: email,
      note: String(sent.reason || 'Delivery failed').slice(0, 500),
    } : m.verificationIssue || null;
    await requestRef.set({
      deliveryStatus: 'failed',
      deliveryFailedAt: now,
      deliveryFailure: String(sent.reason || 'Confirmation request could not be sent.').slice(0, 500),
    }, { merge: true });
    await db.collection('users').doc(String(uid)).set({
      insuranceMonitoring: { ...nextMonitoring, verificationIssue: issue },
    }, { merge: true });
    await db.collection('audit_log').add({
      at: now,
      subject: String(uid),
      actor: { name: 'American Rider', method: 'insurance_monitor' },
      action: 'insurance_verification_delivery_failed',
      requestId: tokenHash,
      contactEmail: email,
      attempt,
      reason: String(sent.reason || '').slice(0, 500),
      resultingEligibility: continuingStatus({ ...(user || {}), insuranceMonitoring: { ...nextMonitoring, verificationIssue: issue } }, now),
    }).catch(() => {});
    if (attempt >= 3) {
      await fileTicket({
        uid: String(uid),
        email: user?.email || null,
        description: `Insurance status verification failed three times for ${email}. Last delivery result: ${String(sent.reason || 'unknown failure').slice(0, 500)}`,
        trip: null,
        reason: 'insurance verification delivery exhausted',
        kind: 'support',
        category: 'operator-insurance',
      }).catch(() => {});
    }
    return { ok: false, reason: sent.reason || 'Confirmation request could not be sent.' };
  }

  await requestRef.set({
    deliveryStatus: 'accepted',
    deliveryAcceptedAt: now,
    providerMessageId: sent.id || null,
  }, { merge: true });
  await db.collection('users').doc(String(uid)).set({
    insuranceMonitoring: nextMonitoring,
  }, { merge: true });
  await db.collection('audit_log').add({
    at: now,
    subject: String(uid),
    actor: { name: 'American Rider', method: 'insurance_monitor' },
    action: 'insurance_verification_delivery_accepted',
    requestId: tokenHash,
    contactEmail: email,
    attempt,
    providerMessageId: sent.id || null,
    resultingEligibility: continuingStatus({ ...(user || {}), insuranceMonitoring: nextMonitoring }, now),
  }).catch(() => {});
  return { ok: true, expiresAt, providerMessageId: sent.id || null };
}

// --- Continuing Operator insurance status. ------------------------------------------------
//
// The Operator's uploaded declarations page remains the qualification evidence. This layer is
// deliberately carrier-neutral: a local livery broker, surplus-lines placement, regional
// commercial carrier, or national carrier may all be used. What matters is compliant coverage
// plus sufficiently fresh status evidence.
//
// A monthly Operator attestation is useful but never refreshes the independent-verification
// timestamp. Independent confirmation may come from a carrier/broker, a monitoring network, or
// an authenticated operations review of carrier/broker evidence.
app.get('/operator/insurance/config', requireAuth, LIMITS.qualification, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  try {
    const snap = await db.collection('users').doc(String(req.uid)).get();
    const u = snap.exists ? snap.data() : {};
    const market = operatingMarketOf(u);
    const rule = insuranceForMarket(market);
    if (!rule) {
      return res.status(409).json({
        error: market
          ? `Insurance requirements for ${market.state} have not yet been activated.`
          : 'Choose your operating market before viewing insurance requirements.',
        code: 'insurance_jurisdiction_not_configured',
      });
    }
    return res.json(publicInsuranceConfig(rule));
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
});

app.post('/operator/insurance/authorize-status', requireAuth, LIMITS.qualification, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  try {
    const ref = db.collection('users').doc(String(req.uid));
    const snap = await ref.get();
    const u = snap.exists ? snap.data() : {};
    if (!u?.documents?.insurance || u.documents.insurance.verdict !== 'accept') {
      return res.status(409).json({ error: 'A qualifying insurance policy must be verified first.', code: 'insurance_document_required' });
    }
    const m = u.insuranceMonitoring || {};
    const authorization = {
      acceptedAt: Date.now(),
      version: '2026-09-26-v1',
      scope: 'American Rider may request from the insurer, licensed agent, broker, MGA, or authorized monitoring provider only the current status, cancellation/nonrenewal status, material coverage changes, covered vehicle status, policy effective dates, and coverage terms needed to confirm Operator eligibility.',
    };
    await ref.set({ insuranceMonitoring: { ...m, statusAuthorization: authorization } }, { merge: true });
    return res.json({ ok: true, authorization });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
});

app.get('/operator/insurance/status', requireAuth, LIMITS.qualification, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  try {
    const snap = await db.collection('users').doc(String(req.uid)).get();
    const u = snap.exists ? snap.data() : {};
    return res.json({ ...continuingStatus(u), contact: u.insuranceMonitoring?.contact || null, authorized: !!u.insuranceMonitoring?.statusAuthorization?.acceptedAt, verificationIssue: u.insuranceMonitoring?.verificationIssue || null, instructions: providerInstructions() });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
});

app.post('/operator/insurance/attest', requireAuth, LIMITS.qualification, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  try {
    const ref = db.collection('users').doc(String(req.uid));
    const auditRef = db.collection('audit_log').doc();
    const now = Date.now();
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const u = snap.exists ? snap.data() : {};
      if (!u?.documents?.insurance || u.documents.insurance.verdict !== 'accept') {
        return { error: 'A qualifying insurance policy must be verified first.', code: 'insurance_document_required', status: 409 };
      }
      const m = u.insuranceMonitoring || {};
      const verifiedAt = Number(m.lastVerifiedAt) || 0;
      if (!verifiedAt) return { error: 'Current insurance status has not been independently verified.', code: 'insurance_status_unverified', status: 409 };
      const dueAt = verifiedAt + STATUS_DUE_MS;
      const graceUntil = verifiedAt + STATUS_MAX_AGE_MS;
      if (now <= dueAt) return { error: 'No Operator confirmation is required yet.', code: 'insurance_attestation_not_due', status: 409 };
      if (now > graceUntil) return { error: 'Independent insurance confirmation is overdue.', code: 'insurance_status_stale', status: 409 };
      if (Number(m.operatorAttestedAt) >= dueAt) return { error: 'This verification cycle has already been confirmed.', code: 'insurance_attestation_already_recorded', status: 409 };

      const updated = applyOperatorAttestation(m, now);
      const resulting = continuingStatus({ ...u, insuranceMonitoring: updated }, now);
      tx.set(ref, { insuranceMonitoring: updated }, { merge: true });
      tx.set(auditRef, {
        at: now,
        subject: String(req.uid),
        actor: { uid: String(req.uid), method: 'operator_session' },
        action: 'insurance_operator_attestation',
        verificationDueAt: dueAt,
        graceUntil,
        resultingEligibility: resulting,
      });
      return { updated, u, resulting };
    });
    if (result.error) return res.status(result.status || 409).json({ error: result.error, code: result.code });
    return res.json({ ...result.resulting, contact: result.updated.contact || null });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
});

app.post('/operator/insurance/request-confirmation', requireAuth, LIMITS.document, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  const name = String(req.body?.name || '').trim().slice(0, 100);
  const type = ['agent', 'broker', 'carrier', 'mga'].includes(String(req.body?.type || '').toLowerCase())
    ? String(req.body.type).toLowerCase() : 'broker';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter the email address of the insurer, agent, or broker.', code: 'insurance_contact_email' });
  }
  try {
    const snap = await db.collection('users').doc(String(req.uid)).get();
    const u = snap.exists ? snap.data() : {};
    const out = await issueInsuranceConfirmationRequest({
      uid: req.uid,
      user: u,
      contact: { name, email, type },
      reason: 'operator_requested',
    });
    if (!out.ok) return res.status(out.reason?.includes('authorization') ? 409 : 502).json({ error: out.reason });
    return res.json({ ok: true, expiresAt: out.expiresAt });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
});

// Secure third-party confirmation. Possession of the random, single-use token sent to the
// stored insurer/broker address is the authentication factor. It exposes only masked policy
// identity and the minimum status choices needed for eligibility.
app.get('/insurance/status-confirmation', async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).type('html').send(page('Insurance status', '<h1>Unavailable</h1>'));
  const token = String(req.query?.token || '');
  const hash = token ? crypto.createHash('sha256').update(token).digest('hex') : '';
  const snap = hash ? await db.collection('insurance_status_requests').doc(hash).get().catch(() => null) : null;
  const row = snap?.exists ? snap.data() : null;
  const invalid = !row || row.usedAt || Number(row.expiresAt) < Date.now();
  if (invalid) {
    return res.status(410).type('html').send(page('Insurance status', '<h1>This confirmation link is no longer active.</h1>'));
  }
  const body =
    '<h1>Insurance Status Confirmation</h1>' +
    '<p class="lede">American Rider is requesting only the current status needed to confirm Operator eligibility.</p>' +
    '<section><p>Policy ending <strong>' + String(row.policyLast4 || '').replace(/[^A-Za-z0-9]/g, '') + '</strong></p>' +
    '<form method="post" action="/insurance/status-confirmation">' +
    '<input type="hidden" name="token" value="' + token.replace(/["<>&]/g, '') + '">' +
    '<label>Status<br><select name="status" required style="margin-top:8px;padding:12px;border-radius:10px;">' +
    '<option value="verified_active">Active and unchanged</option>' +
    '<option value="pending_cancellation">Pending cancellation</option>' +
    '<option value="cancelled">Cancelled</option>' +
    '<option value="nonrenewed">Nonrenewed</option>' +
    '<option value="coverage_reduced">Coverage materially changed or reduced</option>' +
    '<option value="vehicle_removed">Covered vehicle removed</option>' +
    '<option value="requires_release">Our organization requires its own signed authorization/release form</option>' +
    '<option value="requires_portal">Our organization requires verification through its own portal or process</option>' +
    '<option value="unable_to_verify">We cannot provide status through this request</option>' +
    '</select></label><br><br>' +
    '<label>Optional note<br><textarea name="note" maxlength="500" rows="4" style="width:100%;margin-top:8px;"></textarea></label>' +
    '<button type="submit" class="cta" style="border:0;cursor:pointer;">Submit confirmation</button>' +
    '</form></section>';
  return res.type('html').send(page('Insurance status', body));
});

app.post('/insurance/status-confirmation', express.urlencoded({ extended: false }), async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).type('html').send(page('Insurance status', '<h1>Unavailable</h1>'));
  const token = String(req.body?.token || '');
  const hash = token ? crypto.createHash('sha256').update(token).digest('hex') : '';
  const requestRef = hash ? db.collection('insurance_status_requests').doc(hash) : null;
  const allowed = new Set(['verified_active', 'pending_cancellation', 'cancelled', 'nonrenewed', 'coverage_reduced', 'vehicle_removed', 'requires_release', 'requires_portal', 'unable_to_verify']);
  const status = String(req.body?.status || '');
  if (!requestRef || !allowed.has(status)) {
    return res.status(410).type('html').send(page('Insurance status', '<h1>This confirmation cannot be accepted.</h1>'));
  }

  const note = String(req.body?.note || '').trim().slice(0, 500) || null;
  const processStatuses = new Set(['requires_release', 'requires_portal', 'unable_to_verify']);
  const now = Date.now();

  try {
    const result = await db.runTransaction(async (tx) => {
      const requestSnap = await tx.get(requestRef);
      if (!requestSnap.exists) return { invalid: true };
      const row = requestSnap.data() || {};
      if (row.usedAt || Number(row.expiresAt) < now) return { invalid: true };

      const userRef = db.collection('users').doc(String(row.uid));
      const userSnap = await tx.get(userRef);
      const u = userSnap.exists ? userSnap.data() : {};
      const actor = { name: row.email, method: 'secure_email_link' };
      const auditRef = db.collection('audit_log').doc();

      if (processStatuses.has(status)) {
        const issue = {
          kind: status,
          at: now,
          source: row.contactType || 'broker',
          contactEmail: row.email,
          note,
        };
        const monitoring = {
          ...(u.insuranceMonitoring || {}),
          verificationIssue: issue,
        };
        const resultingEligibility = continuingStatus({ ...u, insuranceMonitoring: monitoring }, now);

        tx.set(userRef, { insuranceMonitoring: monitoring }, { merge: true });
        tx.set(requestRef, { usedAt: now, result: status }, { merge: true });
        tx.set(auditRef, {
          at: now,
          subject: String(row.uid),
          actor,
          action: 'insurance_verification_process_exception',
          status,
          source: row.contactType || 'broker',
          requestId: hash,
          note,
          resultingEligibility,
        });
        return { invalid: false, process: true, row, resultingEligibility };
      }

      const updated = applyIndependentConfirmation(u.insuranceMonitoring, {
        status,
        source: row.contactType || 'broker',
        actor,
        note,
        now,
      });
      updated.verificationRequestCount = 0;
      updated.verificationIssue = null;
      const resultingEligibility = continuingStatus({ ...u, insuranceMonitoring: updated }, now);

      tx.set(userRef, { insuranceMonitoring: updated }, { merge: true });
      tx.set(requestRef, { usedAt: now, result: status }, { merge: true });
      tx.set(auditRef, {
        at: now,
        subject: String(row.uid),
        actor,
        action: 'insurance_status_confirmation',
        status,
        source: row.contactType || 'broker',
        requestId: hash,
        note,
        resultingEligibility,
      });
      if (status !== 'verified_active') {
        tx.set(db.collection('operators').doc(String(row.uid)), {
          available: false,
          offDutyReason: `insurance_${status}`,
          offDutyAt: now,
        }, { merge: true });
      }
      return { invalid: false, process: false, row, resultingEligibility };
    });

    if (result.invalid) {
      return res.status(410).type('html').send(page('Insurance status', '<h1>This confirmation cannot be accepted.</h1>'));
    }

    if (result.process) {
      await notify?.({
        uid: String(result.row.uid),
        kind: 'insurance_verification_process',
        title: 'Insurance verification needs one more step',
        body: status === 'requires_release'
          ? 'Your insurer requires its own authorization form. American Rider Operator Relations will guide the next step.'
          : status === 'requires_portal'
            ? 'Your insurer requires its own verification process. American Rider Operator Relations will guide the next step.'
            : 'Your insurer could not confirm status through the standard request. American Rider Operator Relations will guide the next step.',
        data: { screen: '/operator/insurance' },
      }).catch(() => {});
      return res.type('html').send(page('Insurance status', '<h1>Process noted.</h1><p class="lede">Thank you. American Rider will use the verification process you identified.</p>'));
    }

    return res.type('html').send(page('Insurance status', '<h1>Confirmation received.</h1><p class="lede">Thank you. No further action is required on this request.</p>'));
  } catch (e) {
    return res.status(502).type('html').send(page('Insurance status', '<h1>Could not record confirmation.</h1>'));
  }
});

// --- Qualification: automatic, exception-driven. -------------------------------------------
//
// An operator is qualified when every qualification gate in backend/qualification.js passes —
// assessed here, on each document reading, and at every go-on-duty and acceptance. No person
// clicks anything on the normal path; /ops handles only the exceptions.

/** The network half of an assessment: Firebase Auth, and (for duty) Stripe. */
async function qualificationChecks(uid, user) {
  const disabled = await accountDisabled(uid);
  const stripe = await connectAccountStatus(user?.stripeAccountId || null);
  return { account: { disabled }, payouts: { enabled: !!stripe.payoutsEnabled } };
}

const qualificationBody = (a) => ({
  status: a.status,
  qualified: a.qualified,
  // What the operator can act on, in their own words. Machine-readable codes alongside.
  blockers: a.blockers.filter((x) => x.gate === 'qualification').map(({ code, kind, item, reason }) => ({ code, kind, item, reason })),
});

app.get('/operator/qualification', requireAuth, LIMITS.qualification, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  try {
    const a = await assessAndRecord({ db, uid: req.uid, checks: qualificationChecks, liveMoney: operationalMode });
    res.json(qualificationBody(a));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// FOR BUILDS 40 AND EARLIER, whose review screen asks this path. Same assessment, old words.
app.get('/operator/commission', requireAuth, LIMITS.qualification, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  try {
    const a = await assessAndRecord({ db, uid: req.uid, checks: qualificationChecks, liveMoney: operationalMode });
    const legacy = { qualified: 'approved', exception: 'pending', refused: 'refused', suspended: 'refused', incomplete: 'none' };
    res.json({ status: legacy[a.status], reason: a.qualified ? null : a.blockers[0]?.reason || null });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// The operator says they are done. Kept as the app's explicit moment, but it decides nothing a
// document reading has not already decided: it assesses and reports.
app.post('/operator/qualification/submit', requireAuth, LIMITS.qualification, requireActiveOperatingMarket, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  try {
    const a = await assessAndRecord({ db, uid: req.uid, checks: qualificationChecks, liveMoney: operationalMode });
    if (a.status === 'incomplete') {
      const first = a.blockers.find((x) => x.gate === 'qualification');
      return res.status(409).json({ code: first?.code || 'incomplete', error: first?.reason || 'Qualification is not complete.', ...qualificationBody(a) });
    }
    res.json(qualificationBody(a));
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
    // NOT STAMPED ON THE FLEET RECORD HERE. A renewal refused for a stale disclosure takes the
    // operator off duty on the phone, but the server record stays `available` until presence
    // goes stale. Stamping now would make that record dispatchable while the phone says off
    // duty. The operator goes back on duty through /operator/online, which stamps the version
    // from this acknowledgement.
    res.json({ ok: true, version: DISCLOSURE_VERSION, lang: shown.lang });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// --- Operator screening. -------------------------------------------------------------------
//
// Screening procurement is provider-neutral. The Operator pays the approved consumer
// reporting agency directly; American Rider does not sell or mark up screening. Qualification
// depends on authoritative provider evidence received and adjudicated under the active
// jurisdiction's rules. An Operator declaration or uploaded consumer copy is never authority.
app.get('/operator/screening', requireAuth, async (req, res) => {
  const db = adminDb();
  if (!db) return res.json({ ok: false, provider: 'external', screening: null, reason: adminStatus().reason });
  try {
    const snap = await db.collection('users').doc(String(req.uid)).get();
    const user = snap.exists ? snap.data() : {};
    const market = operatingMarketOf(user);
    res.json({
      ok: true,
      provider: 'external',
      providerUrl: screeningReady() ? readKey('SCREENING_PROVIDER_URL') : null,
      jurisdiction: market?.state ? { state: market.state } : null,
      screening: user.screening || null,
    });
  } catch (e) {
    res.json({ ok: false, provider: 'external', screening: null, reason: e.message });
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
app.post('/operator/screening/existing', requireAuth, LIMITS.screening, requireActiveOperatingMarket, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });

  const agency = String(req.body?.agency || '').slice(0, 120).trim();
  const issuedAt = Number(req.body?.issuedAt || 0);
  const elements = Array.isArray(req.body?.elements) ? req.body.elements.slice(0, 6) : [];
  const consent = req.body?.consent === true;
  if (!agency || !consent) {
    return res.status(400).json({ error: 'The screening company and your written instruction are required.' });
  }

  try {
    const transferTo = 'support@americanrider.app';
    await db.collection('users').doc(String(req.uid)).set(
      {
        screening: {
          decision: 'awaiting_agency',
          provider: agency,
          transferTo,
          declaredIssuedAt: issuedAt || null,
          declaredElements: elements,
          consentAt: Date.now(),
          consentText:
            'I instruct the named screening company to release my most recent background screening report to American Rider.',
          summary: 'Waiting for the screening provider to send the authoritative report for review.',
        },
      },
      { merge: true },
    );

    const filed = await fileTicket({
      uid: req.uid,
      email: req.email,
      kind: 'support',
      reason: 'Operator screening — review existing provider report',
      description:
        'The Operator instructed ' + agency + ' to release the existing screening report directly to American Rider. ' +
        'Declared issue date: ' + (issuedAt ? new Date(issuedAt).toISOString().slice(0, 10) : 'not provided') + '. ' +
        'Declared components: ' + (elements.join(', ') || 'not provided') + '. ' +
        'Do not qualify from the Operator declaration. Authenticate the provider report, compare each component with the active jurisdiction requirements, preserve every qualifying component, and request only any missing or expired component.',
    });

    const caseNo = filed?.caseNo || null;
    if (caseNo) {
      await db.collection('users').doc(String(req.uid)).set(
        { screening: { transferCaseNo: caseNo } },
        { merge: true },
      );
    }
    res.json({
      ok: true,
      note: 'Request recorded. We will preserve every qualifying component and ask only for anything still required.',
      transferTo,
      transferCaseNo: caseNo,
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});


// Screening is procured outside American Rider. The Operator pays the approved screening
// provider directly. American Rider receives and reviews authoritative provider evidence;
// it does not create a Stripe charge or purchase a screening on the Operator's behalf.

// The screening company's result arrives on /checkr/webhook — mounted ABOVE express.json()
// with the Stripe webhook, because its signature is an HMAC over the raw bytes. The event
// handling itself (fetch the report's screenings, adjudicate by the statutory standard,
// record the decision, handle expired invitations) lives in checkr.js.

// --- The operations view. -----------------------------------------------------------------
mountOps(app, express, { checks: qualificationChecks, liveMoney: () => operationalMode });

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
// Found in the 19 Sept 2026 product sweep (docs/SWEEP-2026-09-19.md, F-A).
//
// The match now happens here, once, against the fleet read with admin access, through the same
// matchOperator every other caller uses — so a gate added to that function protects every path
// at once, which is the whole reason it is a function.
// Dispatch reads only Operators who currently claim availability. This is a Firestore-indexed
// prefilter, not an eligibility decision: matchOperator() remains the final authority for
// presence freshness, insurance, disclosure, screening, commissioning, documents, Travel
// class and distance. Keeping those rules in one gate prevents query optimization from becoming
// a second qualification system.
async function availableOperatorCandidates(db, pickup, excludeIds = new Set()) {
  return nearbyOperatorCandidates(db, pickup, { excludeIds });
}

// Human-facing Travel Numbers identify the authoritative pickup market, never a client label.
// The pickup market is resolved from Census county geometry in markets.js.
function travelNumberFor(documentId, pickup) {
  const market = marketFor(pickup);
  const code = ({ '12086': 'MIA', '12011': 'FLL', '12099': 'PBI' })[String(market?.fips || '')] || 'SFL';
  return 'AR-' + String(documentId).slice(0, 8).toUpperCase() + '-' + code;
}

// The immutable, server-priced booking exists before Stripe's PaymentSheet is opened.
// A duplicate device request returns the same ride id, not another PaymentIntent/travel.
app.post('/travel/prepare', requireAuth, LIMITS.dispatch, requireFreshAuth, requireOperationalReadiness, requireAdmittedPickup, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  const b = req.body || {};
  const key = String(b.bookingKey || '');
  if (!/^[\w-]{16,100}$/.test(key)) return res.status(400).json({ error: 'Booking key is required', code: 'booking_key_required' });
  const pickup = { lat: Number(b.pickup?.lat), lng: Number(b.pickup?.lng) };
  const destinationPoint = { lat: Number(b.destinationPoint?.lat), lng: Number(b.destinationPoint?.lng) };
  if (!Number.isFinite(pickup.lat) || !Number.isFinite(pickup.lng) ||
      !Number.isFinite(destinationPoint.lat) || !Number.isFinite(destinationPoint.lng)) {
    return res.status(400).json({ error: 'Both real pickup and destination coordinates are required', code: 'route_geometry_required' });
  }
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify({
    pickup, destinationPoint, dep: b.dep, dest: b.dest, cls: b.cls,
    journeyNo: b.journeyNo, partyMode: b.partyMode, familyLinkId: b.familyLinkId,
    travelerName: b.travelerName, cabinPreferences: b.cabinPreferences,
  })).digest('hex');
  const id = bookingId(req.uid, key);
  try {
    const existing = await db.collection('rides').doc(id).get();
    if (existing.exists) {
      const prior = existing.data();
      if (prior.bookingFingerprint !== fingerprint || String(prior.travelerUid) !== String(req.uid)) {
        return res.status(409).json({ error: 'This booking key belongs to a different Travel', code: 'booking_conflict' });
      }
      return res.json({ rideId: id, tripNo: prior.tripNo, status: prior.status, amountCents: prior.costCents, reused: true });
    }
    if (!servesPoint(pickup)) return res.status(409).json({ error: outsideMarketMessage('pickup'), code: 'outside_market' });
    const priced = await authoritativeFare({
      body: { pickup, dest: destinationPoint, destination: b.dest, travelClass: b.cls, journeyNo: b.journeyNo },
      uid: req.uid, email: req.email, db, cardCountryFor: defaultCardCountry,
    });
    if (!priced || priced.invalidJourney || priced.outsideMarket || priced.permitRequired) {
      return res.status(409).json({ error: priced?.reason || 'The Travel cannot be priced', code: priced?.permitRequired ? 'permit_required' : 'quote_unavailable' });
    }
    if (!['routed-distance', 'estimated-distance'].includes(priced.pricedBy)) {
      return res.status(409).json({ error: 'The road distance cannot be verified', code: 'route_geometry_required' });
    }
    if (priced.tollStatus === 'unknown') return res.status(503).json({ error: 'Toll price unavailable', code: 'toll_unavailable' });
    const partyResult = priced.journey?.party
      ? { ok: true, party: priced.journey.party }
      : await normalizeParty(b, { uid: req.uid, name: req.name || b.bookerName || b.travelerName || '' });
    if (!partyResult.ok) return res.status(400).json({ error: partyResult.error, code: partyResult.code });
    const party = partyResult.party;
    if (party.teen && !teenPinReady()) return res.status(503).json({ error: 'Teen pickup security is unavailable', code: 'teen_pin_unavailable' });
    const raw = b.cabinPreferences && typeof b.cabinPreferences === 'object' ? b.cabinPreferences : {};
    const cabinPreferences = {
      climate: ['Cool', 'Moderate', 'Warm'].includes(String(raw.climate)) ? String(raw.climate) : 'Moderate',
      music: ['None', 'Traveler Choice'].includes(String(raw.music)) ? String(raw.music) : 'None',
      quiet: raw.quiet !== false, charging: raw.charging === true, luggage: raw.luggage === true,
    };
    // Availability is a pre-charge hint, not a reservation. The post-payment transaction is
    // authoritative and can still find the fleet gone; then the paid Travel is refund-owed.
    const fleet = await availableOperatorCandidates(db, pickup);
    if (!matchOperator(fleet, pickup, String(b.cls || 'Standard'), { requireScreening: screeningReady() })) {
      return res.status(409).json({ error: 'No eligible Operator is available; nothing was charged', code: 'no_operator' });
    }
    const tripNo = travelNumberFor(id, pickup);
    const outcome = await prepareBooking({ db, uid: req.uid, key, fingerprint, record: {
      tripNo, travelerName: party.travelerName.slice(0, 60), party,
      dep: String(b.dep || '').slice(0, 60), dest: String(b.dest || '').slice(0, 60),
      pickupLat: pickup.lat, pickupLng: pickup.lng,
      destinationLat: destinationPoint.lat, destinationLng: destinationPoint.lng,
      travelClass: String(b.cls || 'Standard'), travelCostCents: priced.travelCostCents,
      costCents: priced.travelerPays, miles: priced.miles,
      governmentFeeCents: priced.governmentFeeCents,
      tollCents: Math.max(0, Number(priced.tollCents) || 0), feeLines: priced.feeLines,
      pricedBy: priced.pricedBy, cardCountry: priced.cardCountry,
      journey: priced.journey || null, cabinPreferences,
    } });
    if (party.teen && [200,201].includes(outcome.status)) {
      await provisionTeenPin({ rideRef: db.collection('rides').doc(id), rideId: id, party });
    }
    return res.status(outcome.status).json({ ...outcome.body, amountCents: priced.travelerPays });
  } catch (e) { return res.status(502).json({ error: e.message, code: 'prepare_unavailable' }); }
});

// This endpoint no longer creates a fresh ride or trusts a client-provided fare, Operator or
// payment assertion. It can only offer the existing, freshly provider-confirmed paid Travel.
app.post('/travel/dispatch', requireAuth, LIMITS.dispatch, requireFreshAuth, requireOperationalReadiness, requireAdmittedTravel, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  const id = String(req.body?.rideId || '');
  if (!/^[a-f0-9]{40}$/.test(id)) return res.status(400).json({ error: 'Prepared Travel id is required', code: 'ride_required' });
  try {
    const ref = db.collection('rides').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'No such Travel', code: 'no_travel' });
    const ride = snap.data();
    if (String(ride.travelerUid) !== String(req.uid)) return res.status(403).json({ error: 'Not your Travel', code: 'not_yours' });
    if (!['awaiting_payment', 'awaiting_assignment', 'assigned'].includes(ride.status)) {
      return res.status(409).json({ error: 'Travel is no longer dispatchable', code: 'travel_not_dispatchable' });
    }
    const payment = await verifiedTravelPayment(ride.paymentIntentId);
    if (!paymentMatches(ride, payment, req.uid, id)) {
      return res.status(409).json({ error: 'Payment is not confirmed for this Travel', code: 'payment_unconfirmed' });
    }
    if (ride.party?.teen && !teenPinReady()) return res.status(503).json({ error: 'Teen pickup security is unavailable', code: 'teen_pin_unavailable' });
    const teen = await provisionTeenPin({ rideRef: ref, rideId: id, party: ride.party });
    const pickup = { lat: Number(ride.pickupLat), lng: Number(ride.pickupLng) };
    if (!servesPoint(pickup)) return res.status(409).json({ error: outsideMarketMessage('pickup'), code: 'outside_market' });
    let candidate = null;
    if (ride.status !== 'assigned') {
      const fleet = await availableOperatorCandidates(db, pickup);
      candidate = matchOperator(fleet, pickup, ride.travelClass, { requireScreening: screeningReady() });
    }
    const outcome = await assignPaidTravel({
      db, uid: req.uid, rideId: id, payment, candidate, requireScreening: screeningReady(),
    });
    if (outcome.status !== 200) return res.status(outcome.status).json(outcome.body);
    if (outcome.body.matched && !outcome.body.reused) {
      // Non-delivery cannot roll back the money/assignment transaction. The assignment sweep
      // retries missing notifications. The Teen code was provisioned before the offer.
      if (teen.required && ride.party?.teenUid) await notify({ uid: ride.party.teenUid, kind: 'teen_pickup_code', title: 'Your pickup code', body: `Give ${teen.pin} to your Operator after confirming the vehicle and Operator.`, data: { screen: '/ride', rideId: id, tripNo: ride.tripNo } });
      if (teen.required && ride.party?.guardianUid && ride.party.guardianUid !== ride.party.teenUid) {
        await notify({ uid: ride.party.guardianUid, kind: 'guardian_travel', title: 'Teen Travel assigned',
          body: `${ride.party.travelerName || 'Teen Traveler'}'s Travel has been assigned. You can follow it in American Rider.`,
          data: { screen: '/family', rideId: id, tripNo: ride.tripNo } });
      }
      await notify({ uid: outcome.body.matched.id, kind: 'travel_assigned', title: 'Travel assigned', body: `${ride.dep || 'Pickup'} to ${ride.dest || 'destination'}. Open to accept.`, data: { screen: '/operator', rideId: id, tripNo: ride.tripNo } });
      await ref.update({ notifiedOperatorAt: Date.now() });
    }
    return res.json(outcome.body);
  } catch (e) { return res.status(502).json({ error: e.message, code: 'dispatch_unavailable' }); }
});

// Cancel a scheduled reservation only while it is still a reservation. The transaction closes
// the race with the scheduler: once dispatch has advanced it, the Traveler must cancel the
// resulting Travel through the normal Travel cancellation/refund lifecycle.
app.delete('/travel/schedule/:id', requireAuth, requireFreshAuth, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  const ref = db.collection('scheduled_rides').doc(String(req.params.id || ''));
  try {
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { status: 404, body: { ok: false, code: 'not_found' } };
      const row = snap.data() || {};
      if (String(row.travelerUid || '') !== String(req.uid)) return { status: 403, body: { ok: false, code: 'forbidden' } };
      const status = String(row.status || 'reserved');
      if (status !== 'reserved') return { status: 409, body: { ok: false, code: 'already_advanced', status } };
      tx.update(ref, { status: 'cancelled', closedReason: 'Cancelled by Traveler.', cancelledAt: Date.now() });
      return { status: 200, body: { ok: true } };
    });
    return res.status(out.status).json(out.body);
  } catch (e) { return res.status(502).json({ ok: false, error: e.message }); }
});

// Create a scheduled reservation with the same server authority as immediate dispatch.
// The time and labels are traveler inputs. Fare, distance, fees and Travel Number are not.
app.post('/travel/schedule', requireAuth, LIMITS.dispatch, requireFreshAuth, requireOperationalReadiness, requireAdmittedPickup, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  const b = req.body || {};
  const pickup = { lat: Number(b.pickup?.lat), lng: Number(b.pickup?.lng) };
  const destinationPoint = { lat: Number(b.destinationPoint?.lat), lng: Number(b.destinationPoint?.lng) };
  const atMs = Number(b.atMs);
  if (!Number.isFinite(pickup.lat) || !Number.isFinite(pickup.lng) ||
      !Number.isFinite(destinationPoint.lat) || !Number.isFinite(destinationPoint.lng) ||
      !Number.isFinite(atMs)) {
    return res.status(400).json({ error: 'Pickup, destination and scheduled time require verified positions', code: 'route_geometry_required' });
  }
  if (atMs <= Date.now()) {
    return res.status(400).json({ error: 'Scheduled Travel must be set for a future time.', code: 'scheduled_time_required' });
  }
  const priced = await authoritativeFare({
    body: { pickup, dest: destinationPoint, destination: b.dest, travelClass: b.travelClass },
    uid: req.uid, email: req.email, db, cardCountryFor: defaultCardCountry,
  });
  if (priced?.invalidJourney) return res.status(409).json({ error: priced.reason, code: 'invalid_smart_journey' });
  if (priced?.route?.tollStatus === 'unknown') return res.status(503).json({ error: 'Toll pricing is temporarily unavailable.', code: 'toll_unavailable' });
  if (!priced || priced.outsideMarket || priced.permitRequired) {
    return res.status(409).json({ error: priced?.reason || 'The scheduled travel cannot be priced' });
  }
  if (!['routed-distance', 'estimated-distance'].includes(priced.pricedBy)) {
    return res.status(400).json({ error: 'A valid pickup and destination position are required to create Travel.', code: 'route_geometry_required' });
  }
  if (priced.tollStatus === 'unknown') {
    return res.status(503).json({ error: 'Toll cost could not be verified for this route.', code: 'toll_unavailable' });
  }
  const partyResult = await normalizeParty(b, { uid: req.uid, name: req.name || b.bookerName || b.travelerName || '' });
  if (!partyResult.ok) return res.status(400).json({ error: partyResult.error, code: partyResult.code });
  const party = partyResult.party;
  try {
    const ref = db.collection('scheduled_rides').doc();
    const tripNo = travelNumberFor(ref.id, pickup);
    const record = {
      travelerUid: String(req.uid), travelerName: party.travelerName.slice(0, 60), party,
      travelerEmail: req.email || '', when: String(b.when || '').slice(0, 40),
      time: String(b.time || '').slice(0, 12), period: b.period === 'AM' ? 'AM' : 'PM',
      arr: String(b.arr || '').slice(0, 80), dep: String(b.dep || '').slice(0, 60),
      dest: String(b.dest || '').slice(0, 60), pickupLat: pickup.lat, pickupLng: pickup.lng,
      destinationLat: Number.isFinite(destinationPoint.lat) ? destinationPoint.lat : null,
      destinationLng: Number.isFinite(destinationPoint.lng) ? destinationPoint.lng : null,
      travelClass: String(b.travelClass || 'Standard'), atMs,
      travelCostCents: priced.travelCostCents, costCents: priced.travelerPays,
      miles: priced.miles, governmentFeeCents: priced.governmentFeeCents,
      tollCents: Math.max(0, Number(priced.tollCents) || 0),
      feeLines: priced.feeLines, cardCountry: priced.cardCountry, tripNo,
      status: 'reserved', createdAt: Date.now(),
    };
    await ref.create(record);
    res.json({ id: ref.id, ...record });
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
app.post('/voice/token', requireAuth, LIMITS.voice, async (req, res) => {
  if (!voiceReady()) return res.status(503).json({ error: voiceReason(), code: 'voice_not_configured' });
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });

  const rideId = String(req.body?.rideId || '').trim();
  if (!rideId) return res.status(400).json({ error: 'rideId is required' });

  let authz;
  try {
    authz = await authorizeVoiceTravel({ db, uid: req.uid, rideId });
  } catch (e) {
    return res.status(502).json({ error: e.message, code: 'travel_unreadable' });
  }
  if (!authz.ok) return res.status(authz.status).json({ error: authz.error, code: authz.code });
  const out = voiceToken({ rideId, side: authz.side });
  if (!out.ok) return res.status(503).json({ error: out.error, code: out.code });
  return res.json({ token: out.token, identity: out.identity, side: authz.side, tripNo: authz.tripNo });
});

// POST /voice/connect — the TwiML Twilio fetches when a party places the call.
//
// TWILIO POSTS WHATEVER THE DEVICE DIALLED AND IT IS IGNORED. The destination is derived from
// the travel and the caller's own identity, so a tampered app cannot dial an arbitrary number
// through our account — which would be our telephone bill and somebody else's harassment.
app.post('/voice/connect', async (req, res) => {
  const from = String(req.body?.From || '');
  // 'ar_AR-2048-MIA_traveler' — the identity the token was minted with, which Twilio supplies
  // and the device cannot choose.
  const m = /^(?:client:)?ar_([^_]+)_(traveler|operator)$/.exec(from);
  if (!m) return res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>');
  const db = adminDb();
  if (!db) return res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>');
  try {
    const snap = await db.collection('rides').doc(m[1]).get();
    const ride = snap.exists ? snap.data() : null;
    if (!ride || !['assigned', 'accepted', 'arrived', 'onboard'].includes(String(ride.status))) {
      return res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>');
    }
    return res.type('text/xml').send(connectTwiml({ rideId: m[1], side: m[2] }));
  } catch {
    return res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>');
  }
});

app.get('/travel/teen-pickup/code', requireAuth, LIMITS.document, requireFreshAuth, async (req,res)=>{
  const id=String(req.query?.rideId||'');
  if(!/^[a-f0-9]{40}$/.test(id))return res.status(400).json({error:'Travel id is required'});
  if(!teenPinReady())return res.status(503).json({error:'Teen pickup security is unavailable',code:'teen_pin_unavailable'});
  const db=adminDb();if(!db)return res.status(503).json({error:adminStatus().reason});
  const snap=await db.collection('rides').doc(id).get();
  if(!snap.exists)return res.status(404).json({error:'No such Travel'});
  const ride=snap.data()||{},party=ride.party||{};
  if(party.teen!==true||![String(party.teenUid),String(party.guardianUid)].includes(String(req.uid)))return res.status(403).json({error:'Not authorized for this Teen Travel'});
  if(!['assigned','accepted','arrived'].includes(ride.status)||!ride.teenPickup?.required||ride.teenPickup.verifiedAt||Number(ride.teenPickup.failedAttempts||0)>=5)return res.status(409).json({error:'Pickup code is not available in this Travel state'});
  try{return res.json({rideId:id,tripNo:ride.tripNo||'',pin:pinForRide(id,ride.teenPickup.hash)});}
  catch{return res.status(503).json({error:'Pickup code needs secure assistance',code:'teen_pin_unavailable'});}
});
app.post('/travel/teen-pickup/verify', requireAuth, requireFreshAuth, async (req,res)=>{const out=await verifyTeenPin({rideId:req.body?.rideId,operatorUid:req.uid,pin:req.body?.pin});return res.status(out.status||500).json(out);});
// One server-stamped three-party thread. The client supplies words and the Travel id; the
// server derives every participant id from the Travel so nobody can forge a correspondent.
app.post('/travel/message', requireAuth, async (req,res)=>{
 const db=adminDb();if(!db)return res.status(503).json({error:adminStatus().reason});const rideId=String(req.body?.rideId||''),text=String(req.body?.text||'').trim().slice(0,2000);
 if(!rideId||!text)return res.status(400).json({error:'Travel and message text are required'});const snap=await db.collection('rides').doc(rideId).get();if(!snap.exists)return res.status(404).json({error:'No such Travel'});const r=snap.data()||{},uid=String(req.uid);
 const from=uid===String(r.travelerUid)?'traveler':uid===String(r.operatorId)?'operator':r.party?.teen===true&&uid===String(r.party?.guardianUid)?'guardian':null;
 if(!from)return res.status(403).json({error:'This account is not a participant in that Travel'});if(!['assigned','accepted','arrived','onboard'].includes(String(r.status))&&!req.body?.lostItemId)return res.status(409).json({error:'This Travel thread is closed'});
 await db.collection('messages').add({rideId,tripNo:r.tripNo||rideId,from,travelerUid:r.travelerUid||null,operatorId:r.operatorId||null,guardianUid:r.party?.teen?r.party.guardianUid||null:null,lostItemId:req.body?.lostItemId||null,text,createdAt:Date.now()});return res.json({ok:true});
});

// POST /travel/accept { rideId } — the operator accepts the travel offered to them.
//
// THE DEFECT THIS CLOSES. Acceptance was a Firestore write from the phone: `status: 'accepted'`,
// allowed by the rules for the operator on the record and checked against nothing else. The
// gates ran when the operator went on duty and when dispatch chose them, and never at the
// moment they took the travel. An operator whose disclosure version, approval, documents,
// insurance, screening, account or payouts had stopped standing after the offer could still
// accept it. firestore.rules no longer lets a phone write 'accepted'; this route is the only way.
//
// ORDER. The two checks that need the network (Firebase account, Stripe) run first. Then one
// transaction re-reads the travel, the operator's fleet record and their account record, runs
// operatorEligibility on what it read, and commits — so nothing it checked can change between
// the check and the write.
//
// A REFUSAL RELEASES THE TRAVEL. It stays `assigned`, marked `releasedAt`, and the operator is
// taken out of service; sweepAssignments re-offers it to somebody else on its next pass
// without waiting out the answer window. The traveler's payment and travel number stand.
app.post('/travel/accept', requireAuth, requireFreshAuth, requireOperationalReadiness, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  const rideId = String(req.body?.rideId || '');
  if (!rideId) return res.status(400).json({ error: 'rideId is required' });
  const uid = String(req.uid);
  const userRef = db.collection('users').doc(uid);

  // THE NETWORK HALF, checked immediately before the transaction: Firebase Auth (a disabled
  // account keeps a valid sign-in for up to an hour) and Stripe. Everything else is read inside
  // the transaction.
  let externals;
  try {
    const u = (await userRef.get()).data() || {};
    externals = await qualificationChecks(uid, u);
    const offered = await db.collection('rides').doc(rideId).get();
    if (offered.exists && offered.data()?.bookingFingerprint && String(offered.data().operatorId || '') === uid) {
      externals.payment = await verifiedTravelPayment(offered.data().paymentIntentId);
    }
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }

  try {
    const out = await acceptOffer({ db, uid, rideId, externals, liveMoney: operationalMode });
    res.status(out.status).json(out.body);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Operator progression is server-authoritative. Firestore rules no longer permit a phone to
// manufacture arrived/onboard/completed states or the payout queue marker.
app.post('/travel/progress', requireAuth, requireFreshAuth, requireOperationalReadiness, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });
  try {
    const out = await progressTravel({
      db,
      uid: req.uid,
      rideId: req.body?.rideId,
      status: req.body?.status,
    });
    return res.status(out.status).json(out.body);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
});

app.post('/travel/return-operator', requireAuth, LIMITS.dispatch, requireOperationalReadiness, async (req, res) => {
  const db = adminDb();
  if (!db) return res.status(503).json({ error: adminStatus().reason, code: 'no_admin_db' });

  const b = req.body || {};
  const itemId = String(b.lostItemId || '');
  const destination = { lat: Number(b.destination?.lat), lng: Number(b.destination?.lng) };
  if (!itemId) return res.status(400).json({ error: 'lostItemId is required' });
  if (!Number.isFinite(destination.lat) || !Number.isFinite(destination.lng)) {
    return res.status(400).json({ error: 'A return destination is required' });
  }

  let originalId;
  try {
    const relation = await lostItemTravel({ db, uid: req.uid, lostItemId: itemId });
    if (!relation.ok) return res.status(relation.status).json({ error: relation.error, code: relation.code });
    originalId = String(relation.ride.operatorId || '');
  } catch (e) {
    return res.status(502).json({ error: e.message, code: 'relationship_unreadable' });
  }

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
  const strip = (o, path, cents) => ({
    path, operator: { id: String(o.id), name: o.name || '' }, costCents: cents,
  });

  if (originalId) {
    const still = matchOperator(
      fleet.filter((o) => String(o.id) === originalId),
      destination,
      'Standard',
      { requireScreening: screeningReady() },
    );
    if (still) return res.json(strip(still.operator, 'original-operator', 0));
  }
  const next = matchOperator(
    fleet.filter((o) => String(o.id) !== originalId),
    destination,
    'Standard',
    { requireScreening: screeningReady() },
  );
  if (!next) return res.json({ path: null, operator: null });
  const priced = await authoritativeFare({
    body: { pickup: { lat: Number(next.operator.lat), lng: Number(next.operator.lng) }, dest: destination, travelClass: 'Standard' },
    uid: req.uid, email: req.email, db, cardCountryFor: defaultCardCountry,
  });
  if (priced?.invalidJourney) return res.status(409).json({ error: priced.reason, code: 'invalid_smart_journey' });
  if (!priced || priced.outsideMarket || priced.permitRequired) {
    return res.status(409).json({ error: 'The return travel cannot be priced' });
  }
  res.json(strip(next.operator, 'any-operator', priced.travelerPays));
});

app.post('/travel/announce', requireAuth, LIMITS.announce, async (req, res) => {
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
    const allowed = authorizeAnnouncement({ ride, uid: req.uid, event });
    if (!allowed.ok) return res.status(allowed.status).json({ error: allowed.error, code: allowed.code });

    // create() is atomic. Concurrent repeats race on this one document and only one wins.
    const claimed = await claimAnnouncement({ rideRef: ref, uid: req.uid, event });
    if (!claimed.ok) return res.json({ ok: true, duplicate: true, delivered: false });
    const claim = claimed.claim;

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
      if (ride.party?.teen && ride.party?.guardianUid && String(ride.party.guardianUid) !== String(ride.travelerUid)) await notify({ uid: ride.party.guardianUid, kind:'guardian_travel', title:'Operator arrived', body:`${ride.operatorName || 'The Operator'} has arrived for ${ride.party.travelerName || 'the Teen Traveler'}.`, data:{screen:'/family',rideId,tripNo:trip} });
      sent = await notify({
        uid: ride.travelerUid,
        kind: 'operator_arrived',
        title: 'Your operator has arrived',
        body: `${ride.operatorName || 'Your operator'} is at ${ride.dep || 'your pickup'}.`,
        data: { screen: '/ride', rideId, tripNo: trip },
      });
    } else {
      if (ride.party?.teen && ride.party?.guardianUid && String(ride.party.guardianUid) !== String(ride.travelerUid)) await notify({ uid: ride.party.guardianUid, kind:'guardian_travel', title:'Teen Travel complete', body:`${ride.party.travelerName || 'The Teen Traveler'} has reached ${ride.dest || 'the destination'}.`, data:{screen:'/family',rideId,tripNo:trip} });
      sent = await notify({
        uid: ride.travelerUid,
        kind: 'travel_complete',
        title: 'Travel complete',
        body: `${ride.dest || 'Your destination'}. Your receipt is ready.`,
        data: { screen: '/receipt', rideId, tripNo: trip },
      });
    }
    await claim.set({ delivered: !!sent?.ok, reason: sent?.reason || null, completedAt: Date.now() }, { merge: true });
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
    runLeasedSweeps()
      .then((r) => {
        lastSweep = { at: Date.now(), report: r };
      })
      .catch(() => {});
  }, 60 * 1000);
  if (typeof tick.unref === 'function') tick.unref();
  console.log('Scheduled travel + route monitoring: sweeping every 60s (also GET /scheduled/sweep)');
});
