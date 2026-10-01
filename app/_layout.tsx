import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-mono';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { clearInitialNotificationResponse, getInitialNotificationData, onNotificationTap, onPushTokenChange, registerForPush } from '../src/backend/push';
import { pingSweep } from '../src/backend/heartbeat';
import { AuthScreen } from '../src/screens/AuthScreen';
import { AuthProvider, useAuth } from '../src/state/AuthContext';
import { LanguageProvider } from '../src/state/LanguageContext';
import { PaymentConfigProvider } from '../src/state/PaymentConfigContext';
import { OperatorProvider } from '../src/state/OperatorContext';
import { RideProvider } from '../src/state/RideContext';
import { colors } from '../src/theme';
import { auth } from '../src/firebase';

// The Stack is always mounted (so expo-router routing works). Until the user is
// signed in, the sign-up screen is shown as a full-screen overlay on top of it.
function AppGate() {
  const { user, initializing, onboarding } = useAuth();
  const router = useRouter();

  // DESIGN REVIEW BYPASS — web preview only. This never runs in native builds and is
  // inert unless the Render preview explicitly enables it. Add ?preview=app to the
  // preview URL to inspect signed-in surfaces without changing or weakening Firebase.
  const webPreviewBypass =
    Platform.OS === 'web' &&
    process.env.EXPO_PUBLIC_AUTH_PREVIEW_BYPASS === '1' &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('preview') === 'app';

  // REGISTERED ONCE THERE IS AN ACCOUNT TO REGISTER AGAINST, not at launch. The token is
  // stored on `users/{uid}`, so asking before sign-in would have nowhere to put it — and
  // asking a stranger for permission to notify them is the wrong first impression besides.
  //
  // Web has no push, and a simulator has no token; both return a reason rather than an error.
  // Nothing here blocks the app: a refusal costs notifications, not the product.
  useEffect(() => {
    if (!user || onboarding || Platform.OS === 'web') return;
    registerForPush();
    const unsubscribeToken = onPushTokenChange();
    // And wake the server on the way past. A free instance that has been idle takes about
    // thirty seconds to come up; doing it now means the first real request does not wait.
    pingSweep();
    return unsubscribeToken;
  }, [user, onboarding]);

  // Tapping a notification opens the thing it was about.
  useEffect(() => {
    if (Platform.OS === 'web' || !user || onboarding) return;
    let live = true;
    const open = (data: Record<string, unknown>) => {
      const recipientUid = typeof data?.recipientUid === 'string' ? data.recipientUid : null;
      // Fail closed for unbound/legacy notifications. An OS notification can outlive the
      // account session that received it, especially on a shared handset.
      if (!recipientUid || recipientUid !== auth.currentUser?.uid) return;
      const screen = typeof data?.screen === 'string' ? data.screen : null;
      // Notification payloads cross an external delivery boundary. Even though American Rider
      // creates them server-side, do not turn an arbitrary payload string into a router target.
      // Only destinations the server intentionally emits are navigable from a notification.
      const allowed = new Set(['/ride', '/receipt', '/operator', '/operator/insurance', '/family']);
      if (screen && allowed.has(screen)) router.navigate(screen as never);
    };

    // A listener is sufficient while JS is alive, but not for the notification response that
    // launched a terminated app. Expo explicitly exposes the last response for this cold-start
    // case. Consume it only after Firebase has restored an account so notification data cannot
    // route through authenticated surfaces underneath the sign-in overlay.
    const notificationUid = user.uid;
    void getInitialNotificationData().then(async (data) => {
      // The native response lookup is asynchronous. If account scope changed while it was
      // pending, this response belonged to the account that installed this effect—not the
      // account now on screen. Drop and consume it rather than routing it into another account.
      if (!live || !data) return;
      if (auth.currentUser?.uid !== notificationUid) {
        await clearInitialNotificationResponse();
        return;
      }
      open(data);
      await clearInitialNotificationResponse();
    });
    const unsubscribe = onNotificationTap(open);
    return () => {
      live = false;
      unsubscribe();
    };
  }, [router, user, onboarding]);

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: Platform.OS === 'web' ? 'none' : 'fade',
        }}
      />
      {initializing ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, zIndex: 10 }]} />
      ) : (!user || onboarding) && !webPreviewBypass ? (
        <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]}>
          <AuthScreen />
        </View>
      ) : null}
    </View>
  );
}

// ONE ACCOUNT'S STATE NEVER REACHES THE NEXT ACCOUNT. The stores below hold a traveler's
// live travel, operator qualification and revenue in memory. They were mounted once at the
// root and never keyed on who was signed in, so signing out and signing in as somebody else
// left all of it in place — a second Operator sharing a handset saw the first one's travel.
// Keying the subtree on the uid makes React unmount and rebuild it whenever the account
// changes, which is the only way to be sure nothing is carried across.
function AccountScope({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return <React.Fragment key={user?.uid ?? 'signed-out'}>{children}</React.Fragment>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <LanguageProvider>
    <AuthProvider>
      <AccountScope>
      <PaymentConfigProvider>
      <RideProvider>
      <OperatorProvider>
        <StatusBar style="dark" />
        {Platform.OS === 'web' ? (
          <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center' }}>
            <View
              style={{
                flex: 1,
                width: '100%',
                maxWidth: 430,
                backgroundColor: colors.bg,
                boxShadow: '0 0 32px rgba(20, 23, 31, 0.10)',
              }}
            >
              <AppGate />
            </View>
          </View>
        ) : (
          <AppGate />
        )}
      </OperatorProvider>
      </RideProvider>
      </PaymentConfigProvider>
      </AccountScope>
    </AuthProvider>
    </LanguageProvider>
  );
}
