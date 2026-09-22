// American Rider — real dispatch (in-app). Reads operators from Firestore, matches the
// nearest available one who serves the requested class, and saves the ride. This is the
// same logic proven in the backend scripts, now wired into the real app.
import type { FeeLine } from '../data';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { PAYMENT_SERVER_URL } from '../config';
import { fetchPaymentConfig } from './payments';

export type Operator = {
  id: string;
  name: string;
  /** The commercial policy's expiry date (YYYY-MM-DD). Absent on the demonstration fleet. */
  insuranceExpiry?: string;
  lat: number;
  lng: number;
  available: boolean;
  /** When this operator's phone last said it was on duty. Absent on the demonstration fleet. */
  onlineAt?: number;
  /** Set by the server when a screening refuses somebody. Never cleared by a phone. */
  screeningBlocked?: boolean;
  classes: string[];
  car: string;
  plate: string;
};

// Mirrors PRESENCE_STALE_MS in backend/matching.js. THE TWO MUST NOT DRIFT — see the note
// there for what mirroring cost us in monitor.js, and see dispatchRide below for why this
// file has a second copy of the dispatch rules at all.
const PRESENCE_STALE_MS = 5 * 60 * 1000;

export type MatchedOp = {
  id: string;
  /**
   * True when this is one of the built-in demonstration operators, who cannot report
   * anything. The traveler's screen may only run on a timer for these.
   */
  demo: boolean;
  name: string;
  car: string;
  plate: string;
  etaMin: number;
  miles: number;
  rideId: string;
  // Where the operator was when matched — the live map animates his approach from here.
  lat: number;
  lng: number;
};

// A small starter fleet around Miami (real neighborhood coordinates).
//
// THESE PEOPLE DO NOT EXIST. They are here so the app can be demonstrated and tested with no
// operator on duty, and they must never stand in for a real driver — see loadFleet.


export function distanceMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

const etaMinutes = (miles: number) => Math.max(1, Math.round((miles / 22) * 60));

// Is real money moving? Asked once and remembered: it decides whether a demonstration
// stand-in is acceptable, and that answer does not change while the app is open.
let liveMoney: boolean | null = null;

// Read the operator fleet from Firestore. The app NEVER writes operators — operators join
// through the server (POST /operator/online), which checks Stripe has cleared them for
// payouts first — so security rules can keep `operators` read-only for clients.
//
// WHAT CHANGED, AND WHY IT MATTERS AT LAUNCH. This used to fall back to the demo fleet
// whenever the collection was empty, which it always was. In test mode that is a useful
// stand-in. In live mode it would match a paying traveler to Miguel D., who does not exist,
// will not arrive, and cannot be paid — so the fallback now stops at the door where real
// money starts. An empty fleet then means what it says: nobody is on duty, and the ride
// screen already has an honest state for that.

/**
 * Is a named operator still out there and free?
 *
 * Used by the lost item return, which tries the operator who drove the travel BEFORE it
 * dispatches anybody else. Returns null when they have finished for the day or left — which
 * is not a failure, it is simply the case where the second return path is the right one.
 */
/**
 * Who can bring a lost item back: the operator who drove the travel if they are still out
 * there, otherwise the nearest one to the point.
 *
 * THE SERVER DECIDES. These two questions used to be answered on the phone by loadFleet(),
 * which pulled every operator document down — position, plate, insurance expiry and screening
 * status, for every operator, to answer a question about one. That was the last reason the app
 * read the fleet at all. The answer now carries a name and a position and nothing else, and
 * the operator it names has passed the same gates as any dispatch.
 */
export async function returnOperator(args: {
  operatorId?: string;
  point: { lat: number; lng: number };
}): Promise<{ path: 'original-operator' | 'any-operator'; op: Operator; miles?: number } | null> {
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  const res = await fetch(`${PAYMENT_SERVER_URL}/travel/return-operator`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ operatorId: args.operatorId || '', point: args.point }),
  });
  if (!res.ok) return null;
  const out = (await res.json()) as {
    path: 'original-operator' | 'any-operator' | null;
    operator: { id: string; name: string; lat: number; lng: number; miles?: number } | null;
  };
  if (!out.path || !out.operator) return null;
  return {
    path: out.path,
    // Only the fields the return needs. There is no plate, no insurance date and no screening
    // state here, because the phone has no reason to hold any of them.
    op: {
      id: out.operator.id,
      name: out.operator.name,
      lat: out.operator.lat,
      lng: out.operator.lng,
      available: true,
      classes: ['Standard'],
      car: '',
      plate: '',
    } as Operator,
    miles: out.operator.miles,
  };
}

