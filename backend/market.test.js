// Where American Rider will and will not quote a price.
//
// This exists because the app quoted $6,228.25 from San Francisco to Miami International
// Airport and put a Continue button under it. routes.js bounded the map; fares.js bounded
// nothing; the two halves disagreed about where the company operates, and the half that
// decides what somebody pays was the unbounded one.
const path = require('path');
const { inMarket, outsideMarket, outsideMarketMessage } = require(path.join(__dirname, 'market.js'));
const { regionForTrip } = require(path.join(__dirname, 'regions.js'));
const { fareCentsForCoords } = require(path.join(__dirname, 'fares.js'));

const R = [];
const check = (l, ok, d) => R.push({ l, ok: !!ok, d });

const BRICKELL = { lat: 25.7617, lng: -80.1918 };
const MIA = { lat: 25.7959, lng: -80.2871 };
const SOUTH_BEACH = { lat: 25.7826, lng: -80.1341 };
const FORT_LAUDERDALE = { lat: 26.1224, lng: -80.1373 };
const HOMESTEAD = { lat: 25.4687, lng: -80.4776 };
const SAN_FRANCISCO = { lat: 37.788, lng: -122.4075 };
const NEW_YORK = { lat: 40.7128, lng: -74.006 };
const ATLANTIC = { lat: 25.7, lng: -60.0 };
const NULL_ISLAND = { lat: 0, lng: 0 };

for (const [n, p] of [['Brickell', BRICKELL], ['the airport', MIA], ['South Beach', SOUTH_BEACH],
                      ['Fort Lauderdale', FORT_LAUDERDALE], ['Homestead', HOMESTEAD]]) {
  check(`${n} is in the market`, inMarket(p), JSON.stringify(p));
}
for (const [n, p] of [['San Francisco', SAN_FRANCISCO], ['New York', NEW_YORK],
                      ['the Atlantic', ATLANTIC], ['Null Island', NULL_ISLAND]]) {
  check(`${n} is not`, !inMarket(p), JSON.stringify(p));
}
for (const [n, p] of [['null', null], ['undefined', undefined], ['{}', {}],
                      ['NaN', { lat: NaN, lng: NaN }], ['strings', { lat: '25.7', lng: '-80.1' }]]) {
  check(`${n} is not in the market`, !inMarket(p));
}

check('a far pickup is named as the pickup', outsideMarket(SAN_FRANCISCO, MIA) === 'pickup');
check('a far destination is named as the destination', outsideMarket(BRICKELL, NEW_YORK) === 'destination');
check('both far reports both', outsideMarket(SAN_FRANCISCO, NEW_YORK) === 'both');
check('a Miami travel is not flagged at all', outsideMarket(BRICKELL, MIA) === null);
check('the gate is the region registry: a served travel resolves to a region', regionForTrip(BRICKELL, FORT_LAUDERDALE) !== null && regionForTrip(BRICKELL, FORT_LAUDERDALE).id === 'fl-southeast');

check('THE $6,228 QUOTE: San Francisco to Miami is refused, not priced',
  fareCentsForCoords(SAN_FRANCISCO, MIA) === null);
check('Miami to New York is refused', fareCentsForCoords(BRICKELL, NEW_YORK) === null);
const real = fareCentsForCoords(BRICKELL, MIA);
check('a real Miami travel still prices', real && real.travelCostCents > 0, JSON.stringify(real));
check('  and it is a sane number', real && real.travelCostCents < 20000, JSON.stringify(real));

check('the message names the pickup, not a code', /where you are/.test(outsideMarketMessage('pickup')));
check('the message names the destination', /that destination/.test(outsideMarketMessage('destination')));
check('the whole-travel message says the area is not served, and stops', outsideMarketMessage('both') === 'American Rider does not yet serve that area.');
check('no message names a city, a county or a state — the next region must not need a new sentence',
  !['pickup', 'destination', 'both'].some((w) => /miami|florida|county|dade|broward|palm/i.test(outsideMarketMessage(w))));
check('no message reassures or apologises',
  !['pickup', 'destination', 'both'].some((w) => /sorry|unfortunately|apolog|!/i.test(outsideMarketMessage(w))));

let bad = 0;
for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  <-- ' + (r.d || '')}`); }
console.log(`\n${R.length - bad}/${R.length} passed`);
process.exit(bad ? 1 : 0);
