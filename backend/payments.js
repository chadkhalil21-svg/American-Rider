// American Rider — core payment logic (Stripe Connect "destination charge").
// This is the money math + Stripe calls. The HTTP server (server.js) exposes it to the app.
//
// The traveler is charged ONE all-in price, split automatically:
//   99% of the travel cost → the operator's connected account
//   1% commission (no cap) + the platform fee → American Rider (the fee absorbs Stripe's cut)
//   The platform fee is the greater of $1.50 and 5% of the travel cost — see platformFeeCents().
//   A government fee (fees.js — an airport's or a port's per-pickup charge) is added to what
//   the traveler pays and held whole for remittance: it is neither the operator's nor ours.
//
// The secret key is read from an environment variable — it NEVER lives in this file or the repo.
//   e.g.  STRIPE_SECRET_KEY=sk_test_...   (test)   →   sk_live_...   (real, much later)

const Stripe = require('stripe');
const { readKey, hasInvalidHeaderChars, describeInvalidChars } = require('./env');

// Create the Stripe client only when a payment actually needs it. This lets the server boot
// (and serve /health and /quote) even before a secret key is configured — the newer Stripe SDK
// throws immediately if constructed without a key.
let _stripe = null;
function getStripe() {
  if (!_stripe) {
    // readKey() strips stray whitespace/newlines/quotes — see env.js for why that matters.
    const key = readKey('STRIPE_SECRET_KEY');
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set — add it to backend/.env');
    if (hasInvalidHeaderChars(key)) {
      throw new Error('STRIPE_SECRET_KEY contains characters that cannot be sent in a request header (' + describeInvalidChars(key).join(', ') + ') — re-paste it without line breaks or special characters');
    }
    // Free-tier hosting is slow to wake and can drop the first connection, so give Stripe a
    // longer window and more retries than the defaults. Stripe's API is idempotent for
    // retried requests, so this cannot double-charge a traveler.
    _stripe = Stripe(key, { timeout: 30000, maxNetworkRetries: 4 });
  }
  return _stripe;
}

const APP_FEE_CENTS = 150; // the platform fee's $1.50 minimum (the fee absorbs Stripe's processing cost)

// ——— THE PLATFORM FEE — TWO SCHEDULES, CHOSEN BY THE CARD'S ISSUING COUNTRY ——————————
// Chad, 20 Sept 2026: read Stripe's card.country and stop padding the domestic traveler for
// the cost of an international card. Before this there was ONE rule — the greater of $1.50
// and 5% — and 5% was the smallest round rate that covered the WORSE of the two cards. Every
// US traveler above a $30 fare was paying for that headroom.
//
//   domestic       (card.country === 'US')   the greater of $1.50 and 2.5% of the fare
//   international  (anything else)            the greater of $1.50 and 5%   of the fare
//
// WHY THESE TWO RATES, AND WHY NOT CHAD'S TIER TABLE. His note specified tiers keyed on the
// TOTAL ($0–60 → $1.50, $60–85 → $2.00, …, above $135 → 2% of total). Run against every fare
// it has three faults, none of them visible from the two points he spot-checked:
//
//   1. IT LOSES MONEY ABOVE $135. 2.0% of the total has to cover 2.9% of the total less the
//      1% commission on the fare, plus $0.30 — about 1.9% of the total plus $0.30. Those meet
//      at a $300 total, so EVERY total between $135 and ~$300 is underwater; worst case
//      −$0.21. The international 3.5% tier fails the same way for the same reason.
//   2. THE FEE IS AMBIGUOUS AT 492 FARES. A tier keyed on the total, where the total contains
//      the fee, is a fixed point rather than a lookup. At a $58.00 fare both $1.50 and $2.00
//      satisfy it, and 30 fares near $132 satisfy NEITHER.
//   3. IT REINTRODUCES THE PRICE STEP. A fare one cent over a boundary costs the traveler 50
//      cents more. AGENTS.md records continuity as the reason 5% was chosen over the old
//      break-even-plus-1%: "no step, no 'the price jumped because you went slightly further'".
//
// Keying on the FARE instead removes the circularity, and max($1.50, rate) instead of a table
// removes the step: 2.5% of $60 is exactly $1.50, and 5% of $30 is exactly $1.50, so each
// schedule is continuous where its two halves meet. Chad's $60 domestic boundary is preserved
// exactly; his $34 international boundary moves to $30, which is where continuity puts it.
// Checked every cent to $500 on both card types: nothing is negative, thinnest is $0.007
// domestic at a $59.99 fare and $0.10 international at $29.99.
//
// WHEN THE CARD IS NOT KNOWN YET the domestic schedule applies. See isDomesticCard().
//
// Mirrors src/data.ts platformFee(). THE TWO MUST NEVER DISAGREE, TO THE CENT: the app quotes
// with one and the server charges with the other, and a traveler who is quoted $64.54 and
// charged $64.55 has been shown two prices for one journey. payments.test.js checks every cent
// from $0 to $500 against the app's formula, on BOTH schedules.
const DOMESTIC_DIVISOR = 40; // 2.5% = 1/40
const INTERNATIONAL_DIVISOR = 20; // 5% = 1/20

/**
 * Which schedule a card falls under. Stripe writes the issuing country on
 * PaymentMethod.card.country as a two-letter code.
 *
 * UNKNOWN COUNTS AS DOMESTIC, AND THAT IS A DELIBERATE COST. The traveler is quoted one price
 * before they have chosen how to pay, and an amount that moves after a card is entered is the
 * defect AGENTS.md calls the most serious there is — "an amount and a doubt about that amount
 * must never render together". So the schedule is fixed at quote time from the traveler's
 * DEFAULT payment method, which Stripe has already told us about for anyone who has paid
 * before. Only a traveler with nothing on file is unknown, only on their first travel, and we
 * absorb the difference on that one travel rather than re-quoting them.
 *
 * Quoting the international schedule to the unknown instead would protect that first travel by
 * overcharging every US traveler's first travel — the larger group, to insure the smaller.
 */
function isDomesticCard(cardCountry) {
  if (cardCountry === undefined || cardCountry === null || cardCountry === '') return true;
  return String(cardCountry).trim().toUpperCase() === 'US';
}

/** What American Rider adds to the fare, in cents, on the schedule the card falls under. */
function platformFeeCents(travelCostCents, cardCountry) {
  // An integer divided by 20 or by 40 is correctly rounded, so ceil() is exact at every cent.
  // `Math.ceil(travelCostCents * 0.05)` is not (3060 * 0.05 is 153.00000000000003).
  const divisor = isDomesticCard(cardCountry) ? DOMESTIC_DIVISOR : INTERNATIONAL_DIVISOR;
  return Math.max(APP_FEE_CENTS, Math.ceil(travelCostCents / divisor));
}

