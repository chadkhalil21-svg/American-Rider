// Operate with American Rider — the recruiting screen: why-operate rows, the fee footnote,
// The Numbers, Take Rate, Your Numbers steppers, Monthly Retention, the Commercial Insurance
// Recovery box, qualifying insurers (real quote links), and Begin Operator Qualification.
//
// 99% of the travel fare to the operator, a 1% coordination commission with NO CAP.
//
// THIS SCREEN NO LONGER TALKS ABOUT OTHER PLATFORMS (founders, 5 Sept 2026). It carried "~50%
// to operator" in red, "most platforms leave an operator closer to $15", and a monthly
// comparison computed against an assumed 50% take rate. None of it was sourced, and an
// operator who checks and finds it wrong stops believing the 99% as well.
//
// It also was not needed. An operator already knows what they make now; showing what they
// would RETAIN and letting them compare it to their own real figure is both honest and more
// persuasive than a number they cannot check. That is what Monthly Retention does.
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../src/components/AppText';
import { useGoBack } from '../src/components/nav';
import {
  Card,
  LetterheadBar,
  Num,
  PrimaryButton,
  Screen,
  SectionLabel,
  Sub,
  Title,
} from '../src/components/UI';
import { INSURERS, coordinationFee } from '../src/data';
import { useOperator } from '../src/state/OperatorContext';
import { useLanguage } from '../src/state/LanguageContext';
import { colors, fmt } from '../src/theme';

// WHAT WE CAN STAND BEHIND, AND NOTHING ELSE (founders, 5 Sept 2026, after external review).
//
// Four claims came off this screen. Each was removed for a different reason, and the reasons
// are worth keeping because they are the test any future line has to pass.
//
//   "Most platforms leave an operator closer to $15" — a competitor's economics, asserted
//   without a source. An operator can check it, and if they find it wrong the 99% stops being
//   believed too. Our own number does not need theirs to be impressive.
//
//   "Cash out your balance the same day" — WE DO NOT HOLD A BALANCE. Stripe pays out on its
//   own schedule; American Rider has no control over the timing and no "cash out" to offer.
//   The screen promised a control that does not exist.
//
//   "Bonuses are an invitation, never a quota" and "busier areas may be highlighted" — there
//   are no bonuses and no surge highlighting anywhere in this product. It described a feature
//   that has never been built, on the page that recruits people.
//
//   The tone of the removals is the same as the rubric's rule about reassurance: an operator
//   deciding whether to buy $200 of commercial insurance is owed facts, and a page that pads
//   them with competitor comparisons and unbuilt features is one they cannot calibrate.
//
// AND ONE HEADING CHANGED. "Keep 99% of every fare" became "Retain 99% of the travel fare" —
// the fare, not the fare plus the traveler's platform fee, which is what "every fare" could
// be read as. The operator's share is 99% of the FARE; the $1.50 was never theirs to keep.
// KEYS, NOT SENTENCES — built once at import, before the stored language is read.
// The render site below translates. Same rule as QUAL_DOCS in OperatorContext.
const WHY: [string, string][] = [
  [
    'traveler.driveRetain99',
    'traveler.driveRetain99Body',
  ],
  [
    'traveler.driveInControl',
    'traveler.driveInControlBody',
  ],
  [
    'traveler.drivePayouts',
    'traveler.drivePayoutsBody',
  ],
  // "Treated as a professional" is gone (Chad, 17 Sept 2026): an enterprise that treats
  // someone as a professional does not advertise the fact as a headline. Its body stated the
  // model a second time; the subtitle now states it once.
];

