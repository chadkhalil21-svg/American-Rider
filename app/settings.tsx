// Settings — Preferences and Account. Every row here opens something real: Notifications
// is a screen, Privacy is the live policy, Delete Account is the Apple-required deletion
// flow (5.1.1(v)).
//
// Deliberately NOT the demo's full settings screen. The demo's Appearance segment,
// Language row and Security row were all transcribed here and all only raised a toast;
// they were removed on 15 Aug for App Store review — see the notes below each. This is
// the one screen where "matches the demo" lost to "every control does what it says".
import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../src/components/AppText';
import { LEGAL_URL } from '../src/config';
import { useGoBack } from '../src/components/nav';
import Constants from 'expo-constants';
import { Card, Chev, LetterheadBar, Screen, SectionLabel, Title, useNote } from '../src/components/UI';
import { BUILD_COMMIT } from '../src/config';
import { useLanguage } from '../src/state/LanguageContext';
import { colors } from '../src/theme';

export default function Settings() {
  const { t, language, setLanguage, languages } = useLanguage();
  const router = useRouter();
  const goBack = useGoBack();
  const { note } = useNote();

  return (
    <Screen note={note}>
      <LetterheadBar onBack={goBack} />
      <Title>{t('traveler.settings')}</Title>

      {/* NO APPEARANCE SECTION — removed 15 Aug 2026 for App Store review (founders).
          The demo's Light/Dark segmented control was transcribed here, but the theme
          behind it never was: `colors` in src/theme.ts is a single light palette and
          app.json pins "userInterfaceStyle": "light", so Dark could only ever raise a
          toast. A two-option control where one option does nothing is the plainest
          version of the placeholder feature guideline 2.1 rejects, and it sat on the one
          screen a reviewer always opens.

          DARK MODE IS NOT CANCELLED — it is v1.2. Chad's demo already specifies the whole
          palette under `:root[data-theme="dark"]` (ink #F3F3F1, bg #14171F, card #1B1F27,
          line #2A2E38, blue #5C86F6, red #E0674F), so building it is transcription rather
          than design. The work is the plumbing: ~50 files import `colors` statically and
          would each have to resolve it at render time, app.json has to be unpinned, and
          every screen then needs re-verifying in both modes because any hardcoded colour
          becomes a bug that only appears in dark. That is a full pass over the app, and
          doing it in the week we are trying to get approved is how drift returns. */}

      <SectionLabel style={{ marginTop: 24 }}>{t('traveler.preferences')}</SectionLabel>
      <Card style={styles.card}>
        {/* LANGUAGE SITS FIRST, above notifications, and that placement is the point.
            Somebody who needs this setting cannot read the ones below it. Burying it under
            English headings is how a translated app stays English for the people it was
            translated for. The device's language is already applied on first launch, so this
            is for correcting that guess rather than making it. */}
        <View style={styles.row}>
          <Text style={styles.rowTitle}>{t('common.language')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1, gap: 6 }}>
            {languages.map((l) => (
              <Pressable key={l.code} onPress={() => setLanguage(l.code)} hitSlop={6}>
                <Text
                  style={[
                    styles.langChip,
                    l.code === language && styles.langChipOn,
                  ]}
                >
                  {/* Endonyms. Somebody looking for Spanish is looking for "Español". */}
                  {l.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Pressable onPress={() => router.navigate('/notifications')}>
          <View style={styles.row}>
            <Text style={[styles.rowTitle, styles.rowTitleWrap]}>{t('traveler.notifications')}</Text>
            <Chev />
          </View>
        </Pressable>
        {/* LANGUAGE and SECURITY & FACE ID removed 15 Aug 2026, App Store review.
            Both carried a chevron — the app's own promise that a tap opens something —
            and both only raised "This screen opens in the full build." Guideline 2.1
            treats placeholder features as an incomplete app, and a control that looks
            navigable and is not is the clearest possible example.
            Language additionally had nothing to offer: the app is English-only, so the
            row existed to display the word "English". Security & Face ID was worse than
            placeholder — it advertised a biometric lock Chad had already had removed
            (11 Aug), so it named a feature the app deliberately does not have.
            Restore either one only alongside the screen it opens. */}
        {/* THE BINDING AGREEMENTS, reachable from the app (Chad, 19 Sept 2026 — a
            "Regulatory & Legal Repository"). Both are served by our own backend in five
            languages, so the row opens the reader's language rather than English. There is no
            separate "National Network Policy" document, so the row is not named after one. */}
        <Pressable onPress={() => Linking.openURL(`${LEGAL_URL}/terms`)}>
          <View style={[styles.row, styles.hair]}>
            <Text style={[styles.rowTitle, styles.rowTitleWrap]}>{t('traveler.termsOfService')}</Text>
            <Chev />
          </View>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(`${LEGAL_URL}/privacy`)}>
          <View style={[styles.row, styles.hair]}>
            <Text style={[styles.rowTitle, styles.rowTitleWrap]}>{t('traveler.privacy')}</Text>
            <Chev />
          </View>
        </Pressable>
      </Card>

      {/* Apple requires account deletion to be reachable in the app and no harder to find
          than signing out (Guideline 5.1.1(v)). It is still bottom of Settings, alone, one tap
          from here — the guideline is about reachability, and nothing about it moved.
          NOT RED ANY MORE (Chad, 19 Sept 2026: "a clean monochrome palette until final
          deletion confirmation"). A row that navigates is not a destructive act; the
          destructive act is the confirmation at the end of the flow, and that stays red. This
          also settles one of the six controls listed under SAFE-02, which had red spreading
          beyond Call 911. */}
      <SectionLabel style={{ marginTop: 26 }}>{t('traveler.acctGovernance')}</SectionLabel>
      <Card style={styles.card}>
        <Pressable onPress={() => router.navigate('/delete-account')}>
          <View style={styles.row}>
            <Text style={[styles.rowTitle, styles.rowTitleWrap]}>{t('traveler.acctTermination')}</Text>
            <Chev />
          </View>
        </Pressable>
      </Card>
      <Text style={styles.deleteNote}>
        {t('traveler.permanentlyRemoves')}
      </Text>
      {/* The build's own identity, so a founder can read the same seven characters here and on
          the TestFlight or simulator build they are comparing it with. */}
      <Text style={styles.buildLine}>
        {t('traveler.buildLine', {
          version: Constants.expoConfig?.version ?? '',
          commit: BUILD_COMMIT ? BUILD_COMMIT.slice(0, 7) : t('traveler.buildUnstamped'),
        })}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 2 },
  buildLine: { fontSize: 11.5, color: colors.muted, marginTop: 22, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  hair: { borderTopWidth: 1, borderTopColor: colors.hairline },
  langChip: {
    fontSize: 13,
    color: colors.muted,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  langChipOn: { color: '#FFFFFF', backgroundColor: colors.ink, borderColor: colors.ink },

  rowTitle: { fontSize: 15, color: colors.ink },
  // The Notifications row names the screen it opens, and that name is now a phrase rather than
  // a word. It flexes and wraps so the chevron keeps its place instead of being pushed off the
  // card — the language row above keeps the old intrinsic width, where the chips take the rest.
  rowTitleWrap: { flex: 1, minWidth: 0, paddingRight: 12 },
  deleteNote: { fontSize: 11.5, color: colors.faint, marginTop: 12, lineHeight: 17.25 },
});