// The 1% commission on the travel cost. NO CAP — matches src/data.ts coordinationFee
// exactly, and the two must never disagree or the app and the charge diverge.
// The $1 cap was removed 16 Aug 2026 (Chad): "there is no 1 dollar cap".
function commissionCents(travelCostCents) {
  return Math.floor(travelCostCents * 0.01);
}


// ——— CHARGEBACK DEFENCE ————————————————————————————————————————————————————————
// A disputed card payment costs ~$15 in Stripe fees AND the fare. At ~$1.50 a travel, ONE
// dispute erases ten successful ones — which makes this, not the processing rate, the real
// threat to the margin.
//
// The largest single cause of disputes is not fraud, it is "I do not recognise this
// charge": a bank statement showing an unfamiliar string weeks after the travel. So every
// charge carries a descriptor naming the company, and the metadata below is the evidence
// Stripe asks for if a dispute is opened anyway — the travel number, the route and the
// operator, all of which prove a service was actually delivered.
//
// 22 characters is Stripe's limit for the descriptor.
const STATEMENT_DESCRIPTOR = 'AMERICAN RIDER';

// Build the money breakdown for a ride. All values in integer cents (no float rounding bugs).
// ONE PLATFORM FEE PER SMART TRAVEL JOURNEY. A journey is two car travels around a transit
// leg. Leg 1 is charged exactly as any travel. Leg 2 names leg 1 (`journey.leg1FareCents`)
// and pays only the difference between the fee on the COMBINED car fare and the fee leg 1
// already carried — never below zero. src/state/RideContext.tsx `feeFor` shows the traveler
// the same arithmetic; the two must never disagree.
function journeyFeeCents(travelCostCents, journey, cardCountry) {
  const leg1 = Number(journey?.leg1FareCents);
  if (!Number.isFinite(leg1) || leg1 <= 0) return platformFeeCents(travelCostCents, cardCountry);
  return Math.max(
    0,
    platformFeeCents(leg1 + travelCostCents, cardCountry) - platformFeeCents(leg1, cardCountry),
  );
}

// A government fee line as fees.js writes it. Anything else — a negative, a fraction, a line
// with no payee — is not a fee and is dropped rather than charged.
const feeLine = (l) =>
  l && Number.isInteger(l.cents) && l.cents > 0 && typeof l.payee === 'string' && l.payee
    ? { id: String(l.id || ''), name: String(l.name || l.id || ''), payee: l.payee, cents: l.cents, ...(l.end ? { end: l.end } : {}) }
    : null;

/**
 * The money breakdown for a travel.
 *   governmentFees  fees.governmentFeesFor() lines, or nothing. They are added to what the
 *                   traveler pays and to nothing else: not the operator's 99% (the operator
 *                   does not drive them) and not platformTake (we do not keep them).
 *                   passThroughCents is the amount held for remittance; feeLines says to whom.
 */
function quote(travelCostCents, journey, governmentFees, cardCountry, tollCents) {
  const commission = commissionCents(travelCostCents);
  // The fee the traveler actually pays — the rule, not the bare $1.50 minimum.
  const appFee = journeyFeeCents(travelCostCents, journey, cardCountry);
  // American Rider keeps BOTH: the 1% taken out of the fare, and the fee added on top.
  // An earlier edit wrote `commission + (appFee - commission)`, which cancels to appFee and
  // silently dropped the commission from every total.
  const platformTake = commission + appFee;
  const feeLines = (Array.isArray(governmentFees) ? governmentFees : []).map(feeLine).filter(Boolean);
  const governmentFeeCents = feeLines.reduce((sum, l) => sum + l.cents, 0);

  // ——— TOLLS (Chad, 20 Sept 2026) ———————————————————————————————————————————————
  // A THIRD KIND OF MONEY, and it behaves like neither of the other two.
  //
  //   the platform fee   the traveler pays it, WE keep it, never itemised
  //   a government fee   the traveler pays it, a PUBLIC BODY is owed it, itemised
  //   a toll             the traveler pays it, the OPERATOR is reimbursed it, itemised
  //
  // Until today a toll came out of the operator's 99%: the Rickenbacker Causeway and every
  // expressway toll was a cost of doing the travel, borne by the person driving it. Uber and
  // Lyft both add tolls to the fare, so the operator was absorbing something no competitor
  // asks their drivers to absorb.
  //
  // ON TOP OF THE 99%, NOT INSIDE IT. The commission is 1% of the travel fare and a toll is
  // not fare, so no commission is taken on it and it is added to operatorGets whole. The
  // platform's take is identical with tolls and without — which is the test of whether this is
  // a pass-through or a quiet margin.
  const tolls = Number.isInteger(tollCents) && tollCents > 0 ? tollCents : 0;
  const operatorGets = travelCostCents - commission + tolls; // 99% of the fare, plus the toll back

  const travelerPays = travelCostCents + appFee + governmentFeeCents + tolls; // the ONE all-in price
  return {
    travelerPays,
    operatorGets,
    platformTake,
    commission,
    appFee,
    governmentFeeCents,
    tollCents: tolls,
    // What is collected from the traveler and owed onward rather than kept: the public bodies
    // AND the operator's toll. remittance.js sums the fee lines by payee; the toll is settled
    // through the operator's own transfer, which is why it is counted here but not a fee line.
    passThroughCents: governmentFeeCents + tolls,
    feeLines,
  };
}

// REAL APP FLOW: create a PaymentIntent and hand its client secret back to the app. The app
// then collects the traveler's card on the phone (Stripe's PaymentSheet) and confirms it there,
// so the card details never touch our server. This is the safe, standard mobile flow.
/**
 * One Stripe Customer per traveler, so saved cards survive between travels.
 *
 * Keyed on the Firebase uid in metadata rather than on email: an email can change hands, a
 * uid cannot, and this is the record a refund's ownership check ultimately rests on.
 */
async function customerForTraveler({ uid, email }) {
  const stripe = getStripe();
  const found = await stripe.customers.search({
    query: `metadata['uid']:'${String(uid).replace(/'/g, '')}'`,
    limit: 1,
  });
  if (found.data[0]) return found.data[0];
  return stripe.customers.create({ email: email || undefined, metadata: { uid: String(uid) } });
}

// ——— THE TRAVELER'S SAVED PAYMENT METHODS ———————————————————————————————————————————
// Read from Stripe's record of the Customer, never typed into the app. The app shows exactly
// these rows (Chad, 14 Sept 2026: the screen must carry real payment management, not text).

/** One saved method as the app shows it: brand, last four, expiry, the wallet it came through
 *  (Apple Pay, Google Pay) and whether it is the one charged when the traveler is not asked. */