// The demo's stepper row: 38px square step buttons (radius 10) around the 15/600 figure.
function Stepper({
  label,
  display,
  onMinus,
  onPlus,
  first = false,
}: {
  label: string;
  display: string;
  onMinus: () => void;
  onPlus: () => void;
  first?: boolean;
}) {
  return (
    <View style={[styles.stepperRow, !first && styles.hair]}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          onPress={onMinus}
          hitSlop={8}
          style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.86 }]}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Num size={15} weight="600" style={styles.stepperValue}>
          {display}
        </Num>
        <Pressable
          onPress={onPlus}
          hitSlop={8}
          style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.86 }]}
        >
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function Drive() {
  const { t } = useLanguage();
  const goBack = useGoBack();
  const router = useRouter();
  const op = useOperator();
  const [fare, setFare] = useState(18.5);
  const [rides, setRides] = useState(40);
  const [ins, setIns] = useState(250);

  // THE COMMISSION HAS NO CAP, AND THIS SCREEN SAID IT DID.
  //
  // `Math.min(fare * 0.01, 1)` is the founders' web demo's own coord(), which caps the
  // commission at $1. Chad corrected that on 16 Aug 2026 — AGENTS.md records it explicitly:
  // "a flat 1% coordination commission, NO CAP … the web demo's own coord() caps at $1 and
  // is wrong". src/data.ts was fixed then. This screen was not.
  //
  // So the one screen whose entire job is showing an operator what they would earn used the
  // formula the founders had already rejected. Above a $100 fare it OVERSTATED their
  // retention — on a $250 travel it showed them keeping $249.00 when the real figure is
  // $247.50. Overstating an operator's earnings on the recruiting screen is the worst
  // direction for that error to run.
  //
  // Found by ChatGPT reviewing the source, 4 Sept 2026. It read AGENTS.md, compared it to the
  // code, and caught what four weeks of my own passes over this file did not.
  const ridesMonth = Math.round((rides * 52) / 12);
  // NO COMPETITOR BASELINE. bigMonth was `fare * 0.5 * ridesMonth` — the operator's monthly
  // earnings at an assumed 50% take rate — and every figure below was a difference against
  // that invention. An operator already knows what they make now; asking them to compare our
  // number to their own real one is both honest and more persuasive than a figure they cannot
  // check. So this computes what they RETAIN, and states the insurance against it.
  const arPer = +(fare - coordinationFee(fare)).toFixed(2);
  const arMonth = +(arPer * ridesMonth).toFixed(2);
  const net = +(arMonth - ins).toFixed(2);
  const covers = net > 0;

  return (
    <Screen>
      <LetterheadBar onBack={goBack} />
      <Title>{t('traveler.operateWithUs')}</Title>
      <Sub>
        {t('traveler.driveHeroSub')}
      </Sub>

      <SectionLabel style={styles.lbl}>{t('traveler.whyOperatorsChoose')}</SectionLabel>
      <Card style={styles.listCard}>
        {WHY.map(([title, body], i) => (
          <View key={title} style={[styles.whyRow, i > 0 && styles.hair]}>
            <Text style={styles.whyTitle}>{t(title)}</Text>
            <Text style={styles.whyBody}>{t(body)}</Text>
          </View>
        ))}
      </Card>

      <SectionLabel style={{ marginTop: 26 }}>{t('traveler.theNumbers')}</SectionLabel>

      {/* THE COMPARISON ROW IS GONE. It read "Average platform — ~50% to operator" in red
          against our 99% in green, and there is no source behind that number. Independent
          work does exist — the National Employment Law Project put Uber and Lyft at "around
          40 percent on average" in July 2025 — but a figure we cannot show an operator the
          working for does not belong on the screen where we ask them to spend money.

          It also was not needed. 99% to the operator and a 1% commission is a striking number
          on its own; framing it against a competitor is what a page does when it doubts the
          number can carry itself, which is the rubric's reassurance failure in a chart. */}
      {/* THE LEDGER, ONCE (Chad, 17 Sept 2026: one clean card — the fare, the commission, the
          fee). Three lines, the contract's rule for each; the fee is the greater of $1.50 and
          5% of the travel fare, not the flat $1.50 his table carried. */}
      <SectionLabel style={styles.lbl}>{t('traveler.takeRate')}</SectionLabel>
      <Card style={styles.takeCard}>
        <View style={styles.takeRow}>
          <Text style={styles.takeLabel}>{t('traveler.travelFareRow')}</Text>
          <Text style={[styles.takeValue, { color: colors.green }]}>{t('traveler.ninetyNineToOperator')}</Text>
        </View>
        <View style={styles.takeRow}>
          <Text style={styles.takeLabel}>{t('traveler.coordinationCommission')}</Text>
          <Text style={styles.takeValue}>{t('traveler.onePctOfFare')}</Text>
        </View>
        <View style={styles.takeRow}>
          <Text style={styles.takeLabel}>{t('traveler.platformFeeRow')}</Text>
          <Text style={styles.takeValue}>{t('traveler.platformFeeRowValue')}</Text>
        </View>
        <Text style={styles.ledgerNote}>{t('traveler.platformFeeRowNote')}</Text>
      </Card>

      <SectionLabel style={styles.lbl}>{t('traveler.yourNumbers')}</SectionLabel>
      <Card style={styles.listCard}>
        <Stepper
          first
          label={t('traveler.averageTravelCost')}
          display={fmt(fare)}
          onMinus={() => setFare(Math.max(5, +(fare - 1.5).toFixed(2)))}
          onPlus={() => setFare(+(fare + 1.5).toFixed(2))}
        />
        <Stepper
          label={t('traveler.travelsPerWeek')}
          display={String(rides)}
          onMinus={() => setRides(Math.max(5, rides - 5))}
          onPlus={() => setRides(rides + 5)}
        />
        <Stepper
          label={t('operator.insurancePerMonth')}
          display={fmt(ins)}
          onMinus={() => setIns(Math.max(50, ins - 25))}
          onPlus={() => setIns(ins + 25)}
        />
      </Card>

      <SectionLabel style={{ marginTop: 14, marginBottom: 12 }}>{t('traveler.monthlyRetention')}</SectionLabel>
      <Card style={styles.revCard}>
        <View style={styles.revRow}>
          <Text style={styles.revLabel}>{t('traveler.retainedPerTravel')}</Text>
          <Num size={14}>{fmt(arPer)}</Num>
        </View>
        <View style={[styles.revRow, styles.hair]}>
          <Text style={styles.revLabel}>{t('traveler.travelsPerMonth')}</Text>
          <Num size={14}>{String(ridesMonth)}</Num>
        </View>
        <View style={[styles.revRow, styles.hair]}>
          <Text style={styles.revStrong}>{t('traveler.retainedPerMonth')}</Text>
          <Num size={14} weight="600" color={colors.green}>{fmt(arMonth)}</Num>
        </View>
      </Card>

      {/* The demo's Commercial Insurance Recovery box: green when the math clears. */}
      <View
        style={[
          styles.recoveryBox,
          covers
            ? { backgroundColor: colors.greenTint, borderColor: colors.greenBorder }
            : { backgroundColor: colors.blueTint, borderColor: colors.border },
        ]}
      >
        <SectionLabel style={{ color: covers ? colors.green : colors.blue }}>
          {t('traveler.commercialInsRecovery')}
        </SectionLabel>
        {covers ? (
          <Text style={styles.recoveryBody}>
            {t('traveler.driveCovers', {
              retained: fmt(arMonth),
              policy: fmt(ins),
              net: fmt(net),
            })}
          </Text>
        ) : (
          <Text style={styles.recoveryBody}>
            {t('traveler.driveShortfall', { retained: fmt(arMonth), policy: fmt(ins) })}
          </Text>
        )}
      </View>

      <SectionLabel style={{ marginTop: 24, marginBottom: 8 }}>{t('operator.qualifyingInsurance')}</SectionLabel>
      <Text style={styles.insIntro}>
        {t('traveler.commercialCoverageRequired')}
      </Text>
      <Card style={styles.listCard}>
        {/* THE RECRUITING PAGE SHOWS ONLY THE TWO WE STAND BEHIND. The full list, with what is
            and is not licence-checked, is on the operator's own Insurance screen — which is
            where somebody actually buying a policy is standing. Here it is still an argument
            for joining, and a list of five with caveats is not one. */}
        {INSURERS.filter((x) => !x.secondary).map((x, i) => (
          <Pressable key={x.name} onPress={() => x.url && Linking.openURL(x.url)}>
            <View style={[styles.insurerRow, i > 0 && styles.hair]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.insurerName}>{x.name}</Text>
                <Text style={styles.insurerNote}>{t(x.note)}</Text>
              </View>
              <Text style={styles.insurerLink}>{t('traveler.quote')} ›</Text>
            </View>
          </Pressable>
        ))}
      </Card>
      <Text style={styles.disclaimer}>
        {t('traveler.estimatesOnly')}
      </Text>

      <PrimaryButton
        label={
          op.verification === 'commissioned'
            ? t('traveler.openOperatorDashboard')
            : op.verification === 'pending'
              ? t('traveler.finishOperatorQual')
              : t('traveler.beginOperatorQual')
        }
        onPress={() => {
          if (op.verification === 'commissioned') router.navigate('/operator');
          else if (op.verification === 'pending') router.navigate('/operator/review');
          else router.navigate('/operator/qualify');
        }}
        style={{ marginTop: 24 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lbl: { marginTop: 24, marginBottom: 12 },
  listCard: { paddingVertical: 2, paddingHorizontal: 20 },
  hair: { borderTopWidth: 1, borderTopColor: colors.hairline },
  whyRow: { paddingVertical: 15 },
  whyTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  whyBody: { fontSize: 13, color: colors.muted, marginTop: 5, lineHeight: 19.5 },
  takeCard: { paddingVertical: 16, paddingHorizontal: 20 },
  takeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  // The label yields and the value keeps a gap: "Coordination commission" and "1% of the
  // travel fare" met in the middle of the row on the first capture of d0233df.
  takeLabel: { fontSize: 14.5, color: colors.ink2, flexShrink: 1, marginRight: 14 },
  takeValue: { fontSize: 15, fontWeight: '600', color: colors.ink, textAlign: 'right' },
  ledgerNote: { fontSize: 12.5, color: colors.muted, marginTop: 6, lineHeight: 18 },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  stepperLabel: { fontSize: 15, color: colors.ink },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // The demo's .step-btn: 38px, radius 10, line2 border, 19px glyph.
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 19, color: colors.ink, lineHeight: 23 },
  stepperValue: { minWidth: 66, textAlign: 'center' },
  revCard: { paddingVertical: 4, paddingHorizontal: 20 },
  revRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
  },
  revLabel: { fontSize: 14, color: colors.ink2 },
  revStrong: { fontSize: 14, fontWeight: '600', color: colors.ink },
  recoveryBox: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  recoveryBody: { fontSize: 14, color: colors.ink2, marginTop: 8, lineHeight: 21.7 },
  insIntro: { fontSize: 13, color: colors.ink2, lineHeight: 19.5, marginBottom: 12 },
  insurerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 14, // the demo's .lrow gap
  },
  insurerName: { fontSize: 15, color: colors.ink },
  insurerNote: { fontSize: 12.5, color: colors.muted, marginTop: 3 },
  // Ink, not the demo's link blue (Chad, 17 Sept 2026): a quote link drawn in blue read as
  // an affiliate placement. The control opens the insurer's page and is named for that.
  insurerLink: { fontSize: 13, fontWeight: '600', color: colors.ink },
  disclaimer: { fontSize: 11.5, color: colors.faint, marginTop: 10, lineHeight: 17.25 },
});
