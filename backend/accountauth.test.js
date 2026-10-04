const assert = require('assert');
const fs = require('fs');
const ts = require('typescript');

const source = fs.readFileSync(require.resolve('../src/state/accountDeletion.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, loaded, loaded.exports);
const { accountAuthProvider, providerResultError } = loaded.exports;

assert.strictEqual(accountAuthProvider(['password']), 'password');
assert.strictEqual(accountAuthProvider(['apple.com']), 'apple');
assert.strictEqual(accountAuthProvider(['google.com']), 'google');
assert.strictEqual(accountAuthProvider(['password', 'google.com']), 'google');
assert.strictEqual(accountAuthProvider(['password', 'google.com', 'apple.com']), 'apple');
assert.strictEqual(
  accountAuthProvider(['password', 'google.com', 'apple.com'], { apple: false, google: true }),
  'google',
);
assert.strictEqual(
  accountAuthProvider(['password', 'google.com'], { apple: false, google: false }),
  'password',
);
assert.strictEqual(accountAuthProvider([]), 'unsupported');
assert.strictEqual(providerResultError({ ok: false, cancelled: true }).code, 'auth/reauthentication-cancelled');
assert.strictEqual(providerResultError({ ok: false }).code, 'auth/invalid-credential');

const context = fs.readFileSync(require.resolve('../src/state/AuthContext.tsx'), 'utf8');
const recent = context.indexOf('await reauthenticate();');
const serverRequest = context.indexOf('await deleteAccountOnServer();');
const deviceClear = context.indexOf('await clearAllStorage();', serverRequest);
assert(recent >= 0 && recent < serverRequest && serverRequest < deviceClear);
const accountClient = fs.readFileSync(require.resolve('../src/backend/account.ts'), 'utf8');
assert.match(accountClient,/auth\.currentUser\?\.getIdToken\(true\)/,'send a freshly refreshed Firebase token');
const finalizer = fs.readFileSync(require.resolve('./accountdeletion'), 'utf8');
assert(finalizer.indexOf('await auth.deleteUser(uid)') < finalizer.indexOf("await db.collection('users').doc(uid).delete()"),
  'the server removes Auth before it tries to remove the profile');
assert.doesNotMatch(context,/deleteDoc\(doc\(db, 'users', u\.uid\)\)/,'the phone must not erase a live-login profile');

const apple = fs.readFileSync(require.resolve('../src/state/appleSignIn.ts'), 'utf8');
const google = fs.readFileSync(require.resolve('../src/state/googleSignIn.ts'), 'utf8');
assert.match(apple, /reauthenticateWithCredential\(user, authResult\.credential\)/);
assert.match(google, /reauthenticateWithCredential\(user, result\.credential\)/);

console.log('PASS  account deletion selects Password, Apple, and Google credentials');
console.log('PASS  cancellation remains a failure');
console.log('PASS  recent authentication precedes server-owned Auth-first deletion and device cleanup');
