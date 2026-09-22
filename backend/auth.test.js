// The token must carry the email, not just the uid.
//
// WHY THIS EXISTS. verifyIdToken decoded a Firebase token, verified it, and returned
// `payload.sub` alone — discarding the email one line before the return. Twelve places read
// `req.email`; all twelve got undefined. The Travel Receipt had no recipient and never sent,
// Stripe's own receipt was never requested, every Stripe customer was created without an
// address, and every support case was filed without one to reply to.
//
// Nothing failed loudly. /health reported receipts "on" because the key and the from-address
// were configured. This test asserts the shape of what verification returns, so the link cannot
// be dropped again by a refactor that only looks at the uid.
const jwt = require('jsonwebtoken');
const { generateKeyPairSync, X509Certificate } = require('crypto');
const path = require('path');

const results = [];
const check = (l, ok, d) => results.push({ l, ok: !!ok, d });

// A self-signed cert so we can mint a token this module will actually verify.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const forge = require('crypto');
// Build a minimal cert by hand is awkward; instead stub getCerts by intercepting the fetch the
// module makes for Google's public certs, and hand it a cert wrapping our public key.
const selfSigned = require('child_process').execSync(
  `openssl req -x509 -newkey rsa:2048 -keyout /tmp/ar-k.pem -out /tmp/ar-c.pem -days 1 -nodes -subj "/CN=test" 2>/dev/null && cat /tmp/ar-c.pem`,
).toString();
const key = require('fs').readFileSync('/tmp/ar-k.pem', 'utf8');
const KID = 'testkid';

global.fetch = async (url) => {
  if (String(url).includes('googleapis.com/robot')) {
    return { ok: true, json: async () => ({ [KID]: selfSigned }) };
  }
  throw new Error('unexpected fetch: ' + url);
};

const { verifyIdToken, requireAuth } = require(path.join(__dirname, 'auth.js'));

const mint = (claims) =>
  jwt.sign(
    {
      aud: 'american-rider',
      iss: 'https://securetoken.google.com/american-rider',
      sub: 'uid-123',
      exp: Math.floor(Date.now() / 1000) + 600,
      iat: Math.floor(Date.now() / 1000),
      ...claims,
    },
    key,
    { algorithm: 'RS256', keyid: KID },
  );

(async () => {
  const who = await verifyIdToken(mint({ email: 'traveler@example.com', email_verified: true }));
  check('the uid comes back', who.uid === 'uid-123', JSON.stringify(who));
  check('THE EMAIL COMES BACK — receipts have no recipient without it',
    who.email === 'traveler@example.com', JSON.stringify(who));
  check('verified flag comes back', who.emailVerified === true);

  const anon = await verifyIdToken(mint({ sub: 'uid-anon' }));
  check('an account with no email yields an empty string, never undefined',
    anon.email === '', JSON.stringify(anon.email));

  // requireAuth must put both on the request, because that is what server.js reads.
  const req = { headers: { authorization: 'Bearer ' + mint({ email: 'a@b.co', email_verified: false }) } };
  let nexted = false;
  await requireAuth(req, { status: () => ({ json: () => {} }) }, () => { nexted = true; });
  check('requireAuth sets req.uid', nexted && req.uid === 'uid-123', req.uid);
  check('requireAuth sets req.email', req.email === 'a@b.co', req.email);

  // A forged token must still be refused.
  let refused = 0;
  const badReq = { headers: { authorization: 'Bearer not.a.token' } };
  await requireAuth(badReq, { status: () => ({ json: () => { refused++; } }) }, () => {});
  check('a malformed token is still refused', refused === 1 && badReq.uid === undefined);

  let bad = 0;
  for (const r of results) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  <-- ' + (r.d || '')}`); }
  console.log(`\n${results.length - bad}/${results.length} passed`);
  process.exit(bad ? 1 : 0);
})();
