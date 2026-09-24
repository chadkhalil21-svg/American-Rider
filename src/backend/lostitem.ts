// Lost items — the record, the notification, and the return.
//
// WHAT THIS REPLACES: tapping "Lost Item" in Patron Support showed "Operator notified · Your
// operator has been notified" after a 1.9-second spinner. No operator was notified, nothing
// was written, and the app had never asked WHICH travel the item was left in. It also
// reported "RESOLVED" over a bag nobody had looked for yet.
//
// THE RULE THIS FILE KEEPS: a status is written only once the thing it describes has
// happened. `reported` means a record exists. `operator-notified` means named operators are
// on the document. Nothing here can write `located` or `returned`, because only an operator
// can know those — and the operator side is not built yet. So the screen shows a ladder with
// the traveler standing on the rung they are actually on, and no higher.
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { PAYMENT_SERVER_URL } from '../config';
import { returnOperator, type RideRecord } from './dispatch';

/**
 * The ladder, in order. `resolved` is deliberately not a value: an item is not resolved, it
 * is back in the traveler's hands, and that is what `returned` means.
 */
export type LostItemStatus =
  | 'reported'
  | 'operator-notified'
  | 'located'
  | 'not-found'
  | 'return-arranged'
  | 'returned';

export type ReturnPath = 'original-operator' | 'any-operator';

export type LostItemReturn = {
  path: ReturnPath;
  operatorId: string;
  operatorName: string;
  /** What the traveler pays for the return travel. 0 when the original operator carries it. */
  costCents: number;
  /** False when no coordinates were available to price it — never guess an amount. */
  priced: boolean;
  arrangedAt: number;
};

export type LostItem = {
  id: string;
  /** The support case carrying this report, when one was filed. Null means nobody was told. */
  caseNo?: string | null;
  travelerUid: string;
  /** The travel it was left in, or null when the traveler could not say which. */
  tripNo: string | null;
  /** Every travel in the window when the traveler is not sure — all of them get told. */
  candidateTripNos: string[];
  notifiedOperatorIds: string[];
  notifiedOperatorNames: string[];
  description: string;
  photoUrl: string | null;
  /** Private R2 object key; access is granted by the authenticated backend. */
  photoObjectKey?: string | null;
  status: LostItemStatus;
  createdAt: number;
  statusAt: number;
  return: LostItemReturn | null;
};

/** Human wording for each rung, and whether it has been reached. Used by the status ladder. */
export const STATUS_LADDER: { key: LostItemStatus; label: string }[] = [
  { key: 'reported', label: 'Reported' },
  { key: 'operator-notified', label: 'Operator notified' },
  { key: 'located', label: 'Item located' },
  { key: 'return-arranged', label: 'Return arranged' },
  { key: 'returned', label: 'Back with you' },
];

/**
 * Put the photo somewhere the operator can open it.
 *
 * A `file://` URI written into a document is a picture only the traveler's own phone can
 * see, which is the same class of defect as a status nobody set. Returns null on failure and
 * the caller files the report without it — a described item still beats no report.
 */
async function uploadPhoto(uid: string, localUri: string): Promise<string | null> {
  const user = auth.currentUser;
  if (!user || user.uid !== uid) return null;
  try {
    const token = await user.getIdToken();
    const local = await fetch(localUri);
    const blob = await local.blob();
    const contentType = blob.type || 'image/jpeg';
    const signed = await fetch(`${PAYMENT_SERVER_URL}/storage/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ purpose: 'lost-item', contentType }),
    });
    const grant = await signed.json().catch(() => ({}));
    if (!signed.ok || !grant?.uploadUrl || !grant?.key) return null;
    const put = await fetch(grant.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
    return put.ok ? String(grant.key) : null;
  } catch { return null; }
}

/**
 * File the report and notify the operators it concerns.
 *
 * `travels` is the set the report covers: one travel when the traveler picked it, and every
 * travel in the window when they chose "I'm not sure which". Somebody who cannot remember
 * which car they left a bag in must not be stuck, so the not-sure path is a real fan-out —
 * every operator on the document, not a shrug.
 */
export async function reportLostItem(args: {
  travels: RideRecord[];
  description: string;
  photoUri?: string | null;
  unsure: boolean;
}): Promise<LostItem | null> {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;

  const photoObjectKey = args.photoUri ? await uploadPhoto(uid, args.photoUri) : null;
  // R2 is private. The durable record stores an object key, never a public bearer URL.
  const photoUrl: string | null = null;

  const operatorIds = Array.from(
    new Set(args.travels.map((t) => t.operatorId).filter(Boolean)),
  );
  const operatorNames = Array.from(
    new Set(args.travels.map((t) => t.operatorName).filter(Boolean)),
  );

  const now = Date.now();
  const record: Omit<LostItem, 'id'> = {
    travelerUid: uid,
    tripNo: args.unsure ? null : (args.travels[0]?.tripNo ?? null),
    candidateTripNos: args.travels.map((t) => t.tripNo).filter(Boolean),
    notifiedOperatorIds: operatorIds,
    notifiedOperatorNames: operatorNames,
    description: args.description.trim().slice(0, 2000),
    photoUrl,
    ...(photoObjectKey ? { photoObjectKey } : {}),
    // The document naming the operators IS the notification, so the two are written in one
    // step and the status can never run ahead of it. With no operator on the travel record
    // there is nobody to notify and the report stops at `reported`.
    status: operatorIds.length > 0 ? 'operator-notified' : 'reported',
    createdAt: now,
    statusAt: now,
    return: null,
  };

  let created;
  try {
    created = await addDoc(collection(db, 'lost_items'), record);
  } catch {
    return null;
  }

  // AND PUT IT IN FRONT OF A PERSON. The document above names the operators, which is a
  // record, not a delivery — nothing on an operator's phone reads it yet. Until the operator
  // queue exists a specialist is the only route this bag actually has, so the case is filed
  // too, and `caseNo` comes back null when that failed. The screen says "a specialist follows
  // it up" only when it did not.
  let caseNo: string | null = null;
  try {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const res = await fetch(`${PAYMENT_SERVER_URL}/lost-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        itemId: created.id,
        tripNo: record.tripNo,
        travels: record.candidateTripNos,
        operators: record.notifiedOperatorNames,
        description: record.description,
        photoUrl: record.photoUrl,
        // The case carries the travel as the record has it, so the specialist reads the real
        // route and amount rather than blanks and a zero.
        trip: args.unsure
          ? { no: null, dep: '', arr: '', totalCents: 0 }
          : {
              no: record.tripNo,
              dep: args.travels[0]?.dep ?? '',
              arr: args.travels[0]?.arr ?? '',
              totalCents: args.travels[0]?.totalCents ?? 0,
            },
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d?.ok) caseNo = d.caseNo ?? null;
  } catch {
    // The report itself is saved. Only the human hand-off failed, and the screen says so.
  }

  return { id: created.id, caseNo, ...record };
}


