// What an operator has actually been given.
//
// THE DEFECT THIS CLOSES. Dispatch has always written a real travel to `rides` with the
// matched operator on it — but the operator app never read it. It ran a timer that invented a
// request every few seconds from a scripted list (SIM_REQUESTS), so an operator on duty saw
// journeys that did not exist while the traveler who really booked one waited for somebody who
// was never told. Two halves of the same company, neither aware of the other.
//
// It could not have read them anyway: until 19 Aug 2026 the Firestore rule on `rides` matched
// the traveler only, so a real assignment was unreadable to the person assigned to it.
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { fareFromTotal } from '../data';
import { auth, db } from '../firebase';
import { t } from '../i18n';

export type AssignedTravel = {
  rideId: string;
  /** Whose travel it is. Needed so the operator can write into their message thread — the
   *  security rule lets each side write only as themselves and read only threads they are on,
   *  so the counterparty's uid has to travel with the assignment. */
  travelerUid: string;
  /** Empty when the traveler has not set a name. Never substituted with an invented one. */
  travelerName: string;
  tripNo: string;
  dep: string;
  dest: string;
  travelClass: string;
  costCents: number;
  status: string;
  createdAt: number;
  /** When the status last changed. Distinguishes a journey underway from one that never
   *  closed — see ACTIVE_RESTORE_MAX_MS in OperatorContext. */
  statusAt: number;
  /** Raised by route monitoring when this vehicle has stopped for longer than a long light.
   *  Written only by the server; answered through POST /travel/check-in. */
  monitor?: {
    state?: string;
    question?: string;
    note?: string;
    askedOperatorAt?: number;
    operatorReply?: string;
  } | null;
};

/**
 * What the operator keeps, from what the traveler paid.
 *
 * `costCents` on a ride record is the ALL-IN price — the fare plus the platform fee. The
 * operator's 99% is of the fare alone, so the fee comes off first. Taking 1% off the
 * total instead would quote an operator 99% of American Rider's fee as well as of their own
 * fare.
 */
// SUBTRACTING A FLAT $1.50 IS ONLY RIGHT BELOW $30. Above that the platform fee is 5% of the
// fare, so taking $1.50 off the total overstates the fare — and therefore overstates what the
// operator is told they earned, on precisely the largest travels.
export const travelFareCents = (costCents: number) =>
  Math.round(fareFromTotal(costCents / 100) * 100);
export const operatorShareCents = (costCents: number) => {
  const fare = travelFareCents(costCents);
  return fare - Math.floor(fare * 0.01);
};

/**
 * Watch for travel dispatched to the signed-in operator.
 *
 * Queries on `operatorId` alone and filters status in memory. Two equality filters would work
 * through index merging, but this keeps the query independent of index configuration — a
 * dispatch that silently returns nothing because an index is missing is exactly the class of
 * failure this file exists to remove.
 *
 * Returns an unsubscribe function. Never throws: a listener that cannot attach reports an
 * empty inbox, which shows the operator "nothing yet" rather than a scripted journey.
 */
export function watchAssignedTravel(
  onChange: (travels: AssignedTravel[]) => void,
  onError?: (reason: string) => void,
): () => void {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    onChange([]);
    onError?.(t('traveler.errNotSignedIn'));
    return () => {};
  }
  try {
    const q = query(collection(db, 'rides'), where('operatorId', '==', uid));
    return onSnapshot(
      q,
      (snap) => {
        const open = snap.docs
          .map((d) => {
            const x = d.data() as Record<string, unknown>;
            return {
              rideId: d.id,
              travelerUid: String(x.travelerUid ?? ''),
              travelerName: String(x.travelerName ?? ''),
              tripNo: String(x.tripNo ?? ''),
              dep: String(x.dep ?? ''),
              dest: String(x.dest ?? ''),
              travelClass: String(x.travelClass ?? 'Standard'),
              costCents: Number(x.costCents ?? 0),
              status: String(x.status ?? ''),
              createdAt: Number(x.createdAt ?? 0),
              statusAt: Number(x.statusAt ?? 0),
              monitor: (x.monitor as AssignedTravel['monitor']) ?? null,
            };
          })
          // EVERY travel dispatched to this operator, not just the unanswered ones. The
          // caller decides: 'assigned' is a request to answer, and accepted/arrived/onboard
          // is a journey underway — which the operator app currently keeps only in local
          // state, so it is lost if the app restarts mid-travel.
          .sort((a, b) => b.createdAt - a.createdAt);
        onChange(open);
      },
      // NOT SWALLOWED. The first version of this reported an empty inbox on any failure, so a
      // denied query and a quiet night looked identical — an operator would sit on
      // "Matching you with nearby travelers" while travels were being dispatched to them.
      // That is the same shape as the firebase-admin outage that hid for weeks because the
      // failure was reported honestly at every step except the one that mattered.
      (e) => {
        onChange([]);
        onError?.(e?.message || t('traveler.errReadTravel'));
      },
    );
  } catch (e) {
    onChange([]);
    onError?.(e instanceof Error ? e.message : t('traveler.errReadTravel'));
    return () => {};
  }
}

