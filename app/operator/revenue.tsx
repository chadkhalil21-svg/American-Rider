// Revenue — the operator demo's screen, exactly: Today / This Week, Month / Year,
// Available to withdraw, Recent Operations. The figures are never furniture — they
// are computed (99% math) from the simulated operations this operator completed, so
// a new operator starts at zero.
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/AppText';
import { OperatorBar, OperatorDrawer, OperatorScreen } from '../../src/components/operator';
import { Card, Num, PrimaryButton, SectionLabel, useNote } from '../../src/components/UI';
import { opTimeLabel, useOperator } from '../../src/state/OperatorContext';
import { useLanguage } from '../../src/state/LanguageContext';
import { colors, fmt } from '../../src/theme';

export default function OperatorRevenue() {
  const { t } = useLanguage();
  const router = useRouter();
  const op = useOperator();
  const { note, showNote } = useNote();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <OperatorScreen nav="revenue" note={note}>
      <OperatorBar onMenu={() => setMenuOpen(true)} initials={op.opInitials} />
      <Text style={styles.title}>{t('traveler.revenue')}</Text>

      <Card style={styles.todayCard}>
        <View style={styles.rowBetween}>
          <View>
            <SectionLabel>{t('operator.today')}</SectionLabel>
            <Num size={34} weight="600" style={{ marginTop: 6 }}>
              {fmt(op.todayTotal)}
            </Num>
            <Text style={styles.todayOps}>
              {t('traveler.opsCount', { n: op.todayOps })}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <SectionLabel>{t('operator.thisWeek')}</SectionLabel>
            <Num size={22} weight="600" style={{ marginTop: 6 }}>
              {fmt(op.weekTotal)}
            </Num>
          </View>
        </View>
      </Card>

      <View style={styles.pairRow}>
        <Card style={styles.pairCard}>
          <SectionLabel>{t('operator.month')}</SectionLabel>
          <Num size={19} weight="600" style={{ marginTop: 5 }}>
            {fmt(op.monthTotal)}
          </Num>
        </Card>
        <Card style={styles.pairCard}>
          <SectionLabel>{t('operator.year')}</SectionLabel>
          <Num size={19} weight="600" style={{ marginTop: 5 }}>
            {fmt(op.yearTotal)}
          </Num>
        </Card>
      </View>

      {/* "Available to withdraw" and "Withdraw Revenue" described a decision an operator does
          not have. American Rider does not hold their money — the 99% goes to their own Stripe
          account as each travel completes, and Stripe pays it to their bank on its own
          schedule, whether or not anybody presses anything here. Naming a control after
          something it does not do is the rubric's own example of a screen failing. */}
      <Card style={styles.withdrawCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.withdrawLabel}>{t('traveler.earnedOnItsWay')}</Text>
          <Num size={18} weight="600">
            {fmt(op.balance)}
          </Num>
        </View>
        <PrimaryButton
          label={t('operator.yourPayouts')}
          onPress={() => router.navigate('/operator/withdraw')}
          style={{ marginTop: 14 }}
        />
      </Card>

      {/* Earned, never furniture: no operations, no section. */}
      {op.ops.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: 24 }}>{t('operator.recentOperations')}</SectionLabel>
          <Card style={styles.opsCard}>
            {op.ops.slice(0, 8).map((o, i) => (
              <View key={o.no + o.at} style={[styles.opRow, i > 0 && styles.hair]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.opArr}>{o.arr}</Text>
                  <Text style={styles.opTime}>{opTimeLabel(o.at)}</Text>
                </View>
                <Num size={13.5} color={colors.green}>
                  +{fmt(o.earn)}
                </Num>
              </View>
            ))}
          </Card>
        </>
      )}

      <OperatorDrawer open={menuOpen} onClose={() => setMenuOpen(false)} onNote={showNote} />
    </OperatorScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: 4,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.52,
    color: colors.ink,
  },
  todayCard: { marginTop: 18, padding: 20 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayOps: { fontSize: 12.5, color: colors.muted, marginTop: 3 },
  pairRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  pairCard: { flex: 1, paddingVertical: 16, paddingHorizontal: 18 },
  withdrawCard: { marginTop: 14, paddingVertical: 18, paddingHorizontal: 20 },
  withdrawLabel: { fontSize: 14, color: colors.ink2 },
  opsCard: { marginTop: 12, paddingVertical: 2, paddingHorizontal: 20 },
  opRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
  },
  hair: { borderTopWidth: 1, borderTopColor: colors.hairline },
  opArr: { fontSize: 15, color: colors.ink },
  opTime: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  testNote: { fontSize: 11.5, color: colors.faint, marginTop: 16, lineHeight: 16.7 },
});
