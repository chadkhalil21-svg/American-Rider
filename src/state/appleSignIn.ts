// Continue with Apple — the credential, and what Firebase does with it.
//
// WHY THIS IS ITS OWN FILE. Apple hands back the traveler's name exactly once, on the very
// first authorization, and never again. Firebase stores no name unless we write it in that
// moment, so an account created here and named later reads "Not recorded" on every receipt.
// Keeping the whole exchange in one place is what makes that rule visible.
//
// SETUP THIS NEEDS, and cannot do for itself:
//   1. "Sign In with Apple" enabled on the bundle id com.americanrider.app, in Apple's
//      developer portal. That is Chad's Individual membership; nobody else can enable it.
//   2. Apple enabled as a sign-in provider in the Firebase console, with the Services ID,
//      Team ID, Key ID and the .p8 key.
//   3. `npx expo prebuild -p ios` after the plugin was added to app.json, or the native
//      entitlement is absent and every call fails at the system sheet.
// Until 1 and 2 exist the button is offered only where the device says it can serve it, and
// a failure is reported as what it is rather than as the traveler's mistake.
import * as AppleAuthentication from 'expo-apple-authentication';
import { OAuthProvider, signInWithCredential, updateProfile } from 'firebase/auth';
import { Platform } from 'react-native';

import { auth } from '../firebase';

/** Whether this device can serve the Apple sheet at all. False on Android and on web. */
export async function appleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

// `reason` is a CODE, never a sentence: nothing renders it, and the screen shows a
// translated line of its own. A sentence here would be English on a Spanish phone the day
// somebody decided to display it.
export type AppleResult = { ok: true } | { ok: false; cancelled: boolean; reason?: string };

/**
 * Run the Apple sheet and sign the traveler in to Firebase with what it returns.
 *
 * A cancel is not an error and must not be reported as one — the traveler chose to stop.
 */
export async function signInWithApple(): Promise<AppleResult> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'ERR_REQUEST_CANCELED') return { ok: false, cancelled: true };
    return { ok: false, cancelled: false, reason: (e as Error)?.message };
  }

  if (!credential.identityToken) {
    return { ok: false, cancelled: false, reason: 'no_identity_token' };
  }

  try {
    const provider = new OAuthProvider('apple.com');
    const firebaseCredential = provider.credential({
      idToken: credential.identityToken,
      // Apple's nonce is inside the identity token; Firebase verifies it there.
    });
    const result = await signInWithCredential(auth, firebaseCredential);

    // THE ONE CHANCE AT THE NAME. Apple sends fullName only on the first authorization for
    // this app; on every later sign-in it is null, by design. If we do not record it now it
    // is gone, and a receipt that should say who drove and who rode says nobody.
    const given = credential.fullName?.givenName?.trim() ?? '';
    const family = credential.fullName?.familyName?.trim() ?? '';
    const full = [given, family].filter(Boolean).join(' ');
    if (full && !result.user.displayName) {
      await updateProfile(result.user, { displayName: full }).catch(() => {
        // The account exists and is signed in; a missing name is recoverable in Profile.
      });
    }
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, cancelled: false, reason: (e as Error)?.message };
  }
}
