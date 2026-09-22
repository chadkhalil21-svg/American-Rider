import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../src/components/AppText';
import Svg, { Circle, Path } from 'react-native-svg';
import { accountName } from '../src/account';
import { destinationsNear, type Destination } from '../src/backend/destinations';
import { loadSavedPlaces, type SavedPlace, type SavedPlaces } from '../src/savedPlaces';
import { RideRecord } from '../src/backend/dispatch';
import { travelDateShort } from '../src/dates';
import { receiptFromRide } from '../src/receipt';
import { resolveCurrentDeparture } from '../src/location';
import { LEGAL_URL } from '../src/config';
import { fetchQuote, isUnavailable } from '../src/backend/fares';
import { useNative } from '../src/components/anim';
import {
  Chev,
  Display,
  Drawer,
  DrawerRow,
  LetterheadBar,
  Mono,
  Num,
  Screen,
  SectionLabel,
  useNote,
} from '../src/components/UI';
import {
  canonicalPlaceName,
  HOME_PLACE,
  PLACES,
  prettyPlace,
  STATUS_ETAS,
  STATUS_LABELS,
  type Place,
  type FeeLine,
} from '../src/data';
import { useAuth } from '../src/state/AuthContext';
import { useOperator } from '../src/state/OperatorContext';
import { useRide } from '../src/state/RideContext';
import { useLanguage } from '../src/state/LanguageContext';
import { HomeMap } from '../src/components/HomeMap';
import { legTitle } from '../src/smartLegs';
import { colors, fmt, radii } from '../src/theme';

// THE WEB DEMO, EXACTLY (Chad's call, 8 Aug 2026 — "he liked exactly what was on the web
// demo"): letterhead header with the person outline, "Begin Travel", plain grey letterspaced
// section labels (no rules), white cards with a 1px hairline border and NO shadow, the demo's
// restrained blue on action words only, and the solid-ink "Reserve Travel" CTA.
// The three words: institutional, authoritative, sophisticated.

function PulseDot({ color = colors.blueSoft }: { color?: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 1000, useNativeDriver: useNative }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: useNative }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        opacity: pulse,
      }}
    />
  );
}

// The demo's magnifier, traced from its SVG: 19×19 box, circle cx11 cy11 r7,
// handle from (20,20) to (16.8,16.8), stroke #8A8A82 at 1.7.
function Magnifier() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={colors.muted} strokeWidth={1.7} />
      <Path
        d="M20 20l-3.2-3.2"
        stroke={colors.muted}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// "24 min" as a number, so the sentence beside it can say "minutes" in full (Chad, 13 Sept
// 2026: truncations read as transactional). Falls back to the string when it holds no digits.
const minutesOf = (meta: string) => (meta.match(/\d+/)?.[0] ?? meta);

