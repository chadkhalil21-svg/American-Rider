// American Rider — route monitoring.
//
// WHAT THIS IS FOR (Chad, 23 Aug 2026): "If a vehicle is stationary or whatever it is, the
// platform AI asks the traveler if everything is alright, or it also confirms with the
// operator what's going on. And, also, our platform AI may see itself if there is traffic in
// the area."
//
// THE ORDER IS THE WHOLE DESIGN. A car that has not moved for six minutes is, nine times out
// of ten, a car at a light on the causeway. An app that reacts to that by asking a traveler
// whether they are safe has just invented an emergency, and after the second false alarm
// nobody reads the third. So the platform works from the outside in:
//
//   1. Explain it if we can.  Are OTHER vehicles in the same half-mile also stopped? Then it
//      is the road, not the journey. Nobody is asked anything; the traveler is simply told
//      what the delay is.
//   2. Ask the operator.      They can answer without anybody being alarmed, and they are the
//      one person who actually knows.
//   3. Ask the traveler.      Only once the operator has been asked and has not answered.
//   4. Open a case.           Only once neither has.
//
// WHERE THE TRAFFIC SIGNAL COMES FROM. We have no traffic feed — OSRM's public routing has no
// live conditions, and Apple's Maps Server API needs a key that does not exist yet. But we do
// not need one to answer the question that matters. Every operator carrying a traveler is
// reporting their position, so the fleet IS the traffic sensor: three cars crawling in the
// same half-mile is congestion, and one car stopped while the others move is not. It costs
// nothing, it needs no vendor, and it gets sharper as Miami fills up.
//
// WHAT THE MODEL DOES, AND WHAT IT MUST NOT. Claude reads the OPERATOR'S OWN WORDS and decides
// whether they settle the matter or make it worse — "stuck behind an accident on the 836"
// settles it; "she's not answering me" does not. It never invents a position, a delay or a
// reason: every fact it is given comes from the record. With no key configured the ladder
// still runs on the thresholds alone, and says less.
const { distanceMiles, matchOperator, coverageLapsed } = require('./matching');
const { screeningReady } = require('./screening');
const { adminDb, adminStatus } = require('./firebase-admin');
const { fileTicket } = require('./tickets');
const { readKey } = require('./env');
const { notify } = require('./push');

// A vehicle that has stayed inside this radius is "not moving". Wide enough to absorb GPS
// drift at a standstill, tight enough that crawling traffic still reads as movement.
// One tick's worth of unanswered travel. Higher than any real backlog should reach, low
// enough that a stuck queue cannot quietly spend a day's read budget before anyone notices.
const ASSIGNED_SCAN_LIMIT = 50;

// Travels underway that one monitoring tick will cover. Deliberately far above any plausible
// concurrent load for a single market, because exceeding it means somebody is not being
// watched — see the note at the query itself.
const LIVE_SCAN_LIMIT = 500;

const STILL_RADIUS_MI = 0.03; // ~48 metres

// How long a stop has to last before it is worth a word. Six minutes is a long light and a
// short problem.
const STILL_MIN = 6;

// Escalation. The operator gets four minutes to answer before the traveler is asked, and five
// more before a person is brought in.
const ASK_TRAVELER_AFTER_MIN = 5;
const OPEN_CASE_AFTER_MIN = 9;

// How close another vehicle has to be to be evidence about this one's road.
const NEARBY_MI = 0.6;
const CONGESTION_MIN_VEHICLES = 2;

// Telemetry older than this tells us nothing about now — a phone that has lost signal is not
// a car that has stopped, and must never be reported as one.
const STALE_MIN = 5;

/** The stages of a travel where the vehicle is expected to be moving. */
const MOVING_STAGES = new Set(['accepted', 'onboard']);

const minutesSince = (t, now) => (now - Number(t || 0)) / 60000;

/**
 * One pass over everything underway.
 *
 * Returns a report. Never throws — it shares an interval with the scheduled-travel sweep and
 * must not be able to stop it.
 */
