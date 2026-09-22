// Push notifications — the thing that makes the operator loop work at all.
//
// WHAT WAS WRONG. `expo-notifications` was in package.json and imported by nothing. The
// Notifications screen had four toggles that could never fire anything, and — far worse — an
// operator on duty with the app in their pocket auto-declined every travel after fifteen
// seconds, because the only way they could learn about one was by looking at the screen. The
// platform dispatched real journeys to people who had no way of being told.
//
// WHAT IS SENT. Only what a person needs to act on or would be wrong to miss: a travel
// assigned to an operator, an operator assigned to a traveler, the operator arriving, a
// check-in question, and the completed receipt. No marketing, no "come back and ride", no
// nudges. The Notifications screen governs the optional ones and the server honours it.
//
// THE TOKEN LIVES ON `users/{uid}`, which is the one collection a person may write about
// themselves. The server reads it with admin access when it has something to say.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { t } from '../i18n';

// How a notification behaves when it lands while the app is open. Banner and list, no badge:
// a badge count on a transport app implies a queue of things to read, and there is none.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushPrefs = Record<string, boolean>;

/**
 * Ask for permission, get the token, and store it against this account.
 *
 * Returns the token, or null with the reason. NEVER throws and never blocks anything: a
 * traveler who refuses notifications gets the whole app, minus the notifications.
 *
 * A SIMULATOR HAS NO PUSH TOKEN. expo-device tells us, so a development run reports "not a
 * physical device" rather than an error that looks like a broken integration.
 */
export async function registerForPush(prefs?: PushPrefs): Promise<{
  token: string | null;
  reason: string | null;
}> {
  const uid = auth.currentUser?.uid;
  if (!uid) return { token: null, reason: t('traveler.errNotSignedIn') };
  if (!Device.isDevice) return { token: null, reason: t('traveler.errPushNeedsDevice') };

  try {
    if (Platform.OS === 'android') {
      // Android will not show anything without a channel. Created before the permission ask,
      // because the channel's importance is what decides whether it makes a sound.
      await Notifications.setNotificationChannelAsync('travel', {
        name: t('traveler.travelChannel'),
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2E5FE0',
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted || existing.ios?.status === 3; // 3 = AUTHORIZED
    if (!granted) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted || asked.ios?.status === 3;
    }
    if (!granted) return { token: null, reason: t('traveler.errNotifsOff') };

    // Passed explicitly rather than left to the default lookup — the default reads
    // Constants.expoConfig, which is absent in some build configurations, and a token request
    // that fails there fails silently at exactly the wrong moment.
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) return { token: null, reason: t('traveler.errNoProjectId') };

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return { token: null, reason: t('traveler.errNoPushToken') };

    await setDoc(
      doc(db, 'users', uid),
      {
        pushToken: token,
        pushPlatform: Platform.OS,
        pushUpdatedAt: Date.now(),
        ...(prefs ? { pushPrefs: prefs } : {}),
      },
      { merge: true },
    );
    return { token, reason: null };
  } catch (e) {
    return { token: null, reason: e instanceof Error ? e.message : t('traveler.errCouldNotRegister') };
  }
}

/** Store which notifications this account wants. The server reads this before it sends. */
export async function savePushPrefs(prefs: PushPrefs): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  try {
    await setDoc(doc(db, 'users', uid), { pushPrefs: prefs }, { merge: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Stop sending to this device.
 *
 * Called when the traveler turns everything off. The token is REMOVED rather than left with a
 * flag beside it: a token we still hold is a thing that can still be used by mistake.
 */
export async function clearPushToken(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await setDoc(doc(db, 'users', uid), { pushToken: null, pushUpdatedAt: Date.now() }, { merge: true });
  } catch {
    /* nothing to do about it, and nothing depends on it succeeding */
  }
}

/** Run `onOpen` when the person taps a notification. Returns an unsubscribe. */
export function onNotificationTap(onOpen: (data: Record<string, unknown>) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((res) => {
    onOpen((res.notification.request.content.data ?? {}) as Record<string, unknown>);
  });
  return () => sub.remove();
}
