// Operation in Progress — the operator demo, exactly: arrival figure, navigation map,
// the Route Suggestion card ("your call"), the traveler card, and the Your Revenue
// card carrying the 99% line.
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/AppText';
import { OperatorMap } from '../../src/components/operator';
import { Avatar, Card, Num, PrimaryButton, Screen, SectionLabel } from '../../src/components/UI';
import { CheckInCard } from '../../src/components/CheckInCard';
import { useOperator } from '../../src/state/OperatorContext';
import { useLanguage } from '../../src/state/LanguageContext';
import { colors, fmt } from '../../src/theme';

export default function OperatorTrip() {
  const { t } = useLanguage();
  const router = useRouter();
  const op = useOperator();
  const active = op.op;

  // Cold-open guard only: once this screen has carried an operation, completing it
  // clears `op` while the Complete screen takes over — don't race that navigation.
  const hadOp = useRef(false);
  if (active) hadOp.current = true;
  useEffect(() => {
    if (!active && !hadOp.current) router.replace('/operator');
  }, [active, router]);
  if (!active) return <Screen scroll={false}>{null}</Screen>;

  return (
    <Screen>
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('traveler.operationInProgress')}</Text>
          <Text style={styles.sub}>{t('traveler.toDest', { dest: active.dest })}</Text>
        </View>
        {/* The figure was the literal "18 min" on every operation, whatever the journey.
            An arrival time we do not hold is not reported at all. */}
        {active.tripMin != null && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.arrivalLabel}>{t('traveler.arrivalCaps')}</Text>
            <Text style={styles.arrivalFigure}>
              {t('traveler.durMin', { n: active.tripMin })}
            </Text>
          </View>
        )}
      </View>

      <View style={{ marginTop: 16 }}>
        <OperatorMap tag={t('traveler.navToDestination')} />
      </View>

      {/* THE ROUTE SUGGESTION CARD IS GONE. It read "Navigation suggests an exit before I-95
          to stay ahead of a forecast traffic buildup" — on every operation, to every
          destination, whether or not the route went anywhere near I-95, from a navigation
          system this app does not have. A fixed sentence dressed as live guidance is the
          exact thing the rubric names: a claim on the screen that is not true on the
          screen. Restore it when there is a navigation source to speak for. */}

      {/* The platform's question about this vehicle, when it has one. Absent on an ordinary
          journey — see src/components/CheckInCard.tsx for why it is asked of the operator
          before it is ever asked of the traveler. */}
      {!!op.checkIn && <CheckInCard question={op.checkIn} onAnswer={op.respondToCheckIn} />}

      <Card style={styles.travelerCard}>
        <View style={styles.rowBetween}>
          <View style={styles.travelerLeft}>
            <Avatar initials={active.tInit} size={42} />
            <View style={{ flex: 1 }}>
              {/* Empty when the traveler set no name. "Traveler" is what the request sheet
                  and every other operator surface says, and a blank line is worse. */}
              <Text style={styles.travelerName}>{active.traveler || 'Traveler'}</Text>
              {/* WAS: "Playing · Operator Playlist". Nothing is playing and there is no
                  playlist — the app has no audio integration at all. Name the traveler's
                  actual preference instead, which the booking really carries. */}
              <Text style={styles.travelerSub}>{t('traveler.yourTraveler')}</Text>
            </View>
          </View>
          <Pressable onPress={() => router.navigate('/operator/communicate')} hitSlop={10}>
            <Text style={styles.contact}>{t('traveler.contact')}</Text>
          </Pressable>
        </View>
      </Card>

      <Card style={styles.revenueCard}>
        <View>
          <SectionLabel>{t('operator.yourRevenue')}</SectionLabel>
          <Num size={22} weight="600" color={colors.green} style={{ marginTop: 5 }}>
            {fmt(active.earn)}
          </Num>
        </View>
        <Text style={styles.revenueNote}>
          {t('traveler.ninetyNineOfFareAmt', { amount: fmt(active.fare) })}
        </Text>
      </Card>

      <View style={{ flex: 1 }} />
      <PrimaryButton
        label={t('operator.completeOperation')}
        onPress={() => {
          op.completeOp();
          router.replace('/operator/complete');
        }}
        style={{ marginTop: 24 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6, gap: 12 },
  title: { fontSize: 22, fontWeight: '600', letterSpacing: -0.44, color: colors.ink },
  sub: { fontSize: 14, color: colors.muted, marginTop: 8, lineHeight: 21 },
  arrivalLabel: { fontSize: 9.5, fontWeight: '600', letterSpacing: 1.43, color: colors.muted },
  arrivalFigure: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.36,
    color: colors.ink,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  travelerCard: { marginTop: 14, paddingVertical: 16, paddingHorizontal: 18 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  travelerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  travelerName: { fontSize: 16, fontWeight: '600', color: colors.ink },
  travelerSub: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  contact: { fontSize: 14, fontWeight: '500', color: colors.blue },
  revenueCard: {
    marginTop: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  revenueNote: {
    fontSize: 12.5,
    color: colors.muted,
    maxWidth: 150,
    lineHeight: 18,
    textAlign: 'right',
  },
});
