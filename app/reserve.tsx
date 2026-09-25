// Travel Confirmation — the one sheet between a destination and a car.
//
// WHY ONE SHEET. Chad, 13–14 September 2026: four screens stood between naming a destination
// and an operator being sent — Travel Summary, Travel Options, Cabin Environment, Travel
// Confirmation — each ending in Continue. "It is subpar to have four screens before a car is
// on its way." They are combined here: the route on a map, the departure time, the vehicle
// class with the price of each, the saved cabin environment, the Complete Travel Cost, and one
// control that does what it says. Cabin Environment stays as a sub-screen for changing the
// saved settings and returns here; Schedule stays as the sub-screen for a later departure.
//
// The demo's search screen is kept whole inside it: editable pickup (with the map pin), the
// destination field and its results, and the live server quote. While a field is being edited
// the sheet shows only the fields and their results; the rest returns with the pick.
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from '../src/components/AppText';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { destinationsNear, type Destination } from '../src/backend/destinations';
import { fetchQuote, geocodePlace, isUnavailable } from '../src/backend/fares';
import { joinWaitlist } from '../src/backend/connect';
import { fetchSmartQuote } from '../src/backend/smart';
import { useGoBack } from '../src/components/nav';
import { RouteMap } from '../src/components/RouteMap';
import {
  Card,
  Chev,
  LetterheadBar,
  Num,
  PrimaryButton,
  Screen,
  SectionLabel,
  Sub,
  Title,
} from '../src/components/UI';
import {
  prettyPlace,
  applyClassCents,
  classNameKey,
  BOOKABLE_CLASSES,
  DEP_PLACES,
  Place,
  PLACES,
  platformFee,
} from '../src/data';
import { modeLine } from '../src/smartLegs';
import { useCabinPrefs } from '../src/state/cabinPrefs';
import { useRide } from '../src/state/RideContext';
import { paymentModeNote, usePaymentConfig } from '../src/state/PaymentConfigContext';
import { useLanguage } from '../src/state/LanguageContext';
import { colors, fmt } from '../src/theme';

// The demo's search-field magnifier: 18px, muted stroke 1.7.
function Magnifier() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={colors.muted} strokeWidth={1.7} />
      <Path d="M20 20l-3.2-3.2" stroke={colors.muted} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

// The demo's rail icon: 19px, white stroke 1.7 on the solid tile.
function RailIcon() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Rect x={6} y={3} width={12} height={13} rx={3} stroke="#fff" strokeWidth={1.7} />
      <Path
        d="M6 10h12M9 20l2-3M15 20l-2-3"
        stroke="#fff"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// '24 min' → '24'; the sentence supplies the unit in the traveler's own language.
const minutesOf = (meta: string) => (meta.match(/\d+/)?.[0] ?? meta);