function describePaymentMethod(pm, defaultId) {
  if (!pm || typeof pm !== 'object') return null;
  const card = pm.card || null;
  const wallet = card && card.wallet && typeof card.wallet.type === 'string' ? card.wallet.type : null;
  return {
    id: String(pm.id || ''),
    type: String(pm.type || ''),
    brand: card ? String(card.brand || '') : '',
    last4: card ? String(card.last4 || '') : '',
    expMonth: card && Number.isInteger(card.exp_month) ? card.exp_month : null,
    expYear: card && Number.isInteger(card.exp_year) ? card.exp_year : null,
    // THE ISSUING COUNTRY, WHICH DECIDES THE FEE SCHEDULE (Chad, 20 Sept 2026). Stripe writes
    // it as a two-letter code the moment the card is attached, so for anybody who has paid
    // before it is known long before we quote — which is the whole reason the quote can carry
    // a card-aware fee without the price moving under the traveler.
    //
    // It is NOT shown to the traveler anywhere. It selects a schedule; it is not a label.
    country: card && typeof card.country === 'string' ? card.country.toUpperCase() : null,
    wallet,
    isDefault: !!defaultId && String(pm.id) === String(defaultId),
  };
}

/**
 * The issuing country of the traveler's DEFAULT card, or null when they have none on file.
 * This is what quote() is given, and what decides which of the two fee schedules applies.
 *
 * null is not an error and is not a failure to look: a traveler on their first travel has no
 * default, and isDomesticCard() treats null as domestic on purpose. Returning null rather than
 * throwing keeps a Stripe outage from blocking a quote — the worst case is that one travel is
 * priced on the domestic schedule, which is the same worst case as a first travel.
 */
async function defaultCardCountry({ uid, email }) {
  try {
    const methods = await listPaymentMethods({ uid, email });
    const chosen = methods.find((m) => m.isDefault) || methods[0] || null;
    return chosen && chosen.country ? chosen.country : null;
  } catch {
    return null;
  }
}

/**
 * What paid for a travel, read from the charge Stripe recorded — never from the phone. A card
 * gives its brand and last four and the wallet it came through; a bank account its last four.
 * null when the intent's charge is not expanded or carries no method details: the traveler's
 * record then says "Not recorded" rather than naming the method their app has selected today.
 */
function paidWithFromIntent(pi) {
  const charge = pi && pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
  const details = charge && charge.payment_method_details;
  if (!details || typeof details !== 'object') return null;
  const type = String(details.type || '');
  const card = details.card && typeof details.card === 'object' ? details.card : null;
  const bank = details.us_bank_account && typeof details.us_bank_account === 'object' ? details.us_bank_account : null;
  const wallet = card && card.wallet && typeof card.wallet.type === 'string' ? card.wallet.type : null;
  const brand = card && card.brand != null ? String(card.brand) : '';
  const last4 = card && card.last4 != null ? String(card.last4) : bank && bank.last4 != null ? String(bank.last4) : '';
  // The bank's own name, as Stripe records it ("JPMORGAN CHASE BANK, NA"); null for a card.
  const bankName = bank && bank.bank_name != null && String(bank.bank_name) ? String(bank.bank_name) : null;
  if (!type && !brand && !last4) return null;
  return { type, brand, last4, wallet, bank: bankName };
}

/** The Customer's chosen default, as an id — Stripe returns it as an id or an expanded object. */
function defaultMethodId(customer) {
  const d = customer && customer.invoice_settings ? customer.invoice_settings.default_payment_method : null;
  if (!d) return null;
  return typeof d === 'string' ? d : String(d.id || '') || null;
}

/** The method to charge when the traveler is not asked: their default, else the most recent. */
async function savedPaymentMethodFor(customer) {
  const stripe = getStripe();
  const methods = await stripe.paymentMethods.list({ customer: customer.id, type: 'card', limit: 20 });
  const defaultId = defaultMethodId(customer);
  return methods.data.find((m) => m.id === defaultId) || methods.data[0] || null;
}

async function listPaymentMethods({ uid, email }) {
  const stripe = getStripe();
  const customer = await customerForTraveler({ uid, email });
  const methods = await stripe.paymentMethods.list({ customer: customer.id, type: 'card', limit: 20 });
  const defaultId = defaultMethodId(customer);
  return methods.data.map((m) => describePaymentMethod(m, defaultId)).filter(Boolean);
}

/** What the PaymentSheet needs to save a card without charging it: a SetupIntent, the
 *  Customer, and a short-lived key that lets the phone read that Customer's methods. */
async function createSetupIntent({ uid, email }) {
  const stripe = getStripe();
  const customer = await customerForTraveler({ uid, email });
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customer.id },
    { apiVersion: '2024-06-20' },
  );
  const si = await stripe.setupIntents.create({
    customer: customer.id,
    payment_method_types: ['card'],
    usage: 'off_session',
    metadata: { product: 'American Rider saved method', uid: uid || '' },
  });
  return { clientSecret: si.client_secret, setupIntentId: si.id, customerId: customer.id, ephemeralKeySecret: ephemeralKey.secret };
}

/** A method may be changed only by the traveler it is attached to. Anything else is refused
 *  before Stripe is asked to do anything with it. */
async function ownedPaymentMethod(customer, paymentMethodId) {
  const stripe = getStripe();
  const id = String(paymentMethodId || '');
  if (!/^pm_[A-Za-z0-9]+$/.test(id)) return { error: 'bad_id' };
  const pm = await stripe.paymentMethods.retrieve(id).catch(() => null);
  if (!pm || pm.customer !== customer.id) return { error: 'not_yours' };
  return { pm };
}

async function setDefaultPaymentMethod({ uid, email, paymentMethodId }) {
  const stripe = getStripe();
  const customer = await customerForTraveler({ uid, email });
  const owned = await ownedPaymentMethod(customer, paymentMethodId);
  if (owned.error) return { ok: false, code: owned.error };
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: owned.pm.id } });
  return { ok: true };
}

async function detachPaymentMethod({ uid, email, paymentMethodId }) {
  const stripe = getStripe();
  const customer = await customerForTraveler({ uid, email });
  const owned = await ownedPaymentMethod(customer, paymentMethodId);
  if (owned.error) return { ok: false, code: owned.error };
  await stripe.paymentMethods.detach(owned.pm.id);
  return { ok: true };
}

/**
 * The idempotency options for one travel's charge, or `undefined` when it cannot be made safe.
 *
 * Returns `undefined` rather than a weaker key when there is no Travel Number: a key that is
 * not specific to one travel is worse than none, because Stripe would replay a DIFFERENT
 * traveler's intent for a matching uid and amount.
 */
function idempotencyForTravel(kind, uid, tripNo, amountCents) {
  if (!uid || !tripNo) return undefined;
  return { idempotencyKey: `ar_${kind}_${uid}_${tripNo}_${amountCents}` };
}

