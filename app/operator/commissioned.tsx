// Operator Commissioned — the web demo shell's screen, exactly: the check, the
// ✓ Operator Commissioned badge, the personal headline, both-roles note, and the
// green Enter Dashboard.
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/AppText';
import Svg, { Circle, Path } from 'react-native-svg';
import { BadgeOk } from '../../src/components/operator';
import { Card, PrimaryButton, Screen } from '../../src/components/UI';
import { useOperator } from '../../src/state/OperatorContext';
import { useLanguage } from '../../src/state/LanguageContext';
import { colors } from '../../src/theme';

export default function OperatorCommissioned() {
  const { t } = useLanguage();
  const router = useRouter();
  const op = useOperator();
  const first = op.opName.split(/\s+/)[0];

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <View style={{ flex: 1 }} />
        <Svg width={60} height={60} viewBox="0 0 60 60" fill="none">
          <Circle cx={30} cy={30} r={22} stroke={colors.green} strokeWidth={2} />
          <Path
            d="M21 30l6 6 12-13"
            stroke={colors.green}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <View style={{ marginTop: 16 }}>
          <BadgeOk big label={t('operator.operatorCommissioned')} />
        </View>
        <Text style={styles.title}>
          {first
            ? t('traveler.youAreCommissionedName', { name: first })
            : t('traveler.youAreCommissioned')}
        </Text>
        <Text style={styles.sub}>
          {t('traveler.holdBothRoles')}
        </Text>

        <Card style={styles.readiness}>
          <Text style={styles.readinessTitle}>Before commencing operations</Text>
          <Text style={styles.readinessBody}>
            Your qualification is approved. Complete the operational items below before accepting Travel.
          </Text>
          <Pressable onPress={() => router.navigate('/operator/vehicle')} style={styles.readinessRow}>
            <Text style={styles.readinessLabel}>Name and vehicle</Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
          <Pressable onPress={() => router.navigate('/operator/payouts')} style={styles.readinessRow}>
            <Text style={styles.readinessLabel}>Payout account</Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
          <Pressable onPress={() => router.navigate('/operator/disclosure')} style={styles.readinessRow}>
            <Text style={styles.readinessLabel}>Insurance disclosure</Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        </Card>
        <View style={{ flex: 1 }} />
        <View style={{ alignSelf: 'stretch' }}>
          <PrimaryButton
            label="Continue to operational readiness"
            color={colors.green}
            onPress={() => {
              op.setRole('operator');
              router.replace('/operator');
            }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: 14,
    fontSize: 23,
    fontWeight: '600',
    letterSpacing: -0.52,
    color: colors.ink,
    textAlign: 'center',
  },
  readiness: { alignSelf: 'stretch', marginTop: 24, paddingVertical: 8, paddingHorizontal: 18 },
  readinessTitle: { fontSize: 15, fontWeight: '600', color: colors.ink, marginTop: 8 },
  readinessBody: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 6, marginBottom: 6 },
  readinessRow: { minHeight: 48, borderTopWidth: 1, borderTopColor: colors.hairline, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readinessLabel: { fontSize: 14.5, color: colors.ink },
  chev: { fontSize: 20, color: colors.faint },
  sub: {
    fontSize: 14.5,
    color: colors.muted,
    marginTop: 9,
    lineHeight: 21.75,
    textAlign: 'center',
  },
});
