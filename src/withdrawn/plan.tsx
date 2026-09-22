// Plan in your own words — the AI planner.
//
// WHY THIS FILE EXISTS AT ALL. AGENTS.md records the planner as a founders' explicit keep:
// "The AI planner ('Plan in your own words' / 'Tell us the trip') stays on home — founders'
// explicit keep, even though the web demo predates it." The server route worked, the API key
// was live, src/backend/assistant.ts was written — and NOTHING IN THE APP CALLED ANY OF IT.
// The feature was mandated, built at both ends, and had no door. Found by sweeping for
// exports with no consumer, which is the same test that caught the tip path and the website.
//
// WHAT IT SHOWS, AND WHAT IT DELIBERATELY DOES NOT. Not a chat. A traveler says what they
// need in a sentence and gets back a READING OF IT — destination, hour, passengers,
// requirements — as a record they can check before anything is booked. The model's own
// sentence is one quiet line beneath, not the substance.
//
// Reading somebody's words back to them is a promise about what will happen. So where the
// reading is wrong, incomplete, or names something American Rider cannot actually provide,
// this screen says so plainly rather than booking the nearest thing and hoping.
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../components/AppText';
import { askAssistant, type TripPlan } from '../backend/assistant';
import { useGoBack } from '../components/nav';
import {
  Card,
  LetterheadBar,
  PrimaryButton,
  Screen,
  SectionLabel,
  Sub,
  Title,
} from '../components/UI';
import { PLACES, TRAVEL_CLASSES } from '../data';
import { useRide } from '../state/RideContext';
import { colors } from '../theme';

/** The four things the reading can be. Never "probably". */
type State =
  | { k: 'idle' }
  | { k: 'thinking' }
  | { k: 'read'; plan: TripPlan }
  | { k: 'failed'; why: string };

// What a traveler might ask for that American Rider cannot serve yet. Named here rather than
// silently dropped: an Accessible travel is sold as "ramp or assistance equipped", and at
// launch no operator offers it — so a request mentioning one must be answered, not rounded to
// Standard. Selling one service and dispatching another is the defect this app treats most
// seriously.
const UNSERVED: { test: RegExp; label: string }[] = [
  { test: /wheelchair|accessible|ramp|mobility/i, label: 'Wheelchair accessible travel' },
  { test: /shared|pool|split the/i, label: 'Shared travel' },
];

export default function Plan() {
  const router = useRouter();
  const goBack = useGoBack();
  const ride = useRide();
  const [text, setText] = useState('');
  const [state, setState] = useState<State>({ k: 'idle' });
  // The words that produced the current reading, so "not served" can be judged against what
  // the traveler actually said rather than against the model's paraphrase of it.
  const askedRef = useRef('');

  const ask = async () => {
    const message = text.trim();
    if (!message) return;
    askedRef.current = message;
    setState({ k: 'thinking' });
    const out = await askAssistant(message);
    if (!out.ok) return setState({ k: 'failed', why: out.error });
    setState({ k: 'read', plan: out.plan });
  };

  const plan = state.k === 'read' ? state.plan : null;
  const place = plan ? PLACES.find((p) => p.short === plan.destination || p.name === plan.destination) : null;

  // Requirements we cannot meet, read from the traveler's own sentence.
  const unserved = UNSERVED.filter((u) => u.test.test(askedRef.current)).map((u) => u.label);
  // Read the flag rather than the narrowed bookable list — TypeScript can prove 'accessible'
  // is absent today, and the day it is offered this line should start returning true on its
  // own rather than needing somebody to remember this screen exists.
  const accessibleOffered = !!TRAVEL_CLASSES.find((c) => c.key === 'accessible')?.bookable;
  const blocked = unserved.length > 0 && !accessibleOffered;

  return (
    <Screen>
      <LetterheadBar onBack={goBack} />
      <Title>Plan in your own words</Title>
      <Sub>
        Describe the travel — where, when, how many, anything the vehicle needs to carry.
      </Sub>

      <Card style={styles.inputCard}>
        <TextInput
          autoFocus
          multiline
          value={text}
          onChangeText={setText}
          placeholder="To the airport by six, two of us, one large case"
          placeholderTextColor={colors.muted}
          style={styles.input}
          onSubmitEditing={ask}
        />
      </Card>

      {state.k === 'read' && (
        <>
          <SectionLabel style={styles.lbl}>What We Understood</SectionLabel>
          <Card style={styles.readCard}>
            <Row k="Destination" v={place ? place.name : plan!.destination || 'Not identified'} />
            {!!plan!.when && <Row k="When" v={plan!.when} />}
            {plan!.passengers > 0 && <Row k="Passengers" v={String(plan!.passengers)} />}
            {plan!.prefs?.length > 0 && <Row k="Requirements" v={plan!.prefs.join(' · ')} />}
          </Card>

          {/* The model's own sentence, kept small and beneath the record. It is a courtesy,
              not the answer — the rows above are what will actually be booked. */}
          {!!plan!.reply && <Text style={styles.reply}>{plan!.reply}</Text>}

          {/* THE THREE HONEST DEAD ENDS. Each says what is wrong and what to do, and none of
              them books the nearest available thing instead. */}
          {!place && (
            <Text style={styles.problem}>
              American Rider does not serve that destination yet. Enter it on the home screen to
              see whether it can be priced.
            </Text>
          )}
          {blocked && (
            <Text style={styles.problem}>
              {unserved.join(' and ')} is not available at launch. Booking Standard travel
              instead would not meet what you described.
            </Text>
          )}
        </>
      )}

      {state.k === 'failed' && <Text style={styles.problem}>{state.why}</Text>}

      <View style={{ flex: 1 }} />

      {place && !blocked ? (
        <PrimaryButton
          label="Select This Travel"
          onPress={() => {
            ride.startBooking(place);
            router.navigate('/reserve');
          }}
        />
      ) : (
        <PrimaryButton
          label={state.k === 'thinking' ? 'Reading…' : 'Plan Travel'}
          disabled={state.k === 'thinking' || !text.trim()}
          onPress={ask}
        />
      )}

      {state.k === 'read' && (
        <Pressable onPress={() => setState({ k: 'idle' })} hitSlop={8}>
          <Text style={styles.again}>Describe it differently</Text>
        </Pressable>
      )}
    </Screen>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowK}>{k}</Text>
      <Text style={styles.rowV} numberOfLines={2}>
        {v}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inputCard: { marginTop: 20, paddingVertical: 6, paddingHorizontal: 18 },
  input: {
    fontSize: 16.5,
    color: colors.ink,
    minHeight: 96,
    paddingVertical: 14,
    textAlignVertical: 'top',
    letterSpacing: -0.08,
  },
  lbl: { marginTop: 26, marginBottom: 12 },
  readCard: { paddingVertical: 2, paddingHorizontal: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  rowK: { fontSize: 14.5, color: colors.muted },
  rowV: { fontSize: 15, color: colors.ink, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  reply: { fontSize: 13.5, color: colors.muted, marginTop: 14, lineHeight: 20 },
  problem: { fontSize: 13.5, color: colors.ink2, marginTop: 16, lineHeight: 20 },
  again: {
    fontSize: 13.5,
    color: colors.blue,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
  },
});
