// Answering the platform's check-in.
//
// A check-in is raised by backend/monitor.js when a vehicle carrying somebody has stopped for
// longer than a long light, with no other American Rider vehicle nearby stopped to explain it.
//
// THE ANSWER GOES THROUGH THE SERVER, NOT STRAIGHT TO THE RECORD. Firestore rules keep the
// `monitor` field unwritable from either app, deliberately: it decides whether a case is
// opened about a journey, and neither the operator nor the traveler may clear a concern
// raised about the other.
import { PAYMENT_SERVER_URL } from '../config';
import { auth } from '../firebase';

/**
 * @param rideId the travel the check-in is about
 * @param reply  an operator writes what is happening in their own words; a traveler answers
 *               'ok' or 'help' and nothing else — being asked whether you are alright is a
 *               question that has to be answerable in one tap.
 *
 * Returns whether the answer landed. Never throws. A screen must not show a check-in as
 * answered when nothing was recorded — that is the one state where silence is read as trouble.
 */
export async function answerCheckIn(rideId: string, reply: string): Promise<boolean> {
  const text = reply.trim();
  if (!rideId || !text) return false;
  try {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const res = await fetch(`${PAYMENT_SERVER_URL}/travel/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ rideId, reply: text.slice(0, 600) }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data?.ok === true;
  } catch {
    return false;
  }
}

/**
 * Tell the server something happened on this travel, so it can notify the OTHER party.
 *
 * WHY THE CLIENT HAS TO SAY. Dispatch and the operator's progress are both written to
 * Firestore from a phone, so the server does not otherwise learn of them until its next sweep.
 * A traveler finding out a minute late that their operator is outside is a worse product than
 * one that costs a round trip.
 *
 * Fire and forget, deliberately: nothing on either screen may wait on a notification, and the
 * sweep re-sends anything this loses. Never throws.
 */
export function announceTravel(rideId: string, event: 'assigned' | 'arrived' | 'completed'): void {
  if (!rideId) return;
  (async () => {
    try {
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      await fetch(`${PAYMENT_SERVER_URL}/travel/announce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ rideId, event }),
      });
    } catch {
      /* the sweep is the backstop — see backend/monitor.js sweepAssignments */
    }
  })();
}
