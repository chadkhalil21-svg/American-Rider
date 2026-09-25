import { t } from './i18n';
// Demo data — Miami launch market (platform is national by design; market code MIA).

// `cost` is the travel fare in dollars, BEFORE the platform fee. It is a placeholder until the
// server quotes the trip: the price the traveler actually pays always comes from the server
// (see src/backend/fares.ts), never from this file.
//
// `lat`/`lng` are filled in once we've geocoded the place. When they're present the server
// prices the trip by real distance; without them it falls back to its named-place table.
export type Place = {
  name: string;
  short: string;
  cost: number;
  meta: string;
  lat?: number;
  lng?: number;
  /**
   * A place run by a public authority we do not yet hold a permit for. It stays in this list —
   * it is a real place, past travels went there, and the permits are being applied for — but it
   * is NOT offered as somewhere to go. See BOOKABLE_PLACES below.
   *
   * MIRRORS backend/fees.js: the unpermitted records in GOVERNMENT_FEES and every entry of
   * RESTRICTED_PLACES. The server refuses these by geofence whatever the app sends, so this
   * flag is not the gate — it exists so a traveler is never offered something that will then
   * be refused. permits.test.js fails if the two lists disagree.
   */
  permitRequired?: true;
};
export type DepPlace = {
  name: string;
  short: string;
  lat?: number;
  lng?: number;
  /**
   * True only when these coordinates came from the device's own position.
   *
   * DEP_PLACES[0] is ALSO called "Current location" and carries fixed Brickell
   * coordinates, so the name cannot be used to tell a real position from the placeholder —
   * which is precisely how a resolved location got silently replaced by Brickell at the
   * start of every booking. Anything that resets a pickup must preserve a resolved one.
   */
  resolved?: boolean;
};

/** A government per-trip fee inside the price: what it is, who receives it, how much. */
export type FeeLine = { id?: string; name: string; payee: string; cents: number };

export type Trip = {
  arr: string;
  dep: string;
  cost: number;
  proc: number;
  total: number;
  opRev: number;
  pay: string;
  no: string;
  date: string;
  subPrefix: string;
  operator?: string; // the matched operator's name, when known (real rides)
  /** Road miles and boarding-to-completion minutes, for the receipt (Fla. Stat. 627.748(6)). */
  miles?: number;
  minutes?: number;
  /** A refund Patron Support actually issued on this travel, in cents. */
  creditCents?: number;
  /** Government fees inside the total (an airport pickup fee, say). Never our own fee. */
  feeLines?: FeeLine[];
  /** The day the server emailed this receipt to the traveler; absent when it did not. */
  emailed?: string;
};

