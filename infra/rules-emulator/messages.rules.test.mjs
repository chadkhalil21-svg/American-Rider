// Adversarial tests of the `messages` and `rides` rules in firestore.rules, against the real emulator.
// Run: npm --prefix infra/rules-emulator test   (needs Java 11+; downloads the emulator once)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, addDoc, collection, getDocs, query, where } from 'firebase/firestore';

const here = path.dirname(fileURLToPath(import.meta.url));
const rules = fs.readFileSync(path.join(here, '..', '..', 'firestore.rules'), 'utf8');
const env = await initializeTestEnvironment({ projectId: 'demo-american-rider', firestore: { rules } });

const R = [];
const check = async (label, fn) => {
  try {
    await fn();
    R.push({ label, ok: true });
  } catch (e) {
    R.push({ label, ok: false, d: e?.message });
  }
};

// Rides, written as the server writes them (admin, rules bypassed).
const rides = {
  rideA: { tripNo: 'AR-1001-MIA', travelerUid: 'travA', operatorId: 'opA', status: 'accepted' },
  rideB: { tripNo: 'AR-1002-MIA', travelerUid: 'travB', operatorId: 'opB', status: 'onboard' },
  rideAssigned: { tripNo: 'AR-1003-MIA', travelerUid: 'travA', operatorId: 'opA', status: 'assigned' },
  rideDone: { tripNo: 'AR-1004-MIA', travelerUid: 'travA', operatorId: 'opA', status: 'completed' },
  rideCancelled: { tripNo: 'AR-1005-MIA', travelerUid: 'travA', operatorId: 'opA', status: 'cancelled' },
};
const seed = async (overrides = {}) => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [id, r] of Object.entries({ ...rides, ...overrides })) await setDoc(doc(ctx.firestore(), 'rides', id), r);
  });
};
const as = (uid) => env.authenticatedContext(uid).firestore();
const msg = (over) => ({ lostItemId: null, text: 'Hello', createdAt: 1, ...over });
const fromTraveler = (rideId, r, uid = r.travelerUid, over = {}) =>
  msg({ rideId, tripNo: r.tripNo, from: 'traveler', travelerUid: uid, operatorId: r.operatorId, ...over });
const fromOperator = (rideId, r, uid = r.operatorId, over = {}) =>
  msg({ rideId, tripNo: r.tripNo, from: 'operator', travelerUid: r.travelerUid, operatorId: uid, ...over });
const write = (uid, data) => addDoc(collection(as(uid), 'messages'), data);

await seed();

// ——— the assigned parties talk normally ————————————————————————————————————————
await check('assigned traveler can write on their travel', () => assertSucceeds(write('travA', fromTraveler('rideA', rides.rideA))));
await check('assigned operator can write on their travel', () => assertSucceeds(write('opA', fromOperator('rideA', rides.rideA))));
await check('traveler reads their thread', () => assertSucceeds(getDocs(query(collection(as('travA'), 'messages'), where('tripNo', '==', 'AR-1001-MIA'), where('travelerUid', '==', 'travA')))));
await check('operator reads their thread', () => assertSucceeds(getDocs(query(collection(as('opA'), 'messages'), where('tripNo', '==', 'AR-1001-MIA'), where('operatorId', '==', 'opA')))));

// ——— Traveler A cannot reach Traveler B's travel ——————————————————————————————————————
await check("traveler A cannot write into traveler B's travel as a traveler", () =>
  assertFails(write('travA', fromTraveler('rideB', rides.rideB, 'travA'))));
await check("traveler A cannot write into traveler B's travel posing as B", () =>
  assertFails(write('travA', fromTraveler('rideB', rides.rideB, 'travB'))));
await check("traveler A cannot read traveler B's thread", () =>
  assertFails(getDocs(query(collection(as('travA'), 'messages'), where('tripNo', '==', 'AR-1002-MIA'), where('travelerUid', '==', 'travB')))));

// ——— Operator A cannot reach a travel not assigned to them —————————————————————————————
await check("operator A cannot write into operator B's travel", () =>
  assertFails(write('opA', fromOperator('rideB', rides.rideB, 'opA'))));
await check("operator A cannot write as operator B", () =>
  assertFails(write('opA', fromOperator('rideB', rides.rideB, 'opB'))));

