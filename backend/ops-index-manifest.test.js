// Source index manifest is necessary but not sufficient: production indexes must also
// be deployed and reach READY/Enabled in Firebase before the Operations board is certified.
const assert = require('node:assert/strict');
const { indexes } = require('../firestore.indexes.json');
const { firestore } = require('../firebase.json');
assert.equal(firestore.indexes, 'firestore.indexes.json',
  'Firebase must read the committed index manifest');

const expected = [
  ['support_tickets', [['status', 'ASCENDING'], ['createdAt', 'DESCENDING']]],
  ['scheduled_rides', [['status', 'ASCENDING'], ['atMs', 'ASCENDING']]],
  ['support_tickets', [['status', 'ASCENDING'], ['kind', 'ASCENDING'],
    ['createdAt', 'ASCENDING'], ['__name__', 'ASCENDING']]],
];
const hasIndex = (collection, fields) => indexes.some((index) =>
  index.collectionGroup === collection && index.queryScope === 'COLLECTION'
  && fields.every(([path, order], i) => index.fields[i]?.fieldPath === path
    && index.fields[i]?.order === order));

for (const [collection, fields] of expected) {
  assert(hasIndex(collection, fields), `Missing Operations composite index: ${collection} ${JSON.stringify(fields)}`);
}
console.log('PASS Operations source indexes are declared; live Firebase index readiness still needs separate commissioning');
