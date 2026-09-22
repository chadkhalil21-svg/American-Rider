// The region registry — one record per place American Rider operates, national by design.
//
// What it holds to (Chad, 9 Sept 2026: "think nationally"): the market is a record, not a
// constant; a coordinate resolves to at most one region; a travel is served only when both of
// its ends are in the same one; the server addresses are read live from the environment, per
// region, with OTP_URL / OSRM_URL as the fallback for all of them; and /health can list it all
// without leaking an address.
const fs = require('fs');
const path = require('path');
const R = require(path.join(__dirname, 'regions.js'));

const results = [];
const check = (l, ok, d) => results.push({ l, ok: !!ok, d });

const BRICKELL = { lat: 25.7617, lng: -80.1918 };
const MIA = { lat: 25.7959, lng: -80.2871 };
const FORT_LAUDERDALE = { lat: 26.1224, lng: -80.1373 };
const WEST_PALM_BEACH = { lat: 26.7153, lng: -80.0534 };
const JUPITER = { lat: 26.9342, lng: -80.0942 };
const HOMESTEAD = { lat: 25.4687, lng: -80.4776 };
const KEY_WEST = { lat: 24.5551, lng: -81.78 };
const NAPLES = { lat: 26.142, lng: -81.7948 };
const ORLANDO = { lat: 28.5383, lng: -81.3792 };
const SAN_FRANCISCO = { lat: 37.788, lng: -122.4075 };

// --- the record ------------------------------------------------------------------------------
const FL = R.regionById('fl-southeast');
check('fl-southeast is registered', !!FL);
check('it is South Florida, FL, three counties', FL && FL.name === 'South Florida' && FL.state === 'FL' &&
  JSON.stringify(FL.counties) === '["Miami-Dade","Broward","Palm Beach"]', FL && JSON.stringify(FL.counties));
check('its clock is America/New_York', FL && FL.timezone === 'America/New_York');
check('its box is the tri-county box', FL && JSON.stringify(FL.bbox) === JSON.stringify({ latMin: 25.05, latMax: 26.98, lngMin: -80.95, lngMax: -79.95 }), FL && JSON.stringify(FL.bbox));
const feeds = FL ? FL.transit.feeds : [];
check('five feeds, by the ids OTP prefixes', feeds.map((f) => f.feedId).join(',') === 'MDT,BCT,PALMTRAN,SFRTA,BRIGHTLINE', feeds.map((f) => f.feedId).join(','));
const feed = (id) => feeds.find((f) => f.feedId === id) || {};
check('Miami-Dade Transit is $2.25 a boarding and its trams (the movers) ride free', feed('MDT').fareCents === 225 && JSON.stringify(feed('MDT').freeModes) === '["tram"]');
check('Palm Tran is $2.00 (palmtran.org/fares-passes, 9 Sept 2026)', feed('PALMTRAN').fareCents === 200);
check('Broward County Transit carries no fare until its own page has been read', feed('BCT').fareCents === null);
check('Tri-Rail and Brightline are not priced here', feed('SFRTA').fareCents === null && feed('BRIGHTLINE').fareCents === null);
check('the bus allow-list is the region\'s own file', FL && FL.transit.frequentRoutesFile === 'transit-routes.fl-southeast.json');
check('  and that file exists beside this one', FL && fs.existsSync(path.join(__dirname, FL.transit.frequentRoutesFile)));
check('the record is frozen', FL && Object.isFrozen(FL));
check('every id is lower-case kebab', R.REGIONS.every((r) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id)));
check('  and every id is unique', new Set(R.REGIONS.map((r) => r.id)).size === R.REGIONS.length);
check('an unknown id is null', R.regionById('tx-north') === null);
check('the environment suffix is the id, upper-cased', R.envSuffix('fl-southeast') === 'FL_SOUTHEAST');