export default function TravelConfirmation() {
  const { t } = useLanguage();
  const router = useRouter();
  const goBack = useGoBack();
  const ride = useRide();
  const payConfig = usePaymentConfig();
  const cabin = useCabinPrefs();
  const params = useLocalSearchParams<{ search?: string; q?: string }>();

  const [searching, setSearching] = useState(params.search === '1');
  const [searchingDep, setSearchingDep] = useState(false);
  const [query, setQuery] = useState('');
  const [queryDep, setQueryDep] = useState('');
  const [partyOpen, setPartyOpen] = useState(false);
  const [partyName, setPartyName] = useState(ride.travelParty.travelerName || '');
  const [partyAge, setPartyAge] = useState(ride.travelParty.travelerAge ? String(ride.travelParty.travelerAge) : '');

  // navigate() can update params on an already-mounted screen — reopen search then too.
  useEffect(() => {
    if (params.search === '1') {
      setSearching(true);
      setSearchingDep(false);
      // A destination handed in by name — a receipt's "Travel to … again" for a place that is
      // not one of the shortcuts — arrives as the search already typed, so the traveler is one
      // tap from the sheet rather than back at an empty field.
      if (typeof params.q === 'string' && params.q) setQuery(params.q);
    }
  }, [params.search, params.q]);

  const [pricing, setPricing] = useState(false);
  const [priceFailed, setPriceFailed] = useState(false);
  // Somewhere we do not go. Kept apart from priceFailed because the two need different words:
  // one asks the traveler to try again, the other must not.
  const [unavailable, setUnavailable] = useState<string | null>(null);
  // WHERE THE WAITLIST WOULD RECORD INTEREST: the pickup, and only when it is the pickup that is
  // outside the active counties. Recording it starts nothing but one record on the server.
  const [waitlistAt, setWaitlistAt] = useState<{ lat: number; lng: number } | null>(null);
  const [waitlisted, setWaitlisted] = useState<'idle' | 'sent' | 'failed'>('idle');

  // Only the LATEST quote request may apply its result — without this, the automatic
  // pricing that runs when the screen opens could come back late and overwrite a
  // destination the traveler picked in the meantime.
  const priceReq = React.useRef(0);

  // Choosing a destination shows it straight away, then asks the SERVER what it costs.
  // We never price the trip on the phone — see src/backend/fares.ts for why.
  const chooseDestination = React.useCallback(
    async (place: Place, opts?: { keepSearchOpen?: boolean }) => {
      const req = ++priceReq.current;
      ride.setArrival(place);
      if (!opts?.keepSearchOpen) {
        setSearching(false);
        setQuery('');
      }
      setPricing(true);
      setPriceFailed(false);

      // ANCHORED TO THE TRAVELER, NOT TO MIAMI. A loose destination name is resolved against
      // the city they are standing in — "las olas" means the one four miles away, not the
      // first match the world offers.
      const anchor =
        ride.pickupPin ??
        (ride.departure.lat != null && ride.departure.lng != null
          ? { lat: ride.departure.lat, lng: ride.departure.lng }
          : null);
      const dest = place.lat != null && place.lng != null
        ? { lat: place.lat, lng: place.lng }
        : await geocodePlace(place.name, anchor);
      // Pickup, most precise source first: a dropped pin is exact; a named place carries its
      // own coordinates; only a hand-typed pickup needs the geocoder. Labels like "Current
      // location — Brickell" must never be geocoded — they aren't addresses, and when the
      // geocoder shrugged, the trip silently lost its coordinates (no pins, route, or car).
      const pickup =
        ride.pickupPin ??
        (ride.departure.lat != null && ride.departure.lng != null
          ? { lat: ride.departure.lat, lng: ride.departure.lng }
          : await geocodePlace(ride.departure.name, ride.pickupPin ?? null));
      const quote = await fetchQuote({
        pickup,
        dest,
        destination: place.short, // fallback for web, where there's no OS geocoder
      });

      if (req !== priceReq.current) return; // a newer pick superseded this quote

      if (isUnavailable(quote)) {
        setUnavailable(quote.unavailable);
        setWaitlistAt(quote.waitlistAt ?? null);
        setWaitlisted('idle');
        setPriceFailed(false);
      } else if (quote) {
        setUnavailable(null);
        ride.setArrival({
          ...place,
          cost: quote.travelCostCents / 100,
          meta: quote.miles != null ? `${quote.miles} mi` : place.meta,
          ...(dest ? { lat: dest.lat, lng: dest.lng } : {}),
        });
        // Remember both ends so the payment can be priced the same way the quote was.
        ride.setTripCoords(pickup && dest ? { pickup, dest } : null);
        // The standard fare in cents — every class price on this sheet derives from this.
        ride.setQuotedFareCents(quote.travelCostCents);
        // Government fees the server fenced for this trip — an airport pickup fee, say. They
        // are inside the one price, and the sheet names them.
        ride.setQuotedFeeLines(quote.feeLines);
      } else {
        setPriceFailed(true);
      }
      setPricing(false);
    },
    [ride],
  );

  // Price the preset destination the moment the sheet opens. A suggestion tapped on Home
  // arrives already quoted (tripCoords set) and is not priced twice; a named place that is
  // not yet quoted is, so the sheet never shows the canned demo price or a route with no
  // coordinates. Booking must price identically no matter how you arrived here.
  const pricedOnOpen = React.useRef(false);
  useEffect(() => {
    if (pricedOnOpen.current) return;
    pricedOnOpen.current = true;
    // keepSearchOpen: this is background pricing, not a pick — if the traveler arrived
    // through the search card, their search box must stay open.
    if (!ride.tripCoords) chooseDestination(ride.arrival, { keepSearchOpen: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A SMART TRAVEL LEG IS ALREADY PRICED AND ROUTED. Its ends and fare come from the journey
  // plan (beginSmartLeg), so the route is not editable here, the class is the journey's, and
  // the Smart Travel card — the journey this leg belongs to — is not offered again.
  const smartLeg = !!ride.smartJourney;

  // SMART TRAVEL IS ALWAYS SHOWN, WITH ITS NUMBERS (Chad, 9 Sept 2026): with the journey's
  // price and time when the planner found a transit route, and greyed — saying which — when
  // there is no transit route for this travel or the planner cannot be reached. The server
  // plans on the region's own timetable (OpenTripPlanner); this sheet only reports what it said.
  const { tripCoords, setSmartPlan, setSmartStatus } = ride;
  useEffect(() => {
    if (smartLeg) return undefined;
    let live = true;
    setSmartPlan(null);
    if (!tripCoords) {
      setSmartStatus('idle');
      return undefined;
    }
    setSmartStatus('checking');
    fetchSmartQuote(tripCoords.pickup, tripCoords.dest).then((q) => {
      if (!live) return;
      setSmartStatus(q.status);
      setSmartPlan(q.status === 'ok' ? q.plan : null);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripCoords, smartLeg]);

  const smart = ride.smartPlan;
  // A JOURNEY WHOSE TRANSIT FARE WE DO NOT KNOW (Brightline, Tri-Rail) is not given a total.
  // The card shows what American Rider charges and says the transit fare is on top; a "less
  // than direct" line built without that fare would be a false comparison.
  const fareUnknown = !!smart?.transitFareUnknown;
  const smartDiff = smart ? smart.directCents - smart.journeyCents : 0;
  const smartCompare = !smart
    ? ''
    : fareUnknown
      ? t('traveler.plusTransitFare')
      : smartDiff > 0
        ? t('traveler.lessThanDirect', { amount: fmt(smartDiff / 100) })
        : smartDiff < 0
          ? t('traveler.moreThanDirect', { amount: fmt(-smartDiff / 100) })
          : t('traveler.samePriceAsDirect');
  const smartOffText =
    ride.smartStatus === 'checking'
      ? t('traveler.busyChecking')
      : ride.smartStatus === 'unavailable'
        ? t('traveler.transitUnavailable')
        : t('traveler.noTransitRoute');

  // THE SAME SUM THE SERVER CHARGES, per class: the class fare, the platform fee on it, and
  // any government fee fenced for this trip. The chosen class's figure is ride.travelerTotal,
  // the one derivation every money screen reads; these rows use the same three lines.
  const baseCents = ride.quotedFareCents ?? Math.round(ride.arrival.cost * 100);
  const governmentFee = ride.quotedFeeLines.reduce((sum, l) => sum + l.cents, 0) / 100;
  const allIn = (key: string) => {
    const fare = applyClassCents(baseCents, key) / 100;
    return +(fare + platformFee(fare) + governmentFee).toFixed(2);
  };

  // `meta` carries the server's measured distance as "18.7 mi" once a quote has landed; a
  // named-place fallback carries a duration instead, and that must not be printed as miles.
  // A distance the server rounded to nothing — a pickup on top of its destination — is not
  // stated either: "Route distance: 0 miles" is a number that says the wrong thing.
  const routeMiles = (() => {
    const m = /^([\d.]+)\s*mi$/.exec(ride.arrival.meta ?? '')?.[1];
    return m && parseFloat(m) >= 0.05 ? m : null;
  })();

  // The shortcuts for where this traveler actually is. Twenty, not five: this is a search
  // field and the list is filtered by what they type, where the home screen shows a fixed few.
  const [nearby, setNearby] = useState<Destination[]>([]);
  const depLat = ride.departure.lat;
  const depLng = ride.departure.lng;
  useEffect(() => {
    let live = true;
    if (depLat == null || depLng == null) { setNearby([]); return () => { live = false; }; }
    destinationsNear({ lat: depLat, lng: depLng }, 20).then((r) => { if (live) setNearby(r.destinations); });
    return () => { live = false; };
  }, [depLat, depLng]);

  const q = query.trim().toLowerCase();
  // THE SHORTCUTS ARE THE SERVER'S, FOR THE REGION THE TRAVELER IS IN. They were a Miami-Dade
  // list compiled into the app: a traveler in Fort Lauderdale — inside our market — typed "b"
  // and was offered Brickell and Bayside, twenty-five miles away. Typing a real address always
  // worked anywhere, because that path geocodes; it was only the shortcuts that knew one city.
  //
  // Places we hold no permit for never appear, because the server does not list them.
  const matched = nearby.filter((p) => q === '' || p.name.toLowerCase().includes(q)).slice(0, 4);
  // Anything the traveler types that isn't one of our shortcuts is still a real place —
  // offer to look it up rather than dead-ending with "no places found".
  const typedPlace: Place | null =
    q !== '' && matched.length === 0
      ? { name: query.trim(), short: query.trim(), cost: 0, meta: 'Looking up…' }
      : null;
  // The demo capitalizes the typed place for display; the booked name stays as typed
  // so the geocoder sees exactly what the traveler wrote.
  const typedDisplay = query.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  const qd = queryDep.trim().toLowerCase();
  const depMatched = DEP_PLACES.filter(
    (p) => qd === '' || p.name.toLowerCase().includes(qd),
  ).slice(0, 4);

  // One factual line, whatever the demand: what the operator's arrival is estimated at.
  const waitNote = t('traveler.approxMinToPickup', { n: ride.pickupWait });
  // Reads the server's real key mode instead of a hardcoded "nothing is charged yet", which
  // would become a lie on the sheet a traveler reads before money moves. Null once the server
  // holds a live key; the Terms promise the app says which mode it is in at payment.
  const modeNote = paymentModeNote(payConfig);

  const editing = searching || searchingDep;
  // NOT WHILE THE PRICE IS MOVING. Confirming during a quote would agree to the amount this
  // sheet happens to be showing while the server is computing a different one. And a travel
  // that cannot be charged, or that American Rider does not make, is not one to confirm.
  const busy = pricing || ride.repricing;
  const partyReady = ride.travelParty.mode === 'self' || (ride.travelParty.travelerName.trim().length > 0 && (ride.travelParty.mode !== 'minor' || ((ride.travelParty.travelerAge ?? 0) >= 13 && (ride.travelParty.travelerAge ?? 0) <= 17 && ride.travelParty.guardianAttestation === true)));
  const canReserve = payConfig.canTakePayment && partyReady && !busy && !priceFailed && !unavailable;
  const confirm = () => {
    if (!canReserve) return;
    ride.confirmRide();
    // Home stays at the stack root so Back from the travel goes home instead of exiting.
    router.dismissAll();
    router.navigate('/ride');
  };

  // The saved cabin environment, as the operator will receive it.
  const climateLabel = {
    Cool: t('traveler.prefCool'),
    Moderate: t('traveler.prefModerate'),
    Warm: t('traveler.prefWarm'),
  }[cabin.climate];
  const requests = [
    ride.tripPrefs.charging ? t('traveler.charger') : null,
    ride.tripPrefs.luggage ? t('traveler.luggage') : null,
  ].filter((r): r is string => !!r);

  return (
    <Screen scroll={false}>
      <LetterheadBar onBack={goBack} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Title>{t('traveler.travelConfirmation')}</Title>
          {!editing && <Sub>{t('traveler.reviewAndConfirm')}</Sub>}

          {!editing && !smartLeg && (
            <>
              <SectionLabel style={{ marginTop: 20, marginBottom: 10 }}>TRAVELER</SectionLabel>
              <Card style={{ paddingHorizontal: 20, paddingVertical: 4 }}>
                <Pressable onPress={() => setPartyOpen(!partyOpen)}>
                  <View style={[styles.slotRow]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.slotLabel}>Who is traveling?</Text>
                      <Text style={styles.slotValue}>
                        {ride.travelParty.mode === 'self' ? 'Me' : ride.travelParty.travelerName || 'Another person'}
                      </Text>
                    </View>
                    <Chev />
                  </View>
                </Pressable>
                {partyOpen && (
                  <View style={[styles.slot, styles.hair]}>
                    <Pressable onPress={() => { ride.setTravelParty({ mode: 'self', travelerName: '' }); setPartyOpen(false); }}>
                      <Text style={styles.modify}>Me</Text>
                    </Pressable>
                    <Pressable onPress={() => ride.setTravelParty({ mode: 'other_adult', travelerName: partyName })}>
                      <Text style={[styles.modify,{marginTop:14}]}>Another adult</Text>
                    </Pressable>
                    <TextInput value={partyName} onChangeText={(v) => { setPartyName(v); if (ride.travelParty.mode !== 'self') ride.setTravelParty({ ...ride.travelParty, travelerName: v }); }} placeholder="Traveler name" placeholderTextColor={colors.muted} style={styles.input} />
                    <Pressable onPress={() => ride.setTravelParty({ mode: 'minor', travelerName: partyName, travelerAge: Number(partyAge) || undefined, guardianAttestation: true })}>
                      <Text style={[styles.modify,{marginTop:14}]}>My teen (13–17)</Text>
                    </Pressable>
                    <TextInput value={partyAge} onChangeText={(v) => { setPartyAge(v); if (ride.travelParty.mode === 'minor') ride.setTravelParty({ ...ride.travelParty, travelerAge: Number(v) || undefined, guardianAttestation: true }); }} placeholder="Age 13–17" keyboardType="number-pad" placeholderTextColor={colors.muted} style={styles.input} />
                    {ride.travelParty.mode === 'minor' ? <Text style={{fontSize:12.5,color:colors.muted,lineHeight:18,marginTop:8}}>By requesting this Travel, you confirm that you are the teen’s parent or legal guardian. You will be able to follow the Travel from assignment through completion.</Text> : null}
                  </View>
                )}
              </Card>
            </>
          )}

          {!editing && (
            <RouteMap pickup={ride.tripCoords?.pickup} dest={ride.tripCoords?.dest} route={ride.route} />
          )}

          <Card style={styles.tripCard}>
            {searchingDep ? (
              <View style={[styles.slot, styles.slotDivider]}>
                <Text style={styles.slotLabel}>{t('traveler.pickupLabel')}</Text>
                <TextInput
                  autoFocus
                  value={queryDep}
                  onChangeText={setQueryDep}
                  placeholder={t('traveler.searchPickup')}
                  placeholderTextColor={colors.muted}
                  selectionColor={colors.ink}
                  style={styles.input}
                />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={smartLeg}
                onPress={() => {
                  setSearchingDep(true);
                  setSearching(false);
                  setQueryDep('');
                }}
              >
                <View style={[styles.slotRow, styles.slotDivider]}>
                  <View style={[styles.pin, { backgroundColor: colors.ink }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.slotLabel}>{t('traveler.pickupLabel')}</Text>
                    <Text style={styles.slotValue}>{prettyPlace(ride.departure.name)}</Text>
                  </View>
                </View>
              </Pressable>
            )}

            {searching ? (
              <View style={[styles.slot, styles.searchSlot]}>
                <Magnifier />
                <TextInput
                  autoFocus
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('traveler.searchPlace')}
                  placeholderTextColor={colors.muted}
                  selectionColor={colors.ink}
                  style={[styles.input, { flex: 1, paddingTop: 0 }]}
                />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={smartLeg}
                onPress={() => {
                  setSearching(true);
                  setSearchingDep(false);
                  setQuery('');
                }}
              >
                <View style={styles.slotRow}>
                  <View style={[styles.pin, { backgroundColor: colors.ink }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.slotLabel}>{t('traveler.whereTo')}</Text>
                    <Text style={styles.slotValue}>{ride.arrival.name}</Text>
                  </View>
                </View>
              </Pressable>
            )}

            {/* THE DEPARTURE TIME IS PART OF THE ITINERARY, so it is a row of this card rather
                than a card of its own (one itinerary box, Chad, 13 Sept 2026). Two lines,
                because two labels did not fit on one. A Smart Travel leg departs now. */}
            {!editing && !smartLeg && (
              <Pressable accessibilityRole="button" onPress={() => router.navigate('/schedule')}>
                <View style={[styles.slot, styles.hair]}>
                  <Text style={styles.whenText}>{t('traveler.leavingNow')}</Text>
                  <Text style={styles.modify}>{t('traveler.change')} ›</Text>
                </View>
              </Pressable>
            )}
          </Card>

          {/* The demo's results card: pin rows with the estimated travel time. */}
          {searching && (matched.length > 0 || typedPlace) && (
            <Card style={styles.resultsCard}>
              {matched.map((p, i) => (
                <Pressable
                  key={p.name}
                  accessibilityRole="button"
                  // A server destination carries no price and no baked-in time — both belong
                  // to the chosen route, and the sheet quotes it the moment this is tapped.
                  onPress={() => chooseDestination({ name: p.name, short: p.short, cost: 0, meta: '', lat: p.lat, lng: p.lng })}
                >
                  <View style={[styles.resultRow, i > 0 && styles.hair]}>
                    <View style={[styles.pin, { backgroundColor: colors.ink }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName}>{p.name}</Text>
                      {/* The time from WHERE THIS TRAVELER IS, computed by the server against
                          their own coordinates, not a figure measured from Brickell and shown
                          to everybody. */}
                      <Text style={styles.resultMeta}>
                        {t('traveler.estimatedTravelTime', { n: p.minutes })}
                      </Text>
                    </View>
                    {/* NO PRICE HERE (Chad, 16 Aug). A price against every listed place turns
                        choosing a destination into comparison shopping, and it is not even a
                        quote yet — the server re-prices the chosen route. The amount appears
                        once, below, when a destination has actually been selected. */}
                    <Chev />
                  </View>
                </Pressable>
              ))}
              {typedPlace && (
                <Pressable accessibilityRole="button" onPress={() => chooseDestination(typedPlace)}>
                  <View style={styles.resultRow}>
                    <View style={[styles.pin, { backgroundColor: colors.ink }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName}>{typedDisplay}</Text>
                      <Text style={styles.resultMeta}>{t('traveler.setAsDestination')}</Text>
                    </View>
                    <Chev />
                  </View>
                </Pressable>
              )}
            </Card>
          )}

          {searchingDep && (
            <Card style={styles.resultsCard}>
              {depMatched.map((p, i) => (
                <Pressable
                  key={p.name}
                  accessibilityRole="button"
                  onPress={() => {
                    ride.setDeparture(p);
                    ride.setPickupPin(null); // a named pickup replaces any dropped pin
                    setSearchingDep(false);
                    setQueryDep('');
                  }}
                >
                  <View style={[styles.resultRow, i > 0 && styles.hair]}>
                    <View style={[styles.pin, { backgroundColor: colors.ink }]} />
                    <Text style={styles.resultName}>{p.name}</Text>
                  </View>
                </Pressable>
              ))}
              {qd !== '' && depMatched.length === 0 && (
                <Text style={styles.noResults}>{t('traveler.noPlacesFound')}</Text>
              )}
              {Platform.OS === 'ios' && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setSearchingDep(false);
                    setQueryDep('');
                    router.push('/pickup-map');
                  }}
                >
                  <View style={[styles.resultRow, depMatched.length > 0 && styles.hair]}>
                    <Text style={styles.mapPickText}>{t('traveler.setPickupOnMap')}</Text>
                    <View style={{ flex: 1 }} />
                    <Chev />
                  </View>
                </Pressable>
              )}
            </Card>
          )}

          {!editing && (
            <>
              {/* THE DISTANCE IS A FACT ABOUT THE ROUTE, NOT ABOUT THE CLASS (Chad, 13 Sept
                  2026). Stated once, under the route, and only when the server measured it. */}
              {routeMiles != null && (
                <Text style={styles.routeDistance}>{t('traveler.routeDistance', { miles: routeMiles })}</Text>
              )}

              <Text style={styles.waitNote}>{waitNote}</Text>

              {/* THE VEHICLE CLASS, ON THE SHEET (Chad, 13 Sept 2026: "Merge vehicle class
                  selection directly into the destination summary screen"). Each row states
                  its own Complete Travel Cost; the footer follows the chosen one. */}
              {!smartLeg && (
                <>
                  <SectionLabel style={styles.label}>{t('traveler.vehicleClassLabel')}</SectionLabel>
                  <Card style={styles.listCard}>
                    {BOOKABLE_CLASSES.map((cls, i) => {
                      const on = ride.travelClass === cls.key;
                      return (
                        <Pressable
                          key={cls.key}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: on }}
                          accessibilityLabel={`${t(classNameKey(cls.key))}, ${fmt(allIn(cls.key))}`}
                          onPress={() => ride.setTravelClass(cls.key)}
                        >
                          <View style={[styles.row, i > 0 && styles.hair]}>
                            {/* The demo's 8px class dot: ink when on, inside a 3px tinted ring. */}
                            <View style={[styles.dotRing, on && { backgroundColor: colors.border }]}>
                              <View
                                style={[styles.dot, { backgroundColor: on ? colors.ink : colors.border }]}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.rowTitle, { fontWeight: on ? '600' : '500' }]}>
                                {t(classNameKey(cls.key))}
                              </Text>
                              <Text style={styles.rowSub}>{t(cls.sub)}</Text>
                            </View>
                            <Num size={15} weight="600">
                              {fmt(allIn(cls.key))}
                            </Num>
                          </View>
                        </Pressable>
                      );
                    })}
                  </Card>

                  {ride.smartStatus !== 'idle' && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.navigate('/smart')}
                      disabled={!smart}
                    >
                      {/* ONE FACT PER ROW: a head row that fits at 320 (tile · title · price),
                          then the mode line and the comparison each on their own line. */}
                      <View style={[styles.smartCard, !smart && styles.smartCardOff]}>
                        <View style={styles.smartHead}>
                          <View style={[styles.smartTile, !smart && styles.smartTileOff]}>
                            <RailIcon />
                          </View>
                          <Text
                            style={[
                              styles.smartTitle,
                              { flex: 1, minWidth: 0 },
                              !smart && styles.smartTitleOff,
                            ]}
                          >
                            {t('traveler.smartTravel')}
                          </Text>
                          {smart && (
                            <Num size={15} weight="600">
                              {fmt((fareUnknown ? smart.smartCents : smart.journeyCents) / 100)}
                            </Num>
                          )}
                        </View>
                        {smart ? (
                          <>
                            <Text style={styles.smartSub}>{modeLine(smart, t)}</Text>
                            <Text style={styles.smartMeta}>
                              {t('traveler.durMin', { n: smart.smartMin })} · {smartCompare}
                            </Text>
                          </>
                        ) : (
                          <Text style={styles.smartSub}>{smartOffText}</Text>
                        )}
                      </View>
                    </Pressable>
                  )}
                </>
              )}

              {/* THE CABIN ENVIRONMENT, ALREADY APPLIED (Chad, 13 Sept 2026: saved settings
                  applied by default, one control to adjust them). Each row names what it is
                  and what was chosen, as the operator will receive it. */}
              <SectionLabel style={styles.label}>{t('traveler.travelPreferences')}</SectionLabel>
              <Card style={styles.cabinCard}>
                <View style={styles.cabinRow}>
                  <Text style={styles.cabinLabel}>{t('traveler.climate')}</Text>
                  <Text style={styles.cabinValue}>{climateLabel}</Text>
                </View>
                <View style={[styles.cabinRow, styles.hair]}>
                  <Text style={styles.cabinLabel}>{t('traveler.atmosphere')}</Text>
                  <Text style={styles.cabinValue}>
                    {ride.tripPrefs.quiet ? t('traveler.prefQuiet') : t('traveler.prefConversation')}
                  </Text>
                </View>
                <View style={[styles.cabinRow, styles.hair]}>
                  <Text style={styles.cabinLabel}>{t('traveler.music')}</Text>
                  <Text style={styles.cabinValue}>
                    {cabin.music === 'None' ? t('traveler.prefMusicNone') : t('traveler.prefTravelerChoice')}
                  </Text>
                </View>
                {requests.length > 0 && (
                  <View style={[styles.cabinRow, styles.hair]}>
                    <Text style={styles.cabinLabel}>{t('traveler.additionalRequests')}</Text>
                    <Text style={[styles.cabinValue, { flex: 1, textAlign: 'right' }]}>
                      {requests.join(' · ')}
                    </Text>
                  </View>
                )}
                <Pressable accessibilityRole="button" onPress={() => router.navigate('/prefs')}>
                  <View style={[styles.cabinRow, styles.hair]}>
                    <Text style={styles.modify}>{t('traveler.modifyCabin')} ›</Text>
                  </View>
                </Pressable>
              </Card>

              {/* A GOVERNMENT FEE IS NAMED, BECAUSE IT IS SOMEBODY ELSE'S. The one price stays
                  one price; this says which part of it an airport or a port collects, and from
                  whom. Our own fee is never itemised here. */}
              {ride.quotedFeeLines.length > 0 && (
                <Card style={styles.govFeeCard}>
                  {ride.quotedFeeLines.map((l, i) => (
                    <View key={l.id ?? l.name} style={[styles.govFeeRow, i > 0 && styles.hair]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.govFeeName}>{l.name}</Text>
                        <Text style={styles.govFeeSub}>
                          {t('traveler.includedRemittedTo', { payee: l.payee })}
                        </Text>
                      </View>
                      <Num size={14} weight="600">
                        {fmt(l.cents / 100)}
                      </Num>
                    </View>
                  ))}
                </Card>
              )}
            </>
          )}
        </ScrollView>

        {/* THE PRICE AND THE ACTION STAY IN VIEW. On a sheet this long the amount a traveler
            is agreeing to must not scroll away from the control that agrees to it. An amount
            and a doubt about that amount never render together: while the server is quoting,
            or has refused, the amount is not shown at all and the control waits. */}
        {!editing && (
          <View style={styles.footer}>
            <Card style={styles.totalCard}>
              <Text style={styles.totalLabel}>{t('traveler.totalTravelCost')}</Text>
              {pricing ? (
                <Text style={styles.totalState}>{t('traveler.calculating')}</Text>
              ) : priceFailed || unavailable ? (
                <Text style={styles.totalState}>{t('traveler.unavailable')}</Text>
              ) : (
                <Num size={20} weight="600">
                  {fmt(ride.travelerTotal)}
                </Num>
              )}
            </Card>
            {unavailable && !pricing && <Text style={styles.stateNote}>{unavailable}</Text>}
            {unavailable && !pricing && waitlistAt && (
              waitlisted === 'sent' ? (
                <Text style={styles.stateNote}>{t('traveler.waitlistRecorded')}</Text>
              ) : (
                <Pressable
                  hitSlop={8}
                  onPress={async () => setWaitlisted((await joinWaitlist(waitlistAt)) ? 'sent' : 'failed')}
                >
                  <Text style={styles.stateNote}>
                    {waitlisted === 'failed' ? t('traveler.waitlistFailed') : t('traveler.waitlistJoin')} ›
                  </Text>
                </Pressable>
              )
            )}
            {priceFailed && !unavailable && !pricing && (
              <Text style={styles.stateNote}>{t('traveler.selectDestAgain')}</Text>
            )}
            {modeNote && <Text style={styles.payNote}>{modeNote}</Text>}
            <PrimaryButton
              label={busy ? t('traveler.busyChecking') : t('traveler.confirmTravel')}
              disabled={!canReserve}
              onPress={confirm}
              style={styles.confirm}
            />
            <Text style={styles.cancelTerms}>{t('traveler.cancellationGrace')}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 16 },
  // Demo field card: padding 2px 20px, rows at 16px 0 with 1px hairline dividers.
  tripCard: { marginTop: 16, paddingVertical: 2, paddingHorizontal: 20 },
  slot: { paddingVertical: 16 },
  searchSlot: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  slotDivider: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  slotLabel: { fontSize: 12, color: colors.muted },
  slotValue: { fontSize: 15, color: colors.ink, marginTop: 2 },
  pin: { width: 9, height: 9, borderRadius: 5 },
  input: { fontSize: 16.5, color: colors.ink, paddingTop: 6, padding: 0 },
  resultsCard: { marginTop: 14, paddingVertical: 2, paddingHorizontal: 20 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  hair: { borderTopWidth: 1, borderTopColor: colors.hairline },
  resultName: { fontSize: 15, color: colors.ink },
  resultMeta: { fontSize: 12.5, color: colors.muted, marginTop: 3 },
  noResults: { fontSize: 13.5, color: colors.muted, paddingVertical: 16 },
  mapPickText: { fontSize: 15, fontWeight: '600', color: colors.ink2 },
  routeDistance: { fontSize: 13, color: colors.ink2, marginTop: 8 },
  whenText: { fontSize: 15, color: colors.ink },
  // MONOCHROME, NOT A HYPERLINK (Chad, 13 Sept 2026). Weight and ink carry the control
  // instead of colour, which also keeps it legible to a reader who cannot separate two greys.
  modify: { fontSize: 13.5, fontWeight: '600', color: colors.ink2, marginTop: 4 },
  waitNote: { fontSize: 13, color: colors.ink2, marginTop: 12 },
  label: { marginTop: 22 },
  listCard: { marginTop: 10, paddingVertical: 2, paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 16 },
  dotRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowTitle: { fontSize: 15.5, color: colors.ink },
  rowSub: { fontSize: 12.5, color: colors.muted, marginTop: 3, lineHeight: 17 },
  // Demo Smart Travel promo: tinted card, padding 16/18, solid 36px rail tile radius 9.
  smartCard: {
    marginTop: 12,
    backgroundColor: colors.blueTint,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  smartHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  smartTile: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartTitle: { fontSize: 15.5, fontWeight: '600', color: colors.ink },
  smartSub: { fontSize: 12.5, color: colors.ink2, marginTop: 12 },
  smartMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  // Greyed, not hidden: the option exists, and the card says why it is not offered here.
  smartCardOff: { backgroundColor: colors.card, borderColor: colors.hairline },
  smartTileOff: { backgroundColor: colors.faint },
  smartTitleOff: { color: colors.muted },
  cabinCard: { marginTop: 10, paddingVertical: 2, paddingHorizontal: 18 },
  cabinRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  cabinLabel: { fontSize: 13.5, color: colors.ink2 },
  cabinValue: { fontSize: 13.5, fontWeight: '600', color: colors.ink },
  govFeeCard: { marginTop: 10, paddingVertical: 4, paddingHorizontal: 18 },
  govFeeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  govFeeName: { fontSize: 13.5, color: colors.ink },
  govFeeSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  footer: { borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 12 },
  totalCard: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 16, fontWeight: '600', color: colors.ink },
  totalState: { fontSize: 15, color: colors.muted },
  stateNote: { fontSize: 13, color: colors.ink, marginTop: 8 },
  payNote: { fontSize: 12, color: colors.muted, marginTop: 8, textAlign: 'right', paddingHorizontal: 4 },
  confirm: { marginTop: 12 },
  cancelTerms: { fontSize: 12, color: colors.ink2, marginTop: 10, lineHeight: 17.5, textAlign: 'center' },
});
