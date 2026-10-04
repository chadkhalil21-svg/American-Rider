import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../src/components/AppText';
import { Card, LetterheadBar, Screen, Title } from '../src/components/UI';
import { useGoBack } from '../src/components/nav';
import { useLanguage } from '../src/state/LanguageContext';
import { colors } from '../src/theme';

export default function LanguageScreen() {
  const goBack = useGoBack();
  const { t, language, setLanguage, languages } = useLanguage();

  return (
    <Screen>
      <LetterheadBar onBack={goBack} />
      <Title size={24}>{t('common.language')}</Title>

      <Card style={styles.card}>
        {languages.map((item, i) => {
          const selected = item.code === language;
          return (
            <Pressable accessibilityRole="radio"
              key={item.code}
              onPress={() => setLanguage(item.code)}
              accessibilityState={{ selected }}
            >
              <View style={[styles.row, i > 0 && styles.hair]}>
                <Text style={[styles.label, selected && styles.labelSelected]}>{item.label}</Text>
                <Text style={[styles.check, !selected && styles.checkHidden]}>✓</Text>
              </View>
            </Pressable>
          );
        })}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 18, paddingHorizontal: 18, paddingVertical: 1 },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13.5,
  },
  hair: { borderTopWidth: 1, borderTopColor: colors.hairline },
  label: { fontSize: 14.5, color: colors.ink },
  labelSelected: { fontWeight: '600' },
  check: { fontSize: 16, fontWeight: '600', color: colors.accent },
  checkHidden: { opacity: 0 },
});