// --- which region a point is in --------------------------------------------------------------
for (const [n, p] of [['Brickell', BRICKELL], ['the airport', MIA], ['Fort Lauderdale', FORT_LAUDERDALE],
  ['West Palm Beach', WEST_PALM_BEACH], ['Jupiter', JUPITER], ['Homestead', HOMESTEAD]]) {
  check(`${n} is in fl-southeast`, R.regionFor(p) === FL, JSON.stringify(p));
}
for (const [n, p] of [['Key West', KEY_WEST], ['Naples', NAPLES], ['Orlando', ORLANDO], ['San Francisco', SAN_FRANCISCO]]) {
  check(`${n} is in no region`, R.regionFor(p) === null, JSON.stringify(p));
}
for (const [n, p] of [['null', null], ['undefined', undefined], ['{}', {}], ['NaN', { lat: NaN, lng: NaN }],
  ['strings', { lat: '25.7', lng: '-80.1' }], ['a latitude past the pole', { lat: 95, lng: -80 }]]) {
  check(`${n} is in no region`, R.regionFor(p) === null);
}
check('inRegion refuses a null region', R.inRegion(null, BRICKELL) === false);

// --- which region a travel is in -------------------------------------------------------------
check('a travel with both ends in one region is that region', R.regionForTrip(BRICKELL, WEST_PALM_BEACH) === FL);
check('a far pickup is no region', R.regionForTrip(SAN_FRANCISCO, MIA) === null);
check('a far destination is no region', R.regionForTrip(BRICKELL, ORLANDO) === null);
check('both far is no region', R.regionForTrip(SAN_FRANCISCO, ORLANDO) === null);
check('a missing end is no region', R.regionForTrip(BRICKELL, null) === null && R.regionForTrip(null, BRICKELL) === null);
check('the default region is the first record', R.defaultRegion() === R.REGIONS[0]);

// --- the server addresses are live reads, per region, with a shared fallback -----------------
const saved = {};
for (const k of ['OTP_URL', 'OTP_URL_FL_SOUTHEAST', 'OSRM_URL', 'OSRM_URL_FL_SOUTHEAST']) {
  saved[k] = process.env[k];
  delete process.env[k];
}
check('with nothing set a region has no planner and no street router', FL.otpUrl === null && FL.osrmUrl === null);
process.env.OTP_URL = 'http://shared.otp:8080';
check('OTP_URL names the planner for a region without its own', FL.otpUrl === 'http://shared.otp:8080');
process.env.OTP_URL_FL_SOUTHEAST = '  http://fl.otp:8080/  ';
check('OTP_URL_<REGION> wins, trimmed of stray whitespace', FL.otpUrl === 'http://fl.otp:8080/', FL.otpUrl);
process.env.OSRM_URL = 'http://shared.osrm';
check('OSRM_URL likewise', FL.osrmUrl === 'http://shared.osrm');
process.env.OSRM_URL_FL_SOUTHEAST = 'http://fl.osrm';
check('OSRM_URL_<REGION> likewise', FL.osrmUrl === 'http://fl.osrm');
const listed = R.listRegions();
check('listRegions is plain data with the id, name, counties and whether a planner is set',
  listed.length === R.REGIONS.length && listed[0].id === 'fl-southeast' && listed[0].otp.configured === true && listed[0].streets === 'osrm' &&
    listed[0].counties.length === 3 && listed[0].transit.feeds.length === 5, JSON.stringify(listed[0]).slice(0, 200));
check('  and carries no server address', !/otp:8080|osrm/.test(JSON.stringify(listed).replace(/"streets":"osrm"/g, '')), JSON.stringify(listed));
for (const k of Object.keys(saved)) {
  delete process.env[k];
}
check('with the planner unset again, listRegions says so', R.listRegions()[0].otp.configured === false && R.listRegions()[0].streets === 'none');
for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v;

let bad = 0;
for (const r of results) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  <-- ' + (r.d || '')}`); }
console.log(`\n${results.length - bad}/${results.length} passed`);
process.exit(bad ? 1 : 0);
