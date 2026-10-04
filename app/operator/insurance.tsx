// Commercial Insurance — one path to understand the requirement, compare specialist quotes,
// submit the declarations page, monitor continuing status, and understand retention economics.
// After commissioning this remains the Operator's Insurance page.
import { Linking } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../src/components/AppText';
import { pickDocument } from '../../src/backend/documentUpload';
import {
  insuranceStatus,
  insuranceConfig,
  authorizeInsuranceStatusVerification,
  attestInsuranceUnchanged,
  requestInsuranceConfirmation,
  type InsuranceStatus,
  type InsuranceConfig,
} from '../../src/backend/insuranceStatus';
import { useGoBack } from '../../src/components/nav';
import { BadgeOk } from '../../src/components/operator';
import { BackLink, Card, PrimaryButton, Screen, SectionLabel, Sub, Title } from '../../src/components/UI';
import { BROKER, INSURERS } from '../../src/data';
import { useOperator } from '../../src/state/OperatorContext';
import { useLanguage } from '../../src/state/LanguageContext';
import { colors } from '../../src/theme';


export default function OperatorInsurance() {
  const { t } = useLanguage();
  // The alternatives stay folded until asked for: five names presented as five equal answers
  // is not a recommendation, it is a list.
  const [showMore, setShowMore] = useState(false);
  const router = useRouter();
  const goBack = useGoBack();
  const op = useOperator();
  const [liveStatus, setLiveStatus] = useState<InsuranceStatus | null>(null);
  const [config, setConfig] = useState<InsuranceConfig | null>(null);
  const [configResolved, setConfigResolved] = useState(false);
  const [brokerEmail, setBrokerEmail] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [monthlyPremium, setMonthlyPremium] = useState('');

  useEffect(() => {
    insuranceConfig().then((x) => {
      setConfig(x);
      setConfigResolved(true);
    });
    insuranceStatus().then((s) => {
      if (!s) return;
      setLiveStatus(s);
      if (s.contact?.email) setBrokerEmail(s.contact.email);
    });
  }, [op.docs.insurance]);

  const authorizeStatus = async () => {
    setStatusBusy(true);
    const out = await authorizeInsuranceStatusVerification();
    setStatusBusy(false);
    if (!out.ok) return Alert.alert(t('traveler.insAuthorizeTitle'), out.error || t('traveler.errReachAR'));
    const s = await insuranceStatus();
    if (s) setLiveStatus(s);
    Alert.alert(t('traveler.insAuthorizeTitle'), t('traveler.insAuthorized'));
  };

  const confirmUnchanged = async () => {
    setStatusBusy(true);
    const s = await attestInsuranceUnchanged();
    setStatusBusy(false);
    if (!s) return Alert.alert(t('traveler.notRecorded'), t('traveler.errReachAR'));
    setLiveStatus(s);
    Alert.alert(t('traveler.insStatusTitle'), t('traveler.insAttestationSent'));
  };

  const requestStatus = async () => {
    const email = brokerEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Alert.alert(t('traveler.insStatusTitle'), t('traveler.insBrokerEmail'));
    }
    setStatusBusy(true);
    const out = await requestInsuranceConfirmation({ email, type: 'broker' });
    setStatusBusy(false);
    if (!out.ok) return Alert.alert(t('traveler.notSent'), out.error || t('traveler.errReachAR'));
    const s = await insuranceStatus();
    if (s) setLiveStatus(s);
    Alert.alert(t('traveler.insStatusTitle'), t('traveler.insRequestSent'));
  };

  // Submits the policy and reports the outcome. Nothing is claimed here — op.reviewDoc has
  // already recorded the verdict and the Documents screen reads it; this only surfaces the
  // failures a row cannot show, and the refusal reason, which an operator needs immediately.
  const submitPolicy = async (fromCamera: boolean) => {
    if (!config) {
      Alert.alert(t('operator.commercialInsurance'), t('traveler.insJurisdictionUnavailable'));
      return;
    }
    const uri = await pickDocument(fromCamera);
    if (!uri) return;
    const out = await op.reviewDoc('insurance', uri);
    if (!out) {
      Alert.alert(t('traveler.notSubmitted'), t('traveler.docUploadFailed'));
    } else if ('error' in out) {
      Alert.alert(t('traveler.notChecked'), out.error);
    } else if (out.verdict === 'refuse') {
      Alert.alert(t('traveler.notAccepted'), out.reasons.join('\n\n'));
    } else if (out.verdict === 'review') {
      Alert.alert(t('traveler.beingChecked'), t('traveler.insUnderPersonReview'));
    } else {
      goBack();
    }
  };
  const st = op.docs.insurance;

  const premiumN = /^\d+(?:[.,]\d{0,2})?$/.test(monthlyPremium.trim())
    ? Math.min(1000000, Math.max(0, Number(monthlyPremium.trim().replace(',', '.'))))
    : null;
  // An example of gross fare volume, not net income or a premium recommendation.
  const fareNeededAR = premiumN == null ? null : premiumN / 0.99;
  const money = (n: number) => String.fromCharCode(36) + n.toFixed(0);
  const marketState = config?.state || null;
  const nationalInsurers = config ? INSURERS.filter((x) => !x.states) : [];
  const stateInsurers = config ? INSURERS.filter((x) => x.states?.includes(config.state)) : [];

  return (
    <Screen>
      <BackLink label={t('common.back')} onPress={goBack} />
      <Title>{t('operator.commercialInsurance')}</Title>
      {/* THE REQUIREMENT, IN THE WORDS CHAD SPECIFIED (20 Sept 2026). This is the operator's
          own legal obligation under §627.748, so it is stated in full rather than summarised —
          an operator who reads a summary and buys an endorsement has not been told.

          HIS HEADING IS NOT REPEATED. He specified "Insurance Requirements" above this
          paragraph; the screen's own title already says Commercial Insurance, and two headings
          for one block is furniture. The words that carry the obligation are verbatim; the
          second heading is the thing that was dropped. */}
      <Sub>
        {t('traveler.insRequirementsStatement')}
      </Sub>
      <Sub style={{ marginTop: 8 }}>
        {t('traveler.liveryVerifyNotSell')}
      </Sub>
      {configResolved && !config && (
        <Card style={[styles.statusCard, { marginTop: 16 }]}>
          <Text style={styles.statusTitle}>{t('operator.commercialInsurance')}</Text>
          <Text style={styles.body}>{t('traveler.insJurisdictionUnavailable')}</Text>
        </Card>
      )}
      {st === 'ok' && (
        <View style={styles.badgeRow}>
          <BadgeOk label={t('operator.verified')} />
        </View>
      )}

      {/* COVERAGE ON FILE. The expiry is extracted from the accepted declarations page. */}
      <SectionLabel style={styles.lbl}>{t('operator.coverageOnFile')}</SectionLabel>
      <Card style={styles.coverCard}>
        <Text style={styles.coverLabel}>{t('traveler.policyExpiry')}</Text>
        <Text style={styles.expiryValue}>{op.insuranceExpiry || '—'}</Text>
        <Text style={styles.coverNote}>
          {op.coverageDaysLeft == null
            ? t('traveler.insNoDateOnFile')
            : op.coverageDaysLeft < 0
              ? t('traveler.insExpired')
              : op.coverageDaysLeft <= 30
                ? t('traveler.insDaysLeft', { n: op.coverageDaysLeft })
                : t('traveler.insOnFileUntil', { date: op.insuranceExpiry })}
        </Text>
      </Card>

      <SectionLabel style={styles.lbl}>{t('traveler.insStatusTitle')}</SectionLabel>
      <Card style={styles.statusCard}>
        <Text style={styles.statusTitle}>
          {liveStatus?.ok ? t('traveler.insStatusActive') : t('traveler.insStatusNeedsVerification')}
        </Text>
        <Text style={styles.body}>{t('traveler.insStatusExplain')}</Text>
        <Text style={[styles.body, { marginTop: 8 }]}>{t('traveler.insAnyCarrierAccepted')}</Text>
        <Text style={[styles.body, { marginTop: 8 }]}>{t('traveler.insStatusAutomatic')}</Text>
        <Text style={[styles.body, { marginTop: 8 }]}>{t('traveler.insStatusFallback')}</Text>
        <Text style={[styles.body, { marginTop: 8 }]}>{t('traveler.insEvidenceEmail')}</Text>

        {!!liveStatus?.verificationIssue && (
          <Card style={styles.processCard}>
            <Text style={styles.statusTitle}>{t('traveler.insProviderProcessTitle')}</Text>
            <Text style={styles.body}>{t('traveler.insProviderProcessBody')}</Text>
            {!!liveStatus.verificationIssue.note && (
              <Text style={[styles.body, { marginTop: 8 }]}>{liveStatus.verificationIssue.note}</Text>
            )}
          </Card>
        )}

        {st === 'ok' && (
          <>
            <Text style={[styles.statusTitle, { marginTop: 16 }]}>{t('traveler.insAuthorizeTitle')}</Text>
            <Text style={styles.body}>{t('traveler.insAuthorizeBody')}</Text>
            {liveStatus?.authorized ? (
              <Text style={[styles.body, { marginTop: 8 }]}>{t('traveler.insAuthorized')}</Text>
            ) : (
              <PrimaryButton
                label={t('traveler.insAuthorizeButton')}
                onPress={authorizeStatus}
                disabled={statusBusy}
                style={{ marginTop: 14 }}
              />
            )}

            <Text style={[styles.coverLabel, { marginTop: 16 }]}>{t('traveler.insBrokerEmail')}</Text>
            <TextInput
              value={brokerEmail}
              onChangeText={setBrokerEmail}
              placeholder={t('traveler.insBrokerEmailPh')}
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={styles.coverInput}
            />
            <PrimaryButton
              label={t('traveler.insRequestConfirmation')}
              onPress={requestStatus}
              disabled={statusBusy || !brokerEmail.trim() || !liveStatus?.authorized}
              style={{ marginTop: 14 }}
            />
            {liveStatus?.operatorActionRequired && (
              <Pressable accessibilityRole="button" onPress={confirmUnchanged} disabled={statusBusy} hitSlop={8}>
                <Text style={styles.guidelinesLink}>{t('traveler.insAttest')}</Text>
              </Pressable>
            )}
          </>
        )}
      </Card>

      <SectionLabel style={styles.lbl}>{t('operator.econTitle')}</SectionLabel>
      <Card style={styles.econCard}>
        <Text style={styles.body}>{t('operator.econIntro')}</Text>
        <PrimaryButton label={t('operator.econYourScenario')} onPress={() => router.navigate('/operator/economics' as never)} style={{ marginTop: 14 }} />
        <Text style={[styles.body, { marginTop: 16 }]}>{t('traveler.insNoHoursNeeded')}</Text>
        <View style={styles.econInputs}>
          <View style={styles.econField}>
            <Text style={styles.coverLabel}>{t('traveler.insMonthlyPremium')}</Text>
            <TextInput value={monthlyPremium} onChangeText={setMonthlyPremium} keyboardType="decimal-pad" maxLength={10} accessibilityLabel={t('traveler.insMonthlyPremium')} style={styles.econInput} />
          </View>
        </View>
        {fareNeededAR != null && <><Text style={[styles.coverLabel, { marginTop: 18 }]}>{t('traveler.insPremiumOffset')}</Text><View style={styles.econRows}>
          <View style={styles.econRow}>
            <Text style={styles.body}>{t('traveler.insPremiumOffsetAR')}</Text>
            <Text style={styles.econValue}>{money(fareNeededAR)}</Text>
          </View>
        </View></>}
        <Text style={styles.disclaimer}>{t('operator.econDisclaimer')}</Text>
      </Card>

      {/* CONTINUING COVERAGE. The expiry date is deterministic and gates duty/acceptance.
          Mid-term cancellation is harder: a standard certificate-holder designation is only
          evidence and does NOT by itself guarantee cancellation notice. Where the underlying
          policy offers a notice-of-cancellation/non-renewal endorsement, the broker/carrier
          should issue that evidence to American Rider. Otherwise renewal/periodic verification
          remains necessary. Never tell an Operator that a plain COI creates notice rights. */}
      {/* THE REQUIREMENT STAYS, THE ADVICE MOVES (Chad, 18 Sept 2026). What an operator must
          do to this policy is one line and belongs here; what to buy, what it costs at each
          age and how to ask for it is a page for somebody buying their first livery policy,
          one tap away, and furniture in front of somebody who already holds one. */}
      <SectionLabel style={styles.lbl}>{t('operator.namingAmericanRider')}</SectionLabel>
      <Card style={[styles.listCard, { paddingVertical: 16 }]}>
        <Text style={styles.body}>
          {t('traveler.certificateHolder')}
        </Text>
      </Card>

      <Pressable accessibilityRole="button" onPress={() => router.navigate('/operator/guidelines')} hitSlop={8}>
        <Text style={styles.guidelinesLink}>{t('operator.coverageGuidelinesLink')}</Text>
      </Pressable>

      {/* THE ONE CALL, ahead of the national quote pages, because it is the one where
          somebody is expecting this operator. Absent entirely until a broker is engaged —
          a referral to nobody is worse than no referral. */}
      {config?.state === 'FL' && BROKER && (() => {
        // Bound once so the closures below cannot be narrowed away by the compiler.
        const broker = BROKER;
        return (
        <>
          <SectionLabel style={styles.lbl}>{t('operator.referredBroker')}</SectionLabel>
          <Card style={styles.brokerCard}>
            <Text style={styles.brokerName}>{broker.name}</Text>
            <Text style={styles.brokerNote}>{t(broker.note)}</Text>
            <Pressable accessibilityRole="button" onPress={() => Linking.openURL(`tel:${broker.phone.replace(/[^0-9+]/g, '')}`)}>
              <Text style={styles.brokerCall}>{broker.phone}</Text>
            </Pressable>
            {!!broker.email && (
              <Pressable accessibilityRole="button" onPress={() => Linking.openURL(`mailto:${broker.email}`)}>
                <Text style={styles.brokerEmail}>{broker.email}</Text>
              </Pressable>
            )}
            {!!broker.hours && <Text style={styles.brokerMeta}>{t(broker.hours)}</Text>}
            {!!broker.license && (
              <Text style={styles.brokerMeta}>
                {t('traveler.floridaLicenceNo', { no: broker.license })}
              </Text>
            )}
            {/* An operator sent to a broker by the company that profits from their fares is
                entitled to know whether we are paid to send them. */}
            <Text style={styles.brokerNeutral}>
              {t('traveler.noCommissionOnPremium')}
            </Text>
          </Card>
        </>
        );
      })()}

      {/* WHAT TO SAY ON THE CALL (Chad, 20 Sept 2026), WORD FOR WORD.
          An operator who rings an agency and says "I drive for a rideshare company" is sold a
          rideshare ENDORSEMENT — a cheap add-on to a personal policy that does not cover a
          for-hire passenger and does not satisfy §627.748. The words below ask for the right
          product by name and close the door on the wrong one. They are printed rather than
          summarised because a summary is what gets mis-said at the counter. */}
      <SectionLabel style={styles.lbl}>{t('operator.whatToSay')}</SectionLabel>
      {/* THE ONE LINE, ABOVE THE PARAGRAPH. An operator standing at a counter or holding a
          telephone reads the first line and starts talking; the full script is there for
          whoever wants the words. Both say the same thing, which is the point — the short one
          has to be right on its own. */}
      <Text style={styles.fixedInstruction}>{t('traveler.insFixedInstruction')}</Text>
      {config ? (
        <Card style={styles.scriptCard}>
          <Text style={styles.script}>{config.script}</Text>
        </Card>
      ) : (
        <Card style={styles.scriptCard}>
          <Text style={styles.body}>{t('traveler.insJurisdictionUnavailable')}</Text>
        </Card>
      )}
      {/* THE SCRIPT STAYS IN ENGLISH IN ALL FIVE CATALOGUES, ON PURPOSE. It is read aloud to a
          Florida insurance agent, so a Spanish or German rendering would be a script that does
          not work at the counter — the one place it has a job to do. The instruction ABOUT it
          is translated, because that is what the operator has to understand. */}
      <Text style={styles.disclaimer}>{t('traveler.insCallScriptNote')}</Text>

      <SectionLabel style={styles.lbl}>{t('operator.compareProviders')}</SectionLabel>
      {config ? (
        <>
          <Text style={styles.coverLabel}>{t('traveler.insNationalSources')}</Text>
          <Card style={styles.listCard}>
            {nationalInsurers.filter((x) => !x.secondary || showMore).map((x, i) => (
              <Pressable accessibilityRole="button" key={x.name} onPress={() => (x.url ? Linking.openURL(x.url) : Linking.openURL(`tel:${(x.phone || '').replace(/[^0-9+]/g, '')}`))}>
                <View style={[styles.insurerRow, i > 0 && styles.hair]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.insurerName}>{x.name}</Text>
                    <Text style={styles.insurerNote}>{t(x.note)}</Text>
                  </View>
                  <Text style={styles.insurerLink}>{x.url ? t('traveler.quote') : t('traveler.call')} ›</Text>
                </View>
              </Pressable>
            ))}
          </Card>
          {stateInsurers.length > 0 && (
            <>
              <Text style={[styles.coverLabel, { marginTop: 16 }]}>{t('traveler.insStateSources', { state: config.stateName })}</Text>
              <Card style={styles.listCard}>
                {stateInsurers.map((x, i) => (
                  <Pressable accessibilityRole="button" key={x.name} onPress={() => (x.url ? Linking.openURL(x.url) : Linking.openURL(`tel:${(x.phone || '').replace(/[^0-9+]/g, '')}`))}>
                    <View style={[styles.insurerRow, i > 0 && styles.hair]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.insurerName}>{x.name}</Text>
                        <Text style={styles.insurerNote}>{t(x.note)}</Text>
                        {!!x.unverified && <Text style={styles.insurerUnverified}>{t('traveler.insNotLicenceChecked')}</Text>}
                      </View>
                      <Text style={styles.insurerLink}>{x.url ? t('traveler.quote') : t('traveler.call')} ›</Text>
                    </View>
                  </Pressable>
                ))}
              </Card>
            </>
          )}
        </>
      ) : (
        <Card style={styles.listCard}>
          <Text style={[styles.body, { paddingVertical: 16 }]}>{t('traveler.insJurisdictionUnavailable')}</Text>
        </Card>
      )}
      {!showMore && (
        <Pressable accessibilityRole="button" onPress={() => setShowMore(true)} hitSlop={8}>
          <Text style={styles.guidelinesLink}>{t('operator.compareMoreOptions')} ›</Text>
        </Pressable>
      )}
      <Text style={styles.disclaimer}>
        {t('traveler.insNoAdvice')}
      </Text>
      {/* The referral-fee statement is a legal necessity, not a courtesy. Taking a fee for an
          insurance referral without an insurance producer's licence is a real exposure; saying
          plainly that we take none is what keeps the arrangement clean. It is stated on the
          broker card as well, where the recommendation actually is. */}
      <Text style={styles.disclaimer}>
        {t('traveler.insVerifyLicence')}
      </Text>

      <View style={{ flex: 1 }} />
      {st !== 'ok' && (
        <>
          {/* WAS: "Verify My Policy", which called verifyDoc and ticked the step after 900
              milliseconds without a policy ever being seen. It now submits the declarations
              page and reports what was read — including a refusal, which this screen must be
              able to deliver: a personal-use policy does not establish qualifying commercial
              passenger-transport coverage. */}
          <Text style={styles.testNote}>
            {t('traveler.declarationsPage')}
          </Text>
          <PrimaryButton
            label={st === 'checking' ? t('traveler.busyReading') : t('traveler.submitMyPolicy')}
            disabled={st === 'checking' || !config}
            onPress={() =>
              Alert.alert(t('operator.commercialInsurance'), t('traveler.insWhereDecPage'), [
                { text: t('traveler.takePhotograph'), onPress: () => submitPolicy(true) },
                { text: t('traveler.chooseFile'), onPress: () => submitPolicy(false) },
                { text: 'Cancel', style: 'cancel' },
              ])
            }
            style={{ marginTop: 12 }}
          />
        </>
      )}
      {/* Insurance disclosures remain reachable here as well as at the duty gate. */}
      <Pressable accessibilityRole="button" onPress={() => router.navigate('/operator/disclosure')} hitSlop={8}>
        <Text style={styles.disclosureLink}>
          {t('traveler.whatWeInsure')}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusCard: { marginTop: 12, paddingVertical: 18, paddingHorizontal: 20 },
  processCard: { marginTop: 14, paddingVertical: 14, paddingHorizontal: 16 },
  statusTitle: { fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: 8 },
  econCard: { paddingVertical: 18, paddingHorizontal: 20 },
  compareBlock: { marginTop: 18 },
  scaleBlock: { marginTop: 14 },
  econInputs: { marginTop: 16, gap: 12 },
  econField: { gap: 6 },
  econInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingHorizontal: 14,
    paddingVertical: 11, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'],
  },
  econRows: { marginTop: 16 },
  econRow: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.hairline,
  },
  econValue: { fontSize: 15, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  coverCard: { marginTop: 12, paddingVertical: 18, paddingHorizontal: 20 },
  coverLabel: { fontSize: 13, color: colors.muted },
  expiryValue: { fontSize: 22, fontWeight: '600', color: colors.ink, marginTop: 8, fontVariant: ['tabular-nums'] },
  coverInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  coverNote: { fontSize: 13, color: colors.muted, marginTop: 10, lineHeight: 19 },
  badgeRow: { flexDirection: 'row', marginTop: 16 },
  lbl: { marginTop: 24, marginBottom: 12 },
  listCard: { paddingVertical: 2, paddingHorizontal: 20 },
  body: { fontSize: 14, color: colors.muted, lineHeight: 20.5 },
  hair: { borderTopWidth: 1, borderTopColor: colors.hairline },
  brokerCard: { backgroundColor: colors.blueTint, borderColor: colors.blueBorder },
  brokerName: { fontSize: 16, fontWeight: '600', color: colors.ink },
  brokerNote: { fontSize: 13, color: colors.muted, marginTop: 3, lineHeight: 18 },
  brokerCall: { fontSize: 15, color: colors.ink, fontWeight: '600', marginTop: 10 },
  brokerMeta: { fontSize: 12, color: colors.muted, marginTop: 4 },
  brokerNeutral: { fontSize: 12.5, color: colors.ink, marginTop: 12, lineHeight: 18 },
  brokerEmail: { fontSize: 14, color: colors.ink, marginTop: 6 },
  fixedInstruction: { fontSize: 14.5, color: colors.ink, lineHeight: 21, marginBottom: 12, fontWeight: '600' },
  scriptCard: { paddingVertical: 18, paddingHorizontal: 20 },
  script: { fontSize: 14, color: colors.ink, lineHeight: 21, fontStyle: 'italic' },
  insurerUnverified: { fontSize: 11.5, color: colors.faint, marginTop: 4, lineHeight: 16.5 },

  insurerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  insurerName: { fontSize: 15, color: colors.ink },
  insurerNote: { fontSize: 12.5, color: colors.muted, marginTop: 3 },
  // Ink, not the demo's link blue (Chad, 18 Sept 2026), as on the operator page.
  insurerLink: { fontSize: 13, fontWeight: '600', color: colors.ink },
  guidelinesLink: { fontSize: 15, fontWeight: '600', color: colors.ink, marginTop: 16 },
  disclaimer: { fontSize: 11.5, color: colors.faint, marginTop: 10, lineHeight: 17.25 },
  disclosureLink: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.ink,
    marginTop: 18,
  },
  testNote: { fontSize: 11.5, color: colors.faint, marginTop: 24, lineHeight: 16.7 },
});
