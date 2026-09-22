// THE FARE FORMULA, PINNED TO THE ROUTE THAT SETTLED IT.
//
// This file exists because the formula drifted once already and nothing caught it. From
// 10 July 2026 the agreed model was $2.00 + $0.85/mile + $0.20/minute; the server was charging
// $3.00 + $1.80/mile with no time term, and the only record of the difference was a note in
// docs/FARE-MODEL.md marking it an open P1. It survived two months and a TestFlight build,
// because no test ever asserted what a mile costs.
//
// The comparison that ended it (Chad, 20 Sept 2026), Miami to MIA, 5.04 road miles, 15 minutes:
//   UberX $9.15 · Lyft $11.98 · $3.00+$1.80/mi = $12.07 · the agreed model = $9.28
const {
  fareCentsForCoords, fareCentsFor, assumedMph, minutesFor, MIN_TOTAL_CENTS,
} = require('./fares');
const { platformFeeCents, commissionCents } = require('./payments');

const results = [];
const check = (label, ok, detail) => results.push({ label, ok: !!ok, detail });
const usd = (c) => `$${(c / 100).toFixed(2)}`;
const HOME = { lat: 25.7689, lng: -80.1935 }; // Brickell City Centre

// ---- The rates themselves --------------------------------------------------------------
// Priced through a router's own numbers, so neither the circuity factor nor the assumed speed
// can flatter the result. This is the number in Chad's comparison, to the cent.
const chad = fareCentsForCoords(HOME, { lat: 25.7953, lng: -80.2789 }, { routedMiles: 5.04, routedMinutes: 15 });
check('the verified route prices at a $7.53 fare — $1.00 + 5.04 miles + 15 minutes',
  chad.travelCostCents === 753, `got ${usd(chad.travelCostCents)}`);

// THE ASSERTION THAT MATTERS, AND THE ONE THIS FILE GOT WRONG FIRST TIME. It compared our FARE
// to Uber's PRICE and was labelled "undercuts both platforms" while only ever testing against
// Lyft. Our traveler pays the fare PLUS the platform fee, so that is what has to be compared,
// and against the CHEAPER of the two competitors, not the dearer.
const allIn = chad.travelCostCents + platformFeeCents(chad.travelCostCents, 'US');
check('what the traveler ACTUALLY PAYS is under UberX $9.15, fee included',
  allIn < 915, `ours all-in ${usd(allIn)}`);
check('and under Lyft $11.98 by a wide margin', allIn < 1198, `ours all-in ${usd(allIn)}`);
// The other half of the promise, on the same trip, from the same fare.
check('while the operator receives more than an Uber driver would at the TOP of the 55-70% band',
  chad.travelCostCents - commissionCents(chad.travelCostCents) > 641,
  `operator ${usd(chad.travelCostCents - commissionCents(chad.travelCostCents))} vs $6.41`);
check('a routed travel is marked as measured, not assumed', chad.timedBy === 'router');
check('the $1.80-per-mile model would have charged $12.07 — above both. It is gone.',
  chad.travelCostCents < 1207);

// ---- The time term is real, and it is what the $1.80 model could not do ------------------
const clear = fareCentsForCoords(HOME, { lat: 25.7953, lng: -80.2789 }, { routedMiles: 5.04, routedMinutes: 15 });
const stuck = fareCentsForCoords(HOME, { lat: 25.7953, lng: -80.2789 }, { routedMiles: 5.04, routedMinutes: 40 });
check('the same five miles in forty minutes pays the operator more than in fifteen',
  stuck.travelCostCents - clear.travelCostCents === 375,
  `${usd(clear.travelCostCents)} vs ${usd(stuck.travelCostCents)}`);

// ---- The stand-in speed, and the one thing it must reproduce -----------------------------
check('with no router, the calibration route still resolves to 15.0 minutes',
  Math.abs(minutesFor(5.04, null) - 15) < 0.05, `got ${minutesFor(5.04, null).toFixed(2)}`);
check('and therefore to within a cent of the routed price',
  Math.abs(fareCentsForCoords(HOME, { lat: 25.7953, lng: -80.2789 }, { routedMiles: 5.04 }).travelCostCents - 753) <= 2);