// Demo destinations, priced from Brickell. These are a FIXED LIST — the app has no real
// address search yet, so anywhere not in here shows "No places found". Replacing this with
// Apple MapKit search + distance-based pricing is the next big piece of work.
//
// ⚠️ Every `short` here must also exist in ../backend/fares.js, which is what the SERVER
// prices from. A destination missing there cannot be paid for.
export const PLACES: Place[] = [
  { name: 'Miami International Airport', short: 'Miami International Airport', cost: 10.2, meta: '20 min', lat: 25.7953, lng: -80.2789, permitRequired: true },
  { name: 'Wynwood', short: 'Wynwood', cost: 4.94, meta: '10 min', lat: 25.801, lng: -80.1994 },
  { name: 'South Beach', short: 'South Beach', cost: 7.44, meta: '15 min', lat: 25.7826, lng: -80.1341 },
  { name: 'Coral Gables', short: 'Coral Gables', cost: 10.32, meta: '20 min', lat: 25.7215, lng: -80.2684 },
  { name: 'PortMiami · Cruise Terminal', short: 'PortMiami', cost: 4.01, meta: '8 min', lat: 25.7785, lng: -80.1687, permitRequired: true },
  { name: 'Kaseya Center', short: 'Kaseya Center', cost: 3.5, meta: '5 min', lat: 25.7814, lng: -80.187 },
  { name: 'Kendall', short: 'Kendall', cost: 16.5, meta: '31 min', lat: 25.6793, lng: -80.3173 },
  { name: 'Doral', short: 'Doral', cost: 17.62, meta: '32 min', lat: 25.8195, lng: -80.3553 },
  { name: 'Coconut Grove', short: 'Coconut Grove', cost: 7.99, meta: '16 min', lat: 25.7282, lng: -80.2431 },
  { name: 'Key Biscayne', short: 'Key Biscayne', cost: 10.08, meta: '20 min', lat: 25.6937, lng: -80.1626 },
  { name: 'Little Havana', short: 'Little Havana', cost: 4.01, meta: '8 min', lat: 25.7743, lng: -80.2199 },
  { name: 'Design District', short: 'Design District', cost: 6.24, meta: '13 min', lat: 25.8131, lng: -80.1935 },
  { name: 'Midtown Miami', short: 'Midtown Miami', cost: 5.45, meta: '11 min', lat: 25.806, lng: -80.193 },
  { name: 'Bayside Marketplace', short: 'Bayside', cost: 3.5, meta: '4 min', lat: 25.7784, lng: -80.1866 },
  { name: 'University of Miami', short: 'University of Miami', cost: 11.16, meta: '22 min', lat: 25.7215, lng: -80.2793 },
  { name: 'Virginia Key', short: 'Virginia Key', cost: 6.31, meta: '13 min', lat: 25.7362, lng: -80.1596 },
  { name: 'Miami Beach Convention Center', short: 'Convention Center', cost: 7.91, meta: '16 min', lat: 25.795, lng: -80.134 },
  { name: 'Hialeah', short: 'Hialeah', cost: 13.86, meta: '26 min', lat: 25.8576, lng: -80.2781 },
  { name: 'Bal Harbour', short: 'Bal Harbour', cost: 15.88, meta: '30 min', lat: 25.8917, lng: -80.1264 },
  { name: 'North Miami Beach', short: 'North Miami Beach', cost: 18.87, meta: '34 min', lat: 25.9331, lng: -80.1625 },
  { name: 'Sunny Isles Beach', short: 'Sunny Isles', cost: 21.32, meta: '38 min', lat: 25.949, lng: -80.1226 },
  { name: 'Aventura Mall', short: 'Aventura', cost: 21.67, meta: '39 min', lat: 25.9581, lng: -80.1428 },
  { name: 'Hard Rock Stadium', short: 'Hard Rock Stadium', cost: 21.55, meta: '39 min', lat: 25.958, lng: -80.2389 },
  { name: 'Homestead', short: 'Homestead', cost: 41.42, meta: '69 min', lat: 25.4687, lng: -80.4776 },
  { name: 'Fort Lauderdale Airport', short: 'Fort Lauderdale Airport', cost: 32.86, meta: '56 min', lat: 26.0742, lng: -80.1506, permitRequired: true },
];

export const HOME_PLACE: Place = { name: 'Home — Brickell City Centre', short: 'Home', cost: 3.5, meta: '1 min', lat: 25.7689, lng: -80.1935 };

// Destination names that shipped before 15 Aug 2026, mapped to what they are called now.
//
// Renaming a place does NOT rewrite history: a trip in Firestore keeps the arrival name it
// was booked under, and it must — a receipt has to say what it said on the day. But the
// home screen finds SUGGESTED TRAVEL by matching a past arrival against the bookable list,
// so the rename silently emptied that section for anyone with older trips. Resolve through
// here before matching, and never delete a row: each one is somebody's travel history.
const LEGACY_PLACE_NAMES: Record<string, string> = {
  // Both old airport labels now resolve to the full name. Chad, 15 Aug: "MIA already
  // means Miami International Airport, so 'MIA Airport' is technically redundant and
  // slightly informal." Trips booked under either label read correctly in Recent Travel
  // and the Travel Log without touching a single stored record.
  'Miami Airport': 'Miami International Airport',
  'MIA Airport': 'Miami International Airport',
  'Miami Airport, Terminal D': 'Miami International Airport',
  'Port of Miami': 'PortMiami',
};