/**
 * Has this operator's commercial coverage run out?
 *
 * Checked at the moment of matching, not only when they went on duty. A policy that expires
 * at midnight during a shift would otherwise keep receiving travel until the operator happened
 * to go off duty and back on — and American Rider carries no coverage behind it.
 *
 * The demonstration fleet has no date and is never gated: it only exists in test mode, where
 * no real traveler is carried.
 */


// Book a real ride.
//
// THE MATCH HAPPENS ON THE SERVER NOW. This function used to read the whole `operators`
// collection onto the phone, choose an operator itself, and write rides/{id} with that choice
// — and firestore.rules accepted the write on one condition, that `travelerUid` was the
// signed-in user. Nothing checked the operator. So the screening, insurance and disclosure
// gates in backend/matching.js guarded the re-offer sweep and scheduled travel, and never the
// booking a traveler actually makes. See docs/SWEEP-2026-09-19.md, F-A.
//
// POST /travel/dispatch runs the same matchOperator every other caller uses and writes the
// travel with admin access. The phone now learns who is coming; it does not decide.
//
// The demonstration fleet lives on the server too (backend/server.js, /travel/dispatch), so
// this file no longer holds operator records of any kind.
export async function dispatchRide(opts: {
  pickup: { lat: number; lng: number };
  dep: string;
  dest: string;
  cls: string;
  tripNo: string;
  costCents: number;
  /** The travel's road distance in miles — routed when the map had a route, else the fare
   *  model's estimate. Fla. Stat. 627.748(6) requires the receipt to state it. */
  miles?: number;
  /** Government fees inside the price (fenced by the server from the same coordinates). */
  feeLines?: FeeLine[];
  /** Operators who have already declined this travel. Never offered it twice. */
  excludeIds?: string[];
}): Promise<MatchedOp | null> {
  // Never dispatch without a signed-in traveler: the server writes the travel against the
  // authenticated uid, and an "anon" travel could not be read back by anyone.
  const uid = auth.currentUser?.uid;
  if (!uid) return null;

  const token = await auth.currentUser?.getIdToken().catch(() => null);
  const res = await fetch(`${PAYMENT_SERVER_URL}/travel/dispatch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      pickup: opts.pickup,
      dep: opts.dep,
      dest: opts.dest,
      cls: opts.cls,
      tripNo: opts.tripNo,
      costCents: opts.costCents,
      miles: opts.miles ?? null,
      feeLines: opts.feeLines ?? [],
      excludeIds: opts.excludeIds ?? [],
      travelerName: auth.currentUser?.displayName || '',
    }),
  });

  // A SERVER THAT CANNOT BE REACHED IS NOT AN EMPTY FLEET. The two must not render the same:
  // the caller shows a retry for one and a wait for the other, which is the same distinction
  // loadFleet draws with getDocsFromServer. Throwing is how runDispatch learns the difference.
  if (!res.ok) {
    let reason = `dispatch failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) reason = String(body.error);
    } catch {
      /* the status is the whole message */
    }
    throw new Error(reason);
  }

  const out = (await res.json()) as {
    rideId?: string;
    matched: {
      id: string; name: string; car: string; plate: string;
      lat: number; lng: number; etaMin: number; miles: number; demo?: boolean;
    } | null;
  };
  // Nobody free. An ordinary answer with a screen of its own, not a failure.
  if (!out.matched || !out.rideId) return null;

  return {
    id: out.matched.id,
    demo: !!out.matched.demo,
    name: out.matched.name,
    car: out.matched.car,
    plate: out.matched.plate,
    etaMin: out.matched.etaMin,
    miles: +out.matched.miles.toFixed(2),
    rideId: out.rideId,
    lat: out.matched.lat,
    lng: out.matched.lng,
  };
}

