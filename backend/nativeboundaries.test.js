const fs = require('node:fs');
const assert = require('node:assert/strict');

const app = JSON.parse(fs.readFileSync('app.json','utf8')).expo;
const push = fs.readFileSync('src/backend/push.ts','utf8');
const presence = fs.readFileSync('src/backend/presence.ts','utf8');
const authContext = fs.readFileSync('src/state/AuthContext.tsx','utf8');
const layout = fs.readFileSync('app/_layout.tsx','utf8');
const authScreen = fs.readFileSync('src/screens/AuthScreen.tsx','utf8');

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
assert.match(push,/auth\.currentUser\?\.uid !== uid/, 'push registration must reject an account switch while native token acquisition is pending');
assert.match(push,/if \(auth\.currentUser\?\.uid !== uid\) return false;/, 'push preference write must reject a stale account identity');
assert.match(push,/pushToken: token/);
assert.match(push,/Notifications\.addPushTokenListener/, 'runtime token rotation must be observed');
assert.match(push,/const responseId = res\.notification\.request\.identifier/, 'notification response replay must have a stable deduplication key');
assert.match(push,/responseId === lastResponseId/, 'duplicate notification responses must not navigate twice');
assert.match(push,/void registerForPush\(\)/, 'a rotated native token must refresh the Expo token stored for this account');

