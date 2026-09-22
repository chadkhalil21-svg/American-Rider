// Under Review — the web demo shell's screen, exactly: the shield, the promise of a
// same-day commission, Continue (the demo commissions on the spot — labeled as test
// program), and the traveler escape hatch.
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/AppText';
import Svg, { Path } from 'react-native-svg';
import { PrimaryButton, Screen } from '../../src/components/UI';
import { useOperator } from '../../src/state/OperatorContext';
import { useLanguage } from '../../src/state/LanguageContext';
import { colors } from '../../src/theme';

export default function OperatorReview() {
  const { t } = useLanguage();
  const router = useRouter();
  const op = useOperator();

  // A COMMISSIONED OPERATOR MUST NOT BE TOLD THEY ARE UNDER REVIEW. `qualify` has this guard
  // and this screen did not, so arriving here afterwards — a deep link, the back stack, a
  // reload — showed "Your qualification is complete. Most operators are commissioned within a
  // few hours" to somebody already commissioned and carrying travel.
  //
  // ON ARRIVAL ONLY, never on every change: Continue below sets verification to
  // 'commissioned' and then routes to /operator/commissioned. A guard watching the value
  // would overtake that and swallow the one screen that tells them they passed.
  const settled = useRef(false);
  useEffect(() => {
    if (!op.ready || settled.current) return;
    settled.current = true;
    if (op.verification === 'commissioned') router.replace('/operator');
  }, [op.ready, op.verification, router]);

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <View style={{ flex: 1 }} />
        <Svg width={56} height={56} viewBox="0 0 56 56" fill="none">
          <Path
            d="M28 6l18 7v11c0 12-8 20-18 26C18 44 10 36 10 24V13z"
            stroke={colors.ink}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        </Svg>
        <Text style={styles.title}>{t('traveler.underReview')}</Text>
        <Text style={styles.sub}>
          {/* WAS: "you will be notified the moment you are cleared." Nothing notifies
              anyone — the app registers for no push notifications. Say where the answer
              appears instead, which is somewhere they can actually go and look. */}
          Your qualification is complete. Most operators are commissioned within a few hours;
          your status appears here.
        </Text>
        <View style={{ flex: 1 }} />
        <View style={{ alignSelf: 'stretch' }}>
          <PrimaryButton
            label={t('common.continue')}
            color={colors.green}
            onPress={() => {
              op.commission();
              router.replace('/operator/commissioned');
            }}
          />
        </View>
        <Pressable onPress={() => router.dismissTo('/')} hitSlop={10} style={{ marginTop: 16 }}>
          <Text style={styles.link}>{t('traveler.travelWhileWaiting')}</Text>
        </Pressable>
        <Text style={styles.testNote}>{t('traveler.reviewSimulated')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: 18,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.52,
    color: colors.ink,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14.5,
    color: colors.muted,
    marginTop: 9,
    lineHeight: 21.75,
    textAlign: 'center',
  },
  link: { fontSize: 15, fontWeight: '500', color: colors.ink, textAlign: 'center' },
  testNote: { fontSize: 11.5, color: colors.faint, marginTop: 18, textAlign: 'center' },
});
