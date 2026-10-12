const assert = require('node:assert/strict');
const { sweepBookingRecovery, PREPARED_TTL_MS, PAID_UNMATCHED_TTL_MS } = require('./bookingrecovery');
const now = 2_000_000_000_000;
function store() {
  const rows = new Map();
  const snap = (id) => ({ id, exists: rows.has(id), data: () => ({ ...rows.get(id) }) });
  const db = {
    rows,
    collection(name) { return {
      doc(id) { const key = `${name}/${id}`; return {
        id, get: async () => snap(key),
        set: async (fields) => rows.set(key, { ...rows.get(key), ...fields }),
        update: async (fields) => rows.set(key, { ...rows.get(key), ...fields }),
      }; },
      where(field, _, value) {
        const constraints = [[field, value]];
        const query = {
          where(nextField, _op, nextValue) { constraints.push([nextField,nextValue]); return query; },
          limit(max) { return { async get() {
            return { docs: [...rows.entries()].filter(([id,row]) =>
              id.startsWith(`${name}/`) && constraints.every(([key,v]) => row[key] === v))
              .slice(0,max).map(([id]) => ({ id: id.slice(name.length+1), data: () => ({ ...rows.get(id) }) })) };
          } }; },
        };
        return query;
      },
    }; },
    runTransaction(fn) { return fn({
      get: (ref) => ref.get(), update: (ref, fields) => ref.update(fields),
    }); },
  };
  return db;
}
async function main() {
  const db = store(); const refunds=[];
  db.rows.set('rides/unpaid', { travelerUid: 'u', status: 'awaiting_payment', createdAt: now - PREPARED_TTL_MS - 1 });
  db.rows.set('rides/paid', { travelerUid: 'u', status: 'awaiting_assignment', createdAt: now - 900000,
    paidAt: now - PAID_UNMATCHED_TTL_MS - 1, paymentIntentId: 'pi_paid', costCents: 2350 });
  db.rows.set('rides/retry', { travelerUid: 'u', status: 'cancelled', createdAt: now - 900000,
    refundPending: true, paymentIntentId: 'pi_retry', cancelledFrom: 'assigned', costCents: 2350 });
  db.rows.set('rides/scheduled', { travelerUid: 'u', status: 'awaiting_payment',
    reservationId:'reservation', createdAt:now-900000, costCents:2350 });
  db.rows.set('scheduled_rides/reservation', { paymentIntentId:'pi_schedule' });
  const deps={
    verifiedTravelPayment: async (id) => ({ id, status:'succeeded', amount_received:2350,
      currency:'usd', metadata:{uid:'u',rideId:'scheduled'} }),
    refundableFor: async () => ({ cents: 2350 }),
    refundTravel: async (args) => { refunds.push(args); return { ok: true, refundId: `re_${args.paymentIntentId}`, amountCents: args.amountCents, status: 'succeeded' }; },
    operatorPayoutAccount: async () => ({ accountId: null }),
  };
  const out=await sweepBookingRecovery({ db, deps, stripeConfigured: true, now });
  assert.equal(out.ok,true, JSON.stringify(out));
  assert.deepEqual(out.closed.sort(), ['paid','retry','unpaid']);
  assert.equal(db.rows.get('rides/unpaid').status,'cancelled');
  assert.equal(db.rows.get('rides/paid').status,'cancelled');
  assert.equal(db.rows.get('rides/paid').refundPending,false);
  assert.deepEqual(refunds.map((r)=>r.paymentIntentId).sort(), ['pi_paid','pi_retry']);
  assert.equal(db.rows.get('rides/scheduled').paymentIntentId, 'pi_schedule');
  assert(refunds.every((r)=>r.idempotencyKey.startsWith('ar_cancel_refund_')));
  const again=await sweepBookingRecovery({ db, deps, stripeConfigured:true, now:now+1000 });
  assert.equal(again.closed.length,0);
  assert.equal(refunds.length,2,'completed refunds cannot repeat');
  const later=await sweepBookingRecovery({ db, deps, stripeConfigured:true,
    now:now+PAID_UNMATCHED_TTL_MS+1000 });
  assert(later.closed.includes('scheduled'));
  assert.equal(refunds.length,3,'the scheduled orphan was automatically refunded');
  // Adversarial regression: 125 unrelated records occupy the natural scan
  // order with refundPending=true but are NOT legally eligible for this cancel
  // refund path. A post-query .continue used to starve the valid paid refund.
  const flood=store();
  for(let i=0;i<125;i++)flood.rows.set(`rides/irrelevant-${i}`,{
    status:'assigned',travelerUid:'u',refundPending:true,createdAt:now-60_000,
  });
  flood.rows.set('rides/eligible-refund',{
    travelerUid:'u',status:'cancelled',refundPending:true,
    paymentIntentId:'pi_eligible',cancelledFrom:'assigned',costCents:2350,
    createdAt:now-900000,
  });
  const beforeCount=refunds.length;
  const recovered=await sweepBookingRecovery({ db:flood,deps,stripeConfigured:true,now });
  assert.equal(recovered.ok,true,JSON.stringify(recovered));
  assert.ok(recovered.closed.includes('eligible-refund'),'valid paid refund cannot be starved by irrelevant flags');
  assert.equal(recovered.overCapacity,false,'query must not bill 100 irrelevant refund documents');
  assert.equal(refunds.length,beforeCount+1);
  assert.equal(flood.rows.get('rides/eligible-refund').refundPending,false);
  console.log('PASS unattended prepared-booking closure, paid-unmatched refund and pending retry');
}
main().catch((e) => { console.error(e); process.exitCode=1; });