async function sweepMonitor({ now = Date.now() } = {}) {
  const db = adminDb();
  if (!db) return { ok: false, reason: adminStatus().reason, watching: 0 };

  const report = {
    ok: true, watching: 0, moving: 0, congestion: 0,
    asked: [], cases: [], emergencies: [], reoffered: [],
  };

  let live;
  try {
    // Queried on status alone — one equality filter, no composite index. See scheduler.js for
    // why that matters more than the extra rows.
    // BOUNDED, BUT NEVER SILENTLY. This reads every travel underway, once a minute — so the
    // cost is 1,440 x the number of journeys in progress, per day, and it is the one sweep
    // whose size grows with real success rather than with a backlog.
    //
    // A CAP HERE IS NOT LIKE THE OTHERS. sweepAssignments can safely look at fifty unanswered
    // travels and catch the rest next minute. This sweep is route monitoring: a travel it does
    // not read is a vehicle nobody is watching, which is the one thing this file exists to
    // prevent. So the limit is high, and when it is reached the overflow is REPORTED — it
    // reaches /health and /ops rather than being quietly dropped. A safety sweep that silently
    // stops covering everybody is worse than one that fails loudly.
    const snap = await db
      .collection('rides')
      .where('status', 'in', ['accepted', 'arrived', 'onboard'])
      .limit(LIVE_SCAN_LIMIT + 1)
      .get();
    live = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (live.length > LIVE_SCAN_LIMIT) {
      live = live.slice(0, LIVE_SCAN_LIMIT);
      report.unwatched = true;
      report.reason =
        `More than ${LIVE_SCAN_LIMIT} travels are underway; only the first ${LIVE_SCAN_LIMIT} ` +
        'were monitored this tick. Raise LIVE_SCAN_LIMIT — the fleet has outgrown it.';
    }
  } catch (e) {
    return { ok: false, reason: `could not read travel underway: ${e.message}`, watching: 0 };
  }

  // Every vehicle we have a fresh position for, whatever stage it is at. This is the sensor.
  const fleetNow = live
    .filter((r) => Number.isFinite(r.opLat) && Number.isFinite(r.opLng))
    .filter((r) => minutesSince(r.opAt, now) <= STALE_MIN)
    .map((r) => ({
      id: r.id,
      lat: r.opLat,
      lng: r.opLng,
      stillMin: r.stillSince ? minutesSince(r.stillSince, now) : 0,
    }));

  for (const ride of live) {
    // A vehicle waiting AT the pickup is doing its job by being stationary. Watching it would
    // generate a check-in on every travel where the traveler takes a moment to come down.
    if (!MOVING_STAGES.has(ride.status)) continue;
    if (!Number.isFinite(ride.opLat) || !Number.isFinite(ride.opLng)) continue;
    if (minutesSince(ride.opAt, now) > STALE_MIN) continue;

    report.watching++;

    // HOW LONG IT HAS BEEN STOPPED, decided here rather than taken on trust.
    //
    // The operator's phone reports `stillSince` because it sees a position every fifteen
    // seconds and this sweep sees one a minute. But the server keeps its own anchor — the
    // last place it actually watched the vehicle move — and resets the clock if the car has
    // left it. Both corrections can only ever SHORTEN the stationary period, so no phone can
    // make itself look stuck, and a phone that reports nothing still gets watched.
    const here = { lat: ride.opLat, lng: ride.opLng };
    const seen = ride.monitorSeen;
    let stillSince = Number(ride.stillSince) || 0;
    let movedSinceAnchor = false;
    if (seen && Number.isFinite(seen.lat) && Number.isFinite(seen.lng)) {
      movedSinceAnchor = distanceMiles(seen, here) > STILL_RADIUS_MI;
      if (movedSinceAnchor) stillSince = Math.max(stillSince, Number(ride.opAt) || now);
    } else {
      // First sight of this vehicle. It has not been stationary for any length of time we can
      // vouch for, so it has not been stationary.
      stillSince = Math.max(stillSince, Number(ride.opAt) || now);
      movedSinceAnchor = true;
    }
    if (movedSinceAnchor) {
      await write(db, ride.id, { monitorSeen: { lat: here.lat, lng: here.lng, at: now } });
    }

    const stillMin = minutesSince(stillSince, now);
    const m = ride.monitor || {};

    // ---- Moving again. Clear anything outstanding. ------------------------------------
    if (stillMin < STILL_MIN) {
      report.moving++;
      if (m.state && m.state !== 'clear') {
        // Every outstanding question is withdrawn, not left on the screen to be answered
        // about a delay that is over.
        await write(db, ride.id, {
          monitor: {
            state: 'clear',
            clearedAt: now,
            note: 'The vehicle is moving again.',
            caseNo: m.caseNo || null,
          },
        });
      }
      continue;
    }

    // ---- 1. Is it the road? -----------------------------------------------------------
    const neighbours = fleetNow.filter(
      (v) => v.id !== ride.id && distanceMiles(v, { lat: ride.opLat, lng: ride.opLng }) <= NEARBY_MI,
    );
    const alsoStopped = neighbours.filter((v) => v.stillMin >= STILL_MIN / 2).length;

    if (alsoStopped >= CONGESTION_MIN_VEHICLES) {
      report.congestion++;
      // Reported to both, asked of neither. A delay with a known cause is information, not a
      // question — and this is the branch that stops the whole feature from crying wolf.
      if (m.state !== 'congestion') {
        await write(db, ride.id, {
          monitor: {
            state: 'congestion',
            since: stillSince,
            vehiclesStopped: alsoStopped + 1,
            note:
              `Traffic on this road: ${alsoStopped + 1} American Rider vehicles in this area ` +
              `are stopped.`,
            at: now,
          },
        });
      }
      continue;
    }

    // ---- The operator has answered. Read what they said. ------------------------------
    if (m.operatorReply && !m.operatorReplyReadAt) {
      const verdict = await readReply({
        reply: String(m.operatorReply),
        stillMin: Math.round(stillMin),
        stage: ride.status,
      });
      if (verdict.resolved) {
        await write(db, ride.id, {
          monitor: {
            ...m,
            state: 'explained',
            operatorReplyReadAt: now,
            note: verdict.note,
          },
        });
        continue;
      }
      // Not settled. Straight past the ladder — the operator has told us something is wrong,
      // which is a stronger signal than silence.
      const caseNo = await openCase(db, ride, {
        now,
        why: `The operator was asked why the vehicle was stopped and answered: "${m.operatorReply}"`,
        urgent: verdict.urgent,
      });
      if (verdict.urgent) {
        await raiseEmergency(db, ride, { now, caseNo, note: verdict.note, from: 'operator' });
        report.emergencies.push({ rideId: ride.id, caseNo, from: 'operator' });
      } else {
        await write(db, ride.id, {
          monitor: { ...m, state: 'escalated', operatorReplyReadAt: now, caseNo, note: verdict.note },
        });
        report.cases.push({ rideId: ride.id, caseNo, why: 'operator reported a problem' });
      }
      continue;
    }

    // ---- 2. Ask the operator. ---------------------------------------------------------
    if (!m.askedOperatorAt) {
      await write(db, ride.id, {
        monitor: {
          state: 'asked_operator',
          since: stillSince,
          askedOperatorAt: now,
          stillMin: Math.round(stillMin),
          // The number, not "for a while". A question that states what it is about can be
          // answered; one that gestures at it has to be interpreted first.
          question:
            `Your vehicle has been stationary for ${Math.round(stillMin)} minutes. ` +
            `Is everything alright?`,
          at: now,
        },
      });
      await notify({
        uid: ride.operatorId,
        kind: 'check_in',
        title: 'American Rider check-in',
        body: `Your vehicle has been stationary for ${Math.round(stillMin)} minutes. Is everything alright?`,
        data: { screen: '/operator/trip', rideId: ride.id },
      });
      report.asked.push({ rideId: ride.id, who: 'operator' });
      continue;
    }

    // ---- 3. Ask the traveler. ---------------------------------------------------------
    const sinceAsked = minutesSince(m.askedOperatorAt, now);
    if (!m.askedTravelerAt && sinceAsked >= ASK_TRAVELER_AFTER_MIN && ride.status === 'onboard') {
      await write(db, ride.id, {
        monitor: {
          ...m,
          state: 'asked_traveler',
          askedTravelerAt: now,
          stillMin: Math.round(stillMin),
          travelerQuestion:
            `This travel has been stationary for ${Math.round(stillMin)} minutes. ` +
            `Is everything alright?`,
        },
      });
      await notify({
        uid: ride.travelerUid,
        kind: 'check_in',
        title: 'American Rider check-in',
        body: `Your travel has been stationary for ${Math.round(stillMin)} minutes. Is everything alright?`,
        data: { screen: '/ride', rideId: ride.id },
      });
      report.asked.push({ rideId: ride.id, who: 'traveler' });
      continue;
    }

    // A traveler who has said they are fine ends it. They are in the car; they know.
    if (m.travelerReply === 'ok') {
      if (m.state !== 'explained') {
        await write(db, ride.id, {
          monitor: { ...m, state: 'explained', note: 'The traveler confirmed all is well.' },
        });
      }
      continue;
    }

    // ---- 4. Bring in a person. --------------------------------------------------------
    if (!m.caseNo && (sinceAsked >= OPEN_CASE_AFTER_MIN || m.travelerReply === 'help')) {
      const asked = m.travelerReply === 'help';
      const caseNo = await openCase(db, ride, {
        now,
        why: asked
          ? 'The traveler asked for help from the check-in on the travel screen.'
          : `The vehicle has been stationary for ${Math.round(stillMin)} minutes and neither ` +
            `the operator nor the traveler answered.`,
        urgent: asked,
      });
      if (asked) {
        await raiseEmergency(db, ride, { now, caseNo, note: 'The traveler asked for help.', from: 'traveler' });
        report.emergencies.push({ rideId: ride.id, caseNo, from: 'traveler' });
      } else {
        await write(db, ride.id, { monitor: { ...m, state: 'escalated', caseNo, at: now } });
        report.cases.push({ rideId: ride.id, caseNo, why: 'no answer' });
      }
    }
  }

  return report;
}

