// Account details — the screen about the account holder, stating only what the account knows.
//
// Chad, 14 September 2026, on the old build: a username minted from an email address, an
// initials disc, a "default payment" that decided nothing, and two cards on an empty screen.
// Now: the name the traveler gave (editable here, saved to the account) or the address the
// account is held under; the year the account was opened; home, work and favourite
// destinations; the saved cabin environment; trusted contacts; travels completed this year;
// the payment methods screen; and, stated once, the operating model.
//
// NOT HERE, because the app cannot say it truthfully: an honorific or a membership tier
// (none exist), a bank name or card digits (Stripe holds the instrument and chooses it in its
// sheet at payment), a portrait (nothing stores one), a corporate billing switch (not built).
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../src/components/AppText';
import { LEGAL_URL } from '../src/config';
import { loadContacts, type TrustedContact } from '../src/contacts';
import { useGoBack } from '../src/components/nav';
import { Card, Chev, LetterheadBar, Screen, SectionLabel } from '../src/components/UI';
import { loadSavedPlaces, MAX_FAVORITES, type SavedPlaces } from '../src/savedPlaces';
import { useAuth } from '../src/state/AuthContext';
import { useCabinPrefs } from '../src/state/cabinPrefs';
import { useRide } from '../src/state/RideContext';
import { useLanguage } from '../src/state/LanguageContext';
import { colors } from '../src/theme';

