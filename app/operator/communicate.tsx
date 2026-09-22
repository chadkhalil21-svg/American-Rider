// Communicate — the operator demo's chat, exactly: traveler header, the demo's
// bubbles (78% max, radius 15), and the 1.5s courteous reply.
//
// ONE THREAD, BOTH SIDES — as of 28 Aug 2026.
//
// WHAT THIS REPLACED. This screen kept a local array and answered itself after 1.5 seconds.
// The traveler's messages went to Firestore and were read by nobody. So an operator never saw
// what a traveler wrote, a traveler never saw what an operator wrote, and both screens told
// their reader they were in touch with the other person.
//
// The reason recorded for leaving it that way was that "an operator has no account identity at
// all — role and commissioning live in device storage". True when written; untrue for weeks
// before anyone noticed. Operators sign in, and operatorId is a Firebase uid that dispatch,
// screening, payouts and the duty gate all turn on. The blocker was removed by other work and
// nobody came back to the note — which is its own lesson about comments that explain why
// something cannot be done.
//
// Both messages now carry both uids, the rule lets either party read and each write only as
// themselves, and `from` is checked against the writer so neither side can forge the other.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../src/components/AppText';
import {
  sendTravelMessage,
  watchTravelThread,
  type TravelMessage,
} from '../../src/backend/messages';
import { useGoBack } from '../../src/components/nav';
import { Avatar, BackLink, Screen } from '../../src/components/UI';
import { useOperator } from '../../src/state/OperatorContext';
import { useLanguage } from '../../src/state/LanguageContext';
import { colors } from '../../src/theme';

export default function OperatorCommunicate() {
  const { t } = useLanguage();
  const goBack = useGoBack();
  const op = useOperator();
  const [draft, setDraft] = useState('');
  const [msgs, setMsgs] = useState<TravelMessage[]>([]);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [unsent, setUnsent] = useState(false);
  const traveler = op.op?.traveler ?? t('traveler.yourTravelerLower');
  const initials = op.op?.tInit ?? 'AR';
  // `no` is the travel number on an active operation; `tripNo` is what it is called on
  // the assignment it came from. Either is the thread's key.
  const tripNo = op.op?.tripNo ?? op.op?.no ?? '';
  const travelerUid = op.op?.travelerUid ?? null;

  // The real thread, live. An error is surfaced rather than shown as an empty conversation —
  // "nobody has written" and "we cannot read this" must never look the same.
  useEffect(() => {
    if (!tripNo) return;
    return watchTravelThread(tripNo, 'operator', setMsgs, setThreadError);
  }, [tripNo]);

  const send = async () => {
    const t = draft.trim();
    if (!t || !tripNo) return;
    setDraft('');
    setUnsent(false);
    const stored = await sendTravelMessage({
      tripNo,
      text: t,
      from: 'operator',
      travelerUid,
    });
    // NOT OPTIMISTIC ABOUT DELIVERY. The message appears because the live thread picks it up,
    // so a write that failed shows nothing — and says so, rather than leaving an operator
    // believing the traveler was told something they were not.
    if (!stored) setUnsent(true);
  };

  return (
    <Screen>
      <BackLink label={t('common.back')} onPress={goBack} />
      <View style={styles.head}>
        <Avatar initials={initials} size={40} />
        <View>
          <Text style={styles.name}>{traveler || 'Traveler'}</Text>
          <Text style={styles.role}>{t('traveler.yourTraveler')}</Text>
        </View>
      </View>

      {!!threadError && <Text style={styles.simNote}>{threadError}</Text>}
      {unsent && (
        <Text style={styles.simNote}>
          {t('traveler.messageNotDelivered')}
        </Text>
      )}

      <View style={styles.thread}>
        {msgs.map((m) => (
          <View
            key={m.id}
            style={[styles.bubble, m.from === 'operator' ? styles.bubbleMe : styles.bubbleThem]}
          >
            <Text style={[styles.bubbleText, m.from === 'operator' && { color: '#fff' }]}>
              {m.text}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.field}
          placeholder={`Message ${traveler || t('traveler.yourTravelerLower')}`}
          placeholderTextColor={colors.faint}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable
          onPress={send}
          style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.86 }]}
        >
          <Text style={styles.sendText}>{t('traveler.send')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  simNote: { fontSize: 11.5, color: colors.faint, marginTop: 14, lineHeight: 17.25 },
  name: { fontSize: 18, fontWeight: '600', color: colors.ink },
  role: { fontSize: 12, color: colors.muted, marginTop: 2 },
  thread: { flex: 1, marginTop: 22, gap: 10 },
  bubble: {
    maxWidth: '78%',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 15,
  },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: colors.ink },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  bubbleText: { fontSize: 14.5, lineHeight: 21, color: colors.ink },
  inputRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  field: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  sendBtn: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