/**
 * Read the operator's answer.
 *
 * The model's ONLY job is judgement on words a person actually wrote. It is given no
 * discretion over the facts and cannot report a position, a delay or a cause of its own.
 *
 * With no key, or on any failure, the deterministic reading below runs instead: an answer
 * that mentions the road settles it, and anything else does not. Erring towards "not settled"
 * is the safe direction — it costs a support case, not a traveler.
 */
async function readReply({ reply, stillMin, stage }) {
  const fallback = () => {
    // Ordered so trouble wins: "we were in a crash" must not be settled as "crash up ahead".
    // `trouble` is tested FIRST, which is what lets "accident" live in `road`: an accident up
    // ahead is traffic, an accident we were in is not, and only the order tells them apart.
    const road = /(traffic|jam|light|lights|bridge|closed|closure|construction|roadwork|detour|congest|backed up|drawbridge|train|accident|waiting|passenger|rider|fuel|gas|parking|park|delivery|truck|wrong turn|rain|storm|flood)/i;
    const trouble = /(unwell|not (feeling )?well|not ok|sick|hurt|injur|bleed|unconscious|help|ambulance|911|unsafe|danger|scared|threat|weapon|argu|fight|assault|harass|refus|collision|we (were|got) (in|hit)|hit us|rear.?ended)/i;
    if (trouble.test(reply)) {
      return { resolved: false, urgent: true, note: 'The operator reported a problem.' };
    }
    if (road.test(reply)) {
      return { resolved: true, urgent: false, note: `Delay explained by the operator: ${reply}` };
    }
    return { resolved: false, urgent: false, note: `The operator's answer needs review: ${reply}` };
  };

  const key = readKey('ANTHROPIC_API_KEY');
  if (!key) return fallback();

  try {
    const AnthropicPkg = require('@anthropic-ai/sdk');
    const Anthropic = AnthropicPkg.default ?? AnthropicPkg;
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 250,
      system:
        'You monitor journeys for a transportation company. An operator was asked why their ' +
        'vehicle had stopped during a passenger journey, and answered. Decide whether the ' +
        'answer settles the matter or whether it must go further.\n\n' +
        'Reply with JSON only: {"resolved":bool,"urgent":bool,"note":string}.\n\n' +
        'MOST STOPS ARE ORDINARY AND YOU SHOULD SETTLE THEM. Traffic, a light, a closure, a ' +
        'bridge, a train, roadworks, a detour, a wrong turn, waiting on the passenger, ' +
        'fuel, parking, a delivery vehicle in the way — resolved=true, and nobody is ' +
        'disturbed. A company that escalates ordinary delays trains everyone to ignore it.\n\n' +
        'urgent=true ONLY where a person may be unwell, injured, unsafe, threatened, or in ' +
        'conflict, or where the vehicle has been in a collision. This routes both phones to ' +
        'emergency services, so it must be the situation and not the wording: an operator ' +
        'saying "accident up ahead" is traffic, not an emergency.\n\n' +
        'resolved=false with urgent=false is for the genuinely unclear — a person reads it.\n\n' +
        'note: one plain sentence stating the reason. Institutional and precise. No ' +
        'reassurance, no exclamation marks, no invented detail. Never state a location, a ' +
        'delay or a cause the operator did not give you.',
      messages: [
        {
          role: 'user',
          content:
            `Stage: ${stage === 'onboard' ? 'carrying the traveler' : 'driving to the pickup'}\n` +
            `Stopped for: ${stillMin} minutes\n` +
            `Operator's answer: ${reply}`,
        },
      ],
    });
    const text = (res.content || []).map((c) => c.text || '').join('');
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    if (typeof parsed.resolved !== 'boolean') return fallback();
    return {
      resolved: parsed.resolved,
      urgent: !!parsed.urgent,
      note: String(parsed.note || '').slice(0, 300) || fallback().note,
    };
  } catch {
    return fallback();
  }
}

