// The government-fee ledger, proven against a stub database.
//
// What it holds to: only completed rides owe a fee; the month is the region's calendar month
// in the region's own time zone; a ride stamped with fee lines is summed from them and a ride
// without the stamp is fenced again from its pickup; junk lines are dropped; the query, not
// the code, selects the period.
const path = require('path');
const M = require(path.join(__dirname, 'remittance.js'));

const R = [];
const check = (l, ok, d) => R.push({ l, ok: !!ok, d });
const iso = (ms) => new Date(ms).toISOString();

// --- the calendar --------------------------------------------------------------------------------
const sept = M.monthRange(2026, 9, 'America/New_York');
check('September 2026 in Miami runs from 1 Sept 00:00 EDT to 1 Oct 00:00 EDT',
  iso(sept.from) === '2026-09-01T04:00:00.000Z' && iso(sept.to) === '2026-10-01T04:00:00.000Z', `${iso(sept.from)} → ${iso(sept.to)}`);
const nov = M.monthRange(2026, 11, 'America/New_York');
check('November 2026 starts on daylight time and ends on standard time',
  iso(nov.from) === '2026-11-01T04:00:00.000Z' && iso(nov.to) === '2026-12-01T05:00:00.000Z', `${iso(nov.from)} → ${iso(nov.to)}`);
const mar = M.monthRange(2026, 3, 'America/New_York');
check('March 2026 the other way round', iso(mar.from) === '2026-03-01T05:00:00.000Z' && iso(mar.to) === '2026-04-01T04:00:00.000Z', `${iso(mar.from)} → ${iso(mar.to)}`);
const dec = M.monthRange(2026, 12, 'America/New_York');
check('December rolls into the next year', iso(dec.to) === '2027-01-01T05:00:00.000Z', iso(dec.to));
const chicago = M.monthRange(2026, 9, 'America/Chicago');
check('another zone, another hour', iso(chicago.from) === '2026-09-01T05:00:00.000Z');
let threw = false;
try { M.monthRange(2026, 13, 'America/New_York'); } catch { threw = true; }
check('a month that does not exist throws', threw);

// --- a stub of Firestore's query surface -------------------------------------------------------
const MIA_KERB = { lat: 25.7953, lng: -80.2789 };
const t = (day, hour = 12) => Date.parse(`2026-09-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00-04:00`);
const MIA = { id: 'mia-tnc-pickup', name: 'Miami International Airport fee', payee: 'Miami-Dade Aviation Department', cents: 200, end: 'pickup' };
const PORT = { id: 'portmiami-tnc-pickup', name: 'PortMiami fee', payee: 'Miami-Dade Seaport Department', cents: 200, end: 'pickup' };
const RIDES = [
  { id: 'r1', status: 'completed', completedAt: t(5), feeLines: [MIA], costCents: 2450 },
  { id: 'r2', status: 'completed', completedAt: t(20), feeLines: [PORT], costCents: 1190 },
  { id: 'r3', status: 'completed', completedAt: t(10), pickupLat: MIA_KERB.lat, pickupLng: MIA_KERB.lng, costCents: 2450 }, // paid before the stamp existed
  { id: 'r4', status: 'cancelled', completedAt: t(12), feeLines: [MIA] }, // nobody was picked up
  { id: 'r5', status: 'completed', completedAt: t(15), feeLines: [], costCents: 980 },
  { id: 'r6', status: 'completed', completedAt: Date.parse('2026-10-02T12:00:00-04:00'), feeLines: [MIA] }, // next month
  { id: 'r7', status: 'completed', completedAt: t(30, 23), feeLines: [{ ...MIA, cents: 'two dollars' }, { id: 'x', cents: 200 }] }, // junk lines
  { id: 'r8', status: 'completed', completedAt: t(1, 0), feeLines: [MIA, PORT] }, // the first second of the month
];
function stubDb(rides) {
  const queries = [];
  return {
    queries,
    collection(name) {
      const where = [];
      const q = {
        where(field, op, value) { where.push([field, op, value]); return q; },
        async get() {
          queries.push({ name, where });
          const docs = rides
            .filter((r) => where.every(([f, op, v]) => (op === '>=' ? r[f] >= v : op === '<' ? r[f] < v : true)))
            .map((r) => ({ id: r.id, data: () => r }));
          return { docs };
        },
      };
      return q;
    },
  };
}