/** Resolve this traveler's private lost-item image to a short-lived URL for display. */
export async function lostItemPhotoUrl(item: LostItem): Promise<string | null> {
  if (item.photoUrl) return item.photoUrl; // compatibility with pre-R2 records
  if (!item.photoObjectKey) return null;
  const user = auth.currentUser;
  if (!user || user.uid !== item.travelerUid) return null;
  try {
    const token = await user.getIdToken();
    const qs = new URLSearchParams({ purpose: 'lost-item', key: item.photoObjectKey }).toString();
    const res = await fetch(`${PAYMENT_SERVER_URL}/storage/object?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data?.url ? String(data.url) : null;
  } catch { return null; }
}

/** Watch one report, so the ladder moves the moment an operator answers. Returns unsubscribe. */
export function watchLostItem(id: string, onChange: (item: LostItem | null) => void): () => void {
  try {
    return onSnapshot(
      doc(db, 'lost_items', id),
      (snap) => onChange(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<LostItem, 'id'>) }) : null),
      () => onChange(null),
    );
  } catch {
    return () => {};
  }
}

/** Every open report this traveler has filed, newest first. */
export async function fetchMyLostItems(): Promise<LostItem[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  try {
    const snap = await getDocs(
      query(collection(db, 'lost_items'), where('travelerUid', '==', uid)),
    );
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<LostItem, 'id'>) }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export type ArrangeResult =
  | { ok: true; ret: LostItemReturn }
  | { ok: false; reason: 'no-operator' | 'write-failed' | 'signed-out' | 'travel-unknown' };

/**
 * Arrange the return. THE PLATFORM CHOOSES; the traveler is never asked to negotiate.
 *
 * Path 1 — THE ORIGINAL OPERATOR, when they are still working. No cost: they have the item
 * already and their next travel can pass by. Tried first because it is the best outcome for
 * everyone.
 *
 * Path 2 — ANY OPERATOR, dispatched like a small delivery: whoever is nearest, paid the same
 * 99%. This is the answer when the original operator has finished for the day or left the
 * area, and it is the case worth getting right — the item is a passenger with no opinions,
 * and an operator who has finished their day is not penalised for having finished it.
 *
 * Either way it is a real dispatched travel, priced by the same server that prices every
 * other travel. When there are no coordinates to price from, `priced` comes back false and
 * the screen must show no amount rather than an invented one.
 */
export async function arrangeReturn(args: {
  item: LostItem;
  /** Where the traveler wants the item brought. */
  destination: { lat: number; lng: number } | null;
}): Promise<ArrangeResult> {
  const uid = auth.currentUser?.uid;
  if (!uid) return { ok: false, reason: 'signed-out' };

  // AN "I'M NOT SURE WHICH" REPORT HAS NO ORIGINAL OPERATOR YET.
  //
  // This took `notifiedOperatorIds[0]` — the first of however many operators the report was
  // fanned out to, ordered by nothing meaningful — and, if that person happened to be free,
  // told the traveler "the operator who drove your travel" is bringing it back. We have no
  // reason to believe they drove it, and a return dispatched to the wrong car is the same
  // defect as a status nobody set. A fanned-out report has to wait for an operator to say
  // they have the item; that answer is what names the travel.
  if (!args.item.tripNo) return { ok: false, reason: 'travel-unknown' };

  // ONE QUESTION, ANSWERED ON THE SERVER. This was two calls that each pulled the whole fleet
  // to the phone. The server tries the operator who drove the travel first and falls back to
  // the nearest, holding both to the same gates as any dispatch.
  if (!args.destination) return { ok: false, reason: 'no-operator' };
  const found = await returnOperator({ lostItemId: args.item.id, destination: args.destination });
  if (!found) return { ok: false, reason: 'no-operator' };

  let ret: LostItemReturn;
  if (found.path === 'original-operator') {
    ret = {
      path: 'original-operator',
      operatorId: found.op.id,
      operatorName: found.op.name,
      costCents: 0,
      priced: true,
      arrangedAt: Date.now(),
    };
  } else {
    ret = {
      path: 'any-operator',
      operatorId: found.op.id,
      operatorName: found.op.name,
      costCents: found.costCents,
      priced: true,
      arrangedAt: Date.now(),
    };
  }

  try {
    await updateDoc(doc(db, 'lost_items', args.item.id), {
      return: ret,
      status: 'return-arranged' as LostItemStatus,
      statusAt: Date.now(),
    });
    return { ok: true, ret };
  } catch {
    return { ok: false, reason: 'write-failed' };
  }
}
