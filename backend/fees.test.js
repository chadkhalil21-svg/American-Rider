// Government per-travel fees: geofenced, per end, pass-through.
//
// What it holds to: a fee applies inside its box and nowhere else; a pickup fee is charged for
// a pickup there and not for a drop-off there; the airport and the port are two boxes, and a
// travel from one to the other pays the fee of the end it starts at; a missing or malformed
// coordinate earns no fee; every fee names a payee, an instrument and a region that exists.
const path = require('path');
const F = require(path.join(__dirname, 'fees.js'));
const { regionById, inRegion } = require(path.join(__dirname, 'regions.js'));

const results = [];
const check = (l, ok, d) => results.push({ l, ok: !!ok, d });

const MIA_KERB = { lat: 25.7953, lng: -80.2789 }; // the terminal kerb
const MIA_STATION = { lat: 25.7979, lng: -80.2587 }; // the Metrorail station, east of LeJeune Road
const BLUE_LAGOON = { lat: 25.7805, lng: -80.285 }; // hotels south of the airfield
const PORT_TERMINAL = { lat: 25.7753, lng: -80.168 }; // a cruise terminal on Dodge Island
const BAYSIDE = { lat: 25.7781, lng: -80.1866 }; // across the channel, downtown
const BRICKELL = { lat: 25.7617, lng: -80.1918 };
const SOUTH_BEACH = { lat: 25.7826, lng: -80.1341 };

const ids = (lines) => lines.map((l) => `${l.id}@${l.end}`).join(',');

// --- the airport -------------------------------------------------------------------------------
const fromMia = F.governmentFeesFor(MIA_KERB, BRICKELL);
check('a pickup at the airport kerb carries the airport fee', ids(fromMia) === 'mia-tnc-pickup@pickup', ids(fromMia));
check('  $2.00, to the Miami-Dade Aviation Department, named for what it is',
  fromMia[0] && fromMia[0].cents === 200 && fromMia[0].payee === 'Miami-Dade Aviation Department' && fromMia[0].name === 'Miami International Airport fee', JSON.stringify(fromMia[0]));
check('a drop-off at the airport carries nothing: the fee is per pickup', F.governmentFeesFor(BRICKELL, MIA_KERB).length === 0);
check('the Metrorail station east of LeJeune Road is not the airport', F.governmentFeesFor(MIA_STATION, BRICKELL).length === 0);
check('the hotels south of the airfield are not the airport', F.governmentFeesFor(BLUE_LAGOON, BRICKELL).length === 0);

// --- the port ------------------------------------------------------------------------------------
const fromPort = F.governmentFeesFor(PORT_TERMINAL, BRICKELL);
check('a pickup at a cruise terminal carries the port fee', ids(fromPort) === 'portmiami-tnc-pickup@pickup', ids(fromPort));
check('  $2.00, to the Miami-Dade Seaport Department', fromPort[0] && fromPort[0].cents === 200 && fromPort[0].payee === 'Miami-Dade Seaport Department');
check('a drop-off at the port carries nothing', F.governmentFeesFor(BRICKELL, PORT_TERMINAL).length === 0);
check('Bayside, across the channel, is not the port', F.governmentFeesFor(BAYSIDE, SOUTH_BEACH).length === 0);

// --- both ends ------------------------------------------------------------------------------------
check('airport to port pays the airport fee only', ids(F.governmentFeesFor(MIA_KERB, PORT_TERMINAL)) === 'mia-tnc-pickup@pickup');
check('port to airport pays the port fee only', ids(F.governmentFeesFor(PORT_TERMINAL, MIA_KERB)) === 'portmiami-tnc-pickup@pickup');
check('an ordinary travel pays no government fee', F.governmentFeesFor(BRICKELL, SOUTH_BEACH).length === 0 && F.governmentFeeCents(BRICKELL, SOUTH_BEACH) === 0);
check('governmentFeeCents is the sum of the lines', F.governmentFeeCents(MIA_KERB, BRICKELL) === 200 && F.governmentFeeCents(PORT_TERMINAL, MIA_KERB) === 200);