async function createPaymentIntent({ travelCostCents, uid, email, tripNo, rideId, dep, dest, journey, governmentFees, cardCountry }) {
  const stripe = getStripe();
  const q = quote(travelCostCents, journey, governmentFees, cardCountry);

  // The PaymentSheet needs all three: a customer, a short-lived key that lets the phone read
  // that customer's saved cards, and the intent itself.
  const customer = await customerForTraveler({ uid, email });
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customer.id },
    { apiVersion: '2024-06-20' },
  );

  const params = {
    amount: q.travelerPays, // traveler is charged the all-in price
    currency: 'usd',
    customer: customer.id,
    automatic_payment_methods: { enabled: true },
    // STRIPE SENDS THE RECEIPT. Free, no vendor, no domain, no signup — and until this line
    // existed a traveler completed a journey, was charged, and received nothing they could
    // keep. It is a payment receipt rather than a Travel Receipt: it carries the amount, the
    // date, the card and the description below, but not the route, the operator or the 99%.
    // Worse than the one backend/email.js builds, and infinitely better than silence, so it
    // stands until americanrider.app is verified and then runs alongside it.
    //
    // NOTE: Stripe only sends these automatically in LIVE mode. In test mode the receipt is
    // there to be sent by hand from the dashboard, which is how we check what it looks like.
    receipt_email: email || undefined,
    // Keep the card on file so the next travel is one tap.
    setup_future_usage: 'off_session',
    // `uid` is what lets a later refund prove the payment belongs to the person asking for
    // it — see refundTravel. Stamp it at the only moment we know it for certain.
    statement_descriptor_suffix: STATEMENT_DESCRIPTOR,
    // Dispute evidence, stamped at the moment we know it is true.
    // WHAT THE TRAVELER READS ON THE RECEIPT AND THE STATEMENT. The route, not just a
    // number: "American Rider · Brickell to Miami International Airport · AR-2048-MIA" tells
    // somebody what they paid for three weeks later. A bare travel number does not.
    description: ['American Rider', dep && dest ? `${dep} to ${dest}` : null, tripNo || null]
      .filter(Boolean)
      .join(' · '),
    // `travelCostCents` is stamped here because the operator's 99% is calculated from it at
    // settlement, hours later. Reading it back off Stripe's own record means the transfer
    // cannot be talked into a different number by whatever calls /travel/settle.
    metadata: {
      product: 'American Rider travel',
      uid: uid || '',
      tripNo: tripNo || '',
      // The travel record this pays for, from the server's own lookup (travelmoney.js).
      rideId: rideId || '',
      travelCostCents: String(travelCostCents),
      // WHAT AMERICAN RIDER ACTUALLY RETAINS on this travel — the 1% commission plus the
      // platform fee. Stamped for the same reason travelCostCents is: a refund issued hours
      // later needs to know how much of this money is still ours before it gives any back, and
      // the only trustworthy record of that is Stripe's own. Without it every refund reads as
      // wholly out of pocket — the safe direction, but not the true one. See refundTravel().
      platformTake: String(q.platformTake),
      // Held for a public body, not ours. The remittance ledger and a refund both read it here.
      governmentFeeCents: String(q.governmentFeeCents),
      // Leg 2 of a Smart Travel journey records leg 1's Travel Number: the reason its fee
      // is not the standard one is then readable on Stripe's own record.
      journeyNo: journey?.journeyNo || '',
    },
  };
  // NO `transfer_data` HERE — deliberately. See transferToOperator below for why the split
  // happens at completion instead of at payment.
  //
  // KEYED, like every other money call in this file. Without a key, a traveler who double-taps
  // Confirm Travel — or a client that retries after a timeout on a slow network — gets a
  // SECOND PaymentIntent for the same travel. The payment sheet then holds two live secrets
  // for one journey, and confirming the older one charges a second time for a travel that was
  // already paid for. Transfers, tips, scheduled travel and screening were all keyed; the
  // traveler's own fare, the largest and most frequent charge we make, was not.
  //
  // The amount is IN the key, as it is in `ar_tip_` and `ar_fixed_`: Stripe replays the first
  // response for a repeated key, so a re-quote at a different price must be allowed to create
  // its own intent rather than silently return the old amount.
  //
  // No tripNo, no key. A Travel Number is what makes the key specific to one travel; keying on
  // uid and amount alone would make two genuinely different travels at the same fare collide,
  // and the second traveler would be handed the first one's intent.
  const pi = await stripe.paymentIntents.create(
    params,
    idempotencyForTravel('travel', uid, tripNo, params.amount),
  );
  return {
    clientSecret: pi.client_secret,
    paymentIntentId: pi.id,
    customerId: customer.id,
    ephemeralKeySecret: ephemeralKey.secret,
    breakdown: q,
  };
}

// LOCAL TEST FLOW: charge a Stripe test card server-side, in one call, so the whole thing can be
// proven from a terminal without a phone. NOT used by the real app (the app uses the flow above).
//   travelCostCents        e.g. 2450  ($24.50 travel cost)
//   operatorStripeAccount  the operator's connected account id (acct_...) — optional
//   travelerPaymentMethod  a Stripe test payment method (defaults to the test Visa)
/**
 * Continue an EXISTING, still-unpaid intent for the same travel and the same price — a retry of
 * the same payment — without creating a PaymentIntent (travelmoney.js payForTravel checks the
 * travel's record first; audit of f6ef88d). Returns the same body createPaymentIntent returns,
 * or null when the intent is paid, cancelled, someone else's, another travel's, or for a
 * different amount — in which case the caller refuses.
 */
const RESUMABLE = ['requires_payment_method', 'requires_confirmation', 'requires_action'];
async function resumePaymentIntent({ paymentIntentId, uid, rideId, email, travelCostCents, journey, governmentFees, cardCountry }) {
  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (!pi || pi.metadata?.uid !== String(uid) || pi.metadata?.rideId !== String(rideId)) return null;
  if (!RESUMABLE.includes(pi.status)) return null;
  const q = quote(travelCostCents, journey, governmentFees, cardCountry);
  if (pi.amount !== q.travelerPays) return null;
  const customer = await customerForTraveler({ uid, email });
  const ephemeralKey = await stripe.ephemeralKeys.create({ customer: customer.id }, { apiVersion: '2024-06-20' });
  return {
    clientSecret: pi.client_secret,
    paymentIntentId: pi.id,
    customerId: customer.id,
    ephemeralKeySecret: ephemeralKey.secret,
    breakdown: q,
    resumed: true,
  };
}