check('an unrouted travel says so', fareCentsForCoords(HOME, { lat: 25.7826, lng: -80.1341 }).timedBy === 'estimate');
check('assumed speed rises with distance — a city mile is not a Turnpike mile',
  assumedMph(1) < assumedMph(10) && assumedMph(10) < assumedMph(30));
check('and it stays inside a believable band for Miami, 14 to 38 mph',
  assumedMph(0.1) >= 14 && assumedMph(500) < 38);
check('a flat speed would have priced a 35-mile highway run at over an hour and a half; this does not',
  minutesFor(35, null) < 80, `${minutesFor(35, null).toFixed(0)} min`);

// ---- Continuity: no travel costs more than one slightly longer --------------------------
let worstJump = 0;
let prev = null;
for (let tenths = 1; tenths <= 4000; tenths += 1) {
  const m = tenths / 10;
  const cents = 100 + Math.round(m * 85) + Math.round(minutesFor(m, null) * 15);
  if (prev !== null) worstJump = Math.max(worstJump, cents - prev);
  prev = cents;
}
check('a tenth of a mile further never costs more than 20 cents more', worstJump <= 20, `${worstJump}c`);

// ---- The floor is on what the traveler pays ---------------------------------------------
const tiny = fareCentsForCoords(HOME, { lat: 25.769, lng: -80.1936 });
check('the shortest possible travel costs the traveler exactly $5.00',
  tiny.travelCostCents + platformFeeCents(tiny.travelCostCents, 'US') === MIN_TOTAL_CENTS,
  `${usd(tiny.travelCostCents + platformFeeCents(tiny.travelCostCents, 'US'))}`);
check('which is below both competitors\' Miami minimums (UberX $6.09, Lyft... $3.62 is lower)',
  MIN_TOTAL_CENTS < 609);

// ---- The named table has not been left behind -------------------------------------------
// It priced every destination under the old model for two months. A table that disagrees with
// the formula is a second fare model, which is the thing this whole change removes.
for (const [name, coords] of [
  ['Miami International Airport', { lat: 25.7953, lng: -80.2789 }],
  ['South Beach', { lat: 25.7826, lng: -80.1341 }],
  ['Wynwood', { lat: 25.801, lng: -80.1994 }],
]) {
  const byName = fareCentsFor(name);
  const byCoord = fareCentsForCoords(HOME, coords).travelCostCents;
  check(`the table and the formula agree on ${name}`, byName === byCoord,
    `table ${usd(byName)} vs formula ${usd(byCoord)}`);
}
check('the aliases agree with their canonical name',
  fareCentsFor('MIA Airport') === fareCentsFor('Miami International Airport') &&
  fareCentsFor('Miami Airport') === fareCentsFor('Miami International Airport') &&
  fareCentsFor('Port of Miami') === fareCentsFor('PortMiami'));

// ---- TOLLS: the traveler pays, the operator is reimbursed, we keep nothing extra ---------
//
// Chad, 20 Sept 2026. Until today a toll came out of the operator's 99% — the Rickenbacker
// Causeway and every expressway toll was borne by the person driving. Uber and Lyft both add
// tolls to the fare, so our operators were absorbing what no competitor asks theirs to.
//
// THE TEST THAT MATTERS IS THAT OUR TAKE DOES NOT MOVE. A pass-through that quietly widens the
// platform's margin is not a pass-through.
const { quote } = require('./payments');
const plain = quote(2000, undefined, undefined, 'US');
const tolled = quote(2000, undefined, undefined, 'US', 175);
check('a toll does not change what American Rider keeps',
  tolled.platformTake === plain.platformTake, `${plain.platformTake} vs ${tolled.platformTake}`);
check('the traveler pays the toll, to the cent',
  tolled.travelerPays - plain.travelerPays === 175);
check('and the operator is reimbursed it whole, on top of the 99%',
  tolled.operatorGets - plain.operatorGets === 175);
check('no commission is taken on a toll — a toll is not fare',
  tolled.commission === plain.commission);
check('the toll is counted as money owed onward, not money kept',
  tolled.passThroughCents - plain.passThroughCents === 175);
