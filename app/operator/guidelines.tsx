// Commercial Coverage Guidelines — the buying advice that used to sit inline on the insurance
// screen, moved behind a link (Chad, 18 Sept 2026: the qualification screen should ask for the
// document and the expiry date, and put the guidance one tap away rather than in front of
// somebody who already knows what to buy).
//
// NOT DELETED, MOVED. The two cost tiers are the founders' own (10 Aug 2026): a 24-year-old
// reading only the 25-and-over figure would be quoted well above it by every carrier they
// called. An operator buying their first livery policy needs all of this; an operator who
// already holds one needs none of it. A link serves both; an inline block serves one.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/AppText';
import { useGoBack } from '../../src/components/nav';
import { BackLink, Card, Screen, SectionLabel, Sub, Title } from '../../src/components/UI';
import { useLanguage } from '../../src/state/LanguageContext';
import { colors } from '../../src/theme';

// KEYS, NOT SENTENCES — evaluated at import, before the stored language is read.
const GUIDANCE_KEYS: [string, string][] = [
  ['traveler.insLiabilityTitle', 'traveler.insLiabilityBody'],
  ['traveler.insUmTitle', 'traveler.insUmBody'],
  ['traveler.insRecordTitle', 'traveler.insRecordBody'],
  ['traveler.insCost25Title', 'traveler.insCost25Body'],
  ['traveler.insCostU25Title', 'traveler.insCostU25Body'],
  ['traveler.insAgeTitle', 'traveler.insAgeBody'],
];

export default function CoverageGuidelines() {
  const { t } = useLanguage();
  const goBack = useGoBack();

  return (
    <Screen>
      <BackLink label={t('common.back')} onPress={goBack} />
      <Title>{t('operator.coverageGuidelines')}</Title>
      <Sub>{t('operator.coverageGuidelinesSub')}</Sub>

      <SectionLabel style={styles.lbl}>{t('operator.namingAmericanRider')}</SectionLabel>
      <Card style={styles.card}>
        <Text style={styles.body}>{t('traveler.certificateHolder')}</Text>
        <Text style={[styles.body, { marginTop: 10 }]}>{t('traveler.notAdditionalInsured')}</Text>
        <Text style={[styles.body, { marginTop: 10 }]}>{t('traveler.noCommissionOnPremium')}</Text>
      </Card>

      <SectionLabel style={styles.lbl}>{t('operator.costEffectivePolicy')}</SectionLabel>
      <Card style={styles.listCard}>
        {GUIDANCE_KEYS.map(([title, body], i) => (
          <View key={title} style={[styles.guideRow, i > 0 && styles.hair]}>
            <Text style={styles.guideTitle}>{t(title)}</Text>
            <Text style={styles.guideBody}>{t(body)}</Text>
          </View>
        ))}
      </Card>

      <Text style={styles.foot}>{t('traveler.estimatesOnly')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lbl: { marginTop: 24, marginBottom: 12 },
  card: { paddingVertical: 16, paddingHorizontal: 20 },
  listCard: { paddingVertical: 2, paddingHorizontal: 20 },
  body: { fontSize: 14, color: colors.muted, lineHeight: 20.5 },
  hair: { borderTopWidth: 1, borderTopColor: colors.hairline },
  guideRow: { paddingVertical: 15 },
  guideTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  guideBody: { fontSize: 13, color: colors.muted, marginTop: 5, lineHeight: 19.5 },
  foot: { fontSize: 11.5, color: colors.faint, marginTop: 18, lineHeight: 17.25 },
});