/** What paid for a travel, as the server read it from the charge at settlement. */
export type PaidWith = {
  /** 'card' | 'us_bank_account' | … — Stripe's method type. */
  type: string;
  /** The network, lowercase as Stripe gives it ('visa'); empty for a bank account. */
  brand: string;
  last4: string;
  /** 'apple_pay' | 'google_pay' | 'link' when the card came through a wallet; else null. */
  wallet: string | null;
  /** The bank's name as Stripe records it, when a bank account paid; else null. */
  bank: string | null;
};

const shapePaidWith = (p: unknown): PaidWith | undefined => {
  if (!p || typeof p !== 'object') return undefined;
  const o = p as Record<string, unknown>;
  const type = typeof o.type === 'string' ? o.type : '';
  const brand = typeof o.brand === 'string' ? o.brand : '';
  const last4 = typeof o.last4 === 'string' ? o.last4 : '';
  const wallet = typeof o.wallet === 'string' ? o.wallet : null;
  const bank = typeof o.bank === 'string' && o.bank ? o.bank : null;
  return type || brand || last4 ? { type, brand, last4, wallet, bank } : undefined;
};

export type RideRecord = {
  id: string;
  tripNo: string;
  dep: string;
  arr: string;
  operatorName: string;
  // Which operator, not just their name — a lost item has to be routed back to the person
  // who drove the travel, and two operators can share a first name and an initial.
  operatorId: string;
  totalCents: number;
  status: string;
  createdAt: number;
  /** Road miles recorded at dispatch; absent on travels before 9 Sept 2026. */
  miles?: number;
  /** Stamped by the operator's app when the traveler boards and when the travel ends. */
  onboardAt?: number;
  completedAt?: number;
  feeLines?: FeeLine[];
  governmentFeeCents?: number;
  /** The car, so a relaunch can rebuild the live screen. Absent on travels before 12 Sept 2026. */
  operatorCar?: string;
  operatorPlate?: string;
  operatorDemo?: boolean;
  operatorLat?: number;
  operatorLng?: number;
  operatorEtaMin?: number;
  operatorMiles?: number;
  /** The class the traveler paid for, as operators declare it ('Standard', 'Large Vehicle').
   *  Written at dispatch since the first real dispatch (6e96036, 21 July 2026); read back only
   *  since 15 Sept 2026, which is why the Travel Log could not name it before. */
  travelClass?: string;
  /** What paid, written by the server at settlement from the charge Stripe recorded. Absent
   *  until settlement, and on every travel settled before 15 Sept 2026. */
  paidWith?: PaidWith;
  /** When the server emailed the traveler their receipt (backend/server.js, at settlement).
   *  Absent when no copy was sent. */
  receiptSentAt?: number;
};

