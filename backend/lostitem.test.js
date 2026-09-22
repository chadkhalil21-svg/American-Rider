// The case a lost item report becomes: what a specialist reads, what is refused, and the
// caps that keep a hostile body from writing a novel into the ticket.
const assert = require('node:assert');
const { lostItemTicket, stampLostItemCase, LOST_ITEM_REASON } = require('./lostitem');

const results = [];
const check = (label, ok, detail) => results.push({ label, ok: !!ok, detail });

// ---- refused ----
check('no body is refused', lostItemTicket(undefined).error === 'description is required');
check('an empty description is refused', lostItemTicket({ description: '   ' }).error === 'description is required');
check('a non-string description is refused', lostItemTicket({ description: 42 }).error === 'description is required');

// ---- a report against one travel ----
const one = lostItemTicket({
  itemId: 'abc123',
  tripNo: 'AR-2117-MIA',
  travels: ['AR-2117-MIA'],
  operators: ['Marcus Reyes'],
  description: '  Black bag, back seat  ',
  photoUrl: 'https://example.test/photo.jpg',
  trip: { no: 'AR-2117-MIA', dep: 'Miami Financial District', arr: 'Miami International Airport', totalCents: 1797 },
});
check('no error', !one.error);
check('the reason says a person carries it', one.reason === LOST_ITEM_REASON && /person carries/.test(one.reason));
check('the trip passes through as the record has it', one.trip.dep === 'Miami Financial District' && one.trip.totalCents === 1797);
check("the traveler's words are trimmed and quoted", /In the traveler's words:\nBlack bag, back seat\n/.test(one.description));
check('the travel is named', /\nTravel: AR-2117-MIA\n/.test(one.description));
check('the operator is named', /\nOperators named: Marcus Reyes\n/.test(one.description));
check('the photo is linked', /\nPhoto: https:\/\/example\.test\/photo\.jpg\n/.test(one.description));
check('the Firestore record is pointed at', /\nReport: lost_items\/abc123\n$/.test(one.description));

// ---- a report the traveler could not place ----
const unsure = lostItemTicket({
  itemId: 'def456',
  tripNo: null,
  travels: ['AR-2117-MIA', 'AR-2118-MIA', 'AR-2119-MIA'],
  operators: ['Marcus Reyes', 'Sofia R.'],
  description: 'Umbrella',
});
check('an unplaced report lists every travel', /\nTravel: not sure which — AR-2117-MIA, AR-2118-MIA, AR-2119-MIA\n/.test(unsure.description));
check('both operators are named', /\nOperators named: Marcus Reyes, Sofia R\.\n/.test(unsure.description));
check('no photo reads as none attached', /\nPhoto: none attached\n/.test(unsure.description));
check('no trip object falls back to the travel number, null here', unsure.trip.no === null && Object.keys(unsure.trip).length === 1);

// ---- the blanks ----
const bare = lostItemTicket({ description: 'Keys' });
check('no travels listed is said in words', /not sure which — no travels listed/.test(bare.description));
check('no operators is a dash', /\nOperators named: —\n/.test(bare.description));
check('no record id is a dash', /\nReport: lost_items\/—\n/.test(bare.description));

// ---- caps ----
const many = lostItemTicket({
  description: 'x'.repeat(2500),
  travels: Array.from({ length: 25 }, (_, i) => `AR-${1000 + i}-MIA`),
  operators: Array.from({ length: 25 }, (_, i) => `Op ${i}`),
});
const quoted = many.description.match(/words:\n(x+)\n/)[1];
check('the description is cut at 2000 characters', quoted.length === 2000);
check('travels are capped at 20', (many.description.match(/AR-\d{4}-MIA/g) || []).length === 20);
check('operators are capped at 20', (many.description.match(/Op \d+/g) || []).length === 20);
check('a travels value that is not a list is ignored', /no travels listed/.test(lostItemTicket({ description: 'k', travels: 'AR-1' }).description));

// ---- the case number stamped onto the report ----
const docs = { abc123: { travelerUid: 'u1', status: 'operator-notified' } };
const updates = [];
const fakeDb = {
  collection: (name) => ({
    doc: (id) => ({
      get: async () => ({ exists: name === 'lost_items' && !!docs[id], data: () => docs[id] }),
      update: async (patch) => {
        updates.push({ id, patch });
        Object.assign(docs[id], patch);
      },
    }),
  }),
};
(async () => {
  const own = await stampLostItemCase({ itemId: 'abc123', uid: 'u1', caseNo: 'AR-C-000001' }, { database: fakeDb });
  check('a traveler stamps their own report', own.ok && docs.abc123.caseNo === 'AR-C-000001');
  const other = await stampLostItemCase({ itemId: 'abc123', uid: 'u2', caseNo: 'AR-C-000002' }, { database: fakeDb });
  check("another traveler cannot stamp it", !other.ok && docs.abc123.caseNo === 'AR-C-000001');
  const missing = await stampLostItemCase({ itemId: 'nope', uid: 'u1', caseNo: 'AR-C-000003' }, { database: fakeDb });
  check('a report that does not exist is refused', !missing.ok);
  const blank = await stampLostItemCase({ itemId: 'abc123', uid: 'u1', caseNo: '' }, { database: fakeDb });
  check('no case number, no write', !blank.ok && updates.length === 1);
  const noDb = await stampLostItemCase({ itemId: 'abc123', uid: 'u1', caseNo: 'AR-C-000004' }, { database: null });
  check('no database is ok:false, never a throw', !noDb.ok);
  const broken = { collection: () => ({ doc: () => ({ get: async () => { throw new Error('offline'); } }) }) };
  const thrown = await stampLostItemCase({ itemId: 'abc123', uid: 'u1', caseNo: 'AR-C-000005' }, { database: broken });
  check('a Firestore error is ok:false, never a throw', !thrown.ok);

  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.detail ? ` — ${r.detail}` : ''}`);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  assert.strictEqual(failed.length, 0);
})();
