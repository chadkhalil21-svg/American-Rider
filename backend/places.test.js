// A TRAVELER IS SHOWN THEIR OWN PLACES, OR NONE.
//
// Adrian, 20 Sept 2026: "the language of our platform is skewed for Miami-Dade county instead
// of the tri-county area and beyond... someone in Broward County would perhaps see another
// airport, someone in Orlando another, someone in New York another."
//
// He was right, and the skew was worse than a wrong list. Fort Lauderdale is INSIDE our
// service region — the market gate serves it. A traveler standing there was offered five
// Miami-Dade destinations twenty-five miles away, each with a journey time measured from
// Brickell, because the times were baked into the list beside the names.
const { destinationsNear, DESTINATIONS } = require('./places');
const { permitRequired } = require('./fees');
const { listRegions } = require('./regions');

const results = [];
const check = (label, ok, detail) => results.push({ label, ok: !!ok, detail });
const at = (lat, lng) => destinationsNear({ lat, lng }, 5);

const BRICKELL = [25.7689, -80.1935];
const FORT_LAUDERDALE = [26.1224, -80.1431];
const WEST_PALM = [26.7153, -80.0534];
const SAN_FRANCISCO = [37.7749, -122.4194];

// ---- The fault itself -------------------------------------------------------------------
const miami = at(...BRICKELL);
const broward = at(...FORT_LAUDERDALE);
check('a traveler in Miami is offered Miami places', miami.destinations.length > 0);
check('a traveler in Fort Lauderdale is offered places too', broward.destinations.length > 0);
check('AND THEY ARE NOT THE SAME PLACES',
  JSON.stringify(miami.destinations.map((d) => d.name)) !== JSON.stringify(broward.destinations.map((d) => d.name)),
  broward.destinations.map((d) => d.name).join(', '));
check("nothing offered to a Fort Lauderdale traveler is over 25 miles away",
  broward.destinations.every((d) => d.minutes < 60),
  broward.destinations.map((d) => `${d.short} ${d.minutes}min`).join(', '));
check('a traveler in Palm Beach county is served as well — all three counties, not one',
  at(...WEST_PALM).destinations.length > 0);

// ---- Empty is a correct answer, and the important one ------------------------------------
check('a traveler outside every region is offered NOTHING, not Miami',
  at(...SAN_FRANCISCO).destinations.length === 0 && at(...SAN_FRANCISCO).region === null);
check('and a missing or nonsense position is the same answer, not a default city',
  destinationsNear(null).destinations.length === 0 &&
  destinationsNear({ lat: 'here', lng: null }).destinations.length === 0);

// ---- Times are computed for the asker, not baked in --------------------------------------
const wynwoodFromMiami = miami.destinations.find((d) => d.short === 'Wynwood');
const wynwoodFromBroward = destinationsNear({ lat: FORT_LAUDERDALE[0], lng: FORT_LAUDERDALE[1] }, 40)
  .destinations.find((d) => d.short === 'Wynwood');
check('the SAME destination reports a different time to travelers in different places',
  !!wynwoodFromMiami && !!wynwoodFromBroward && wynwoodFromMiami.minutes !== wynwoodFromBroward.minutes,
  `${wynwoodFromMiami?.minutes} vs ${wynwoodFromBroward?.minutes} minutes`);
check('and no destination carries a price — a price belongs to a chosen route',
  miami.destinations.every((d) => !('cost' in d) && !('price' in d)));

// ---- Nearest first, and never where you already are --------------------------------------
check('destinations are nearest first',
  miami.destinations.every((d, i, a) => i === 0 || a[i - 1].minutes <= d.minutes),
  miami.destinations.map((d) => d.minutes).join(', '));
check('a destination the traveler is already standing at is not offered',
  at(25.801, -80.1994).destinations.every((d) => d.short !== 'Wynwood'));

// ---- Restricted places are never listed, by asking fees.js rather than keeping a copy -----
check('no listed destination is one the server would refuse',
  [BRICKELL, FORT_LAUDERDALE, WEST_PALM].every(([lat, lng]) =>
    destinationsNear({ lat, lng }, 40).destinations.every(
      (d) => !permitRequired({ lat, lng }, { lat: d.lat, lng: d.lng }),
    )));
check('the registry itself holds no airport we are not permitted at',
  !DESTINATIONS.some((d) => permitRequired(null, { lat: d.lat, lng: d.lng })),
  DESTINATIONS.filter((d) => permitRequired(null, { lat: d.lat, lng: d.lng })).map((d) => d.name).join(', '));

// ---- And every record belongs to a region that exists ------------------------------------
const ids = new Set(listRegions().map((r) => r.id));
check('every destination is keyed to a real region',
  DESTINATIONS.every((d) => ids.has(d.region)),
  DESTINATIONS.filter((d) => !ids.has(d.region)).map((d) => `${d.name}:${d.region}`).join(', '));
check('and carries coordinates, or it can never be priced',
  DESTINATIONS.every((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng)));

for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.label}${r.ok || !r.detail ? '' : ` — ${r.detail}`}`);
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED of ${results.length}` : `\nall ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