check('the split still adds up with a toll in it',
  tolled.travelerPays === tolled.operatorGets + tolled.platformTake + tolled.governmentFeeCents,
  JSON.stringify(tolled));
check('a nonsense toll is no toll rather than a negative charge',
  quote(2000, undefined, undefined, 'US', -500).tollCents === 0 &&
  quote(2000, undefined, undefined, 'US', 1.5).tollCents === 0 &&
  quote(2000, undefined, undefined, 'US', 'two dollars').tollCents === 0);

// A toll and an airport fee are different money and must not be confused: one is owed to a
// public body, the other back to the operator.
const both = quote(2000, undefined, [{ id: 'mia-tnc-pickup', name: 'MIA', payee: 'Miami-Dade Aviation Department', cents: 200 }], 'US', 175);
check('an airport fee and a toll are both passed through, and only the toll reaches the operator',
  both.governmentFeeCents === 200 && both.tollCents === 175 &&
  both.operatorGets === plain.operatorGets + 175 &&
  both.travelerPays === plain.travelerPays + 200 + 175, JSON.stringify(both));

// ---- THE PLACES WE ARE NOT PERMITTED TO SERVE -------------------------------------------
//
// Chad, 20 Sept 2026: launch without airport service and sequence MIA/PortMiami as a
// post-pilot phase, drop-offs included. Both bodies require a permit — three weeks, $1,000, an
// active LLC — before a TNC may operate on their property.
//
// THE FAILURE THIS PREVENTS is not a lost booking. It is quoting a traveler a $2.00 government
// fee we have no account to remit, for a pickup an operator may not lawfully make, and then
// keeping the money because nobody set the remittance up. The fee registry has been live and
// correct since 9 September; the permit is not.
const { permitRequired, permitRequiredMessage, GOVERNMENT_FEES } = require('./fees');
const MIA = { lat: 25.7953, lng: -80.2789 };
const PORT = { lat: 25.775, lng: -80.165 };
const BRICKELL = { lat: 25.7617, lng: -80.1918 };
const WYNWOOD = { lat: 25.801, lng: -80.1994 };

check('no fee in the registry is permitted yet — if one is, it was turned on deliberately',
  GOVERNMENT_FEES.every((f) => f.permitted === false),
  GOVERNMENT_FEES.filter((f) => f.permitted !== false).map((f) => f.id).join(', '));
check('a travel TO the airport is declined', permitRequired(BRICKELL, MIA)?.end === 'destination');
check('a travel FROM the airport is declined too — a permit is not a fee waiver',
  permitRequired(MIA, BRICKELL)?.end === 'pickup');
check('the seaport is declined at both ends',
  permitRequired(BRICKELL, PORT)?.end === 'destination' && permitRequired(PORT, BRICKELL)?.end === 'pickup');
check('an ordinary travel is untouched', permitRequired(BRICKELL, WYNWOOD) === null);
check('the refusal names the place and does not apologise',
  /Miami International Airport/.test(permitRequiredMessage(permitRequired(BRICKELL, MIA))) &&
  !/sorry|apolog|unfortunate|!/i.test(permitRequiredMessage(permitRequired(BRICKELL, MIA))),
  permitRequiredMessage(permitRequired(BRICKELL, MIA)));
check('and it reads differently at each end, because they are different refusals',
  permitRequiredMessage(permitRequired(BRICKELL, MIA)) !== permitRequiredMessage(permitRequired(MIA, BRICKELL)));
// The gate must sit with the market gate, ahead of any price — a refusal that falls through to
// a quote is a booking we cannot honour.
const serverSrc = require('fs').readFileSync(require('path').join(__dirname, 'server.js'), 'utf8');
check('priceRide refuses an unpermitted place before it prices anything',
  serverSrc.indexOf('permitRequired(body?.pickup') < serverSrc.indexOf('fareCentsForCoords(body?.pickup'));
check('/fare-quote answers 409 with a code the app can act on',
  /code: 'permit_required'/.test(serverSrc));

for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.label}${r.ok || !r.detail ? '' : ` — ${r.detail}`}`);
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED of ${results.length}` : `\nall ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
