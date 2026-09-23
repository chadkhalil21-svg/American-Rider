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
const operational = context.indexOf('await closeOperationalAccount();');
const profile = context.indexOf("await deleteDoc(doc(db, 'users', u.uid));");
const login = context.indexOf('await deleteUser(u);');
assert(recent >= 0 && recent < operational && operational < profile && profile < login);

const apple = fs.readFileSync(require.resolve('../src/state/appleSignIn.ts'), 'utf8');
const google = fs.readFileSync(require.resolve('../src/state/googleSignIn.ts'), 'utf8');
assert.match(apple, /reauthenticateWithCredential\(user, authResult\.credential\)/);
assert.match(google, /reauthenticateWithCredential\(user, result\.credential\)/);

console.log('PASS  account deletion selects Password, Apple, and Google credentials');
console.log('PASS  cancellation remains a failure');
console.log('PASS  recent authentication precedes operational closure and every deletion');