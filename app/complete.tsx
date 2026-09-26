// Travel Complete — completion record and optional Travel review. American Rider does not offer tipping.
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../src/components/AppText';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  Card,
  LetterheadBar,
  Mono,
  Num,
  OutlineButton,
  PrimaryButton,
  Screen,
  SectionLabel,
} from '../src/components/UI';
import { legTitle, placeName } from '../src/smartLegs';
import { useRide } from '../src/state/RideContext';
import { useLanguage } from '../src/state/LanguageContext';
import { colors, fmt } from '../src/theme';


// The demo's rating star: 30px, ink stroke 1.5, filled solid when selected.
function Star({ on }: { on: boolean }) {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24">
      <Path
        d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z"
        fill={on ? colors.ink : 'none'}
        stroke={colors.ink}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function TravelComplete() {
  const { t } = useLanguage();
  const router = useRouter();
  const ride = useRide();
  const [stars, setStars] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const trip = ride.lastTrip;

  // A Smart Travel journey: this travel was its first car leg, and the transit leg and the
  // last car leg are still ahead — or it was the last leg, and the journey is now done.
  const journey = ride.smartJourney;
  const firstLegDone = !!journey && journey.stage === 'leg1' && journey.leg1No === trip.no;
  const lastLegDone = !!journey && journey.stage === 'leg2' && journey.leg2No === trip.no;
  const nextLeg = firstLegDone
    ? journey.plan.legs[journey.plan.legs.findIndex((l) => l.kind === 'transit')]
    : null;
  const lastCarLeg = firstLegDone && journey.plan.legs[journey.plan.legs.length - 1]?.kind === 'car';

  // The review is written on the way out, and the screen only leaves once it has an answer.
  // Nothing here was ever going to be worth a second screen, but it was worth being true.
  const finish = async (after?: () => void) => {
    if (saving) return;
    const leave = () => {
      if (lastLegDone) ride.endSmartJourney();
      if (after) after();
      else router.dismissTo('/');
    };
    if (stars === 0) {
      leave();
      return;
    }
    setSaving(true);
    setSaveFailed(false);
    const ok = await ride.submitReview(stars);
    setSaving(false);
    if (!ok) {
      setSaveFailed(true);
      return;
    }
    leave();
  };

  return (
    <Screen>
      <LetterheadBar onMenu={() => router.navigate('/account')} />
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Svg width={56} height={56} viewBox="0 0 56 56" fill="none">
          <Circle cx={28} cy={28} r={20} stroke={colors.green} strokeWidth={2} />
          <Path
            d="M20 28l6 6 11-12"
            stroke={colors.green}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text style={styles.title}>{t('traveler.travelComplete')}</Text>
        <Text style={styles.sub}>
          {trip.dep} → {trip.arr}
        </Text>
      </View>

      <Card style={styles.factsCard}>
        {/* THE LABEL FOLLOWS THE MONEY, NOT THE CLOCK. The journey advances on its own
            timer while the traveler is still inside Stripe's sheet, so this screen could be
            reached before the card had been confirmed — and it said "Total Charged" over an
            amount nothing had charged. Observed in a real test booking. An amount and a
            doubt about that amount must never render together, and neither may a claim that
            money moved when it has not. */}
        <View style={styles.factRow}>
          <Text style={styles.factLabel}>
            {ride.payment.status === 'paid'
              ? 'Total Charged'
              : ride.payment.status === 'failed'
                ? 'Total Due'
                : t('traveler.totalPaymentInProgress')}
          </Text>
          <Num size={15} weight="600">
            {fmt(trip.total)}
          </Num>
        </View>
        <View style={[styles.factRow, styles.factDivider]}>
          <Text style={styles.factLabel}>{t('traveler.travelNumber')}</Text>
          <Mono size={12.5}>{trip.no}</Mono>
        </View>
      </Card>

      {/* NO 99% BLOCK HERE either. It ran on Confirmation, Complete AND Receipt — three
          times in a single journey. §10B places it once, on the completed receipt, which
          this screen links to directly. */}

      <SectionLabel style={{ marginTop: 24 }}>{t('traveler.travelReview')}</SectionLabel>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setStars(n)} hitSlop={6}>
            <Star on={n <= stars} />
          </Pressable>
        ))}
      </View>


      {/* No gratuity control by product decision. */}

      {firstLegDone && nextLeg && (
        <>
          <SectionLabel style={{ marginTop: 24 }}>{t('traveler.smartTravel')}</SectionLabel>
          <Card style={styles.nextCard}>
            <Text style={styles.nextTitle}>{t('traveler.smartNext', { leg: legTitle(nextLeg, t) })}</Text>
            <Text style={styles.nextSub}>
              {placeName(nextLeg.from.name)} → {placeName(nextLeg.to.name)} ·{' '}
              {t('traveler.durMin', { n: nextLeg.minutes })}
            </Text>
          </Card>
        </>
      )}

      {saveFailed && (
        <Text style={styles.saveFailed}>
          {t('traveler.reviewNotSaved')}
        </Text>
      )}

      <View style={{ marginTop: 'auto' }}>
        <OutlineButton
          label={t('traveler.viewTravelReceipt')}
          onPress={() => {
            ride.setViewTrip(null);
            router.navigate({ pathname: '/receipt', params: { from: 'status' } });
          }}
        />
        {firstLegDone && lastCarLeg ? (
          <PrimaryButton
            label={saving ? t('traveler.busySaving') : t('traveler.reserveLastTravel')}
            onPress={() =>
              finish(() => {
                if (ride.beginSmartLeg(2)) router.navigate('/reserve');
                else router.navigate('/smart');
              })
            }
            disabled={saving}
            style={{ marginTop: 11 }}
          />
        ) : (
          <PrimaryButton
            label={saving ? t('traveler.busySaving') : 'Complete'}
            onPress={() => finish()}
            disabled={saving}
            style={{ marginTop: 11 }}
          />
        )}
        {firstLegDone && (
          <Pressable onPress={() => finish(() => router.navigate('/smart'))} hitSlop={10}>
            <Text style={styles.skipLink}>{t('traveler.viewJourney')}</Text>
          </Pressable>
        )}
        {saveFailed && (
          <Pressable onPress={() => router.dismissTo('/')} hitSlop={10}>
            <Text style={styles.skipLink}>{t('traveler.leaveWithoutSaving')}</Text>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.52,
    color: colors.ink,
    marginTop: 16,
  },
  sub: {
    fontSize: 14.5,
    color: colors.muted,
    marginTop: 9,
    lineHeight: 21.75,
    textAlign: 'center',
  },
  factsCard: { marginTop: 22, paddingVertical: 4, paddingHorizontal: 20 },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  factDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  factLabel: { fontSize: 14, color: colors.ink2 },
  starsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  saveFailed: { fontSize: 13, color: colors.red, marginTop: 16, lineHeight: 19 },
  skipLink: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
    paddingTop: 14,
  },
  nextCard: { marginTop: 12, paddingVertical: 14, paddingHorizontal: 18 },
  nextTitle: { fontSize: 14.5, fontWeight: '600', color: colors.ink },
  nextSub: { fontSize: 12.5, color: colors.muted, marginTop: 4, lineHeight: 18 },

});
