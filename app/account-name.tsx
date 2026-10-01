import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../src/components/AppText';
import { Card, LetterheadBar, PrimaryButton, Screen, Sub, Title } from '../src/components/UI';
import { useGoBack } from '../src/components/nav';
import { useAuth } from '../src/state/AuthContext';
import { useLanguage } from '../src/state/LanguageContext';
import { colors } from '../src/theme';

export default function AccountName() {
  const goBack = useGoBack();
  const { t } = useLanguage();
  const { user, setDisplayName, busy } = useAuth();
  const current = user?.displayName?.trim() ?? '';
  const [name, setName] = useState(current);
  const clean = name.trim().slice(0, 40);
  const changed = !!clean && clean !== current;

  return (
    <Screen>
      <LetterheadBar onBack={goBack} />
      <Title size={24}>{t('traveler.editNameTitle')}</Title>
      <Sub>{t('traveler.editNameSub')}</Sub>

      <Card style={styles.card}>
        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>{t('traveler.nameLabel')}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (!changed || busy) return;
              setDisplayName(clean).then((ok) => { if (ok) goBack(); });
            }}
            style={styles.field}
          />
        </View>
      </Card>

      <View style={{ flex: 1, minHeight: 30 }} />
      <PrimaryButton
        label={busy ? t('traveler.busySaving') : t('traveler.save')}
        disabled={!changed || busy}
        onPress={() => { void setDisplayName(clean).then((ok) => { if (ok) goBack(); }); }}
        style={{ paddingVertical: 16 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 20, paddingHorizontal: 18, paddingVertical: 1 },
  fieldWrap: { paddingTop: 14, paddingBottom: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1.1, color: colors.muted, textTransform: 'uppercase' },
  field: { paddingVertical: 12, fontSize: 16, color: colors.ink },
});