export default function Home() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const ride = useRide();
  const { user, signOut } = useAuth();
  const operator = useOperator();

  // A commissioned account that closed the app in Operator view reopens in it —
  // the role flag persists ('ar:role'), per the demo's role-switching pattern.
  // Cold-restore only: switching views mid-session navigates itself.
  const restoredRole = useRef(false);
  useEffect(() => {
    if (restoredRole.current || !operator.ready) return;
    restoredRole.current = true;
    if (operator.role === 'operator' && operator.verification === 'commissioned') {
      router.replace('/operator');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operator.ready, operator.role, operator.verification]);

  const rideOngoing = ride.rideActive && ride.status < 5;
  // WHAT THIS TRAVELER MAY BOOK, FROM WHERE THEY ARE. Asked of the server rather than shipped
  // in the app, so opening a new city is a server change and not an App Review. Empty until a
  // position resolves, and empty outside every region — both of which render no list at all,
  // which is the honest answer and the one that used to be a list of Miami.
  const [nearby, setNearby] = useState<Destination[]>([]);
  const depLat = ride.departure.lat;
  const depLng = ride.departure.lng;
  useEffect(() => {
    let live = true;
    if (depLat == null || depLng == null) { setNearby([]); return () => { live = false; }; }
    destinationsNear({ lat: depLat, lng: depLng }, 5).then((r) => {
      if (live) setNearby(r.destinations);
    });
    return () => { live = false; };
  }, [depLat, depLng]);

  const etas = STATUS_ETAS(ride.pickupWait);
  // The most recent travel this traveler ACTUALLY took, for Patron Support to open against.
  // This read pastTrips[0], which — until the fabricated journeys were removed — was a
  // seeded trip nobody had been on, and is now simply absent for a new account.
  // The travel a case concerns by default: the most recent completed one, not merely the most
  // recent record, which may be a cancelled travel nobody took.
  const firstTripNo =
    ride.myRides.find((r) => r.status === 'completed')?.tripNo ||
    ride.myRides[0]?.tripNo ||
    ride.pastTrips[0]?.no;
  // ONE ROW PER DESTINATION (Chad, 13 Sept 2026: three identical airport rows clutter the
  // field without adding value). The list answers "where have I been", and a place answers
  // that once however many times it was visited; the most recent travel to it is the one
  // whose receipt the row opens. A traveler with three different destinations still sees
  // three rows, so nothing is hidden — only the repetition goes.
  const [menuOpen, setMenuOpen] = useState(false);
  const { note, showNote } = useNote();

  // The drawer head speaks for the signed-in account — named and initialed by the
  // one shared rule (src/account.ts), transcribed from the demo.
  const acctName = useMemo(() => accountName(user), [user]);
  // THE TRAVELER'S OWN PLACES — home, work, favourites — one tap from here (Adrian, 14 Sept
  // 2026). Re-read whenever Home is shown, so a place saved on the profile is here on return.
  const [savedPlaces, setSavedPlaces] = useState<SavedPlaces>({ favorites: [] });
  useFocusEffect(
    useCallback(() => {
      let live = true;
      loadSavedPlaces().then((p) => live && setSavedPlaces(p));
      return () => {
        live = false;
      };
    }, []),
  );
  const savedRows: { key: string; title: string; place: SavedPlace }[] = [
    ...(savedPlaces.home ? [{ key: 'home', title: t('traveler.homeAddress'), place: savedPlaces.home }] : []),
    ...(savedPlaces.work ? [{ key: 'work', title: t('traveler.workAddress'), place: savedPlaces.work }] : []),
    ...savedPlaces.favorites.map((f) => ({ key: `fav:${f.label}`, title: f.label, place: f })),
  ];
  // The drawer head: the sign-up name, else the account's address — never the address's
  // local part passed off as a name ("chadkhalil21" was the founder's own inbox).
  const headName = useMemo(
    () => user?.displayName?.trim() || user?.email?.trim() || acctName,
    [user, acctName],
  );

  // Recent Travel rows open that trip's own receipt — same shaping the Travel Log uses,
  // so one trip can never render two different receipts (src/receipt.ts).
  const openReceipt = (r: RideRecord) => {
    ride.setViewTrip(receiptFromRide(r, language, t));
    router.navigate({ pathname: '/receipt', params: { from: 'home' } });
  };

  // Establish where the traveler actually is, once, on open. Until this resolves the
  // departure stays the named fallback — we never claim a location we have not confirmed.
  // Declining permission is a legitimate answer: the pickup simply stays the named place,
  // which the traveler can change on the booking screen.
  const askedLocation = useRef(false);
  useEffect(() => {
    if (askedLocation.current) return;
    askedLocation.current = true;
    resolveCurrentDeparture().then((here) => {
      if (here) ride.setDeparture(here);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load this traveler's real rides from the database once their account is ready.
  useEffect(() => {
    if (user) ride.refreshMyRides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // SUGGESTED TRAVEL is EARNED, never furniture (Adrian, 8 Aug): a brand-new account sees
  // nothing here. Once real trips exist, suggest the place this person actually goes —
  // most-booked destination, ties broken by most recent — and only if it maps to a place
  // the app can book in one tap. Shown price = what they paid last time (the booking screen
  // re-quotes fresh, and the quoted price is the fixed one).
  const suggestion = useMemo(() => {
    if (ride.myRides.length === 0) return null;
    const counts = new Map<string, { n: number; latest: number; totalCents: number }>();
    for (const t of ride.myRides) {
      const prev = counts.get(t.arr);
      const at = new Date(t.createdAt).getTime();
      if (!prev) counts.set(t.arr, { n: 1, latest: at, totalCents: t.totalCents });
      else {
        prev.n += 1;
        if (at > prev.latest) {
          prev.latest = at;
          prev.totalCents = t.totalCents;
        }
      }
    }
    let best: { arr: string; n: number; latest: number; totalCents: number } | null = null;
    for (const [arr, v] of counts) {
      if (!best || v.n > best.n || (v.n === best.n && v.latest > best.latest)) {
        best = { arr, ...v };
      }
    }
    if (!best) return null;
    // Resolve through canonicalPlaceName first: a trip booked before a destination was
    // renamed still carries the old label, and matching raw would silently empty this
    // section for exactly the loyal travelers it exists to serve.
    const arrived = canonicalPlaceName(best.arr);
    const place: Place | undefined = [HOME_PLACE, ...PLACES].find(
      (p) => p.name === arrived || p.short === arrived,
    );
    if (!place) return null; // only suggest what one tap can actually book
    // Deliberately no price here. What this travel last cost is not what it costs now, and
    // a figure carried in this object is a figure something will eventually render.
    return { place };
  }, [ride.myRides]);

  // WHAT THIS TRAVEL COSTS NOW, not what it cost last time.
  //
  // The card printed `lastPaidCents` — the total from a previous journey — as a bare figure
  // beside "Select ›". A traveler read it as the price, tapped through, and met a different
  // one: $36.29 on the card against $19.29 on Travel Options, for the same two places on the
  // same afternoon. Fares move with distance and class, so a past total is not a quote and
  // must not be dressed as one.
  //
  // Null until the server answers, and null if it cannot. No price beats a wrong price: the
  // destination is still one tap from a real quote either way.
  // A PLACE APPEARS ONCE ON THE SCREEN, NOT ONCE PER LIST (Chad, 13 Sept 2026). The suggestion
  // is drawn from the same history, so the most-travelled destination was offered above and
  // then listed again directly beneath it. The suggested place is excluded here; the list
  // still fills to three from what remains.
  const recentDistinct = useMemo(() => {
    const seen = new Set<string>();
    if (suggestion) seen.add(canonicalPlaceName(suggestion.place.name));
    const out: typeof ride.myRides = [];
    for (const r of ride.myRides) {
      const key = canonicalPlaceName(r.arr);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
      if (out.length === 3) break;
    }
    return out;
  }, [ride.myRides, suggestion]);

  const [suggestedCents, setSuggestedCents] = useState<number | null>(null);
  // THE JOURNEY TIME FOR THIS TRAVELER, not the one baked into the destination list. That one
  // was measured from Brickell and printed to whoever was reading it — a P2 on the known list
  // since 16 September, seen with the simulator sitting in San Francisco. The quote below is
  // already being fetched for the price; the time comes back with it and costs nothing.
  const [suggestedMinutes, setSuggestedMinutes] = useState<number | null>(null);
  // The whole quote, not just the price on the card: tapping the card goes straight to
  // Travel Confirmation, which has to show the SAME total, and would otherwise re-derive it.
  const [suggestedQuote, setSuggestedQuote] = useState<{
    travelCostCents: number;
    feeLines: FeeLine[];
    pickup: { lat: number; lng: number } | null;
    dest: { lat: number; lng: number } | null;
  } | null>(null);
  useEffect(() => {
    let live = true;
    setSuggestedCents(null);
    setSuggestedMinutes(null);
    if (!suggestion) return;
    const dep = ride.departure;
    const place = suggestion.place;
    const pickup = dep?.lat != null && dep?.lng != null ? { lat: dep.lat, lng: dep.lng } : null;
    const dest = place.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : null;
    setSuggestedQuote(null);
    fetchQuote({ pickup, dest, destination: place.name }).then((q) => {
      if (!live) return;
      // A suggestion we cannot serve shows no price rather than a wrong one. The card still
      // appears — it is the traveler's own history — and tapping it says why on the next screen.
      if (isUnavailable(q) || !q) {
        setSuggestedCents(null);
        setSuggestedQuote(null);
        return;
      }
      setSuggestedCents(q.travelerPays ?? null);
      setSuggestedMinutes(typeof q.minutes === 'number' ? Math.max(1, Math.round(q.minutes)) : null);
      setSuggestedQuote({
        travelCostCents: q.travelCostCents,
        feeLines: q.feeLines,
        pickup,
        dest,
      });
    });
    return () => {
      live = false;
    };
  }, [suggestion, ride.departure]);

  const go = (path: Parameters<typeof router.navigate>[0]) => {
    setMenuOpen(false);
    router.navigate(path);
  };

  // THE MENU IN THREE GROUPS (Chad, 14 Sept 2026: nine stacked rows are decision friction;
  // group them into account, travel and assistance). Each row is named for what it opens.
  //
  // WHAT LEFT THE MENU. "Become an Operator": recruiting does not belong in a traveler's
  // menu (Chad); an operator enters at the front door, where the Operator role opens the
  // qualification flow. An account already qualifying or Commissioned still sees its own
  // state below, because that is the account's fact, not a pitch. "Notifications": it is a
  // row inside Settings, and was listed twice.
  type Row = { label: string; onPress: () => void };
  const operatorRow: Row | null =
    operator.verification === 'commissioned'
      ? {
          label: t('traveler.switchToOperator'),
          onPress: () => {
            setMenuOpen(false);
            operator.setRole('operator');
            if (router.canDismiss()) router.dismissAll();
            router.replace('/operator');
          },
        }
      : operator.verification === 'pending'
        ? { label: t('traveler.finishOperatorQualification'), onPress: () => go('/operator/review') }
        : null;
  const MENU_GROUPS: { label: string; rows: Row[] }[] = [
    {
      label: t('traveler.account'),
      rows: [
        { label: t('traveler.paymentMethods'), onPress: () => go('/wallet') },
        { label: t('traveler.settings'), onPress: () => go('/settings') },
        { label: t('traveler.inviteFriends'), onPress: () => go('/invite') },
        ...(operatorRow ? [operatorRow] : []),
      ],
    },
    {
      label: t('traveler.travel'),
      rows: [
        // A travel that is live or reserved sits at the head of the group (Chad: an active
        // itinerary belongs in the menu). Each opens the screen that shows it.
        ...(ride.rideActive ? [{ label: t('traveler.travelInProgress'), onPress: () => go('/ride') }] : []),
        ...(ride.scheduled && !ride.rideActive
          ? [{ label: t('traveler.scheduledTravel'), onPress: () => go('/schedule') }]
          : []),
        { label: t('traveler.travelLog'), onPress: () => go({ pathname: '/history', params: { from: 'home' } }) },
      ],
    },
    {
      label: t('traveler.assistance'),
      rows: [
        {
          label: t('traveler.patronSupport'),
          onPress: () => {
            ride.openHelp(firstTripNo);
            go({ pathname: '/issues', params: { from: 'home' } });
          },
        },
        { label: t('traveler.safeTravels'), onPress: () => go('/safety') },
        {
          // Opens the real company page. It is also where the 99% belongs: the founders'
          // brief §10A puts the operator-retention statement in a permanent
          // company-information section, stated once as an institutional fact rather than
          // repeated through the journey.
          label: t('traveler.aboutAmericanRider'),
          onPress: () => {
            setMenuOpen(false);
            Linking.openURL(`${LEGAL_URL}/about`);
          },
        },
      ],
    },
  ];

  return (
    <Screen note={note}>
      {/* bar('menu') — the one shared letterhead, so home can never drift from the
          other screens again. It owns the demo's 24px gap below itself. */}
      <LetterheadBar onMenu={() => setMenuOpen(true)} />

      <Display>{t('traveler.beginTravel2')}</Display>

      {/* SPATIAL CONTEXT, NOT THE SUBJECT OF THE SCREEN (Chad, 13 Sept 2026, approved the
          same evening). It shows where the traveler is and nothing else: no operators we
          cannot see, no LIVE badge over a position the device gave us a moment ago. It draws
          only once a real fix has resolved, so it never presents a guessed location as a
          known one, and it is absent on web and Android until our own tiles exist. */}
      <HomeMap lat={ride.departure.lat} lng={ride.departure.lng} />

      {/* NO WELCOME BLOCK — removed 15 Aug 2026. Two independent standards condemned
          it. (1) Chad's web demo has no equivalent; it was an undisclosed addition that
          pushed the whole home screen down ~135px. (2) Its copy — "One all-in price — no
          surge, no surprises" — is precisely the promotional register the founders' design
          brief forbids (sections 8 and 31): American Rider does not reassure people that
          its price is trustworthy, it states the price and lets that carry the meaning.
          The 99% model belongs in About American Rider and once, quietly, on a completed
          receipt — not on the booking screen. The `ar:welcomed:v1` flag and dismissWelcome
          go with it. */}

      {rideOngoing && (
        <Pressable onPress={() => router.navigate('/ride')}>
          <View style={styles.ongoingCard}>
            <View style={styles.ongoingLeft}>
              <PulseDot />
              <View>
                <Text style={styles.ongoingTitle}>{STATUS_LABELS[ride.status]}</Text>
                <Text style={styles.ongoingSub}>{t('traveler.tapToSeeRide')}</Text>
              </View>
            </View>
            <Num size={13} weight="600" color={colors.blueSoft}>
              {etas[ride.status]}
            </Num>
          </View>
        </Pressable>
      )}

      {/* A Smart Travel journey between its two car travels: the traveler is on, or heading
          to, the transit leg, and the last car travel is still to be reserved. Without this
          row the plan was unreachable from anywhere once Travel Complete was dismissed. */}
      {!rideOngoing && ride.smartJourney && (
        <Pressable onPress={() => router.navigate('/smart')}>
          <View style={styles.ongoingCard}>
            <View style={styles.ongoingLeft}>
              <PulseDot />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.ongoingTitle}>{t('traveler.smartTravel')}</Text>
                <Text style={styles.ongoingSub} numberOfLines={1}>
                  {(() => {
                    const legs = ride.smartJourney.plan.legs;
                    const next = legs.find((l) => l.kind === 'transit') ?? legs[legs.length - 1];
                    return t('traveler.smartNext', { leg: legTitle(next, t) });
                  })()}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      )}

      {/* The demo's Upcoming Travel card: blue-tinted, margin-top 18, padding 16/18,
          label in blue, destination 15.5/600, when · price 13 ink2, red Cancel. */}
      {/* THE CARD NOW REPORTS THE RESERVATION'S ACTUAL STATE, not only that one was made.
          Until backend/scheduler.js existed there was one state to report — "we wrote this
          down" — because nothing ever happened to a reservation afterwards. Now an operator
          is assigned, or the card was declined, or nobody was available, and each of those is
          something the traveler has to be told without being asked to guess from silence. */}
      {ride.scheduled && ride.schedInfo && (
        <View style={styles.upcomingCard}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <SectionLabel style={styles.upcomingLabel}>
                {ride.schedState?.status === 'dispatched' ? 'Operator Assigned' : 'Upcoming Travel'}
              </SectionLabel>
              <Text style={styles.upcomingDest}>{ride.schedInfo.arr}</Text>
              <Text style={styles.upcomingWhen}>
                {ride.schedInfo.when} {ride.schedInfo.time} {ride.schedInfo.period} ·{' '}
                {fmt(ride.schedInfo.cost)}
              </Text>
              {ride.schedState?.status === 'dispatched' && (
                <Text style={styles.upcomingWhen}>
                  {ride.schedState.operatorName}
                  {typeof ride.schedState.etaMin === 'number'
                    ? t('traveler.schedEtaToPickup', { n: ride.schedState.etaMin })
                    : ''}
                </Text>
              )}
              {/* The Travel Number exists from the moment the reservation is made, so it is
                  shown from that moment. Mono, as every travel number in the app is. */}
              {!!ride.schedState?.tripNo && (
                <Mono style={styles.upcomingNo}>{ride.schedState.tripNo}</Mono>
              )}
            </View>
            {/* Cancelling a reservation and cancelling a dispatched travel are different acts
                with different consequences, and this control can only honestly perform the
                first. Once an operator is on their way it points at the travel, where the
                terms of cancelling it are stated. */}
            {ride.schedState?.status === 'dispatched' ? (
              <Pressable onPress={() => router.navigate('/ride')} hitSlop={8}>
                <Text style={styles.upcomingOpen}>{t('traveler.view')} ›</Text>
              </Pressable>
            ) : (
              <Pressable onPress={ride.cancelScheduled} hitSlop={8}>
                <Text style={styles.upcomingCancel}>{t('traveler.cancel2')}</Text>
              </Pressable>
            )}
          </View>

          {ride.schedState?.status === 'unmatched' && (
            <Text style={styles.upcomingFail}>
              {ride.schedState.closedReason || t('traveler.noOperatorAvailable')} {t('traveler.noChargeMade')}
            </Text>
          )}
          {ride.schedState?.status === 'payment_failed' && (
            <Text style={styles.upcomingFail}>
              {ride.schedState.paymentError || t('traveler.cardDeclined')} {t('traveler.noOperatorSent')}
            </Text>
          )}
          {ride.schedState?.status === 'needs_attention' && (
            <Text style={styles.upcomingFail}>
              {t('traveler.chargedNotCreated')}
            </Text>
          )}
        </View>
      )}

      {/* DEPARTURE. Chad §20: a quoted price must be attached to the route that produced
          it, and every price on this screen is quoted FROM here. Stating it also makes the
          bottom of the page one block — from here, go — which is the job the CTA could not
          do alone. Reads the resolved position when we have one, the named fallback when
          we do not; it never asserts a location the app has not established. */}
      <View style={styles.depRow}>
        <Text style={styles.depLabel}>{t('traveler.departure')}</Text>
        {/* TWO LINES, NOT ONE. `numberOfLines={1}` truncated this to "Current location —
            Miami Financi…" once Dynamic Type was enabled — and a pickup a traveler cannot
            read is the one field on this screen that has to be legible. Options wraps the
            same string correctly; this row simply forbade it. Two lines is enough for every
            place name in the market at the 1.3 cap, and it still truncates beyond that
            rather than pushing the destination field down the screen. */}
        <Text style={styles.depValue} numberOfLines={2}>
          {prettyPlace(ride.departure.name)}
        </Text>
      </View>

      <Pressable
        onPress={() => {
          ride.startBooking();
          router.navigate({ pathname: '/reserve', params: { search: '1' } });
        }}
      >
        <View style={styles.searchCard}>
          <Magnifier />
          <Text style={styles.searchPlaceholder}>{t('traveler.destinationEntry')}</Text>
        </View>
      </Pressable>

      {/* THE AI PLANNER IS WITHDRAWN, 4 Sept 2026, on the founders' decision — not shipping at
          launch, and possibly refined and reintroduced later.

          AGENTS.md recorded it as an explicit KEEP, which is why the link was here at all.
          That instruction is now superseded and AGENTS.md has been corrected in the same
          change; a stale instruction file is how a withdrawn feature comes back by accident.

          app/plan.tsx and src/backend/assistant.ts are deliberately left in place. The work is
          finished and the server route is live — deleting it would mean rebuilding it to
          reintroduce it. What is removed is the ENTRY POINT, which is the only thing that
          decides whether a traveler meets the feature. No traveler can reach it now.

          Home therefore offers exactly one way to name a destination: the field above. */}

      {/* SAVED PLACES: shown only once the traveler has saved one; each opens the sheet with
          the place already quoted from its saved coordinates. */}
      {savedRows.length > 0 && (
        <>
          <SectionLabel style={styles.labelSuggested}>{t('traveler.savedPlaces')}</SectionLabel>
          <View style={styles.listCard}>
            {savedRows.map((row, i) => (
              <Pressable
                key={row.key}
                accessibilityRole="button"
                onPress={() => {
                  ride.startBooking({
                    name: row.place.label,
                    short: row.place.label,
                    cost: 0,
                    meta: '',
                    lat: row.place.lat,
                    lng: row.place.lng,
                  });
                  router.navigate('/reserve');
                }}
              >
                <View style={[styles.listRow, i > 0 && styles.listRowDivider]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listName}>{row.title}</Text>
                    {row.title !== row.place.label && (
                      <Text style={styles.listMeta}>{row.place.label}</Text>
                    )}
                  </View>
                  <Chev />
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* Earned, never furniture: no trips, no section. */}
      {suggestion && (
        <>
          <SectionLabel style={styles.labelSuggested}>{t('traveler.suggestedTravel')}</SectionLabel>
          <Pressable
            onPress={() => {
              // ONE TAP TO THE PRICE, ONE TAP TO CONFIRM (Chad, 13 Sept 2026, approving the
              // route to confirmation rather than a single-tap charge). The traveler sees the
              // Complete Travel Cost as one total before anything is authorised; nothing is
              // charged here. Where the quote has not arrived — offline, or a suggestion we
              // cannot serve — the old path still runs, so the price is never invented to
              // save a step.
              ride.startBooking(suggestion.place);
              if (suggestedQuote) {
                ride.setQuotedFareCents(suggestedQuote.travelCostCents);
                ride.setQuotedFeeLines(suggestedQuote.feeLines);
                ride.setTripCoords(
                  suggestedQuote.pickup && suggestedQuote.dest
                    ? { pickup: suggestedQuote.pickup, dest: suggestedQuote.dest }
                    : null,
                );
                router.navigate('/reserve');
                return;
              }
              router.navigate('/reserve');
            }}
          >
            <View style={styles.itemCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{prettyPlace(suggestion.place.name)}</Text>
                {/* The number has to say what it measures. The demo prints a bare "24 min"
                    and we printed "24 min away", and neither tells a traveler whether it is
                    how long the journey takes or how far off their operator is. Chad, 15 Aug:
                    use the short form only where there is no realistic way to misread it —
                    sat beside a price and a Select link, there is. Ambiguity about time sits
                    next to ambiguity about money on the list of things this app must not do. */}
                {/* NO TIME RATHER THAN A WRONG ONE. Until the quote answers we do not know how
                    long this journey takes from where the traveler is standing, and the
                    number that used to sit here was a time from Brickell. */}
                {suggestedMinutes != null && (
                  <Text style={styles.itemMeta}>
                    {t('traveler.estimatedTravelTime', { n: suggestedMinutes })}
                  </Text>
                )}
              </View>
              <View style={styles.rowRight}>
                {suggestedCents != null && (
                  <Num size={16} weight="600">
                    {fmt(suggestedCents / 100)}
                  </Num>
                )}
              </View>
            </View>
          </Pressable>
        </>
      )}

      {/* DESTINATIONS — what a new account sees instead of nothing.
          Chad, 16 Aug: "when someone first creates an account, there won't be any recent
          travels, does the Home Screen merely stay mostly blank? That may not be optimal."
          It did: a title, a field and a button.

          These are NOT suggestions — SUGGESTED TRAVEL stays earned from real trips
          (Adrian, 8 Aug) and never appears to someone who has not travelled. This is the
          list of places American Rider can actually book, stated plainly. It answers the
          question the empty field could not: a first-time traveler has no way of knowing
          what this app accepts until they type something and hope.

          No prices. A price belongs to a chosen route, not a menu (Chad, 16 Aug), and the
          server re-quotes anyway. It retires itself the moment the traveler has history,
          so the screen fills in with use rather than changing shape. */}
      {/* THE LIST COMES FROM THE SERVER, FOR THE REGION THE TRAVELER IS STANDING IN.
          It was hardcoded here until 20 Sept 2026 — five Miami-Dade places shown to every
          first-time traveler wherever they were, each with a journey time computed from
          Brickell. Fort Lauderdale is inside our market: a traveler there was served, offered
          destinations twenty-five miles away, and read times for a journey starting somewhere
          they were not.

          AN EMPTY LIST RENDERS NOTHING, on purpose. Outside a region, or with no position yet,
          the traveler sees no destination list rather than another city's. */}
      {ride.myRides.length === 0 && nearby.length > 0 && (
        <>
          <SectionLabel style={styles.labelSuggested}>{t('traveler.destinations')}</SectionLabel>
          <View style={styles.listCard}>
            {nearby.map((p, i) => (
              <Pressable
                key={p.name}
                onPress={() => {
                  ride.startBooking({ name: p.name, short: p.short, cost: 0, meta: '', lat: p.lat, lng: p.lng });
                  router.navigate('/reserve');
                }}
              >
                <View style={[styles.listRow, i > 0 && styles.listRowDivider]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listName}>{p.name}</Text>
                    <Text style={styles.listMeta}>{t('traveler.estimatedTravelTime', { n: p.minutes })}</Text>
                  </View>
                  <Chev />
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {recentDistinct.length > 0 && (
        <>
          <SectionLabel style={styles.labelRecent}>{t('traveler.recentTravel')}</SectionLabel>
          <View style={styles.listCard}>
            {/* NO PRICE ON THESE ROWS — founders' call, 13 Aug 2026 (Chad: not on the
                home screen; Adrian: "have something like a receipt somewhere").
                The demo does print a price here, but it prints the LIVE fare for
                re-booking that route. Ours could only show what was paid on the day,
                and a stale number sitting on the booking screen is a trap: read
                $13.49, tap, get quoted $26 — the exact surprise "one all-in price, no
                surge, no surprises" promises never to deliver. So the row answers
                "where have I been", and the price lives on the receipt, where it is
                unambiguous. Tapping opens THAT trip's receipt (not the Travel Log). */}
            {recentDistinct.map((r, i) => (
              <Pressable key={r.id} onPress={() => openReceipt(r)}>
                <View style={[styles.listRow, i > 0 && styles.listRowDivider]}>
                  {/* NO DOT. The demo's .pin is a map pin whose COLOUR carries meaning —
                      ink for departure, blue for arrival, faint for a past trip. On this
                      row none of that is visible: there is nothing beside it to compare
                      against, so it reads as a status light that reports no status.
                      Chad, 15 Aug: "The gray dots need a meaning… If they do not
                      communicate something real, remove them." An institutional interface
                      should not carry elements that imply semantics they do not have. */}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listName}>{canonicalPlaceName(r.arr)}</Text>
                    <Text style={styles.listMeta}>
                      {travelDateShort(r.createdAt, language)}{' '}
                      · {t('traveler.fromPlace', { place: prettyPlace(r.dep) })}
                    </Text>
                  </View>
                  <Chev />
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* .spring — pushes the CTA to the bottom of a short screen. */}
      <View style={{ flex: 1 }} />

      <Pressable
        onPress={() => {
          ride.startBooking();
          router.navigate({ pathname: '/reserve', params: { search: '1' } });
        }}
      >
        {/* SOLID INK — reverted 16 Aug. Chad tried the ghost treatment and rejected it:
            "the original color provided the screen with a fine balance." He is right that a
            pale button on pale paper loses the weight that anchors the page. The state
            worry it was meant to answer is handled instead by the departure line above it:
            the bottom of the screen now reads as one block — from here, go. */}
        <View style={styles.reserveBtn}>
          <Text style={styles.reserveBtnText}>{t('traveler.reserveTravel')}</Text>
        </View>
      </Pressable>

      {/* SCHEDULE SITS BESIDE THE PRIMARY ACTION (Chad, 13 Sept 2026). The screen existed and
          was reachable only after a destination had been chosen, which is the wrong moment
          for a traveler who already knows they are arranging next Tuesday. */}
      <Pressable
        onPress={() => {
          ride.startBooking();
          router.navigate('/schedule');
        }}
        hitSlop={8}
      >
        <Text style={styles.scheduleLink}>{t('traveler.scheduleForLater')}</Text>
      </Pressable>

      {/* The demo's drawer: scrim + sliding left panel, hairline-topped rows, no spring.
          THE HEAD IS THE ACCOUNT'S NAME, NOT A HANDLE AND NOT A BUBBLE (Chad, 14 Sept 2026).
          The name the traveler gave at sign-up when there is one; otherwise the address the
          account is held under — a fact, never a username minted from it. No initials disc:
          the letterhead already carries the person mark, and a second one here was
          furniture. The link beneath is monochrome and named for what it opens. */}
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)}>
        <Pressable onPress={() => go('/profile')} style={styles.drawerHead} accessibilityRole="button">
          <Text style={styles.drawerName} numberOfLines={1}>{headName}</Text>
          <Text style={styles.drawerProfileLink}>{t('traveler.accountDetails')} ›</Text>
        </Pressable>
        {MENU_GROUPS.map((group) => (
          <View key={group.label}>
            <SectionLabel style={styles.drawerLabel}>{group.label}</SectionLabel>
            {group.rows.map((item) => (
              <DrawerRow key={item.label} label={item.label} onPress={item.onPress} />
            ))}
          </View>
        ))}
        {/* NO SPRING HERE — deliberate, documented deviation from the demo's markup.
            The demo puts <div class="spring" style="flex:1"> above Sign Out, which pins it
            to the bottom of the panel. Chad only ever saw the demo in mobile Safari, where
            the URL bar and toolbar shorten the viewport enough that the spring collapses to
            ~0 and Sign Out sits directly under "About American Rider". That tight version is
            the one he approved (12 Aug 2026, screenshot): "he wanted exactly like this where
            there's almost no spaces". Full-screen the spring would open to 161px at 390x844.
            Design authority beats the demo's literal CSS — see docs/EXACTNESS-SWEEP.md. */}
        {/* INK, NOT RED. Red is reserved for Call 911 (contract: buttons.red); ending a
            session is not an emergency, and a warning colour on it read as one. */}
        <DrawerRow
          label={t('traveler.signOut')}
          color={colors.ink2}
          chev={false}
          onPress={() => {
            setMenuOpen(false);
            signOut();
          }}
        />
      </Drawer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ongoingCard: {
    marginTop: 18,
    backgroundColor: colors.ink,
    borderRadius: radii.card,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ongoingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ongoingTitle: { fontSize: 14, fontWeight: '600', color: '#fff' },
  ongoingSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  // Demo: .card margin-top:18 padding:16px 18px background:--blue-t border:--blue-b
  upcomingCard: {
    marginTop: 18,
    backgroundColor: colors.blueTint,
    borderWidth: 1,
    borderColor: colors.blueBorder,
    borderRadius: radii.card,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  upcomingLabel: { color: colors.blue },
  upcomingDest: { fontSize: 15.5, fontWeight: '600', color: colors.ink, marginTop: 7 },
  upcomingWhen: { fontSize: 13, color: colors.ink2, marginTop: 3 },
  // INK (Chad, 19 Sept 2026). Cancelling a reservation that has not been dispatched is an
  // ordinary correction, not a destructive act, and it sits on the home screen.
  upcomingCancel: { fontSize: 13, fontWeight: '600', color: colors.ink },
  upcomingOpen: { fontSize: 13, fontWeight: '600', color: colors.blue },
  upcomingNo: { fontSize: 11.5, color: colors.muted, marginTop: 6, letterSpacing: 0.6 },
  upcomingFail: { fontSize: 13, color: colors.ink2, marginTop: 11, lineHeight: 18.5 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  // Demo: .card margin-top:22 padding:17px 18px gap:13, 16.5px --muted placeholder
  searchCard: {
    marginTop: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.card,
    // 16/18 is the demo's own field padding; ours was 17. It also answers Chad's note
    // that the search object read as a hero element — 2px shorter, same tap target.
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  searchPlaceholder: { fontSize: 16.5, color: colors.muted },
  // Demo: 'Suggested Travel' margin-top:26 · 'Recent Travel' margin-top:28 · card mt 12
  labelSuggested: { marginTop: 26, marginBottom: 12 },

  labelRecent: { marginTop: 28, marginBottom: 12 },
  // Demo: .card padding:18px 20px
  itemCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.card,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemName: { fontSize: 16.5, fontWeight: '600', color: colors.ink },
  itemMeta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  // Demo: .card padding:2px 20px, rows are .lrow{ padding:16px 0; gap:14 }
  listCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.card,
    paddingVertical: 2,
    paddingHorizontal: 20,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 14,
  },
  listRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  // The demo's recent rows are REGULAR weight at 15px — not bold at 16.
  listName: { fontSize: 15, color: colors.ink },
  listMeta: { fontSize: 12.5, color: colors.muted, marginTop: 3 },
  rowRight: { alignItems: 'flex-end' },
  scheduleLink: {
    textAlign: 'center',
    fontSize: 13.5,
    fontWeight: '500',
    color: colors.ink2,
    paddingVertical: 14,
  },
  rowAction: { fontSize: 12, fontWeight: '600', color: colors.blue, marginTop: 4 },
  // .btn.cta-space{ margin-top:24; border-radius:13; padding:18; 16/600/.01em }
  depRow: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  depLabel: { fontSize: 12, color: colors.muted },
  depValue: { fontSize: 13.5, color: colors.ink2, flexShrink: 1, textAlign: 'right' },
  reserveBtn: {
    marginTop: 12,
    backgroundColor: colors.solid,
    borderRadius: radii.button,
    padding: 18,
    alignItems: 'center',
  },
  reserveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.16,
    color: colors.solidFg,
  },
  // The demo's drawer head: avatar · name/link, gap 13, air below — no rule (the
  // first row's top hairline draws the line).
  drawerHead: { paddingBottom: 18 },
  drawerName: { fontSize: 17, fontWeight: '600', color: colors.ink },
  // Monochrome, weight-carried, like every other modify control since 13 Sept 2026.
  drawerProfileLink: { fontSize: 13, fontWeight: '600', color: colors.ink2, marginTop: 4 },
  drawerLabel: { marginTop: 18, marginBottom: 4 },
});