async function chargeRide({ travelCostCents, operatorStripeAccount, travelerPaymentMethod, uid, tripNo, governmentFees, cardCountry }) {
  const stripe = getStripe();
  const q = quote(travelCostCents, undefined, governmentFees, cardCountry);
  const params = {
    amount: q.travelerPays,
    currency: 'usd',
    payment_method: travelerPaymentMethod || 'pm_card_visa',
    payment_method_types: ['card'],
    confirm: true,
    // Same stamp as createPaymentIntent, and for the same reason: a refund must be able to
    // prove ownership from Stripe's record rather than from a request body.
    // Same stamp as the real flow, so a transfer made against a terminal-created charge is
    // calculated from exactly the same recorded fare.
    metadata: {
      product: 'American Rider travel',
      uid: uid || '',
      tripNo: tripNo || '',
      travelCostCents: String(travelCostCents),
      // WHAT AMERICAN RIDER ACTUALLY RETAINS on this travel — the 1% commission plus the
      // platform fee. Stamped for the same reason travelCostCents is: a refund issued hours
      // later needs to know how much of this money is still ours before it gives any back, and
      // the only trustworthy record of that is Stripe's own. Without it every refund reads as
      // wholly out of pocket — the safe direction, but not the true one. See refundTravel().
      platformTake: String(q.platformTake),
      // Held for a public body, not ours. The remittance ledger and a refund both read it here.
      governmentFeeCents: String(q.governmentFeeCents),
    },
  };
  if (operatorStripeAccount) {
    params.application_fee_amount = q.platformTake;
    params.transfer_data = { destination: operatorStripeAccount };
  }
  // Keyed for the same reason as createPaymentIntent above. This route is test-mode only
  // (`/charge-ride` refuses a live key), but it confirms immediately — so an unkeyed retry here
  // is a straight double charge rather than an orphaned intent.
  const paymentIntent = await stripe.paymentIntents.create(
    params,
    idempotencyForTravel('charge', uid, tripNo, params.amount),
  );
  // Stripe takes its processing fee out of OUR application fee — that's what the platform fee absorbs.
  // The operator always receives their full 99% of the travel cost, untouched.
  return {
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status,
    amountCents: paymentIntent.amount,
    split: !!operatorStripeAccount,
    breakdown: q,
  };
}

/**
 * How much of a payment can still be returned, and why not when the answer is none.
 *
 * Separated from refundTravel so a cancellation can ask "what is there to give back?" without
 * naming an amount it guessed. The ownership check is the same one and rests on Stripe's copy
 * of the intent, never on the request body.
 */
async function refundableFor({ paymentIntentId, expectUid }) {
  if (!paymentIntentId) return { cents: 0, reason: 'no payment on record' };
  try {
    const pi = await getStripe().paymentIntents.retrieve(paymentIntentId);
    if (expectUid && pi.metadata?.uid !== String(expectUid)) {
      return { cents: 0, reason: 'that payment belongs to a different account' };
    }
    if (pi.status !== 'succeeded') return { cents: 0, reason: `payment is ${pi.status}` };
    const cents = (pi.amount_received || pi.amount || 0) - (pi.amount_refunded || 0);
    return { cents, reason: cents > 0 ? null : 'nothing left to refund' };
  } catch (e) {
    return { cents: 0, reason: e.message };
  }
}

// Give money back.
//
// WHY THIS EXISTS: Patron Support could decide "credit" and the traveler was shown an amount
// and told it had been credited to their payment method — while nothing was refunded. A
// decision is not a refund. This is the mechanism behind the sentence.
//
// Returns { ok, refundId, amountCents } or { ok:false, error }. The caller must NOT tell the
// traveler money moved unless ok is true; server.js routes a failed refund to a person.
async function refundTravel({ paymentIntentId, amountCents, expectUid }) {
  if (!paymentIntentId) return { ok: false, error: 'no payment on record for that travel' };
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, error: 'refund amount must be a positive whole number of cents' };
  }
  try {
    // WHOSE PAYMENT IS THIS? The app sends the PaymentIntent id, and the app is a program
    // on a stranger's phone. Without this check a signed-in traveler could name ANOTHER
    // traveler's PaymentIntent and have us refund against it — they would gain nothing, but
    // American Rider would lose the money, once per request, for as long as they cared to
    // keep asking. Stripe's own copy of the intent is the only trustworthy record of who
    // paid, so the ownership test and the ceiling both come from there, never from the body
    // of the request.
    const pi = await getStripe().paymentIntents.retrieve(paymentIntentId);
    if (expectUid && pi.metadata?.uid !== expectUid) {
      return { ok: false, error: 'that payment belongs to a different account' };
    }
    if (pi.status !== 'succeeded') {
      return { ok: false, error: `payment is ${pi.status}, not a completed charge` };
    }
    // Never refund more than was actually taken, whatever the request claimed the travel cost.
    const alreadyRefunded = pi.amount_refunded || 0;
    const refundable = (pi.amount_received || pi.amount || 0) - alreadyRefunded;
    if (amountCents > refundable) {
      return { ok: false, error: `only ${refundable}c of that payment remains refundable` };
    }

    // ——— WHAT THIS REFUND ACTUALLY COSTS US ———————————————————————————————————
    //
    // ASKED BY ADRIAN, 20 SEPT 2026: "regarding the refunds you mentioned, we are protected,
    // right? we don't want to lose." Partly. Everything above stops a refund being larger than
    // the payment, or aimed at somebody else's payment, or issued twice. None of it touches
    // the real exposure, which is this:
    //
    //   THE OPERATOR HAS ALREADY BEEN PAID. 99% of the fare left for their Connect account
    //   when the travel completed. A refund to the traveler does NOT reverse that transfer,
    //   so past the point where our own retained take runs out, every cent refunded is money
    //   American Rider has already paid away and is now paying a second time.
    //
    // On a $9.03 travel we retain about $1.58. Refund the whole $9.03 and roughly $7.45 of it
    // is ours, gone. The support resolver's $45 ceiling was set against the SIZE OF A FARE,
    // which is the wrong quantity — it measures what the traveler might reasonably be owed,
    // not what we can absorb.
    //
    // This does not decide the policy. It MEASURES it, and hands the number back, so a caller
    // can refuse before issuing rather than discover the cost in a month-end total. Reversing
    // the operator's transfer is deliberately NOT done here: it takes money from somebody who
    // may have done nothing wrong, and that is a person's judgement, never a model's.
    const platformHeld = Number(pi.metadata?.platformTake) || 0;
    const stillOurs = Math.max(0, platformHeld - alreadyRefunded);
    const outOfPocketCents = Math.max(0, amountCents - stillOurs);

    const refund = await getStripe().refunds.create({
      payment_intent: paymentIntentId,
      amount: amountCents,
      metadata: {
        product: 'American Rider travel',
        reason: 'Patron Support adjustment',
        // Stamped on the refund itself so the cost is legible in Stripe, not only in our logs.
        outOfPocketCents: String(outOfPocketCents),
      },
    });
    // 'pending' is a normal ACH outcome and still means the refund is real and issued.
    const ok = refund.status === 'succeeded' || refund.status === 'pending';
    return ok
      ? { ok: true, refundId: refund.id, amountCents: refund.amount, status: refund.status, outOfPocketCents }
      : { ok: false, error: `refund ${refund.status}` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ---- OPERATOR PAYOUTS (Stripe Connect) ---------------------------------------------------
//
// WHY THIS IS THE REAL BLOCKER, not a nicety. Every screen in this product says the operator
// keeps 99% of the fare. That happens through `transfer_data.destination` on the charge — and
// destination needs a connected account id (`acct_...`) that belongs to the operator. Nothing
// created one. So with a live key and no Connect account, American Rider would collect the
// whole fare and the operator would receive nothing automatically, which is not a bug in a
// payout system, it is the company's central promise not happening.
//
// Express accounts: Stripe hosts the identity check and the bank details, which means this
// server never sees an operator's SSN or account number. That is the correct division.

/** Create (or reuse) the operator's connected account. Keyed on their Firebase uid. */
async function connectAccountFor({ uid, email, existingAccountId }) {
  const stripe = getStripe();
  if (existingAccountId) {
    try {
      return await stripe.accounts.retrieve(existingAccountId);
    } catch {
      // Deleted or from the other mode — fall through and make a fresh one.
    }
  }
  return stripe.accounts.create({
    type: 'express',
    country: 'US',
    email: email || undefined,
    business_type: 'individual',
    capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
    metadata: { uid: String(uid) },
  });
}

/** The Stripe-hosted onboarding link the operator completes. Single use, short lived. */
async function connectOnboardingLink({ accountId, returnUrl, refreshUrl }) {
  return getStripe().accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    return_url: returnUrl,
    refresh_url: refreshUrl,
  });
}

