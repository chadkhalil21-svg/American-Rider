// One authoritative fare computation for quoting, dispatch and payment.
// Request bodies provide route inputs only. They never provide a computed fare, distance or fee.
const { quote } = require('./payments');
const { fareCentsFor, fareCentsForCoords, applyTravelClass } = require('./fares');
const { outsideMarket, outsideMarketMessage } = require('./market');
const { governmentFeesFor, permitRequired, permitRequiredMessage } = require('./fees');

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
  return { journeyNo: no, leg1FareCents: Number(leg.travelCostCents) };
}

async function authoritativeFare({ body, uid = null, email = null, db = null, cardCountryFor = null }) {
  const route = priceRoute(body);
  if (!route || route.outsideMarket || route.permitRequired) return route;
  const [cardCountry, journey] = await Promise.all([
    uid && cardCountryFor ? cardCountryFor({ uid, email }) : null,
    journeyFor({ db, uid, journeyNo: body?.journeyNo }),
  ]);
  const breakdown = quote(route.travelCostCents, journey, route.governmentFees, cardCountry);
  return { ...route, ...breakdown, journey, cardCountry: cardCountry || null };
}

module.exports = { priceRoute, authoritativeFare, journeyFor };