(async () => {
  const db = stubDb(RIDES);
  const ledger = await M.remittanceLedger({ db, from: sept.from, to: sept.to });
  check('the period is selected by the query, on completedAt, half-open',
    db.queries.length === 1 && db.queries[0].name === 'rides' && JSON.stringify(db.queries[0].where) === JSON.stringify([['completedAt', '>=', sept.from], ['completedAt', '<', sept.to]]), JSON.stringify(db.queries));
  check('completed rides in the month are counted; the cancelled one and next month\'s are not', ledger.rides === 6, ledger.rides);
  check('rides that carried a fee', ledger.feeRides === 4, ledger.feeRides);
  check('the total is every valid fee line, in cents', ledger.totalCents === 1000, ledger.totalCents);
  const aviation = ledger.payees.find((p) => p.payee === 'Miami-Dade Aviation Department');
  const seaport = ledger.payees.find((p) => p.payee === 'Miami-Dade Seaport Department');
  check('the Aviation Department is owed three pickups, one of them re-fenced from coordinates', aviation && aviation.cents === 600 && aviation.count === 3, JSON.stringify(aviation));
  check('the Seaport Department is owed two', seaport && seaport.cents === 400 && seaport.count === 2, JSON.stringify(seaport));
  check('payees are sorted by name, each with its fees by id', ledger.payees.map((p) => p.payee).join('|') === 'Miami-Dade Aviation Department|Miami-Dade Seaport Department' &&
    aviation.fees.length === 1 && aviation.fees[0].id === 'mia-tnc-pickup' && aviation.fees[0].count === 3 && aviation.fees[0].name === 'Miami International Airport fee', JSON.stringify(ledger.payees));
  check('junk lines are dropped, not summed', !JSON.stringify(ledger).includes('"x"') && ledger.totalCents === 1000);
  check('the range is reported back in milliseconds', ledger.from === sept.from && ledger.to === sept.to);

  const scoped = await M.remittanceLedger({ db, from: sept.from, to: sept.to, regionId: 'fl-southeast' });
  check('scoped to the region the fees belong to, the ledger is the same', scoped.totalCents === 1000);
  const elsewhere = await M.remittanceLedger({ db, from: sept.from, to: sept.to, regionId: 'tx-north' });
  check('scoped to a region with no fees, nothing is owed and the rides still count', elsewhere.totalCents === 0 && elsewhere.feeRides === 0 && elsewhere.rides === 6);

  const monthly = await M.monthlyRemittance({ db, year: 2026, month: 9 });
  check('the monthly ledger runs one region over its own calendar month',
    monthly.year === 2026 && monthly.month === 9 && monthly.regions.length === 1 && monthly.regions[0].region === 'fl-southeast' &&
      monthly.regions[0].timezone === 'America/New_York' && monthly.regions[0].from === sept.from && monthly.regions[0].to === sept.to && monthly.regions[0].totalCents === 1000, JSON.stringify(monthly).slice(0, 200));

  check('a ride\'s own lines are used when present', M.linesForRide({ feeLines: [PORT] }).length === 1 && M.linesForRide({ feeLines: [PORT] })[0].id === 'portmiami-tnc-pickup');
  check('a ride without lines is fenced from pickupLat/pickupLng', M.linesForRide({ pickupLat: MIA_KERB.lat, pickupLng: MIA_KERB.lng })[0].id === 'mia-tnc-pickup');
  check('  or from a pickup object', M.linesForRide({ pickup: MIA_KERB })[0].id === 'mia-tnc-pickup');
  check('  and a ride with no coordinates at all earns nothing — never 0,0', M.linesForRide({}).length === 0 && M.linesForRide({ pickupLat: null, pickupLng: null }).length === 0);

  let bad = 0;
  try { await M.remittanceLedger({ db, from: sept.to, to: sept.from }); } catch { bad = -1; }
  check('a range that ends before it starts throws', bad === -1);
  bad = 0;
  for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  <-- ' + (r.d || '')}`); }
  console.log(`\n${R.length - bad}/${R.length} passed`);
  process.exit(bad ? 1 : 0);
})().catch((e) => {
  console.error('FAIL  the test file itself threw:', e);
  process.exit(1);
});
