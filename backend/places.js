// Where a traveler can actually go, by the region they are standing in.
//
// WHAT THIS REPLACES, AND WHY IT IS A REAL DEFECT AND NOT A TIDY-UP. The bookable destinations
// were a hardcoded list in src/data.ts — Brickell, Wynwood, Kaseya Center, PortMiami — shipped
// inside the app and shown to every first-time traveler, wherever they were. Adrian, 20 Sept
// 2026: "I wonder if the language of our platform is skewed for Miami-Dade county instead of
// the tri-county area and beyond... someone in Broward County would perhaps see another
// airport, someone in Orlando another, someone in New York another."
//
// He is right, and it was worse than a wrong list. Fort Lauderdale is INSIDE our service
// region: a traveler there was served, offered five Miami-Dade destinations twenty-five miles
// away, and shown an "estimated travel time" for each — computed from Brickell, because the
// times were baked into the list beside the names. A traveler in Fort Lauderdale was reading
// journey times for a journey starting somewhere they were not.
//
// THE RULE THE FOUNDERS' ADVISERS WOULD ALL HAVE WRITTEN, from three directions:
//   a list maintained per city is a cost that grows with every city, and the fiftieth is
//   maintained by nobody;
//   one mechanism, applied everywhere, is cheaper than fifty lists and cannot fall behind;
//   and a traveler is shown THEIR places or none — never another city's, dressed as theirs.
//
// So a destination is a record here, keyed to a region, and the SERVER answers "what can I
// book from where I am standing" using the asker's own coordinates. Opening a market is adding
// records to this file and a region to regions.js. Nothing in the app changes, and nothing in
// the app has to be rebuilt and re-shipped to the App Store for a new city to appear.
//
// RESTRICTED PLACES ARE NOT LISTED AT ALL. fees.js decides what we may not serve — the two
// permit-gated Miami-Dade places and everything in RESTRICTED_PLACES. This asks it rather than
// keeping a second opinion, because two lists of what we cannot serve is one list too many.
const { regionFor, isCoord } = require('./regions');
const { minutesFor } = require('./fares');
const { permitRequired } = require('./fees');

// A DESTINATION IS: a region, the name as the place is actually called, a short form for a
// narrow row, and coordinates. NO PRICE AND NO TIME — both depend on where the traveler is
// standing, and both are computed per request below. Baking them in is exactly the fault this
// file exists to remove.
const DESTINATIONS = Object.freeze([
  // ——— fl-southeast: Miami-Dade ————————————————————————————————————————————————
  { region: 'fl-southeast', name: 'Wynwood', short: 'Wynwood', lat: 25.801, lng: -80.1994 },
  { region: 'fl-southeast', name: 'South Beach', short: 'South Beach', lat: 25.7826, lng: -80.1341 },
  { region: 'fl-southeast', name: 'Coral Gables', short: 'Coral Gables', lat: 25.7215, lng: -80.2684 },
  { region: 'fl-southeast', name: 'Kaseya Center', short: 'Kaseya Center', lat: 25.7814, lng: -80.187 },
  { region: 'fl-southeast', name: 'Kendall', short: 'Kendall', lat: 25.6793, lng: -80.3173 },
  { region: 'fl-southeast', name: 'Doral', short: 'Doral', lat: 25.8195, lng: -80.3553 },
  { region: 'fl-southeast', name: 'Coconut Grove', short: 'Coconut Grove', lat: 25.7273, lng: -80.2439 },
  { region: 'fl-southeast', name: 'Key Biscayne', short: 'Key Biscayne', lat: 25.6937, lng: -80.1626 },
  { region: 'fl-southeast', name: 'Little Havana', short: 'Little Havana', lat: 25.7743, lng: -80.2197 },
  { region: 'fl-southeast', name: 'Design District', short: 'Design District', lat: 25.8135, lng: -80.1934 },
  { region: 'fl-southeast', name: 'Midtown Miami', short: 'Midtown Miami', lat: 25.8067, lng: -80.1918 },
  { region: 'fl-southeast', name: 'Bayside Marketplace', short: 'Bayside', lat: 25.7784, lng: -80.1866 },
  { region: 'fl-southeast', name: 'University of Miami', short: 'University of Miami', lat: 25.7215, lng: -80.2793 },
  { region: 'fl-southeast', name: 'Virginia Key', short: 'Virginia Key', lat: 25.7364, lng: -80.1601 },
  { region: 'fl-southeast', name: 'Miami Beach Convention Center', short: 'Convention Center', lat: 25.7952, lng: -80.1345 },
  { region: 'fl-southeast', name: 'Hialeah', short: 'Hialeah', lat: 25.8576, lng: -80.2781 },
  { region: 'fl-southeast', name: 'Homestead', short: 'Homestead', lat: 25.4687, lng: -80.4776 },
  // ——— fl-southeast: Broward and Palm Beach ——————————————————————————————————————
  // THE TRI-COUNTY AREA HAS ALWAYS BEEN THE MARKET and only one of its three counties had any
  // destinations. A traveler in Fort Lauderdale was served by the market gate and offered
  // nothing within twenty miles of themselves.
  { region: 'fl-southeast', name: 'Las Olas Boulevard', short: 'Las Olas', lat: 26.1191, lng: -80.1373 },
  { region: 'fl-southeast', name: 'Fort Lauderdale Beach', short: 'Fort Lauderdale Beach', lat: 26.1224, lng: -80.1044 },
  { region: 'fl-southeast', name: 'Downtown Fort Lauderdale', short: 'Downtown Fort Lauderdale', lat: 26.1224, lng: -80.1431 },
  { region: 'fl-southeast', name: 'Hollywood Beach', short: 'Hollywood Beach', lat: 26.0112, lng: -80.1178 },
  { region: 'fl-southeast', name: 'Sawgrass Mills', short: 'Sawgrass Mills', lat: 26.1503, lng: -80.3236 },
  { region: 'fl-southeast', name: 'Aventura Mall', short: 'Aventura', lat: 25.9564, lng: -80.1428 },
  { region: 'fl-southeast', name: 'Hard Rock Stadium', short: 'Hard Rock Stadium', lat: 25.958, lng: -80.2389 },
  { region: 'fl-southeast', name: 'Boca Raton', short: 'Boca Raton', lat: 26.3587, lng: -80.0831 },
  { region: 'fl-southeast', name: 'Downtown West Palm Beach', short: 'West Palm Beach', lat: 26.7153, lng: -80.0534 },
  { region: 'fl-southeast', name: 'Delray Beach', short: 'Delray Beach', lat: 26.4615, lng: -80.0728 },
]);

