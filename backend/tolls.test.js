const assert = require('node:assert/strict');
const { parseHereTolls } = require('./tolls');

const clear = parseHereTolls({ routes:[{ sections:[{}] }] });
assert.deepEqual(clear, { status:'clear', tollCents:0, provider:'here' });

const tolled = parseHereTolls({ routes:[{ sections:[
  { tolls:[{ fares:[{ id:'a', price:{ value:1.75, currency:'USD' } }] }] },
  { tolls:[{ fares:[{ id:'a', price:{ value:1.75, currency:'USD' } }, { id:'b', convertedPrice:{ value:0.5, currency:'USD' } }] }] },
] }] });
assert.equal(tolled.status,'tolled');
assert.equal(tolled.tollCents,225,'duplicate fare ids count once');

const unavailable = parseHereTolls({ routes:[{ sections:[{ notices:[{ code:'tollsDataUnavailable' }] }] }] });
assert.equal(unavailable.status,'unknown');
assert.equal(unavailable.tollCents,null);

const unpriced = parseHereTolls({ routes:[{ sections:[{ tolls:[{ fares:[{ id:'x' }] }] }] }] });
assert.equal(unpriced.status,'unknown');

const fs=require('node:fs'), path=require('node:path');
const authority=fs.readFileSync(path.join(__dirname,'fareauthority.js'),'utf8');
const server=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
assert.ok(authority.includes('resolveTolls(body.pickup, body.dest)'),'fare authority resolves tolls server-side');
assert.ok(server.includes("code: 'toll_unavailable'"),'Travel paths expose fail-closed toll state');
assert.ok(!/req\.body[^\n]*tollCents/.test(server),'client toll amount is never authoritative');
console.log('all toll-authority tests passed');
