// The planner was withdrawn. Neither the public name nor its legacy alias may call Anthropic.
// National place discovery must not be coupled to the old static Miami assistant list.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const routeBody = (route) => {
  const marker = `app.post('${route}', requireAuth,`;
  const start = server.indexOf(marker);
  assert.ok(start >= 0, `${route} remains explicitly registered for old clients`);
  const end = server.indexOf('\n});', start);
  assert.ok(end > start, `${route} handler is delimited`);
  return server.slice(start, end + 4);
};
for (const route of ['/assistant', '/assistant-withdrawn-original']) {
  assert.match(routeBody(route), /res\.status\(410\)\.json\(/, `${route} must be gone`);
}
assert.doesNotMatch(server, /\bplanTrip\s*\(/, 'no backend route may call the withdrawn paid model');
assert.doesNotMatch(server, /const\s*\{\s*planTrip\s*\}\s*=\s*require/, 'no hidden assistant import');
console.log('PASS both withdrawn assistant endpoints fail closed and no model call remains');
