#!/usr/bin/env node
// Lists the routes in a GTFS feed that a traveler can rely on without a timetable.
//
// A route qualifies when, on a reference weekday between 07:00 and 19:00 at its busiest stop
// (one direction), the wait for the next departure is at most --max-headway minutes in
// --percentile percent of cases AND never exceeds --max-gap minutes. The waits at the edges of
// the window (07:00 to the first departure, last departure to 19:00) count as gaps, so a service
// that starts late or stops early does not qualify. The second condition is what keeps out
// peak-only expresses: route 95 has a 7.5-minute median headway and a 375-minute midday gap.
// Rail of any kind (route_type 0 tram/people mover, 1 subway, 2 rail) is included regardless.
//
// Reads the zip with `unzip -p` (a macOS and Linux built-in); no npm dependencies.
//
//   node infra/otp/frequent-routes.mjs <gtfs.zip> <out.json> [--feed-id MDT] [--date YYYYMMDD]
//        [--max-headway 15] [--max-gap 30] [--percentile 90]
//
// <out.json> is THE REGION'S allow-list: backend/transit-routes.<region id>.json, the file
// backend/regions.js names as `transit.frequentRoutesFile` for that region (South Florida:
// backend/transit-routes.fl-southeast.json). transit.js reads the file the travel's region
// names, so a list written under any other name is a list nobody reads.
//
// --feed-id  The prefix OpenTripPlanner puts in front of route ids (`gtfsId: "MDT:31009"`).
//            It is the `feedId` declared in infra/otp/build-config.json, NOT the agency_id in
//            the feed. Defaults to the feed's agency_id only when no --feed-id is given.
// --date     Reference service day. Defaults to the next Wednesday on or after today.
//
// Output: { generatedAt, feed, feedId, routes: [{ id, gtfsId, shortName, longName, type, headwayMin, ... }] }
// One feed per run. A region with several feeds gets one run per feed; transit.js accepts an
// array of these files under one name, so concatenate them: `[ <run 1>, <run 2> ]`.

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const args = process.argv.slice(2);
const positional = [];
const opts = { feedId: null, date: null, maxHeadway: 15, maxGap: 30, percentile: 90 };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--feed-id') opts.feedId = args[++i];
  else if (a === '--date') opts.date = args[++i];
  else if (a === '--max-headway') opts.maxHeadway = Number(args[++i]);
  else if (a === '--max-gap') opts.maxGap = Number(args[++i]);
  else if (a === '--percentile') opts.percentile = Number(args[++i]);
  else positional.push(a);
}
const [zipPath, outPath] = positional;
if (!zipPath || !outPath) {
  console.error('usage: frequent-routes.mjs <gtfs.zip> <out.json> [--feed-id ID] [--date YYYYMMDD] [--max-headway N] [--max-gap N] [--percentile N]');
  process.exit(2);
}

const WINDOW_START = 7 * 60;   // 07:00, minutes after midnight
const WINDOW_END = 19 * 60;    // 19:00
const RAIL_TYPES = new Set(['0', '1', '2']);

// --- CSV --------------------------------------------------------------------------------

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// Streams one file out of the zip, calling onRow(objectKeyedByHeader) per data line.
function readTable(zip, name, onRow) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('unzip', ['-p', zip, name]);
    let header = null;
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
    rl.on('line', (raw) => {
      const line = raw.replace(/^﻿/, '').replace(/\r$/, '');
      if (!line.trim()) return;
      const cells = parseCsvLine(line);
      if (!header) { header = cells.map((h) => h.trim()); return; }
      const row = {};
      for (let i = 0; i < header.length; i++) row[header[i]] = (cells[i] ?? '').trim();
      onRow(row);
    });
    rl.on('close', () => {
      child.on('close', (code) => {
        if (code !== 0) reject(new Error(`unzip -p ${zip} ${name} exited ${code}: ${stderr.trim()}`));
        else resolvePromise();
      });
    });
    child.on('error', reject);
  });
}

async function readOptionalTable(zip, name, onRow) {
  try { await readTable(zip, name, onRow); return true; } catch (e) { if (/exited 11|caution|not found/i.test(e.message)) return false; throw e; }
}

// --- Dates ------------------------------------------------------------------------------

function yyyymmdd(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
function nextWednesday(from) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (d.getDay() !== 3) d.setDate(d.getDate() + 1);
  return d;
}
function weekdayName(ymd) {
  const d = new Date(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)));
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getDay()];
}
function hmsToMinutes(hms) {
  if (!hms) return null;
  const parts = hms.split(':').map(Number);
  if (parts.length < 2 || parts.some(Number.isNaN)) return null;
  return parts[0] * 60 + parts[1] + (parts[2] || 0) / 60;
}
function median(sorted) {
  const n = sorted.length;
  if (n === 0) return null;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}
// Nearest-rank percentile of an ascending array (p in 0..100).
function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}
const round1 = (x) => (x === null ? null : Math.round(x * 10) / 10);

// --- Main -------------------------------------------------------------------------------