/**
 * THE EMERGENCY LANE — Chad, 23 Aug: "Let it go straight to nine one one."
 *
 * WHAT A PLATFORM CAN AND CANNOT DO HERE, honestly. There is no free, public way to dispatch
 * 911 from a server, and there should not be: 911 is routed by the caller's own location to
 * the right answering point, a dispatcher needs someone who can speak to the situation, and
 * knowingly causing a false dispatch is a crime in Florida. Relay services exist (Noonlight,
 * RapidSOS) and they are paid.
 *
 * So the fastest correct route to 911 is the phone that is AT the scene, and this puts it one
 * tap away rather than four:
 *   - both phones are pushed at the highest priority, which opens the emergency screen
 *   - that screen already holds Call 911, the vehicle, the plate, the operator and the
 *     position — everything a dispatcher asks for, on screen, to read out
 *   - the case is filed as an emergency with the last known position on it
 *   - the travel is marked so nothing else about it reads as routine
 *
 * WHAT IS NOT DONE, DELIBERATELY: no automatic call is placed. A platform that dials 911 on a
 * misread word sends police to a traveler who said the word "accident" about the traffic.
 */
async function raiseEmergency(db, ride, { now, caseNo, note, from }) {
  await write(db, ride.id, {
    monitor: {
      state: 'emergency',
      caseNo: caseNo || null,
      note: note || null,
      raisedBy: from,
      raisedAt: now,
      // What the emergency screen shows and a dispatcher is told, captured at this instant
      // rather than looked up later when the vehicle has moved.
      position: { lat: ride.opLat ?? null, lng: ride.opLng ?? null, at: ride.opAt ?? now },
    },
  });

  const body = 'Open American Rider to call 911. Your location and vehicle details are on screen.';
  // BOTH PARTIES, whichever of them raised it. The one who did not raise it is the one who may
  // not know yet, and in the case where they cannot use their own phone the other can.
  await notify({
    uid: ride.travelerUid,
    kind: 'check_in',
    title: 'Emergency assistance',
    body,
    data: { screen: '/emergency', rideId: ride.id, tripNo: ride.tripNo || '', emergency: true },
  });
  await notify({
    uid: ride.operatorId,
    kind: 'check_in',
    title: 'Emergency assistance',
    body,
    data: { screen: '/emergency', rideId: ride.id, tripNo: ride.tripNo || '', emergency: true },
  });
}

