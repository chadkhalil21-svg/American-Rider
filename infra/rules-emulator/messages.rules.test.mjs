// Adversarial tests of the `messages` and `rides` rules in firestore.rules, against the real emulator.
// Run: npm --prefix infra/rules-emulator test   (needs Java 11+; downloads the emulator once)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, addDoc, collection, getDocs, query, where } from 'firebase/firestore';
// THE APP'S OWN WRITE — the module operatorInbox.ts setStatus() sends, imported as-is (Node strips
// the TypeScript types). A rule that refuses what the app really sends fails here.
import { operatorStatusWrite } from '../../src/backend/rideStatusWrite.ts';

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
  rideTeen: { tripNo: 'AR-1006-MIA', travelerUid: 'teenA', operatorId: 'opA', status: 'accepted', party: { teen: true, guardianUid: 'guardA' } },
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
  msg({ rideId, tripNo: r.tripNo, from: 'operator', travelerUid: r.travelerUid, operatorId: uid, guardianUid: r.party?.guardianUid ?? null, ...over });
const fromGuardian = (rideId, r, uid = r.party?.guardianUid, over = {}) =>
  msg({ rideId, tripNo: r.tripNo, from: 'guardian', travelerUid: r.travelerUid, operatorId: r.operatorId, guardianUid: uid, ...over });
const write = (uid, data) => addDoc(collection(as(uid), 'messages'), data);

await seed();

// ——— the assigned parties talk normally ————————————————————————————————————————
await check('assigned traveler can write on their travel', () => assertSucceeds(write('travA', fromTraveler('rideA', rides.rideA))));
await check('assigned operator can write on their travel', () => assertSucceeds(write('opA', fromOperator('rideA', rides.rideA))));
await check('traveler reads their thread', () => assertSucceeds(getDocs(query(collection(as('travA'), 'messages'), where('tripNo', '==', 'AR-1001-MIA'), where('travelerUid', '==', 'travA')))));
await check('operator reads their thread', () => assertSucceeds(getDocs(query(collection(as('opA'), 'messages'), where('tripNo', '==', 'AR-1001-MIA'), where('operatorId', '==', 'opA')))));

// ——— Family / Teen three-party conversation boundary ———————————————————————————————
await check('authorized guardian can write in Teen Travel', () => assertSucceeds(write('guardA', fromGuardian('rideTeen', rides.rideTeen))));
await check('authorized guardian can read Teen Travel thread', () => assertSucceeds(getDocs(query(collection(as('guardA'), 'messages'), where('tripNo','==','AR-1006-MIA'), where('guardianUid','==','guardA')))));
await check('unrelated account cannot pose as Teen guardian', () => assertFails(write('mallory', fromGuardian('rideTeen', rides.rideTeen, 'mallory'))));
await check('traveler cannot pose as guardian', () => assertFails(write('teenA', fromGuardian('rideTeen', rides.rideTeen, 'guardA'))));
await check('guardian cannot enter ordinary adult Travel', () => assertFails(write('guardA', fromGuardian('rideA', rides.rideA, 'guardA'))));

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
await check('rides: the traveler may rate a COMPLETED travel', () =>
  assertSucceeds(updateDoc(doc(as('travA'), 'rides', 'rideDone'), { rating: 5, reviewedAt: 5 })));
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
await check('rides: the operator still records completion from onboard (the app\'s exact write)', () =>
  assertSucceeds(updateDoc(doc(as('opB'), 'rides', 'rideB'), operatorStatusWrite('completed', 6))));
await check('rides: nobody writes payment, refund or payout fields from a phone', async () => {
  await assertFails(updateDoc(doc(as('travA'), 'rides', 'rideDone'), { paymentIntentId: 'pi_x' }));
  await assertFails(updateDoc(doc(as('travA'), 'rides', 'rideDone'), { refundId: 're_x' }));
  await assertFails(updateDoc(doc(as('opA'), 'rides', 'rideDone'), { transferId: 'tr_x' }));
});

