// Background Check step.
//
// WHAT CHANGED, AND WHY IT HAD TO — twice now.
//
// First (August): this screen said the fee "goes to the licensed screening company, never to
// American Rider" — describing an operator buying a consumer report about themselves and
// handing it in. That does not satisfy Fla. Stat. §627.748: the TNC must conduct or arrange
// the check, and under the FCRA a report belongs to the end user who ordered it with a
// permissible purpose. It is the same reason Uber does not accept Lyft's.
//
// Second (26 Aug 2026): the button on this screen marked the document verified in the
// phone's memory and no check was ever ordered — said honestly ("Test program"), and honest
// was the best that flow could be, because no screening account existed. Now one does. When
// the server reports a live provider this screen runs the real pipeline: pay the
// pass-through fee in Stripe's sheet → the server orders from Checkr → the operator finishes
// Checkr's own hosted forms from their email → the server decides by statute and this screen
// shows the server's record. The phone never decides anything. The test-program path remains
// only for a build pointed at a server with no provider, and still says so out loud.
import React from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../src/components/AppText';
import { useGoBack } from '../../src/components/nav';
import { BadgeOk } from '../../src/components/operator';
import { BackLink, Card, Mono, PrimaryButton, Screen, SectionLabel, Sub, Title } from '../../src/components/UI';
import {
  declareExistingScreening,
  fetchScreening,
  orderScreening,
  payScreeningFee,
  reinviteScreening,
  type ScreeningStatus,
} from '../../src/backend/screening';
import { useOperator } from '../../src/state/OperatorContext';
import { useLanguage } from '../../src/state/LanguageContext';
import { colors, fmt } from '../../src/theme';

// Mirrors SCREENING_FEE_CENTS in backend/screening.js. THE TWO MUST NEVER DISAGREE: an
// operator quoted one figure and charged another has been shown two prices for one thing,
// which is the defect this codebase treats as the most serious there is. (The server's
// answer wins on this screen; this constant is only the placeholder before it loads.)
const SCREENING_FEE = 4749;

// KEYS, NOT SENTENCES. A module-level array of translated strings is evaluated once at
// import time — before the stored language is read — so it would pin this screen to the
// default locale for the life of the process. The keys are constant; the words are not.
const POINT_KEYS: [string, string][] = [
  ['traveler.bgArrangedTitle', 'traveler.bgArrangedBody'],
  ['traveler.bgAtCostTitle', 'traveler.bgAtCostBody'],
  ['traveler.bgDetailsTitle', 'traveler.bgDetailsBody'],
  ['traveler.bgStandardTitle', 'traveler.bgStandardBody'],
  ['traveler.bgRecheckTitle', 'traveler.bgRecheckBody'],
];