/** The current name for a destination recorded at any point in the app's history. */
export function canonicalPlaceName(recorded: string): string {
  return LEGACY_PLACE_NAMES[recorded] ?? recorded;
}

/**
 * A stored location, tidied for display.
 *
 * Apple's geocoder answers with the parcel it matched, not the address a person would
 * write, so trips came back labelled "17810–17824 SW 292 St" — a block range and an
 * un-ordinalised street. Chad, 15 Aug: "That looks like geocoder output rather than a
 * location American Rider has deliberately presented… An institutional interface should
 * feel like it knows where the travel occurred."
 *
 * This narrows the range to its first number and restores the ordinal suffix. It does NOT
 * invent detail: we cannot know which door of a block a traveler stood at, so it prefers
 * the honest low end over a plausible-looking guess. Named pickups ("Home — Brickell City
 * Centre") never match the range pattern and pass through untouched.
 *
 * The real fix is upstream — store the address the traveler actually chose instead of the
 * geocoder's echo. Until then this stops the raw string reaching the screen.
 */
// "Home", "Work" and "Current location" are UI words that happen to sit in seed data;
// the place beside them is a proper noun and stays. Translating the label here rather
// than in the data keeps the place records language-neutral.
const PLACE_LABELS: Record<string, string> = {
  Home: 'traveler.placeHome',
  Work: 'traveler.placeWork',
  'Current location': 'traveler.placeCurrent',
};

export function prettyPlace(recorded: string): string {
  if (!recorded) return recorded;
  let s = canonicalPlaceName(recorded).trim();
  const labelled = s.match(/^([^—]+?)\s+—\s+(.+)$/);
  if (labelled && PLACE_LABELS[labelled[1]]) {
    return `${t(PLACE_LABELS[labelled[1]])} — ${labelled[2]}`;
  }
  // "17810–17824 SW 292 St" → "17810 SW 292 St" (en dash, em dash or hyphen)
  s = s.replace(/^(\d+)\s*[–—-]\s*\d+\b/, '$1');
  // "SW 292 St" → "SW 292nd St" — a street number with no ordinal reads as machine output
  s = s.replace(/\b(\d+)\s+(St|Ave|Ct|Ter|Pl|Rd|Dr)\b/g, (_m, n: string, kind: string) => {
    const num = Number(n);
    const tens = num % 100;
    const suffix =
      tens >= 11 && tens <= 13
        ? 'th'
        : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[num % 10] ?? 'th';
    return `${n}${suffix} ${kind}`;
  });
  return s;
}

// Named pickups carry their own coordinates. NEVER geocode these labels: phrases like
// "Current location — Brickell" are not addresses, and Apple's geocoder only sometimes
// guesses them — when it failed, the whole trip silently lost its coordinates (no pins,
// no route, no car on the map). Real coords make that failure impossible.
export const DEP_PLACES: DepPlace[] = [
  { name: 'Current location — Brickell', short: 'Brickell', lat: 25.767, lng: -80.1919 },
  { name: 'Home — Brickell City Centre', short: 'Brickell', lat: 25.7689, lng: -80.1935 },
  { name: 'Work — Coral Gables', short: 'Coral Gables', lat: 25.7215, lng: -80.2684 },
  { name: 'Wynwood', short: 'Wynwood', lat: 25.801, lng: -80.1994 },
  { name: 'South Beach', short: 'South Beach', lat: 25.7826, lng: -80.1341 },
  { name: 'PortMiami · Cruise Terminal', short: 'PortMiami', lat: 25.7785, lng: -80.1687 },
];

