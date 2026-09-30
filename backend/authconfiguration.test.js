const assert = require('node:assert/strict');
const fs = require('node:fs');

const firebase = fs.readFileSync('src/firebase.ts','utf8');
const backendAuth = fs.readFileSync('backend/auth.js','utf8');
const eas = JSON.parse(fs.readFileSync('eas.json','utf8'));
const app = JSON.parse(fs.readFileSync('app.json','utf8'));

const project = firebase.match(/projectId:\s*'([^']+)'/)?.[1];
const sender = firebase.match(/messagingSenderId:\s*'([^']+)'/)?.[1];
const backendDefault = backendAuth.match(/FIREBASE_PROJECT_ID \|\| '([^']+)'/)?.[1];
assert.ok(project, 'Firebase projectId must be explicit');
assert.equal(backendDefault, project, 'backend token verifier default must match the app Firebase project');

const ios = eas.build?.production?.env?.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const web = eas.build?.production?.env?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
assert.ok(ios && web, 'production Google OAuth client ids must be configured');
assert.ok(ios.startsWith(sender + '-'), 'Google iOS client must belong to the Firebase/Google project sender');
assert.ok(web.startsWith(sender + '-'), 'Google web client must belong to the Firebase/Google project sender');
const schemes = (app.expo?.ios?.infoPlist?.CFBundleURLTypes || []).flatMap(x => x.CFBundleURLSchemes || []);
const iosScheme = 'com.googleusercontent.apps.' + ios.split('.apps.googleusercontent.com')[0];
assert.ok(schemes.includes(iosScheme), 'iOS Google callback scheme must match the configured iOS OAuth client');
assert.equal(app.expo?.ios?.usesAppleSignIn, true, 'iOS must declare Apple Sign In');
assert.ok((app.expo?.plugins || []).includes('expo-apple-authentication'), 'Apple authentication native plugin must be present');

const authContext = fs.readFileSync('src/state/AuthContext.tsx','utf8');
assert.match(authContext,/onAuthStateChanged\(auth/, 'app gate must be driven by Firebase auth state');
assert.match(authContext,/signInWithEmailAndPassword\(auth/, 'password sign-in must establish Firebase auth');
const google = fs.readFileSync('src/state/googleSignIn.ts','utf8');
const apple = fs.readFileSync('src/state/appleSignIn.ts','utf8');
assert.match(google,/signInWithCredential\(auth, result\.credential\)/, 'Google credential must be exchanged into Firebase');
assert.match(apple,/signInWithCredential\(auth, authResult\.credential\)/, 'Apple credential must be exchanged into Firebase');

console.log('PASS production Firebase project is coherent across app and backend');
console.log('PASS Google OAuth clients and iOS callback scheme are coherent');
console.log('PASS Apple native capability declarations are present');
console.log('PASS all three sign-in paths establish Firebase authentication in source');
console.log('NOTE live provider enablement, OAuth consent/configuration, Firebase API-key restrictions, and device callback/session persistence require live commissioning evidence');
