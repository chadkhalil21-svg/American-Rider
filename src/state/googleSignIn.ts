// Continue with Google — the credential, and what Firebase does with it.
//
// SETUP THIS NEEDS, and cannot do for itself: an OAuth client id from the Google Cloud
// project behind Firebase (project `american-rider`), and Google enabled as a sign-in
// provider in the Firebase console. The ids are public values, not secrets — they identify
// the app to Google and are visible in any built binary — so they live in app config rather
// than in a server .env. Set them as EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID and
// EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.
//
// WHY THE BUTTON IS HIDDEN WHEN THEY ARE ABSENT. A "Continue with Google" that cannot
// complete is a control named after something it does not do, which the rubric forbids, and
// a placeholder feature on the front door, which App Review guideline 2.1 rejects. Offered
// only when it can actually be served.
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { GoogleAuthProvider, reauthenticateWithCredential, signInWithCredential } from 'firebase/auth';

import { auth } from '../firebase';

// Completes the browser session when the traveler returns to the app.
WebBrowser.maybeCompleteAuthSession();

export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

/**
 * True only when this build carries the id THIS PLATFORM needs.
 *
 * PER PLATFORM, NOT "EITHER ONE". It was `!!(ios || web)`, and the moment the iOS id was
 * configured on its own the control rendered on web too — where expo-auth-session requires
 * `webClientId` and throws without it. The throw happened during render, inside a hook, so it
 * did not fail politely: it took the entire sign-in screen down and left a blank page. The one
 * screen that must never break is the one somebody has to get through to reach the app.
 *
 * Found 19 Sept 2026 by running it. The old expression was true for a build that could not
 * serve the control, which is the same class of fault as offering a button that does nothing —
 * it just failed harder.
 */
export const googleSignInConfigured =
  Platform.OS === 'web' ? !!GOOGLE_WEB_CLIENT_ID : !!GOOGLE_IOS_CLIENT_ID;

// `reason` is a CODE, never a sentence — see appleSignIn.ts.
export type GoogleResult = { ok: true } | { ok: false; cancelled: boolean; reason?: string };

/**
 * The hook form is what expo-auth-session provides: it must be created during render, and
 * `promptAsync` is what the button calls. Returns { request, signIn } so a screen can hide
 * the control until Google is genuinely ready to answer.
 */
export function useGoogleSignIn() {
  // `webClientId`, NOT `clientId`. expo-auth-session's Google provider takes the id per
  // platform and validates that the current one is present; `clientId` is not the web key and
  // does not satisfy it. That mismatch is what threw.
  //
  // NO redirectUri. It used to force `americanrider://`, built from our own app scheme, and
  // Google refused the whole request: "Access blocked: Authorization Error ... doesn't comply
  // with Google's OAuth 2.0 policy", Error 400 invalid_request. A Google iOS client will only
  // redirect to the scheme derived from its OWN client id —
  // com.googleusercontent.apps.<client-id> — and an app scheme of our choosing is not it.
  //
  // The provider computes the right value for each platform from the id it was given, which is
  // the reason it takes the ids per platform in the first place. Passing our own overrode that
  // with something Google was never going to honour. The matching scheme is registered in
  // app.json so iOS hands the callback back to us.
  //
  // Found 19 Sept 2026 by pressing the button. It was flagged as the one thing a simulator
  // could not answer; it turned out a simulator could answer it perfectly well.
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
  });

  const googleCredential = async (): Promise<
    | { ok: true; credential: ReturnType<typeof GoogleAuthProvider.credential> }
    | { ok: false; cancelled: boolean; reason?: string }
  > => {
    if (!googleSignInConfigured) {
      return { ok: false, cancelled: false, reason: 'not_configured' };
    }
    try {
      const result = await promptAsync();
      if (result.type === 'cancel' || result.type === 'dismiss') {
        return { ok: false, cancelled: true };
      }
      if (result.type !== 'success') {
        return { ok: false, cancelled: false, reason: `google_${result.type}` };
      }
      const idToken = result.params?.id_token;
      if (!idToken) return { ok: false, cancelled: false, reason: 'no_identity_token' };
      return { ok: true, credential: GoogleAuthProvider.credential(idToken) };
    } catch (e: unknown) {
      return { ok: false, cancelled: false, reason: (e as Error)?.message };
    }
  };

  const signIn = async (): Promise<GoogleResult> => {
    const result = await googleCredential();
    if (!result.ok) return result;
    try {
      await signInWithCredential(auth, result.credential);
      return { ok: true };
    } catch (e: unknown) {
      return { ok: false, cancelled: false, reason: (e as Error)?.message };
    }
  };

  const reauthenticate = async (): Promise<GoogleResult> => {
    const user = auth.currentUser;
    if (!user) return { ok: false, cancelled: false, reason: 'no_current_user' };
    const result = await googleCredential();
    if (!result.ok) return result;
    try {
      await reauthenticateWithCredential(user, result.credential);
      return { ok: true };
    } catch (e: unknown) {
      return { ok: false, cancelled: false, reason: (e as Error)?.message };
    }
  };

  return { ready: !!request && googleSignInConfigured, signIn, reauthenticate, response };
}