// ——— knowing a Travel Number and a user ID is not enough ——————————————————————————————
await check('the old attack — tripNo + victim uid, own uid as operator, own ride id — is refused', () =>
  assertFails(write('mallory', msg({ rideId: 'rideA', tripNo: 'AR-1002-MIA', from: 'operator', travelerUid: 'travB', operatorId: 'mallory' }))));
await check('…and with the victim’s real ride id', () =>
  assertFails(write('mallory', msg({ rideId: 'rideB', tripNo: 'AR-1002-MIA', from: 'operator', travelerUid: 'travB', operatorId: 'mallory' }))));
await check('…and with no ride id at all', () =>
  assertFails(write('mallory', msg({ tripNo: 'AR-1002-MIA', from: 'operator', travelerUid: 'travB', operatorId: 'mallory' }))));
await check('…and with a ride id that does not exist', () =>
  assertFails(write('mallory', msg({ rideId: 'nope', tripNo: 'AR-1002-MIA', from: 'traveler', travelerUid: 'mallory', operatorId: 'opB' }))));
await check('a real party cannot mislabel the Travel Number', () =>
  assertFails(write('travA', fromTraveler('rideA', rides.rideA, 'travA', { tripNo: 'AR-1002-MIA' }))));
await check('a traveler cannot address a different operator', () =>
  assertFails(write('travA', fromTraveler('rideA', rides.rideA, 'travA', { operatorId: 'opB' }))));
await check('an unsigned user cannot write', () =>
  assertFails(addDoc(collection(env.unauthenticatedContext().firestore(), 'messages'), fromTraveler('rideA', rides.rideA))));
await check('an extra field is refused', () => assertFails(write('travA', { ...fromTraveler('rideA', rides.rideA), extra: 1 })));
await check('text over 2,000 characters is refused', () => assertFails(write('travA', fromTraveler('rideA', rides.rideA, 'travA', { text: 'x'.repeat(2001) }))));

// ——— assignment changes and terminal states ————————————————————————————————————————
await check('before acceptance: the traveler may write', () => assertSucceeds(write('travA', fromTraveler('rideAssigned', rides.rideAssigned))));
await check('before acceptance: the operator may not', () => assertFails(write('opA', fromOperator('rideAssigned', rides.rideAssigned))));
await seed({ rideA: { ...rides.rideA, operatorId: 'opC' } }); // re-offered to operator C
await check('after reassignment: the former operator can no longer write', () =>
  assertFails(write('opA', fromOperator('rideA', { ...rides.rideA }, 'opA'))));
await check('after reassignment: the new operator can', () =>
  assertSucceeds(write('opC', fromOperator('rideA', { ...rides.rideA, operatorId: 'opC' }))));
await check('after reassignment: the traveler writes to the new operator only', async () => {
  await assertSucceeds(write('travA', fromTraveler('rideA', { ...rides.rideA, operatorId: 'opC' })));
  await assertFails(write('travA', fromTraveler('rideA', rides.rideA))); // still addressed to opA
});
await check('completed travel: no ordinary message', () => assertFails(write('travA', fromTraveler('rideDone', rides.rideDone))));
await check('completed travel: a lost item message from the traveler is allowed', () =>
  assertSucceeds(write('travA', fromTraveler('rideDone', rides.rideDone, 'travA', { lostItemId: 'lost1' }))));
await check('completed travel: the operator may answer a lost item report', () =>
  assertSucceeds(write('opA', fromOperator('rideDone', rides.rideDone, 'opA', { lostItemId: 'lost1' }))));
await check('cancelled travel: nothing, not even a lost item message', () =>
  assertFails(write('travA', fromTraveler('rideCancelled', rides.rideCancelled, 'travA', { lostItemId: 'lost1' }))));
await check('messages cannot be edited or deleted', async () => {
  await seed();
  const ref = await write('travA', fromTraveler('rideA', rides.rideA));
  const { updateDoc, deleteDoc } = await import('firebase/firestore');
  await assertFails(updateDoc(doc(as('travA'), 'messages', ref.id), { text: 'changed' }));
  await assertFails(deleteDoc(doc(as('travA'), 'messages', ref.id)));
});

