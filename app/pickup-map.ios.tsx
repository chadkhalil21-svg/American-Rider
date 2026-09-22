// "Drop a pin where you're actually standing."
//
// WHY THIS EXISTS: geocoding a place NAME gives you the middle of the property. For a mall like
// The Falls, or a stadium, or a hospital, that can be a five-minute walk from the door the
// traveler is standing at — and the operator has no way to know which door. Dragging the map
// under a fixed pin is how every rideshare solves this, and it is the difference between
// "somewhere at The Falls" and "the north entrance".
//
// iOS only (Metro serves this file only on iPhone) because the map is. On web the pickup is
// still chosen by name, which is fine — nobody hails a ride from a browser.
import { AppleMaps } from 'expo-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../src/components/AppText';
import { PrimaryButton } from '../src/components/UI';
import { useRide } from '../src/state/RideContext';
import { useLanguage } from '../src/state/LanguageContext';
import { colors, radii } from '../src/theme';

const MIAMI = { latitude: 25.7743, longitude: -80.1937 };
// How long the map must sit still before we ask Apple what address it's over. Reverse-geocoding
// on every frame of a drag would hammer the OS and make the label flicker.
const SETTLE_MS = 450;

export default function PickupMap() {
  const { t } = useLanguage();
  const router = useRouter();
  const ride = useRide();

  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [start, setStart] = useState<{ latitude: number; longitude: number } | null>(null);
  const [label, setLabel] = useState(t('traveler.moveMapToSetPickup'));
  const [looking, setLooking] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Open on the traveler's own location when they've allowed it — that's almost always where
  // they want to be picked up, so the common case needs no dragging at all.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = ride.pickupPin;
      if (existing) {
        if (!cancelled) setStart({ latitude: existing.lat, longitude: existing.lng });
        return;
      }
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          if (!cancelled) {
            setStart({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            return;
          }
        }
      } catch {
        // Location refused or unavailable — Miami is a reasonable place to start.
      }
      if (!cancelled) setStart(MIAMI);
    })();
    return () => {
      cancelled = true;
    };
  }, [ride.pickupPin]);

  // Ask what address the pin is over, once the map has stopped moving.
  const describe = useCallback(async (c: { latitude: number; longitude: number }) => {
    setLooking(true);
    try {
      const [place] = await Location.reverseGeocodeAsync({
        latitude: c.latitude,
        longitude: c.longitude,
      });
      if (place) {
        const line = [place.name, place.street, place.city].filter(Boolean);
        // name and street are often the same string ("136 SW"); don't say it twice.
        const deduped = line.filter((v, i) => line.indexOf(v) === i);
        setLabel(deduped.join(', ') || 'Dropped pin');
      } else {
        setLabel('Dropped pin');
      }
    } catch {
      setLabel('Dropped pin');
    } finally {
      setLooking(false);
    }
  }, []);

  const onCameraMove = useCallback(
    (e: { coordinates?: { latitude?: number; longitude?: number } }) => {
      const lat = e?.coordinates?.latitude;
      const lng = e?.coordinates?.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;
      const c = { latitude: lat, longitude: lng };
      setCenter(c);
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => describe(c), SETTLE_MS);
    },
    [describe],
  );

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  const confirm = () => {
    const c = center ?? start;
    if (!c) return;
    const pin = { lat: c.latitude, lng: c.longitude };
    ride.setPickupPin(pin);
    // THE PIN'S COORDINATES TRAVEL WITH IT. This set only a name and a short label, so the
    // departure kept whatever coordinates it already had — and dispatch, which reads
    // `departure.lat ?? 25.767`, sent the nearest operator to BRICKELL for a traveler
    // standing anywhere in Miami, then stored Brickell as the pickup for every re-offer.
    // `resolved` marks these as a real position, which is what stops startBooking()
    // replacing them with the placeholder on the next booking.
    ride.setDeparture({
      name: label,
      short: label.split(',')[0] || 'Pinned',
      lat: pin.lat,
      lng: pin.lng,
      resolved: true,
    });
    // If a trip is already underway (pin moved from the ride screen), move the live map's
    // pickup marker too — otherwise the adjustment would be invisible.
    if (ride.tripCoords) {
      ride.setTripCoords({ ...ride.tripCoords, pickup: { lat: c.latitude, lng: c.longitude } });
    }
    router.back();
  };

  if (!start) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <AppleMaps.View
        style={StyleSheet.absoluteFill}
        cameraPosition={{ coordinates: start, zoom: 16 }}
        onCameraMove={onCameraMove}
      />

      {/* The pin never moves — the map moves under it. That's what makes it feel precise. */}
      <View style={styles.pinWrap} pointerEvents="none">
        <View style={styles.pinHead} />
        <View style={styles.pinStem} />
        <View style={styles.pinShadow} />
      </View>

      <Pressable style={styles.cancel} onPress={() => router.back()} hitSlop={10}>
        <Text style={styles.cancelText}>{t('traveler.cancel2')}</Text>
      </Pressable>

      <View style={styles.sheet}>
        <Text style={styles.sheetLabel}>{t('traveler.pickup')}</Text>
        <View style={styles.addressRow}>
          <Text style={styles.address} numberOfLines={2}>
            {label}
          </Text>
          {looking && <ActivityIndicator size="small" color={colors.muted} />}
        </View>
        <PrimaryButton label={t('traveler.setPickupHere')} onPress={confirm} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.mapBg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  // The pin sits dead centre, lifted by half the sheet so it isn't hidden behind it.
  pinWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinHead: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.ink,
    borderWidth: 3,
    borderColor: colors.card,
  },
  pinStem: { width: 2, height: 14, backgroundColor: colors.ink },
  pinShadow: {
    width: 8,
    height: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(20, 23, 31, 0.25)',
  },
  cancel: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    paddingVertical: 8,
    paddingHorizontal: 16,
    boxShadow: '0 1px 4px rgba(20, 23, 31, 0.18)',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 34,
    gap: 12,
  },
  sheetLabel: { fontSize: 13, color: colors.muted, letterSpacing: 0.2 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  address: { flex: 1, fontSize: 19, fontWeight: '600', color: colors.ink },
});
