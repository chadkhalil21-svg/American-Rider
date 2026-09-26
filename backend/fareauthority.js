// One authoritative fare computation for quoting, dispatch and payment.
// Request bodies provide route inputs only. They never provide a computed fare, distance or fee.
const { quote } = require('./payments');
const { fareCentsFor, fareCentsForCoords, applyTravelClass } = require('./fares');
const { outsideMarket, outsideMarketMessage } = require('./market');
const { governmentFeesFor, permitRequired, permitRequiredMessage } = require('./fees');
const { resolveTolls } = require('./tolls');

function priceRoute(body) {
  const withClass = (cents) => applyTravelClass(cents, body?.travelClass || body?.cls);
  const away = outsideMarket(body?.pickup, body?.dest);
  if (away) return { outsideMarket: away, reason: outsideMarketMessage(away) };
  const blocked = permitRequired(body?.pickup, body?.dest);
  if (blocked) return { permitRequired: blocked, reason: permitRequiredMessage(blocked) };

  const byCoords = fareCentsForCoords(body?.pickup, body?.dest);
  if (byCoords) {
    return {
      travelCostCents: withClass(byCoords.travelCostCents),
      miles: byCoords.miles,
      minutes: byCoords.minutes,
      timedBy: byCoords.timedBy,
      pricedBy: 'distance',
      governmentFees: governmentFeesFor(body?.pickup, body?.dest),
    };
  }
  const byName = fareCentsFor(body?.destination || body?.destName || body?.dest);
  if (byName != null) {
    return {
      travelCostCents: withClass(byName), miles: null, pricedBy: 'table', governmentFees: [],
    };
  }
  return null;
}

async function journeyFor({ db, uid, journeyNo }) {
  const no = String(journeyNo || '').slice(0, 24);
  if (!db || !uid || !no) return null;
  const snap = await db.collection('rides')
    .where('travelerUid', '==', String(uid)).where('tripNo', '==', no).limit(1).get();
  const leg = snap.docs[0]?.data();
  if (!leg || !leg.paymentIntentId || leg.status !== 'completed' || !(leg.travelCostCents > 0)) return null;
  // Leg 2 may reference only a first car Travel, never another leg 2. This prevents chaining
  // completed Travels to keep subtracting previously paid platform fees.
  if (leg.journeyNo) return null;
  return {
    journeyNo: no,
    leg1FareCents: Number(leg.travelCostCents),
    leg1GovernmentFeeCents: Math.max(0, Number(leg.governmentFeeCents) || 0),
    leg1TollCents: Math.max(0, Number(leg.tollCents) || 0),
  };
}

async function authoritativeFare({ body, uid = null, email = null, db = null, cardCountryFor = null }) {
  const route = priceRoute(body);
  if (!route || route.outsideMarket || route.permitRequired) return route;
  const requestedJourneyNo = String(body?.journeyNo || '').trim();
  const tollPromise = body?.pickup && body?.dest
    ? resolveTolls(body.pickup, body.dest)
    : Promise.resolve({ status: 'unknown', tollCents: null, reason: 'coordinates_required' });
  const [cardCountry, journey, toll] = await Promise.all([
    uid && cardCountryFor ? cardCountryFor({ uid, email }) : null,
    journeyFor({ db, uid, journeyNo: requestedJourneyNo }),
    tollPromise,
  ]);
  // A caller that names a Smart Travel first leg does not get ordinary single-Travel pricing
  // merely because the reference is invalid. That would let an unpaid/foreign/chained leg
  // bypass the journey fee. Fail the quote instead.
  if (requestedJourneyNo && !journey) {
    return { invalidJourney: true, reason: 'The Smart Travel first leg is not a paid completed Travel on this account.' };
  }
  // Toll resolution is authoritative and server-side. Unknown is distinct from zero.
  // Callers decide whether an unknown toll state blocks the operation; it must never be
  // converted into an assumed $0 pass-through.
  route.tollStatus = toll.status;
  route.tollCents = toll.tollCents;
  route.tollProvider = toll.provider || null;
  route.tollReason = toll.reason || null;
  const breakdown = quote(
    route.travelCostCents,
    journey,
    route.governmentFees,
    cardCountry,
    toll.status === 'unknown' ? 0 : toll.tollCents,
  );
  return { ...route, ...breakdown, journey, cardCountry: cardCountry || null };
}

module.exports = { priceRoute, authoritativeFare, journeyFor };