// Read the signed-in traveler's own rides from Firestore (newest first).
export async function fetchMyRides(): Promise<RideRecord[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, 'rides'), where('travelerUid', '==', uid)));
  return snap.docs
    .map((d) => {
      const x = d.data() as any;
      return {
        id: d.id,
        tripNo: x.tripNo ?? '',
        dep: x.dep ?? 'Brickell',
        arr: x.dest ?? '',
        operatorName: x.operatorName ?? '',
        operatorId: x.operatorId ?? '',
        totalCents: x.costCents ?? 0,
        status: x.status ?? '',
        createdAt: x.createdAt ?? 0,
        miles: typeof x.miles === 'number' ? x.miles : undefined,
        onboardAt: typeof x.onboardAt === 'number' ? x.onboardAt : undefined,
        completedAt: typeof x.completedAt === 'number' ? x.completedAt : undefined,
        feeLines: Array.isArray(x.feeLines) ? x.feeLines : undefined,
        operatorCar: typeof x.operatorCar === 'string' ? x.operatorCar : undefined,
        operatorPlate: typeof x.operatorPlate === 'string' ? x.operatorPlate : undefined,
        operatorDemo: typeof x.operatorDemo === 'boolean' ? x.operatorDemo : undefined,
        operatorLat: typeof x.operatorLat === 'number' ? x.operatorLat : undefined,
        operatorLng: typeof x.operatorLng === 'number' ? x.operatorLng : undefined,
        operatorEtaMin: typeof x.operatorEtaMin === 'number' ? x.operatorEtaMin : undefined,
        operatorMiles: typeof x.operatorMiles === 'number' ? x.operatorMiles : undefined,
        governmentFeeCents: typeof x.governmentFeeCents === 'number' ? x.governmentFeeCents : undefined,
        travelClass: typeof x.travelClass === 'string' ? x.travelClass : undefined,
        paidWith: shapePaidWith(x.paidWith),
        receiptSentAt: typeof x.receiptSentAt === 'number' ? x.receiptSentAt : undefined,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Record the traveler's review of a completed travel.
 *
 * THE DEFECT THIS CLOSES: the Travel Complete screen collected a star rating and a tip and
 * did nothing with either. Worse, it added the tip to a row labelled "Total Charged" — an
 * amount stated as charged that had never been charged. A rating nobody stores cannot affect
 * an operator's standing, and a tip nobody records cannot reach them.
 *
 * `tipCents` is RECORDED, not collected: no second charge is made here. The screen must say
 * so rather than implying the money has moved.
 *
 * Returns whether the write landed. Never throws.
 */
export async function recordTravelReview(
  rideId: string,
  review: { stars: number; tipCents: number },
): Promise<boolean> {
  if (!rideId) return false;
  try {
    await updateDoc(doc(db, 'rides', rideId), {
      rating: review.stars || null,
      tipCents: review.tipCents || 0,
      reviewedAt: Date.now(),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Record what became of a travel.
 *
 * THE BUG THIS FIXES: every ride was written with status 'assigned' and nothing ever wrote
 * to it again. Cancelling cleared the screen and left the database saying the journey was
 * still assigned — so the Travel Log listed cancelled travels among the completed ones, and
 * a receipt existed for a journey that never happened. It is also why the status dots on the
 * home screen had nothing to show: one value, on every record, forever.
 *
 * Never throws. Losing the write is bad; taking the app down over it is worse — the traveler
 * has already cancelled and must not be shown a failure for a thing that is done.
 */
export async function setRideStatus(
  rideId: string,
  status: 'assigned' | 'completed' | 'cancelled',
): Promise<void> {
  if (!rideId) return;
  try {
    await updateDoc(doc(db, 'rides', rideId), {
      status,
      statusAt: Date.now(),
      // The receipt states the travel's total time (Fla. Stat. 627.748(6)); this is its end.
      ...(status === 'completed' ? { completedAt: Date.now() } : {}),
    });
  } catch {
    // Swallowed deliberately — see above.
  }
}

/**
 * Follow one travel's status as the OPERATOR moves it along.
 *
 * The traveler's screen ran entirely on a 2.6-second timer: it advanced from En Route to
 * Arrived to Onboard on a clock, regardless of where the operator actually was. That was the
 * only option while the operator app could not be reached — it invented its own journeys too.
 * Now that an operator's progress is written to the travel, the traveler's screen can follow
 * the person driving instead of a stopwatch.
 *
 * Returns an unsubscribe function. Never throws: if the listener cannot attach, the caller
 * keeps whatever it was doing rather than freezing on a screen that has stopped updating.
 */
export type TravelMonitor = {
  state?: string;
  note?: string;
  travelerQuestion?: string;
  travelerReply?: string;
  vehiclesStopped?: number;
  stillMin?: number;
  /** Set once a person at American Rider has been brought in. */
  caseNo?: string | null;
};

export function watchRide(
  rideId: string,
  onStatus: (status: string) => void,
  // Route monitoring's reading of this journey — a known delay it can explain, or a question
  // for the traveler. Optional so existing callers are unaffected.
  onMonitor?: (m: TravelMonitor | null) => void,
): () => void {
  if (!rideId) return () => {};
  try {
    return onSnapshot(
      doc(db, 'rides', rideId),
      (snap) => {
        const data = snap.data() as { status?: unknown; monitor?: TravelMonitor } | undefined;
        const s = data?.status;
        if (typeof s === 'string' && s) onStatus(s);
        onMonitor?.(data?.monitor ?? null);
      },
      () => {},
    );
  } catch {
    return () => {};
  }
}
