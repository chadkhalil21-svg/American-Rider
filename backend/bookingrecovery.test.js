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
      where(field, _, value) { return { limit(max) { return { async get() {
        return { docs: [...rows.entries()].filter(([id,row]) => id.startsWith(`${name}/`) && row[field] === value)
          .slice(0,max).map(([id]) => ({ id: id.slice(name.length+1), data: () => ({ ...rows.get(id) }) })) };
      } }; } }; },
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
  const deps={
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
  assert(refunds.every((r)=>r.idempotencyKey.startsWith('ar_cancel_refund_')));
  const again=await sweepBookingRecovery({ db, deps, stripeConfigured:true, now:now+1000 });
  assert.equal(again.closed.length,0);
  assert.equal(refunds.length,2,'completed refunds cannot repeat');
  console.log('PASS unattended prepared-booking closure, paid-unmatched refund and pending retry');
}
main().catch((e) => { console.error(e); process.exitCode=1; });
