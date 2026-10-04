const assert = require('node:assert/strict');
const { normalizeSuggestion, searchPlaces } = require('./place-search');

(async () => {
  const x = normalizeSuggestion({ id:'x', title:'Dadeland Mall', resultType:'place', position:{lat:25.69,lng:-80.31}, address:{label:'7535 N Kendall Dr, Miami, FL'} });
  assert.equal(x.title, 'Dadeland Mall'); assert.equal(x.category, 'place'); assert.equal(x.lat,25.69);
  assert.equal(normalizeSuggestion({title:'bad'}), null);
  assert.deepEqual(await searchPlaces('', null), []);
  assert.deepEqual(await searchPlaces('a', {lat:25,lng:-80}), []);
  const old=process.env.HERE_API_KEY; delete process.env.HERE_API_KEY;
  assert.deepEqual(await searchPlaces('Dadeland', {lat:25.69,lng:-80.31}), []);
  if(old) process.env.HERE_API_KEY=old;
  console.log('place-search tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