async function openCase(db, ride, { now, why, urgent }) {
  try {
    const filed = await fileTicket({
      uid: ride.travelerUid,
      email: ride.travelerEmail || '',
      kind: urgent ? 'emergency' : 'support',
      reason: 'Route monitoring',
      trip: ride.tripNo || '',
      description:
        `Route monitoring opened this case on travel ${ride.tripNo || '(no travel number)'}.\n` +
        `${why}\n` +
        `Stage: ${ride.status}. Operator: ${ride.operatorName || '—'} (${ride.operatorId || '—'}).\n` +
        `Last known position: ${ride.opLat}, ${ride.opLng} at ` +
        `${new Date(Number(ride.opAt) || now).toISOString()}.\n` +
        `Route: ${ride.dep || '—'} to ${ride.dest || '—'}.`,
    });
    return filed?.caseNo || null;
  } catch {
    return null;
  }
}

async function write(db, rideId, fields) {
  try {
    await db.collection('rides').doc(rideId).set(fields, { merge: true });
  } catch {
    /* a lost note must not stop the sweep */
  }
}

/**
 * Travel that was dispatched and never answered.
 *
 * THE DEFECT THIS CLOSES, and it is the one that made the operator loop unusable. The request
 * sheet ran a fifteen-second countdown and declined itself at zero. That is right for an
 * operator looking at the screen and catastrophic for one with the phone in their pocket:
 * every travel dispatched to them was refused before they could know it existed, and the
 * traveler was passed from operator to operator by phones that had never been looked at.
 *
 * The countdown now runs only while the app is in the foreground. This is the other half:
 * a travel nobody has answered is RE-OFFERED to the next nearest operator, by the server,
 * after a window long enough to reach for a phone.
 *
 * It is also the backstop for the assignment notification — if POST /travel/announce never
 * arrived, the operator is told here instead, at most a minute late.
 */
