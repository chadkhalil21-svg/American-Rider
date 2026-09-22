import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from '../src/components/AppText';
import { PrimaryButton, Screen } from '../src/components/UI';
import { useLanguage } from '../src/state/LanguageContext';
import { colors } from '../src/theme';

export default function NotFound() {
  const { t } = useLanguage();
  const router = useRouter();
  return (
    <Screen>
      <Text style={styles.brand}>AMERICAN RIDER</Text>
      <Text style={styles.title}>
        {t('traveler.wrongTurnL1')}
        {'\n'}
        {t('traveler.wrongTurnL2')}
      </Text>
      <Text style={styles.sub}>{t('traveler.pageNotExist')}</Text>
      <PrimaryButton
        label={t('traveler.home')}
        onPress={() => router.dismissTo('/')}
        style={{ marginTop: 'auto' }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { fontSize: 13, fontWeight: '600', letterSpacing: 2.8, color: colors.ink },
  title: {
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -0.6,
    color: colors.ink,
    marginTop: 26,
    lineHeight: 37,
  },
  sub: { fontSize: 14.5, color: colors.muted, marginTop: 12, lineHeight: 22 },
});
