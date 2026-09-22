// Notifications — the web demo's alert preferences, exactly: plain 15px rows with
// 12.5 sublines and the demo's own 46x28 toggle (graphite/ink when on, sliding white knob).
//
// THESE TOGGLES NOW DO SOMETHING. They were stored on the device and read by nothing, under a
// screen that implied the app would notify you: `expo-notifications` was in package.json and
// imported nowhere. The preference is stored on the account, and backend/push.js checks it
// before it sends — the ids here ARE the keys the server reads.
//
// THE OFFERS ROW IS GONE. We send no offers, so it was a control named for something that does
// not happen. A preference for a message that has never existed is furniture.
//
// TWO KINDS CANNOT BE TURNED OFF and the screen says so rather than pretending otherwise: a
// travel assigned to an operator on duty, and a safety check-in.
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { registerForPush, savePushPrefs } from '../src/backend/push';
import { Text } from '../src/components/AppText';
import { useNative } from '../src/components/anim';
import { useGoBack } from '../src/components/nav';
import { Card, LetterheadBar, Screen, Sub, Title } from '../src/components/UI';
import { useLanguage } from '../src/state/LanguageContext';
import { colors } from '../src/theme';

const KEY = 'ar:notif-prefs:v1';

// KEYS, NOT SENTENCES — built at import, before the stored language is read.
const ROWS: { id: string; title: string; sub: string; def: boolean }[] = [
  { id: 'enroute', title: 'traveler.notifEnRoute', sub: 'traveler.notifOnTheWay', def: true },
  { id: 'arrived', title: 'traveler.notifArrived', sub: 'traveler.notifReachesPickup', def: true },
  { id: 'complete', title: 'traveler.notifComplete', sub: 'traveler.notifReceipt', def: true },
];

// The demo's .sw toggle: 46x28 pill track, 22px knob sliding 18. The track is
// graphite (ink), not the demo's green: a toggle is a setting, not a success state,
// and the knob position — not the colour — carries on vs off.
function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  const anim = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: on ? 1 : 0, duration: 200, useNativeDriver: useNative }).start();
  }, [anim, on]);
  const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 18] });
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
    >
      <View style={[styles.sw, { backgroundColor: on ? colors.ink : colors.border }]}>
        <Animated.View style={[styles.swk, { transform: [{ translateX: tx }] }]} />
      </View>
    </Pressable>
  );
}

export default function Notifications() {
  const { t } = useLanguage();
  const goBack = useGoBack();
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(ROWS.map((r) => [r.id, r.def])),
  );

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setPrefs((p) => ({ ...p, ...JSON.parse(raw) })))
      .catch(() => {});
  }, []);

  // Why nothing can be delivered, when that is the case. Stated plainly on the screen: a set
  // of toggles above a permission the person has refused is the same lie in a smaller font.
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setBlocked(t('traveler.notifBrowserNo'));
      return;
    }
    registerForPush().then(({ token, reason }) => setBlocked(token ? null : reason));
  }, []);

  const toggle = (id: string) => {
    const next = { ...prefs, [id]: !prefs[id] };
    setPrefs(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    // AND ON THE ACCOUNT. The device copy survives a restart; the account copy is the one the
    // server reads before it sends, and without it the toggle governs nothing.
    savePushPrefs(next);
    // Turning something ON is the moment to ask, if we have not already.
    if (next[id] && blocked) {
      registerForPush(next).then(({ token, reason }) => setBlocked(token ? null : reason));
    }
  };

  return (
    <Screen>
      <LetterheadBar onBack={goBack} />
      <Title>{t('traveler.notifications')}</Title>
      <Sub>{t('traveler.notificationsSub')}</Sub>

      <Card style={styles.card}>
        {ROWS.map((r, i) => (
          <View key={r.id} style={[styles.row, i > 0 && styles.hair]}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{t(r.title)}</Text>
              <Text style={styles.rowSub}>{t(r.sub)}</Text>
            </View>
            <Toggle label={t(r.title)} on={!!prefs[r.id]} onToggle={() => toggle(r.id)} />
          </View>
        ))}
      </Card>

      {/* WAS: "Nothing is sent to your phone yet." It was true, and it is not any more. */}
      {blocked ? (
        <Text style={styles.blocked}>{blocked}</Text>
      ) : (
        <Text style={styles.foot}>{t('traveler.notifAlwaysSent')}</Text>
      )}
      {/* WHICH CHANNEL CARRIES WHAT (Chad, 19 Sept 2026 — 'multi-channel infrastructure
          clarity'). Stated because one of these rows was quietly lying: the emailed receipt is
          sent by server.js on settlement and checks NO preference, so a traveler who turned
          'Travel Completion Summaries' off still received it. The toggle governs the push and
          only the push. Two channels exist and no more — Expo push (backend/push.js) and
          Resend email (backend/email.js). There is no SMS path, so this screen names none. */}
      <Text style={styles.foot}>{t('traveler.notifChannels')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  hair: { borderTopWidth: 1, borderTopColor: colors.hairline },
  blocked: { fontSize: 13, color: colors.red, marginTop: 18, lineHeight: 19 },
  // Title table: the text column flexes and wraps (minWidth 0 so a long German
  // sub wraps instead of squeezing the toggle on web); the 46px toggle never
  // shrinks, so the rows hold their shape at 390pt with the longest sub.
  rowText: { flex: 1, minWidth: 0, paddingRight: 12 },
  rowTitle: { fontSize: 15, color: colors.ink },
  rowSub: { fontSize: 12.5, color: colors.muted, marginTop: 2, lineHeight: 17 },
  sw: {
    width: 46,
    height: 28,
    borderRadius: 999,
    padding: 3,
    flexShrink: 0,
  },
  swk: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  foot: { fontSize: 12, color: colors.faint, marginTop: 12, lineHeight: 18 },
});
