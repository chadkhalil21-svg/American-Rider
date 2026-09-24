// Operator Qualification — the web demo shell's checklist screen, exactly: the
// wordmark line, "{n} of N verified", the progress segments, the 99% banner, and the
// Add › → Checking… → ✓ Verified theater. The founders' 10 Aug compliance spec adds a
// seventh step (Background Check); Commercial Insurance and Background Check open
// guidance screens, the rest verify inline.
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/AppText';
import { useGoBack } from '../../src/components/nav';
import { BadgeOk } from '../../src/components/operator';
import { Card, PrimaryButton, Screen } from '../../src/components/UI';
import * as Location from 'expo-location';
import { getOperatingMarket, setOperatingMarket, type MarketState } from '../../src/backend/connect';
import { QUAL_DOCS, useOperator } from '../../src/state/OperatorContext';
import { useLanguage } from '../../src/state/LanguageContext';
import { colors } from '../../src/theme';

export default function OperatorQualification() {
  const { t } = useLanguage();
  const router = useRouter();
  const goBack = useGoBack();
  const op = useOperator();

  // Already past this screen? Send the account where it actually is.
  useEffect(() => {
    if (!op.ready) return;
    if (op.verification === 'pending') router.replace('/operator/review');
    else if (op.verification === 'commissioned') router.replace('/operator');
  }, [op.ready, op.verification, router]);

  const n = op.verifiedCount;
  // The checklist remains visible as a record, but the primary action advances to the first
  // unmet requirement. The Operator should not have to understand our compliance graph.
  const nextRequired = QUAL_DOCS.find(
    (d) => op.docs[d.key] !== 'ok' && op.docReviews[d.key]?.verdict !== 'review',
  );
  const continueQualification = () => {
    if (!nextRequired) return;
    const k = nextRequired.key;
    if (k === 'insurance') router.navigate('/operator/insurance');
    else if (k === 'background') router.navigate('/operator/background');
    else if (k === 'license' || k === 'registration' || k === 'inspection')
      router.navigate('/operator/documents');
    else op.verifyDoc(k);
  };
  // A DOCUMENT THE READER HELD MAY GO TO REVIEW. A hold asks for a person, and submitting is
  // how the person is asked. Without this a held licence was a dead end on this screen.
  const done = QUAL_DOCS.every(
    (d) => op.docs[d.key] === 'ok' || op.docReviews[d.key]?.verdict === 'review',
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // THE OPERATING AREA. The server reads documents, orders screening and opens payouts only for
  // an operator whose county is active. Placed from the phone's last known position when there
  // is one and nothing is declared yet; otherwise the operator chooses.
  const [area, setArea] = useState<MarketState | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      let st = await getOperatingMarket();
      if (!st.market) {
        try {
          const perm = await Location.getForegroundPermissionsAsync();
          const pos = perm.granted ? await Location.getLastKnownPositionAsync() : null;
          if (pos) st = await setOperatingMarket({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        } catch {
          /* no position: the operator chooses below */
        }
      }
      if (live) setArea(st);
    })();
    return () => {
      live = false;
    };
  }, []);
  const areaActive = area?.market?.status === 'active';

  return (
    <Screen>
      <Pressable onPress={goBack} hitSlop={10} style={styles.back}>
        <Text style={styles.backText}>{t('traveler.notNowChev')}</Text>
      </Pressable>

      <Text style={styles.wm}>
        AMERICAN RIDER <Text style={styles.wmOp}>· {t('traveler.operatorCaps')}</Text>
      </Text>
      <Text style={styles.title}>{t('operator.operatorQualification')}</Text>
      <Text style={styles.sub}>
        {t('traveler.qualProgress', { n, total: QUAL_DOCS.length })}
      </Text>

      <View style={styles.steps}>
        {QUAL_DOCS.map((d) => (
          <View
            key={d.key}
            style={[
              styles.stepBar,
              { backgroundColor: op.docs[d.key] === 'ok' ? colors.green : colors.border },
            ]}
          />
        ))}
      </View>

      <View style={styles.banner}>
        <Text style={styles.bannerText}>{t('operator.retainOnceCommissioned')}</Text>
      </View>

      {area && (
        <Card style={styles.listCard}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t('operator.operatingArea')}</Text>
              <Text style={styles.rowSub}>
                {areaActive
                  ? area.market!.name
                  : area.market
                    ? t('operator.marketNotActive', { name: area.market.name })
                    : t('operator.chooseOperatingArea')}
              </Text>
              {!areaActive && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                  {area.active.map((m) => (
                    <Pressable
                      key={m.id}
                      hitSlop={6}
                      onPress={async () => setArea(await setOperatingMarket({ marketId: m.id }))}
                      style={{ marginRight: 14, marginTop: 4 }}
                    >
                      <Text style={styles.rowTitle}>{m.name} ›</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            {areaActive ? <BadgeOk label={t('operator.verified')} /> : null}
          </View>
        </Card>
      )}

      <Card style={styles.listCard}>
        {QUAL_DOCS.map((d, i) => {
          const st = op.docs[d.key];
          return (
            <Pressable
              key={d.key}
              onPress={() => {
                // THE FOUR DOCUMENT STEPS GO TO THE SCREEN THAT CAN READ ONE. They used to call
                // verifyDoc, which ticked them after 900 milliseconds without ever seeing a
                // document. verifyDoc now refuses those keys, so leaving this would have made
                // the row do nothing at all — quieter than the timer and no more honest.
                if (d.key === 'insurance') router.navigate('/operator/insurance');
                else if (d.key === 'background') router.navigate('/operator/background');
                else if (d.key === 'license' || d.key === 'registration' || d.key === 'inspection')
                  router.navigate('/operator/documents');
                else op.verifyDoc(d.key);
              }}
            >
              <View style={[styles.row, i > 0 && styles.hair]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{t(d.title)}</Text>
                  {d.sub ? <Text style={styles.rowSub}>{t(d.sub)}</Text> : null}
                </View>
                {st === 'ok' ? (
                  <BadgeOk label={t('operator.verified')} />
                ) : st === 'checking' ? (
                  <Text style={styles.pillChecking}>{t('operator.checking')}</Text>
                ) : (
                  <Text style={styles.pillTodo}>{t('traveler.add')} ›</Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </Card>

      <Text style={styles.footnote}>
        {t('traveler.verifyNotSellShort')}
      </Text>
      {/* WAS: "Test program — document review is simulated." It was true when verifyDoc set a
          flag after 900 milliseconds, and it stopped being true the day reviewDoc started
          sending the document to a model that reads it. A line telling an operator their
          licence is not really checked, on a screen where it is, is the same defect as the
          reverse — it is just the flattering direction to be wrong in. */}

      <View style={{ flex: 1 }} />
      {submitError && <Text style={styles.footnote}>{submitError}</Text>}
      <PrimaryButton
        label={done ? t('traveler.qualSubmitReview') : t('traveler.continueQualification')}
        disabled={submitting}
        onPress={async () => {
          if (!done) {
            continueQualification();
            return;
          }
          setSubmitting(true);
          setSubmitError(null);
          const out = await op.submitQualification();
          setSubmitting(false);
          if (out.ok) router.replace('/operator/review');
          else setSubmitError(out.error || null);
        }}
        style={{ marginTop: 24 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { fontSize: 15, fontWeight: '500', color: colors.ink },
  // The shell's left-aligned qualification wordmark: 12 / 600 / .26em.
  wm: { marginTop: 8, fontSize: 12, fontWeight: '600', letterSpacing: 3.12, color: colors.ink },
  wmOp: { color: colors.muted },
  title: {
    marginTop: 8,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.52,
    lineHeight: 34,
    color: colors.ink,
  },
  sub: { fontSize: 14.5, color: colors.muted, marginTop: 9, lineHeight: 21.75 },
  steps: { flexDirection: 'row', gap: 5, marginTop: 16 },
  stepBar: { flex: 1, height: 3, borderRadius: 2 },
  banner: {
    marginTop: 16,
    backgroundColor: colors.blueTint,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  bannerText: { fontSize: 13, color: colors.ink2, lineHeight: 18.85 },
  listCard: { marginTop: 16, paddingVertical: 2, paddingHorizontal: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    gap: 10,
  },
  hair: { borderTopWidth: 1, borderTopColor: colors.hairline },
  rowTitle: { fontSize: 15, color: colors.ink },
  rowSub: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  pillChecking: { fontSize: 12, fontWeight: '600', color: colors.ink },
  pillTodo: { fontSize: 12.5, fontWeight: '600', color: colors.muted },
  footnote: { fontSize: 11.5, color: colors.faint, marginTop: 10, lineHeight: 16.7 },
});