/**
 * Can this operator actually be paid?
 *
 * `payoutsEnabled` is Stripe's answer, not ours. An operator who has started onboarding but
 * not finished it has an account id and cannot receive money — treating the id alone as
 * "done" would put us right back to charging travelers for a split that cannot happen.
 */
async function connectAccountStatus(accountId) {
  if (!accountId) return { exists: false, payoutsEnabled: false, chargesEnabled: false, due: [] };
  try {
    const a = await getStripe().accounts.retrieve(accountId);
    return {
      exists: true,
      accountId: a.id,
      payoutsEnabled: !!a.payouts_enabled,
      chargesEnabled: !!a.charges_enabled,
      due: a.requirements?.currently_due || [],
    };
  } catch (e) {
    return { exists: false, payoutsEnabled: false, chargesEnabled: false, due: [], error: e.message };
  }
}

/** A single-use link into an Express operator's own Stripe dashboard. */
async function connectDashboardLink(accountId) {
  const link = await getStripe().accounts.createLoginLink(accountId);
  return link.url;
}

// ---- PAYING THE OPERATOR: separate charges and transfers ---------------------------------
//
// WHY THE SPLIT MOVED OFF THE CHARGE. A destination charge divides the money at the instant
// the traveler pays, which requires knowing the operator at that instant. We do not. Dispatch
// matches asynchronously — the app asked for the money and started looking for a driver on the
// next line — an operator can be reassigned, and a travel can be cancelled after payment.
// Charging first and refusing to charge at all were the only two options, and the code chose
// to refuse: with a live key and no connected account it returned 409 and took nothing, so
// every booking would have failed the day real money was switched on.
//
// It is also the wrong risk posture. A destination charge sends the operator's 99% before the
// traveler's money has settled. An ACH that later fails, or a disputed card, would mean money
// paid out that was never received — recoverable only by clawing back an operator's earnings,
// which is exactly the thing this company should never do.
//
// So: the platform takes the whole fare, and the 99% moves when the travel is COMPLETE and we
// know who drove. `source_transaction` ties the transfer to that one charge, which makes
// Stripe hold it until those specific funds are available. An ACH that never settles produces
// a transfer that never fires — no clawback, because nothing left.
//
// The operator is never worse off: same 99%, paid on completion instead of on booking.
async function transferToOperator({
  paymentIntentId,
  operatorStripeAccount,
  expectedUid,
  expectedTripNo,
  rideId,
}) {
  const stripe = getStripe();
  let pi;
  try {
    pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
  } catch (e) {
    return { ok: false, code: 'no_payment', error: e.message };
  }

  // OWNERSHIP. The caller hands us a PaymentIntent id; without these two checks anyone could
  // hand us somebody else's and have its 99% sent to an account of their choosing. The uid on
  // the intent was stamped by this server at creation and cannot be edited from a phone.
  if (expectedUid && pi.metadata?.uid !== String(expectedUid)) {
    return { ok: false, code: 'not_your_payment', error: 'That payment belongs to another traveler' };
  }
  if (expectedTripNo && pi.metadata?.tripNo && pi.metadata.tripNo !== String(expectedTripNo)) {
    return { ok: false, code: 'wrong_travel', error: 'That payment belongs to another travel' };
  }
  if (pi.status !== 'succeeded') {
    // Includes ACH still clearing. Not an error — settle again once it lands.
    return { ok: false, code: 'not_settled', error: `Payment is ${pi.status}`, retryable: true };
  }
  // The method that paid, for the traveler's own record. Read here because this is the one
  // place the charge is already in hand; the settle routes write it onto the travel, and the
  // receipt and the Travel Log print it instead of whatever the phone has selected today.
  const paidWith = paidWithFromIntent(pi);

  const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
  if (!chargeId) return { ok: false, code: 'no_charge', error: 'Payment has no charge to draw from', paidWith };

  // The operator's share is derived from the fare STRIPE recorded, never from the request.
  const travelCostCents = Number(pi.metadata?.travelCostCents || 0);
  if (!travelCostCents) {
    return { ok: false, code: 'no_fare_on_record', error: 'That payment predates fare stamping', paidWith };
  }
  const q = quote(travelCostCents);

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: q.operatorGets, // 99% of the fare — the commission and the platform fee stay behind
        currency: 'usd',
        destination: operatorStripeAccount,
        source_transaction: chargeId, // waits for THESE funds, so a failed ACH pays nobody
        description: `American Rider travel ${expectedTripNo || ''}`.trim(),
        metadata: {
          tripNo: expectedTripNo || '',
          rideId: rideId || '',
          paymentIntentId: pi.id,
          travelCostCents: String(travelCostCents),
        },
      },
      // One transfer per travel, even if settle is called twice in the same moment. The ride
      // document carries the durable guard; this closes the seconds-wide race between two taps.
      { idempotencyKey: `ar_transfer_${rideId || pi.id}` },
    );
    return {
      ok: true,
      transferId: transfer.id,
      amountCents: transfer.amount,
      operatorGets: q.operatorGets,
      platformTake: q.platformTake,
      paidWith,
    };
  } catch (e) {
    // Insufficient available balance is the ordinary case while a payment is still clearing.
    const retryable = e.code === 'balance_insufficient';
    return { ok: false, code: e.code || 'transfer_failed', error: e.message, retryable, paidWith };
  }
}

