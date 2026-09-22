// Operator Support — the operator's own path to the platform AI.
//
// IT DID NOT EXIST UNTIL 20 SEPT 2026. Patron Support has answered travelers since 16 August:
// an AI reads the case, explains or refunds up to $45 against the real payment, and hands
// anything it should not decide to a person. An operator whose traveler never appeared, whose
// travel was cancelled after they had driven to the kerb, or whose fare looked wrong had no
// path at all — not a worse one, none. That is the wrong way round for a company whose whole
// proposition is that operators are treated better here.
//
// THE REMEDY IS A PAYMENT, NOT A REFUND. Money goes out to the operator, and it is American
// Rider's; a completed fare is never taken back from a traveler to settle this. The server
// enforces that, not this screen.
//
// NOTHING IS CLAIMED HERE THAT THE SERVER DID NOT DO. The outcome states what actually
// happened — paid, answered, or filed with a case number — because the defect this whole area
// was rebuilt to remove was a screen saying "a specialist is responding" while nothing had
// been sent to anybody.
import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../src/components/AppText';
import { useGoBack } from '../../src/components/nav';
import { BackLink, Card, Mono, PrimaryButton, Screen, SectionLabel, Sub, Title } from '../../src/components/UI';

import { raiseOperatorIssue, type OperatorSupportOutcome } from '../../src/backend/support';
import { useOperator } from '../../src/state/OperatorContext';
import { useLanguage } from '../../src/state/LanguageContext';
import { colors } from '../../src/theme';

export default function OperatorSupport() {
  const { t } = useLanguage();
  const goBack = useGoBack();
  const op = useOperator();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<OperatorSupportOutcome | null>(null);

  const send = async () => {
    const description = text.trim();
    if (!description || busy) return;
    setBusy(true);
    setOut(null);
    // THE TRAVEL THE OPERATOR ACTUALLY LAST CARRIED, or nothing at all. The server reasons
    // from these figures, so a guessed or seeded journey would have it reasoning about a
    // travel that never happened — the same fault the emergency screen carried until
    // yesterday, where AR-2047-MIA was read out to somebody who had taken no journey.
    //
    // `earn` is what the OPERATOR received, which is 99% of the fare; `fare` is the fare. The
    // server is given the fare, because that is the figure both sides' arithmetic starts from.
    // When there is no completed travel the case simply carries none, and the resolver is
    // instructed to escalate anything it cannot establish from the record.
    const done = op.lastCompleted;
    const travel = done
      ? {
          no: done.no,
          dep: done.dep,
          arr: done.arr,
          totalCents: Math.round(done.fare * 100),
          date: new Date(done.at).toISOString().slice(0, 10),
        }
      : null;
    const result = await raiseOperatorIssue({ description, travel });
    setOut(result);
    setBusy(false);
  };

  return (
    <Screen>
      <BackLink label={t('common.back')} onPress={goBack} />
      <Title>{t('operator.supportTitle')}</Title>
      <Sub>{t('operator.supportIntro')}</Sub>

      {!out && (
        <>
          <SectionLabel style={styles.lbl}>{t('operator.supportWhatHappened')}</SectionLabel>
          <Card style={styles.card}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder={t('operator.supportPlaceholder')}
              placeholderTextColor={colors.faint}
              multiline
              editable={!busy}
              textAlignVertical="top"
            />
          </Card>
          <PrimaryButton
            label={busy ? t('operator.supportSending') : t('operator.supportSend')}
            disabled={busy || !text.trim()}
            onPress={send}
            style={{ marginTop: 14 }}
          />
          {/* Said before they write, not after they are refused: an operator typing out an
              account of something frightening and then being told a machine will not read it
              has been made to relive it for nothing. */}
          <Text style={styles.note}>{t('operator.supportSafetyNote')}</Text>
        </>
      )}

      {!!out && (
        <>
          <Card style={styles.card}>
            <Text style={styles.answer}>
              {out.unreachable ? t('operator.supportUnreachable') : out.message || t('operator.supportFiledPlain')}
            </Text>
            {out.paid && typeof out.payCents === 'number' && (
              <Text style={styles.paid}>
                {t('operator.supportPaid')} <Mono>{`$${(out.payCents / 100).toFixed(2)}`}</Mono>
              </Text>
            )}
            {!!out.caseNo && out.filed && (
              <Text style={styles.caseNo}>
                {t('operator.supportCaseNo')} <Mono>{out.caseNo}</Mono>
              </Text>
            )}
          </Card>
          <PrimaryButton
            label={t('operator.supportAnother')}
            onPress={() => { setOut(null); setText(''); }}
            style={{ marginTop: 14 }}
          />
        </>
      )}
      <View style={{ flex: 1 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lbl: { marginTop: 24, marginBottom: 12 },
  card: { paddingVertical: 16, paddingHorizontal: 18, marginTop: 12 },
  input: { minHeight: 130, fontSize: 15, color: colors.ink, lineHeight: 22 },
  answer: { fontSize: 15, color: colors.ink, lineHeight: 22 },
  paid: { fontSize: 14, color: colors.ink, marginTop: 14, fontWeight: '600' },
  caseNo: { fontSize: 13, color: colors.muted, marginTop: 12 },
  note: { fontSize: 12, color: colors.faint, marginTop: 16, lineHeight: 17.5 },
});
