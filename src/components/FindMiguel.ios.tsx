// "Which way is my driver?" — the walk-to-your-car arrow, shown once the operator has
// arrived at the pickup. The phone's GPS knows where the traveler is standing and the
// compass knows which way they're facing, so the arrow rotates to point at the car and
// the distance counts down as they walk. Same idea as Find My / Waymo's finder, built
// from plain GPS + compass (no special hardware, so expect ~street-corner accuracy,
// not inch-perfect — that's plenty for "he's that way, about 120 feet").
//
// iOS only: Metro picks this file on iPhone. FindMiguel.tsx (web/Android) shows just
// the "I'm in the car" button, since those builds have no live map experience yet.
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from './AppText';
import type { Coords } from '../backend/fares';
import { useLanguage } from '../state/LanguageContext';
import { colors } from '../theme';
import { PrimaryButton } from './UI';
import { t as tr } from '../i18n';

type Props = {
  target: Coords; // where the car is waiting (the pickup point / dropped pin)
  driverName: string;
  car: string;
  onBoard: () => void;
};

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

// Compass bearing from A to B: 0° = north, 90° = east.
function bearing(a: Coords, b: Coords) {
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function distanceMeters(a: Coords, b: Coords) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Miami speaks feet and miles.
function distanceLabel(m: number) {
  const ft = m * 3.28084;
  if (ft < 900) return tr('traveler.aboutFeet', { n: Math.max(10, Math.round(ft / 10) * 10) });
  return `${(m / 1609.34).toFixed(1)} mi`;
}

export function FindMiguel({ target, driverName, car, onBoard }: Props) {
  const { t } = useLanguage();
  const [pos, setPos] = useState<Coords | null>(null);
  const [headingDeg, setHeadingDeg] = useState<number | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let posSub: Location.LocationSubscription | null = null;
    let headSub: Location.LocationSubscription | null = null;
    let alive = true;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!alive) return;
      if (!perm.granted) {
        setDenied(true);
        return;
      }
      posSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 2 },
        (l) => setPos({ lat: l.coords.latitude, lng: l.coords.longitude }),
      );
      if (!alive) {
        posSub.remove();
        posSub = null;
        return;
      }
      headSub = await Location.watchHeadingAsync((h) =>
        // trueHeading is -1 while the compass calibrates; fall back to magnetic north.
        setHeadingDeg(h.trueHeading >= 0 ? h.trueHeading : h.magHeading),
      );
      if (!alive) {
        headSub.remove();
        headSub = null;
      }
    })();
    return () => {
      alive = false;
      posSub?.remove();
      headSub?.remove();
    };
  }, []);

  // Keep the last shown rotation so the arrow doesn't snap when a reading is briefly null.
  const lastArrow = useRef(0);
  let body: React.ReactNode;
  if (denied) {
    body = (
      <Text style={styles.hint}>
        {t('traveler.turnOnLocationArrow', { name: driverName })}
      </Text>
    );
  } else if (!pos || headingDeg == null) {
    body = (
      <View style={styles.findingRow}>
        <ActivityIndicator color={colors.blue} />
        <Text style={styles.hint}>{t('traveler.findingYou')}</Text>
      </View>
    );
  } else {
    const arrow = (bearing(pos, target) - headingDeg + 360) % 360;
    lastArrow.current = arrow;
    body = (
      <>
        <View style={styles.arrowWrap}>
          <Text style={[styles.arrow, { transform: [{ rotate: `${arrow}deg` }] }]}>➤</Text>
        </View>
        <Text style={styles.distance}>{distanceLabel(distanceMeters(pos, target))}</Text>
        <Text style={styles.carLine}>
          {t('traveler.walkTowardArrow', { car })}
        </Text>
      </>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('traveler.operatorIsThisWay', { name: driverName })}</Text>
      {body}
      <View style={{ marginTop: 14, alignSelf: 'stretch' }}>
        <PrimaryButton label={t('traveler.confirmBoarding')} onPress={onBoard} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.ink },
  arrowWrap: {
    marginTop: 12,
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.blueTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The glyph points east by default; the rotation math treats 0° as north, so offset -90.
  arrow: { fontSize: 40, color: colors.blue, transform: [{ rotate: '-90deg' }] },
  distance: { marginTop: 10, fontSize: 22, fontWeight: '600', color: colors.ink },
  carLine: { marginTop: 4, fontSize: 14, color: colors.muted },
  hint: { marginTop: 10, fontSize: 14, color: colors.muted, textAlign: 'center' },
  findingRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
});
