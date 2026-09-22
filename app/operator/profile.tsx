// Operator Profile — the operator demo, exactly: avatar head, ✓ Operator
// Commissioned, the Vehicle card, the Operations rows, and the Insurance card
// ("we verify coverage but do not sell it").
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/AppText';
import { BadgeOk, OperatorBar, OperatorDrawer, OperatorScreen } from '../../src/components/operator';
import { Avatar, Card, Chev, SectionLabel, useNote } from '../../src/components/UI';
import { useOperator, type DocKey } from '../../src/state/OperatorContext';
import { useLanguage } from '../../src/state/LanguageContext';
import { colors } from '../../src/theme';

// The documents the Documents screen actually holds. Background screening is decided by the
// server and reported on its own screen, so it is not one of these.
//
// 'inspection' was here until 30 Aug 2026, after it had already been dropped from the
// Documents screen and the qualification checklist. Because this line drives the "Verified"
// badge — `docsVerified === DOC_KEYS.length` — an operator who had filed every document we
// ask for still could not reach it: the badge waited on a document nobody would ever be
// asked for. Florida requires no inspection; see app/operator/documents.tsx.
const DOC_KEYS: DocKey[] = ['license', 'registration', 'insurance'];

export default function OperatorProfile() {
  const { t } = useLanguage();
  const router = useRouter();
  const op = useOperator();
  const { note, showNote } = useNote();
  const [menuOpen, setMenuOpen] = useState(false);
  const docsVerified = DOC_KEYS.filter((k) => op.docs[k] === 'ok').length;
  const since = op.commissionedAt ? new Date(op.commissionedAt).getFullYear() : new Date().getFullYear();

  return (
    <OperatorScreen nav="profile" note={note}>
      <OperatorBar onMenu={() => setMenuOpen(true)} initials={op.opInitials} />

      <View style={styles.head}>
        <Avatar initials={op.opInitials} size={54} />
        <View>
          <Text style={styles.name}>{op.opName}</Text>
          {/* Another 4.98 literal — every operator's profile claimed the same score. Only
              the commissioning year is a fact we hold. */}
          <Text style={styles.meta}>{t('traveler.operatingSince', { year: since })}</Text>
        </View>
      </View>
      <View style={styles.badgeRow}>
        <BadgeOk label={t('operator.operatorCommissioned')} />
      </View>

      {/* The card stays — the vehicle and plate are real, filed data an operator should
          see. What went is the chevron and the Pressable around it: they promised a
          detail screen that raised "…open in the full build" instead, which is the
          placeholder pattern guideline 2.1 rejects. Now it reads as what it is, a record
          of the vehicle on file. Give it a tap target again only alongside the screen
          that opens; vehicle paperwork already has a real home under Documents. */}
      {/* THE OPERATOR'S OWN CAR, not the demonstration one. This printed DRIVER.car and
          DRIVER.plate — a Gray Toyota Camry, KTR 4821 — on every operator's profile, and the
          same values were sent to dispatch, so a traveler was told to look for a car that was
          never coming. The chevron is back because there is now a screen behind it. */}
      <SectionLabel style={{ marginTop: 24 }}>{t('traveler.vehicle')}</SectionLabel>
      <Pressable onPress={() => router.navigate('/operator/vehicle')}>
        <Card style={styles.vehicleCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.vehicleTitle}>{op.vehicle ? op.vehicle.car : t('traveler.noVehicleOnFile')}</Text>
            <Text style={styles.vehicleSub}>
              {op.vehicle
                ? `License Plate ${op.vehicle.plate}`
                : t('traveler.needVehicleToAssign')}
            </Text>
          </View>
          <Chev />
        </Card>
      </Pressable>

      <SectionLabel style={{ marginTop: 22 }}>{t('operator.operations')}</SectionLabel>
      <Card style={styles.listCard}>
        {/* Getting Paid sits above Documents deliberately: an operator with no payout
            account keeps 99% of nothing. */}
        <Pressable onPress={() => router.navigate('/operator/payouts')}>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{t('operator.gettingPaid')}</Text>
            <Chev />
          </View>
        </Pressable>
        {/* WHAT THIS ROW USED TO SAY: `<BadgeOk label={t('operator.verified')} />`, written into the file.
            It rendered whether or not a single document had been submitted — an operator who
            had uploaded nothing was told on their own profile that their paperwork was
            verified. It is the same defect the Documents screen was rebuilt to remove ("six
            rows, every one badged Verified"), surviving one screen upstream of it, and found
            on 29 Aug 2026 by an account that had submitted nothing and was told otherwise.
            The row counts what is actually on file now. */}
        <Pressable onPress={() => router.navigate('/operator/documents')}>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{t('operator.documents')}</Text>
            <View style={styles.rowRight}>
              {docsVerified === DOC_KEYS.length ? (
                <BadgeOk label={t('operator.verified')} />
              ) : (
                <Text style={styles.rowState}>
                  {t('traveler.nOfMVerified', { n: docsVerified, total: DOC_KEYS.length })}
                </Text>
              )}
              <Chev />
            </View>
          </View>
        </Pressable>
        {/* REVENUE ROADMAP and DRIVING INSIGHTS removed 15 Aug 2026, App Store review.
            Both carried a chevron and both only raised "…open in the full build" —
            placeholder features under guideline 2.1. Neither has anything behind it:
            Revenue is already a real screen in the bottom bar, and a driving-insights
            product does not exist. Restore each WITH its screen, never before. */}
      </Card>

      {/* THE OPERATOR'S OWN WAY TO ASK FOR HELP, added 20 Sept 2026. Travelers have had one
          since 16 August; operators had none, which is the wrong way round for a platform
          whose proposition is that operators are treated better here. */}
      <Pressable onPress={() => router.navigate('/operator/support')}>
        <View style={styles.row}>
          <Text style={styles.rowTitle}>{t('operator.supportTitle')}</Text>
          <Text style={styles.rowState}>›</Text>
        </View>
      </Pressable>

      <Pressable onPress={() => router.navigate('/operator/insurance')}>
        <Card style={styles.insuranceCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.rowTitle}>{t('operator.insurance')}</Text>
            <Text style={styles.findCoverage}>{t('traveler.findCoverage')} ›</Text>
          </View>
          <Text style={styles.insuranceBody}>
            {t('traveler.weVerifyNotSell')}
          </Text>
        </Card>
      </Pressable>

      <OperatorDrawer open={menuOpen} onClose={() => setMenuOpen(false)} onNote={showNote} />
    </OperatorScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  name: { fontSize: 20, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, marginTop: 3 },
  badgeRow: { flexDirection: 'row', marginTop: 16 },
  vehicleCard: {
    marginTop: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  vehicleTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  vehicleSub: { fontSize: 13, color: colors.muted, marginTop: 3 },
  listCard: { marginTop: 12, paddingVertical: 2, paddingHorizontal: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  hair: { borderTopWidth: 1, borderTopColor: colors.hairline },
  rowTitle: { fontSize: 15, color: colors.ink },
  // Quiet, not alarming: an incomplete count is a fact about a file, not a warning.
  rowState: { fontSize: 13.5, color: colors.muted },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  insuranceCard: { marginTop: 16, paddingVertical: 16, paddingHorizontal: 20 },
  findCoverage: { fontSize: 14, fontWeight: '500', color: colors.blue },
  insuranceBody: { fontSize: 12.5, color: colors.muted, marginTop: 6, lineHeight: 18.75 },
});
