'use strict';
const assert = require('node:assert/strict');
const { normalize, summarize } = require('./firestore-index-commission.cjs');
const manifest = require('../firestore.indexes.json');
assert.equal(manifest.indexes.length, 14, 'unexpected production index manifest size');
for (const index of manifest.indexes) {
  assert(index.collectionGroup && index.queryScope, 'index must have collection group and query scope');
  assert(index.fields.length > 0, 'index must have fields');
  assert(normalize(index).includes(index.collectionGroup));
  assert(summarize(index).includes(index.collectionGroup));
}
const source = {
  collectionGroup: 'support_tickets',
  queryScope: 'COLLECTION',
  fields: [{fieldPath:'status',order:'ASCENDING'},
           {fieldPath:'createdAt',order:'DESCENDING'}],
};
const live = {
  name:'projects/american-rider-35688/databases/(default)/collectionGroups/support_tickets/indexes/abcdef',
  queryScope: 'COLLECTION',
  state:'READY',
  fields: [...source.fields, {fieldPath:'__name__',order:'DESCENDING'}],
};
assert.equal(normalize(source), normalize(live), 'FireStore adds default trailing __name__ field');
assert.notEqual(normalize(source), normalize({
  ...live,fields:[{fieldPath:'status',order:'ASCENDING'},
                  {fieldPath:'createdAt',order:'ASCENDING'},
                  {fieldPath:'__name__',order:'ASCENDING'}],
}), 'descending and ascending indexes are not interchangeable');
assert.equal(normalize({
  ...source,fields:[...source.fields,{fieldPath:'__name__',order:'ASCENDING'}],
}) === normalize(live), false, 'non-default __name__ sort should remain distinct');
console.log('PASS Firestore commissioner source definitions and implicit key order');
