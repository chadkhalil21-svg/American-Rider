// Street routing without the public demo router.
//
// What it holds to: the order is the region's OSRM, then the region's OpenTripPlanner street
// graph, then null; every provider answers in one shape; a route is never attempted outside a
// served region; OTP's encoded polyline is decoded exactly; and quoteWithRoute() puts the
// routed distance and time beside the price WITHOUT changing the price.
const fs = require('fs');
const path = require('path');
const T = require(path.join(__dirname, 'transit.js'));
const S = require(path.join(__dirname, 'streets.js'));
const { fetchRoute, thin } = require(path.join(__dirname, 'routes.js'));
const { quoteWithRoute, fareCentsForCoords } = require(path.join(__dirname, 'fares.js'));

const R = [];
const check = (l, ok, d) => R.push({ l, ok: !!ok, d });

const BRICKELL = { lat: 25.7617, lng: -80.1918 };
const MIA_KERB = { lat: 25.7953, lng: -80.2789 };
const SAN_FRANCISCO = { lat: 37.788, lng: -122.4075 };

// --- the polyline --------------------------------------------------------------------------------
// Google's own worked example for the encoding.
const GOOGLE = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
const decoded = T.decodePolyline(GOOGLE);
check('Google\'s example decodes to its three points',
  JSON.stringify(decoded) === JSON.stringify([{ lat: 38.5, lng: -120.2 }, { lat: 40.7, lng: -120.95 }, { lat: 43.252, lng: -126.453 }]), JSON.stringify(decoded));
check('an empty or missing string is no points', T.decodePolyline('').length === 0 && T.decodePolyline(null).length === 0);

// The encoder, so a stand-in OTP can answer with a real polyline.
function encode(points, precision = 5) {
  const factor = 10 ** precision;
  let out = '';
  let lastLat = 0;
  let lastLng = 0;
  const one = (v) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    while (n >= 0x20) {
      out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    out += String.fromCharCode(n + 63);
  };
  for (const p of points) {
    const lat = Math.round(p.lat * factor);
    const lng = Math.round(p.lng * factor);
    one(lat - lastLat);
    one(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return out;
}
check('the test\'s encoder round-trips Google\'s example', encode(decoded) === GOOGLE, encode(decoded));

const saved = path.join(__dirname, '..', 'infra', 'otp', 'example-response-car.json');
if (fs.existsSync(saved)) {
  const real = JSON.parse(fs.readFileSync(saved, 'utf8'));
  const carLeg = real.data.planConnection.edges[0].node.legs.find((l) => l.mode === 'CAR');
  const pts = T.decodePolyline(carLeg.legGeometry.points);
  check('the saved OTP car leg decodes to as many points as OTP says, starting at Brickell',
    pts.length === carLeg.legGeometry.length && Math.abs(pts[0].lat - 25.7617) < 0.0002 && Math.abs(pts[0].lng + 80.1918) < 0.0002,
    `${pts.length} vs ${carLeg.legGeometry.length}; first ${JSON.stringify(pts[0])}`);
}

// --- a stand-in for the two providers -----------------------------------------------------------------
const LINE = [BRICKELL, { lat: 25.77, lng: -80.2 }, { lat: 25.78, lng: -80.25 }, MIA_KERB];
const OTP_CAR = {
  data: {
    planConnection: {
      routingErrors: [],
      edges: [{ node: { duration: 841, legs: [{ mode: 'CAR', duration: 841.0, distance: 13119.6, legGeometry: { length: LINE.length, points: encode(LINE) } }] } }],
    },
  },
};
const OSRM_OK = { routes: [{ duration: 799.4, distance: 12900.2, geometry: { coordinates: LINE.map((p) => [p.lng, p.lat]) } }] };

const realFetch = global.fetch;
function standIn({ osrm, otp } = {}) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, body, headers: init.headers || {} });
    const a = /\/route\/v1\/driving\//.test(url) ? osrm : otp;
    if (a instanceof Error) throw a;
    if (typeof a === 'function') return a(init);
    const status = (a && a.__status) || 200;
    return { ok: status < 400, status, json: async () => a, text: async () => JSON.stringify(a) };
  };
  fn.calls = calls;
  return fn;
}
const withFetch = async (impl, fn) => {
  global.fetch = impl;
  try { return await fn(); } finally { global.fetch = realFetch; }
};
const env = {};
for (const k of ['OTP_URL', 'OTP_URL_FL_SOUTHEAST', 'OSRM_URL', 'OSRM_URL_FL_SOUTHEAST', 'OTP_TIMEOUT_MS', 'MAPBOX_ACCESS_TOKEN']) { env[k] = process.env[k]; delete process.env[k]; }