// Where exactly to stand at big venues — shown on the ride screen while the operator is
// heading over, keyed by the pickup's `short` name. Airports and stadiums have designated
// rideshare zones and a bad meeting spot wastes everyone's time.
// ⚠️ These are sensible defaults, NOT verified venue data. Before launch, someone must
// confirm each one on the ground (venues move their rideshare zones around).
// NO OPERATOR IS NAMED HERE. Two of these read "Meet Miguel…" and "…ready for Miguel" —
// the demo operator, printed to every traveler whichever operator dispatch actually matched.
// Guidance about a place must not assert who is driving.
// KEYS, NOT SENTENCES — this module is evaluated at import, before the stored language
// is read, so a sentence here would pin every traveler to the default locale. Screens
// translate at render. Place NAMES stay as they are: they are proper nouns.
export const VENUE_NOTES: Record<string, string> = {
  // KEYED BY `short`. If the place's short name changes, this key changes with it or the
  // note silently stops matching and no one notices — it just never appears.
  'Miami International Airport':
    'traveler.venueMIA',
  'Fort Lauderdale Airport':
    'traveler.venueFLL',
  'Hard Rock Stadium':
    'traveler.venueHardRock',
  Aventura:
    'traveler.venueAventura',
  'Kaseya Center':
    'traveler.venueKaseya',
  Bayside: 'traveler.venueBayside',
  'PortMiami':
    'traveler.venuePortMiami',
  'Convention Center':
    'traveler.venueConvention',
};

export const DRIVER = {
  name: 'Miguel',
  fullName: 'Miguel D.',
  initials: 'MD',
  car: 'Gray Toyota Camry',
  plate: 'KTR 4821',
  rating: 4.98,
};

export const RIDER = {
  name: 'J. Reyes',
  initials: 'JR',
  since: 2026,
  rating: 4.92,
};

// Fare model (ONE all-in price for the traveler): the operator keeps 99% of the fare
// (1% coordination commission, no cap). American Rider adds a per-travel platform fee —
// the greater of $1.50 and 5% of the fare, see platformFee() — and that fee ALSO absorbs
// our payment-processing cost, so the traveler is never shown a separate "processing"
// line. Total charged = fare + platformFee(fare).
// PROC_* below is our INTERNAL processing cost (not added on top, not shown to travelers).
// Travel classes (the web demo's Travel Options). ⚠️ MIRROR of backend/fares.js
// TRAVEL_CLASSES — the server is the authority; these exist so screens can DISPLAY
// per-class prices with the same math the server will charge.
export const TRAVEL_CLASSES = [
  { key: 'standard', label: 'Standard', sub: 'traveler.classStandardSub', mult: 1.0, extraCents: 0, bookable: true },
  // NOT BOOKABLE AT LAUNCH — nothing behind them yet. Kept in the list so pricing, receipts
  // and the Travel Log still resolve any travel already booked under one.
  //   premium    — "Highest-rated operators", and no operator carries a rating at all
  //   shared     — there is no pooling; it was a private travel at a 32% discount, which the
  //                operator absorbed out of their 99%
  //   accessible — no operator declares it and nothing verifies a ramp
  // Restore each ALONGSIDE the thing it promises: a real rating, real pooling, a verified
  // accessible vehicle. Founders' decision, 18 Aug 2026.
  { key: 'premium', label: 'Premium', sub: 'traveler.classPremiumSub', mult: 1.42, extraCents: 0, bookable: false },
  { key: 'shared', label: 'Shared', sub: 'traveler.classSharedSub', mult: 0.68, extraCents: 0, bookable: false },
  { key: 'large', label: 'Large Vehicle', sub: 'traveler.classLargeSub', mult: 1.55, extraCents: 0, bookable: true },
  { key: 'accessible', label: 'Accessible', sub: 'traveler.classAccessibleSub', mult: 1.0, extraCents: 0, bookable: false },
  { key: 'pet', label: 'Pet Friendly', sub: 'traveler.classPetSub', mult: 1.0, extraCents: 300, bookable: true },
] as const;