export default function Profile() {
  const { t } = useLanguage();
  const router = useRouter();
  const goBack = useGoBack();
  const ride = useRide();
  const { user, setDisplayName } = useAuth();
  const cabin = useCabinPrefs();

  // Re-read on focus rather than once: a traveler returning from the editors must see what
  // they just set, not what was there when this screen mounted.
  const [places, setPlaces] = useState<SavedPlaces>({ favorites: [] });
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      loadSavedPlaces().then((p) => live && setPlaces(p));
      loadContacts().then((c) => live && setContacts(c));
      return () => {
        live = false;
      };
    }, []),
  );

  // THE NAME. The one the traveler gave at sign-up, editable here and saved to the account;
  // until there is one, the address the account is held under — never a handle minted from it.
  const givenName = user?.displayName?.trim() ?? '';
  const headName = givenName || user?.email?.trim() || t('traveler.accountDetails');
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const beginEdit = () => {
    setDraftName(givenName);
    setEditingName(true);
  };
  const saveName = async () => {
    const clean = draftName.trim().slice(0, 40);
    if (!clean || clean === givenName) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await setDisplayName(clean);
    } finally {
      setSavingName(false);
      setEditingName(false);
    }
  };

  // THE YEAR THIS ACCOUNT WAS ACTUALLY OPENED, from Firebase — not a demonstration traveler's.
  const since = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).getFullYear()
    : null;

  // COMPLETED, THIS YEAR — as the label says. Cancelled and unfinished travels are not counted.
  const thisYear = new Date().getFullYear();
  const completed = ride.myRides.filter(
    (r) => r.status === 'completed' && r.createdAt && new Date(r.createdAt).getFullYear() === thisYear,
  ).length;

  const climateLabel = {
    Cool: t('traveler.prefCool'),
    Moderate: t('traveler.prefModerate'),
    Warm: t('traveler.prefWarm'),
  }[cabin.climate];
  const requests = [cabin.charging ? t('traveler.charger') : null, cabin.luggage ? t('traveler.luggage') : null]
    .filter((r): r is string => !!r);

  return (
    <Screen>
      <LetterheadBar onBack={goBack} />

      <View style={styles.head}>
        <Text style={styles.name} numberOfLines={2}>{headName}</Text>
        {since && <Text style={styles.since}>{t('traveler.travelerSince', { year: since })}</Text>}
      </View>

      <SectionLabel style={{ marginTop: 22 }}>{t('traveler.account')}</SectionLabel>
      <Card style={styles.card}>
        {editingName ? (
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{t('traveler.nameLabel')}</Text>
            <TextInput
              style={styles.nameInput}
              value={draftName}
              onChangeText={setDraftName}
              autoFocus
              autoCorrect={false}
              maxLength={40}
              editable={!savingName}
              selectionColor={colors.ink}
              returnKeyType="done"
              onSubmitEditing={saveName}
              onBlur={saveName}
            />
            <Pressable onPress={saveName} hitSlop={8} accessibilityRole="button">
              <Text style={styles.action}>{t('traveler.save')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={beginEdit} accessibilityRole="button">
            <View style={styles.row}>
              <Text style={styles.rowTitle}>{t('traveler.nameLabel')}</Text>
              <Text style={givenName ? styles.statValue : styles.notSet}>{givenName || t('traveler.notSet')}</Text>
            </View>
          </Pressable>
        )}
        <View style={[styles.row, styles.hair]}>
          <Text style={styles.rowTitle}>{t('traveler.emailLabel')}</Text>
          <Text style={[styles.statValue, { flex: 1, textAlign: 'right' }]} numberOfLines={1}>
            {user?.email ?? t('traveler.notSet')}
          </Text>
        </View>
      </Card>

      {/* SAVED PLACES. A row a traveler has not filled says "Not set" and opens the editor. It
          never guesses, and it never shows a place they did not type. Favourites: any
          destination they want one tap away on Home, up to MAX_FAVORITES. */}
      <SectionLabel style={{ marginTop: 22 }}>{t('traveler.savedPlaces')}</SectionLabel>
      <Card style={styles.card}>
        {(['home', 'work'] as const).map((k, i) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            onPress={() => router.navigate({ pathname: '/saved-place', params: { which: k } })}
          >
            <View style={[styles.row, i > 0 && styles.hair]}>
              <Text style={styles.rowTitle}>
                {k === 'home' ? t('traveler.homeAddress') : t('traveler.workAddress')}
              </Text>
              <Text style={[places[k] ? styles.statValue : styles.notSet, styles.rowValue]} numberOfLines={1}>
                {places[k]?.label ?? t('traveler.notSet')}
              </Text>
            </View>
          </Pressable>
        ))}
        {places.favorites.map((f) => (
          <Pressable
            key={f.label}
            accessibilityRole="button"
            onPress={() =>
              router.navigate({ pathname: '/saved-place', params: { which: 'favorite', label: f.label } })
            }
          >
            <View style={[styles.row, styles.hair]}>
              <Text style={styles.rowTitle}>{t('traveler.favoriteDestination')}</Text>
              <Text style={[styles.statValue, styles.rowValue]} numberOfLines={1}>{f.label}</Text>
            </View>
          </Pressable>
        ))}
        {places.favorites.length < MAX_FAVORITES && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate({ pathname: '/saved-place', params: { which: 'favorite' } })}
          >
            <View style={[styles.row, styles.hair]}>
              <Text style={styles.action}>{t('traveler.addFavorite')} ›</Text>
            </View>
          </Pressable>
        )}
      </Card>

      {/* THE SAVED CABIN ENVIRONMENT, applied to every travel; the control opens the screen
          that changes it. */}
      <SectionLabel style={{ marginTop: 22 }}>{t('traveler.travelPreferences')}</SectionLabel>
      <Card style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowTitle}>{t('traveler.climate')}</Text>
          <Text style={styles.statValue}>{climateLabel}</Text>
        </View>
        <View style={[styles.row, styles.hair]}>
          <Text style={styles.rowTitle}>{t('traveler.atmosphere')}</Text>
          <Text style={styles.statValue}>{cabin.quiet ? t('traveler.prefQuiet') : t('traveler.prefConversation')}</Text>
        </View>
        <View style={[styles.row, styles.hair]}>
          <Text style={styles.rowTitle}>{t('traveler.music')}</Text>
          <Text style={styles.statValue}>
            {cabin.music === 'None' ? t('traveler.prefMusicNone') : t('traveler.prefTravelerChoice')}
          </Text>
        </View>
        {requests.length > 0 && (
          <View style={[styles.row, styles.hair]}>
            <Text style={styles.rowTitle}>{t('traveler.additionalRequests')}</Text>
            <Text style={[styles.statValue, styles.rowValue]}>{requests.join(' · ')}</Text>
          </View>
        )}
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/prefs')}>
          <View style={[styles.row, styles.hair]}>
            <Text style={styles.action}>{t('traveler.modifyCabin')} ›</Text>
          </View>
        </Pressable>
      </Card>

      {/* TRUSTED CONTACTS: how many are configured, and the screen that manages them. */}
      <SectionLabel style={{ marginTop: 22 }}>{t('traveler.safeTravels')}</SectionLabel>
      <Pressable accessibilityRole="button" onPress={() => router.navigate('/safety')}>
        <Card style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{t('traveler.trustedContacts')}</Text>
            <Text style={contacts.length ? styles.statValue : styles.notSet}>
              {contacts.length ? t('traveler.contactsConfigured', { n: contacts.length }) : t('traveler.notSet')}
            </Text>
          </View>
        </Card>
      </Pressable>

      <SectionLabel style={{ marginTop: 22 }}>{t('traveler.travelStatistics')}</SectionLabel>
      <Card style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowTitle}>{t('traveler.travelsCompletedThisYear')}</Text>
          <Text style={styles.statValue}>{completed}</Text>
        </View>
      </Card>

      {/* THE INSTRUMENT IS CHOSEN IN STRIPE'S SHEET at the moment of payment, so this names the
          screen it opens and claims no default that decides nothing. */}
      <Pressable accessibilityRole="button" onPress={() => router.navigate('/wallet')}>
        <Card style={styles.payCard}>
          <Text style={styles.rowTitle}>{t('traveler.paymentMethods')}</Text>
          <Chev />
        </Card>
      </Pressable>

      {/* THE MODEL, STATED ONCE, as the founders' brief §10A asks: an institutional fact in a
          permanent account surface, not a slogan through the journey. */}
      <View style={styles.charter}>
        <SectionLabel style={styles.charterLabel}>{t('traveler.company')}</SectionLabel>
        <Text style={styles.charterText}>{t('traveler.operatorsReceive99')}</Text>
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`${LEGAL_URL}/about`)} hitSlop={8}>
          <Text style={styles.action}>{t('traveler.aboutAmericanRider')} ›</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: 8 },
  name: { fontSize: 20.5, fontWeight: '600', letterSpacing: -0.38, color: colors.ink },
  since: { fontSize: 12.5, color: colors.muted, marginTop: 4 },
  card: { marginTop: 10, paddingHorizontal: 18, paddingVertical: 1 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13.5,
  },
  hair: { borderTopWidth: 1, borderTopColor: colors.hairline },
  rowTitle: { fontSize: 14.5, color: colors.ink },
  rowValue: { flex: 1, textAlign: 'right' },
  statValue: { fontSize: 14.5, fontWeight: '600', color: colors.ink },
  notSet: { fontSize: 14, color: colors.muted },
  nameInput: { flex: 1, fontSize: 14.5, fontWeight: '600', color: colors.ink, textAlign: 'right', padding: 0 },
  action: { fontSize: 13, fontWeight: '600', color: colors.accent },
  payCard: {
    marginTop: 22,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charter: { marginTop: 24, gap: 7, paddingBottom: 4 },
  charterLabel: { marginBottom: 1 },
  charterText: { fontSize: 12.5, color: colors.ink2, lineHeight: 18.5 },
});
