import React from 'react';
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../src/components/AppText';
import { useGoBack } from '../../src/components/nav';
import { BadgeOk } from '../../src/components/operator';
import { BackLink, Card, PrimaryButton, Screen, SectionLabel, Sub, Title } from '../../src/components/UI';
import { declareExistingScreening, fetchScreening, type ScreeningStatus } from '../../src/backend/screening';
import { useOperator } from '../../src/state/OperatorContext';
import { useLanguage } from '../../src/state/LanguageContext';
import { colors } from '../../src/theme';

const PROVIDER_URL = String(process.env.EXPO_PUBLIC_SCREENING_PROVIDER_URL || '').trim();
const dateLabel = (when: string | number) =>
  new Date(when).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export default function OperatorBackground() {
  const { t } = useLanguage();
  const goBack = useGoBack();
  const op = useOperator();
  const [status, setStatus] = React.useState<ScreeningStatus | null>(null);
  const [showExisting, setShowExisting] = React.useState(false);
  const [showRequirements, setShowRequirements] = React.useState(false);
  const [agency, setAgency] = React.useState('');
  const [criminalIncluded, setCriminalIncluded] = React.useState(true);
  const [drivingIncluded, setDrivingIncluded] = React.useState(true);
  const [declared, setDeclared] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => fetchScreening().then(setStatus), []);
  React.useEffect(refresh, [refresh]);

  const record = status?.screening || null;
  const decision = record?.decision;
  const passed = decision === 'pass';

  React.useEffect(() => {
    if (!status?.ok) return;
    op.syncBackground(passed, record?.conductedAt ?? null);
  }, [status?.ok, passed, record?.conductedAt, op]);

  const submitExisting = async () => {
    if (!agency.trim()) {
      setError(t('traveler.bgNameCompanyFirst'));
      return;
    }
    setBusy(true);
    setError(null);
    const out = await declareExistingScreening({
      agency: agency.trim(),
      criminalIncluded,
      drivingIncluded,
    });
    setBusy(false);
    if (!out.ok) {
      setError(out.error || t('traveler.bgNotRecorded'));
      return;
    }
    setDeclared(
      (out.note || t('traveler.bgRecordedWillAsk')) +
        (out.transferTo
          ? ' ' + t('traveler.bgHaveThemEmail', { agency: agency.trim(), email: out.transferTo }) +
            (out.transferCaseNo ? t('traveler.bgCitingCase', { caseNo: out.transferCaseNo }) : '.')
          : ''),
    );
    refresh();
  };

  return (
    <Screen>
      <BackLink label={t('common.back')} onPress={goBack} />
      <Title size={26}>Screening</Title>
      <Sub style={styles.intro}>
        Complete the screening required for the market where you operate. You pay the screening
        provider directly; American Rider does not charge a screening fee.
      </Sub>

      {passed ? (
        <>
          <SectionLabel style={styles.section}>STATUS</SectionLabel>
          <Card style={styles.statusCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>Screening complete</Text>
              <Text style={styles.body}>
                Reviewed {dateLabel(record?.conductedAt || op.bgCheckedAt || Date.now())}
                {record?.recheckDue ? ` · renewal due ${dateLabel(record.recheckDue)}` : ''}
              </Text>
            </View>
            <BadgeOk label={t('operator.verified')} />
          </Card>
        </>
      ) : (
        <>
          {record?.decision ? (
            <>
              <SectionLabel style={styles.section}>STATUS</SectionLabel>
              <Card style={styles.statusCard}>
                <Text style={styles.statusTitle}>
                  {record.decision === 'awaiting_agency' ? 'Report requested' :
                   record.decision === 'review' ? 'In review' :
                   record.decision === 'refuse' ? 'Review complete' :
                   record.decision === 'expired' ? 'Renewal required' : 'Screening in progress'}
                </Text>
                <Text style={styles.body}>{record.summary || 'We will update this status when the provider report is received.'}</Text>
              </Card>
            </>
          ) : null}

          <SectionLabel style={styles.section}>COMPLETE SCREENING</SectionLabel>
          <Card style={styles.providerCard}>
            <Text style={styles.providerName}>BackgroundChecks.com</Text>
            <Text style={styles.providerMeta}>Preferred external provider</Text>
            <Text style={styles.body}>
              Complete the required criminal-record, sex-offender and driving-history searches
              through the provider’s secure process. Sensitive screening information stays with
              the screening provider.
            </Text>
            {PROVIDER_URL ? (
              <PrimaryButton
                label="Continue with provider"
                onPress={() => Linking.openURL(PROVIDER_URL)}
                style={styles.primary}
              />
            ) : (
              <Text style={styles.pending}>
                American Rider’s provider-specific screening link is being configured. Do not
                purchase a personal background report; it may not qualify for this purpose.
              </Text>
            )}
          </Card>

          <Pressable onPress={() => setShowExisting((v) => !v)} accessibilityRole="button">
            <Card style={styles.choiceCard}>
              <View style={styles.choiceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.choiceTitle}>Already screened?</Text>
                  <Text style={styles.body}>
                    A current qualifying report may be reviewed if the screening company can
                    release it directly to American Rider.
                  </Text>
                </View>
                <Text style={styles.chev}>{showExisting ? '−' : '+'}</Text>
              </View>
            </Card>
          </Pressable>

          {showExisting ? (
            <Card style={styles.formCard}>
              {declared ? (
                <>
                  <Text style={styles.choiceTitle}>Request recorded</Text>
                  <Text style={styles.body}>{declared}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>SCREENING COMPANY</Text>
                  <TextInput
                    value={agency}
                    onChangeText={setAgency}
                    placeholder="Provider name"
                    placeholderTextColor={colors.faint}
                    style={styles.input}
                  />
                  <Pressable style={styles.checkRow} onPress={() => setCriminalIncluded((v) => !v)}>
                    <Text style={styles.check}>{criminalIncluded ? '✓' : '○'}</Text>
                    <Text style={styles.checkLabel}>Criminal record and sex-offender searches</Text>
                  </Pressable>
                  <Pressable style={styles.checkRow} onPress={() => setDrivingIncluded((v) => !v)}>
                    <Text style={styles.check}>{drivingIncluded ? '✓' : '○'}</Text>
                    <Text style={styles.checkLabel}>Driving history</Text>
                  </Pressable>
                  <Text style={styles.note}>
                    This does not approve the report. It authorizes American Rider to request
                    and review the provider’s authoritative report.
                  </Text>
                  <PrimaryButton
                    label={busy ? t('traveler.busyRecording') : 'Request provider review'}
                    disabled={busy}
                    onPress={submitExisting}
                    style={styles.primary}
                  />
                </>
              )}
            </Card>
          ) : null}

          <Pressable onPress={() => setShowRequirements((v) => !v)} accessibilityRole="button">
            <View style={styles.disclosureRow}>
              <Text style={styles.disclosure}>What is required in Florida?</Text>
              <Text style={styles.disclosure}>{showRequirements ? '−' : '+'}</Text>
            </View>
          </Pressable>
          {showRequirements ? (
            <View style={styles.requirements}>
              <Text style={styles.body}>
                Florida Stat. §627.748(12) requires a multi-state or similar nationwide criminal
                database search with primary-source validation of identified records, a National
                Sex Offender Public Website search, and a driving-history research report. The
                background check is repeated every three years.
              </Text>
            </View>
          ) : null}
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={{ flex: 1, minHeight: 24 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: 7, maxWidth: 520, lineHeight: 19 },
  section: { marginTop: 23, marginBottom: 9, fontSize: 10.5, letterSpacing: 1.35 },
  statusCard: { paddingHorizontal: 17, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusTitle: { fontSize: 14.5, fontWeight: '600', color: colors.ink },
  providerCard: { paddingHorizontal: 17, paddingVertical: 16 },
  providerName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  providerMeta: { fontSize: 11.5, color: colors.muted, marginTop: 2, marginBottom: 8 },
  body: { fontSize: 12.5, color: colors.muted, lineHeight: 18.5, marginTop: 4 },
  pending: { fontSize: 12, color: colors.ink2, lineHeight: 18, marginTop: 13 },
  primary: { marginTop: 14, paddingVertical: 14 },
  choiceCard: { marginTop: 12, paddingHorizontal: 17, paddingVertical: 14 },
  choiceRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  choiceTitle: { fontSize: 14.5, fontWeight: '600', color: colors.ink },
  chev: { fontSize: 20, color: colors.faint, fontWeight: '300' },
  formCard: { marginTop: 8, paddingHorizontal: 17, paddingVertical: 15 },
  fieldLabel: { fontSize: 10.5, fontWeight: '600', letterSpacing: 1.15, color: colors.muted },
  input: { marginTop: 7, borderWidth: 1, borderColor: colors.hairline, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.ink },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 13 },
  check: { width: 18, fontSize: 14, color: colors.accent },
  checkLabel: { flex: 1, fontSize: 13, color: colors.ink2 },
  note: { fontSize: 11.5, color: colors.muted, lineHeight: 17, marginTop: 14 },
  disclosureRow: { marginTop: 18, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  disclosure: { fontSize: 12.5, fontWeight: '600', color: colors.accent },
  requirements: { paddingBottom: 8, paddingRight: 8 },
  error: { fontSize: 12.5, color: colors.red, lineHeight: 18, marginTop: 14 },
});
