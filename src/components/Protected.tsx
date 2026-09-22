// Protected — the second lock on the money screens (Adrian, 11 Aug 2026).
//
// ⚠️ CURRENTLY UNUSED. Chad removed the lock from the Wallet, Revenue, and Withdrawal
// screens on 11 Aug because of the friction it added. This file is kept intact and
// working so it can be switched back on in one line per screen — wrap the screen in
// <Protected title="…">. Worth revisiting before real money moves through Withdrawal:
// re-add NSFaceIDUsageDescription to app.json at the same time (Apple requires that
// string whenever Face ID is used).
//
// WHY THIS EXISTS: the phone's own Face ID only guards a LOCKED phone. The real theft
// case is a phone snatched while it is unlocked, or one whose passcode the thief watched
// being typed. Banks answer that with a second authentication INSIDE the app; this is
// ours. It guards the traveler's Wallet and — the genuinely valuable target — the
// operator's Revenue and Withdrawal screens, which move real money.
//
// HOW IT BEHAVES
//  · Entering a protected screen asks for Face ID / Touch ID / Android biometrics.
//  · No biometrics enrolled? The system falls back to the device passcode by itself.
//  · A device with NO passcode at all has nothing to fall back to, so we let the person
//    through rather than locking them out of their own money — and say so plainly.
//  · Leaving the app re-locks it: come back after 60 seconds and it asks again, so a
//    thief who grabs an unlocked phone cannot simply re-open the app.
//  · The traveler can switch this off in Settings → Security & Face ID. It defaults ON,
//    because a money screen should be protected before anyone thinks to protect it.
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './AppText';
import { useLanguage } from '../state/LanguageContext';
import { colors } from '../theme';
import { Card, LetterheadBar, Screen, SectionLabel, Title } from './UI';
import { useGoBack } from './nav';

export const BIOMETRIC_KEY = 'ar:require-biometrics:v1';
/** Re-lock after this long in the background — long enough to answer a text, short
 *  enough that a stolen phone cannot be re-opened straight into the money. */
const RELOCK_AFTER_MS = 60_000;

/** Is the second lock switched on? Defaults ON when the traveler has never chosen. */
export async function biometricsRequired(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(BIOMETRIC_KEY);
    return raw === null ? true : raw === 'yes';
  } catch {
    return true; // storage unreadable — protect by default, never fail open
  }
}

export async function setBiometricsRequired(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(BIOMETRIC_KEY, on ? 'yes' : 'no');
  } catch {
    // a failed preference write leaves the safer default in place
  }
}

type State = 'checking' | 'locked' | 'open';

export function Protected({
  title,
  children,
}: {
  /** What is being protected, named in the system prompt ("Unlock your Wallet"). */
  title: string;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  const goBack = useGoBack();
  const [state, setState] = useState<State>('checking');
  const [noDeviceSecurity, setNoDeviceSecurity] = useState(false);
  const leftAt = useRef<number | null>(null);

  const attempt = useCallback(async () => {
    if (!(await biometricsRequired())) {
      setState('open');
      return;
    }
    // A device with no passcode and no biometrics has no way to prove it is you.
    // Locking would strand a real operator out of their own revenue, so we open and
    // tell them why — the honest failure, not the impressive-looking one.
    const hasHardware = await LocalAuthentication.hasHardwareAsync().catch(() => false);
    const enrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
    const level = await LocalAuthentication.getEnrolledLevelAsync().catch(
      () => LocalAuthentication.SecurityLevel.NONE,
    );
    if ((!hasHardware || !enrolled) && level === LocalAuthentication.SecurityLevel.NONE) {
      setNoDeviceSecurity(true);
      setState('open');
      return;
    }
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: title,
      cancelLabel: 'Cancel',
      // false = let the system offer the device passcode when a face isn't recognised.
      disableDeviceFallback: false,
    }).catch(() => ({ success: false }) as LocalAuthentication.LocalAuthenticationResult);
    setState(res.success ? 'open' : 'locked');
  }, [title]);

  useEffect(() => {
    attempt();
  }, [attempt]);

  // Re-lock when the app has been away long enough.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        leftAt.current = Date.now();
        return;
      }
      if (next === 'active' && leftAt.current) {
        const away = Date.now() - leftAt.current;
        leftAt.current = null;
        if (away > RELOCK_AFTER_MS) {
          setState('checking');
          attempt();
        }
      }
    });
    return () => sub.remove();
  }, [attempt]);

  if (state === 'open') {
    return (
      <View style={{ flex: 1 }}>
        {children}
        {/* Sits over the screen as the demo's own notice pill, so it never displaces
            the letterhead header. */}
        {noDeviceSecurity && <NoSecurityNotice />}
      </View>
    );
  }

  // Locked and checking share one calm screen — no alarm language, no red.
  return (
    <Screen>
      <LetterheadBar onBack={goBack} />
      <Title>{title}</Title>
      <SectionLabel style={{ marginTop: 26, marginBottom: 12 }}>{t('traveler.protectedLabel')}</SectionLabel>
      <Card style={styles.card}>
        <Text style={styles.body}>
          {state === 'checking'
            ? t('traveler.confirmingItIsYou')
            : t('traveler.screenHoldsMoney')}
        </Text>
        {state === 'locked' && (
          <Pressable
            onPress={attempt}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.86 }]}
          >
            <Text style={styles.btnText}>{t('traveler.unlock')}</Text>
          </Pressable>
        )}
      </Card>
    </Screen>
  );
}

/** Shown over an opened screen when the device itself has no lock at all. */
function NoSecurityNotice() {
  const { t } = useLanguage();
  return (
    <View style={styles.notice} pointerEvents="none">
      <Text style={styles.noticeText}>
        {t('traveler.noPasscode')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 20, paddingHorizontal: 20 },
  body: { fontSize: 14, color: colors.ink2, lineHeight: 21 },
  btn: {
    marginTop: 16,
    backgroundColor: colors.ink,
    borderRadius: 13,
    padding: 18,
    alignItems: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '600', letterSpacing: 0.16, color: '#fff' },
  // The demo's own note pill: solid ink, radius 12, 13.5px, floating at the bottom.
  notice: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 28,
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  noticeText: { fontSize: 13.5, color: '#fff', lineHeight: 19 },
});
