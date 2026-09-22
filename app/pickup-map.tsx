// Fallback for web and Android. The real pin-drop map is pickup-map.ios.tsx, which Metro
// serves on iPhone. Nothing links here off iOS, but the route has to exist so expo-router's
// typed routes stay valid and a stray deep link lands somewhere sane instead of on +not-found.
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../src/components/AppText';
import { PrimaryButton } from '../src/components/UI';
import { useLanguage } from '../src/state/LanguageContext';
import { colors } from '../src/theme';

export default function PickupMapUnavailable() {
  const { t } = useLanguage();
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('traveler.mapNeedsApp')}</Text>
      <Text style={styles.body}>{t('traveler.searchByNameInstead')}</Text>
      <PrimaryButton label={t('traveler.backToTravel')} onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  title: { fontSize: 20, fontWeight: '600', color: colors.ink, textAlign: 'center' },
  body: { fontSize: 15, color: colors.muted, textAlign: 'center', marginBottom: 6 },
});