const dateLabel = (when: string | number) =>
  new Date(when).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export default function OperatorBackground() {
  const { t } = useLanguage();
  const goBack = useGoBack();
  const op = useOperator();
  const st = op.docs.background;

  const [status, setStatus] = React.useState<ScreeningStatus | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // The free route's little form.
  const [agency, setAgency] = React.useState('');
  const [criminalIncluded, setCriminalIncluded] = React.useState(true);
  const [drivingIncluded, setDrivingIncluded] = React.useState(false);
  const [declared, setDeclared] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    fetchScreening().then(setStatus);
  }, []);
  React.useEffect(refresh, [refresh]);

  const live = !!status?.provider;
  const record = status?.screening || null;
  const decision = record?.decision;
  const feeCents = status?.feeCents ?? SCREENING_FEE;
  // The itemized quote: check cost + card processing = what the operator actually pays.
  // Server-computed; the app never does fee math. Absent (older server), the cost alone shows.
  const quote = status?.quote;
  const payTotal = quote?.totalCents ?? feeCents;

  // The server's record is the truth about this document, in BOTH directions. A pass marks
  // the checklist ok, dated by the REPORT (not by today). Anything else un-marks it — which
  // retires any "verified" the old test program left in the phone's memory: with a live
  // provider, nobody keeps a verification no check produced. (Dispatch is already gated
  // server-side either way; this keeps the phone from telling a nicer story than the record.)
  React.useEffect(() => {
    if (!live || !status) return;
    op.syncBackground(decision === 'pass', record?.conductedAt ?? null);
  }, [live, status, decision, record?.conductedAt, op]);

  const payAndOrder = async () => {
    setBusy(true);
    setError(null);
    const paid = await payScreeningFee();
    if (!paid.ok) {
      setBusy(false);
      if (!paid.canceled) setError(paid.error || t('traveler.bgPaymentFailed'));
      return;
    }
    const ordered = await orderScreening(paid.paymentIntentId);
    setBusy(false);
    if (!ordered.ok) {
      setError(
        (ordered.error || t('traveler.bgOrderFailed')) +
          t('traveler.bgPaymentRecorded'),
      );
      return;
    }
    refresh();
  };

  const newLink = async () => {
    setBusy(true);
    setError(null);
    const out = await reinviteScreening();
    setBusy(false);
    if (!out.ok) setError(out.error || t('traveler.bgNoNewLink'));
    refresh();
  };

  const declare = async () => {
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
          ? t('traveler.bgHaveThemEmail', { agency: agency.trim(), email: out.transferTo }) +
            (out.transferCaseNo ? t('traveler.bgCitingCase', { caseNo: out.transferCaseNo }) : '.')
          : ''),
    );
    refresh();
  };

  // ---- What the current server record means for this screen -------------------------------

  const passed = decision === 'pass';
  const showActions = live && !passed && decision !== 'refuse';

  return (
    <Screen>
      <BackLink label={t('common.back')} onPress={goBack} />
      <Title>{t('operator.backgroundCheck')}</Title>
      <Sub>
        {t('traveler.bgCheckSub')}
      </Sub>

      {/* THE SERVER'S RECORD, when there is one that needs showing. */}
      {live && record && !passed && decision && (
        <Card style={styles.stateCard}>
          <Text style={styles.pointTitle}>
            {decision === 'invited' && 'Check your email'}
            {(decision === 'in_progress' || decision === 'ordered') && t('traveler.bgRunning')}
            {decision === 'expired' && t('traveler.bgLinkExpired')}
            {decision === 'review' && t('traveler.bgUnderPersonReview')}
            {decision === 'refuse' && t('traveler.bgNotEligible')}
            {decision === 'awaiting_agency' && t('traveler.bgWaitingPrevious')}
            {decision === 'awaiting_provider' && 'Paid — ordering shortly'}
          </Text>
          <Text style={styles.pointBody}>{record.summary || ''}</Text>
          {decision === 'awaiting_agency' && record.transferTo ? (
            <Text style={styles.pointBody}>
              {t('traveler.bgHaveThemEmail', {
                provider: record.provider || t('traveler.bgThem'),
                email: record.transferTo,
                case: record.transferCaseNo
                  ? t('traveler.bgCitingCase', { no: record.transferCaseNo })
                  : '',
              })}
            </Text>
          ) : null}
          {decision === 'invited' && record.invitationUrl ? (
            <Pressable onPress={() => Linking.openURL(record.invitationUrl!)}>
              <Text style={styles.link}>{t('operator.openScreeningForm')}</Text>
            </Pressable>
          ) : null}
          {decision === 'expired' ? (
            <PrimaryButton
              label={busy ? t('traveler.busySending') : t('traveler.bgEmailNewLink')}
              disabled={busy}
              onPress={newLink}
              style={{ marginTop: 12 }}
            />
          ) : null}
        </Card>
      )}

      {/* THE FREE ROUTE COMES FIRST, and that ordering is the whole point. Most people signing
          up here have driven for somebody else and have already been screened. Showing them
          $47.49 first and the way round it second means some of them pay it without ever
          reading the second card. The cheaper path is the default; the fee is the fallback. */}
      {showActions && !decision && (
        <>
          {/* WHAT THE LAW ACTUALLY SAYS, on the screen where somebody is asked to pay for it
              (Chad, 27 Aug: "we may demonstrate the law and or cite it", and "we do not want
              to force a package that is not required, ever").

              Naming the three searches is the only way an operator can check that claim for
              themselves. A company that says "the law requires this" without saying which law
              or which parts is asking to be taken on trust for a charge — and the whole design
              of this screen is that nothing here needs to be taken on trust. */}
          <SectionLabel style={styles.lbl}>{t('operator.whatFloridaRequires')}</SectionLabel>
          <Card style={styles.listCard}>
            <View style={styles.pointRow}>
              <Text style={styles.pointBody}>
                Fla. Stat. §627.748(12)(a) requires American Rider to obtain three things before
                you may accept travel:
              </Text>
            </View>
            <View style={[styles.pointRow, styles.hair]}>
              <Text style={styles.pointTitle}>{t('traveler.criminalSearch')}</Text>
              <Text style={styles.pointBody}>
                §627.748(12)(a)2.a — a multi-state database, with anything it finds confirmed at
                the original court record.
              </Text>
            </View>
            <View style={[styles.pointRow, styles.hair]}>
              <Text style={styles.pointTitle}>{t('operator.nsopw')}</Text>
              <Text style={styles.pointBody}>
                §627.748(12)(a)2.b — the register maintained by the U.S. Department of Justice.
              </Text>
            </View>
            <View style={[styles.pointRow, styles.hair]}>
              <Text style={styles.pointTitle}>{t('traveler.drivingHistory')}</Text>
              <Text style={styles.pointBody}>
                §627.748(12)(a)3 — its own requirement, separate from the criminal search. A
                criminal database holds no driving records, so it cannot answer two of the
                state’s own disqualifying questions: driving on a suspended licence, and more
                than three moving violations in three years.
              </Text>
            </View>
            <View style={[styles.pointRow, styles.hair]}>
              <Text style={styles.pointTitle}>{t('operator.theseThreeOnly')}</Text>
              <Text style={styles.pointBody}>
                {t('traveler.statuteNamesOnly')}
              </Text>
            </View>
          </Card>

          <SectionLabel style={styles.lbl}>{t('operator.ifScreenedBefore')}</SectionLabel>
          <Card style={styles.listCard}>
            <View style={styles.pointRow}>
              <Text style={styles.pointTitle}>{t('operator.haveItSent')}</Text>
              <Text style={styles.pointBody}>
                {t('traveler.priorScreeningRelease')}
              </Text>
            </View>
            {declared ? (
              <View style={[styles.pointRow, styles.hair]}>
                <Text style={styles.pointTitle}>{t('operator.recorded')}</Text>
                <Text style={styles.pointBody}>{declared}</Text>
              </View>
            ) : (
              <View style={[styles.pointRow, styles.hair]}>
                <TextInput
                  value={agency}
                  onChangeText={setAgency}
                  placeholder={t('operator.screeningCompanyPh')}
                  placeholderTextColor={colors.faint}
                  style={styles.input}
                />
                <Pressable style={styles.toggleRow} onPress={() => setCriminalIncluded((v) => !v)}>
                  <Text style={styles.toggleMark}>{criminalIncluded ? '☑' : '☐'}</Text>
                  <Text style={styles.toggleLabel}>{t('operator.includedCriminal')}</Text>
                </Pressable>
                <Pressable style={styles.toggleRow} onPress={() => setDrivingIncluded((v) => !v)}>
                  <Text style={styles.toggleMark}>{drivingIncluded ? '☑' : '☐'}</Text>
                  <Text style={styles.toggleLabel}>{t('operator.includedDriving')}</Text>
                </Pressable>
                <Text style={styles.consentNote}>{t('operator.consentInstruction')}</Text>
                <PrimaryButton
                  label={busy ? t('traveler.busyRecording') : t('traveler.bgInstructThem')}
                  disabled={busy}
                  onPress={declare}
                  style={{ marginTop: 10 }}
                />
              </View>
            )}
          </Card>
        </>
      )}

      {/* THE AMOUNT, SAID PLAINLY AND ONCE. Mono, because it is money. The server's figure:
          $47.49 for the whole check, or $17.50 when an accepted report covers the criminal
          half and only the driving history is missing. */}
      {showActions && (decision == null || decision === 'awaiting_agency') && (
        <>
          <SectionLabel style={styles.lbl}>
            {feeCents === SCREENING_FEE ? t('traveler.bgIfYouHaveNot') : t('traveler.bgWhatIsLeft')}
          </SectionLabel>
          <Card style={styles.feeCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pointTitle}>{t('operator.weOrderYours')}</Text>
              {/* ITEMIZED, always (Chad, 27 Aug): the check's exact cost, the card
                  processor's exact cut, nothing else and nothing hidden. */}
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>{t('operator.backgroundCheckLine')}</Text>
                <Mono size={13}>{fmt((quote?.costCents ?? feeCents) / 100)}</Mono>
              </View>
              {quote ? (
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>{t('operator.cardProcessing')}</Text>
                  <Mono size={13}>{fmt(quote.processingCents / 100)}</Mono>
                </View>
              ) : null}
              <Text style={styles.feeNote}>
                The check fee goes to the screening company in full; the processing fee goes
                to the card network. American Rider keeps neither.
              </Text>
            </View>
            <Mono size={20}>{fmt(payTotal / 100)}</Mono>
          </Card>
          <Text style={styles.lawNote}>
            Florida law (Fla. Stat. §627.748) requires this screening of every operator before
            they may drive. Our travelers ride on it — full adherence is how American Rider
            keeps that promise.
          </Text>
          <PrimaryButton
            label={busy ? t('traveler.busyWorking') : `Pay ${fmt(payTotal / 100)} & Begin`}
            disabled={busy}
            onPress={payAndOrder}
            style={{ marginTop: 14 }}
          />
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {live && !status && <ActivityIndicator style={{ marginTop: 18 }} />}

      <SectionLabel style={styles.lbl}>{t('operator.howItWorks')}</SectionLabel>
      <Card style={styles.listCard}>
        {POINT_KEYS.map(([title, body], i) => (
          <View key={title} style={[styles.pointRow, i > 0 && styles.hair]}>
            <Text style={styles.pointTitle}>{t(title)}</Text>
            <Text style={styles.pointBody}>{t(body)}</Text>
          </View>
        ))}
      </Card>

      {(passed || (st === 'ok' && op.bgCheckedAt)) && (
        <>
          <SectionLabel style={styles.lbl}>{t('operator.verification')}</SectionLabel>
          <Card style={styles.verifiedCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.verifiedTitle}>
                {t('traveler.bgPassedOn', {
                  date: dateLabel(record?.conductedAt || op.bgCheckedAt || Date.now()),
                })}
              </Text>
              <Text style={styles.verifiedSub}>
                {t('traveler.bgNextCheckDue', {
                  date: record?.recheckDue
                    ? dateLabel(record.recheckDue)
                    : `${new Date(op.bgCheckedAt || Date.now()).getFullYear() + 3}`,
                })}{' '}
                · tracked automatically
              </Text>
            </View>
            <BadgeOk label={t('operator.verified')} />
          </Card>
        </>
      )}

      <View style={{ flex: 1 }} />
      {/* THE TEST-PROGRAM PATH — only when the server itself says no provider exists, and
          still saying so out loud. An operator must never be told they passed a check that
          was never run. */}
      {!live && status && st !== 'ok' && (
        <>
          <Text style={styles.testNote}>
            {t('traveler.noScreeningOrdered')}
          </Text>
          <PrimaryButton
            label={st === 'checking' ? t('traveler.busyChecking') : t('traveler.beginBackgroundCheck')}
            disabled={st === 'checking'}
            onPress={() => {
              op.verifyDoc('background');
              goBack();
            }}
            style={{ marginTop: 12 }}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lbl: { marginTop: 24, marginBottom: 12 },
  stateCard: { marginTop: 20, paddingVertical: 16, paddingHorizontal: 18 },
  feeCard: {
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  feeNote: { fontSize: 12.5, color: colors.muted, marginTop: 8, lineHeight: 18 },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingRight: 12 },
  quoteLabel: { fontSize: 13, color: colors.muted },
  lawNote: { fontSize: 11.5, color: colors.faint, marginTop: 12, lineHeight: 16.5 },
  listCard: { paddingVertical: 2, paddingHorizontal: 20 },
  hair: { borderTopWidth: 1, borderTopColor: colors.hairline },
  pointRow: { paddingVertical: 15 },
  pointTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  pointBody: { fontSize: 13, color: colors.muted, marginTop: 5, lineHeight: 19.5 },
  link: { fontSize: 14, fontWeight: '600', color: colors.blue, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  toggleMark: { fontSize: 16, color: colors.ink },
  toggleLabel: { fontSize: 13.5, color: colors.ink },
  consentNote: { fontSize: 11.5, color: colors.faint, marginTop: 12, lineHeight: 16.5 },
  error: { fontSize: 13, color: '#c0392b', marginTop: 14, lineHeight: 18.5 },
  verifiedCard: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  verifiedTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  verifiedSub: { fontSize: 12.5, color: colors.muted, marginTop: 3, lineHeight: 18 },
  testNote: { fontSize: 11.5, color: colors.faint, marginTop: 24, lineHeight: 16.7 },
});