// --- a missing end ---------------------------------------------------------------------------------
check('a reservation that knows only its pickup is fenced on the pickup', ids(F.governmentFeesFor(MIA_KERB, null)) === 'mia-tnc-pickup@pickup');
check('no pickup, no fee', F.governmentFeesFor(null, MIA_KERB).length === 0 && F.governmentFeesFor(undefined, undefined).length === 0);
check('malformed coordinates earn nothing', F.governmentFeesFor({ lat: NaN, lng: -80.28 }, BRICKELL).length === 0 &&
  F.governmentFeesFor({ lat: '25.7953', lng: '-80.2789' }, BRICKELL).length === 0 && F.governmentFeesFor({}, BRICKELL).length === 0);

// --- drop-off and both-end fees, on a registry of the test's own -------------------------------------
const BOX = { latMin: 30, latMax: 31, lngMin: -98, lngMax: -97 };
const IN = { lat: 30.5, lng: -97.5 };
const OUT = { lat: 29, lng: -97.5 };
const synthetic = [
  { id: 'x-drop', name: 'X drop-off fee', payee: 'X', cents: 150, applies: 'dropoff', bbox: BOX },
  { id: 'y-both', name: 'Y fee', payee: 'Y', cents: 100, applies: 'both', bbox: BOX },
];
check('a drop-off fee is charged for a drop-off inside its box', ids(F.governmentFeesFor(OUT, IN, synthetic)) === 'x-drop@dropoff,y-both@dropoff');
check('  and not for a pickup there', ids(F.governmentFeesFor(IN, OUT, synthetic)) === 'y-both@pickup');
check('a fee that applies to both ends is one line per end for a travel that starts and ends inside',
  ids(F.governmentFeesFor(IN, IN, synthetic)) === 'x-drop@dropoff,y-both@pickup,y-both@dropoff' && F.governmentFeeCents(IN, IN, synthetic) === 350);
check('outside the box, nothing', F.governmentFeesFor(OUT, OUT, synthetic).length === 0);

// --- the registry ---------------------------------------------------------------------------------------
check('the registry has no problems', F.registryProblems().length === 0, F.registryProblems().join('; '));
check('two fees today, both in fl-southeast', F.feesForRegion('fl-southeast').length === 2 && F.GOVERNMENT_FEES.length === 2);
check('every fee\'s box lies inside its region\'s box', F.GOVERNMENT_FEES.every((f) => {
  const r = regionById(f.region);
  return r && inRegion(r, { lat: f.bbox.latMin, lng: f.bbox.lngMin }) && inRegion(r, { lat: f.bbox.latMax, lng: f.bbox.lngMax });
}));
check('every fee names its instrument and the OSM object its box came from', F.GOVERNMENT_FEES.every((f) => /\(\d{1,2} \w{3} \d{4}\)/.test(f.source) && /^(way|relation)\/\d+$/.test(f.osm)));
check('the airport box is the aerodrome way; the port box is the industrial relation', F.feeById('mia-tnc-pickup').osm === 'way/113657169' && F.feeById('portmiami-tnc-pickup').osm === 'relation/2168371');
check('an unknown id is null', F.feeById('sfo-tnc-pickup') === null);
check('the records are frozen', Object.isFrozen(F.GOVERNMENT_FEES) && F.GOVERNMENT_FEES.every((f) => Object.isFrozen(f)));
check('a duplicate id, an unknown region, a zero fee are reported', F.registryProblems([
  { id: 'a', region: 'fl-southeast', cents: 200, applies: 'pickup', source: 's' },
  { id: 'a', region: 'nowhere', cents: 0, applies: 'sometimes', source: '' },
]).length === 5, F.registryProblems([{ id: 'a', region: 'fl-southeast', cents: 200, applies: 'pickup', source: 's' }, { id: 'a', region: 'nowhere', cents: 0, applies: 'sometimes', source: '' }]).join('; '));
check('names and payees are plain: no exclamation, no reassurance', F.GOVERNMENT_FEES.every((f) => !/!|no hidden|don't worry|sorry/i.test(`${f.name} ${f.payee}`)));

let bad = 0;
for (const r of results) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  <-- ' + (r.d || '')}`); }
console.log(`\n${results.length - bad}/${results.length} passed`);
process.exit(bad ? 1 : 0);
