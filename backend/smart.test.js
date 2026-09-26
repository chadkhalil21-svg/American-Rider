// SMART TRAVEL — planned by OpenTripPlanner, priced by us. The planner is mocked here, in the
// exact shape transit.js returns, so these tests prove the pricing and the wiring and nothing
// about a timetable.
//
// What they hold to (founders, 9 Sept 2026):
//   - car legs are priced by the ordinary distance model; coordinated journey pricing funds the\n//     actual number of car-payment transactions; transit fares are reported apart and never charged by us;
//   - an end of the journey under 0.4 miles is walked at $0;
//   - a bus not on the allow-list is not offered;
//   - 'none' and 'unavailable' are different answers;
//   - a plan is never withheld for saving too little — that rule is withdrawn.
const path = require('path');
const { smartQuote, transitFareFor, pickItinerary, tidyName, WALK_MILES } = require(path.join(__dirname, 'smart.js'));
const { fareCentsForCoords, straightLineMiles } = require(path.join(__dirname, 'fares.js'));
const { platformFeeCents } = require(path.join(__dirname, 'payments.js'));
const { mapPlan } = require(path.join(__dirname, 'transit.js'));

const R = [];
const check = (l, ok, d) => R.push({ l, ok: !!ok, d });

// --- Places ------------------------------------------------------------------------------------
const BRICKELL_KEY = { lat: 25.7683, lng: -80.183 }; // 0.7 miles from Brickell station: a car
const BRICKELL = { lat: 25.7617, lng: -80.1918 }; // 0.3 miles from it: a walk
const MIA = { lat: 25.7959, lng: -80.287 }; // the terminal, 1.6 miles from the airport station
const SAN_FRANCISCO = { lat: 37.788, lng: -122.4075 };
const BRICKELL_STN = { name: 'Brickell', lat: 25.7656, lng: -80.1936, stopId: 'MDT:BRICKELL' };
const MIA_STN = { name: 'Miami International Airport', lat: 25.7959, lng: -80.2606, stopId: 'MDT:MIA' };
const GOVT_STN = { name: 'Government Center', lat: 25.7753, lng: -80.1947, stopId: 'MDT:GOVT' };

const ORANGE = { gtfsId: 'MDT:ORANGE', shortName: 'ORG', longName: 'Metrorail Orange Line', agency: 'Miami-Dade Transit', agencyId: 'MDT:MDT' };
const MOVER = { gtfsId: 'MDT:MOVER', shortName: 'MOVER', longName: 'Metromover Inner Loop', agency: 'Miami-Dade Transit', agencyId: 'MDT:MDT' };
const TRI_RAIL = { gtfsId: 'SFRTA:1', shortName: 'TRIRAIL', longName: 'Mainline', agency: 'Tri-Rail', agencyId: 'SFRTA:SFRTA' };
const BUS_150 = { gtfsId: 'MDT:150', shortName: '150', longName: 'Miami Beach Airport Flyer', agency: 'Miami-Dade Transit', agencyId: 'MDT:MDT' };

const at = (hhmm) => `2026-09-09T${hhmm}:00-04:00`;
const leg = (kind, mode, from, to, start, end, distanceMeters, extra = {}) => ({
  kind, mode, from, to, startTime: at(start), endTime: at(end),
  durationSec: (Date.parse(at(end)) - Date.parse(at(start))) / 1000, distanceMeters, ...extra,
});
const itinerary = (legs) => ({
  startTime: legs[0].startTime, endTime: legs[legs.length - 1].endTime,
  durationSec: (Date.parse(legs[legs.length - 1].endTime) - Date.parse(legs[0].startTime)) / 1000, legs,
});
const origin = (p) => ({ name: 'Origin', lat: p.lat, lng: p.lng });
const destination = (p) => ({ name: 'Destination', lat: p.lat, lng: p.lng });

// A planner that answers from a script and remembers what it was asked.
const planner = (...answers) => {
  const calls = [];
  const fn = async (args) => {
    calls.push(args);
    const a = answers.length > 1 ? answers.shift() : answers[0];
    if (a instanceof Error) throw a;
    return a;
  };
  fn.calls = calls;
  return fn;
};

