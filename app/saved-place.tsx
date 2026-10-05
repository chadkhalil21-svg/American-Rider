// Setting a home or work address, or a favourite destination. Reached from Profile, which
// shows these rows and could not previously fill them — see src/savedPlaces.ts for why they
// were removed and what had to exist before they came back.
//
// Favourites (Adrian, 14 Sept 2026): any destination a traveler wants one tap away on Home.
// `which=favorite` adds one; `which=favorite&label=…` opens an existing one, where the only
// action is to remove it (a favourite is a place, and a place is not edited — it is replaced).
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { geocodePlace } from '../src/backend/fares';
import { Text } from '../src/components/AppText';
import { useGoBack } from '../src/components/nav';
import { Card, LetterheadBar, PrimaryButton, Screen, SectionLabel, Sub, Title } from '../src/components/UI';
import { loadSavedPlaces, removeFavorite, saveFavorite, saveSavedPlace } from '../src/savedPlaces';
import { useLanguage } from '../src/state/LanguageContext';
import { colors } from '../src/theme';

export default function SavedPlace() {
  const { t } = useLanguage();
  const goBack = useGoBack();
  const router = useRouter();
  const { which, label } = useLocalSearchParams<{ which?: string; label?: string }>();
  const key: 'home' | 'work' | 'favorite' =
    which === 'work' ? 'work' : which === 'favorite' ? 'favorite' : 'home';
  const editingFavorite = key === 'favorite' && typeof label === 'string' && label.trim() !== '';

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<string | null>(null);

  useEffect(() => {
    if (key === 'favorite') {
      setExisting(editingFavorite ? label!.trim() : null);
      return;
    }
    loadSavedPlaces().then((p) => setExisting(p[key]?.label ?? null));
  }, [key, label, editingFavorite]);

  const save = async () => {
    const q = text.trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    // GEOCODED BEFORE IT IS SAVED. An address we cannot turn into coordinates is a row that
    // fails when somebody taps it on the way to the airport — better to refuse it here, while
    // they are sitting still and can correct a typo.
    // ANCHORED TO WHERE THE TRAVELER IS, so a bare street name resolves in THEIR city. This
    // screen has no ride context, so it asks the device directly — a saved place is the row
    // most likely to be typed loosely ("moms house", "the office") and the one that hurts
    // most when it silently resolves two states away.
    let near: { lat: number; lng: number } | null = null;
    try {
      const pos = await Location.getLastKnownPositionAsync();
      if (pos) near = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      // No position is not an error here: the search simply goes unanchored.
    }
    const coords = await geocodePlace(q, near);
    if (!coords) {
      setBusy(false);
      setError(t('traveler.placeNotFound'));
      return;
    }
    try {
      if (key === 'favorite') await saveFavorite({ label: q, lat: coords.lat, lng: coords.lng });
      else await saveSavedPlace(key, { label: q, lat: coords.lat, lng: coords.lng });
      router.back();
    } catch {
      setError(t('traveler.couldNotSaveConn'));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (key === 'favorite') {
        if (existing) await removeFavorite(existing);
      } else {
        await saveSavedPlace(key, null);
      }
      router.back();
    } catch {
      setError(t('traveler.couldNotSaveConn'));
    } finally {
      setBusy(false);
    }
  };

  const title =
    key === 'home'
      ? t('traveler.homeAddress')
      : key === 'work'
        ? t('traveler.workAddress')
        : t('traveler.favoriteDestination');

  return (
    <Screen>
      <LetterheadBar onBack={goBack} />
      <Title size={24}>{title}</Title>
      <Sub>{t('traveler.savedPlaceSub')}</Sub>

      {editingFavorite ? (
        <Card style={styles.card}>
          <Text style={styles.existing}>{existing}</Text>
        </Card>
      ) : (
        <>
          <SectionLabel style={{ marginTop: 22 }}>{key === 'favorite' ? t('traveler.destinationEntry') : t('traveler.addressOrPlace')}</SectionLabel>
          <Card style={styles.card}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder={existing ?? t('traveler.savedPlaceExample')}
              placeholderTextColor={colors.faint}
              selectionColor={colors.ink}
              autoCorrect={false}
              editable={!busy}
              onSubmitEditing={save}
              returnKeyType="done"
            />
          </Card>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
      )}

      <View style={{ flex: 1 }} />
      {busy ? <ActivityIndicator style={{ marginBottom: 14 }} /> : null}
      {editingFavorite ? (
        <PrimaryButton label={t('traveler.removeSavedDestination')} onPress={clear} disabled={busy} />
      ) : (
        <>
          <PrimaryButton label={key === 'favorite' ? t('traveler.saveDestination') : t('traveler.saveAddress')} onPress={save} disabled={busy || !text.trim()} />
          {existing ? (
            <Pressable onPress={clear} disabled={busy} accessibilityRole="button" hitSlop={8} style={{ marginTop: 14, alignSelf: 'center' }}>
              <Text style={styles.clear}>{t('traveler.removeSavedPlace')}</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 3, marginTop: 10, paddingHorizontal: 18 },
  input: { fontSize: 14.5, color: colors.ink, paddingVertical: 11, paddingHorizontal: 2 },
  existing: { fontSize: 14.5, color: colors.ink, paddingVertical: 11, paddingHorizontal: 2 },
  // Ink, not red: removing a saved address is a choice, not an emergency.
  error: { fontSize: 13.5, color: colors.ink, marginTop: 12 },
  clear: { fontSize: 14, fontWeight: '600', color: colors.ink2 },
});
