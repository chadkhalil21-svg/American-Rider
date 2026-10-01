const assert = require('assert');
const fs = require('fs');
const { closeOperationalAccount } = require('./accountclosure');

function fakeDb({ traveler = [], operator = [], scheduled = [], closed = null } = {}) {
  const operations = [];
  const docs = new Map();
  const rideRows = { travelerUid: traveler, operatorId: operator };
  const closureDocs = new Map();
  if (closed) closureDocs.set('u', closed);
  for (const name of scheduled) docs.set(name, { status: name.split(':')[0] === 'future' ? 'reserved' : name.split(':')[0], claimedAt: name.includes(':claimed') ? 1 : null });
  const rideRefs = (names) => names.map((name) => ({ ref:{}, data: () => ({ status: name.split(':')[0] }) }));
  const scheduledRefs = () => [...docs.keys()].map((name) => ({
    id:name,
    ref:{ __scheduled:name },
    data:()=>docs.get(name),
  }));
  const db = {
    operations,
    collection(name) {
      return {
        where(field) { return { get: async () => ({ docs: name === 'scheduled_rides' ? scheduledRefs() : rideRefs(rideRows[field] || []) }) }; },
        doc(id) { return { get: async () => { const v = name === 'account_closures' ? closureDocs.get(id) : undefined; return { exists: !!v, data: () => v }; }, set: async (value, options) => { if(name === 'account_closures') closureDocs.set(id, { ...(closureDocs.get(id)||{}), ...value }); operations.push(['set', `${name}/${id}`, value, options]); }, delete: async () => { operations.push(['delete', `${name}/${id}`]); } }; },
      };
    },
    async runTransaction(fn) {
      return fn({
        get: async (ref) => {
          const value = docs.get(ref.__scheduled);
          return { exists: !!value, data: () => value };
        },
        update: (ref, value) => {
          docs.set(ref.__scheduled, { ...(docs.get(ref.__scheduled)||{}), ...value });
          operations.push(['update', ref.__scheduled, value]);
        },
      });
    },
  };
  return db;
}

(async () => {
  assert.deepStrictEqual(await closeOperationalAccount({ db: null, uid: 'u' }), { ok: false, code: 'database_unavailable' });

  const blocked = fakeDb({ traveler: ['accepted:T-1'], scheduled: ['future:S-1'] });
  assert.deepStrictEqual(await closeOperationalAccount({ db: blocked, uid: 'u' }), { ok: false, code: 'active_travel' });
  assert.deepStrictEqual(blocked.operations, [
    ['set', 'account_operation_fences/u', { closing: true, startedAt: blocked.operations[0]?.[2]?.startedAt }, { merge: true }],
    ['delete', 'account_operation_fences/u'],
  ], 'an active Travel uses only a transient closure fence and leaves scheduled/fleet state unchanged');

  const db = fakeDb({ traveler: ['completed:T-1'], operator: ['cancelled:T-2'], scheduled: ['future:S-1', 'future:S-2'] });
  assert.deepStrictEqual(await closeOperationalAccount({ db, uid: 'u', now: 123 }), { ok: true, operationallyClosed: true, cancelledScheduled: 2 });
  assert.deepStrictEqual(db.operations, [
    ['set', 'account_operation_fences/u', { closing: true, startedAt: 123 }, { merge: true }],
    ['update', 'future:S-1', { status: 'cancelled', cancelledAt: 123, closedReason: 'Account closed.', claimedAt: null }],
    ['update', 'future:S-2', { status: 'cancelled', cancelledAt: 123, closedReason: 'Account closed.', claimedAt: null }],
    ['set', 'operators/u', { available: false, offlineAt: 123, lat: null, lng: null }, { merge: true }],
    ['set', 'account_closures/u', { operationallyClosed: true, closedAt: 123, cancelledScheduled: 2 }, { merge: true }],
    ['delete', 'account_operation_fences/u'],
  ]);


  const retry = fakeDb({ closed: { operationallyClosed:true, closedAt:123, cancelledScheduled:2 }, scheduled:['payment_integrity_hold:S-9'] });
  assert.deepStrictEqual(await closeOperationalAccount({ db: retry, uid:'u', now:999 }), { ok:true, operationallyClosed:true, cancelledScheduled:2, closedAt:123, alreadyClosed:true });
  assert.deepStrictEqual(retry.operations, [], 'durably completed closure retries without replaying operational mutations');

  const claimed = fakeDb({ scheduled: ['future:claimed'] });
  assert.deepStrictEqual(await closeOperationalAccount({ db: claimed, uid: 'u', now: 123 }), { ok:false, code:'scheduled_travel_in_progress' });
  assert.equal(claimed.operations.some((x)=>x[0]==='set' && x[1]==='account_closures/u'), false, 'claimed scheduled Travel blocks durable account closure');
  assert.equal(claimed.operations.at(-1)?.[1], 'account_operation_fences/u', 'blocked closure retires its transient fence');
  const server = fs.readFileSync(require.resolve('./server'), 'utf8');
  assert.match(server, /app\.post\('\/account\/close', requireAuth,/);
  const client = fs.readFileSync(require.resolve('../src/backend/account.ts'), 'utf8');
  assert.match(client, /Authorization: `Bearer \$\{token\}`/);
  console.log('PASS  account closure blocks during active Travel');
  console.log('PASS  account closure cancels scheduled Travel and removes the Operator from service');
  console.log('PASS  account closure requires a Firebase identity at both ends');
  console.log('PASS  account closure leaves durable server-side crash-recovery evidence');
})().catch((e) => { console.error(e); process.exit(1); });