(async () => {
  // 0. traffic intelligence wins when configured, and selects the provider-ranked fastest route
  process.env.MAPBOX_ACCESS_TOKEN = 'test-token';
  let f = standIn({ otp: OTP_CAR });
  f = Object.assign(async (url, init = {}) => {
    f.calls.push({ url, body: null, headers: init.headers || {} });
    if (/api\.mapbox\.com/.test(url)) return { ok: true, status: 200, json: async () => ({ routes: [
      { duration: 900, duration_typical: 780, distance: 13100, geometry: { coordinates: LINE.map((p) => [p.lng, p.lat]) } },
      { duration: 810, duration_typical: 800, distance: 13400, geometry: { coordinates: LINE.map((p) => [p.lng, p.lat]) } },
    ] }) };
    return { ok: false, status: 502, json: async () => ({}) };
  }, { calls: [] });
  const traffic = await withFetch(f, () => S.routeCar(BRICKELL, MIA_KERB));
  check('configured traffic routing is preferred and returns the fastest live route',
    traffic && traffic.provider === 'mapbox-traffic' && traffic.durationSec === 810 && traffic.typicalDurationSec === 800,
    JSON.stringify(traffic));
  check('  requests alternatives through the driving-traffic profile',
    f.calls.length === 1 && /mapbox\/driving-traffic/.test(f.calls[0].url) && /alternatives=true/.test(f.calls[0].url),
    f.calls[0] && f.calls[0].url);
  delete process.env.MAPBOX_ACCESS_TOKEN;

  // 1. the region's OSRM, when it is set
  process.env.OSRM_URL_FL_SOUTHEAST = 'http://osrm.test/';
  process.env.OTP_URL = 'http://otp.test:8080';
  f = standIn({ osrm: OSRM_OK, otp: OTP_CAR });
  const viaOsrm = await withFetch(f, () => S.routeCar(BRICKELL, MIA_KERB));
  check('with an OSRM set, the route comes from it', viaOsrm && viaOsrm.provider === 'osrm', JSON.stringify(viaOsrm).slice(0, 120));
  check('  asked in OSRM\'s own form, lng,lat;lng,lat, with the full geometry',
    f.calls.length === 1 && f.calls[0].url === 'http://osrm.test/route/v1/driving/-80.1918,25.7617;-80.2789,25.7953?overview=full&geometries=geojson&alternatives=false&steps=false', f.calls[0] && f.calls[0].url);
  check('  coordinates come back as {lat,lng}, whole seconds and metres',
    viaOsrm && viaOsrm.coords.length === 4 && viaOsrm.coords[0].lat === BRICKELL.lat && viaOsrm.coords[0].lng === BRICKELL.lng && viaOsrm.durationSec === 799 && viaOsrm.distanceMeters === 12900);
  check('  and OTP is not asked', !f.calls.some((c) => /otp/.test(c.url)));

  // 2. an OSRM that does not answer falls through to OTP
  f = standIn({ osrm: { __status: 502 }, otp: OTP_CAR });
  const viaOtp = await withFetch(f, () => S.routeCar(BRICKELL, MIA_KERB));
  check('an OSRM that fails is followed by OTP, not by a blank map', viaOtp && viaOtp.provider === 'otp', JSON.stringify(viaOtp).slice(0, 120));
  const otpCall = f.calls.find((c) => /\/otp\/gtfs\/v1$/.test(c.url));
  check('  the OTP request is a planConnection asking for the drive alone: directOnly, direct: [CAR]',
    otpCall && /planConnection\(/.test(otpCall.body.query) && /directOnly:\s*true/.test(otpCall.body.query) && /direct:\s*\[CAR\]/.test(otpCall.body.query) && /legGeometry\s*\{[^}]*points/.test(otpCall.body.query), otpCall && otpCall.body.query);
  check('  with the coordinates as variables', otpCall && otpCall.body.variables.origin.location.coordinate.latitude === BRICKELL.lat && otpCall.body.variables.destination.location.coordinate.longitude === MIA_KERB.lng);
  check('  held to six seconds, and told so', otpCall && otpCall.headers.OTPTimeout === '6000', otpCall && otpCall.headers.OTPTimeout);
  check('  the polyline is decoded, and the seconds and metres are OTP\'s, rounded',
    viaOtp && viaOtp.coords.length === 4 && Math.abs(viaOtp.coords[3].lat - MIA_KERB.lat) < 1e-5 && viaOtp.durationSec === 841 && viaOtp.distanceMeters === 13120, JSON.stringify(viaOtp));
  delete process.env.OSRM_URL_FL_SOUTHEAST;

  // 3. no OSRM: OTP directly, at OTP_URL_<REGION> over OTP_URL
  process.env.OTP_URL_FL_SOUTHEAST = 'http://fl.otp:8080/';
  f = standIn({ otp: OTP_CAR });
  const direct = await withFetch(f, () => S.routeCar(BRICKELL, MIA_KERB));
  check('with no OSRM the region\'s own OTP is asked first time', direct && direct.provider === 'otp' && f.calls.length === 1 && f.calls[0].url === 'http://fl.otp:8080/otp/gtfs/v1', f.calls[0] && f.calls[0].url);
  delete process.env.OTP_URL_FL_SOUTHEAST;

  // 4. nothing answers: null, never a throw
  const down = await withFetch(standIn({ otp: new Error('fetch failed') }), () => S.routeCar(BRICKELL, MIA_KERB));
  check('OTP down is null', down === null);
  const empty = await withFetch(standIn({ otp: { data: { planConnection: { routingErrors: [{ code: 'NO_STOPS_IN_RANGE' }], edges: [] } } } }), () => S.routeCar(BRICKELL, MIA_KERB));
  check('OTP with no itinerary is null', empty === null);
  const walk = await withFetch(standIn({ otp: { data: { planConnection: { routingErrors: [], edges: [{ node: { duration: 100, legs: [{ mode: 'WALK', duration: 100, distance: 90, legGeometry: { length: 2, points: encode(LINE.slice(0, 2)) } }] } }] } } } }), () => S.routeCar(BRICKELL, MIA_KERB));
  check('an itinerary with no car leg is null', walk === null);
  const errors = await withFetch(standIn({ otp: { errors: [{ message: 'Validation error' }], data: null } }), () => S.routeCar(BRICKELL, MIA_KERB));
  check('a schema error is null', errors === null);

  // 5. outside a served region nothing is asked
  f = standIn({ otp: OTP_CAR });
  const far = await withFetch(f, () => S.routeCar(SAN_FRANCISCO, MIA_KERB));
  check('outside a served region the route is null and no provider is asked', far === null && f.calls.length === 0);
  check('bad coordinates likewise', (await withFetch(f, () => S.routeCar(null, MIA_KERB))) === null && f.calls.length === 0);

  // 6. routes.js fetchRoute: the same answer, thinned for the phone
  const many = [];
  for (let i = 0; i <= 500; i++) many.push({ lat: 25.7617 + (i / 500) * 0.0336, lng: -80.1918 - (i / 500) * 0.0871 });
  f = standIn({ otp: { data: { planConnection: { routingErrors: [], edges: [{ node: { duration: 841, legs: [{ mode: 'CAR', duration: 841, distance: 13119.6, legGeometry: { length: many.length, points: encode(many) } }] } }] } } } });
  const route = await withFetch(f, () => fetchRoute(BRICKELL, MIA_KERB));
  check('fetchRoute thins a long line to 160 points and keeps both ends',
    route && route.coords.length === 160 && Math.abs(route.coords[0].lat - many[0].lat) < 1e-5 && Math.abs(route.coords[159].lng - many[500].lng) < 1e-5 && route.provider === 'otp', route && route.coords.length);
  check('thin leaves a short line alone', thin(LINE).length === 4 && thin(many, 10).length === 10);
  check('fetchRoute outside the market is null', (await withFetch(f, () => fetchRoute(SAN_FRANCISCO, MIA_KERB))) === null);

  // 7. quoteWithRoute: the price beside the route, and the price unchanged
  const priced = fareCentsForCoords(BRICKELL, MIA_KERB);
  f = standIn({ otp: OTP_CAR });
  const q = await withFetch(f, () => quoteWithRoute(BRICKELL, MIA_KERB));
  check('quoteWithRoute prices exactly as fareCentsForCoords', q && q.travelCostCents === priced.travelCostCents && q.miles === priced.miles, JSON.stringify(q));
  check('  and reports the routed miles and minutes and the provider', q && q.routedMiles === 8.2 && q.routedMinutes === 14 && q.provider === 'otp', JSON.stringify(q));
  const qDown = await withFetch(standIn({ otp: new Error('fetch failed') }), () => quoteWithRoute(BRICKELL, MIA_KERB));
  check('  with no router the price stands and the routed fields are null', qDown && qDown.travelCostCents === priced.travelCostCents && qDown.routedMiles === null && qDown.routedMinutes === null && qDown.provider === null, JSON.stringify(qDown));
  check('  outside the market it is null, like the price', (await withFetch(f, () => quoteWithRoute(SAN_FRANCISCO, MIA_KERB))) === null);

  for (const [k, v] of Object.entries(env)) { if (v !== undefined) process.env[k] = v; else delete process.env[k]; }
  let bad = 0;
  for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  <-- ' + (r.d || '')}`); }
  console.log(`\n${R.length - bad}/${R.length} passed`);
  process.exit(bad ? 1 : 0);
})().catch((e) => {
  console.error('FAIL  the test file itself threw:', e);
  process.exit(1);
});
