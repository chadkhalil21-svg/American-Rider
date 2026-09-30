const fs = require('node:fs');
const assert = require('node:assert/strict');

for (const path of ['src/state/googleSignIn.ts', 'src/state/appleSignIn.ts']) {
  const src = fs.readFileSync(path, 'utf8');
  assert.match(src, /function safeAuthReason\(e: unknown\): string/);
  assert.match(src, /typeof code === 'string' && code\.length <= 100 \? code : 'auth\/unknown'/);
  assert.doesNotMatch(src, /reason: \(e as Error\)\?\.message/,
    path + ' must never propagate arbitrary provider error messages');
  assert.match(src, /signInWithCredential\(auth,/,
    path + ' must exchange the provider credential into Firebase Auth');
}
const google = fs.readFileSync('src/state/googleSignIn.ts','utf8');
assert.match(google, /result\.type === 'cancel' \|\| result\.type === 'dismiss'/);
assert.match(google, /reason: 'no_identity_token'/);
const apple = fs.readFileSync('src/state/appleSignIn.ts','utf8');
assert.match(apple, /code === 'ERR_REQUEST_CANCELED'/);
assert.match(apple, /reason: 'no_identity_token'/);
console.log('provider auth failure-state invariants: PASS');

const appleNonce = fs.readFileSync('src/state/appleSignIn.ts','utf8');
assert.match(appleNonce, /Crypto\.getRandomBytes\(length\)/, 'Apple sign-in must use a cryptographically random nonce');
assert.match(appleNonce, /CryptoDigestAlgorithm\.SHA256, rawNonce/, 'Apple must receive the SHA-256 nonce');
assert.match(appleNonce, /nonce: hashedNonce/, 'Apple request must be bound to the hashed nonce');
assert.match(appleNonce, /idToken: apple\.identityToken, rawNonce/, 'Firebase credential must receive the original raw nonce');
console.log('Apple nonce binding invariants: PASS');

// Native-production contract: Google credential acquisition must not regress to the
// generic browser/AuthSession helper. Expo's production guidance uses a native Google
// sign-in module; Firebase then accepts the resulting ID token via GoogleAuthProvider.
const googleNative = fs.readFileSync('src/state/googleSignIn.ts','utf8');
assert.doesNotMatch(googleNative, /expo-auth-session\/providers\/google/,
  'production Google sign-in must use a native provider integration, not generic AuthSession');
console.log('Google native credential-acquisition invariant: PASS');