/**
 * A tip: charged to the traveler's saved card, and passed to the operator in full.
 *
 * THE DEFECT THIS CLOSES. Travel Complete collected a tip and wrote `tipCents` onto the ride
 * document. Nothing in the backend has ever referenced that field. The tip was neither charged
 * to the traveler nor paid to the operator — it was a number in a database, under a screen
 * reading "The operator keeps 100% of every tip."
 *
 * 100% MEANS 100%. No commission is taken and no platform fee is added, so Stripe's processing
 * on the tip is paid by American Rider — roughly $0.33 on a $1.00 tip, which is a loss on every
 * tip taken. That is deliberate: the alternative is an operator receiving $0.67 of a dollar a
 * traveler was told they would receive whole.
 *
 * Charged off-session against the card already saved for the travel, so the traveler is not
 * asked to present it again for a sum they have just agreed to.
 */
async function chargeTip({ uid, email, operatorStripeAccount, amountCents, tripNo }) {
  if (!(amountCents > 0)) return { ok: false, error: 'no tip to charge' };
  const stripe = getStripe();
  try {
    const customer = await customerForTraveler({ uid, email });
    // The traveler's default when they set one — the card they said to use when not asked.
    const pm = await savedPaymentMethodFor(customer);
    if (!pm) return { ok: false, code: 'no_saved_card', error: 'No card on file for this traveler' };

    const pi = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: 'usd',
        customer: customer.id,
        payment_method: pm.id,
        off_session: true,
        confirm: true,
        statement_descriptor_suffix: STATEMENT_DESCRIPTOR,
        description: `American Rider gratuity ${tripNo || ''}`.trim(),
        metadata: { product: 'American Rider gratuity', uid: uid || '', tripNo: tripNo || '' },
      },
      { idempotencyKey: `ar_tip_${uid}_${tripNo}_${amountCents}` },
    );
    if (pi.status !== 'succeeded') {
      return { ok: false, code: pi.status, error: `Tip payment is ${pi.status}` };
    }

    // The whole tip goes on to the operator. If it cannot be forwarded now, the charge stands
    // and the caller records it as owed — never kept quietly.
    const out = await transferFixed({
      paymentIntentId: pi.id,
      operatorStripeAccount,
      amountCents,
      reference: `gratuity ${tripNo || ''}`.trim(),
    });
    return {
      ok: true,
      chargedCents: amountCents,
      paymentIntentId: pi.id,
      forwarded: out.ok,
      transferId: out.transferId || null,
      forwardError: out.ok ? null : out.error,
    };
  } catch (e) {
    return { ok: false, code: e.code || 'tip_failed', error: e.message };
  }
}

/**
 * Move a fixed amount to an operator, drawn from a specific charge.
 *
 * Used for the arrival fee on a cancellation, where the sum is a flat figure rather than a
 * share of a fare. `source_transaction` ties it to the traveler's own charge, so it waits for
 * those funds exactly as a settlement does, and the idempotency key makes a repeated
 * cancellation request pay once.
 */
async function transferFixed({ paymentIntentId, operatorStripeAccount, amountCents, reference }) {
  if (!(amountCents > 0)) return { ok: false, error: 'nothing to transfer' };
  const stripe = getStripe();
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
    const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
    if (!chargeId) return { ok: false, error: 'payment has no charge to draw from' };
    const transfer = await stripe.transfers.create(
      {
        amount: amountCents,
        currency: 'usd',
        destination: operatorStripeAccount,
        source_transaction: chargeId,
        description: `American Rider ${reference || 'operator payment'}`.trim(),
        metadata: { reference: reference || '', paymentIntentId: pi.id },
      },
      { idempotencyKey: `ar_fixed_${pi.id}_${amountCents}` },
    );
    return { ok: true, transferId: transfer.id, amountCents: transfer.amount };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Diagnostic: can THIS server actually reach Stripe? Makes the cheapest real API call there
// is and reports how long it took. Returns no account details and no key material, so it is
// safe to expose. Exists because "payment failed" on a phone cannot distinguish between a
// declined card and a server that has no route to Stripe at all — and those need opposite fixes.
async function pingStripe() {
  const started = Date.now();
  try {
    const bal = await getStripe().balance.retrieve();
    return { ok: true, ms: Date.now() - started, livemode: bal.livemode };
  } catch (e) {
    // The SDK's own message ("An error occurred with our connection to Stripe") hides WHY.
    // e.detail holds the underlying Node error, whose .code is the thing worth seeing:
    // ENOTFOUND = DNS failed, ECONNREFUSED = blocked, ETIMEDOUT = hung, CERT_* = TLS.
    const under = e.detail || e.cause || null;
    return {
      ok: false,
      ms: Date.now() - started,
      type: e.type || null,
      code: e.code || null,
      message: e.message,
      underlying: under ? { code: under.code || null, errno: under.errno || null, syscall: under.syscall || null, message: under.message || String(under) } : null,
    };
  }
}

// Raw network probe, bypassing the Stripe SDK entirely: can this host resolve and reach
// api.stripe.com at all? Separates "Stripe SDK problem" from "this container has no route out".
async function probeNetwork() {
  const dns = require('node:dns').promises;
  const https = require('node:https');
  const out = {};

  try {
    const t = Date.now();
    const addrs = await dns.lookup('api.stripe.com', { all: true });
    out.dns = { ok: true, ms: Date.now() - t, families: addrs.map((a) => a.family) };
  } catch (e) {
    out.dns = { ok: false, code: e.code || null, message: e.message };
  }

  out.https = await new Promise((resolve) => {
    const t = Date.now();
    const req = https.get('https://api.stripe.com/healthcheck', { timeout: 15000 }, (res) => {
      res.resume();
      resolve({ ok: true, ms: Date.now() - t, status: res.statusCode });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, ms: Date.now() - t, reason: 'timeout' }); });
    req.on('error', (e) => resolve({ ok: false, ms: Date.now() - t, code: e.code || null, message: e.message }));
  });

  return out;
}

/**
 * Charge a scheduled travel against the card already on file, with nobody holding the phone.
 *
 * A reservation made at 11pm for 6:30am cannot ask for a card at 6:30am — the traveler is
 * asleep. The card kept by `setup_future_usage: 'off_session'` on their previous travel is
 * charged directly, exactly as the gratuity is.
 *
 * ORDER MATTERS AND IS THE CALLER'S JOB. Match an operator FIRST, charge second, write the
 * travel third. Charging first would take money for a journey that may have nobody to drive
 * it; writing first would send an operator to a journey nobody has paid for.
 *
 * The idempotency key is the reservation id, so two overlapping sweeps — or a sweep that
 * times out and is retried — charge the traveler exactly once.
 *
 * Metadata matches createPaymentIntent field for field, deliberately: settlement reads
 * `travelCostCents` and `uid` back off Stripe's own record hours later, and a scheduled
 * travel must settle through the same path as any other.
 */