/**
 * The class key a traveler chose ('large'), as operators declare it ('Large Vehicle').
 *
 * Dispatch matches against the `classes` array on an operator record, which holds labels.
 * The app carries keys. Nothing translated between them, so dispatch was called with a
 * hardcoded 'Standard' and the class a traveler paid for was discarded on the way.
 */
export const operatorClassFor = (key: string): string =>
  (TRAVEL_CLASSES.find((t) => t.key === key) ?? TRAVEL_CLASSES[0]).label;

/** What a traveler may actually choose. See the bookable flags above for why. */
// `permitRequired` above is still read — by permits.test.js, which checks that nothing the app
// KNOWS about is a place the server would refuse, and by anyone reading this list to understand
// why an airport is here but not offered. The BOOKABLE_PLACES filter that stood here for an
// hour on 20 Sept 2026 is gone: both screens now ask the server what can be booked from where
// the traveler is standing (backend/places.js), which fixes the same fault and the larger one
// behind it. A filtered copy of a list nobody reads any more is dead code, and dead code in a
// pricing file is how the next person learns the wrong rule.

export const BOOKABLE_CLASSES = TRAVEL_CLASSES.filter((t) => t.bookable);

/** The catalogue key for each class's name — the render site calls t() on it. Written out
 *  (not built) so the unused-key gate can see every key. The English `label` stays for
 *  operator and server surfaces, which speak ARTS. */
export const CLASS_NAME_KEYS: Record<string, string> = {
  standard: 'traveler.classStandardName',
  premium: 'traveler.classPremiumName',
  shared: 'traveler.classSharedName',
  large: 'traveler.classLargeName',
  accessible: 'traveler.classAccessibleName',
  pet: 'traveler.classPetName',
};
export const classNameKey = (key: string) => CLASS_NAME_KEYS[key] ?? CLASS_NAME_KEYS.standard;

export const applyClassCents = (cents: number, key: string) => {
  const cls = TRAVEL_CLASSES.find((t) => t.key === key) ?? TRAVEL_CLASSES[0];
  return Math.round(cents * cls.mult) + cls.extraCents;
};

// Qualifying commercial insurers — real quote links, shown on the economics screen and
// the operator qualification's Commercial Insurance step. We verify coverage, never sell it.
// THE REFERRED BROKER — the insurance step done inside the platform rather than by sending
// an operator away with homework.
//
// An operator told "go and buy commercial coverage, then come back" mostly does not come
// back. The three INSURERS links below are national quote pages: better than nothing, and
// nobody there knows what American Rider is or what our operators need. A named broker who
// has agreed to quote our people is a different thing — one call, someone expecting them.
//
// AMERICAN RIDER TAKES NO SHARE. No commission, no referral fee, no margin on the premium.
// That is stated on the screen because an operator being sent to a broker by the company
// that profits from their fares is entitled to know whether we are being paid to send them.
// We are not, and if that ever changes the sentence has to change with it.
//
// `null` until a broker is actually engaged (Chad, from Monday 31 Aug 2026). The screen shows
// nothing rather than a placeholder: a referral to nobody is worse than no referral.
export type Broker = {
  name: string;
  /** What they are, in the operator's terms. Not marketing copy. */
  note: string;
  phone: string;
  /** Florida agency licence number, so an operator can verify them at the state themselves. */
  license?: string;
  url?: string;
  /** Plain-language hours. An operator ringing a closed office reads it as us wasting them. */
  hours?: string;
  /** Written enquiries. An operator who cannot ring during office hours still has a route in. */
  email?: string;
};

