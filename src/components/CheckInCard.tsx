// The platform's question to an operator, and the ways to answer it.
//
// RAISED BY backend/monitor.js when a vehicle carrying somebody has stopped for longer than a
// long light with no other American Rider vehicle nearby stopped to explain it. The operator
// is asked BEFORE the traveler, always: they are the one person who knows, and answering them
// first is what keeps this from becoming an app that asks a traveler if they are safe every
// time the causeway backs up.
//
// TAP FIRST, TYPE ONLY IF YOU MUST. The person being asked is at the wheel. Four fixed
// answers cover almost every real case and cost one tap; the field is there for the case they
// do not cover, and an operator is never required to use it.
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { MAX_FONT_SCALE, Text } from './AppText';
import { useLanguage } from '../state/LanguageContext';
import { Card, SectionLabel } from './UI';
import { colors, radii } from '../theme';

// KEYS, NOT SENTENCES — built at import; the render site translates.
const QUICK = ['traveler.quickTraffic', 'traveler.quickRoadClosed', 'traveler.waitingOnTraveler', 'traveler.fuelOrVehicle'];

export function CheckInCard({
  question,
  onAnswer,
}: {
  question: string;
  onAnswer: (text: string) => Promise<boolean>;
}) {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  const send = async (t: string) => {
    if (sending || !t.trim()) return;
    setSending(true);
    setFailed(false);
    const ok = await onAnswer(t.trim());
    setSending(false);
    // NOT CLEARED ON FAILURE. An answer that looks sent and was not leaves the platform
    // escalating to the traveler over a question this operator has already answered.
    if (!ok) setFailed(true);
  };

  return (
    <Card style={styles.card}>
      <SectionLabel>{t('traveler.checkIn')}</SectionLabel>
      <Text style={styles.question}>{question}</Text>

      <View style={styles.chips}>
        {QUICK.map((q) => (
          <Pressable key={q} style={styles.chip} onPress={() => send(t(q))} disabled={sending}>
            <Text style={styles.chipText}>{t(q)}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={t('traveler.orDescribeIt')}
        placeholderTextColor={colors.faint}
        editable={!sending}
        multiline
        // THE ONE INPUT WHERE REFUSING LARGER TEXT IS WORST. This is the field a traveler
        // types into when route monitoring asks whether they are all right. Somebody who
        // raised their text size is exactly the person who may struggle to answer a safety
        // question in 14pt. Capped like everything else — see MAX_FONT_SCALE in AppText.
        allowFontScaling
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        onSubmitEditing={() => send(text)}
      />
      <Pressable
        style={[styles.send, (!text.trim() || sending) && styles.sendOff]}
        onPress={() => send(text)}
        disabled={!text.trim() || sending}
      >
        <Text style={styles.sendText}>{sending ? 'Sending' : 'Send'}</Text>
      </Pressable>

      {failed && (
        <Text style={styles.failed}>
          {t('traveler.checkInNotReach')}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 14 },
  question: { fontSize: 14.5, color: colors.ink, marginTop: 8, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.button,
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  chipText: { fontSize: 13.5, fontWeight: '600', color: colors.ink },
  input: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.button,
    paddingVertical: 11,
    paddingHorizontal: 13,
    marginTop: 12,
    minHeight: 44,
    fontSize: 14.5,
    color: colors.ink,
  },
  send: {
    alignSelf: 'flex-start',
    backgroundColor: colors.ink,
    borderRadius: radii.button,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: 10,
  },
  sendOff: { opacity: 0.35 },
  sendText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  failed: { fontSize: 13, color: colors.red, marginTop: 11, lineHeight: 18.5 },
});
