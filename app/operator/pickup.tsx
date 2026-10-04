// Proceed to Pickup / At Pickup — the operator demo, exactly: the ETA pill, the
// drawn navigation map, the traveler card with Contact, the Travel Notes card
// ("You retain final discretion"), Confirm Arrival → Commence Travel.
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
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
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

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
        onPress={() => router.dismissTo('/operator')}
        hitSlop={10}
        style={styles.back}
      >
        <Text style={styles.backText}>{t('traveler.backLabel')}</Text>
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

      {active.cabinPreferences ? (
        <Card style={styles.prefsCard}>
          {[
            {
              label: t('traveler.climate'),
              value:
                active.cabinPreferences.climate === 'Cool'
                  ? t('traveler.prefCool')
                  : active.cabinPreferences.climate === 'Warm'
                    ? t('traveler.prefWarm')
                    : t('traveler.prefModerate'),
            },
            {
              label: t('traveler.atmosphere'),
              value: active.cabinPreferences.quiet
                ? t('traveler.prefQuiet')
                : t('traveler.prefConversation'),
            },
            {
              label: t('traveler.music'),
              value:
                active.cabinPreferences.music === 'Traveler Choice'
                  ? t('traveler.prefTravelerChoice')
                  : t('traveler.prefMusicNone'),
            },
            {
              label: t('traveler.additionalRequests'),
              value:
                [
                  active.cabinPreferences.charging ? t('traveler.charger') : null,
                  active.cabinPreferences.luggage ? t('traveler.luggage') : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || t('traveler.noneRequested'),
            },
          ].map((item, i) => (
            <View key={item.label} style={[styles.prefRow, i > 0 && styles.prefHair]}>
              <Text style={styles.prefLabel}>{item.label}</Text>
              <Text style={styles.prefValue}>{item.value}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <View style={{ flex: 1 }} />
      {transitionError ? <Text style={styles.error}>{transitionError}</Text> : null}
      {!arrived ? (
        <PrimaryButton label={transitioning ? t('traveler.pleaseWait') : t('operator.confirmArrival')} disabled={transitioning} onPress={async () => { setTransitioning(true); setTransitionError(null); const ok = await op.confirmArrival(); setTransitioning(false); if (!ok) setTransitionError(t('traveler.errGeneric')); }} style={{ marginTop: 24 }} />
      ) : (
        <PrimaryButton
          label={t('operator.commenceTravel')}
          color={colors.green}
          disabled={transitioning}
          onPress={async () => {
            setTransitioning(true); setTransitionError(null);
            const ok = await op.beginTrip();
            setTransitioning(false);
            if (ok) router.replace('/operator/trip');
            else setTransitionError(t('traveler.errGeneric'));
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
  error: { fontSize: 13.5, color: colors.red, marginTop: 10 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6, gap: 12 },
  title: { fontSize: 20, fontWeight: '600', letterSpacing: -0.44, color: colors.ink },
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
  prefsCard: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 1 },
  prefRow: {
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  prefHair: { borderTopWidth: 1, borderTopColor: colors.hairline },
  prefLabel: { fontSize: 13.5, color: colors.muted, flexShrink: 0 },
  prefValue: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.ink,
    lineHeight: 19,
    textAlign: 'right',
  },
});