async function chargeScheduledTravel({ travelCostCents, uid, email, tripNo, reservationId, dep, dest, governmentFees, cardCountry }) {
  const stripe = getStripe();
  const q = quote(travelCostCents, undefined, governmentFees, cardCountry);
  try {
    const customer = await customerForTraveler({ uid, email });
    const pm = await savedPaymentMethodFor(customer);
    if (!pm) {
      return { ok: false, code: 'no_saved_card', error: 'No card on file for this traveler' };
    }
    const pi = await stripe.paymentIntents.create(
      {
        amount: q.travelerPays,
        currency: 'usd',
        customer: customer.id,
        payment_method: pm.id,
        off_session: true,
        confirm: true,
        statement_descriptor_suffix: STATEMENT_DESCRIPTOR,
        receipt_email: email || undefined,
        description: ['American Rider', dep && dest ? `${dep} to ${dest}` : null, tripNo || null]
          .filter(Boolean)
          .join(' · '),
        metadata: {
          product: 'American Rider travel',
          uid: uid || '',
          tripNo: tripNo || '',
          travelCostCents: String(travelCostCents),
          // What American Rider retains — see the note at the other intent-creation sites. A
          // scheduled travel is refunded by exactly the same path, so it needs exactly this.
          platformTake: String(q.platformTake),
          // Held for a public body, not ours. The remittance ledger and a refund both read it here.
          governmentFeeCents: String(q.governmentFeeCents),
          scheduled: 'true',
        },
      },
      { idempotencyKey: `ar_sched_${reservationId}` },
    );
    // A card that needs the traveler present (3-D Secure) returns requires_action here. That
    // is not a failure of ours and must not be reported as one: the reservation is held and
    // the traveler is asked to confirm, rather than being told their card was declined.
    if (pi.status !== 'succeeded') {
      return {
        ok: false,
        code: pi.status === 'requires_action' ? 'requires_action' : pi.status,
        error: pi.status === 'requires_action'
          ? 'Your bank needs you to confirm this payment'
          : `Payment is ${pi.status}`,
        paymentIntentId: pi.id,
      };
    }
    return { ok: true, paymentIntentId: pi.id, chargedCents: q.travelerPays, breakdown: q };
  } catch (e) {
    return { ok: false, code: e.code || 'charge_failed', error: e.message };
  }
}

/**
 * A PaymentIntent for the operator's screening fee.
 *
 * NOT A TRAVEL. It carries no travelCostCents and no operator share, so it can never be
 * mistaken for a fare by the settlement path — which reads travelCostCents off Stripe's own
 * record and would otherwise try to pay somebody 99% of a background check.
 *
 * A PASS-THROUGH, and the metadata says so in Stripe's own record. American Rider keeps none
 * of it: the amount is what the screening company bills us, and if that changes this changes
 * with it. See backend/screening.js.
 */
async function createScreeningIntent({ amountCents, uid, email }) {
  const stripe = getStripe();
  const customer = await customerForTraveler({ uid, email });
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customer.id },
    { apiVersion: '2024-06-20' },
  );
  const pi = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency: 'usd',
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
      setup_future_usage: 'off_session',
      statement_descriptor_suffix: STATEMENT_DESCRIPTOR,
      receipt_email: email || undefined,
      // "Paid at cost" on the receipt as well as on the screen. An operator handing over
      // $47.49 should be able to see, weeks later, that none of it was ours.
      description: 'American Rider · operator screening, paid at cost',
      metadata: {
        product: 'American Rider operator screening',
        passThrough: 'true',
        uid: uid || '',
      },
    },
    // THE AMOUNT IS IN THE KEY. Without it, an operator who is first quoted the full $47.49
    // and later only the $17.50 driving history would be handed back the first intent — and
    // charged the larger figure for the smaller thing.
    { idempotencyKey: `ar_screening_${uid}_${amountCents}` },
  );
  return {
    clientSecret: pi.client_secret,
    paymentIntentId: pi.id,
    customerId: customer.id,
    ephemeralKeySecret: ephemeralKey.secret,
    amountCents,
  };
}

// EVERY function server.js names must appear here. chargeTip and transferFixed were written,
// reviewed and committed WITHOUT being exported, so `POST /travel/tip` and the cancellation
// arrival fee both threw ReferenceError on the first line that mattered — the two paths that
// move money to an operator outside a completed travel, dead from the day they shipped.

/**
 * Where an operator's 99% is sent. Lives here, not in server.js, because the settlement sweep
 * needs it too and a route file cannot be required from a sweep without a cycle.
 *
 * The account is looked up from the operator's OWN record and never accepted from a request:
 * a phone that could name the destination could name its own.
 */
async function operatorPayoutAccount(db, operatorId) {
  if (!operatorId) return { accountId: null, reason: 'no operator on the travel' };
  // A real operator's fleet id IS their uid, so the payout account is one read away.
  const user = await db.collection('users').doc(String(operatorId)).get();
  if (user.exists && user.data()?.stripeAccountId) {
    return { accountId: user.data().stripeAccountId, uid: String(operatorId) };
  }
  // Fall back to the fleet document, which may carry the uid separately.
  const op = await db.collection('operators').doc(String(operatorId)).get();
  const uid = op.exists ? op.data()?.uid : null;
  if (uid) {
    const u2 = await db.collection('users').doc(String(uid)).get();
    if (u2.exists && u2.data()?.stripeAccountId) return { accountId: u2.data().stripeAccountId, uid };
  }
  return { accountId: null, reason: 'that operator has no payout account' };
}

module.exports = {
  operatorPayoutAccount,
  quote, commissionCents, platformFeeCents, isDomesticCard, defaultCardCountry, journeyFeeCents, createPaymentIntent, resumePaymentIntent, chargeRide, refundTravel,
  customerForTraveler, connectAccountFor, connectOnboardingLink, connectAccountStatus,
  transferToOperator, paidWithFromIntent, refundableFor, connectDashboardLink, pingStripe, probeNetwork,
  chargeTip, transferFixed, chargeScheduledTravel, createScreeningIntent,
  describePaymentMethod, listPaymentMethods, createSetupIntent, setDefaultPaymentMethod, detachPaymentMethod,
  // Exported under an underscored name for idempotency.test.js only. It is an internal detail
  // of how a charge is keyed, not part of the module's interface.
  __idempotencyForTravel: idempotencyForTravel,
};
