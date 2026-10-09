const assert = require('node:assert/strict');
const express = require('express');
const cors = require('cors');
const { sameOrigin, corsOptionsFor } = require('./cors-policy');

(async () => {
  const allowed = new Set(['https://americanrider.app', 'https://www.americanrider.app']);
  const app = express();
  // Simulate the single trusted Render HTTPS proxy in front of Express.
  app.set('trust proxy', 1);
  app.use(cors(corsOptionsFor(true, allowed)));
  app.get('/ops', (req, res) => res.status(200).send('Operations sign-in'));
  app.post('/ops/enter', (req, res) => res.status(200).send('POST reached Operations'));
  app.use((err, req, res, next) => res.status(403).send(err.message));

  const server = await new Promise((resolve) => {
    const started = app.listen(0, '127.0.0.1', () => resolve(started));
  });
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const own = `https://127.0.0.1:${server.address().port}`;
    const request = (path, origin, method = 'POST') => fetch(url + path, {
      method,
      headers: {
        ...(origin === undefined ? {} : { Origin: origin }),
        'X-Forwarded-Proto': 'https',
      },
    });

    let response = await request('/ops/enter', own);
    assert.equal(response.status, 200, 'same-origin HTTPS Operations POST must reach login handler');
    assert.equal(response.headers.get('access-control-allow-origin'), own);

    response = await request('/ops', own, 'GET');
    assert.equal(response.status, 200, 'same-origin Operations GET must be permitted');

    response = await request('/ops/enter', 'https://americanrider.app');
    assert.equal(response.status, 200, 'approved public web origin remains permitted');

    for (const bad of [
      'https://unauthorized.example',
      own + '.attacker.example',
      'http://127.0.0.1:' + server.address().port,
      'null',
    ]) {
      response = await request('/ops/enter', bad);
      assert.equal(response.status, 403, `unapproved cross-origin request ${bad} must be refused`);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
    }

    response = await request('/ops/enter', undefined);
    assert.equal(response.status, 200, 'requests without a browser Origin remain permitted');

    const simulated = { protocol: 'https', get: () => 'american-rider-server-3d7x.onrender.com' };
    assert.equal(sameOrigin(simulated, 'https://american-rider-server-3d7x.onrender.com'), true);
    assert.equal(sameOrigin(simulated, 'https://attacker.example'), false);

    const permissive = corsOptionsFor(false, allowed);
    permissive(simulated, (err, opts) => {
      assert.ifError(err);
      opts.origin('https://local-development.example', (error, accepted) => {
        assert.ifError(error);
        assert.equal(accepted, true, 'development permits local tooling');
      });
    });
    console.log('PASS Operations CORS: own-origin POST/GET, public origins, malicious origins, and development');
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
