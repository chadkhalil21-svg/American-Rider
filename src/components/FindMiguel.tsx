// Web / Android version of the arrival card. No compass hardware story here yet, so it's
// just the boarding control — the iOS file (FindMiguel.ios.tsx) is the full finder arrow.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './AppText';
import type { Coords } from '../backend/fares';
import { useLanguage } from '../state/LanguageContext';
import { colors } from '../theme';
import { PrimaryButton } from './UI';

type Props = {
  target: Coords;
  driverName: string;
  car: string;
  onBoard: () => void;
};

export function FindMiguel({ driverName, car, onBoard }: Props) {
  const { t } = useLanguage();
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('traveler.operatorIsHere', { name: driverName })}</Text>
      <Text style={styles.carLine}>{t('traveler.lookForThe', { car })}</Text>
      <View style={{ marginTop: 14, alignSelf: 'stretch' }}>
        <PrimaryButton label={t('traveler.confirmBoarding')} onPress={onBoard} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.ink },
  carLine: { marginTop: 4, fontSize: 14, color: colors.muted },
});
