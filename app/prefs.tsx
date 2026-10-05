// Cabin Environment — the web demo's prefs screen, exactly: segmented CLIMATE /
// ATMOSPHERE / MUSIC controls (fill track, sliding solid-ink thumb), the Traveler
// Choice reveal note, and the ADDITIONAL REQUESTS chips.
//
// A SUB-SCREEN, NOT A STEP (Chad, 13–14 Sept 2026). The saved environment is applied to every
// travel and shown on the Travel Confirmation sheet; this screen opens from there (and from
// the Menu) to change it, and Done returns to where it was opened from.
//
// Every choice here is SAVED (src/state/cabinPrefs.ts) and applied to every travel; the
// travel being arranged (RideContext.tripPrefs, the copy the operator receives) is updated in
// the same tap, so the sheet shows the change the moment the traveler returns.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../src/components/AppText';
import { useNative } from '../src/components/anim';
import { useGoBack } from '../src/components/nav';
import { Card, LetterheadBar, PrimaryButton, Screen, SectionLabel, Sub, Title } from '../src/components/UI';
import { CLIMATES, MUSIC, setCabinPrefs, useCabinPrefs, type Climate, type Music } from '../src/state/cabinPrefs';
import { useRide } from '../src/state/RideContext';
import { useLanguage } from '../src/state/LanguageContext';
import { colors } from '../src/theme';

// The demo's .seg: fill track radius 12 with 3px padding, solid thumb radius 9 sliding
// on a .32s cubic-bezier(.34,.7,0,1); options 14px, 500 ink2 → 600 solid-fg when on.
function Segmented({
  options,
  value,
  onChange,
  labels,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  /** What each option says on screen, in the traveler's language; the value stays a key. */
  labels?: Record<string, string>;
}) {
  const idx = Math.max(0, options.indexOf(value));
  const [innerW, setInnerW] = useState(0);
  const thumbW = innerW / options.length;
  const tx = useRef(new Animated.Value(0)).current;
  // The demo renders the thumb already in place — jump on first layout, slide after.
  const placed = useRef(false);
  useEffect(() => {
    if (thumbW <= 0) return;
    if (!placed.current) {
      placed.current = true;
      tx.setValue(idx * thumbW);
      return;
    }
    Animated.timing(tx, {
      toValue: idx * thumbW,
      duration: 320,
      easing: Easing.bezier(0.34, 0.7, 0, 1),
      useNativeDriver: useNative,
    }).start();
  }, [idx, thumbW, tx]);
  return (
    <View
      style={styles.seg}
      onLayout={(e) => setInnerW(e.nativeEvent.layout.width - 6)}
    >
      {innerW > 0 && (
        <Animated.View
          style={[styles.segThumb, { width: thumbW, transform: [{ translateX: tx }] }]}
        />
      )}
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable accessibilityRole="button" key={o} onPress={() => onChange(o)} style={styles.segOpt}>
            <Text style={[styles.segText, on && styles.segTextOn]}>{labels?.[o] ?? o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function CabinEnvironment() {
  const { t } = useLanguage();
  const goBack = useGoBack();
  const ride = useRide();
  const cabin = useCabinPrefs();
  const { climate, music, quiet, charging, luggage } = cabin;

  const atmosphere = quiet ? 'Quiet' : 'Conversation';

  return (
    <Screen>
      <LetterheadBar onBack={goBack} />
      <Title size={24}>{t('traveler.travelPreferences')}</Title>
      <Sub>{t('traveler.configureThisTravel')}</Sub>

      <SectionLabel style={{ marginTop: 22 }}>{t('traveler.climate')}</SectionLabel>
      <View style={styles.segWrap}>
        <Segmented
          options={[...CLIMATES]}
          labels={{ Cool: t('traveler.prefCool'), Moderate: t('traveler.prefModerate'), Warm: t('traveler.prefWarm') }}
          value={climate}
          onChange={(v) => setCabinPrefs({ climate: v as Climate })}
        />
      </View>

      <SectionLabel style={{ marginTop: 22 }}>{t('traveler.atmosphere')}</SectionLabel>
      <View style={styles.segWrap}>
        <Segmented
          options={['Quiet', 'Conversation']}
          labels={{ Quiet: t('traveler.prefQuiet'), Conversation: t('traveler.prefConversation') }}
          value={atmosphere}
          onChange={(v) => {
            const next = v === 'Quiet';
            setCabinPrefs({ quiet: next });
            if (next !== ride.tripPrefs.quiet) ride.togglePref('tripPrefs', 'quiet');
          }}
        />
      </View>

      <SectionLabel style={{ marginTop: 22 }}>{t('traveler.music')}</SectionLabel>
      <View style={styles.segWrap}>
        <Segmented
          options={[...MUSIC]}
          labels={{ None: t('traveler.prefMusicNone'), 'Traveler Choice': t('traveler.prefTravelerChoice') }}
          value={music}
          onChange={(v) => setCabinPrefs({ music: v as Music })}
        />
      </View>
      {music === 'Traveler Choice' && (
        <Text style={styles.musicNote}>
          {t('traveler.musicSourceOnArrival')}
        </Text>
      )}

      <SectionLabel style={{ marginTop: 22 }}>{t('traveler.additionalRequests')}</SectionLabel>
      <Card style={styles.requestCard}>
        {[
          {
            label: t('traveler.charger'),
            on: charging,
            toggle: () => {
              const next = !charging;
              setCabinPrefs({ charging: next });
              if (next !== ride.tripPrefs.charging) ride.togglePref('tripPrefs', 'charging');
            },
          },
          {
            label: t('traveler.luggage'),
            on: luggage,
            toggle: () => {
              const next = !luggage;
              setCabinPrefs({ luggage: next });
              if (next !== ride.tripPrefs.luggage) ride.togglePref('tripPrefs', 'luggage');
            },
          },
        ].map((item, i) => (
          <Pressable
            key={item.label}
            onPress={item.toggle}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.on }}
          >
            <View style={[styles.requestRow, i > 0 && styles.requestHair]}>
              <Text style={styles.requestLabel}>{item.label}</Text>
              <Text style={[styles.requestCheck, !item.on && styles.requestCheckOff]}>✓</Text>
            </View>
          </Pressable>
        ))}
      </Card>

      <View style={styles.doneSpacer} />
      {/* DONE, NOT CONTINUE: preferences save as they are selected; Done simply closes the screen. */}
      <PrimaryButton label={t('common.done')} onPress={goBack} style={styles.doneButton} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  segWrap: { marginTop: 11 },
  seg: {
    flexDirection: 'row',
    backgroundColor: colors.fill,
    borderRadius: 12,
    padding: 3,
  },
  segThumb: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 9,
    backgroundColor: colors.accent,
  },
  segOpt: { flex: 1, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center' },
  segText: { fontSize: 13.5, fontWeight: '500', color: colors.ink2 },
  segTextOn: { fontWeight: '600', color: '#fff' },
  musicNote: { fontSize: 12.5, color: colors.muted, marginTop: 9, lineHeight: 18.75 },
  requestCard: { marginTop: 11, paddingHorizontal: 18, paddingVertical: 1 },
  requestRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13.5,
  },
  requestHair: { borderTopWidth: 1, borderTopColor: colors.hairline },
  requestLabel: { fontSize: 14.5, color: colors.ink },
  requestCheck: { fontSize: 16, fontWeight: '600', color: colors.accent },
  requestCheckOff: { opacity: 0 },
  doneSpacer: { flex: 1, minHeight: 30 },
  doneButton: { marginTop: 2, paddingVertical: 16 },
});