// ENGAGED 20 SEPT 2026 (Chad). Until today this was `null` and the whole recommended-broker
// block was absent, which was right while no broker existed — a referral to nobody is worse
// than no referral.
//
// THE LICENCE NUMBER AND THE NAME ARE NOT THE ONES WE WERE GIVEN, AND THAT IS THE POINT.
// The screen invites the operator to check the licence at the Florida Department of Financial
// Services themselves (`insVerifyLicence`), so the number printed here has to survive that
// check. It was run, on 20 Sept 2026, against licenseesearch.fldfs.com:
//
//   L084885  →  "No Licensee found".
//   L084884  →  GARZOR INSURANCE LLC, 4369 Hunters Park Lane, Orlando FL 32837.
//
// One digit. Printing the number as given would have handed every operator a licence number
// that the state says does not exist — from the one screen whose whole job is to stop them
// being sold the wrong policy. The legal name is LLC, not "Inc.", and the state has no record
// at the Thorpe Road address we were given. Searching the firm name returns three records
// (L084884 and L087775 for GARZOR INSURANCE LLC, L112737 for GARZOR RISK UNDERWRITERS LLC);
// L084884 is the one whose number matches what we were given to a digit, and it is the one
// used here. All three carry the same garzorinsurance.com contact address, so the agency is
// real — it is the identifiers that were wrong.
//
// The phone number and the commercial-quotes@ address could not be checked against the state
// register, which lists neither. They are as supplied.
export const BROKER: Broker | null = {
  name: 'Garzor Insurance LLC',
  note: 'traveler.brokerGarzorNote',
  phone: '(407) 501-8275',
  email: 'commercial-quotes@garzorinsurance.com',
  license: 'L084884',
  hours: 'traveler.brokerGarzorHours',
};

// WHO APPEARS HERE, AND WHO WAS TAKEN OFF (Chad, 20 Sept 2026).
//
// STATE FARM WAS REMOVED. It and Allstate generally exclude for-hire and livery use from their
// standard commercial lines, so an operator who rings them is sent away — or worse, sold a
// policy that does not cover the thing they are about to do. A name on this list is a claim
// that the call is worth making.
//
// `secondary: true` holds a row behind "Compare more options", so the screen does not present
// five names as five equal answers. Progressive is the only one shown beside Garzor: an
// established carrier writing for-hire livery in 43 states.
//
// `unverified: true` prints that we have not checked the agency's licence ourselves. Two of
// these are local shops an operator may well prefer, and the honest thing is to list them with
// what we do and do not know about them rather than to leave them out or to imply a check we
// have not made. Insurify is not an insurer at all and says so.
export const INSURERS: {
  name: string;
  note: string;
  url?: string;
  phone?: string;
  secondary?: boolean;
  unverified?: boolean;
}[] = [
  {
    name: 'Progressive Commercial',
    note: 'traveler.insurerProgressiveNote',
    url: 'https://www.progressivecommercial.com/commercial-auto-insurance/livery-insurance/rideshare-insurance/',
  },
  {
    name: 'Coverage Insurance Agency',
    note: 'traveler.insurerCoverageNote',
    phone: '(305) 239-8833',
    secondary: true,
    unverified: true,
  },
  {
    name: 'InsureLimos',
    note: 'traveler.insurerInsureLimosNote',
    phone: '1-888-254-0089',
    secondary: true,
    unverified: true,
  },
  {
    name: 'Insurify',
    note: 'traveler.insurerInsurifyNote',
    url: 'https://insurify.com/car-insurance/florida/rideshare-insurance/',
    secondary: true,
  },
];

export const APP_FEE = 2.0;
export const PROC_ACH = 0.25;
export const PROC_CARD = 0.74;

