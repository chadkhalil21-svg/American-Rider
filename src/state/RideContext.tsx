import type { SmartPlan } from '../backend/smart';
import type { FeeLine } from '../data';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  APP_FEE,
  platformFee,
  DEP_PLACES,
  DepPlace,
  HOME_PLACE,
  ISSUES,
  PAY_FRIENDLY,
  PLACES,
  Place,
  Trip,
  coordinationFee,
  fareFromTotal,
  applyClassCents,
  operatorClassFor,
} from '../data';
import {
  dispatchRide,
  fetchMyRides,
  MatchedOp,
  recordTravelReview,
  RideRecord,
  watchRide,
  type TravelMonitor,
  distanceMiles,
} from '../backend/dispatch';
import { Coords, fetchQuote, isUnavailable } from '../backend/fares';
import { sendTravelMessage } from '../backend/messages';
import { cancelTravel, payForRide, settleTravel } from '../backend/payments';
import { announceTravel, answerCheckIn } from '../backend/checkin';
import {
  endTravelActivity,
  startTravelActivity,
  updateTravelActivity,
} from '../backend/liveActivity';
import {
  deleteScheduledRide,
  fetchScheduledRide,
  saveScheduledRide,
  watchScheduledRide,
  type ScheduledRide,
} from '../backend/scheduled';
import { fetchRoute, Route } from '../backend/route';
import { getCabinPrefs } from './cabinPrefs';
import { submitIssue, type SupportOutcome, type SupportTrip } from '../backend/support';
import { t as tr } from '../i18n';

export type Prefs = { quiet: boolean; charging: boolean; luggage: boolean; pet: boolean };
export type PayKey = 'ach' | 'apple' | 'gpay' | 'card';
export type Demand = 'quiet' | 'normal' | 'busy';
// `describing` is the rung that used to be missing: the traveler says what happened in their
// own words before anything is decided. The old flow went straight from a tapped category to
// a canned resolution, which is how the app came to answer complaints it had never read.
export type IssueState = null | 'describing' | 'resolving' | 'resolved';
export type Msg = { me: boolean; text: string };
export type SchedDate = 'today' | 'tomorrow' | 'pick';
export type SchedInfo = {
  when: string;
  time: string;
  period: string;
  arr: string;
  cost: number;
  /** The instant the travel is due. Without it a reservation cannot be read back as
   *  upcoming, which is why a scheduled travel used to vanish on the next launch. */
  atMs: number;
};
export type PaymentState = {
  status: 'idle' | 'processing' | 'paid' | 'failed';
  amountCents?: number;
  paymentIntentId?: string;
  // WHICH TRAVEL THIS PAYMENT IS FOR. Patron Support can refund against a PaymentIntent, and
  // this store only ever holds the most recent one — so a complaint about last week's travel
  // would have refunded today's charge. The id is only ever sent for its own travel.
  tripNo?: string;
  error?: string;
};
// How finding an operator is going: searching → matched, or none available / error (so the
// live screen can offer a retry instead of spinning on "Finding your operator…" forever).
export type DispatchState = 'idle' | 'searching' | 'matched' | 'none' | 'error';

const DEFAULT_PREFS: Prefs = { quiet: true, charging: false, luggage: true, pet: false };

const INITIAL_TRIP: Trip = {
  arr: 'Miami International Airport', dep: 'Brickell', cost: 24.5, proc: 0, total: 26.0, opRev: 24.26,
  pay: PAY_FRIENDLY.ach, no: 'AR-2047-MIA', date: 'July 6, 2:43 PM', subPrefix: 'July 6',
};

const nowLabel = () => {
  const d = new Date();
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
};

const rollWait = (): { pickupWait: number; demand: Demand } => {
  const roll = Math.random();
  if (roll < 0.25) return { pickupWait: 2, demand: 'quiet' };
  if (roll < 0.75) return { pickupWait: 3 + Math.floor(Math.random() * 2), demand: 'normal' };
  return { pickupWait: 6 + Math.floor(Math.random() * 3), demand: 'busy' };
};

export type SmartStatus = 'idle' | 'checking' | 'ok' | 'none' | 'unavailable';

// THE JOURNEY IS TWO REAL TRAVELS. Smart Travel used to be a simulation: a timer advanced
// three legs on a 4.2-second cadence under a made-up Travel Number, and a screen labelled
// "Total Charged" showed an amount nobody had charged (release review, 6 Sept 2026, P0).
// Chad's instruction (9 Sept 2026) is to build it real: two dispatched car travels around a
// transit leg the traveler rides on their own ticket. This is the record that ties them
// together. The platform fee is charged ONCE for the journey — on the combined car fare —
// which is why leg 2 has to know leg 1's number (see feeFor).
export type SmartJourney = {
  plan: SmartPlan;
  /** Where the journey began and where it ends — the endpoints leg 2 needs to restore. */
  pickup: DepPlace;
  destination: Place;
  destCoords: Coords;
  stage: 'leg1' | 'leg2';
  leg1No?: string;
  leg2No?: string;
};

export type RideStore = {
  // preferences
  defaultPrefs: Prefs;
  tripPrefs: Prefs;
  togglePref: (which: 'defaultPrefs' | 'tripPrefs', key: keyof Prefs) => void;

  // payment
  pay: PayKey;
  setPay: (p: PayKey) => void;

  // booking
  arrival: Place;
  departure: DepPlace;
  setArrival: (p: Place) => void;
  setDeparture: (p: DepPlace) => void;
  // Where this trip actually runs between, once geocoded. The server needs BOTH ends to price
  // by distance; with either missing it falls back to its named-destination table.
  tripCoords: { pickup: Coords; dest: Coords } | null;
  setTripCoords: (c: { pickup: Coords; dest: Coords } | null) => void;
  // The street path for the current trip, or null while it loads / when routing fails.
  // Null is fine — the map falls back to a straight line.
  route: Route | null;
  // The operator's street path from where he was matched to the pickup — what the map
  // animates while he's on the way. Null until matched (or when routing fails, in which
  // case the map drives him along a straight line instead).
  approachRoute: Route | null;
  // An exact pickup point the traveler dropped on the map, which beats geocoding the pickup's
  // name. A mall or a stadium covers a lot of ground — "The Falls" geocodes to the middle of
  // the property, which can be a long walk from where the traveler is actually standing.
  // Null means we fall back to geocoding `departure.name`.
  pickupPin: Coords | null;
  setPickupPin: (c: Coords | null) => void;
  pickupWait: number;
  demand: Demand;
  // The web demo's Travel Options: a class NAME the server prices (never a client price).
  travelClass: string;
  smartPlan: import('../backend/smart').SmartPlan | null;
  setSmartPlan: (p: import('../backend/smart').SmartPlan | null) => void;
  /** What the transit planner said about the trip being booked. 'idle' = not asked yet. */
  smartStatus: SmartStatus;
  setSmartStatus: (s: SmartStatus) => void;
  /** A Smart Travel journey in progress: the plan, and which car travel is being taken. */
  smartJourney: SmartJourney | null;
  /**
   * Seed the booking screens for car travel 1 (pickup → boarding stop) or car travel 2
   * (alighting stop → destination). Each is a real travel with its own Travel Number and
   * operator; Travel Confirmation and dispatch run exactly as for any other travel. Returns
   * false when the plan has no such car leg (a stop within walking distance has none).
   */
  beginSmartLeg: (which: 1 | 2) => boolean;
  endSmartJourney: () => void;
  setTravelClass: (c: string) => void;
  // The server-quoted STANDARD fare (cents) for the trip being booked, before class and
  // before the platform fee. Screens derive display prices from this; the charge is re-priced
  // server-side at confirm regardless.
  quotedFareCents: number | null;
  /** THE all-in price for the travel currently being booked. Never recompute this. */
  travelerTotal: number;
  setQuotedFareCents: (n: number | null) => void;
  /** Government fees the server fenced for this trip (an airport pickup fee), inside the price. */
  quotedFeeLines: FeeLine[];
  setQuotedFeeLines: (lines: FeeLine[]) => void;
  /** True while the travel is being re-priced after the pickup moved. */
  repricing: boolean;
  startBooking: (arrival?: Place) => void; // seeds trip prefs + fresh quote

  // live ride
  status: number; // 0..5
  rideActive: boolean;
  confirmRide: () => void;
  boardRide: () => void; // "I'm in the car" — resumes the trip from the arrival hold
  cancelRide: () => void;
  matchedOp: MatchedOp | null; // the real operator matched from the live database
  dispatchState: DispatchState; // how the search for an operator is going
  retryDispatch: () => void; // try matching an operator again after none/error
  myRides: RideRecord[]; // the traveler's own rides, read from the live database
  refreshMyRides: () => void;
  payment: PaymentState; // the live payment for the ride being booked


  // current / viewed trip
  lastTrip: Trip;
  viewTrip: (Trip & { sub?: string }) | null;
  setViewTrip: (t: (Trip & { sub?: string }) | null) => void;
  pastTrips: (Trip & { sub: string; credit: boolean })[];
  stats: { trips: number; spent: number };
  /** Write the traveler's rating for the Travel that just finished. American Rider does not offer tipping. */
  submitReview: (stars: number) => Promise<boolean>;

  // messaging — one thread per travel, so an operator always knows which journey a
  // message concerns (and a lost item thread is not mixed into the live ride's).
  msgs: Msg[]; // the current travel's thread
  sendMsg: (text: string) => void;
  threadFor: (tripNo: string) => Msg[];
  sendMsgTo: (tripNo: string, text: string, lostItemId?: string | null) => void;

  // help / issues
  issue: string | null;
  issueState: IssueState;
  issueTripNo: string;
  issueResult: SupportOutcome | null;
  openHelp: (tripNo?: string) => void;
  resetIssue: () => void;
  pickIssue: (key: string) => void;
  /** Send the traveler's own words to the server, which decides what happens. */
  submitDescription: (text: string) => void;
  /** A refund Patron Support issued on a travel: which one, and how much. */
  credited: { no: string; cents: number } | null;

  // scheduling
  schedDate: SchedDate;
  setSchedDate: (d: SchedDate) => void;
  schedDay: string; // label like 'Wed, Jul 8'
  setSchedDay: (d: string) => void;
  schedPeriod: 'AM' | 'PM';
  setSchedPeriod: (p: 'AM' | 'PM') => void;
  schedTime: string;
  setSchedTime: (t: string) => void;
  customTime: string;
  setCustomTime: (t: string) => void;
  scheduled: boolean;
  /** Route monitoring's reading of the travel underway: a delay it can explain, or a question. */
  travelMonitor: TravelMonitor | null;
  respondToCheckIn: (reply: 'ok' | 'help') => Promise<boolean>;
  schedInfo: SchedInfo | null;
  /** null while saving · true stored on the account · false this screen only. */
  schedSaved: boolean | null;
  /** What the dispatcher has done with it: still waiting, operator sent, or why not. */
  schedState: ScheduledRide | null;
  scheduleRide: (info: SchedInfo) => void;
  cancelScheduled: () => void;

  // audio
  share: boolean;
  toggleShare: () => void;

  // misc
  stmtDone: boolean;
  markStmtDone: () => void;
};