// ——— rides: acceptance is the server's (POST /travel/accept), not the phone's ——————————————
await seed();
const { updateDoc } = await import('firebase/firestore');
await check("rides: the operator's phone cannot write 'accepted'", () =>
  assertFails(updateDoc(doc(as('opA'), 'rides', 'rideAssigned'), { status: 'accepted', statusAt: 2 })));
await check("rides: the operator's phone cannot jump from 'assigned' to 'arrived'", () =>
  assertFails(updateDoc(doc(as('opA'), 'rides', 'rideAssigned'), { status: 'arrived', statusAt: 2, arrivedAt: 2 })));
await check('rides: the operator may decline an open offer', () =>
  assertSucceeds(updateDoc(doc(as('opA'), 'rides', 'rideAssigned'), { status: 'declined', statusAt: 2, declinedAt: 2 })));
await check('rides: the operator moves an accepted travel to arrived', () =>
  assertSucceeds(updateDoc(doc(as('opA'), 'rides', 'rideA'), { status: 'arrived', statusAt: 2, arrivedAt: 2 })));
await check('rides: another operator cannot touch it', () =>
  assertFails(updateDoc(doc(as('opB'), 'rides', 'rideA'), { status: 'arrived', statusAt: 3 })));
await check('rides: nobody reassigns a travel from a phone', () =>
  assertFails(updateDoc(doc(as('opA'), 'rides', 'rideA'), { operatorId: 'opB' })));

// ——— rides: a traveler cannot declare their travel completed or cancelled ————————————————
// (independent audit of e26adcb). Cancellation is POST /travel/cancel; completion is the operator's.
for (const st of ['assigned', 'accepted', 'arrived', 'onboard']) {
  for (const to of ['completed', 'cancelled']) {
    await seed({ rideX: { tripNo: 'AR-2000-MIA', travelerUid: 'travA', operatorId: 'opA', status: st } });
    await check(`rides: the traveler cannot change ${st} to ${to}`, () =>
      assertFails(updateDoc(doc(as('travA'), 'rides', 'rideX'), { status: to, statusAt: 5 })));
  }
}
await seed();
await check("rides: the traveler cannot reopen a cancelled travel", () =>
  assertFails(updateDoc(doc(as('travA'), 'rides', 'rideCancelled'), { status: 'completed', statusAt: 5 })));
await check('rides: the traveler may rate and tip a COMPLETED travel', () =>
  assertSucceeds(updateDoc(doc(as('travA'), 'rides', 'rideDone'), { rating: 5, tipCents: 200, reviewedAt: 5 })));
await check('rides: …but not one that is still under way', () =>
  assertFails(updateDoc(doc(as('travA'), 'rides', 'rideA'), { rating: 5, reviewedAt: 5 })));
await check('rides: …nor a cancelled one', () =>
  assertFails(updateDoc(doc(as('travA'), 'rides', 'rideCancelled'), { rating: 5, reviewedAt: 5 })));
await check('rides: a rating outside 1–5 is refused', () =>
  assertFails(updateDoc(doc(as('travA'), 'rides', 'rideDone'), { rating: 9, reviewedAt: 6 })));
await check('rides: the review cannot carry a status change', () =>
  assertFails(updateDoc(doc(as('travA'), 'rides', 'rideDone'), { rating: 4, status: 'cancelled' })));
await check("rides: another traveler cannot review someone else's travel", () =>
  assertFails(updateDoc(doc(as('travB'), 'rides', 'rideDone'), { rating: 1, reviewedAt: 5 })));
await check('rides: the operator still records completion from onboard', () =>
  assertSucceeds(updateDoc(doc(as('opB'), 'rides', 'rideB'), { status: 'completed', statusAt: 6, needsPayout: true })));
await check('rides: nobody writes payment, refund or payout fields from a phone', async () => {
  await assertFails(updateDoc(doc(as('travA'), 'rides', 'rideDone'), { paymentIntentId: 'pi_x' }));
  await assertFails(updateDoc(doc(as('travA'), 'rides', 'rideDone'), { refundId: 're_x' }));
  await assertFails(updateDoc(doc(as('opA'), 'rides', 'rideDone'), { transferId: 'tr_x' }));
});

await env.cleanup();
let bad = 0;
for (const r of R) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.ok ? '' : '  — ' + r.d}`);
}
console.log(`\n${R.length - bad}/${R.length} passed`);
process.exit(bad ? 1 : 0);