assert.match(presence,/TaskManager\.defineTask\(PRESENCE_TASK/);
assert.match(presence,/requestBackgroundPermissionsAsync\(\)/);
assert.match(presence,/getForegroundPermissionsAsync\(\)/, 'registered presence must re-check current foreground authorization');
assert.match(presence,/getBackgroundPermissionsAsync\(\)/, 'registered presence must re-check current background authorization');
assert.match(presence,/Location\.stopLocationUpdatesAsync\(PRESENCE_TASK\)\.catch/, 'revoked permission must retire stale background task registration');
assert.match(presence,/startLocationUpdatesAsync\(PRESENCE_TASK/);
assert.match(presence,/pausesUpdatesAutomatically: false/);
assert.match(presence,/showsBackgroundLocationIndicator: true/);

assert.match(authContext,/import \{ clearPushToken \} from '\.\.\/backend\/push';/);
assert.match(authContext,/import \{ stopBackgroundPresence \} from '\.\.\/backend\/presence';/);
assert.match(authContext,/const ONBOARDING_KEY = 'ar:auth-onboarding'/, 'interrupted signup must have durable account-bound state');
assert.match(authContext,/AsyncStorage\.setItem\(ONBOARDING_KEY, cred\.user\.uid\)/, 'signup gate must be persisted after Firebase assigns the UID');
assert.match(authContext,/const created = auth\.currentUser;/, 'signup failure path must detect an account that Firebase already created');
assert.match(authContext,/AsyncStorage\.setItem\(ONBOARDING_KEY, created\.uid\)/, 'partially completed account creation must remain behind durable onboarding');
assert.match(authContext,/await AsyncStorage\.getItem\(ONBOARDING_KEY\)/, 'Firebase restoration must restore interrupted onboarding state');
assert.match(authScreen,/if \(user && onboarding\) setStep\('select'\)/, 'interrupted signup must resume at role selection rather than restart authentication');
const signOutBody = authContext.slice(authContext.indexOf('signOut: () =>'), authContext.indexOf('onboarding,', authContext.indexOf('signOut: () =>')));
assert.ok(signOutBody.indexOf('await stopBackgroundPresence()') >= 0, 'sign-out must stop the OS background location task');
assert.ok(signOutBody.indexOf('await clearPushToken()') >= 0, 'sign-out must detach this device from the departing account');
assert.ok(signOutBody.indexOf('await clearPushToken()') < signOutBody.indexOf('await fbSignOut(auth)'), 'push token must be detached while the departing Firebase identity is still available');
const deleteBody = authContext.slice(authContext.indexOf('deleteAccount: (reauthenticate)'), authContext.indexOf('// THE DEVICE IS CLEARED BEFORE THE SESSION ENDS'));
assert.ok(deleteBody.indexOf('await closeOperationalAccount()') >= 0, 'deletion must close server-side operations');
assert.ok(deleteBody.indexOf('await stopBackgroundPresence()') > deleteBody.indexOf('await closeOperationalAccount()'), 'deletion must stop native presence after server-side operations are closed');
assert.ok(deleteBody.indexOf('await stopBackgroundPresence()') < deleteBody.indexOf('await deleteUser(u)'), 'native background task must stop before Firebase identity deletion');

assert.match(push,/getLastNotificationResponseAsync\(\)/, 'cold-start notification response must be recoverable');
assert.match(push,/clearLastNotificationResponseAsync\(\)/, 'consumed cold-start response must be cleared');
assert.match(layout,/getInitialNotificationData\(\)/, 'root navigation must inspect the notification that launched a terminated app');
assert.match(layout,/const notificationUid = user\.uid/, 'cold-start response must bind to the account that installed the effect');
assert.match(layout,/auth\.currentUser\?\.uid !== notificationUid/, 'cold-start response must be dropped after an account switch');
assert.match(layout,/new Set\(\['\/ride', '\/receipt', '\/operator', '\/operator\/insurance', '\/family'\]\)/, 'notification navigation must be restricted to server-emitted destinations');
assert.match(layout,/allowed\.has\(screen\)/, 'notification payload must not be used as an unrestricted router target');
assert.match(layout,/Platform\.OS === 'web' \|\| !user \|\| onboarding/, 'notification routing must wait for authenticated account restoration');
assert.match(layout,/const unsubscribeToken = onPushTokenChange\(\)/, 'authenticated app lifecycle must subscribe to push token rotation');
assert.match(layout,/return unsubscribeToken/, 'push token listener must be removed when account scope changes');


assert.ok(pushServer.includes('recipientUid: String(uid)'), 'server push payload is bound to its intended account');
assert.ok(layout.includes("recipientUid !== auth.currentUser?.uid"), 'native notification routing rejects a payload for another account');
assert.ok(layout.includes('if (!recipientUid'), 'legacy/unbound notification payloads fail closed');
assert.ok(server.includes("app.post('/push/register', requireAuth"), 'push token registration is authenticated server authority');
assert.ok(server.includes("collection('push_token_owners')"), 'server maintains unique token-owner index');
assert.ok(server.includes("previousUid !== uid"), 'registering a token to a new account evicts its previous account binding');
assert.ok(pushClient.includes('/push/register') && pushClient.includes('/push/clear'), 'native client uses server token ownership endpoints');
assert.ok(!rules.includes("'pushToken', 'pushPlatform', 'pushUpdatedAt', 'pushPrefs'"), 'clients cannot directly bypass server token ownership');
assert.ok(pushServer.includes('dropToken(uid, expectedToken = null)'), 'push retirement is ownership-aware and reusable');
assert.ok(pushServer.includes('if (expectedToken && token !== String(expectedToken)) return'), 'stale DeviceNotRegistered response cannot erase a newer token');
assert.ok(pushServer.includes("tx.delete(ownerRef)"), 'provider invalidation retires the token-owner index');
assert.ok(authContext.includes('await clearPushToken();') && authContext.indexOf('await clearPushToken();') < authContext.indexOf('await deleteDoc'), 'account deletion retires push ownership before deleting the user profile');
assert.ok(server.includes('previousToken && previousToken !== token'), 'same-account push token rotation retires the previous owner index');
assert.ok(server.includes('WRITE PHASE — no transaction reads below this point'), 'push registration separates Firestore transaction reads from writes');
assert.ok(pushServer.includes('expectedToken = null, strict = false'), 'push retirement supports strict deletion cleanup without making ordinary sign-out blocking');
assert.ok(server.includes('dropToken(String(req.uid), null, true)'), 'server account closure fails closed through strict push ownership retirement');
assert.ok(server.includes("push: perAccount({ name: 'push'"), 'push ownership mutations are rate limited per authenticated account');
assert.ok(server.includes('ExponentPushToken|ExpoPushToken'), 'server rejects arbitrary strings as push ownership keys');
assert.ok(server.includes("['ios','android'].includes(platform)"), 'push registration only accepts supported native platforms');
assert.ok(server.includes("new Set(['enroute','arrived','complete'])"), 'push registration bounds preferences to the real notification schema');
assert.ok(server.includes("app.post('/push/register', requireAuth, LIMITS.push"), 'push registration applies authenticated rate limiting');
console.log('PASS native permission, push and background-presence configuration invariants');