// ——— THE PLATFORM FEE (Chad, 9 Sept 2026: "five percent"; relayed by Adrian) ———————————
//
// THE RULE. The platform fee is the greater of $1.50 and 5% of the travel fare, rounded UP
// to the cent. Below a $30 fare it is $1.50 exactly; at $30 the two halves meet, so the price
// is continuous — no step, no cliff.
//
// WHY 5%. Stripe takes 2.9% + $0.30 of the WHOLE charge (fare plus fee), and 4.4% on an
// international card. The 1% coordination commission already comes out of the fare, so the
// fee has to cover the rest: 5% is the smallest round rate at which no travel loses money on
// either kind of card, at any fare. (The previous rule — $1.50 up to a ~$60.87 break-even,
// then a grossed-up floor plus 1% of the excess — netted $0.02 at a $60 fare and lost on
// international cards.)
//
// WHAT DOES NOT CHANGE. The operator keeps 99% of the travel fare at every price; the fee is
// added on top and never taken from their share. ONE price for every payment method: the fee
// is the same whether the traveler pays by bank or card, because the quote is shown before
// the charge settles and two prices for one journey would contradict the one-all-in-price
// promise.
//
// backend/payments.js platformFeeCents() is the same rule in integer cents. THE TWO MUST
// NEVER DISAGREE: the app quotes with one and the server charges with the other, and a
// traveler quoted $64.54 and charged $64.55 has been shown two prices for one journey.
// backend/payments.test.js proves them equal for every cent from $0 to $500.

/**
 * The travel fare inside an all-in total.
 *
 * Deriving it as `total - APP_FEE` is only right while the fee is $1.50, which it stops being
 * above a $30 fare. A receipt built that way would misstate the fare and the operator's share
 * on exactly the travels where the numbers are largest.
 *
 * platformFee() is monotonic in the fare, so this bisects it. Forty iterations resolves far
 * finer than a cent.
 */
export function fareFromTotal(total: number, cardCountry?: string | null): number {
  if (total <= 0) return 0;
  let lo = 0;
  let hi = total;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (mid + platformFee(mid, cardCountry) > total) hi = mid;
    else lo = mid;
  }
  return Math.round(lo * 100) / 100;
}

/**
 * Whether a card falls under the domestic schedule. Stripe writes the issuing country on
 * PaymentMethod.card.country. UNKNOWN COUNTS AS DOMESTIC — see backend/payments.js
 * isDomesticCard() for why, in full: the quote must not move once a card is entered.
 */
export function isDomesticCard(cardCountry?: string | null): boolean {
  if (cardCountry === undefined || cardCountry === null || cardCountry === '') return true;
  return String(cardCountry).trim().toUpperCase() === 'US';
}

/**
 * What American Rider adds to the travel fare, on the schedule the card falls under:
 * the greater of $1.50 and 2.5% of the fare on a US card, or 5% on any other, rounded up
 * to the cent. Chad, 20 Sept 2026 — before this one 5% rule covered both, which charged the
 * domestic traveler for the international card's cost.
 *
 * Each schedule is continuous where its halves meet: 2.5% of $60 and 5% of $30 are both
 * exactly $1.50, so no fare costs 50 cents more than the fare one cent below it.
 */
export function platformFee(travelCost: number, cardCountry?: string | null): number {
  // Mirrors backend/payments.js exactly: $2.00 minimum, then 5.0% domestic / 6.5%
  // international. Integer basis points prevent the quote and charge from drifting by a cent.
  const fareCents = Math.round(travelCost * 100);
  const bps = isDomesticCard(cardCountry) ? 500 : 650;
  return Math.max(APP_FEE, Math.ceil((fareCents * bps) / 10000) / 100);
}

export const procFor = (pay: string) => (pay === 'ach' ? PROC_ACH : PROC_CARD);
// The coordination commission: a flat 1% of the travel fare. NO CAP.
//
// This capped at $1 until 16 Aug 2026 — as does the founders' web demo, whose own
// coord() is Math.min(0.01*c, 1). Chad corrected it: "there is no 1 dollar cap, it is
// just a 1% + $1.50 amount." The demo is the reference for how the app LOOKS; the fare
// model is a business fact, and on a business fact the founders outrank the prototype.
//
// It matters most on long travel: a $120 journey was commissioned $1.00 and is now $1.20.
// backend/payments.js carries the same change — the two must never disagree.
export const coordinationFee = (cost: number) => Math.floor(0.01 * cost * 100) / 100;

