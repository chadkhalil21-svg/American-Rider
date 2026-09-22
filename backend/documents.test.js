// The document standard, case by case.
//
// The model reports what it sees; decide() alone says what that means. That split is the whole
// design — a policy about who may carry passengers must be reviewable, testable and identical
// for everybody, and swapping the model must not be able to change it. So the rules get tests
// and the model does not.
const path = require('path');
const ROOT = __dirname;
for (const [rel, exports] of [['./env.js', { readKey: () => '' }]]) {
  const p = require.resolve(path.join(ROOT, rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports, children: [], paths: [] };
}
const { decide, KINDS } = require(path.join(ROOT, 'documents.js'));

const now = Date.parse('2026-08-27T12:00:00Z');
const future = '2028-01-31';
const past = '2025-06-30';

const read = (o = {}) => ({
  documentType: 'driver licence',
  isTheRequestedDocument: true,
  legible: true,
  concerns: [],
  summary: '',
  ...o,
  fields: {
    name: 'Chad Dia', number: 'D123-456', expiry: future, state: 'FL',
    vehicle: '', plate: '', commercialUse: '', limits: '',
    ...(o.fields || {}),
  },
});
const run = (kind, r, expect = {}) =>
  decide({ kind, spec: KINDS[kind], read: r, expect, now });

const R = [];
const check = (l, c, d) => R.push({ l, ok: !!c, d });

// ---- accepted ----------------------------------------------------------------------------
check('a clean, current licence is accepted', run('license', read()).verdict === 'accept');
check('a name differing only by middle name is accepted',
  run('license', read({ fields: { name: 'Chad Khalil Dia' } }), { name: 'Chad Dia' }).verdict === 'accept');
// A real declarations page states its limits; the fixture must too, or it is not testing an
// acceptable document.
const goodInsurance = { commercialUse: 'yes', expiry: future, limits: '$1,000,000 CSL' };
check('commercial insurance in force is accepted',
  run('insurance', read({ fields: goodInsurance })).verdict === 'accept');
check('insurance with no readable limits is held',
  run('insurance', read({ fields: { ...goodInsurance, limits: '' } })).verdict === 'review');

// ---- refused -----------------------------------------------------------------------------
check('an expired licence is refused',
  run('license', read({ fields: { expiry: past } })).verdict === 'refuse');
check('expired insurance is refused',
  run('insurance', read({ fields: { expiry: past, commercialUse: 'yes' } })).verdict === 'refuse');
check('a personal-use policy is refused',
  run('insurance', read({ fields: { commercialUse: 'no', expiry: future } })).verdict === 'refuse');
check('the wrong document is refused, not accepted',
  run('inspection', read({ isTheRequestedDocument: false, documentType: 'insurance card' })).verdict === 'refuse');
check('  and it names what was actually sent',
  /insurance card/.test(run('inspection', read({ isTheRequestedDocument: false, documentType: 'insurance card' })).reasons.join(' ')));

// ---- held for a person -------------------------------------------------------------------
check('an unreadable image is held, never accepted',
  run('license', read({ legible: false })).verdict === 'review');
check('a missing expiry is held, never accepted',
  run('license', read({ fields: { expiry: '' } })).verdict === 'review');
check('an unreadable expiry is held',
  run('license', read({ fields: { expiry: 'sometime in 2027' } })).verdict === 'review');
check('a surname mismatch is held',
  run('license', read({ fields: { name: 'Chad Rivera' } }), { name: 'Chad Dia' }).verdict === 'review');
check('a plate that is not the vehicle on file is held',
  run('registration', read({ fields: { plate: 'XYZ 999', expiry: future } }), { plate: 'KTR 4821' }).verdict === 'review');
check('a concern raised by the reader is held',
  run('license', read({ concerns: ['The date of birth appears to have been altered.'] })).verdict === 'review');
check('  and the concern is carried through verbatim',
  /altered/.test(run('license', read({ concerns: ['The date of birth appears to have been altered.'] })).reasons.join(' ')));
check('insurance whose use is unclear is held, not refused',
  run('insurance', read({ fields: { commercialUse: 'unclear', expiry: future, limits: '$1m' } })).verdict === 'review');

// ---- the thing that must never happen ----------------------------------------------------
const mustNotAccept = [
  ['expired', run('license', read({ fields: { expiry: past } }))],
  ['illegible', run('license', read({ legible: false }))],
  ['no expiry', run('license', read({ fields: { expiry: '' } }))],
  ['wrong document', run('license', read({ isTheRequestedDocument: false }))],
  ['personal-use insurance', run('insurance', read({ fields: { commercialUse: 'no', expiry: future } }))],
  ['insurance of unknown cover', run('insurance', read({ fields: { commercialUse: 'unclear', expiry: future, limits: '$1m' } }))],
  ['insurance with no limits', run('insurance', read({ fields: { commercialUse: 'yes', expiry: future, limits: '' } }))],
  ['name mismatch', run('license', read({ fields: { name: 'Someone Else' } }), { name: 'Chad Dia' })],
];
check('NOTHING questionable is ever accepted',
  mustNotAccept.every(([, v]) => v.verdict !== 'accept'),
  mustNotAccept.filter(([, v]) => v.verdict === 'accept').map(([l]) => l).join(', '));
check('every refusal and review states a reason',
  mustNotAccept.every(([, v]) => v.reasons.length > 0));

let bad = 0;
for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  <-- ' + (r.d || '')}`); }
console.log(`\n${R.length - bad}/${R.length} passed`);
process.exit(bad ? 1 : 0);