const EARTH_RADIUS_MILES = 3958.8;
const toRadians = (deg) => (deg * Math.PI) / 180;
function straightLineMiles(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * What a traveler standing at `from` may book, nearest first.
 *
 * EMPTY IS A CORRECT ANSWER and the important one. A traveler outside every region gets no
 * destinations — not Miami's, which is what shipped until today. The screen then says we do
 * not operate there yet, which is true, instead of offering five places in a city they are
 * not in.
 *
 * `limit` caps the list; the caller decides how many rows it has room for.
 */
function destinationsNear(from, limit = 5) {
  if (!isCoord(from)) return { region: null, destinations: [] };
  const r = regionFor(from);
  if (!r) return { region: null, destinations: [] };

  return {
    region: r.id,
    destinations: DESTINATIONS
      .filter((d) => d.region === r.id)
      // Never list what we would refuse. fees.js is the single opinion on that.
      .filter((d) => !permitRequired(from, { lat: d.lat, lng: d.lng }))
      // And never list where the traveler already is: a destination a hundred yards away is
      // not a destination, and it would price at the minimum and read as a mistake.
      .map((d) => ({ ...d, miles: straightLineMiles(from, d) }))
      .filter((d) => d.miles >= 0.5)
      .sort((a, b) => a.miles - b.miles)
      .slice(0, Math.max(0, limit))
      // THE JOURNEY TIME, COMPUTED FROM WHERE THE ASKER IS STANDING. It used to be a string
      // baked in beside the name — '24 min' — which was a time from Brickell shown to
      // everybody, including a traveler in Fort Lauderdale for whom it was simply false. A
      // number on a screen has to be true for the person reading it or it should not be there.
      //
      // It is an ESTIMATE from straight-line distance and the same assumed-speed curve the
      // fare uses, not a routed duration, because this is a menu and a menu does not justify a
      // routing call per row. The booking sheet re-quotes properly against the real route.
      .map((d) => ({
        name: d.name,
        short: d.short,
        lat: d.lat,
        lng: d.lng,
        minutes: Math.max(1, Math.round(minutesFor(d.miles * 1.3, null))),
      })),
  };
}

module.exports = { DESTINATIONS, destinationsNear, straightLineMiles };
