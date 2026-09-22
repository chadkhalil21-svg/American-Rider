// Proceed to Pickup / At Pickup — the operator demo, exactly: the ETA pill, the
// drawn navigation map, the traveler card with Contact, the Travel Notes card
// ("You retain final discretion"), Confirm Arrival → Commence Travel.
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/AppText';
import { OperatorMap } from '../../src/components/operator';
import { Avatar, Card, Mono, Num, PrimaryButton, Screen, SectionLabel } from '../../src/components/UI';
import { verificationCode } from '../../src/verification';
import { CheckInCard } from '../../src/components/CheckInCard';
import { useOperator } from '../../src/state/OperatorContext';
import { useLanguage } from '../../src/state/LanguageContext';
import { colors } from '../../src/theme';

export default function OperatorPickup() {
  const { t } = useLanguage();
  const router = useRouter();
  const op = useOperator();
  const active = op.op;

  // Cold-open guard only: cancelling clears `op` while its own navigation runs —
  // don't race it.
  const hadOp = useRef(false);
  if (active) hadOp.current = true;
  useEffect(() => {
    if (!active && !hadOp.current) router.replace('/operator');
  }, [active, router]);
  if (!active) return <Screen scroll={false}>{null}</Screen>;

  const arrived = op.arrived;

  return (
    <Screen>
      <Pressable
        onPress={() => {
          op.cancelOp();
          router.dismissTo('/operator');
        }}
        hitSlop={10}
        style={styles.back}
      >
        <Text style={styles.backText}>{t('traveler.cancelChev')}</Text>
      </Pressable>

      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{arrived ? 'At Pickup' : 'Proceed to Pickup'}</Text>
          <Text style={styles.sub}>
            {/* A real travel carries no operator ETA — the scripted ones did, and this printed
                "undefined min away" for everything else. Say where, and say who only when we
                have a name for them. */}
            {active.pickup}
            {arrived
              ? active.traveler
                ? ` · meet ${active.traveler}`
                : ''
              : active.pickupMin != null
                ? ` · ${active.pickupMin} min away`
                : ''}
          </Text>
        </View>
        <View style={styles.etaPill}>
          <Num size={13} color="#fff">
            {arrived ? 'Arrived' : active.pickupMin != null ? `${active.pickupMin} min` : 'En route'}
          </Num>
        </View>
      </View>

      <View style={{ marginTop: 16 }}>
        <OperatorMap
          tag={arrived ? 'ARRIVED · PICKUP' : 'NAVIGATION · TO PICKUP'}
          animate={!arrived}
        />
      </View>

      {/* The platform's question about this vehicle, when it has one. Absent on an ordinary
          journey — see src/components/CheckInCard.tsx for why it is asked of the operator
          before it is ever asked of the traveler. */}
      {!!op.checkIn && <CheckInCard question={op.checkIn} onAnswer={op.respondToCheckIn} />}

      <Card style={styles.travelerCard}>
        <View style={styles.rowBetween}>
          <View style={styles.travelerLeft}>
            <Avatar initials={active.tInit} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={styles.travelerName}>{active.traveler}</Text>
              <Text style={styles.travelerSub}>
                {active.pickup} → {active.dest}
              </Text>
            </View>
          </View>
          <Pressable onPress={() => router.navigate('/operator/communicate')} hitSlop={10}>
            <Text style={styles.contact}>{t('traveler.contact')}</Text>
          </Pressable>
        </View>
      </Card>

      {/* The traveler's screen shows the same code for this travel (src/verification.ts) and
          asks them to request it before boarding. */}
      <Card style={styles.codeCard}>
        <SectionLabel>{t('operator.verificationCode')}</SectionLabel>
        <Mono size={26} weight="600" style={{ marginTop: 8, letterSpacing: 1.3 }}>
          {verificationCode(active.tripNo ?? active.no)}
        </Mono>
        <Text style={styles.codeBody}>{t('operator.verificationCodeSub')}</Text>
      </Card>

      <Card style={styles.notesCard}>
        <SectionLabel style={{ color: colors.blue }}>{t('operator.travelNotes')}</SectionLabel>
        {/* Demonstration notes, the same for every travel — the real cabin environment of the
            travel is not read here yet (handoff: found, not fixed). Keyed so the sentence is
            at least in the operator's language. */}
        <Text style={styles.notesBody}>{t('operator.travelNotesDemo')}</Text>
      </Card>

      <View style={{ flex: 1 }} />
      {!arrived ? (
        <PrimaryButton label={t('operator.confirmArrival')} onPress={op.confirmArrival} style={{ marginTop: 24 }} />
      ) : (
        <PrimaryButton
          label={t('operator.commenceTravel')}
          color={colors.green}
          onPress={() => {
            // Report it before navigating. This screen used to only change its own route,
            // so the traveler's phone had no way of knowing the journey had started and
            // advanced on a timer instead.
            op.beginTrip();
            router.replace('/operator/trip');
          }}
          style={{ marginTop: 24 }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { fontSize: 15, fontWeight: '500', color: colors.ink },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6, gap: 12 },
  title: { fontSize: 22, fontWeight: '600', letterSpacing: -0.44, color: colors.ink },
  sub: { fontSize: 14, color: colors.muted, marginTop: 8, lineHeight: 21 },
  etaPill: {
    backgroundColor: colors.ink,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  travelerCard: { marginTop: 14, paddingVertical: 16, paddingHorizontal: 18 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  travelerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  travelerName: { fontSize: 16, fontWeight: '600', color: colors.ink },
  travelerSub: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  contact: { fontSize: 14, fontWeight: '500', color: colors.blue },
  codeCard: { marginTop: 12, paddingVertical: 16, paddingHorizontal: 18 },
  codeBody: { fontSize: 12.5, color: colors.muted, marginTop: 8, lineHeight: 18 },
  notesCard: { marginTop: 12, paddingVertical: 16, paddingHorizontal: 18 },
  notesBody: { fontSize: 14, color: colors.ink, marginTop: 8, lineHeight: 21 },
});