(async () => {
  // --- 1. car → Metrorail → car, exactly as OTP planned it with car access and egress ---------
  const carRailCar = itinerary([
    leg('car', 'car', origin(BRICKELL_KEY), BRICKELL_STN, '16:52', '16:58', 1400),
    leg('walk', 'walk', BRICKELL_STN, BRICKELL_STN, '16:58', '17:00', 150),
    leg('transit', 'subway', BRICKELL_STN, MIA_STN, '17:00', '17:25', 12000, { route: ORANGE, headsign: 'ORANGE LINE AIRPORT STATION', stops: 7 }),
    leg('walk', 'walk', MIA_STN, MIA_STN, '17:25', '17:27', 180),
    leg('car', 'car', MIA_STN, destination(MIA), '17:27', '17:35', 2900),
  ]);
  const p1 = planner({ status: 'ok', itineraries: [carRailCar] });
  const q1 = await smartQuote(BRICKELL_KEY, MIA, { planTransit: p1 });
  const plan = q1.plan;
  check('a transit route gives status ok and a plan', q1.status === 'ok' && !!plan, JSON.stringify(q1));
  check('the planner is asked for car access and car egress first',
    p1.calls.length === 1 && p1.calls[0].access === 'CAR_DROP_OFF' && p1.calls[0].egress === 'CAR_PICKUP', JSON.stringify(p1.calls));
  check('the plan carries status ok itself, for the client', plan && plan.status === 'ok');
  check('legs are car, transit, car', plan && plan.legs.map((l) => l.kind).join(',') === 'car,transit,car',
    plan && plan.legs.map((l) => l.kind).join(','));
  check('the boarding and alighting stops are the plan\'s from and to',
    plan && plan.from.id === 'MDT:BRICKELL' && plan.from.name === 'Brickell' && plan.to.id === 'MDT:MIA',
    plan && JSON.stringify([plan.from, plan.to]));

  const first = fareCentsForCoords(BRICKELL_KEY, BRICKELL_STN);
  const last = fareCentsForCoords(MIA_STN, MIA);
  const direct = fareCentsForCoords(BRICKELL_KEY, MIA);
  check('the first car leg is priced pickup → boarding stop by the ordinary fare model',
    plan && plan.legs[0].cents === first.travelCostCents, plan && `${plan.legs[0].cents} vs ${first.travelCostCents}`);
  check('the last car leg is priced alighting stop → destination',
    plan && plan.legs[2].cents === last.travelCostCents, plan && `${plan.legs[2].cents} vs ${last.travelCostCents}`);
  check('car-leg minutes come from OTP\'s car leg (plus the walk to the platform)',
    plan && plan.legs[0].minutes === 8 && plan.legs[2].minutes === 10, plan && plan.legs.map((l) => l.minutes).join(','));
  check('transit-leg minutes come from the timetable', plan && plan.legs[1].minutes === 25, plan && plan.legs[1].minutes);
  check('the Metrorail leg is $2.25, the agency\'s fare', plan && plan.legs[1].cents === 225);
  check('the Metrorail leg names its route and its stops',
    plan && plan.legs[1].label === 'Metrorail Orange Line' && plan.legs[1].detail === 'Brickell Station → Miami International Airport Station' &&
      plan.legs[1].stops === 7 && plan.legs[1].mode === 'subway' && plan.legs[1].route.gtfsId === 'MDT:ORANGE' &&
      plan.legs[1].headsign === 'ORANGE LINE AIRPORT STATION' && plan.legs[1].line === 'Orange Line',
    plan && JSON.stringify(plan.legs[1]));
  check('the car legs say what they do and where', plan && plan.legs[0].label === 'Car to Brickell Station' &&
    plan.legs[2].label === 'Car from Miami International Airport Station', plan && [plan.legs[0].label, plan.legs[2].label].join(' | '));

  // Money.
  const carCents = first.travelCostCents + last.travelCostCents;
  check('carCents is the two car legs', plan && plan.carCents === carCents, plan && `${plan.carCents} vs ${carCents}`);
  const previewQ1 = require('./payments').quote(first.travelCostCents, null, plan.legs[0].feeLines || [], null, 0);
  const previewQ2 = require('./payments').quote(last.travelCostCents, { journeyNo: 'preview', leg1FareCents: first.travelCostCents, leg1GovernmentFeeCents: plan.legs[0].governmentFeeCents || 0, leg1TollCents: 0 }, plan.legs[2].feeLines || [], null, 0);
  check('feeCents funds the two actual car-payment transactions', plan && plan.feeCents === previewQ1.appFee + previewQ2.appFee);
  check('smartCents equals the two actual American Rider charges', plan && plan.smartCents === previewQ1.total + previewQ2.total);
  check('transitFareCents is the Metrorail fare, reported and not charged by us',
    plan && plan.transitFareCents === 225 && plan.smartCents === plan.journeyCents - plan.transitFareCents);
  check('railFareCents is kept as an alias for older clients', plan && plan.railFareCents === plan.transitFareCents);
  check('directCents is the direct fare plus its own platform fee',
    plan && plan.directCents === direct.travelCostCents + platformFeeCents(direct.travelCostCents));
  check('the saving compares journey against journey', plan && plan.saveCents === plan.directCents - plan.journeyCents);

  // Time.
  check('departAt is the boarding time less the car leg; arriveAt the alighting time plus the last one',
    plan && plan.departAt === new Date(Date.parse(at('17:00')) - 8 * 60000).toISOString() &&
      plan.arriveAt === new Date(Date.parse(at('17:25')) + 10 * 60000).toISOString(),
    plan && `${plan.departAt} → ${plan.arriveAt}`);
  check('smartMin is arriveAt − departAt', plan && plan.smartMin === 43, plan && plan.smartMin);
  check('directMin is the direct drive at 20 mph plus 4', plan && plan.directMin === Math.round((direct.miles / 20) * 60 + 4));
  check('saveMin is the difference', plan && plan.saveMin === plan.directMin - plan.smartMin);

  // --- 2. short access is a walk at $0; a server without car modes is planned on foot ------------
  check(`the walk rule is ${WALK_MILES} miles`, WALK_MILES === 0.4);
  check('Brickell to its station is under the walk rule', straightLineMiles(BRICKELL, BRICKELL_STN) < WALK_MILES,
    straightLineMiles(BRICKELL, BRICKELL_STN));
  const onFoot = itinerary([
    leg('walk', 'walk', origin(BRICKELL), BRICKELL_STN, '16:54', '17:00', 450),
    leg('transit', 'subway', BRICKELL_STN, MIA_STN, '17:00', '17:25', 12000, { route: ORANGE, stops: 7 }),
    leg('walk', 'walk', MIA_STN, destination(MIA), '17:25', '18:00', 2700),
  ]);
  const p2 = planner(
    { status: 'unavailable', reason: 'otp: Invalid input for enum PlanAccessMode', code: 'unsupported_mode' },
    { status: 'ok', itineraries: [onFoot] },
  );
  const q2 = await smartQuote(BRICKELL, MIA, { planTransit: p2 });
  const w = q2.plan;
  check('when the schema rejects car access the planner is asked again on foot',
    p2.calls.length === 2 && p2.calls[1].access === 'WALK' && p2.calls[1].egress === 'WALK', JSON.stringify(p2.calls.map((c) => [c.access, c.egress])));
  check('  and a plan still comes back', q2.status === 'ok' && !!w, JSON.stringify(q2));
  check('a short access is a walk at $0, with the timetable\'s minutes',
    w && w.legs[0].kind === 'walk' && w.legs[0].cents === 0 && w.legs[0].minutes === 6 && w.legs[0].label === 'Walk to Brickell Station',
    w && JSON.stringify(w.legs[0]));
  check('a long egress that OTP walked becomes the car leg it should be, at 22 mph',
    w && w.legs[2].kind === 'car' && w.legs[2].cents === last.travelCostCents && w.legs[2].minutes === Math.round((last.miles / 22) * 60),
    w && JSON.stringify(w.legs[2]));
  check('carCents then counts only the car leg', w && w.carCents === last.travelCostCents && w.feeCents === platformFeeCents(last.travelCostCents));
  check('the walk is not in the price', w && w.smartCents === w.carCents + w.feeCents);

  // --- 3. a bus not on the allow-list is filtered, through the real OTP mapper ----------------------
  const otpLeg = (mode, from, to, start, end, distance, route, extra = {}) => ({
    mode, transitLeg: !!route, distance, duration: (Date.parse(at(end)) - Date.parse(at(start))) / 1000,
    start: { scheduledTime: at(start), estimated: null }, end: { scheduledTime: at(end), estimated: null },
    from: { name: from.name, lat: from.lat, lon: from.lng, stop: from.stopId ? { gtfsId: from.stopId, name: from.name } : null },
    to: { name: to.name, lat: to.lat, lon: to.lng, stop: to.stopId ? { gtfsId: to.stopId, name: to.name } : null },
    route: route ? { gtfsId: route.gtfsId, shortName: route.shortName, longName: route.longName, mode, agency: { gtfsId: route.agencyId, name: route.agency } } : null,
    stopCalls: route ? new Array((extra.stops || 0) + 2).fill({ stopLocation: { __typename: 'Stop' } }) : [], // OTP counts both ends
    headsign: extra.headsign || null,
  });
  const otpItin = (legs) => ({ node: { start: legs[0].start.scheduledTime, end: legs[legs.length - 1].end.scheduledTime,
    duration: legs.reduce((s, l) => s + l.duration, 0), legs } });
  const BUS_8 = { gtfsId: 'MDT:8', shortName: '8', longName: 'Flagler', agency: 'Miami-Dade Transit', agencyId: 'MDT:MDT' };
  const rawTwoBuses = { planConnection: { routingErrors: [], edges: [
    otpItin([otpLeg('CAR', origin(BRICKELL_KEY), BRICKELL_STN, '16:50', '16:56', 1400), otpLeg('BUS', BRICKELL_STN, MIA_STN, '16:58', '17:20', 11000, BUS_8, { stops: 30 }), otpLeg('CAR', MIA_STN, destination(MIA), '17:22', '17:30', 2900)]),
    otpItin([otpLeg('CAR', origin(BRICKELL_KEY), BRICKELL_STN, '16:52', '16:58', 1400), otpLeg('BUS', BRICKELL_STN, MIA_STN, '17:00', '17:40', 11000, BUS_150, { stops: 12 }), otpLeg('CAR', MIA_STN, destination(MIA), '17:42', '17:50', 2900)]),
  ] } };
  const q3 = await smartQuote(BRICKELL_KEY, MIA, { planTransit: async () => mapPlan(rawTwoBuses, { busRoutes: new Set(['MDT:150']) }) });
  check('a bus off the allow-list is not offered even though it arrives first',
    q3.status === 'ok' && q3.plan.legs[1].route.gtfsId === 'MDT:150', JSON.stringify(q3.plan && q3.plan.legs[1]));
  check('  and the allowed bus is named by route', q3.status === 'ok' && q3.plan.legs[1].label === 'Route 150 · Miami Beach Airport Flyer' &&
    q3.plan.legs[1].mode === 'bus' && q3.plan.legs[1].cents === 225, q3.plan && q3.plan.legs[1].label);
  const q3none = await smartQuote(BRICKELL_KEY, MIA, { planTransit: async () => mapPlan(rawTwoBuses, { busRoutes: null }) });
  check('with no allow-list at all, no bus is offered: none', q3none.status === 'none', JSON.stringify(q3none));

  // --- 4. none ----------------------------------------------------------------------------------
  const q4 = await smartQuote(BRICKELL_KEY, MIA, { planTransit: planner({ status: 'none' }) });
  check('no transit route is none, with no plan', q4.status === 'none' && !q4.plan, JSON.stringify(q4));
  const walkOnly = itinerary([leg('walk', 'walk', origin(BRICKELL), destination(MIA), '17:00', '18:30', 8000)]);
  const q4b = await smartQuote(BRICKELL, MIA, { planTransit: planner({ status: 'ok', itineraries: [walkOnly] }) });
  check('an itinerary with no transit leg is none too', q4b.status === 'none', JSON.stringify(q4b));
  check('bad coordinates are none, not a throw', (await smartQuote(null, MIA, { planTransit: planner({ status: 'ok', itineraries: [carRailCar] }) })).status === 'none');
  const p5 = planner({ status: 'ok', itineraries: [carRailCar] });
  const q5 = await smartQuote(SAN_FRANCISCO, MIA, { planTransit: p5 });
  check('outside the market is none, and the planner is never asked', q5.status === 'none' && p5.calls.length === 0, JSON.stringify(q5));

  // --- 5. unavailable -----------------------------------------------------------------------------
  const q6 = await smartQuote(BRICKELL_KEY, MIA, { planTransit: planner({ status: 'unavailable', reason: 'otp: no answer within 8000 ms' }) });
  check('a planner that is down is unavailable, not none', q6.status === 'unavailable' && /8000/.test(q6.reason), JSON.stringify(q6));
  const q7 = await smartQuote(BRICKELL_KEY, MIA, { planTransit: planner(new Error('socket hang up')) });
  check('a planner that throws is unavailable, never a throw to the route', q7.status === 'unavailable', JSON.stringify(q7));

  // --- 6. the earliest arrival with a transit leg wins ----------------------------------------------
  const viaGovt = itinerary([
    leg('car', 'car', origin(BRICKELL_KEY), GOVT_STN, '16:50', '16:57', 2200),
    leg('transit', 'subway', GOVT_STN, MIA_STN, '17:05', '17:22', 11000, { route: ORANGE, stops: 6 }),
    leg('car', 'car', MIA_STN, destination(MIA), '17:24', '17:31', 2900),
  ]);
  const picked = pickItinerary([carRailCar, viaGovt, walkOnly]);
  check('the itinerary arriving first is chosen', picked === viaGovt);
  const q8 = await smartQuote(BRICKELL_KEY, MIA, { planTransit: planner({ status: 'ok', itineraries: [carRailCar, viaGovt] }) });
  check('  and the plan boards where it says', q8.status === 'ok' && q8.plan.from.id === 'MDT:GOVT', q8.plan && q8.plan.from.id);

  // --- 7. agency fares, in one place -----------------------------------------------------------------
  const fareLeg = (route, mode = 'subway') => ({ kind: 'transit', mode, route });
  check('Metrorail is $2.25', transitFareFor(fareLeg(ORANGE)) === 225);
  check('a Miami-Dade bus is $2.25', transitFareFor(fareLeg(BUS_150, 'bus')) === 225);
  check('Metromover is free', transitFareFor(fareLeg(MOVER, 'tram')) === 0);
  check('Tri-Rail is not priced here', transitFareFor(fareLeg(TRI_RAIL, 'rail')) === null);
  // The table is the region's (regions.js transit.feeds), matched by the feed prefix first.
  check('a Palm Tran bus is $2.00, from the region\'s feed table', transitFareFor(fareLeg({ gtfsId: 'PALMTRAN:1', shortName: '1', longName: 'Route 1', agency: 'Palm Tran', agencyId: 'PALMTRAN:PT' }, 'bus')) === 200);
  check('a Broward County Transit bus is not priced until its fare page has been read', transitFareFor(fareLeg({ gtfsId: 'BCT:2', shortName: '2', longName: 'Route 2', agency: 'Broward County Transit', agencyId: 'BCT:BCT' }, 'bus')) === null);
  check('an MDT tram is free by mode, whatever it is called', transitFareFor(fareLeg({ gtfsId: 'MDT:14458', shortName: 'MIA', longName: 'AIRPORT PEOPLE MOVER', agency: 'Miami-Dade Transit', agencyId: 'MDT:DTPW305' }, 'tram')) === 0);
  check('a leg with no feed prefix is matched by its agency name', transitFareFor(fareLeg({ gtfsId: '', shortName: '', longName: '', agency: 'Miami-Dade Transit', agencyId: '' }, 'bus')) === 225);
  check('a leg from an agency nobody here knows is not priced', transitFareFor(fareLeg({ gtfsId: 'CTA:1', shortName: '', longName: '', agency: 'Chicago Transit Authority', agencyId: '' }, 'subway')) === null);
  const railThenMover = itinerary([
    leg('car', 'car', origin(BRICKELL_KEY), GOVT_STN, '16:50', '16:57', 2200),
    leg('transit', 'subway', GOVT_STN, MIA_STN, '17:05', '17:22', 11000, { route: ORANGE, stops: 6 }),
    leg('walk', 'walk', MIA_STN, MIA_STN, '17:22', '17:23', 13),
    leg('transit', 'tram', MIA_STN, MIA_STN, '17:25', '17:28', 2000, { route: MOVER, stops: 0 }),
    leg('car', 'car', MIA_STN, destination(MIA), '17:30', '17:38', 2900),
  ]);
  const qRM = await smartQuote(BRICKELL_KEY, MIA, { planTransit: planner({ status: 'ok', itineraries: [railThenMover] }) });
  check('Metrorail then the MIA Mover is one $2.25 fare: the mover is free, and does not pay for the system',
    qRM.status === 'ok' && qRM.plan.transitFareCents === 225 && qRM.plan.legs.filter((l) => l.kind === 'transit').map((l) => l.cents).join(',') === '225,0', JSON.stringify(qRM.plan && qRM.plan.legs.map((l) => [l.kind, l.cents, l.transfer])));
  const triRail = itinerary([
    leg('car', 'car', origin(BRICKELL_KEY), GOVT_STN, '16:50', '16:57', 2200),
    leg('transit', 'rail', GOVT_STN, MIA_STN, '17:05', '17:30', 11000, { route: TRI_RAIL, stops: 3 }),
    leg('car', 'car', MIA_STN, destination(MIA), '17:32', '17:40', 2900),
  ]);
  const q9 = await smartQuote(BRICKELL_KEY, MIA, { planTransit: planner({ status: 'ok', itineraries: [triRail] }) });
  check('an unknown agency fare is $0 in the totals and flagged, never invented',
    q9.status === 'ok' && q9.plan.legs[1].cents === 0 && q9.plan.legs[1].fareUnknown === true && q9.plan.transitFareUnknown === true &&
      q9.plan.transitFareCents === 0, JSON.stringify(q9.plan && q9.plan.legs[1]));
  check('a route that does not name its system is given its agency: Tri-Rail Mainline',
    q9.status === 'ok' && q9.plan.legs[1].label === 'Tri-Rail Mainline', q9.plan && q9.plan.legs[1].label);

  // --- 7b. the feed shouts; the traveler is told what the place is called ------------------------
  const names = [
    ['EARLINGTON HTS.STAT.RAIL NORTHBOUND', 'Earlington Heights Station'],
    ['GOVERNMENT CTR.STAT.RAIL SOUTHBOUND', 'Government Center Station'],
    ['HISTORIC OVERTOWN/LYRIC THEATRE STAT.RAIL NORTHBOUND', 'Historic Overtown/Lyric Theatre Station'],
    ['MIAMI INTERNATIONAL AIRPORT STATION NORTHBOUND', 'Miami International Airport Station'],
    ['MIAMI INTL AIRPORT GROUND LEVEL', 'Miami International Airport Ground Level'],
    ['UHEALTH JACKSON STATION RAIL NORTHBOUND', 'UHealth Jackson Station'],
    ['M.L. KING STATION RAIL NORTHBOUND', 'M.L. King Station'],
    ['COLLEGE / BAYSIDE METROMOVER STATION', 'College/Bayside Metromover Station'],
    ['METROMOVER OMNI/BRICKELL OUTER LOOP', 'Metromover Omni/Brickell Outer Loop'],
    ['MIAMI BEACH AIRPORT FLYER', 'Miami Beach Airport Flyer'],
    ['DOWNTOWN-AVENTURA MALL VIA MIABEACH', 'Downtown-Aventura Mall via Miami Beach'],
    ['Boca Raton Station', 'Boca Raton Station'],
    ['Northwest 12th Avenue', 'Northwest 12th Avenue'],
    ['150', '150'],
  ];
  for (const [raw, want] of names) check(`"${raw}" is told as "${want}"`, tidyName(raw) === want, tidyName(raw));
  const shouted = itinerary([
    leg('car', 'car', origin(BRICKELL_KEY), { name: 'BRICKELL STATION RAIL NORTHBOUND', lat: 25.763828, lng: -80.19542, stopId: 'MDT:9515' }, '16:52', '16:58', 1400),
    leg('transit', 'rail', { name: 'BRICKELL STATION RAIL NORTHBOUND', lat: 25.763828, lng: -80.19542, stopId: 'MDT:9515' },
      { name: 'MIAMI INTERNATIONAL AIRPORT STATION NORTHBOUND', lat: 25.798002, lng: -80.258746, stopId: 'MDT:10495' }, '17:00', '17:25', 12000,
      { route: { gtfsId: 'MDT:31009', shortName: '2600', longName: 'REGULAR METRORAIL SERVICE', agency: 'Miami-Dade Transit', agencyId: 'MDT:DTPW305' }, headsign: 'ORANGE LINE AIRPORT STATION', stops: 7 }),
    leg('car', 'car', { name: 'MIAMI INTERNATIONAL AIRPORT STATION NORTHBOUND', lat: 25.798002, lng: -80.258746, stopId: 'MDT:10495' }, destination(MIA), '17:27', '17:35', 2900),
  ]);
  const q9b = await smartQuote(BRICKELL_KEY, MIA, { planTransit: planner({ status: 'ok', itineraries: [shouted] }) });
  check('the real feed\'s Metrorail route becomes "Metrorail Orange Line" between named stations',
    q9b.status === 'ok' && q9b.plan.legs[1].label === 'Metrorail Orange Line' &&
      q9b.plan.legs[1].detail === 'Brickell Station → Miami International Airport Station' &&
      q9b.plan.legs[0].label === 'Car to Brickell Station' && q9b.plan.legs[2].label === 'Car from Miami International Airport Station',
    q9b.plan && JSON.stringify(q9b.plan.legs.map((l) => [l.label, l.detail])));
  check('  the plan\'s from and to are the places, without the platform suffix',
    q9b.status === 'ok' && q9b.plan.from.name === 'Brickell' && q9b.plan.to.name === 'Miami International Airport' && q9b.plan.from.id === 'MDT:9515',
    q9b.plan && JSON.stringify([q9b.plan.from, q9b.plan.to]));
  check('  the route itself is passed through as the feed spells it, for the client\'s catalogue',
    q9b.status === 'ok' && q9b.plan.legs[1].route.longName === 'REGULAR METRORAIL SERVICE' && q9b.plan.legs[1].route.agency === 'Miami-Dade Transit');
  const mover = itinerary([
    leg('walk', 'walk', origin(BRICKELL), { name: 'BRICKELL METROMOVER STATION', lat: 25.7656, lng: -80.1936, stopId: 'MDT:1' }, '16:56', '17:00', 300),
    leg('transit', 'tram', { name: 'BRICKELL METROMOVER STATION', lat: 25.7656, lng: -80.1936, stopId: 'MDT:1' },
      { name: 'GOVERNMENT CENTER METROMOVER STATION', lat: 25.7753, lng: -80.1947, stopId: 'MDT:2' }, '17:00', '17:06', 1500,
      { route: { gtfsId: 'MDT:14456', shortName: 'MMO', longName: 'METROMOVER OMNI/BRICKELL OUTER LOOP', agency: 'Miami-Dade Transit', agencyId: 'MDT:DTPW305' }, stops: 3 }),
    leg('walk', 'walk', { name: 'GOVERNMENT CENTER METROMOVER STATION', lat: 25.7753, lng: -80.1947, stopId: 'MDT:2' }, destination({ lat: 25.7745, lng: -80.1935 }), '17:06', '17:08', 150),
  ]);
  const q9c = await smartQuote(BRICKELL, { lat: 25.7745, lng: -80.1935 }, { planTransit: planner({ status: 'ok', itineraries: [mover] }) });
  check('Metromover is named by its loop, free, and its stations are not given a second "Station"',
    q9c.status === 'ok' && q9c.plan.legs[1].label === 'Metromover Omni/Brickell Outer Loop' && q9c.plan.legs[1].cents === 0 &&
      q9c.plan.legs[0].label === 'Walk to Brickell Metromover Station' && q9c.plan.from.name === 'Brickell Metromover',
    q9c.plan && JSON.stringify([q9c.plan.legs.map((l) => l.label), q9c.plan.from.name]));

  // --- 8. no car leg at all: nothing of ours to charge, so no fee -------------------------------------
  const allTransit = itinerary([
    leg('walk', 'walk', origin(BRICKELL), BRICKELL_STN, '16:54', '17:00', 450),
    leg('transit', 'subway', BRICKELL_STN, GOVT_STN, '17:00', '17:03', 1500, { route: ORANGE, stops: 0 }),
    leg('walk', 'walk', GOVT_STN, destination({ lat: 25.7745, lng: -80.1935 }), '17:03', '17:06', 200),
  ]);
  const q10 = await smartQuote(BRICKELL, { lat: 25.7745, lng: -80.1935 }, { planTransit: planner({ status: 'ok', itineraries: [allTransit] }) });
  check('a journey we drive no part of carries no fee', q10.status === 'ok' && q10.plan.carCents === 0 && q10.plan.feeCents === 0 &&
    q10.plan.smartCents === 0 && q10.plan.journeyCents === 225, JSON.stringify(q10.plan && [q10.plan.carCents, q10.plan.feeCents, q10.plan.smartCents, q10.plan.journeyCents]));

  // --- 9. the "rail must win" gate is gone --------------------------------------------------------------
  // Car nearly the whole way, one stop of train: it saves nothing, and it is still reported.
  const HIALEAH = { lat: 25.8608, lng: -80.2806 };
  const HIALEAH_STN = { name: 'Hialeah', lat: 25.8608, lng: -80.2806, stopId: 'MDT:HIALEAH' };
  const OKEE_STN = { name: 'Okeechobee', lat: 25.8767, lng: -80.2836, stopId: 'MDT:OKEE' };
  const silly = itinerary([
    leg('car', 'car', origin(BRICKELL_KEY), HIALEAH_STN, '16:30', '17:00', 20000),
    leg('transit', 'subway', HIALEAH_STN, OKEE_STN, '17:05', '17:08', 2000, { route: ORANGE, stops: 0 }),
    leg('walk', 'walk', OKEE_STN, destination({ lat: 25.877, lng: -80.284 }), '17:08', '17:10', 100),
  ]);
  const q11 = await smartQuote(BRICKELL_KEY, { lat: 25.877, lng: -80.284 }, { planTransit: planner({ status: 'ok', itineraries: [silly] }) });
  check('a plan that saves less than $3 is still returned with its numbers',
    q11.status === 'ok' && q11.plan.saveCents < 300, JSON.stringify(q11.plan && { save: q11.plan.saveCents, min: q11.plan.saveMin }));
  check('  (and Hialeah is where it says)', q11.status === 'ok' && q11.plan.from.id === 'MDT:HIALEAH' && !!HIALEAH);

  // --- 10. nothing on a plan reassures or chats ----------------------------------------------------------
  const words = JSON.stringify([plan, w, q3.plan].map((p) => p && p.legs.map((l) => [l.label, l.detail])));
  check('no leg label reassures, apologises or exclaims', !/no surge|hidden|don.t worry|great|sorry|!/i.test(words), words);

  let bad = 0;
  for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  <-- ' + (r.d || '')}`); }
  console.log(`\n${R.length - bad}/${R.length} passed`);
  process.exit(bad ? 1 : 0);
})().catch((e) => {
  console.error('FAIL  the test file itself threw:', e);
  process.exit(1);
});
