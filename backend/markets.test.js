// County markets: which pickups are served, the three active counties, and the gates that read them.
// Run: node backend/markets.test.js
const fs = require('fs');
const path = require('path');

const R = [];
const check = (l, c, d) => R.push({ l, ok: !!c, d });
const fresh = () => {
  delete require.cache[require.resolve('./markets')];
  return require('./markets');
};

let M = fresh();
const P = (lat, lng) => ({ lat, lng });
const where = {
  southBeach: P(25.7826, -80.1341),
  miamiBeach41st: P(25.8127, -80.1224), // off the simplified coastline: snapped
  mia: P(25.7959, -80.287),
  homestead: P(25.4687, -80.4776),
  fll: P(26.0742, -80.1506),
  hillsboroBeach: P(26.29, -80.078), // off the simplified coastline: snapped
  pbi: P(26.6832, -80.0956),
  tequesta: P(26.9687, -80.1289),
  keyLargo: P(25.0865, -80.4473), // Monroe — inside the old regional box
  oceanReef: P(25.3095, -80.2789), // Monroe
  hobeSound: P(27.0595, -80.1364), // Martin
  naples: P(26.142, -81.7948), // Collier
  orlando: P(28.5383, -81.3792), // Orange
  chicago: P(41.8781, -87.6298),
};
const name = (p) => M.marketFor(p)?.id || null;

check('Miami-Dade is active', M.marketFor(where.mia)?.id === 'fl-miami-dade' && M.marketStatus(where.mia) === 'active');
check('Broward is active', name(where.fll) === 'fl-broward' && M.servesPoint(where.fll));
check('Palm Beach is active', name(where.pbi) === 'fl-palm-beach' && M.servesPoint(where.pbi));
check('South Beach is Miami-Dade', name(where.southBeach) === 'fl-miami-dade');
check('a beach off the simplified coastline is snapped to its county (Miami Beach)', name(where.miamiBeach41st) === 'fl-miami-dade');
check('…and Hillsboro Beach', name(where.hillsboroBeach) === 'fl-broward');
check('Homestead is Miami-Dade', name(where.homestead) === 'fl-miami-dade');
check('Tequesta is Palm Beach', name(where.tequesta) === 'fl-palm-beach');
check('Key Largo is Monroe, waitlist — though inside the old regional box', name(where.keyLargo) === 'fl-monroe' && M.marketStatus(where.keyLargo) === 'waitlist');
check('Ocean Reef is Monroe, waitlist', name(where.oceanReef) === 'fl-monroe' && !M.servesPoint(where.oceanReef));
check('Hobe Sound is Martin, waitlist', name(where.hobeSound) === 'fl-martin' && !M.servesPoint(where.hobeSound));
check('Naples is Collier, waitlist', !M.servesPoint(where.naples));
check('Orlando is Orange, waitlist', name(where.orlando) === 'fl-orange' && !M.servesPoint(where.orlando));
check('outside Florida: no market, waitlist', M.marketFor(where.chicago) === null && M.marketStatus(where.chicago) === 'waitlist');
check('malformed point: no market', M.marketFor({ lat: 'x' }) === null && !M.servesPoint(null));

check('cross-county travel among the three: Miami-Dade → Palm Beach', M.tripOutsideMarkets(where.mia, where.pbi) === null);
check('cross-county travel among the three: Palm Beach → Broward', M.tripOutsideMarkets(where.pbi, where.fll) === null);
check('pickup in a waitlist county is refused', M.tripOutsideMarkets(where.keyLargo, where.mia) === 'pickup');
check('destination in a waitlist county is refused', M.tripOutsideMarkets(where.mia, where.keyLargo) === 'destination');
check('both outside', M.tripOutsideMarkets(where.chicago, where.orlando) === 'both');

process.env.MARKET_STATUS = 'fl-broward:waitlist';
M = fresh();
check('a county can be switched off alone: Broward waitlist', !M.servesPoint(where.fll) && M.servesPoint(where.mia) && M.servesPoint(where.pbi));
check('…and travel into it stops', M.tripOutsideMarkets(where.mia, where.fll) === 'destination');
process.env.MARKET_STATUS = 'fl-monroe:active';
M = fresh();
check('a county with no region (routing, fares, jurisdiction) cannot be activated', !M.servesPoint(where.keyLargo));
delete process.env.MARKET_STATUS;
M = fresh();
check('the shipped active set is exactly the three counties',
  M.markets().filter((m) => m.status === 'active').map((m) => m.id).sort().join() === 'fl-broward,fl-miami-dade,fl-palm-beach');

// ——— the market gate the rest of the server uses ————————————————————————————————————
delete require.cache[require.resolve('./market')];
const market = require('./market');
check('market.js gate: Key Largo is no longer "in market"', !market.inMarket(where.keyLargo) && market.inMarket(where.mia));
check('market.js gate: priced routes refuse a waitlist destination', market.outsideMarket(where.mia, where.keyLargo) === 'destination');

// ——— wiring ——————————————————————————————————————————————————————————————————
const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const route = (sig) => (server.match(new RegExp(`app\\.${sig}[\\s\\S]*?\\n\\}\\);`)) || [''])[0];
const dispatch = route("post\\('\\/travel\\/dispatch'");
check('dispatch: the PICKUP must be in an active market (not the device position)', /servesPoint\(pickup\)/.test(dispatch));
const online = route("post\\('\\/operator\\/online'");
check('go on duty: declared market active and position in an active market', /operatingMarketGate\(user\)/.test(online) && /servesPoint\(\{ lat, lng \}\)/.test(online));
const doc = route("post\\('\\/operator\\/document'");
check('document reading (a model call) only in an active market', /operatingMarketGate\(u\)/.test(doc));
for (const r of ['existing', 'intent', 'order', 'reinvite']) {
  check(`Checkr ${r}: only in an active market`, new RegExp(`app\\.post\\('/operator/screening/${r}', requireAuth, LIMITS\\.screening, requireActiveOperatingMarket`).test(server));
}
check('Stripe Connect onboarding: only in an active market', /app\.post\('\/connect\/onboard', requireAuth, LIMITS\.connect, requireActiveOperatingMarket/.test(server));
check('waitlist is lightweight: one record, rate-limited, nothing started', /app\.post\('\/waitlist', requireAuth, LIMITS\.waitlist/.test(server) && !/checkr|readDocument|connectAccountFor/.test(route("post\\('\\/waitlist'")));
check('restricted places stay separate from county activation', /permitRequired/.test(server));

let bad = 0;
for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  — ' + (r.d || '')}`); }
console.log(`\n${R.length - bad}/${R.length} passed`);
process.exit(bad ? 1 : 0);
