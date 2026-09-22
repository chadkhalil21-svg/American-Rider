// Dispatch must refuse an operator whose statutory disclosure has moved on.
//
// Florida §627.748(8)(a) requires the insurance disclosure in writing before an operator
// carries anyone. Until 19 Sept 2026 it was checked in exactly one place — POST
// /operator/online, the moment somebody goes on duty — so an operator already on duty when the
// wording changed kept receiving travel under the version they had agreed to, for the rest of
// that shift. The version moved to 2026-09-18.1 and deployed the same day, which turned that
// from a latent gap into a live one.
const path = require('path');
const ROOT = __dirname;
const { matchOperator, disclosureStale } = require(path.join(ROOT, 'matching.js'));
const { DISCLOSURE_VERSION } = require(path.join(ROOT, 'disclosure.js'));

const R = [];
const check = (l, c, d) => R.push({ l, ok: !!c, d });

const PICKUP = { lat: 25.7617, lng: -80.1918 };
const base = (over = {}) => ({
  uid: 'op1', available: true, lat: 25.762, lng: -80.192,
  onlineAt: Date.now(),
  disclosureVersion: DISCLOSURE_VERSION,
  commissioned: true,
  ...over,
});

// ——— the predicate ————————————————————————————————————————————————————————————
check('current version -> not stale', !disclosureStale(base()));
check('older version -> STALE', disclosureStale(base({ disclosureVersion: '2026-08-29.1' })));
check('no version recorded -> STALE (absence is not agreement)',
  disclosureStale(base({ disclosureVersion: undefined })));
check('null -> STALE', disclosureStale(base({ disclosureVersion: null })));

// ——— the chokepoint ———————————————————————————————————————————————————————————
const current = base();
const stale = base({ uid: 'op2', disclosureVersion: '2026-08-29.1' });
const none = base({ uid: 'op3', disclosureVersion: undefined });

check('an operator on the current disclosure is dispatchable',
  !!matchOperator([current], PICKUP));
check('AN OPERATOR ON AN OLD DISCLOSURE IS NOT DISPATCHED',
  matchOperator([stale], PICKUP) === null);
check('an operator with no recorded disclosure is not dispatched',
  matchOperator([none], PICKUP) === null);

// The nearest operator must not win by being nearest when their disclosure is stale.
const nearStale = base({ uid: 'near', lat: 25.7617, lng: -80.1918, disclosureVersion: '2026-08-29.1' });
const farCurrent = base({ uid: 'far', lat: 25.80, lng: -80.25 });
const picked = matchOperator([nearStale, farCurrent], PICKUP);
check('a nearer operator on an old disclosure does not beat a further one on the current version',
  picked && picked.operator.uid === 'far', picked ? picked.operator.uid : 'none');

// And the other gates still hold — this filter must not have replaced them.
check('lapsed coverage still blocks',
  matchOperator([base({ insuranceExpiry: '2020-01-01' })], PICKUP) === null);
check('a blocked screening still blocks',
  matchOperator([base({ screeningBlocked: true })], PICKUP) === null);
check('stale presence still blocks',
  matchOperator([base({ onlineAt: 0 })], PICKUP) === null);

// ——— the record dispatch reads is written from the acknowledgement, not from the constant ——
const fs = require('fs');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
check('the fleet record stores the version the operator actually agreed to',
  /disclosureVersion: disclosure\?\.version \|\| null/.test(server));
// SCOPED TO THE HANDLER IT IS ABOUT. This was written against the whole file and started
// failing the moment the demonstration fleet was added to /travel/dispatch, which stamps the
// constant legitimately — a stand-in is not a person who agreed to anything. The rule is about
// what /operator/online records for a REAL operator, so that is what it reads.
const online = (server.match(/app\.post\('\/operator\/online'[\s\S]*?\n\}\);/) || [''])[0];
check('the /operator/online handler was found', online.length > 0);
check('it is NOT stamped from DISCLOSURE_VERSION, which would record agreement never given',
  !/disclosureVersion: DISCLOSURE_VERSION/.test(online));

// ——— POST /travel/dispatch: the server decides, the phone is told ————————————————
//
// The endpoint exists so that the operator on a travel is chosen by matchOperator above rather
// than sent up by a phone. These assertions are about the one line that matters.
const route = (server.match(/app\.post\('\/travel\/dispatch'[\s\S]*?\n\}\);/) || [''])[0];
check('POST /travel/dispatch exists', route.length > 0);
check('it requires a signed-in traveler', /app\.post\('\/travel\/dispatch', requireAuth/.test(server));
check('THE OPERATOR IS TAKEN FROM THE MATCH, never from the request body',
  /operatorId: String\(op\.id\)/.test(route) && !/operatorId: .*b\.(operatorId|operator)/.test(route));
check('it runs the shared matchOperator, so a gate added there covers this path too',
  /matchOperator\(/.test(route));
check('screening is required when a provider is live', /requireScreening: screeningReady\(\)/.test(route));
check('the traveler on the record is the authenticated one, not a body field',
  /travelerUid: String\(req\.uid\)/.test(route));
check('the pickup is stored, so the re-offer sweep can search from it',
  /pickupLat: pickup\.lat/.test(route));
check('nobody free is an ordinary answer, not an error',
  /if \(!best\) return res\.json\(\{ matched: null \}\);/.test(route));

// The demonstration fleet moved here from the phone. It must never appear with live keys.
check('stand-in operators are used only when the collection is empty',
  /if \(!fleet\.length && keyMode !== 'live'\)/.test(route));
check('stand-ins carry the CURRENT disclosure version, so they pass the same gate',
  /disclosureVersion: DISCLOSURE_VERSION/.test(route));

let bad = 0;
for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  — ' + (r.d || '')}`); }
console.log(`\n${R.length - bad}/${R.length} passed`);
process.exit(bad ? 1 : 0);
