const fs = require('node:fs');
const assert = require('node:assert/strict');

const app = JSON.parse(fs.readFileSync('app.json','utf8')).expo;
const push = fs.readFileSync('src/backend/push.ts','utf8');
const presence = fs.readFileSync('src/backend/presence.ts','utf8');
const authContext = fs.readFileSync('src/state/AuthContext.tsx','utf8');

assert.equal(app.ios.usesAppleSignIn, true);
assert.ok(app.plugins.includes('expo-apple-authentication'));
assert.ok(app.plugins.some(p => Array.isArray(p) && p[0] === 'expo-notifications'));
assert.ok(app.ios.infoPlist.UIBackgroundModes.includes('remote-notification'));
assert.ok(app.ios.infoPlist.UIBackgroundModes.includes('location'));
assert.ok(app.plugins.some(p => Array.isArray(p) && p[0] === 'expo-location' && p[1]?.isIosBackgroundLocationEnabled === true));

assert.match(push,/Notifications\.IosAuthorizationStatus\.PROVISIONAL/);
assert.match(push,/Notifications\.IosAuthorizationStatus\.EPHEMERAL/);
assert.doesNotMatch(push,/ios\?\.status\s*===\s*3/);
assert.match(push,/getExpoPushTokenAsync\(\{ projectId \}\)/);
assert.match(push,/pushToken: token/);

assert.match(presence,/TaskManager\.defineTask\(PRESENCE_TASK/);
assert.match(presence,/requestBackgroundPermissionsAsync\(\)/);
assert.match(presence,/startLocationUpdatesAsync\(PRESENCE_TASK/);
assert.match(presence,/pausesUpdatesAutomatically: false/);
assert.match(presence,/showsBackgroundLocationIndicator: true/);

assert.match(authContext,/import \{ clearPushToken \} from '\.\.\/backend\/push';/);
const signOutBody = authContext.slice(authContext.indexOf('signOut: () =>'), authContext.indexOf('onboarding,', authContext.indexOf('signOut: () =>')));
assert.ok(signOutBody.indexOf('await clearPushToken()') >= 0, 'sign-out must detach this device from the departing account');
assert.ok(signOutBody.indexOf('await clearPushToken()') < signOutBody.indexOf('await fbSignOut(auth)'), 'push token must be detached while the departing Firebase identity is still available');

console.log('PASS native permission, push and background-presence configuration invariants');