/**
 * Move a travel along. The rule permits an operator these statuses and nothing else — not the
 * fare, not the traveler, not who it belongs to.
 *
 * Returns whether the write landed, and never throws. The caller decides what to tell the
 * operator; it must not claim a travel was accepted if the database refused.
 */
async function setStatus(
  rideId: string,
  status: 'accepted' | 'arrived' | 'onboard' | 'completed' | 'declined',
  stampField?: 'acceptedAt' | 'arrivedAt' | 'declinedAt',
): Promise<boolean> {
  if (!rideId) return false;
  try {
    await updateDoc(doc(db, 'rides', rideId), {
      status,
      statusAt: Date.now(),
      ...(stampField ? { [stampField]: Date.now() } : {}),
      // WHEN THE TRAVEL RAN. Florida's receipt rule (627.748(6)) wants its total time; that
      // is boarding to completion, and only the operator's app knows both moments.
      ...(status === 'onboard' ? { onboardAt: Date.now() } : {}),
      ...(status === 'completed' ? { completedAt: Date.now() } : {}),
      // A FLAG THE SETTLEMENT SWEEP CAN QUERY, so it reads the travels that owe somebody
      // money instead of every travel ever completed.
      //
      // The sweep first scanned all completed travel, then the newest 200 — which at one
      // tick a minute is 288,000 document reads a day against a 50,000/day free allowance.
      // The read bill for finding nothing was about to be the reason to start paying for a
      // database holding 166 writes. Now the query is `needsPayout == true`, which on a quiet
      // minute reads nothing at all, and sweepSettlements clears the flag as it pays.
      ...(status === 'completed' ? { needsPayout: true } : {}),
    });
    return true;
  } catch (e) {
    // LOUD, because a silent one cost a payout on 2 Sept 2026.
    //
    // The caller already treats `false` correctly — completeOp does not claim a travel
    // finished if the database refused. What was missing is any way to find out WHY. A
    // security rule rejected the write (needsPayout was not on the permitted field list),
    // and a bare `catch { return false }` turned a precise, actionable
    // "PERMISSION_DENIED: Missing or insufficient permissions" into nothing at all. The
    // operator saw "Operation Complete", the travel stayed `onboard`, and the only visible
    // symptom was a payout that never arrived — three layers away from the cause.
    //
    // Rules rejections are the likeliest failure here and the hardest to guess at, so the
    // message is kept. It goes to the console, not to the operator: they are told the
    // travel did not save, which is their business; which field a rule refused is ours.
    console.error(`[inbox] could not set travel ${rideId} to ${status}:`, (e as Error)?.message);
    return false;
  }
}

export const acceptTravel = (rideId: string) => setStatus(rideId, 'accepted', 'acceptedAt');
export const declineTravel = (rideId: string) => setStatus(rideId, 'declined', 'declinedAt');
export const markArrived = (rideId: string) => setStatus(rideId, 'arrived', 'arrivedAt');
export const markOnboard = (rideId: string) => setStatus(rideId, 'onboard');
export const markCompleted = (rideId: string) => setStatus(rideId, 'completed');