// ——— the operator's status writes, EXACTLY as setStatus() sends them (audit of f6ef88d) ——————
{
  const seedOne = (r) => seed({ rideX: { tripNo: 'AR-3000-MIA', travelerUid: 'travA', operatorId: 'opA', ...r } });
  const opWrite = (data) => updateDoc(doc(as('opA'), 'rides', 'rideX'), data);
  const shape = (st) => Object.keys(operatorStatusWrite(st, 1)).sort().join(',');
  await check('the app\'s write shapes are the ones the audit read', async () => {
    if (shape('arrived') !== 'arrivedAt,status,statusAt') throw new Error(shape('arrived'));
    if (shape('onboard') !== 'onboardAt,status,statusAt') throw new Error(shape('onboard'));
    if (shape('completed') !== 'completedAt,needsPayout,status,statusAt') throw new Error(shape('completed'));
    if (shape('declined') !== 'declinedAt,status,statusAt') throw new Error(shape('declined'));
  });

  await seedOne({ status: 'accepted' });
  await check('accepted → arrived with arrivedAt: succeeds', () => assertSucceeds(opWrite(operatorStatusWrite('arrived', 10))));
  await check('arrived → onboard with onboardAt (markOnboard): succeeds', () => assertSucceeds(opWrite(operatorStatusWrite('onboard', 20))));
  await check('onboard → completed with completedAt + needsPayout:true (markCompleted): succeeds', () =>
    assertSucceeds(opWrite(operatorStatusWrite('completed', 30))));
  await check('completedAt cannot be rewritten afterwards', () => assertFails(opWrite({ completedAt: 99 })));
  await check('…nor with a repeated "completed"', () => assertFails(opWrite(operatorStatusWrite('completed', 99))));
  await check('onboardAt cannot be rewritten after completion', () => assertFails(opWrite({ onboardAt: 99 })));
  await check('needsPayout cannot be set again once the server has paid and cleared it', async () => {
    await seedOne({ status: 'completed', completedAt: 30, needsPayout: false, transferId: 'tr_1' });
    await assertFails(opWrite({ needsPayout: true }));
  });

  await seedOne({ status: 'accepted' });
  await check('accepted → onboard with onboardAt: succeeds (the operator may skip "arrived")', () => assertSucceeds(opWrite(operatorStatusWrite('onboard', 20))));
  await check('onboardAt cannot be rewritten while onboard', () => assertFails(opWrite({ onboardAt: 99 })));
  await check('…nor alongside a later move to completed', () => assertFails(opWrite({ ...operatorStatusWrite('completed', 30), onboardAt: 99 })));
  await check('completedAt cannot be written without entering completed', () => assertFails(opWrite({ completedAt: 30 })));
  await check('needsPayout cannot be set before completion', () => assertFails(opWrite({ needsPayout: true })));
  await check('a timestamp for another status cannot ride along (arrivedAt on the move to completed)', () =>
    assertFails(opWrite({ ...operatorStatusWrite('completed', 30), arrivedAt: 30 })));
  await check('arrivedAt cannot be rewritten afterwards', async () => {
    await seedOne({ status: 'arrived', arrivedAt: 10 });
    await assertFails(opWrite({ arrivedAt: 99 }));
  });

  await seedOne({ status: 'assigned' });
  await check('assigned → declined with declinedAt (declineTravel): succeeds', () => assertSucceeds(opWrite(operatorStatusWrite('declined', 5))));
  await seedOne({ status: 'assigned' });
  await check('assigned → onboard is still refused, stamp or no stamp', () => assertFails(opWrite(operatorStatusWrite('onboard', 5))));

  // The traveler may write none of the operator's fields, in any state.
  for (const st of ['assigned', 'accepted', 'arrived', 'onboard', 'completed']) {
    await seedOne({ status: st });
    await check(`traveler writing operational fields on a ${st} travel: fails`, async () => {
      const t = (data) => updateDoc(doc(as('travA'), 'rides', 'rideX'), data);
      await assertFails(t({ arrivedAt: 1 }));
      await assertFails(t({ onboardAt: 1 }));
      await assertFails(t({ completedAt: 1 }));
      await assertFails(t({ needsPayout: true }));
      await assertFails(t(operatorStatusWrite('completed', 1)));
      await assertFails(t(operatorStatusWrite('onboard', 1)));
    });
  }
}

// markOnboard() and markCompleted() really are setStatus() with this write.
await check('markOnboard/markCompleted send operatorStatusWrite — no other shape exists in the app', async () => {
  const inbox = fs.readFileSync(path.join(here, '..', '..', 'src', 'backend', 'operatorInbox.ts'), 'utf8');
  const need = [
    /export const markOnboard = \(rideId: string\) => setStatus\(rideId, 'onboard'\);/,
    /export const markCompleted = \(rideId: string\) => setStatus\(rideId, 'completed'\);/,
    /export const markArrived = \(rideId: string\) => setStatus\(rideId, 'arrived'\);/,
    /export const declineTravel = \(rideId: string\) => setStatus\(rideId, 'declined'\);/,
    /updateDoc\(doc\(db, 'rides', rideId\), operatorStatusWrite\(status, Date\.now\(\)\)\)/,
  ];
  for (const re of need) if (!re.test(inbox)) throw new Error(`operatorInbox.ts does not match ${re}`);
  const updates = inbox.match(/updateDoc\(/g) || [];
  if (updates.length !== 1) throw new Error(`expected one updateDoc in operatorInbox.ts, found ${updates.length}`);
});

await env.cleanup();
let bad = 0;
for (const r of R) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.ok ? '' : '  — ' + r.d}`);
}
console.log(`\n${R.length - bad}/${R.length} passed`);
process.exit(bad ? 1 : 0);
