const fs = require('fs');

const source = fs.readFileSync('src/firebase.ts', 'utf8');
const match = source.match(/apiKey:\s*['"]([^'"]+)['"]/);
if (!match) throw new Error('firebase-api-key-not-found');
const apiKey = match[1];
const base = 'https://identitytoolkit.googleapis.com/v1/accounts';
const stamp = `${Date.now()}-${process.env.GITHUB_RUN_ID || 'local'}`;
const email = `american-rider-commissioning+${stamp}@example.com`;
const password = `ARc!${stamp}Z9`.slice(0, 48);
let idToken = null;

async function call(path, body) {
  const res = await fetch(`${base}:${path}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {'content-type':'application/json'},
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data?.error?.message || `HTTP_${res.status}`;
    throw new Error(`${path}: ${code}`);
  }
  return data;
}

(async () => {
  try {
    const created = await call('signUp', {email, password, returnSecureToken:true});
    idToken = created.idToken;
    if (!created.localId || !idToken) throw new Error('signUp: missing-auth-result');
    console.log('PASS signUp');

    const signed = await call('signInWithPassword', {email, password, returnSecureToken:true});
    idToken = signed.idToken;
    if (!signed.localId || !idToken) throw new Error('signInWithPassword: missing-auth-result');
    console.log('PASS signInWithPassword');

    const looked = await call('lookup', {idToken});
    if (!Array.isArray(looked.users) || looked.users.length !== 1) throw new Error('lookup: user-not-found');
    console.log('PASS lookup');

    await call('delete', {idToken});
    idToken = null;
    console.log('PASS delete');
    console.log('LIVE_FIREBASE_AUTH_COMMISSIONING=PASS');
  } catch (e) {
    console.error('LIVE_FIREBASE_AUTH_COMMISSIONING=FAIL');
    console.error(String(e && e.message ? e.message : e));
    if (idToken) {
      try { await call('delete', {idToken}); console.log('CLEANUP delete PASS'); }
      catch (cleanup) { console.error('CLEANUP delete FAIL'); }
    }
    process.exitCode = 1;
  }
})();