// An operator's progress, as the traveler's screen numbers it.
//
//   0 Travel Confirmed · 1 Operator En Route · 2 Operator Arrived
//   3 Traveler Onboard · 4 Arrival · 5 Travel Complete
//
// 'assigned' is absent deliberately: it means dispatch has chosen somebody who has not
// answered yet, which is not progress to report. 4 has no operator action behind it — nobody
// presses "approaching" — so it stays where the timer left it.
const OPERATOR_STEP: Record<string, number> = {
  accepted: 1,
  arrived: 2,
  onboard: 3,
  completed: 5,
};

const RideContext = createContext<RideStore | null>(null);

export function RideProvider({ children }: { children: React.ReactNode }) {
  const [defaultPrefs, setDefaultPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [tripPrefs, setTripPrefs] = useState<Prefs>({ ...DEFAULT_PREFS });
  const [pay, setPay] = useState<PayKey>('ach');
  // Read from refreshMyRides, which must not re-create itself when the method changes.
  const payRef = useRef(pay);
  payRef.current = pay;
  const [travelClass, setTravelClass] = useState('standard');
  const [smartPlan, setSmartPlan] = useState<import('../backend/smart').SmartPlan | null>(null);
  const [smartStatus, setSmartStatus] = useState<SmartStatus>('idle');
  const [smartJourney, setSmartJourney] = useState<SmartJourney | null>(null);
  const smartJourneyRef = useRef<SmartJourney | null>(null);
  smartJourneyRef.current = smartJourney;
  // The fare of the journey's first car travel, in dollars — what leg 2's fee is computed
  // against. Zero when the boarding stop was within walking distance and there was no leg 1.
  const smartLeg1Fare = (j: SmartJourney | null) =>
    (j?.plan.legs.find((l) => l.kind === 'car')?.cents ?? 0) / 100;
  // ONE PLATFORM FEE PER JOURNEY. Leg 1 is charged exactly as any travel is. Leg 2 pays the
  // difference between the fee on the combined car fare and the fee leg 1 already carried —
  // never below zero. backend/payments.js applies the same rule from `journeyNo`; the two
  // must never disagree, or the traveler is quoted one amount and charged another.
  const feeFor = (fare: number, j: SmartJourney | null) => {
    if (j && j.stage === 'leg2' && j.leg1No) {
      const leg1 = smartLeg1Fare(j);
      return Math.max(0, +(platformFee(leg1 + fare) - platformFee(leg1)).toFixed(2));
    }
    return platformFee(fare);
  };
  const [quotedFareCents, setQuotedFareCents] = useState<number | null>(null);
  const [quotedFeeLines, setQuotedFeeLines] = useState<FeeLine[]>([]);
  const [repricing, setRepricing] = useState(false);
  const quotedFeeLinesRef = useRef<FeeLine[]>([]);
  quotedFeeLinesRef.current = quotedFeeLines;
  const governmentFee = (lines: FeeLine[]) => lines.reduce((sum, l) => sum + l.cents, 0) / 100;

  const [arrival, setArrival] = useState<Place>(PLACES[0]);

  // ---- THE PRICE. ONE DERIVATION, USED BY EVERY SCREEN THAT SHOWS MONEY. ------------------
  //
  // Four screens computed this themselves — reserve, review, schedule and options — and three
  // of them got it wrong in the same way: they read `arrival.cost`, the base price from the
  // named-place table, and added the platform fee to THAT. So they ignored both the server's
  // quote and the travel class.
  //
  // What that produced: a traveler choosing Large Vehicle saw the Standard price on Reserve
  // and on Schedule, and was charged the Large Vehicle price. The app quoted one number and
  // Stripe took another — the single defect this product's rubric names as the most serious
  // there is. Found by external review, 4 Sept 2026.
  //
  // `quotedFareCents` is the server's answer with the class already applied; it is the only
  // fare anybody should build a price from. The named-place cost is the fallback for the web
  // preview, where there is no geocoder and therefore no server quote.
  //
  // Every screen now reads THIS. A screen that computes its own price can drift from the one
  // the server charges, and the only way to be sure it cannot is for there to be one.
  // THE CLASS IS APPLIED HERE, and leaving it out was the very bug this exists to remove —
  // I wrote that version first. `quotedFareCents` is the STANDARD fare; Large Vehicle, Pet
  // Friendly and the rest are multipliers on top of it, exactly as options.tsx, review.tsx
  // and the booking path all do. Same three lines, one place.
  const travelerTotal = useMemo(() => {
    const baseCents = quotedFareCents ?? Math.round(arrival.cost * 100);
    const fare = applyClassCents(baseCents, travelClass) / 100;
    return +(fare + feeFor(fare, smartJourney) + governmentFee(quotedFeeLines)).toFixed(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotedFareCents, arrival.cost, travelClass, smartJourney, quotedFeeLines]);
  const [tripCoords, setTripCoords] = useState<{ pickup: Coords; dest: Coords } | null>(null);
  const tripCoordsRef = useRef<{ pickup: Coords; dest: Coords } | null>(null);
  tripCoordsRef.current = tripCoords;
  const [pickupPin, setPickupPin] = useState<Coords | null>(null);

  // MOVING THE PIN MOVES THE PRICE. The pin re-drew the route and re-dispatched from the new
  // corner, but nothing re-quoted — so Travel Confirmation could show the price of the old
  // pickup while /create-payment-intent charged from the new one. The quoted amount and the
  // charged amount are the same number or they are a defect; this keeps them the same.
  const repriceSeq = useRef(0);
  useEffect(() => {
    if (!pickupPin || rideActiveRef.current) return; // a travel underway is already priced
    const dest =
      tripCoordsRef.current?.dest ??
      (arrival.lat != null && arrival.lng != null ? { lat: arrival.lat, lng: arrival.lng } : null);
    if (!dest) return;
    const seq = ++repriceSeq.current;
    setRepricing(true);
    fetchQuote({ pickup: pickupPin, dest, destination: arrival.short, travelClass })
      .then((q) => {
        if (seq !== repriceSeq.current) return; // a newer pin superseded this quote
        if (q && !isUnavailable(q)) {
          setQuotedFareCents(q.travelCostCents);
          setQuotedFeeLines(q.feeLines);
        }
      })
      .finally(() => {
        if (seq === repriceSeq.current) setRepricing(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupPin, arrival.short, travelClass]);
  // Read from runDispatch, which must not re-create itself when the traveler moves the pin.
  const pickupPinRef = useRef<Coords | null>(null);
  pickupPinRef.current = pickupPin;
  const [route, setRoute] = useState<Route | null>(null);
  // Read from confirmRide and dispatch, which must not re-create when the route loads.
  const routeRef = useRef<Route | null>(null);
  routeRef.current = route;
  // THE DISTANCE ON THE RECEIPT. Routed miles when the map has a street route for this
  // trip; otherwise the fare model's own estimate (straight line × 1.3), so the receipt
  // states the figure the price was built from rather than nothing.
  const tripMiles = (): number | undefined => {
    const r = routeRef.current;
    if (r && r.distanceMeters > 0) return Math.round((r.distanceMeters / 1609.344) * 10) / 10;
    const c = tripCoordsRef.current;
    if (!c) return undefined;
    return Math.round(distanceMiles(c.pickup, c.dest) * 1.3 * 10) / 10;
  };
  // When the traveler boarded, for the receipt's total time. Reset at every confirmation.
  const onboardAtRef = useRef<number | null>(null);

  // Fetch the street path whenever the trip's endpoints change — including a pickup-pin move
  // mid-dispatch, which re-keys this effect and redraws the route from the new spot. A stale
  // response from a superseded request is ignored rather than drawn.
  useEffect(() => {
    if (!tripCoords) {
      setRoute(null);
      return;
    }
    let live = true;
    setRoute(null);
    fetchRoute(tripCoords.pickup, tripCoords.dest).then((r) => {
      if (live) setRoute(r);
    });
    return () => {
      live = false;
    };
  }, [tripCoords]);

  const [departure, setDeparture] = useState<DepPlace>(DEP_PLACES[0]);
  const [pickupWait, setPickupWait] = useState(3);
  const [demand, setDemand] = useState<Demand>('normal');
  const [status, setStatus] = useState(0);
  const [rideActive, setRideActive] = useState(false);
  const [matchedOp, setMatchedOp] = useState<MatchedOp | null>(null);

  // The operator's approach: from where he was matched to the pickup. Re-fetched if the
  // traveler moves the pickup pin while he's en route (tripCoords re-keys this effect).
  const [approachRoute, setApproachRoute] = useState<Route | null>(null);
  useEffect(() => {
    if (!matchedOp || !tripCoords) {
      setApproachRoute(null);
      return;
    }
    let live = true;
    setApproachRoute(null);
    fetchRoute({ lat: matchedOp.lat, lng: matchedOp.lng }, tripCoords.pickup).then((r) => {
      if (live) setApproachRoute(r);
    });
    return () => {
      live = false;
    };
  }, [matchedOp, tripCoords]);
  const [dispatchState, setDispatchState] = useState<DispatchState>('idle');
  const [myRides, setMyRides] = useState<RideRecord[]>([]);
  const [payment, setPayment] = useState<PaymentState>({ status: 'idle' });
  const [tripSeq, setTripSeq] = useState(2047);
  const [lastTrip, setLastTrip] = useState<Trip>(INITIAL_TRIP);
  // Every completed ride, newest first — keeps old receipts reachable.
  // STARTS EMPTY. This began as [INITIAL_TRIP] — a fabricated $26.00 journey to Miami
  // International on July 6, travel number AR-2047-MIA — which every account carried as its
  // own completed travel, and which a receipt could be opened against.
  const [completedTrips, setCompletedTrips] = useState<Trip[]>([]);

  // The database has to learn what became of the travel. Before this, cancelling cleared
  // the screen and left the record saying 'assigned' — so the Travel Log listed cancelled
  // travels among completed ones and a receipt existed for a journey that never happened.
  const activeRideId = useRef<string | null>(null);
  // THE TRAVEL BEING WATCHED, which is not the same fact as "who is driving it".
  //
  // The status subscription below used to key on `matchedOp?.rideId`, so nulling matchedOp
  // tore down the watcher — and the 'declined' branch nulls matchedOp from inside that very
  // callback. The subscription unsubscribed itself from the travel it was watching. If the
  // re-dispatch then found nobody, the traveler sat on "No operator matched yet" while their
  // travel carried on in the database without them: on 29 Aug 2026 the operator drove
  // AR-2109-MIA to completion and the traveler was shown no arrival, no receipt and no entry
  // in their Travel Log, having paid $19.44.
  //
  // A travel is watched until it ENDS, not until its operator changes.
  const [watchedRideId, setWatchedRideId] = useState<string | null>(null);
  // Read by sendMsgTo, which must not re-create itself every time the watched ride changes.
  const watchedRideIdRef = useRef<string | null>(null);
  watchedRideIdRef.current = watchedRideId;
  // The travel that just finished, so its rating can be written to the same record.
  const reviewedRideId = useRef<string | null>(null);
  // The PaymentIntent this travel was charged on. Held so the operator's 99% can be released
  // against that exact charge when the travel completes — see settleTravel.
  const paidIntentRef = useRef<string | null>(null);
  // The completed travel waiting to be settled, and the ones already settled.
  const settleRideRef = useRef<string | null>(null);
  const settledRides = useRef<Set<string>>(new Set());

  /**
   * Release the operator's 99% — but only once BOTH halves exist.
   *
   * THE DEFECT THIS CLOSES, found by running a real booking: settlement was attempted at the
   * moment the travel completed, and read the PaymentIntent from a ref that the payment
   * itself fills in later. The two are independent — the traveler is in Stripe's sheet while
   * the journey advances on its own clock — so a travel that finished before the card was
   * confirmed had no intent to settle against, and the call was silently skipped. Observed
   * exactly that: the traveler was charged $19.29 and the operator was paid nothing, with
   * nothing recorded as owed either, because the request that records it never ran.
   *
   * Now whichever half arrives second triggers it, and `settledRides` makes a travel
   * unsettleable twice no matter which order they land in.
   */
  const trySettle = useCallback(() => {
    const rideId = settleRideRef.current;
    const paymentIntentId = paidIntentRef.current;
    if (!rideId || !paymentIntentId || settledRides.current.has(rideId)) return;
    settledRides.current.add(rideId);
    settleTravel({ rideId, paymentIntentId });
  }, []);
  const [viewTrip, setViewTrip] = useState<(Trip & { sub?: string }) | null>(null);
  const [stats, setStats] = useState({ trips: 23, spent: 612.85 });
  // Threads keyed by Travel Number. The seed is the demo's opening line on the first trip.
  const [threads, setThreads] = useState<Record<string, Msg[]>>({
    [INITIAL_TRIP.no]: [{ me: false, text: tr('traveler.opOnMyWay') }],
  });
  const [issue, setIssue] = useState<string | null>(null);
  const [issueState, setIssueState] = useState<IssueState>(null);
  const [issueResult, setIssueResult] = useState<SupportOutcome | null>(null);
  // NO TRAVEL UNTIL THERE IS ONE. This was seeded with INITIAL_TRIP's number, so Patron
  // Support opened showing "Travel AR-2047-MIA" to a traveler who had never taken a journey —
  // the seeded demonstration one, printed as though it were theirs.
  //
  // THE GUARD EXISTED AND WAS ON THE WRONG SIDE. openHelp already refuses to SEND the seeded
  // trip (line ~1295 maps it to ''), and the emergency screen was fixed the same way on
  // 19 September. Both protected what the server receives. Neither protected what the traveler
  // READS, and the screen prints this value directly. Third screen, same fault, and the first
  // two fixes are the reason it looked handled.
  const [issueTripNo, setIssueTripNo] = useState('');
  const [credited, setCredited] = useState<{ no: string; cents: number } | null>(null);
  const [schedDate, setSchedDate] = useState<SchedDate>('tomorrow');
  const [schedDay, setSchedDay] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  });
  const [schedPeriod, setSchedPeriod] = useState<'AM' | 'PM'>('AM');
  const [schedTime, setSchedTime] = useState('6:00');
  const [customTime, setCustomTime] = useState('');
  const [scheduled, setScheduled] = useState(false);
  // What route monitoring makes of the travel underway. Null on an ordinary journey — this is
  // never furniture; it appears only when the platform has something to say.
  const [travelMonitor, setTravelMonitor] = useState<TravelMonitor | null>(null);
  const [schedInfo, setSchedInfo] = useState<SchedInfo | null>(null);
  // null while the write is in flight; false means it exists on this screen only.
  const [schedSaved, setSchedSaved] = useState<boolean | null>(null);
  const schedIdRef = useRef<string | null>(null);
  const schedLoadRef = useRef<'idle' | 'loading' | 'done'>('idle');
  // The id as STATE as well as a ref: the ref is what cancelling deletes, and the state is
  // what the watcher below subscribes to. A ref cannot start an effect.
  const [schedId, setSchedId] = useState<string | null>(null);
  // What the dispatcher has done with the reservation — written by backend/scheduler.js and
  // read here. This is how a traveler finds out an operator has been sent at 6:22 AM for a
  // 6:30 pickup: there is no push notification yet, so the record is the announcement.
  const [schedState, setSchedState] = useState<ScheduledRide | null>(null);
  const [share, setShare] = useState(true);
  const [stmtDone, setStmtDone] = useState(false);

  const rideTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const issueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped whenever a case starts or is abandoned, so a late answer to an abandoned case
  // cannot render over a later one.
  const issueGen = useRef(0);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTotalRef = useRef(26.25);
  const lastTripRef = useRef<Trip>(INITIAL_TRIP);
  // The live payment, readable from a callback without re-creating it whenever it changes.
  const paymentRef = useRef<PaymentState>({ status: 'idle' });
  // Mirrors `status` so the ride tick keeps side effects out of state updaters
  // (updaters can be re-invoked under StrictMode/concurrent rendering).
  const statusRef = useRef(0);
  // Mirrors `rideActive` so sendMsgTo can tell the live demo ride from any other thread
  // without re-creating itself on every status change.
  const rideActiveRef = useRef(false);
  rideActiveRef.current = rideActive;
  // cancelRide is declared below confirmRide; the payment callback needs it when a traveler
  // closes the PaymentSheet, so it is reached through a ref rather than reordering the file.
  const cancelRideRef = useRef<() => void>(() => {});
  paymentRef.current = payment;

  useEffect(
    () => () => {
      if (rideTimer.current) clearInterval(rideTimer.current);
      if (issueTimer.current) clearTimeout(issueTimer.current);
      if (msgTimer.current) clearTimeout(msgTimer.current);
    },
    [],
  );

  const togglePref = useCallback((which: 'defaultPrefs' | 'tripPrefs', key: keyof Prefs) => {
    const set = which === 'defaultPrefs' ? setDefaultPrefs : setTripPrefs;
    set((p) => ({ ...p, [key]: !p[key] }));
  }, []);

  const startBooking = useCallback(
    (dest?: Place) => {
      // THE SAVED CABIN ENVIRONMENT IS APPLIED TO EVERY TRAVEL (Chad, 14 Sept 2026). This
      // copied `defaultPrefs`, which nothing could edit or persist, so atmosphere, the cable
      // and luggage assistance reset on every booking while the screen said they were saved.
      // src/state/cabinPrefs.ts is the saved set; this travel starts as a copy of it.
      const saved = getCabinPrefs();
      setTripPrefs({ ...defaultPrefs, quiet: saved.quiet, charging: saved.charging, luggage: saved.luggage });
      const q = rollWait();
      setPickupWait(q.pickupWait);
      setDemand(q.demand);
      if (dest) setArrival(dest);
      setViewTrip(null);
      // Each booking starts with a clean slate. Without this, a pin dropped for LAST week's
      // trip greeted the next one with "Pickup pin set ✓" at some old address — and stale
      // coordinates from the previous ride could linger under the new one.
      setPickupPin(null);
      // KEEP A REAL POSITION. This unconditionally reset departure to DEP_PLACES[0] —
      // "Current location — Brickell", with fixed Brickell coordinates. The home screen
      // resolves the device's actual position and sets it, and this threw that away on the
      // very next line, at the start of every booking. Since the fare is quoted from the
      // departure coordinates, a traveler in Wynwood was collected from Brickell and priced
      // from Brickell. The stale-pin reset above is still right; the pickup is not stale
      // when the device just told us where it is.
      setDeparture((prev) => (prev?.resolved ? prev : DEP_PLACES[0]));
      setTripCoords(null);
      setTravelClass('standard');
      setQuotedFareCents(null);
      setQuotedFeeLines([]);
    },
    [defaultPrefs],
  );

  const refreshMyRides = useCallback(async () => {
    try {
      const rides = await fetchMyRides();
      setMyRides(rides);
      // Continue this traveler's trip numbers past the rides they already have, so a
      // fresh launch doesn't hand out AR-2048 again on every first booking.
      setTripSeq((s) => Math.max(s, 2047 + rides.length));
      // A TRAVEL SURVIVES THE APP CLOSING. Everything about a live travel — that one is
      // running at all, its status, the matched operator, the trip record — was React state
      // and nothing else, so a traveler whose phone slept or whose app was swept away came
      // back to a home screen that said they had no travel while an operator was driving to
      // them. Firestore is the authority on whether a travel is live; this reads it back.
      // Never over a session already in progress, and never for a travel this phone just
      // finished: only when the store is empty and the record says the travel is assigned.
      if (!rideActiveRef.current && !activeRideId.current) {
        const live = rides.find((r) => r.status === 'assigned');
        if (live) {
          const total = live.totalCents / 100;
          const fare = fareFromTotal(+(total - (live.governmentFeeCents ?? 0) / 100).toFixed(2));
          const when = new Date(live.createdAt);
          lastTotalRef.current = total;
          const trip: Trip = {
            arr: live.arr,
            dep: live.dep,
            cost: fare,
            proc: 0,
            total,
            opRev: fare - coordinationFee(fare),
            pay: PAY_FRIENDLY[payRef.current] ?? 'Bank account',
            no: live.tripNo || live.id,
            date: `Today, ${nowLabel()}`,
            subPrefix: 'Today',
            operator: live.operatorName || undefined,
            miles: live.miles,
            feeLines: live.feeLines,
          };
          lastTripRef.current = trip;
          setLastTrip(trip);
          // The operator's card is rebuilt from what dispatch recorded. A travel dispatched
          // before those fields existed restores without them rather than inventing a car.
          if (live.operatorId && live.operatorCar && live.operatorPlate) {
            setMatchedOp({
              id: live.operatorId,
              demo: live.operatorDemo ?? false,
              name: live.operatorName,
              car: live.operatorCar,
              plate: live.operatorPlate,
              etaMin: live.operatorEtaMin ?? 0,
              miles: live.operatorMiles ?? 0,
              rideId: live.id,
              lat: live.operatorLat ?? 0,
              lng: live.operatorLng ?? 0,
            });
          }
          // Onboard is the one step the operator's app stamps, so it is the only one that
          // can be known here; anything earlier is reported as the operator being on the way.
          statusRef.current = live.onboardAt ? 3 : 1;
          setStatus(live.onboardAt ? 3 : 1);
          setRideActive(true);
          activeRideId.current = live.id;
          settleRideRef.current = live.id;
          setWatchedRideId(live.id); // resume following the operator's own reports
        }
      }
    } catch {
      /* ignore — offline / no rides yet */
    }
  }, []);

  // THE CHARGE THIS BOOKING IS WAITING TO MAKE.
  //
  // Payment used to start on the line after dispatch, in parallel with it. So a traveler was
  // charged before anyone had been found — and when nobody was found, they sat on a "No
  // operators available / Try again" screen having already paid, under a cancel box that said
  // "Free to cancel". At launch the fleet is empty until operators join, so that was not an
  // edge case; it was every booking. Nothing is charged now until somebody is actually coming.
  const pendingChargeRef = useRef<null | (() => void)>(null);

  // Operators who have already declined THIS travel. Cleared when a new booking starts.
  const declinedByRef = useRef<string[]>([]);

  // The class the current booking was sold under. Held in a ref because runDispatch is
  // memoised and retried from the ride screen — reading state directly would dispatch last
  // booking's class after a retry.
  const travelClassRef = useRef('standard');
  useEffect(() => {
    travelClassRef.current = travelClass;
  }, [travelClass]);

  // Match the nearest available operator for the ride already staged in lastTripRef.
  // Tracks a real state so the live screen can show progress, a "none available" message,
  // or an error with a retry — instead of the old silent, endless "Finding your operator…".
  const runDispatch = useCallback(() => {
    const trip = lastTripRef.current;
    // WHERE THE TRAVELER ACTUALLY IS, in the order we can trust it: the pin they dropped on
    // the map, then this travel's geocoded pickup, then the departure's own coordinates.
    const from =
      pickupPinRef.current ??
      tripCoordsRef.current?.pickup ??
      (departure.lat != null && departure.lng != null
        ? { lat: departure.lat, lng: departure.lng }
        : null);
    // NO INVENTED POSITION. The last resort was a hardcoded Brickell corner, so a traveler
    // whose position we did not know was collected from a place they had never named. There
    // is no safe guess for where a person is standing; dispatch stops and says so.
    if (!from) {
      setDispatchState('none');
      return Promise.resolve(null);
    }
    setMatchedOp(null);
    setDispatchState('searching');
    return dispatchRide({
      // WHERE THE TRAVELER ACTUALLY IS, in the order we can trust it: the pin they dropped
      // on the map, then the geocoded endpoints of this travel, then the departure's own
      // coordinates. The last resort used to be a hardcoded Brickell corner, which meant a
      // traveler whose position we did not know was collected from a place they had never
      // named — so dispatch now refuses instead, and the caller reports it.
      pickup: from,
      destinationPoint: tripCoords?.dest ?? null,
      dep: departure.short,
      dest: arrival.short,
      // THE CLASS THE TRAVELER PAID FOR. This was hardcoded to 'Standard', so the class
      // was priced, charged, and then thrown away on the way to dispatch: a $29.07 Large
      // Vehicle booking matched a four-seat saloon, and an Accessible booking — sold as
      // "Ramp or assistance equipped" — matched a car with neither. Selling one service and
      // dispatching another is the same defect as taking a fare for a travel nobody drove.
      cls: operatorClassFor(travelClassRef.current),
      // Nobody is offered the same travel twice.
      excludeIds: declinedByRef.current,
      journeyNo: smartJourneyRef.current?.stage === 'leg2' ? smartJourneyRef.current.leg1No ?? null : null,
    })
      .then((res) => {
        if (res) {
          if (res.tripNo) {
            const authoritativeTrip = { ...lastTripRef.current, no: res.tripNo };
            lastTripRef.current = authoritativeTrip;
            setLastTrip(authoritativeTrip);
            const journey = smartJourneyRef.current;
            if (journey) {
              const stamped = journey.stage === 'leg1'
                ? { ...journey, leg1No: res.tripNo }
                : { ...journey, leg2No: res.tripNo };
              smartJourneyRef.current = stamped;
              setSmartJourney(stamped);
            }
          }
          setMatchedOp(res);
          activeRideId.current = res.rideId; // handle for writing the outcome back
          setWatchedRideId(res.rideId);
          setDispatchState('matched');
          refreshMyRides();
          // TELL THE OPERATOR. The travel was written to Firestore from this phone, so the
          // server does not learn of it until its next sweep — and an operator whose app is
          // in their pocket has no other way to find out. This is the notification the whole
          // operator loop rested on and did not have.
          announceTravel(res.rideId, 'assigned');
          // Somebody is coming — now take the money. Held in a ref rather than chained at the
          // call site so a retry after "no operators available" charges too, without giving
          // this callback a new identity on every render.
          const charge = pendingChargeRef.current;
          pendingChargeRef.current = null;
          charge?.();
        } else {
          // No available operator nearby (or signed out) — surface it, don't hang. Nothing
          // has been charged, and the screen must not imply otherwise.
          setDispatchState('none');
        }
        return res;
      })
      .catch(() => {
        setDispatchState('error');
        return null;
      });
  }, [arrival, departure, refreshMyRides]);
  // Reached from the travel watcher, which must not re-subscribe when runDispatch's identity
  // changes. Same pattern as cancelRideRef and finishTravelRef.
  const runDispatchRef = useRef<() => void>(() => {});
  runDispatchRef.current = runDispatch;

  const beginSmartLeg = useCallback(
    (which: 1 | 2): boolean => {
      const plan = which === 1 ? smartPlan : smartJourneyRef.current?.plan ?? smartPlan;
      if (!plan) return false;
      const firstTransit = plan.legs.findIndex((l) => l.kind === 'transit');
      if (firstTransit < 0) return false;
      const stopPlace = (stop: { name: string; lat: number; lng: number }, cost: number): Place => ({
        name: stop.name,
        short: stop.name,
        cost,
        meta: '',
        lat: stop.lat,
        lng: stop.lng,
      });
      if (which === 1) {
        const leg = plan.legs[firstTransit - 1];
        if (!leg || leg.kind !== 'car' || !tripCoords) return false;
        const dest = stopPlace(plan.from, leg.cents / 100);
        setSmartJourney({
          plan,
          pickup: departure,
          destination: arrival,
          destCoords: tripCoords.dest,
          stage: 'leg1',
        });
        setArrival(dest);
        setTripCoords({ pickup: tripCoords.pickup, dest: { lat: plan.from.lat, lng: plan.from.lng } });
        setQuotedFareCents(leg.cents);
        setQuotedFeeLines(leg.feeLines ?? []);
        setTravelClass('standard');
        return true;
      }
      const journey = smartJourneyRef.current;
      const lastTransit = plan.legs.map((l) => l.kind).lastIndexOf('transit');
      const leg = plan.legs[lastTransit + 1];
      if (!leg || leg.kind !== 'car') return false;
      const from = { lat: plan.to.lat, lng: plan.to.lng };
      const destination = journey?.destination ?? arrival;
      const destCoords = journey?.destCoords ?? tripCoords?.dest;
      if (!destCoords) return false;
      const next: SmartJourney = journey
        ? { ...journey, stage: 'leg2' }
        : { plan, pickup: departure, destination, destCoords, stage: 'leg2' };
      smartJourneyRef.current = next;
      setSmartJourney(next);
      setDeparture({ name: plan.to.name, short: plan.to.name, lat: from.lat, lng: from.lng, resolved: true });
      setArrival({ ...destination, cost: leg.cents / 100 });
      setTripCoords({ pickup: from, dest: destCoords });
      setQuotedFareCents(leg.cents);
      setQuotedFeeLines(leg.feeLines ?? []);
      setTravelClass('standard');
      return true;
    },
    [smartPlan, tripCoords, departure, arrival],
  );

  const endSmartJourney = useCallback(() => {
    smartJourneyRef.current = null;
    setSmartJourney(null);
    setSmartPlan(null);
    setSmartStatus('idle');
  }, []);

  const confirmRide = useCallback(() => {
    // Clear AND null: the match-effect below only starts a timer when the ref is empty,
    // so a stale (already-cleared) id left in the ref would silently freeze the next ride.
    if (rideTimer.current) clearInterval(rideTimer.current);
    rideTimer.current = null;
    // The trip's fare: the server's quote when we have one (with the travel class applied
    // using the SAME math the server uses), else the placeholder table price. The charge
    // itself is still priced server-side from destination+class — this is for display/records.
    const baseCents = quotedFareCents ?? Math.round(arrival.cost * 100);
    const costN = applyClassCents(baseCents, travelClass) / 100;
    const coord = coordinationFee(costN);
    const nextSeq = tripSeq + 1;
    // platformFee(), not APP_FEE. The fee is $1.50 up to a $30 fare and 5% of the fare above
    // it; the server has always charged the real one. Using the flat figure here meant the
    // trip record — and therefore the receipt, the Travel Log and the operator's fare —
    // disagreed with what Stripe actually took on any larger travel.
    // One all-in price: the fare, the platform fee, and any government fee on the trip.
    const total = +(costN + feeFor(costN, smartJourneyRef.current) + governmentFee(quotedFeeLinesRef.current)).toFixed(2);
    lastTotalRef.current = total;
    setTripSeq(nextSeq);
    statusRef.current = 0;
    setStatus(0);
    setRideActive(true);
    declinedByRef.current = []; // a new travel, offered to everyone again
    onboardAtRef.current = null;
    const trip: Trip = {
      arr: arrival.short,
      dep: departure.short,
      cost: costN,
      proc: 0,
      total,
      opRev: costN - coord,
      pay: PAY_FRIENDLY[pay],
      no: `AR-${nextSeq}-MIA`,
      date: `Today, ${nowLabel()}`,
      subPrefix: 'Today',
      miles: tripMiles(),
      feeLines: quotedFeeLinesRef.current,
    };
    lastTripRef.current = trip;
    setLastTrip(trip);
    // A Smart Travel car leg carries the journey's record of its own Travel Number.
    const journey = smartJourneyRef.current;
    if (journey) {
      const stamped =
        journey.stage === 'leg1' ? { ...journey, leg1No: trip.no } : { ...journey, leg2No: trip.no };
      smartJourneyRef.current = stamped;
      setSmartJourney(stamped);
    }
    setThreads((t) => ({ ...t, [trip.no]: [{ me: false, text: tr('traveler.opOnMyWay') }] }));
    // Real payment: the server prices the travel and creates the intent, then Stripe's own
    // PaymentSheet collects the card on the phone. The card never reaches our server, and the
    // app never sends an amount.
    //
    // NOT RUN YET. This is handed to dispatch and fires only once an operator has been
    // matched — see pendingChargeRef. Charging in parallel with the search meant a traveler
    // paid for a travel that might have nobody to drive it.
    pendingChargeRef.current = () => {
    setPayment({ status: 'processing', tripNo: trip.no });
    payForRide({
      destination: arrival.short,
      departure: departure.short,
      travelClass,
      tripNo: trip.no,
      // Present once the trip has been geocoded; absent on web, where the server prices from
      // its named-destination table instead.
      pickup: tripCoords?.pickup ?? null,
      dest: tripCoords?.dest ?? null,
      // The travel being paid for, so the SERVER can stamp the payment onto it. This app's
      // own copy below is now the second route to settlement, not the only one.
      rideId: settleRideRef.current ?? matchedOpRef.current?.rideId ?? null,
      // Leg 2 of a Smart Travel journey names leg 1, so the server charges the journey's
      // one platform fee across the two rather than a second one.
      journeyNo:
        smartJourneyRef.current?.stage === 'leg2' ? smartJourneyRef.current.leg1No ?? null : null,
    })
      .then((r) => {
        if (r.ok) {
          paidIntentRef.current = r.paymentIntentId ?? null;
          // The travel may already have finished while the sheet was open.
          trySettle();
          setPayment({
            status: 'paid',
            amountCents: r.amountCents,
            paymentIntentId: r.paymentIntentId,
            tripNo: trip.no,
          });
          // The receipt names the method Stripe actually charged, not the one selected in
          // Wallet — with the PaymentSheet those are different things, and a receipt must
          // say what happened.
          if (r.methodLabel) {
            const paid = { ...lastTripRef.current, pay: r.methodLabel };
            lastTripRef.current = paid;
            setLastTrip((t) => (t.no === paid.no ? paid : t));
            setCompletedTrips((prev) => prev.map((t) => (t.no === paid.no ? paid : t)));
          }
          return;
        }
        // Closing the sheet is a decision, not a fault. The travel is cancelled rather than
        // left running unpaid, and nothing is reported as an error.
        setPayment({
          status: r.canceled ? 'idle' : 'failed',
          error: r.canceled ? undefined : r.error,
          tripNo: trip.no,
        });
        if (r.canceled) cancelRideRef.current();
      })
      .catch(() =>
        setPayment({ status: 'failed', error: tr('traveler.paymentServerUnreachable'), tripNo: trip.no }),
      );
    };

    // Find somebody first. The charge above runs the moment one is matched, and never if
    // one is not.
    runDispatch();
    // NOTE: the ride's progress timer does NOT start here — it starts when an operator is
    // actually matched (see the effect below). Starting it at confirm meant the demo could
    // reach "Miguel is here" before Miguel was even found, skipping the whole approach
    // animation the traveler is watching for.
  }, [arrival, departure, pay, tripSeq, refreshMyRides, runDispatch, quotedFareCents, travelClass]);

  // Everything that happens when a travel finishes, wherever the news came from.
  //
  // This lived inside the demo timer's `next === 5` branch, which was fine while a stopwatch
  // was the only thing that could end a journey. A real operator can end one now, so the
  // outcome — the record, the settlement, the Travel Log — has to be reachable from both.
  const finishTravelRef = useRef<() => void>(() => {});
  const finishTravel = useCallback(() => {
    if (rideTimer.current) {
      clearInterval(rideTimer.current);
      rideTimer.current = null;
    }
    setRideActive(false);
    setStats((st) => ({ trips: st.trips + 1, spent: st.spent + lastTotalRef.current }));
    // Boarding to completion, for the receipt. Unknown when nobody recorded boarding.
    const minutes = onboardAtRef.current
      ? Math.max(1, Math.round((Date.now() - onboardAtRef.current) / 60000))
      : undefined;
    const finished: Trip = { ...lastTripRef.current, minutes };
    lastTripRef.current = finished;
    setLastTrip(finished);
    setCompletedTrips((prev) => (prev[0]?.no === finished.no ? prev : [finished, ...prev]));
    if (!activeRideId.current) return;
    const ridePaid = activeRideId.current;
    // COMPLETION IS THE OPERATOR'S TO RECORD, not this phone's: firestore.rules no longer lets
    // a traveler write 'completed' (audit of e26adcb). The operator's app wrote it — that is
    // how this travel came to finish — so the Travel Log only needs reading again.
    refreshMyRides();
    // THE 99% IS RELEASED HERE, not when the card was charged. The operator is only known
    // after dispatch matched them, and the traveler's money is only truly ours once it
    // settles. Deliberately silent: the traveler has paid and finished, and our settlement
    // is not their business to succeed or fail at.
    settleRideRef.current = ridePaid;
    trySettle();
    // Kept, not cleared: the Travel Complete screen writes the rating against this
    // same record a moment later, and it needs the handle to do it.
    reviewedRideId.current = ridePaid;
    activeRideId.current = null;
    // The journey is over, so stop listening to it. Cleared HERE and on cancellation — the
    // two ways a travel ends — and nowhere else, so a change of operator can never detach
    // the subscription mid-journey again.
    setWatchedRideId(null);
  }, [refreshMyRides, trySettle]);

  finishTravelRef.current = finishTravel;
  // The matched operator, reachable from callbacks that must not re-create when it changes.
  const matchedOpRef = useRef<typeof matchedOp>(null);
  matchedOpRef.current = matchedOp;
  // Read from the travel watcher, which must not re-subscribe when the destination changes.
  const arrivalRef = useRef<typeof arrival>(arrival);
  arrivalRef.current = arrival;
  // Read from a callback that must not re-create itself whenever the ride list changes.
  const myRidesRef = useRef<typeof myRides>([]);
  myRidesRef.current = myRides;

  // Advance the ride one step at a time — but HOLD at "Miguel is here" (status 2). He
  // waits for the traveler like a real driver would, which also gives the walk-to-your-car
  // finder time to be useful. boardRide() (the "I'm in the car" button) resumes the trip.
  const startTicker = useCallback(() => {
    if (rideTimer.current) return;
    rideTimer.current = setInterval(() => {
      const next = Math.min(statusRef.current + 1, 5);
      statusRef.current = next;
      setStatus(next);
      if (next === 2 && rideTimer.current) {
        clearInterval(rideTimer.current); // arrived at the pickup — wait to be boarded
        rideTimer.current = null;
      }
      // Through a ref, like cancelRideRef above: startTicker is memoised with no deps and
      // drives an effect, so closing over finishTravel directly would either freeze an old
      // copy of it or restart the timer every time its identity changed.
      if (next === 5) finishTravelRef.current();
    }, 2600);
  }, []);

  // The ride starts moving once an operator is matched — never before. This is what gives
  // the map its Uber moment: match → his car appears where he really is → he drives to you
  // (status 0→2) → then the trip runs (3→5). If dispatch fails there's no matched operator,
  // the timer never starts, and the ride screen offers a retry instead of pretending.
  useEffect(() => {
    if (!rideActive || !matchedOp) return;
    // ONLY A STAND-IN'S JOURNEY RUNS ON A CLOCK.
    //
    // The timer used to run for everybody, so a travel completed itself about thirteen
    // seconds after dispatch whether or not the operator had answered, moved, or existed.
    // With a real operator that is worse than a demonstration: it would mark a journey
    // complete — and release the 99% — for a travel nobody had driven, while the operator was
    // still deciding whether to accept. A real operator's progress is the only thing that
    // moves a real travel.
    if (!matchedOp.demo) return;
    startTicker();
  }, [rideActive, matchedOp, startTicker]);

  // A REAL OPERATOR DRIVES THIS SCREEN; THE STOPWATCH ONLY STANDS IN FOR ONE.
  //
  // The traveler's status advanced every 2.6 seconds regardless of where anybody was — it had
  // to, because the operator app could not be reached and invented its own journeys. Now that
  // an operator's progress is written to the travel, the screen follows the person driving.
  // The timer keeps running for the demo fleet, who cannot report anything; the first real
  // status to arrive stops it.
  //
  // Only ever forward. A late snapshot must not walk a traveler back from Onboard to
  // En Route.
  useEffect(() => {
    const rideId = watchedRideId;
    if (!rideId) return;
    return watchRide(rideId, (s) => {
      if (s === 'declined') {
        // The operator said no. Look for another one rather than stranding a traveler who has
        // already paid: they keep their travel number and their payment, and the operator who
        // declined is not offered it again. When nobody is left, dispatchRide returns nothing
        // and the screen says so — which is where this used to stop immediately.
        const refused = matchedOpRef.current?.id;
        if (refused && !declinedByRef.current.includes(refused)) {
          declinedByRef.current = [...declinedByRef.current, refused];
        }
        setMatchedOp(null);
        // Stop following the refused travel before asking for another. runDispatch sets the
        // new one on success; on failure we watch nothing, which is what "No operator matched
        // yet" honestly means.
        setWatchedRideId(null);
        runDispatchRef.current();
        return;
      }
      // THE LOCK SCREEN FOLLOWS THE OPERATOR, not a timer. This is the same event stream the
      // traveler's own screen runs on, so what shows on the lock screen and what shows in the
      // app can never disagree — which is the only way a second surface is worth having.
      const op = matchedOpRef.current;
      if (op) {
        const shape = {
          stage: s,
          operator: op.name || '',
          destination: arrivalRef.current?.short || '',
          // Only ever a figure we have. See TravelActivity — omitted rather than guessed.
          minutes: s === 'onboard' ? undefined : op.etaMin,
          tripNo: lastTripRef.current?.no || '',
        };
        if (s === 'accepted') startTravelActivity(shape);
        else if (s === 'arrived' || s === 'onboard') updateTravelActivity(shape);
        // A completed travel leaves the card up briefly; somebody glancing down after getting
        // out should still see which travel it was.
        else if (s === 'completed') endTravelActivity(false);
        else if (s === 'declined' || s === 'cancelled') endTravelActivity(true);
      }

      const step = OPERATOR_STEP[s];
      if (s === 'onboard' && !onboardAtRef.current) onboardAtRef.current = Date.now();
      if (step == null) return;
      if (rideTimer.current) {
        clearInterval(rideTimer.current);
        rideTimer.current = null;
      }
      if (step > statusRef.current) {
        statusRef.current = step;
        setStatus(step);
      }
      if (step === 5) finishTravelRef.current();
    },
    // ROUTE MONITORING'S READING OF THIS JOURNEY. Either something it can explain — the road
    // is stopped and other American Rider vehicles nearby are stopped in it — or, when it
    // cannot explain it and the operator has not answered, a question for the traveler.
    setTravelMonitor);
    // Keyed on the TRAVEL. It used to be [matchedOp], which re-subscribed on every operator
    // change and unsubscribed entirely when there was none.
  }, [watchedRideId]);

  /**
   * Answer the platform's check-in: 'ok' or 'help'.
   *
   * Cleared from the screen only once the server has it. A question that looks answered and
   * was not is the one state where silence is read as trouble.
   */
  const respondToCheckIn = useCallback(async (reply: 'ok' | 'help') => {
    const rideId = matchedOpRef.current?.rideId;
    if (!rideId) return false;
    const sent = await answerCheckIn(rideId, reply);
    if (sent) {
      setTravelMonitor((m) => (m ? { ...m, travelerReply: reply } : m));
    }
    return sent;
  }, []);

  // "I'm in the car" — the trip proper begins.
  const boardRide = useCallback(() => {
    if (!rideActive || statusRef.current !== 2) return;
    statusRef.current = 3;
    setStatus(3);
    onboardAtRef.current = Date.now();
    // Only a stand-in's journey runs itself to the destination. On a real travel the operator
    // reports arrival; restarting the clock here would complete the journey — and release the
    // 99% — while the car was still pulling away from the kerb.
    if (matchedOpRef.current?.demo !== false) startTicker();
  }, [rideActive, startTicker]);

  // Never let a DEMO ride stall forever at the curb: if the traveler doesn't tap
  // "I'm in the car" (or never sees the card — older screens), board automatically
  // after a generous pause.
  //
  // Demo only, deliberately. On a real travel this would declare a traveler aboard 25 seconds
  // after their operator arrived, whether or not they had reached the car — and the operator
  // is the one who actually knows.
  //
  // THE GUARD WAS INVERTED IN THE ONE CASE THAT MATTERS, found 29 Aug 2026 by watching a real
  // travel end. It read `if (matchedOp && !matchedOp.demo) return` — which correctly skips the
  // auto-board for a real operator, and FALLS THROUGH when matchedOp is null. Null does not
  // mean "a demonstration operator". It means NOBODY IS DRIVING: dispatch found no one, or the
  // operator declined and the match was cleared.
  //
  // So the single state in which advancing the journey is indefensible was the state that
  // advanced it automatically. AR-2105-MIA: the operator's request timed out and was declined,
  // the match was cleared, this timer fired 25 seconds later, the ticker ran 3 → 4 → 5, and
  // the traveler — who had just been charged $19.44 — was shown "Travel Complete" and asked to
  // rate a journey that never happened. No car ever moved.
  //
  // Now it advances only when we positively know we are driving a demonstration.
  useEffect(() => {
    if (!rideActive || status !== 2) return;
    if (!matchedOp || !matchedOp.demo) return;
    const t = setTimeout(boardRide, 25000);
    return () => clearTimeout(t);
  }, [rideActive, status, boardRide, matchedOp]);

  const cancelRide: () => void = useCallback(() => {
    // A cancelled car leg ends the Smart Travel journey it belonged to; the traveler plans
    // again from wherever they are.
    if (smartJourneyRef.current) {
      smartJourneyRef.current = null;
      setSmartJourney(null);
    }
    // The lock screen is part of the travel. Cancelling ends it at once rather than leaving a
    // card advertising a journey that is not happening.
    endTravelActivity(true);
    if (rideTimer.current) clearInterval(rideTimer.current);
    rideTimer.current = null;
    setRideActive(false);
    statusRef.current = 0;
    setStatus(0);
    if (activeRideId.current) {
      const cancelled = activeRideId.current;
      // GIVE THE MONEY BACK. The traveler is charged at confirmation, before an operator has
      // moved, and this used to write status 'cancelled' and stop — so cancelling left
      // American Rider holding the whole fare for a journey nobody took, silently. The server
      // refunds in full and records it against the travel.
      // THE SERVER CANCELS, and only the server: it records 'cancelled' and refunds from the
      // travel's own payment. The phone no longer writes 'cancelled' itself (firestore.rules),
      // which would have bypassed the refund rules.
      cancelTravel({ rideId: cancelled }).finally(() => refreshMyRides());
      paidIntentRef.current = null;
      settleRideRef.current = null;
      activeRideId.current = null;
      setWatchedRideId(null);
    }
  }, [refreshMyRides]);

  const threadFor = useCallback((tripNo: string) => threads[tripNo] ?? [], [threads]);

  const sendMsgTo = useCallback(
    (tripNo: string, text: string, lostItemId?: string | null) => {
      const t = text.trim();
      if (!t || !tripNo) return;
      setThreads((m) => ({ ...m, [tripNo]: [...(m[tripNo] ?? []), { me: true, text: t }] }));
      // The message is written where the operator side reads it. Best-effort: the traveler's
      // words stay on screen either way, and no screen claims the operator has read them.
      // The operator on this travel, so the rule lets them read what was just written.
      const onTravel = myRidesRef.current?.find((r) => r.tripNo === tripNo);
      sendTravelMessage({
        // The ride record, which the security rule reads to confirm who is on this travel.
        rideId: onTravel?.id ?? (tripNo === lastTripRef.current.no ? watchedRideIdRef.current : null),
        tripNo,
        text: t,
        from: 'traveler',
        operatorId: onTravel?.operatorId ?? matchedOpRef.current?.id ?? null,
        lostItemId,
      });

      // The scripted reply is the DEMO RIDE ONLY — it belongs to the simulated 2.6s-a-step
      // journey, where "Miguel" is a script. It must never fire on a lost item thread: an
      // invented "Got it — see you soon." over a bag nobody has looked for is precisely the
      // outcome-without-mechanism defect this build is removing.
      const isLiveDemoRide = rideActiveRef.current && tripNo === lastTripRef.current.no;
      if (!isLiveDemoRide) return;
      if (msgTimer.current) clearTimeout(msgTimer.current);
      msgTimer.current = setTimeout(() => {
        setThreads((m) => ({
          ...m,
          [tripNo]: [...(m[tripNo] ?? []), { me: false, text: tr('traveler.opGotIt') }],
        }));
      }, 1600);
    },
    [],
  );

  const sendMsg = useCallback(
    (text: string) => sendMsgTo(lastTripRef.current.no, text),
    [sendMsgTo],
  );

  cancelRideRef.current = cancelRide;

  // Abandoning an in-flight issue must not let its timer resolve (and credit) later.
  // Stable identity so screens can call it from unmount cleanup (covers browser/
  // hardware back, which never hits the in-app Back handler).
  const resetIssue = useCallback(() => {
    if (issueTimer.current) clearTimeout(issueTimer.current);
    // Abandoning a case in flight must not let its answer arrive later and land on the
    // screen. The old flow protected itself by clearing a timer; a network round trip has
    // no timer to clear, so each case carries a generation and a stale one is dropped.
    // (The request itself is NOT cancelled — it was really sent, and the server should
    // finish handling it whatever the traveler chose to do next.)
    issueGen.current += 1;
    setIssue(null);
    setIssueState(null);
    setIssueResult(null);
  }, []);

  const openHelp = useCallback(
    (tripNo?: string) => {
      resetIssue();
      // May legitimately be empty: a new account with no travels can still need support, and
      // filing their case against a travel they never took is how the seeded journeys used to
      // hide. The issues screen handles an enquiry with no travel attached.
      //
      // NEVER THE SEEDED TRAVEL. Until 15 Sept 2026 a traveler with no live travel who opened
      // support from Safety or the travel screen had their case filed against AR-2047-MIA — a
      // journey nobody took — because lastTrip still held INITIAL_TRIP.
      const chosen = tripNo ?? (rideActiveRef.current ? lastTrip.no : '');
      setIssueTripNo(chosen === INITIAL_TRIP.no ? '' : chosen);
    },
    [lastTrip.no, resetIssue],
  );

  // Choosing a category no longer resolves anything. It used to start a 1.9-second timer
  // that then displayed a resolution written months earlier in src/data.ts — the app
  // answering a complaint it had not read. Now it opens the box the traveler writes in.
  const pickIssue = useCallback((key: string) => {
    if (!ISSUES[key]) return;
    setIssue(key);
    setIssueState('describing');
    setIssueResult(null);
  }, []);

  // The traveler's own words go to the server, which decides: an answer, a credit inside a
  // server-enforced cap and actually refunded, or a case filed to a person. Every one of
  // those is a real event; none of them is a flag flipped on this device.
  const submitDescription = useCallback(
    (text: string) => {
      const description = text.trim();
      if (!description || !issue) return;
      const gen = ++issueGen.current;
      // THE TRAVEL THE CASE CONCERNS, from a record the app actually holds: this session's
      // travels first, then the account's stored records. Never a fallback to lastTrip — that
      // sent the seeded INITIAL_TRIP's figures ($26.00 to the airport, July 6) to the server
      // as "the real recorded figures" of a travel that never happened. With no matching
      // record the case goes without a travel, and the server reasons from the words alone.
      const sessionTrip = [lastTripRef.current, ...completedTrips].find(
        (t) => t.no === issueTripNo && t.no !== INITIAL_TRIP.no,
      );
      const record = myRidesRef.current.find((r) => r.tripNo === issueTripNo);
      const paymentFor = (no: string) =>
        paymentRef.current.tripNo === no ? paymentRef.current.paymentIntentId : undefined;
      const trip: SupportTrip | null = sessionTrip
        ? {
            no: sessionTrip.no,
            dep: sessionTrip.dep,
            arr: sessionTrip.arr,
            totalCents: Math.round(sessionTrip.total * 100),
            date: sessionTrip.date,
            operator: sessionTrip.operator,
            // ONLY for the travel this payment actually belongs to. Without an id the server
            // cannot refund, so it routes any credit to a person rather than announcing money
            // that never moved — which is the right answer for an older travel.
            paymentIntentId: paymentFor(sessionTrip.no),
          }
        : record
          ? {
              no: record.tripNo,
              dep: record.dep,
              arr: record.arr,
              totalCents: record.totalCents,
              date: new Date(record.createdAt).toISOString(),
              operator: record.operatorName || undefined,
              paymentIntentId: paymentFor(record.tripNo),
            }
          : null;
      setIssueState('resolving');
      submitIssue({
        category: issue,
        description,
        trip,
      }).then((outcome) => {
        // A credit that Stripe really issued is recorded whatever the traveler did next —
        // the money moved, so the receipt must say so even if they walked away from the
        // screen. Only the on-screen state is generation-gated.
        if (outcome.action === 'credit' && outcome.refunded && trip) {
          setCredited({ no: trip.no, cents: outcome.creditCents });
        }
        if (gen !== issueGen.current) return; // this case was abandoned
        setIssueResult(outcome);
        setIssueState('resolved');
      });
    },
    [issue, issueTripNo, completedTrips],
  );

  /**
   * Write the traveler's rating to the travel that just finished.
   *
   * Returns false when there is nothing to write to — a seeded demo travel, or a record the
   * database never accepted. The screen shows that answer rather than a check mark it has
   * not earned.
   */
  const submitReview = useCallback(async (stars: number) => {
    const rideId = reviewedRideId.current;
    if (!rideId) return false;
    // Ratings are feedback only. American Rider deliberately has no gratuity/tip product,
    // endpoint, stored tip amount or post-Travel money path.
    return recordTravelReview(rideId, { stars });
  }, []);

  // The reservation is written to the traveler's account, not just to this screen's memory.
  // It shows immediately either way — losing the write must not lose what they chose — but
  // `schedSaved` records whether it will still be there tomorrow, and the screen says so.
  const scheduleRide = useCallback(
    (info: SchedInfo) => {
      setScheduled(true);
      setSchedInfo(info);
      setCustomTime('');
      setSchedSaved(null);
      setSchedState(null);

      // THE WHOLE JOURNEY GOES ON THE RESERVATION, not just the appointment.
      //
      // The reservation carries the route geometry and class needed by the server. The server
      // derives and stores the authoritative fare and Travel Number; local quote state is
      // presentation only and cannot become reservation authority.

      saveScheduledRide({
        when: info.when,
        time: info.time,
        period: info.period === 'AM' ? 'AM' : 'PM',
        arr: info.arr,
        cost: info.cost,
        atMs: info.atMs,
        dep: departure.short,
        dest: arrival.short,
        pickupLat: tripCoords?.pickup?.lat ?? departure.lat,
        pickupLng: tripCoords?.pickup?.lng ?? departure.lng,
        destinationLat: tripCoords?.dest?.lat ?? arrival.lat,
        destinationLng: tripCoords?.dest?.lng ?? arrival.lng,
        travelClass: operatorClassFor(travelClass),
      }).then((saved) => {
        schedIdRef.current = saved?.id ?? null;
        setSchedId(saved?.id ?? null);
        setSchedSaved(!!saved);
      });
    },
    [arrival, departure, travelClass, tripCoords],
  );

  const cancelScheduled = useCallback(() => {
    setScheduled(false);
    setSchedInfo(null);
    setSchedSaved(null);
    setSchedState(null);
    setSchedId(null);
    // Nothing may re-load a reservation the traveler has just cancelled — without this the
    // loader below could race the delete and put the card straight back on the home screen.
    schedLoadRef.current = 'done';
    if (schedIdRef.current) {
      deleteScheduledRide(schedIdRef.current);
      schedIdRef.current = null;
    }
  }, []);

  // Read the reservation back once the traveler's own travel has loaded — which is what
  // makes "scheduled" survive a force-quit rather than being a card that disappears. Runs
  // at most once per session; `scheduled` is deliberately NOT a dependency, so cancelling
  // cannot retrigger it.
  useEffect(() => {
    if (schedLoadRef.current !== 'idle') return;
    schedLoadRef.current = 'loading';
    let live = true;
    fetchScheduledRide().then((r) => {
      schedLoadRef.current = 'done';
      if (!live || !r) return;
      schedIdRef.current = r.id;
      setSchedId(r.id);
      setSchedState(r);
      setSchedInfo({ when: r.when, time: r.time, period: r.period, arr: r.arr, cost: r.cost, atMs: r.atMs });
      setScheduled(true);
      setSchedSaved(true);
    });
    return () => {
      live = false;
    };
  }, [myRides.length]);

  // Follow the reservation while the app is open, so the moment the sweep turns it into a
  // travel the card says so — with the operator's name and how far away they are — instead of
  // still reading "Scheduled" while the car is outside.
  useEffect(() => {
    if (!schedId) return;
    return watchScheduledRide(schedId, (r) => {
      if (!r) return;
      setSchedState(r);
      // A dispatched reservation has become a real travel; the Travel Log should have it.
      if (r.status === 'dispatched') refreshMyRides();
    });
  }, [schedId, refreshMyRides]);


  const pastTrips = useMemo(() => {
    const decorate = (t: Trip) => ({
      ...t,
      sub: tr('traveler.tripSubFrom', { prefix: t.subPrefix, dep: t.dep }),
      credit: credited?.no === t.no,
      creditCents: credited?.no === t.no ? credited.cents : undefined,
    });
    // The in-progress ride shows while active; canceled rides never join history.
    const live = rideActive ? [decorate(lastTrip)] : [];
    const done = completedTrips.map(decorate);
    // THE SEEDED JOURNEYS ARE GONE. Three fabricated travels — June 28, June 21 and June 14,
    // with amounts, travel numbers, and a "$1.15 credit" on one of them — appeared in every
    // account as journeys that traveler had taken and paid for. A person could open a receipt
    // for a trip that never happened. The Travel Log already reads real records from
    // Firestore; this list is now only what actually occurred.
    return [...live, ...done];
  }, [rideActive, lastTrip, completedTrips, credited]);

  const value: RideStore = {
    tripCoords,
    setTripCoords,
    route,
    approachRoute,
    pickupPin,
    setPickupPin,
    defaultPrefs,
    tripPrefs,
    togglePref,
    pay,
    setPay,
    travelClass,
    setTravelClass,
    smartPlan,
    setSmartPlan,
    smartStatus,
    setSmartStatus,
    smartJourney,
    beginSmartLeg,
    endSmartJourney,
    quotedFareCents,
    travelerTotal,
    setQuotedFareCents,
    repricing,
    quotedFeeLines,
    setQuotedFeeLines,
    arrival,
    departure,
    setArrival,
    setDeparture,
    pickupWait,
    demand,
    startBooking,
    status,
    rideActive,
    confirmRide,
    boardRide,
    cancelRide,
    matchedOp,
    dispatchState,
    retryDispatch: runDispatch,
    myRides,
    refreshMyRides,
    payment,
    lastTrip,
    viewTrip,
    setViewTrip,
    pastTrips,
    stats,
    submitReview,
    msgs: threads[lastTrip.no] ?? [],
    sendMsg,
    threadFor,
    sendMsgTo,
    issue,
    issueState,
    issueTripNo,
    issueResult,
    openHelp,
    resetIssue,
    pickIssue,
    submitDescription,
    credited,
    schedDate,
    setSchedDate,
    schedDay,
    setSchedDay,
    schedPeriod,
    setSchedPeriod,
    schedTime,
    setSchedTime,
    customTime,
    setCustomTime,
    scheduled,
    schedState,
    travelMonitor,
    respondToCheckIn,
    schedInfo,
    schedSaved,
    scheduleRide,
    cancelScheduled,
    share,
    toggleShare: () => setShare((s) => !s),
    stmtDone,
    markStmtDone: () => setStmtDone(true),
  };

  return <RideContext.Provider value={value}>{children}</RideContext.Provider>;
}

export function useRide(): RideStore {
  const ctx = useContext(RideContext);
  if (!ctx) throw new Error('useRide must be used inside RideProvider');
  return ctx;
}

// Home place used by "ride again" when destination was Home.
export { HOME_PLACE };
