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
import { onNotificationTap, registerForPush } from '../src/backend/push';
import { pingSweep } from '../src/backend/heartbeat';
import { AuthScreen } from '../src/screens/AuthScreen';
import { AuthProvider, useAuth } from '../src/state/AuthContext';
import { LanguageProvider } from '../src/state/LanguageContext';
import { PaymentConfigProvider } from '../src/state/PaymentConfigContext';
import { OperatorProvider } from '../src/state/OperatorContext';
import { RideProvider } from '../src/state/RideContext';
import { colors } from '../src/theme';

// The Stack is always mounted (so expo-router routing works). Until the user is
// signed in, the sign-up screen is shown as a full-screen overlay on top of it.
function AppGate() {
  const { user, initializing, onboarding } = useAuth();
  const router = useRouter();

  // REGISTERED ONCE THERE IS AN ACCOUNT TO REGISTER AGAINST, not at launch. The token is
  // stored on `users/{uid}`, so asking before sign-in would have nowhere to put it — and
  // asking a stranger for permission to notify them is the wrong first impression besides.
  //
  // Web has no push, and a simulator has no token; both return a reason rather than an error.
  // Nothing here blocks the app: a refusal costs notifications, not the product.
  useEffect(() => {
    if (!user || onboarding || Platform.OS === 'web') return;
    registerForPush();
    // And wake the server on the way past. A free instance that has been idle takes about
    // thirty seconds to come up; doing it now means the first real request does not wait.
    pingSweep();
  }, [user, onboarding]);

  // Tapping a notification opens the thing it was about.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    return onNotificationTap((data) => {
      const screen = typeof data?.screen === 'string' ? data.screen : null;
      if (screen) router.navigate(screen as never);
    });
  }, [router]);

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
      ) : !user || onboarding ? (
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