const zip = resolve(zipPath);
const refDate = opts.date || yyyymmdd(nextWednesday(new Date()));
const refDay = weekdayName(refDate);

// 1. Which service_ids run on the reference day.
const active = new Set();
await readOptionalTable(zip, 'calendar.txt', (r) => {
  if (r.start_date <= refDate && refDate <= r.end_date && r[refDay] === '1') active.add(r.service_id);
});
await readOptionalTable(zip, 'calendar_dates.txt', (r) => {
  if (r.date !== refDate) return;
  if (r.exception_type === '1') active.add(r.service_id);
  else if (r.exception_type === '2') active.delete(r.service_id);
});
if (active.size === 0) {
  console.error(`No service runs on ${refDate} in ${zip}; pass --date with a day inside the feed's calendar.`);
  process.exit(1);
}

// 2. Agency, routes.
let agencyId = null;
await readTable(zip, 'agency.txt', (r) => { if (!agencyId) agencyId = r.agency_id || r.agency_name; });
const routes = new Map();
await readTable(zip, 'routes.txt', (r) => {
  routes.set(r.route_id, {
    id: r.route_id,
    shortName: r.route_short_name || '',
    longName: r.route_long_name || '',
    type: Number(r.route_type),
  });
});

// 3. Trips running on the reference day → route + direction.
const tripInfo = new Map(); // trip_id -> { route, dir }
await readTable(zip, 'trips.txt', (r) => {
  if (active.has(r.service_id)) tripInfo.set(r.trip_id, { route: r.route_id, dir: r.direction_id || '0' });
});

// 4. Departures in the window, keyed by route → "stop|dir" → [minutes].
const departures = new Map();
await readTable(zip, 'stop_times.txt', (r) => {
  const t = tripInfo.get(r.trip_id);
  if (!t) return;
  const m = hmsToMinutes(r.departure_time || r.arrival_time);
  if (m === null || m < WINDOW_START || m > WINDOW_END) return;
  let byStop = departures.get(t.route);
  if (!byStop) { byStop = new Map(); departures.set(t.route, byStop); }
  const key = `${r.stop_id}|${t.dir}`;
  let list = byStop.get(key);
  if (!list) { list = []; byStop.set(key, list); }
  list.push(m);
});

// 5. Headway at the busiest stop, per route.
const out = [];
for (const route of routes.values()) {
  const byStop = departures.get(route.id);
  let best = null;
  if (byStop) {
    for (const [key, list] of byStop) {
      if (!best || list.length > best.list.length) best = { key, list };
    }
  }
  let headwayMin = null;
  let medianGapMin = null;
  let maxGapMin = null;
  let count = 0;
  let busiestStop = null;
  let firstDeparture = null;
  let lastDeparture = null;
  if (best && best.list.length >= 1) {
    const times = [...new Set(best.list)].sort((a, b) => a - b);
    // Waits: window start → first departure, between departures, last departure → window end.
    const gaps = [times[0] - WINDOW_START];
    for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1]);
    gaps.push(WINDOW_END - times[times.length - 1]);
    gaps.sort((a, b) => a - b);
    headwayMin = round1(percentile(gaps, opts.percentile));
    medianGapMin = round1(median(gaps));
    maxGapMin = round1(gaps[gaps.length - 1]);
    count = times.length;
    busiestStop = best.key.split('|')[0];
    const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
    firstDeparture = hhmm(times[0]);
    lastDeparture = hhmm(times[times.length - 1]);
  }
  const isRail = RAIL_TYPES.has(String(route.type));
  const frequent = headwayMin !== null && headwayMin <= opts.maxHeadway && maxGapMin <= opts.maxGap;
  if (!isRail && !frequent) continue;
  out.push({
    id: route.id,
    gtfsId: `${opts.feedId || agencyId}:${route.id}`,
    shortName: route.shortName,
    longName: route.longName,
    type: route.type,
    headwayMin,
    medianGapMin,
    maxGapMin,
    departures: count,
    firstDeparture,
    lastDeparture,
    busiestStop,
    reason: isRail ? 'rail' : 'frequency',
  });
}
out.sort((a, b) => a.type - b.type || (a.headwayMin ?? 999) - (b.headwayMin ?? 999) || a.shortName.localeCompare(b.shortName, undefined, { numeric: true }));

const result = {
  generatedAt: new Date().toISOString(),
  feed: basename(zip),
  feedId: opts.feedId || agencyId,
  agencyId,
  referenceDate: refDate,
  window: '07:00-19:00',
  maxHeadwayMin: opts.maxHeadway,
  maxGapMin: opts.maxGap,
  percentile: opts.percentile,
  criteria: `route_type 0/1/2 always; otherwise, at the busiest stop+direction, the ${opts.percentile}th-percentile wait within the window (window edges included) <= ${opts.maxHeadway} min and the longest wait <= ${opts.maxGap} min`,
  routeCount: out.length,
  routes: out,
};
writeFileSync(resolve(outPath), JSON.stringify(result, null, 2) + '\n');
console.error(`${out.length} of ${routes.size} routes qualify on ${refDate}; wrote ${resolve(outPath)}`);
