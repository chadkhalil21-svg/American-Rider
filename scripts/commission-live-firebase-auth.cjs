const fs = require('node:fs');

const source = fs.readFileSync('src/firebase.ts', 'utf8');
const apiKey = source.match(/apiKey:\s*['"]([^'"]+)['"]/)?.[1];
if (!apiKey) throw new Error('firebase-api-key-not-found');

const base = 'https://identitytoolkit.googleapis.com/v1/accounts';
const stamp = `${Date.now()}-${process.env.GITHUB_RUN_ID || 'local'}`;
const email = `american-rider-commissioning+${stamp}@example.com`;
const password = `ARc!${stamp}Z9-safe-password`.slice(0, 64);
let idToken = null;
let refreshToken = null;

async function call(path, body) {
  const res = await fetch(`${base}:${path}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {'content-type':'application/json'},
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${data?.error?.message || `HTTP_${res.status}`}`);
  return data;
}

async function refresh(token) {
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {'content-type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({grant_type:'refresh_token', refresh_token:token}).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`refresh: ${data?.error?.message || `HTTP_${res.status}`}`);
  return data;
}

(async () => {
  try {
    const created = await call('signUp', {email, password, returnSecureToken:true});
    if (!created.localId || !created.idToken || !created.refreshToken) throw new Error('signUp: incomplete-auth-result');
    idToken = created.idToken;
    refreshToken = created.refreshToken;
    console.log('PASS create account');

    const looked = await call('lookup', {idToken});
    if (looked.users?.[0]?.localId !== created.localId) throw new Error('lookup: created-user-not-found');
    console.log('PASS authenticated user lookup');

    const refreshed = await refresh(refreshToken);
    if (!refreshed.id_token || !refreshed.refresh_token || refreshed.user_id !== created.localId) {
      throw new Error('refresh: incomplete-session-result');
    }
    idToken = refreshed.id_token;
    refreshToken = refreshed.refresh_token;
    console.log('PASS refresh-token session continuation');

    const signed = await call('signInWithPassword', {email, password, returnSecureToken:true});
    if (signed.localId !== created.localId || !signed.idToken || !signed.refreshToken) {
      throw new Error('signInWithPassword: account/session mismatch');
    }
    idToken = signed.idToken;
    console.log('PASS sign out/sign in equivalent credential round-trip');

    let rejected = false;
    try { await call('signInWithPassword', {email, password: password + '-wrong', returnSecureToken:true}); }
    catch { rejected = true; }
    if (!rejected) throw new Error('wrong-password: unexpectedly accepted');
    console.log('PASS wrong password rejected');

    await call('delete', {idToken});
    idToken = null;
    console.log('PASS cleanup');
    console.log('LIVE_FIREBASE_AUTH_COMMISSIONING=PASS');
  } catch (e) {
    console.error('LIVE_FIREBASE_AUTH_COMMISSIONING=FAIL');
    console.error(String(e?.message || e));
    if (idToken) {
      try { await call('delete', {idToken}); console.log('CLEANUP delete PASS'); } catch {}
    }
    process.exitCode = 1;
  }
})();