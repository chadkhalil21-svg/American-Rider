const assert = require('assert');
const fs = require('fs');
const { closeOperationalAccount } = require('./accountclosure');

function fakeDb({ traveler = [], operator = [], scheduled = [], advance = null } = {}) {
  const operations = [];
  const rows = { rides: { travelerUid: traveler, operatorId: operator }, scheduled_rides: { travelerUid: scheduled } };
  const refs = (names) => names.map((name) => {
    const ref={id:name,delete:async()=>{operations.push(['delete',name]);},
      get:async()=>({exists:true,data:()=>({status:advance===name?'dispatching':name.split(':')[0]})})};
    return {ref,data:()=>({status:name.split(':')[0]})};
  });
  return {
    operations,
    async runTransaction(fn) {const writes=[];const result=await fn({get:(r)=>r.get(),
      set:(r,v,o)=>writes.push(()=>r.set(v,o)),delete:(r)=>writes.push(()=>r.delete())});
      for(const w of writes)await w();return result;},
    collection(name) {
      return {
        where(field) { return { get: async () => ({ docs: refs(rows[name]?.[field] || []) }) }; },
        doc(id) { return {
          get: async () => ({ exists: true, data: () => ({}) }),
          set: async (value, options) => { operations.push(['set', `${name}/${id}`, value, options]); },
          delete: async () => { operations.push(['delete', `${name}/${id}`]); },
        }; },
      };
    },
  };
}

(async () => {
  assert.deepStrictEqual(await closeOperationalAccount({ db: null, uid: 'u' }), { ok: false, code: 'database_unavailable' });

  const blocked = fakeDb({ traveler: ['accepted:T-1'], scheduled: ['future:S-1'] });
  assert.deepStrictEqual(await closeOperationalAccount({ db: blocked, uid: 'u' }), { ok: false, code: 'active_travel' });
  assert.deepStrictEqual(blocked.operations, [], 'an active Travel must leave scheduled and fleet state unchanged');

  const awaiting=fakeDb({traveler:['awaiting_assignment:T-3']});
  assert.deepStrictEqual(await closeOperationalAccount({db:awaiting,uid:'u'}),{ok:false,code:'active_travel'});
  const charging=fakeDb({scheduled:['dispatching:S-4']});
  assert.deepStrictEqual(await closeOperationalAccount({db:charging,uid:'u'}),{ok:false,code:'active_travel'});
  const advanced=fakeDb({scheduled:['reserved:S-5'],advance:'reserved:S-5'});
  assert.deepStrictEqual(await closeOperationalAccount({db:advanced,uid:'u'}),{ok:false,code:'active_travel'});
  assert.ok(advanced.operations.some((x)=>x[0]==='set'&&x[1]==='account_closures/u'), 'the server-owned account fence blocks new bookings');
  assert.equal(advanced.operations.filter((x)=>x[0]==='delete').length,0,'a racing scheduler claim cannot be erased');
  const db = fakeDb({ traveler: ['completed:T-1'], operator: ['cancelled:T-2'], scheduled: ['reserved:S-1', 'reserved:S-2'] });
  assert.deepStrictEqual(await closeOperationalAccount({ db, uid: 'u', now: 123 }), { ok: true, cancelledScheduled: 2 });
  assert.deepStrictEqual(db.operations, [
    ['set', 'account_closures/u', { closingAt: 123, state: 'closing', nextCheckAt: 60123 }, { merge: true }],
    ['set', 'operators/u', { available: false, offlineAt: 123, lat: null, lng: null }, { merge: true }],
    ['delete', 'reserved:S-1'],
    ['delete', 'reserved:S-2'],
    ['delete', 'waitlist/u'],
  ]);
  const server = fs.readFileSync(require.resolve('./server'), 'utf8');
  assert.match(server, /app\.post\('\/account\/close', requireAuth,/);
  const scheduled=server.slice(server.indexOf("app.post('/travel/schedule'"),server.indexOf('// --- Who can bring a lost item back.'));
  assert.match(scheduled,/tx\.get\(db\.collection\('account_closures'\)/);
  assert.match(scheduled,/tx\.create\(ref,record\)/);
  const client = fs.readFileSync(require.resolve('../src/backend/account.ts'), 'utf8');
  assert.match(client, /Authorization: `Bearer \$\{token\}`/);
  const rules=fs.readFileSync(require.resolve('../firestore.rules'),'utf8');
  assert.match(rules,/match \/account_closures\/\{uid\} \{\s*allow read, write: if false;/);
  console.log('PASS  account closure blocks during active Travel');
  console.log('PASS  account closure cancels scheduled Travel and removes the Operator from service');
  console.log('PASS  account closure requires a Firebase identity at both ends');
})().catch((e) => { console.error(e); process.exit(1); });
