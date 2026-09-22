// The insurance disclosure Florida requires — Fla. Stat. §627.748(8)(a).
//
// WHY THIS IS A SCREEN AND NOT A PARAGRAPH. The statute says the disclosure must be made
// "before a TNC driver is allowed to accept a request for a prearranged ride". That is a gate,
// not a page: a disclosure filed under Help that nobody opened has not been made. Going on
// duty is refused until it is acknowledged, and the acknowledgement is stored on the account
// with the exact text and the moment — see backend/disclosure.js.
//
// WHY THE ANSWER IS "NONE", AND WHY THAT IS FINE. §627.748(7) permits the required coverage to
// be maintained by the driver rather than the company, so American Rider provides none. The
// statute does not require a company to carry insurance; it requires a company to SAY what it
// carries. Saying "none" plainly, once, in a place the operator cannot miss, is what
// compliance looks like here — and it is also the only honest way to ask somebody to drive.
//
// THE VOICE. This is the screen where an operator learns they are uninsured by us. It does not
// soften that, does not apologise for it, and does not bury it under what they should do
// instead. The rubric's own words: state the fact and stop.
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/AppText';
import {
  acknowledgeDisclosure,
  fetchDisclosure,
  type Disclosure,
} from '../../src/backend/disclosure';
import { useGoBack } from '../../src/components/nav';
import { BackLink, Card, Chev, PrimaryButton, Screen, Sub, Title } from '../../src/components/UI';
import { useLanguage } from '../../src/state/LanguageContext';
import { colors } from '../../src/theme';

const dateLabel = (ms: number) =>
  new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export default function OperatorDisclosure() {
  const { t } = useLanguage();
  const goBack = useGoBack();
  const router = useRouter();
  const [doc, setDoc] = useState<Disclosure | null>(null);
  const [acknowledgedAt, setAcknowledgedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ONE CERTIFICATE, READ IN PLACE. The three sections are the server's own text
  // (backend/disclosure.js), shown as rows of a single card rather than three separate
  // cards. Nothing is rewritten, summarised or resealed here: the statute periods stay
  // inside the bodies where the server put them (§627.748(7) in "What you must carry").
  //
  // EVERY PART MUST BE OPENED BEFORE THE OPERATOR CAN AGREE (Adrian, 18 Sept 2026).
  // §627.748(8)(a) requires TWO things in writing: what the TNC provides, and that the
  // operator's own policy might not cover them. When the card first shipped, one row opened
  // and the others stayed shut, so an operator could acknowledge text that never appeared on
  // their screen — and the record would then hold words they never read, which is worse than
  // no record. `seen` is the set of rows they have opened. The control stays off until it
  // holds all three, and says which condition is unmet, exactly as the qualification screen
  // says "Verify all 5 to continue".
  const [open, setOpen] = useState<number | null>(0);
  const [seen, setSeen] = useState<number[]>([0]);

  const load = useCallback(() => {
    fetchDisclosure().then((r) => {
      if (!r) return setError(t('traveler.disclosureLoadFail'));
      setDoc(r.disclosure);
      setAcknowledgedAt(r.acknowledged ? r.acknowledgedAt : null);
    });
  }, []);
  useEffect(load, [load]);

  const agree = async () => {
    setBusy(true);
    setError(null);
    const out = await acknowledgeDisclosure();
    setBusy(false);
    if (!out.ok) return setError(out.error);
    setAcknowledgedAt(Date.now());
  };

  const sections = doc ? [doc.provided, doc.ownPolicy, doc.required] : [];
  const allSeen = sections.length > 0 && sections.every((_, i) => seen.includes(i));

  return (
    <Screen>
      <BackLink label={t('common.back')} onPress={goBack} />
      <Title>{t('operator.insuranceDisclosure')}</Title>
      <Sub>
        {t('traveler.flStatuteWritten')}
      </Sub>

      {!!doc && (
        <Card style={styles.certCard}>
          {sections.map((sec, i) => (
            <View key={sec.heading}>
              {i > 0 && <View style={styles.hair} />}
              <Pressable
                onPress={() => {
                  setOpen(open === i ? null : i);
                  setSeen((was) => (was.includes(i) ? was : [...was, i]));
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: open === i }}
                style={styles.accHead}
              >
                <Text style={[styles.heading, { flex: 1 }]}>{sec.heading}</Text>
                {/* A part already opened keeps a quiet mark, so the operator can see which
                    ones remain rather than counting from the control's label alone. */}
                {seen.includes(i) && <Text style={styles.readMark}>{t('operator.partRead')}</Text>}
                <View style={[styles.chevBox, open === i && styles.chevOpen]}>
                  <Chev />
                </View>
              </Pressable>
              {open === i && <Text style={styles.body}>{sec.body}</Text>}
            </View>
          ))}
        </Card>
      )}

      {!!doc && (
        <Text style={styles.cite}>{doc.statute}</Text>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={{ flex: 1 }} />

      {acknowledgedAt ? (
        <Card style={styles.doneCard}>
          <Text style={styles.heading}>
            {t('traveler.acknowledgedOn', { date: dateLabel(acknowledgedAt) })}
          </Text>
          <Text style={[styles.body, { paddingBottom: 0 }]}>
            {t('traveler.disclosureRecorded')}
          </Text>
        </Card>
      ) : (
        <>
          {/* The acknowledgement text is the server's, not this screen's — the words agreed to
              and the words we can produce later have to be the same words. */}
          {!!doc && <Text style={styles.ackText}>{doc.acknowledgement}</Text>}
          <PrimaryButton
            label={
              busy
                ? t('traveler.busyRecording')
                : allSeen
                  ? t('traveler.iHaveReadThis')
                  : t('operator.openAllParts', { n: sections.length })
            }
            disabled={!doc || busy || !allSeen}
            onPress={agree}
            style={{ marginTop: 12 }}
          />
        </>
      )}

      {acknowledgedAt && (
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.done}>{t('traveler.done')}</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // One certificate: a single card, rows divided by hairlines. First row opens flush
  // with the Sub above it, as the first card did before.
  certCard: { marginTop: 22, paddingVertical: 2, paddingHorizontal: 20 },
  accHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  hair: { borderTopWidth: 1, borderTopColor: colors.hairline },
  chevBox: { transform: [{ rotate: '0deg' }] },
  chevOpen: { transform: [{ rotate: '90deg' }] },
  heading: { fontSize: 15.5, fontWeight: '600', color: colors.ink },
  readMark: { fontSize: 11.5, color: colors.muted, letterSpacing: 0.3, marginRight: 2 },
  body: { fontSize: 13.5, color: colors.muted, marginTop: 2, paddingBottom: 16, lineHeight: 20 },
  cite: {
    fontSize: 11.5,
    color: colors.faint,
    marginTop: 16,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  ackText: { fontSize: 13, color: colors.ink2, marginTop: 24, lineHeight: 19.5 },
  doneCard: { paddingVertical: 18, paddingHorizontal: 20, marginTop: 20 },
  error: { fontSize: 13.5, color: colors.red, marginTop: 16, lineHeight: 19 },
  // Ink, not the demo's link blue (Chad, 18 Sept 2026). The control closes the screen and is
  // named for that: it is NOT "Acknowledge Compliance Record", because by the time it shows,
  // the acknowledgement has already been recorded and the date is printed above it.
  done: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'center',
    marginTop: 18,
  },
});
