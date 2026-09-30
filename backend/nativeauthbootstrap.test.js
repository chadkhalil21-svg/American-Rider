const fs = require('node:fs');
const assert = require('node:assert/strict');
const firebase = fs.readFileSync('src/firebase.ts', 'utf8');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));

assert.equal(app.expo.ios.infoPlist.CFBundleDisplayName, 'American');
assert.ok(firebase.includes("projectId: 'american-rider-35688'"));
assert.ok(firebase.includes("import * as fbAuth from 'firebase/auth'"));
assert.ok(firebase.includes('getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence'));
assert.ok(firebase.includes("typeof getReactNativePersistence !== 'function'"));
assert.ok(firebase.includes("code: 'firebase/native-persistence-unavailable'"));
assert.ok(firebase.includes('persistence: getReactNativePersistence(AsyncStorage)'));
assert.ok(firebase.includes("code === 'auth/already-initialized'"));
assert.ok(!firebase.includes("Platform.OS === 'web' || !getReactNativePersistence"));
assert.ok(!firebase.includes('getRNPersistence'));
console.log('native auth bootstrap invariants: PASS');
