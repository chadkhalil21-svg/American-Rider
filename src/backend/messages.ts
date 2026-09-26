// Messages between a traveler and an operator, scoped to one travel.
//
// SCOPED ON PURPOSE. A thread that is not attached to a journey makes the operator guess which
// one it is about — and the lost item flow depends on the operator knowing exactly which car,
// on which run, to search.
//
// NO PHONE NUMBERS, IN EITHER DIRECTION (founders, 16 Aug). The operator never learns the
// traveler's number and the traveler never learns the operator's. That protects the operator
// exactly as much as it protects the traveler, and it is why messages go through a record
// keyed by travel rather than through the phone's dialler.
//
// ---------------------------------------------------------------------------------------
// THE HALF-LOOP THIS CLOSES, and the stale reason it was left open.
//
// Until now the traveler's messages were written here and read by nobody: the operator screen
// kept a local array and answered itself after 1.5 seconds. Both screens told their reader
// they were in touch with the other person, and neither was.
//
// The reason recorded for leaving it that way was that "an operator has no account identity at
// all — role and commissioning live in device storage". That was true when it was written and
// is not true now: operators sign in, `operatorId` is a Firebase uid, and dispatch, screening,
// payouts and the duty gate all turn on it. The blocker was removed by other work and nobody
// came back to the note.
//
// So a message now carries BOTH uids, and the security rule lets either party read the thread
// and write only as themselves. `from` is still checked against the writer, so nobody can
// forge a message from the other side.
import { addDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { t } from '../i18n';

export type TravelMessage = {
  id: string;
  from: 'traveler' | 'operator' | 'guardian';
  text: string;
  createdAt: number;
  lostItemId?: string | null;
};

/**
 * Write a message into the travel's thread.
 *
 * `from` decides which side of the conversation it is, and the security rule checks it against
 * the uid doing the writing — a traveler cannot post as the operator or the reverse.
 *
 * Returns whether it was stored. The screen shows a sent message either way — losing the
 * record must not lose the person's words — but nothing may CLAIM the other side has it
 * unless this returned true.
 */
export async function sendTravelMessage(args: {
  /** The ride record's id. The security rule reads it; the parties come from it. */
  rideId: string | null | undefined;
  tripNo: string;
  text: string;
  from: 'traveler' | 'operator' | 'guardian';
  /** The other party's uid, so the rule can let both of them read the thread. */
  travelerUid?: string | null;
  operatorId?: string | null;
  guardianUid?: string | null;
  /** Set when the message belongs to a lost item report, so it lands with that case. */
  lostItemId?: string | null;
}): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  const text = args.text.trim();
  // THE RIDE IS REQUIRED. firestore.rules reads it to decide who may write here; a message
  // with no ride is refused there, so it is not sent at all.
  if (!uid || !text || !args.tripNo || !args.rideId) return false;
  try {
    await addDoc(collection(db, 'messages'), {
      rideId: args.rideId,
      tripNo: args.tripNo,
      from: args.from,
      // The writer is always themselves; the counterparty comes from the travel record.
      travelerUid: args.from === 'traveler' ? uid : args.travelerUid ?? null,
      operatorId: args.from === 'operator' ? uid : args.operatorId ?? null,
      guardianUid: args.from === 'guardian' ? uid : args.guardianUid ?? null,
      lostItemId: args.lostItemId ?? null,
      text: text.slice(0, 2000),
      createdAt: Date.now(),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Follow one travel's thread, live, from either side.
 *
 * THE READER'S OWN UID IS IN THE QUERY, on the field the security rule checks for that side.
 * Security rules are not filters: a listener is admitted only when Firestore can prove from
 * the query itself that every document it could return is one the reader may see. Queried on
 * tripNo alone, nothing proves that, and the listener is refused outright with "Missing or
 * insufficient permissions." — which is what the traveler's thread showed on the first walk
 * of fc01d5b (17 Sept 2026): the "Hi" written the day before was in the record and could
 * not be read back. `where('travelerUid', '==', uid)` satisfies ownsExisting(); the operator's
 * screen asks with `operatorId` and satisfies drivesExisting().
 *
 * Two equality filters and no order, which Firestore serves from its automatic single-field
 * indexes. The order is applied here instead: an orderBy on a third field would require a
 * composite index, and a thread that silently returns nothing because an index was never
 * created is exactly the failure this file exists to remove.
 *
 * Returns an unsubscribe. Never throws: a listener that cannot attach reports an empty thread
 * AND the reason, so "nobody has written" and "we cannot read" never look alike again.
 */
export function watchTravelThread(
  tripNo: string,
  side: 'traveler' | 'operator' | 'guardian',
  onChange: (msgs: TravelMessage[]) => void,
  onError?: (reason: string) => void,
): () => void {
  const uid = auth.currentUser?.uid;
  if (!tripNo || !uid) {
    onChange([]);
    return () => {};
  }
  try {
    const q = query(
      collection(db, 'messages'),
      where('tripNo', '==', tripNo),
      where(side === 'operator' ? 'operatorId' : side === 'guardian' ? 'guardianUid' : 'travelerUid', '==', uid),
    );
    return onSnapshot(
      q,
      (snap) => {
        onChange(
          snap.docs
            .map((d) => {
              const x = d.data() as Record<string, unknown>;
              return {
                id: d.id,
                from: x.from === 'operator' ? 'operator' : x.from === 'guardian' ? 'guardian' : 'traveler',
                text: String(x.text ?? ''),
                createdAt: Number(x.createdAt ?? 0),
                lostItemId: (x.lostItemId as string | null) ?? null,
              } as TravelMessage;
            })
            .sort((a, b) => a.createdAt - b.createdAt),
        );
      },
      (e) => {
        onChange([]);
        onError?.(e?.message || t('traveler.errConversationLoad'));
      },
    );
  } catch (e) {
    onChange([]);
    onError?.(e instanceof Error ? e.message : t('traveler.errConversationLoad'));
    return () => {};
  }
}