// Payment method names in the demo's exact lettering.
// THE INVENTED ACCOUNT NUMBERS ARE GONE — 17 Aug 2026. These read
// "Bank Account · ACH ····4417" and "Visa ····8802": digits nobody owns, printed on Wallet,
// Travel Confirmation, the receipt and the profile as a record of the traveler's own
// accounts. Fabricated financial detail is the worst thing to put on a money screen.
//
// These are now generic, and they are only ever a PLACEHOLDER: the moment a travel is paid,
// the label is replaced with the method Stripe actually charged, read back from the
// confirmed PaymentIntent (see methodLabel in src/backend/payments.ts).
export const PAY_FRIENDLY: Record<string, string> = {
  ach: 'Bank account',
  apple: 'Apple Pay',
  gpay: 'Google Pay',
  card: 'Card',
};

// PAY_NOTES held "Demo payment — nothing real is charged yet" against every method. That
// sentence becomes false the moment a live Stripe key is installed, and a payment note is
// the worst place in the app for a stale claim. Whether money is real is now answered by the
// server's own key mode — see paymentModeNote() in src/state/PaymentConfigContext.tsx — so
// there is nothing left to keep in step by hand.

export const PAY_ORDER = ['ach', 'apple', 'gpay', 'card'] as const;

// Patron Support categories.
//
// THESE USED TO CARRY THEIR OWN ANSWERS. Each row held a `title` and `body` written months
// in advance — "Adjustment issued — $1.15 · The route deviated 0.8 miles from the optimal
// path" — which the app displayed 1.9 seconds after the row was tapped, before the traveler
// had said a word and without reading anything about their travel. It also credited nobody:
// the $1.15 was a sentence, not a refund.
//
// A category is now what it should always have been: a heading over a box the traveler
// writes in. The answer comes from the server (backend/support.js), which reads what they
// wrote against the recorded facts of that travel and either explains, refunds inside a
// server-enforced cap, or files the case to a person.
//
// `route` sends a category somewhere else entirely — a lost item needs its own flow, not a
// paragraph. `alwaysHuman` says so on screen BEFORE the traveler writes: the server enforces
// it regardless (backend/support.js ALWAYS_HUMAN), and someone reporting a safety incident
// should not have to wonder whether a machine is about to answer them.
export const ISSUES: Record<
  string,
  { label: string; prompt: string; route?: string; alwaysHuman?: boolean }
> = {
  fare: {
    label: 'traveler.incorrectTravelCost',
    prompt: 'traveler.promptFare',
  },
  lost: {
    label: 'traveler.lostItem',
    prompt: '',
    route: '/lost',
  },
  route: {
    label: 'traveler.routeConcern',
    prompt: 'traveler.promptRoute',
  },
  cancel: {
    label: 'traveler.cancellation',
    prompt: 'traveler.promptCancel',
  },
  safety: {
    label: 'traveler.safetyTopic',
    prompt: 'traveler.promptSafety',
    alwaysHuman: true,
  },
};

// The demo's phase register. Index = internal ride status 0..5.
export const STATUS_LABELS = [
  'Travel Confirmed',
  'Operator En Route',
  'Operator Arrived',
  'Traveler Onboard',
  'Arrival', // the demo's 4th phase title; the sub carries "Approaching your destination."
  'Travel Complete',
];

export const STATUS_ETAS = (pickupWait: number) => [
  'Confirmed',
  pickupWait + ' min',
  'Here',
  '18 min',
  '4 min',
  'Arriving',
];

// PAST_TRIPS_SEED and PRE_CREDITED are deleted, not left unused. Three fabricated journeys
// — June 28, June 21 and June 14, with amounts, travel numbers and a "$1.15 credit" on one
// — were merged into every account as travels that person had taken and paid for, and a
// receipt could be opened for any of them. Travel history comes from the records now.