const ANSWER_WINDOW_SEC = 45;

// A dispatch nobody answered in an hour is not going to be answered. Past this it is history,
// not a live request, and working it every sixty seconds forever is pointless.
//
// FOUND IN PRODUCTION, 23 Aug 2026. The first sweep against the real database reported
// `pending: 67` — sixty-seven travels left in 'assigned' from development, each one read,
// matched against the fleet and considered for re-offer on every tick. Nothing came of it
// only because those records carry no coordinates; had they carried any, real operators would
// have been sent journeys from weeks ago.
const STALE_ASSIGNMENT_MS = 60 * 60 * 1000;

async function sweepAssignments({ now = Date.now() } = {}) {
  const db = adminDb();
  if (!db) return { ok: false, reason: adminStatus().reason, pending: 0 };
  const out = { ok: true, pending: 0, notified: [], reoffered: [], stranded: [], expired: [], positionless: [] };

  let rows;
  try {
    // BOUNDED. Firestore bills per document RETURNED, and this query runs every 60 seconds —
    // 1,440 times a day — so each unanswered travel it matches costs 1,440 reads a day for as
    // long as it sits there. The 67 stale 'assigned' records found on 28 Aug were therefore
    // costing ~96,000 reads a day on their own, against a 50,000/day allowance, for travel
    // nobody was waiting on. That is what exhausted the quota, not anybody using the app.
    //
    // The expiry below is the real cure and it now runs; this limit is the guard that stops a
    // backlog ever being able to do it again while nobody is looking.
    const snap = await db
      .collection('rides')
      .where('status', '==', 'assigned')
      .limit(ASSIGNED_SCAN_LIMIT)
      .get();
    rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    return { ok: false, reason: e.message, pending: 0 };
  }

  // Read at most once per sweep, and only if some travel actually needs re-offering. A quiet
  // minute must not cost a fleet read.
  let fleetCache = null;
  const fleetOnce = async () => {
    if (!fleetCache) {
      const ops = await db.collection('operators').get();
      fleetCache = ops.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    return fleetCache;
  };

  for (const ride of rows) {
    const age = now - (Number(ride.createdAt) || now);

    // Old enough to be history. Stamped once so it stops being read as a pending dispatch,
    // and NOT deleted — a travel record is the traveler's, whatever became of it.
    if (age > STALE_ASSIGNMENT_MS) {
      if (!ride.staleAt) {
        await write(db, ride.id, { status: 'expired', staleAt: now, unanswered: true });
        out.expired.push(ride.id);
      }
      continue;
    }

    const since = age / 1000;
    out.pending++;

    if (!ride.notifiedOperatorAt) {
      await notify({
        uid: ride.operatorId,
        kind: 'travel_assigned',
        title: 'Travel assigned',
        body: `${ride.dep || 'Pickup'} to ${ride.dest || 'destination'}. Open to accept.`,
        data: { screen: '/operator', rideId: ride.id, tripNo: ride.tripNo || '' },
      });
      await write(db, ride.id, { notifiedOperatorAt: now });
      out.notified.push(ride.id);
      continue; // give them the window before anything is taken away
    }

    if (since < ANSWER_WINDOW_SEC) continue;

    // Unanswered. Find somebody else, excluding everyone who has already had it.
    const declined = Array.isArray(ride.declinedBy) ? ride.declinedBy : [];
    const exclude = new Set([...declined, ride.operatorId]);
    let fleet = [];
    try {
      // ONCE PER SWEEP, NOT ONCE PER TRAVEL. This read the whole fleet inside the loop, so
      // ten unanswered travels meant ten full reads of `operators` every minute — and every
      // sweep on this tick spends the same daily Firestore allowance. scheduler.js hoists its
      // fleet read for exactly this reason; this one never did, and the project reached 47,000
      // reads a day against a 50,000 ceiling on a database with 166 writes in it.
      //
      // The exclusions are per-travel, so they stay in the loop. Only the READ is shared.
      fleet = (await fleetOnce()).filter((o) => !exclude.has(o.id)).filter((o) => !coverageLapsed(o));
    } catch {
      continue;
    }

    const pickup = { lat: Number(ride.pickupLat), lng: Number(ride.pickupLng) };
    // Fall back to the operator's own last position when there is no pickup on the record.
    const from = Number.isFinite(pickup.lat)
      ? pickup
      : { lat: Number(ride.opLat), lng: Number(ride.opLng) };
    // NO POSITION, SO NO SEARCH — BUT SAY SO. This used to be a bare `continue`, and the
    // comment above it said app-booked rides "carry no pickup coordinates" as though that
    // were a tolerable condition rather than a bug. It was not: dispatch.ts received the
    // pickup and never stored it, so EVERY travel booked in the app landed here and was
    // dropped. Not notified, not reoffered, not stranded, no case — invisible in all five
    // counters, with `pending` climbing and a paid traveler waiting on somebody who was
    // never coming.
    //
    // dispatch.ts writes pickupLat/pickupLng now, so this should be unreachable for anything
    // booked since. Records written before it still land here, and a sweep that cannot act
    // on a travel must report that it could not rather than looking like it had nothing to do.
    if (!Number.isFinite(from.lat)) {
      out.positionless.push(ride.id);
      continue;
    }

    const next = matchOperator(fleet, from, ride.travelClass || 'Standard', { requireScreening: screeningReady() });
    if (!next) {
      // Nobody left. The travel stays with the operator it has rather than being cancelled
      // out from under a traveler who has paid — but it is recorded, so the state is legible.
      await write(db, ride.id, { unanswered: true, unansweredAt: now });
      out.stranded.push(ride.id);
      continue;
    }

    await write(db, ride.id, {
      operatorId: next.operator.id,
      operatorName: next.operator.name || '',
      declinedBy: [...declined, ride.operatorId],
      createdAt: now, // restarts the answer window for the new operator
      notifiedOperatorAt: null,
      reofferedAt: now,
    });
    out.reoffered.push({ rideId: ride.id, to: next.operator.name });
  }

  return out;
}

module.exports = {
  sweepMonitor,
  sweepAssignments,
  readReply,
  STILL_MIN,
  STILL_RADIUS_MI,
  ASK_TRAVELER_AFTER_MIN,
  OPEN_CASE_AFTER_MIN,
  NEARBY_MI,
};
