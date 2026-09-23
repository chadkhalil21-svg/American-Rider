const assert = require('assert');
const fs = require('fs');
const { closeOperationalAccount } = require('./accountclosure');

function fakeDb({ traveler = [], operator = [], scheduled = [] } = {}) {
  const operations = [];
  const rows = { rides: { travelerUid: traveler, operatorId: operator }, scheduled_rides: { travelerUid: scheduled } };
  const refs = (names) => names.map((name) => ({
    ref: { delete: async () => { operations.push(['delete', name]); } },
    data: () => ({ status: name.split(':')[0] }),
  }));
  return {
    operations,
    collection(name) {
      return {
        where(field) { return { get: async () => ({ docs: refs(rows[name]?.[field] || []) }) }; },
        doc(id) { return { set: async (value, options) => { operations.push(['set', `${name}/${id}`, value, options]); } }; },
      };
    },
  };
}

(async () => {
  assert.deepStrictEqual(await closeOperationalAccount({ db: null, uid: 'u' }), { ok: false, code: 'database_unavailable' });

  const blocked = fakeDb({ traveler: ['accepted:T-1'], scheduled: ['future:S-1'] });
  assert.deepStrictEqual(await closeOperationalAccount({ db: blocked, uid: 'u' }), { ok: false, code: 'active_travel' });
  assert.deepStrictEqual(blocked.operations, [], 'an active Travel must leave scheduled and fleet state unchanged');

  const db = fakeDb({ traveler: ['completed:T-1'], operator: ['cancelled:T-2'], scheduled: ['future:S-1', 'future:S-2'] });
  assert.deepStrictEqual(await closeOperationalAccount({ db, uid: 'u', now: 123 }), { ok: true, cancelledScheduled: 2 });
  assert.deepStrictEqual(db.operations, [
    ['delete', 'future:S-1'],
    ['delete', 'future:S-2'],
    ['set', 'operators/u', { available: false, offlineAt: 123, lat: null, lng: null }, { merge: true }],
  ]);
  const server = fs.readFileSync(require.resolve('./server'), 'utf8');
  assert.match(server, /app\.post\('\/account\/close', requireAuth,/);
  const client = fs.readFileSync(require.resolve('../src/backend/account.ts'), 'utf8');
  assert.match(client, /Authorization: `Bearer \$\{token\}`/);
  console.log('PASS  account closure blocks during active Travel');
  console.log('PASS  account closure cancels scheduled Travel and removes the Operator from service');
  console.log('PASS  account closure requires a Firebase identity at both ends');
})().catch((e) => { console.error(e); process.exit(1); });